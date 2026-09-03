import { Router } from "express";
import { z } from "zod";
import { ComfyUIVideoProvider } from "../providers/comfyuiVideo.js";
import { memoryUpsert } from "./memory.js";

const router = Router();

async function getPrisma() {
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

const paramsSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  episodeId: z.coerce.number().int().positive(),
  storyboardId: z.coerce.number().int().positive(),
});

// 批量路由只需 projectId/episodeId
const epParamsSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  episodeId: z.coerce.number().int().positive(),
});

const videoIdSchema = z.object({ videoId: z.coerce.number().int().positive() });

// 视频 provider（懒初始化，全局单例）
let videoProvider: ComfyUIVideoProvider | null = null;
function getVideoProvider(): ComfyUIVideoProvider | null {
  return videoProvider;
}
export function initVideoProvider(baseUrl: string, workflowPath: string, ossDir: string) {
  videoProvider = new ComfyUIVideoProvider({ baseUrl, workflowPath, ossDir });
}

// POST /api/projects/:projectId/episodes/:episodeId/storyboards/:storyboardId/video
// 创建/更新该分镜的视频记录并触发生成（无则建，有则重新生成）
router.post("/projects/:projectId/episodes/:episodeId/storyboards/:storyboardId/video", async (req, res, next) => {
  try {
    const { projectId, episodeId, storyboardId } = paramsSchema.parse(req.params);
    const provider = getVideoProvider();
    if (!provider) {
      res.status(400).json({ message: "视频工作流未配置" });
      return;
    }
    const prisma = await getPrisma();

    const sb = await prisma.storyboard.findFirst({ where: { id: storyboardId, projectId, episodeId } });
    if (!sb) {
      res.status(404).json({ message: "分镜不存在" });
      return;
    }
    if (!sb.videoDesc && !sb.prompt) {
      res.status(400).json({ message: "请填写视频描述（运镜/动作）" });
      return;
    }

    // 项目比例 → 视频分辨率（ResolutionSelector aspect_ratio）
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    const videoRatio = project?.videoRatio ?? "9:16";

    // upsert 视频记录
    let clip = await prisma.videoClip.findFirst({ where: { storyboardId } });
    if (!clip) {
      clip = await prisma.videoClip.create({
        data: {
          projectId, episodeId, storyboardId,
          flowId: `video-${storyboardId}-${Date.now()}`,
          state: "RUNNING",
        },
      });
    } else {
      // 重新生成：旧成功视频归档为候选（版本号递增），新视频成为待生成最新版
      const archive: any[] = [];
      try { archive.push(...(Array.isArray(clip.candidates) ? clip.candidates : [])); } catch { /* ignore */ }
      if (clip.state === "SUCCEEDED" && clip.filePath) {
        const ver = archive.length ? Math.max(...archive.map((c: any) => c.version ?? 0)) + 1 : 1;
        archive.push({
          version: ver,
          filePath: clip.filePath,
          createdAt: new Date().toISOString(),
          prompt: (await prisma.storyboard.findUnique({ where: { id: storyboardId } }))?.videoDesc || "",
        });
      }
      clip = await prisma.videoClip.update({
        where: { id: clip.id },
        data: { state: "RUNNING", errorReason: null, candidates: archive, selectedVersion: null },
      });
    }
    void runVideoGenerate(clip.id, storyboardId, provider, videoRatio);
    res.json({ data: { id: clip.id, state: "RUNNING" } });
  } catch (e) {
    next(e);
  }
});

// GET /api/projects/:projectId/episodes/:episodeId/storyboards/:storyboardId/video —— 视频状态
router.get("/projects/:projectId/episodes/:episodeId/storyboards/:storyboardId/video", async (req, res, next) => {
  try {
    const { projectId, episodeId, storyboardId } = paramsSchema.parse(req.params);
    const prisma = await getPrisma();
    const clip = await prisma.videoClip.findFirst({ where: { storyboardId, projectId, episodeId } });
    if (!clip) {
      res.status(404).json({ message: "视频记录不存在" });
      return;
    }
    res.json({ data: clip });
    await prisma.$disconnect();
  } catch (e) {
    next(e);
  }
});

