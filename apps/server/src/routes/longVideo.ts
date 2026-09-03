import { Router } from "express";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { getDirectorProvider } from "../providers/manager.js";
import { collectEpisodeStoryboards, collectEpisodeAssets } from "../providers/comfyuiDirector.js";

const router = Router();

async function getPrisma() {
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

const paramsSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  episodeId: z.coerce.number().int().positive(),
});

/** 读取项目视觉手册的「视觉定位/色彩与调色/光影与质感」章节 → 视频画风约束提示
 *  （r2v 视频提示词必须显式声明画风，否则模型默认设色/写实，偏离《宣纸淡墨》等设定） */
async function loadVisualStyleHint(prisma: any, projectId: number): Promise<string> {
  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    const skill = project?.visualSkill ?? "";
    if (!skill) return "";
    const SKILLS_DIR = process.env.SKILLS_DIR || path.resolve(process.cwd(), "../ai/skills");
    const file = path.join(SKILLS_DIR, "art_skills", `${skill}.md`);
    if (!fs.existsSync(file)) return "";
    const content = fs.readFileSync(file, "utf-8");
    // 取章节：视觉定位（参考系）+ 色彩与调色 + 光影与质感（不含人物/场景元素细节，只留画风）
    const lines = content.split(/\r?\n/);
    const wanted = new Set(["## 视觉定位（参考系）", "## 色彩与调色", "## 光影与质感"]);
    const out: string[] = [];
    let inSection = false;
    let cur: string | null = null;
    for (const ln of lines) {
      const t = ln.trim();
      if (wanted.has(t)) { inSection = true; cur = t; continue; }
      if (inSection && /^##\s*/.test(t) && !wanted.has(t)) { inSection = false; cur = null; continue; }
      if (!inSection) continue;
      const clean = t.replace(/^[-*]\s*/, "").trim();
      if (clean && !/^```|^---/.test(clean)) out.push(clean);
    }
    return out.join("；");
  } catch {
    return "";
  }
}

/** 按 集+场 维度 upsert 长视频记录（sceneIndex>0 按场，0=整集） */
async function upsertSceneLongVideo(
  prisma: any,
  projectId: number,
  episodeId: number,
  sceneIndex: number,
  sbs: any[],
  segSnapshot: any[],
) {
  const where = { projectId_episodeId_sceneIndex: { projectId, episodeId, sceneIndex } };
  const data = {
    state: "RUNNING" as const,
    errorReason: null,
    segmentCount: sbs.length,
    segments: segSnapshot,
    segmentStates: sbs.map(() => "RUNNING"),
  };
  const existing = await prisma.episodeLongVideo.findUnique({ where });
  if (existing) return prisma.episodeLongVideo.update({ where, data });
  return prisma.episodeLongVideo.create({ data: { projectId, episodeId, sceneIndex, ...data } });
}

// GET /api/projects/:projectId/episodes/:episodeId/long-video —— 查询长视频状态（sceneIndex 可选：传了查该场，缺省整集）
router.get("/projects/:projectId/episodes/:episodeId/long-video", async (req, res, next) => {
  try {
    const { projectId, episodeId } = paramsSchema.parse(req.params);
    const sceneIndex = req.query.sceneIndex ? z.coerce.number().int().min(0).parse(req.query.sceneIndex) : undefined;
    const prisma = await getPrisma();
    const lv = sceneIndex != null
      ? await prisma.episodeLongVideo.findUnique({
          where: { projectId_episodeId_sceneIndex: { projectId, episodeId, sceneIndex } },
        })
      : await prisma.episodeLongVideo.findFirst({
          where: { projectId, episodeId },
          orderBy: { sceneIndex: "asc" },
        });
    res.json({ data: lv ?? null });
    await prisma.$disconnect();
  } catch (e) {
    next(e);
  }
});

// POST /api/projects/:projectId/episodes/:episodeId/long-video —— 生成视频（按场 sceneIndex 可选；缺省整集全部分镜串联）
router.post("/projects/:projectId/episodes/:episodeId/long-video", async (req, res, next) => {
  try {
    const { projectId, episodeId } = paramsSchema.parse(req.params);
    // sceneIndex 可选：传了则只生成该场分镜；缺省整集
    const sceneIndex = req.body?.sceneIndex ? z.coerce.number().int().min(1).parse(req.body.sceneIndex) : undefined;
    const provider = getDirectorProvider();
    if (!provider) {
      res.status(400).json({ message: "Director 长视频未配置（需本地 ComfyUI + Director 工作流模板）" });
      return;
    }
    const prisma = await getPrisma();
    const allSbs = await collectEpisodeStoryboards(projectId, episodeId, prisma);
    const sbs = sceneIndex ? allSbs.filter((sb: any) => Number(sb.sceneIndex ?? 1) === sceneIndex) : allSbs;
    if (!sbs.length) {
      res.status(400).json({ message: sceneIndex ? `第 ${sceneIndex} 场暂无分镜` : "本集暂无分镜" });
      await prisma.$disconnect();
      return;
    }
    const refAssets = await collectEpisodeAssets(projectId, episodeId, prisma);

    // 分镜片段快照（供前端分段展示/重跑）
    const segSnapshot = sbs.map((sb: any) => ({
      index: sb.index,
      sceneIndex: sb.sceneIndex ?? 1,
      id: sb.id,
      prompt: sb.videoDesc || sb.prompt || "",
      firstFrame: sb.filePath,
    }));

    // upsert 记录（按集+场唯一；重新生成为覆盖）
    const where = sceneIndex
      ? { projectId_episodeId_sceneIndex: { projectId, episodeId, sceneIndex } }
      : undefined;
    const lv = where
      ? await upsertSceneLongVideo(prisma, projectId, episodeId, sceneIndex!, sbs, segSnapshot)
      : await prisma.episodeLongVideo.upsert({
          where: { projectId_episodeId: { projectId, episodeId } },
          update: {
            state: "RUNNING",
            errorReason: null,
            segmentCount: sbs.length,
            segments: segSnapshot,
            segmentStates: sbs.map((_: any) => "RUNNING"),
          },
          create: {
            projectId,
            episodeId,
            state: "RUNNING",
            segmentCount: sbs.length,
            segments: segSnapshot,
            segmentStates: sbs.map((_: any) => "RUNNING"),
          },
        });

    void runLongVideoGenerate(lv.id, projectId, episodeId, sbs, refAssets, undefined, provider, prisma);
    res.json({ data: { id: lv.id, state: "RUNNING", sceneIndex: sceneIndex ?? null } });
    await prisma.$disconnect();
  } catch (e) {
    next(e);
  }
});

// POST /api/projects/:projectId/episodes/:episodeId/long-video/segments/:idx/rerun —— 只重跑某一段（其余段读缓存；sceneIndex 可选）
router.post("/projects/:projectId/episodes/:episodeId/long-video/segments/:idx/rerun", async (req, res, next) => {
  try {
    const { projectId, episodeId } = paramsSchema.parse(req.params);
    const idx = z.coerce.number().int().min(0).parse(req.params.idx);
    const sceneIndex = req.body?.sceneIndex ? z.coerce.number().int().min(1).parse(req.body.sceneIndex) : undefined;
    const provider = getDirectorProvider();
    if (!provider) {
      res.status(400).json({ message: "Director 长视频未配置" });
      return;
    }
    const prisma = await getPrisma();
    const lv = sceneIndex
      ? await prisma.episodeLongVideo.findUnique({
          where: { projectId_episodeId_sceneIndex: { projectId, episodeId, sceneIndex } },
        })
      : await prisma.episodeLongVideo.findFirst({ where: { projectId, episodeId }, orderBy: { sceneIndex: "asc" } });
    if (!lv) {
      res.status(400).json({ message: "尚未生成过该视频，请先生成" });
      await prisma.$disconnect();
      return;
    }
    const allSbs = await collectEpisodeStoryboards(projectId, episodeId, prisma);
    const sbs = sceneIndex ? allSbs.filter((sb: any) => Number(sb.sceneIndex ?? 1) === sceneIndex) : allSbs;
    const refAssets = await collectEpisodeAssets(projectId, episodeId, prisma);

    // 更新该段状态
    const st = Array.isArray(lv.segmentStates) ? [...lv.segmentStates] : [];
    st[idx] = "RUNNING";
    await prisma.episodeLongVideo.update({
      where: { id: lv.id },
      data: { state: "RUNNING", errorReason: null, segmentStates: st },
    });

    void runLongVideoGenerate(lv.id, projectId, episodeId, sbs, refAssets, [idx], provider, prisma);
    res.json({ data: { id: lv.id, state: "RUNNING", rerunIndex: idx } });
    await prisma.$disconnect();
  } catch (e) {
    next(e);
  }
});

/** 实际执行长视频生成（整集 或 单段重跑），后台运行 */
async function runLongVideoGenerate(
  lvId: number,
  projectId: number,
  episodeId: number,
  sbs: any[],
  refAssets: any[],
  runSelection: number[] | undefined,
  provider: any,
  _prisma: any,
) {
  const prisma = await getPrisma();
  const segCount = sbs.length;
  try {
    // 读取项目视觉手册 → 视频风格提示（注入每段 prompt，保证 r2v 画面贴合设定画风）
    const styleHint = await loadVisualStyleHint(prisma, projectId);
    // 生成中：实时上报已完成段数，更新 segmentStates（已完成段置 SUCCEEDED，其余 RUNNING）
    const result = await provider.generateEpisode(sbs, refAssets, {
      ...(runSelection ? { runSelection } : {}),
      styleHint,
      onProgress: (completed: number) => {
        const total = Math.max(segCount, completed);
        const states = new Array(total).fill("RUNNING");
        for (let i = 0; i < completed; i++) states[i] = "SUCCEEDED";
        prisma.episodeLongVideo
          .updateMany({ where: { id: lvId }, data: { segmentStates: states } })
          .catch(() => {});
      },
    });
    const segStates = sbs.map(() => "SUCCEEDED");
    await prisma.episodeLongVideo.updateMany({
      where: { id: lvId },
      data: {
        state: "SUCCEEDED",
        filePath: result.filePath,
        segmentCount: result.segmentCount,
        totalFrames: result.totalFrames,
        segmentStates: segStates,
        errorReason: null,
      },
    });
    console.log(`[long-video] 集 ${episodeId} 长视频完成: ${result.filePath}`);
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : String(e);
    try {
      await prisma.episodeLongVideo.updateMany({ where: { id: lvId }, data: { state: "FAILED", errorReason: msg } });
    } catch {
      /* ignore */
    }
    console.error(`[long-video] 失败: ${msg}`);
  } finally {
    await prisma.$disconnect();
  }
}

export default router;