// POST .../storyboards/:storyboardId/video/:videoId/select —— 候选版本审查：锁定某版本为采用（Plotloom asset-selection）
// body: { version: number }  → 该候选设为 selectedVersion；置空则回退到最新
router.post(
  "/projects/:projectId/episodes/:episodeId/storyboards/:storyboardId/video/:videoId/select",
  async (req, res, next) => {
    try {
      const { projectId, episodeId, storyboardId } = paramsSchema.parse(req.params);
      const { videoId } = videoIdSchema.parse(req.params);
      const body = z.object({ version: z.number().int().min(1).nullable() }).parse(req.body ?? {});
      const prisma = await getPrisma();

      const clip = await prisma.videoClip.findFirst({
        where: { id: videoId, storyboardId, projectId, episodeId },
      });
      if (!clip) {
        res.status(404).json({ message: "视频记录不存在" });
        return;
      }
      let candidates: any[] = [];
      try { candidates = Array.isArray(clip.candidates) ? clip.candidates : []; } catch { /* ignore */ }
      if (body.version != null) {
        const hit = candidates.find((c: any) => c.version === body.version);
        if (!hit) {
          res.status(400).json({ message: `候选版本 v${body.version} 不存在` });
          return;
        }
        await prisma.videoClip.update({
          where: { id: clip.id },
          data: { selectedVersion: body.version, filePath: hit.filePath, state: "SUCCEEDED" },
        });
      } else {
        await prisma.videoClip.update({ where: { id: clip.id }, data: { selectedVersion: null } });
      }
      const updated = await prisma.videoClip.findUnique({ where: { id: clip.id } });
      res.json({ data: updated });
      await prisma.$disconnect();
    } catch (e) {
      next(e);
    }
  },
);

// POST .../storyboards/:storyboardId/video/:videoId/reroll —— 同提示词重跑（revise 后重生成走主端点）
router.post(
  "/projects/:projectId/episodes/:episodeId/storyboards/:storyboardId/video/:videoId/reroll",
  async (req, res, next) => {
    try {
      const { projectId, episodeId, storyboardId } = paramsSchema.parse(req.params);
      const { videoId } = videoIdSchema.parse(req.params);
      const provider = getVideoProvider();
      if (!provider) {
        res.status(400).json({ message: "视频工作流未配置" });
        return;
      }
      const prisma = await getPrisma();
      const clip = await prisma.videoClip.findFirst({
        where: { id: videoId, storyboardId, projectId, episodeId },
      });
      if (!clip) {
        res.status(404).json({ message: "视频记录不存在" });
        return;
      }
      // 归档当前成功视频为候选，然后重跑
      const archive: any[] = [];
      try { archive.push(...(Array.isArray(clip.candidates) ? clip.candidates : [])); } catch { /* ignore */ }
      if (clip.state === "SUCCEEDED" && clip.filePath) {
        const ver = archive.length ? Math.max(...archive.map((c: any) => c.version ?? 0)) + 1 : 1;
        archive.push({ version: ver, filePath: clip.filePath, createdAt: new Date().toISOString(), prompt: "" });
      }
      await prisma.videoClip.update({
        where: { id: clip.id },
        data: { state: "RUNNING", errorReason: null, candidates: archive, selectedVersion: null },
      });
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      void runVideoGenerate(clip.id, storyboardId, provider, project?.videoRatio ?? "9:16");
      res.json({ data: { id: clip.id, state: "RUNNING" } });
      await prisma.$disconnect();
    } catch (e) {
      next(e);
    }
  },
);

// POST /api/projects/:projectId/episodes/:episodeId/storyboards/batch-generate-videos
// 批量生成视频：跳过无分镜图 / 无描述 / 生成中 / 已有成功视频
router.post("/projects/:projectId/episodes/:episodeId/storyboards/batch-generate-videos", async (req, res, next) => {
  try {
    const { projectId, episodeId } = epParamsSchema.parse(req.params);
    const provider = getVideoProvider();
    if (!provider) {
      res.status(400).json({ message: "视频工作流未配置" });
      return;
    }
    const prisma = await getPrisma();

    const candidates = await prisma.storyboard.findMany({
      where: { projectId, episodeId, filePath: { not: null } },
      orderBy: { index: "asc" },
    });
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    const videoRatio = project?.videoRatio ?? "9:16";
    const triggered: number[] = [];
    for (const sb of candidates) {
      if (!sb.videoDesc && !sb.prompt) continue;
      const existing = await prisma.videoClip.findFirst({ where: { storyboardId: sb.id } });
      if (existing?.state === "RUNNING" || existing?.state === "SUCCEEDED") continue;
      let clip = existing;
      if (!clip) {
        clip = await prisma.videoClip.create({
          data: {
            projectId, episodeId, storyboardId: sb.id,
            flowId: `video-${sb.id}-${Date.now()}`,
            state: "RUNNING",
          },
        });
      } else {
        clip = await prisma.videoClip.update({ where: { id: clip.id }, data: { state: "RUNNING", errorReason: null } });
      }
      void runVideoGenerate(clip.id, sb.id, provider, videoRatio);
      triggered.push(sb.id);
    }
    res.json({ data: { triggered } });
    await prisma.$disconnect();
  } catch (e) {
    next(e);
  }
});

async function runVideoGenerate(clipId: number, storyboardId: number, provider: ComfyUIVideoProvider, videoRatio = "9:16") {
  const prisma = await getPrisma();
  try {
    const clip = await prisma.videoClip.findUnique({ where: { id: clipId } });
    const sb = await prisma.storyboard.findUnique({ where: { id: storyboardId } });
    if (!sb) throw new Error("分镜不存在");
    // 收集本集参考资产图（角色/场景/道具已出图资产）→ Ref2VA 多图参考（r2v 不依赖分镜首帧）
    const refImages: string[] = [];
    try {
      const assets = await prisma.asset.findMany({
        where: { projectId: sb.projectId, episodeId: sb.episodeId, filePath: { not: null } },
        orderBy: { id: "asc" },
      });
      for (const a of assets) {
        if (a.filePath) refImages.push(a.filePath.replace(/^\/oss/, "")); // /oss/assets/... → /assets/...
      }
    } catch {
      // 参考图收集失败不阻断（退化为单图模式）
    }
    // 主图：优先分镜首帧图（r2v 工作流 ref_image_0；存在则用）；无首帧 → 用第一张角色/场景资产图作主参考，
    // 保证 r2v 多图参考模式完全不依赖首帧（用户要求：视频生成用多图参考工作流，不需要首帧）
    let mainRef = sb.filePath?.replace(/^\/oss/, "");
    if (!mainRef) {
      mainRef = refImages.find((p) => /character|scene|prop/.test(p)) ?? refImages[0];
    }
    const result = await provider.generate({
      imagePath: mainRef ?? "", // 可能为空（无首帧且无资产图时 r2v 纯文本/参考退化）
      prompt: sb.videoDesc || sb.prompt || "",
      refImages: refImages.length > 0 ? refImages : undefined,
      videoRatio,
      duration: sb.duration ?? undefined,
    });
    // updateMany：生成期间记录可能已被删除（竞态），记录不存在返回 0 不抛错，避免崩进程
    await prisma.videoClip.updateMany({
      where: { id: clipId },
      data: { state: "SUCCEEDED", filePath: result.filePath },
    });
    void memoryUpsert({
      text: `视频（分镜 #${sb.index}）：${sb.videoDesc || sb.prompt || ""}`,
      kind: "video",
      type: "video",
      filePath: result.filePath,
      projectId: sb.projectId,
      episodeId: sb.episodeId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    try {
      await prisma.videoClip.updateMany({ where: { id: clipId }, data: { state: "FAILED", errorReason: msg } });
    } catch {
      // ignore: 视频记录可能已被删除
    }
  } finally {
    await prisma.$disconnect();
  }
}

export default router;
