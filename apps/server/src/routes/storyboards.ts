import { Router } from "express";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { getImageProvider } from "../providers/image.js";
import { collectEpisodeAssets } from "../providers/comfyuiDirector.js";
import { memoryUpsert } from "./memory.js";

const router = Router();

async function getPrisma() {
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

const paramsSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  episodeId: z.coerce.number().int().positive(),
});

const sbIdSchema = z.object({ id: z.coerce.number().int().positive() });

const createSchema = z.object({
  flowId: z.string().min(1),
  index: z.number().int().min(0).optional(),
  sceneIndex: z.number().int().min(1).optional(),
  duration: z.number().int().min(1).max(15).optional(),
  prompt: z.string().default(""),
  videoDesc: z.string().optional(),
  assetIds: z.array(z.number()).optional(),
});

const updateSchema = z.object({
  index: z.number().int().min(0).optional(),
  sceneIndex: z.number().int().min(1).optional(),
  duration: z.number().int().min(1).max(15).optional(),
  prompt: z.string().optional(),
  videoDesc: z.string().optional(),
  assetIds: z.array(z.number()).optional(),
});

// GET 列表
router.get("/projects/:projectId/episodes/:episodeId/storyboards", async (req, res, next) => {
  try {
    const { projectId, episodeId } = paramsSchema.parse(req.params);
    const prisma = await getPrisma();
    const list = await prisma.storyboard.findMany({
      where: { projectId, episodeId },
      orderBy: { index: "asc" },
    });
    res.json({ data: list });
    await prisma.$disconnect();
  } catch (e) {
    next(e);
  }
});

// POST 创建
router.post("/projects/:projectId/episodes/:episodeId/storyboards", async (req, res, next) => {
  try {
    const { projectId, episodeId } = paramsSchema.parse(req.params);
    const body = createSchema.parse(req.body ?? {});
    const prisma = await getPrisma();

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      res.status(404).json({ message: "项目不存在" });
      return;
    }
    const max = await prisma.storyboard.aggregate({
      where: { projectId, episodeId },
      _max: { index: true },
    });
    const sb = await prisma.storyboard.create({
      data: {
        projectId,
        episodeId,
        flowId: body.flowId,
        index: body.index ?? (max._max.index ?? -1) + 1,
        sceneIndex: body.sceneIndex ?? 1,
        duration: body.duration ?? 5,
        prompt: body.prompt,
        videoDesc: body.videoDesc ?? "",
        assetIds: body.assetIds ?? [],
      },
    });
    res.status(201).json({ data: sb });
    await prisma.$disconnect();
  } catch (e) {
    next(e);
  }
});

// PUT 更新
router.put("/projects/:projectId/episodes/:episodeId/storyboards/:id", async (req, res, next) => {
  try {
    const { projectId, episodeId } = paramsSchema.parse(req.params);
    const { id } = sbIdSchema.parse(req.params);
    const body = updateSchema.parse(req.body ?? {});
    const prisma = await getPrisma();

    const sb = await prisma.storyboard.findFirst({ where: { id, projectId, episodeId } });
    if (!sb) {
      res.status(404).json({ message: "分镜不存在" });
      return;
    }
    const updated = await prisma.storyboard.update({ where: { id }, data: body });
    res.json({ data: updated });
    await prisma.$disconnect();
  } catch (e) {
    next(e);
  }
});

// DELETE（含画布节点由前端移除）
router.delete("/projects/:projectId/episodes/:episodeId/storyboards/:id", async (req, res, next) => {
  try {
    const { projectId, episodeId } = paramsSchema.parse(req.params);
    const { id } = sbIdSchema.parse(req.params);
    const prisma = await getPrisma();

    const sb = await prisma.storyboard.findFirst({ where: { id, projectId, episodeId } });
    if (!sb) {
      res.status(404).json({ message: "分镜不存在" });
      return;
    }
    await prisma.storyboard.delete({ where: { id } });
    res.json({ data: { id, deleted: true } });
    await prisma.$disconnect();
  } catch (e) {
    next(e);
  }
});

// ===== 辅助：构建单个分镜的视频工作流（注入首帧图 + 提示词；Ref2VA 模板另注入资产参考图）=====
async function buildStoryboardWorkflow(sb: any, projectId: number, prisma: any): Promise<any> {
  // 1. 模板路径：env 覆盖 → DB workflow_video（当前生效设置）→ 硬编码新工作流兜底
  let wfPath = process.env.WORKFLOW_VIDEO_REF2VA_PATH || "";
  if (!wfPath || !fs.existsSync(wfPath)) {
    try {
      const row = await prisma.setting.findUnique({ where: { key: "workflow_video" } });
      if (row?.value && fs.existsSync(row.value)) wfPath = row.value;
    } catch {
      /* DB 不可用则用默认 */
    }
  }
  if (!wfPath || !fs.existsSync(wfPath)) {
    wfPath =
      "H:\\ComfyUI\\ComfyUI-V18.1\\user\\default\\workflows\\28 MinimaxH3\\H3_文图生视频.json";
  }
  if (!fs.existsSync(wfPath)) throw new Error(`视频工作流模板不存在: ${wfPath}`);
  const wf = JSON.parse(fs.readFileSync(wfPath, "utf-8"));
  const episodeId = sb.episodeId;
  const project = await prisma.project.findUnique({ where: { id: projectId } });

  // 2. 参考资产图：与 Director（comfyuiDirector.collectEpisodeAssets）完全同源——
  //    type+name 去重取最新、按 id 稳定序；保证 Picture 编号/ref 槽顺序与实际提交一致
  const assets = await collectEpisodeAssets(projectId, episodeId, prisma);
  // 主图 = 分镜图（i2v 首帧用）；r2v 多参考模式无首帧 → 资产图从 ref_image_0 起
  const mainName = sb.filePath ? sb.filePath.replace(/^\/oss\//, "") : null;
  const mainFileName = mainName ? mainName.split("/").pop() : null;
  const refNode = wf.nodes.find((n: any) => n.type === "MiniMaxH3ReferenceToVideo");

  // —— Ref2VA 模板（r2v）：有分镜图 → ref_image_0 = 分镜图、1..N = 资产图；
  //    无分镜图（r2v 不依赖首帧）→ 资产图从 ref_image_0 起填主槽 ——
  if (refNode) {
    const refInputs = (refNode.inputs ?? []).filter((i: any) =>
      String(i.name ?? "").startsWith("ref_images.ref_image_"),
    );
    const slot0 = refInputs.find((i: any) => i.name === "ref_images.ref_image_0");
    let startSlot = 0;
    if (mainFileName && slot0?.link != null) {
      const l = wf.links.find((x: any) => x[0] === slot0.link);
      const src = wf.nodes.find((n: any) => n.id === l?.[1]);
      if (src) {
        src.widgets_values[0] = mainFileName;
        if (src.mode === 4) src.mode = 0;
        startSlot = 1; // 分镜图占 ref_image_0 → 资产从 ref_image_1 起
      }
    }
    // ref_image_0(startSlot)..N = 资产图
    for (let k = 0; k < assets.length; k++) {
      const slot = refInputs.find((i: any) => i.name === `ref_images.ref_image_${k + startSlot}`);
      if (!slot) break;
      const l = wf.links.find((x: any) => x[0] === slot.link);
      const src = wf.nodes.find((n: any) => n.id === l?.[1]);
      if (!src) continue;
      const fileName = (assets[k].filePath ?? "").replace(/^\/oss\//, "").split("/").pop();
      if (fileName) {
        src.widgets_values[0] = fileName;
        if (src.mode === 4) src.mode = 0;
      }
    }
    // 未使用参考槽 → bypass
    for (const slot of refInputs) {
      if (slot.link == null) continue;
      const l = wf.links.find((x: any) => x[0] === slot.link);
      const src = wf.nodes.find((n: any) => n.id === l?.[1]);
      const img = src?.widgets_values?.[0];
      const hasImg = typeof img === "string" && img && img !== "None";
      if (src?.type === "LoadImage" && !hasImg) src.mode = 4;
    }
  }
  // —— i2v 模板（新 H3_文图生视频.json）：first_frame 源 LoadImage = 分镜图 ——
  else {
    const i2v = wf.nodes.find((n: any) => n.type === "MiniMaxH3ImageToVideo");
    const ff = (i2v?.inputs ?? []).find((i: any) => i.name === "first_frame");
    let mainLoadId: number | null = null;
    if (ff?.link != null) {
      const l = wf.links.find((x: any) => x[0] === ff.link);
      let src = wf.nodes.find((n: any) => n.id === l?.[1]);
      // 沿 bypass 链向上找 LoadImage
      if (src && (src.mode === 4 || !src.type.startsWith("LoadImage"))) {
        const up = (src.inputs ?? []).find((i: any) => i.name === "image" && i.link != null);
        if (up) {
          const ul = wf.links.find((x: any) => x[0] === up.link);
          const us = wf.nodes.find((n: any) => n.id === ul?.[1]);
          if (us?.type === "LoadImage") src = us;
        }
      }
      if (src?.type === "LoadImage" && mainFileName) {
        src.widgets_values[0] = mainFileName;
        if (src.mode === 4) src.mode = 0;
        mainLoadId = src.id;
      }
    }
    // 其他无输出连接的游离 LoadImage（如模板废弃节点）→ bypass，避免干扰
    for (const n of wf.nodes) {
      if (n.type !== "LoadImage" || n.id === mainLoadId) continue;
      const outLink = n.outputs?.[0]?.links?.[0];
      if (outLink == null && n.widgets_values?.[0]) n.mode = 4;
    }
  }

  // 3. 提示词：videoDesc 已是 H3 结构（三字段/六段式）则用，否则 AI 生成
  let prompt = sb.videoDesc || sb.prompt || "";
  const isH3 =
    prompt.includes("subject_definitions") || prompt.includes("integrated_multimodal_description");
  if (!isH3) {
    try {
      const AI_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8001";
      const keyRow = await prisma.setting.findUnique({ where: { key: "deepseek_api_key" } });
      const apiKey = keyRow?.value ?? "";
      // 参考图清单（Picture 编号必须与 Director 实际提交完全一致！）：
      //  - Director r2v（comfyuiDirector.collectEpisodeAssets）无分镜首帧图，资产按 type+name 去重取最新，
      //    从 <Picture 1> 起编号（角色/场景/道具按 id 升序稳定序）
      //  - 此处必须复用同一函数与同一编号规则，否则 AI 提示词的 <Picture N> 引用与实际参考图错位
      const refAssets = await collectEpisodeAssets(projectId, episodeId, prisma);
      const assetPayload = refAssets.map((a: any, idx: number) => {
        const pic = idx + 1; // Picture 1..N（与 Director 上传编号一致）
        const desc = (a.prompt || "").slice(0, 400);
        const role = a.type === "character"
          ? `角色身份参考（CHARACTER reference，对应 <Picture ${pic}>）：必须保持该角色的面部、发型、服装与配色与参考图完全一致，跨镜头不改变（keep face, outfit and palette exactly consistent across all cuts）。角色特征：${desc}`
          : a.type === "scene"
            ? `场景参考（SCENE reference，对应 <Picture ${pic}>）：匹配该场景的环境布局、光线与色调风格，全片保持一致，不随镜头切换而跳变。场景描述：${desc}`
            : `道具参考（OBJECT reference，对应 <Picture ${pic}>）：保持道具的外观、材质、形状与细节与参考图完全一致。道具描述：${desc}`;
        return { name: a.name, type: a.type, description: role };
      });
      const upstream = await fetch(`${AI_URL}/ai/h3-video-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(apiKey ? { "x-api-key": apiKey } : {}) },
        body: JSON.stringify({
          video_desc: sb.videoDesc || sb.prompt || "",
          duration: sb.duration || 6,
          assets: assetPayload,
          multishot: false,
          director_skill: project?.directorSkill ?? "",
        }),
        signal: AbortSignal.timeout(180_000),
      });
      if (upstream.ok) {
        const j = await upstream.json();
        if (j.data?.zh_prompt) prompt = j.data.zh_prompt;
      }
    } catch {
      // AI 失败用原文
    }
  }
  // 4. 提示词注入：优先写 prompt widget 输入的源节点（PrimitiveStringMultiline / CR Prompt Text 等），
  //    否则写核心生成节点 widgets_values[0]（兼容 Ref2VA / i2v / t2v 模板）
  const promptNode = wf.nodes.find((n: any) =>
    (n.inputs ?? []).some((i: any) => i.name === "prompt" && i.widget),
  );
  if (promptNode) {
    const pi = (promptNode.inputs ?? []).find((i: any) => i.name === "prompt" && i.widget);
    if (pi?.link != null) {
      const l = wf.links.find((x: any) => x[0] === pi.link);
      const src = wf.nodes.find((n: any) => n.id === l?.[1]);
      if (src && Array.isArray(src.widgets_values) && src.widgets_values.length > 0) {
        src.widgets_values[0] = prompt; // 文本源节点第一个 widget
      } else if (src) {
        src.widgets_values = [prompt];
      } else if (Array.isArray(promptNode.widgets_values)) {
        const wIdx = (promptNode.inputs ?? [])
          .filter((i: any) => i.widget)
          .findIndex((i: any) => i.name === "prompt");
        if (wIdx >= 0) promptNode.widgets_values[wIdx] = prompt;
      }
    } else if (Array.isArray(promptNode.widgets_values)) {
      const wIdx = (promptNode.inputs ?? [])
        .filter((i: any) => i.widget)
        .findIndex((i: any) => i.name === "prompt");
      if (wIdx >= 0) promptNode.widgets_values[wIdx] = prompt;
    }
  } else {
    const core = wf.nodes.find((n: any) =>
      ["MiniMaxH3ReferenceToVideo", "MiniMaxH3ImageToVideo", "MiniMaxH3TextToVideo"].includes(n.type),
    );
    if (core) {
      if (!core.widgets_values) core.widgets_values = [];
      core.widgets_values[0] = prompt;
    }
  }
  return { wf, prompt };
}

// GET .../storyboards/:id/workflow —— 下载单个分镜工作流
// GET .../storyboards/:id/workflow —— 该分镜视频生成（r2v）工作流下载
router.get("/projects/:projectId/episodes/:episodeId/storyboards/:id/workflow", async (req, res, next) => {
  try {
    const { projectId, episodeId } = paramsSchema.parse(req.params);
    const { id } = sbIdSchema.parse(req.params);
    const prisma = await getPrisma();

    const sb = await prisma.storyboard.findFirst({ where: { id, projectId, episodeId } });
    if (!sb) {
      res.status(404).json({ message: "分镜不存在" });
      return;
    }
    const { wf } = await buildStoryboardWorkflow(sb, projectId, prisma);
    res.setHeader("Content-Disposition", `attachment; filename="storyboard-${sb.index}-r2v.json"`);
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(wf, null, 2));
    await prisma.$disconnect();
  } catch (e) {
    next(e);
  }
});

// GET .../storyboards/:id/workflow-firstframe —— 下载「分镜首帧」生成工作流（FLUX2-Klein 多参考，含角色/场景/道具参考图）
router.get(
  "/projects/:projectId/episodes/:episodeId/storyboards/:id/workflow-firstframe",
  async (req, res, next) => {
    try {
      const { projectId, episodeId } = paramsSchema.parse(req.params);
      const { id } = sbIdSchema.parse(req.params);
      const prisma = await getPrisma();

      const sb = await prisma.storyboard.findFirst({ where: { id, projectId, episodeId } });
      if (!sb) {
        res.status(404).json({ message: "分镜不存在" });
        await prisma.$disconnect();
        return;
      }
      // 分镜工作流（当前 = FLUX2-Klein 多参考）
      const st = await prisma.setting.findUnique({ where: { key: "workflow_storyboard" } });
      const wfPath = st?.value || "";
      if (!wfPath || !fs.existsSync(wfPath)) {
        res.status(400).json({ message: "分镜工作流未配置" });
        await prisma.$disconnect();
        return;
      }
      const wf = JSON.parse(fs.readFileSync(wfPath, "utf-8"));

      // 参考资产图：① 按名匹配 跨全集（与生成时一致），确保同一角色/场景跨镜锁定同一张图
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      const { refImages, assetIds } = await resolveStoryboardAssets(sb, projectId, prisma);
      // ② 回写 assetIds（与生成时一致）
      if (assetIds.length) {
        try {
          await prisma.storyboard.update({ where: { id }, data: { assetIds } });
        } catch {
          // 绑定失败不阻断
        }
      }
      const byType: Record<string, string> = {};
      for (const [t, fp] of Object.entries(refImages)) {
        if (fp) byType[t] = fp.replace(/^\/oss\//, "").split("/").pop()!;
      }

      // 注入参考图 LoadImage（10角色 / 13场景 / 16道具）；无该类型则禁用
      const slots: Record<string, number> = { character: 10, scene: 13, prop: 16 };
      for (const [t, nid] of Object.entries(slots)) {
        const node = wf.nodes.find((n: any) => n.id === nid);
        if (!node) continue;
        const fn = byType[t];
        if (fn) { node.widgets_values[0] = fn; if (node.mode === 4) node.mode = 0; }
        else node.mode = 4;
      }

      // 提示词 = 分镜 prompt + 年代美术风格/一致性（技能驱动） + 角色参考设定（与生成时一致）
      let prompt = sb.prompt || "";
      const era = project?.era?.trim() ? project.era.trim() : "古代（古风）";
      prompt = `${prompt}\n\n${buildFirstFrameEraBlock(era)}`;
      const chars = await prisma.episodeAsset.findMany({ where: { projectId, type: "character" }, orderBy: { id: "asc" } });
      const inShot = chars.filter((c: any) => c.name && (c.description || "").trim() && promptMentions(prompt, c.name));
      if (inShot.length) {
        const refBlock = inShot
          .map((c) => `【${c.name}】${charDesignIdentity(c.description).replace(/\s*\n\s*/g, " ")}`)
          .join("\n");
        prompt = `${prompt}\n\n【角色参考设定（身份/服装按此设计与已出角色资产一致；武器/道具不由此决定，以分镜描述为准）】\n${refBlock}`;
      }
      const posNode = wf.nodes.find((n: any) => n.type === "CLIPTextEncode");
      if (posNode) posNode.widgets_values[0] = prompt;

      // 尺寸按项目比例
      const ratio = project?.videoRatio ?? "9:16";
      const size = ratio === "9:16" ? [720, 1280] : ratio === "1:1" ? [720, 720] : [1280, 720];
      const lat = wf.nodes.find((n: any) => n.type === "EmptyLatentImage");
      if (lat) { lat.widgets_values[0] = size[0]; lat.widgets_values[1] = size[1]; }

      res.setHeader("Content-Disposition", `attachment; filename="storyboard-${sb.index}-firstframe-klein.json"`);
      res.setHeader("Content-Type", "application/json");
      res.send(JSON.stringify(wf, null, 2));
      await prisma.$disconnect();
    } catch (e) {
      next(e);
    }
  },
);

// GET .../storyboards/:id/workflow-prompt —— 该分镜工作流将注入的提示词（H3 结构，详情页展示用）
router.get(
  "/projects/:projectId/episodes/:episodeId/storyboards/:id/workflow-prompt",
  async (req, res, next) => {
    try {
      const { projectId, episodeId } = paramsSchema.parse(req.params);
      const { id } = sbIdSchema.parse(req.params);
      const prisma = await getPrisma();

      const sb = await prisma.storyboard.findFirst({ where: { id, projectId, episodeId } });
      if (!sb) {
        res.status(404).json({ message: "分镜不存在" });
        return;
      }
      const { prompt } = await buildStoryboardWorkflow(sb, projectId, prisma);
      res.json({ data: { prompt } });
      await prisma.$disconnect();
    } catch (e) {
      next(e);
    }
  },
);

// POST .../storyboards/workflows —— 为本集全部分镜批量生成工作流文件到磁盘
// 返回每个分镜生成的文件路径（供前端提示/批量下载）
router.post("/projects/:projectId/episodes/:episodeId/storyboards/workflows", async (req, res, next) => {
  try {
    const { projectId, episodeId } = paramsSchema.parse(req.params);
    const prisma = await getPrisma();

    const sbs = await prisma.storyboard.findMany({
      where: { projectId, episodeId },
      orderBy: { index: "asc" },
    });
    if (!sbs.length) {
      res.status(400).json({ message: "本集暂无分镜" });
      return;
    }
    // 输出目录：server 下 workflows-generated/{projectId}/{episodeId}/
    const outRoot = path.resolve(process.cwd(), "workflows-generated", String(projectId), String(episodeId));
    fs.mkdirSync(outRoot, { recursive: true });

    const generated: { id: number; index: number; file: string }[] = [];
    // 逐个构建（AI 提示词较慢，但保证每个工作流开箱即用）
    for (const sb of sbs) {
      try {
        const { wf } = await buildStoryboardWorkflow(sb, projectId, prisma);
        const file = path.join(outRoot, `storyboard-${sb.index}-r2v.json`);
        fs.writeFileSync(file, JSON.stringify(wf, null, 2), "utf-8");
        generated.push({ id: sb.id, index: sb.index, file });
      } catch (e: any) {
        generated.push({ id: sb.id, index: sb.index, file: "", error: e?.message ?? String(e) });
      }
    }
    res.json({ data: { count: generated.length, root: outRoot, items: generated } });
    await prisma.$disconnect();
  } catch (e) {
    next(e);
  }
});

// POST 生成分镜图
router.post("/projects/:projectId/episodes/:episodeId/storyboards/:id/generate", async (req, res, next) => {
  try {
    const { projectId, episodeId } = paramsSchema.parse(req.params);
    const { id } = sbIdSchema.parse(req.params);
    const prisma = await getPrisma();

    const sb = await prisma.storyboard.findFirst({ where: { id, projectId, episodeId } });
    if (!sb) {
      res.status(404).json({ message: "分镜不存在" });
      return;
    }
    if (sb.state === "RUNNING") {
      res.status(409).json({ message: "该分镜正在生成中" });
      return;
    }
    await prisma.storyboard.update({ where: { id }, data: { state: "RUNNING", errorReason: null } });
    void runGenerate(id);
    res.json({ data: { id, state: "RUNNING" } });
  } catch (e) {
    next(e);
  }
});

// GET 单条（轮询）
router.get("/projects/:projectId/episodes/:episodeId/storyboards/:id", async (req, res, next) => {
  try {
    const { projectId, episodeId } = paramsSchema.parse(req.params);
    const { id } = sbIdSchema.parse(req.params);
    const prisma = await getPrisma();
    const sb = await prisma.storyboard.findFirst({ where: { id, projectId, episodeId } });
    if (!sb) {
      res.status(404).json({ message: "分镜不存在" });
      return;
    }
    res.json({ data: sb });
    await prisma.$disconnect();
  } catch (e) {
    next(e);
  }
});

// POST 批量生成分镜图（跳过已完成/生成中）
router.post("/projects/:projectId/episodes/:episodeId/storyboards/batch-generate-images", async (req, res, next) => {
  try {
    const { projectId, episodeId } = paramsSchema.parse(req.params);
    const prisma = await getPrisma();

    const pending = await prisma.storyboard.findMany({
      where: { projectId, episodeId, state: { notIn: ["RUNNING", "SUCCEEDED"] } },
      orderBy: { index: "asc" },
    });
    const triggered: number[] = [];
    for (const sb of pending) {
      await prisma.storyboard.update({ where: { id: sb.id }, data: { state: "RUNNING", errorReason: null } });
      void runGenerate(sb.id);
      triggered.push(sb.id);
    }
    res.json({ data: { triggered, skipped: pending.length - triggered.length } });
    await prisma.$disconnect();
  } catch (e) {
    next(e);
  }
});

// 判断分镜描述是否提及该角色：精确包含，或名称字符与描述重叠 ≥66%（捕捉别名/改写，如 黑色人↔黑衣人、干瘪脸的少年↔干瘪少年）
function promptMentions(prompt: string, name: string): boolean {
  if (prompt.includes(name)) return true;
  if (name.length < 2) return false;
  const nameChars = [...new Set(Array.from(name))];
  let hit = 0;
  for (const ch of nameChars) if (prompt.includes(ch)) hit++;
  return hit / nameChars.length >= 0.66;
}

// 匹配强度：名称在 prompt 中越「完整出现」权重越高（完整包含 > 字符重叠）
function matchScore(prompt: string, name: string): number {
  if (!name) return 0;
  if (prompt.includes(name)) return name.length + 1000;
  const nameChars = [...new Set(Array.from(name))];
  let hit = 0;
  for (const ch of nameChars) if (prompt.includes(ch)) hit++;
  return hit;
}

/**
 * 从角色设计描述（要素|设定 表格）提取「画面可呈现」的特征词集合。
 * 只取 发型/上衣/下衣/脚/配饰/背/面容/气质 各行的「设定」列，切成 2-4 字词元并滤掉常见空泛词，
 * 供 prompt 特征匹配用（识别用外貌描述而非名字的角色，如「肿着眼眶的年轻人」→眉间尺）。
 */
function charFeatureTerms(desc: string): string[] {
  const stop = new Set(["无", "空白", "浅米色底", "背景", "干净", "无文字", "无水印", "不携带", "多余", "道具"]);
  const terms = new Set<string>();
  for (const ln of String(desc).split("\n")) {
    const cells = ln.trim().split("|").map((s) => s.trim());
    if (cells.length < 3) continue;
    const row = cells[1] ?? "";
    if (!["发型", "上衣", "下衣", "脚", "配饰", "背", "面容", "气质"].includes(row)) continue;
    const val = (cells[2] ?? "").replace(/^要素|^设定/, "").trim();
    if (!val) continue;
    // 切成 2-4 字词元（去标点/空格）
    const clean = val.replace(/[，。、；：（）【】|·—\-/\\\s"']/g, "");
    for (let len = 4; len >= 2; len--) {
      for (let i = 0; i + len <= clean.length; i++) {
        const t = clean.slice(i, i + len);
        if (stop.has(t) || /[0-9]/.test(t)) continue;
        terms.add(t);
      }
    }
  }
  return [...terms];
}

/** 特征匹配强度：prompt 中出现的特征词个数（外貌描述命中越多越强） */
function featureScore(prompt: string, terms: string[]): number {
  if (!terms.length) return 0;
  let hit = 0;
  for (const t of terms) if (prompt.includes(t)) hit++;
  return hit;
}

/**
 * 解析一个分镜应引用的参考资产（① 按名+特征匹配 + ② 填充 assetIds）：
 * - 优先用分镜已绑定的 assetIds；
 * - 未绑定时，跨【全集】已出图资产（character/scene/prop）匹配分镜 prompt：
 *   角色用「名字 + 角色设计描述特征」双重匹配（覆盖用外貌描述代替名字的情况，避免误绑/漏绑）；
 *   场景/道具按名匹配。确保同一角色/场景跨镜锁定同一张图。
 * 返回 { refImages: {character?,scene?,prop?} 每类型取匹配最强一张（Klein 3 槽）, assetIds: 本镜所有匹配资产 }。
 */
async function resolveStoryboardAssets(
  sb: any,
  projectId: number,
  prisma: any,
): Promise<{ refImages: Record<string, string>; assetIds: number[] }> {
  const refImages: Record<string, string> = {};
  const assetIds: number[] = [];
  const prompt = sb.prompt ?? "";
  try {
    const boundIds = Array.isArray(sb.assetIds) ? sb.assetIds.map(Number).filter((x) => Number.isFinite(x)) : [];
    if (boundIds.length) {
      const bound = await prisma.asset.findMany({ where: { id: { in: boundIds } }, orderBy: { id: "asc" } });
      for (const a of bound) {
        assetIds.push(a.id);
        if (a.filePath && !refImages[a.type]) refImages[a.type] = a.filePath;
      }
    } else {
      const pool = await prisma.asset.findMany({
        where: { projectId, filePath: { not: null }, type: { in: ["character", "scene", "prop"] } },
        orderBy: { id: "asc" },
      });
      // 角色设计描述（供特征匹配；名字常被外貌描述替代）
      let charDesc: Record<string, string> = {};
      try {
        const cds = await prisma.episodeAsset.findMany({
          where: { projectId, type: "character" },
          select: { name: true, description: true },
        });
        for (const c of cds) if (c.name) charDesc[c.name] = c.description ?? "";
      } catch {
        charDesc = {};
      }
      // 每个资产打分：角色 = 名字匹配 + 特征匹配；场景/道具 = 名字匹配
      const scored = pool
        .map((a: any) => {
          const nameHit = a.name ? prompt.includes(a.name) : false; // 名字完整出现
          const nameScore = matchScore(prompt, a.name);
          let matched = nameHit;
          if (a.type === "character") {
            const terms = charFeatureTerms(charDesc[a.name] ?? "");
            const fs = featureScore(prompt, terms);
            matched = nameHit || fs >= 1; // 名字完整出现 或 命中 ≥1 特征（外貌描述替代名字）
            return { a, score: nameScore + fs * 3, matched, fs };
          }
          // 场景/道具：仅名字完整出现 或 字符重叠足够强才算（避免误绑）
          return { a, score: nameScore, matched: nameHit || promptMentions(prompt, a.name) };
        })
        .filter((x) => x.matched);
      // 防误绑：若无任何匹配，宁可纯文生图也不硬塞错误角色
      const matched = scored.map((x) => x.a);
      for (const x of scored) if (!assetIds.includes(x.a.id)) assetIds.push(x.a.id);
      // 每类型取匹配最强一张（Klein 每类型单槽）
      const byType: Record<string, any[]> = {};
      for (const x of scored) (byType[x.a.type] ??= []).push(x);
      for (const [t, list] of Object.entries(byType)) {
        list.sort((a, b) => b.score - a.score);
        const best = list[0];
        if (best?.a.filePath) refImages[t] = best.a.filePath;
      }
    }
  } catch {
    // 匹配失败不阻塞首帧生成
  }
  return { refImages, assetIds };
}

// 角色设计描述（要素|设定 表格）→ 仅保留身份要素行（年龄/体型/发型/上衣/下衣/脚/面容/气质），
// 剔除 配饰/背/双手/背景（可能引入武器/道具，由分镜描述控制，避免首帧被强制带武器）
function charDesignIdentity(desc: string): string {
  const keep = new Set(["年龄", "体型", "发型", "上衣", "下衣", "脚", "面容", "气质"]);
  const out: string[] = [];
  for (const ln of String(desc).split("\n")) {
    const cell = (ln.trim().replace(/^\|?\s*/, "").split("|")[0] ?? "").trim();
    if (cell === "要素" || /^[-: ]+$/.test(cell) || keep.has(cell)) out.push(ln);
  }
  return out.join("\n");
}

// 分镜首帧图的时代背景约束（内置，不再依赖 firstframe_generation 技能——
// 视频生成已改为 r2v 多图参考模式，不依赖首帧图）
function buildFirstFrameEraBlock(era: string): string {
  const modernProhibit = /现代|当代|都市|21世纪|近未来|未来/i.test(era)
    ? "禁止出现其他时代/未来科幻/异时代元素"
    : "严禁任何现代元素（现代建筑、现代服饰、汽车、玻璃幕墙、电线、塑料制品、现代人物发型妆容等）";
  return `【时代背景】画面为${era}时期，所有建筑/服饰/器物/场景严格遵循该历史时代（古代建筑：土筑/夯土城墙、木构梁柱、茅草或灰瓦屋顶、石板路；人物着古代服饰：粗布/麻衣/深衣/布履）。${modernProhibit}。`;
}

async function runGenerate(id: number) {
  const prisma = await getPrisma();
  try {
    const sb = await prisma.storyboard.findUnique({ where: { id } });
    if (!sb) return; // 分镜已被删除（如重新拆解），静默退出
    // 项目比例 → 分镜图尺寸（与视频比例一致，避免视频裁切构图）
    const project = await prisma.project.findUnique({ where: { id: sb.projectId } });
    // 本镜参考图：① 按名匹配 跨全集（不再取本集第一张），确保同一角色/场景跨镜锁定同一张图
    const { refImages, assetIds } = await resolveStoryboardAssets(sb, sb.projectId, prisma);
    // ② 回写 assetIds：让本镜生成后持久化绑定，后续生成/工作流直接走绑定，保证一致性
    if (assetIds.length) {
      try {
        await prisma.storyboard.update({ where: { id }, data: { assetIds } });
      } catch {
        // 绑定失败不阻断
      }
    }
    // 分镜首帧提示词：先注入「时代背景」约束（避免生成现代建筑/现代服饰的年代错乱），
    // 再注入本分镜出现的角色「设计描述（身份要素）」
    let prompt = sb.prompt ?? "";
    try {
      const era = project?.era?.trim() ? project.era.trim() : "古代（古风）";
      prompt = `${sb.prompt ?? ""}\n\n${buildFirstFrameEraBlock(era)}`;
    } catch {
      // 时代约束注入失败不阻断
    }
    try {
      const chars = await prisma.episodeAsset.findMany({
        where: { projectId: sb.projectId, type: "character" },
        orderBy: { id: "asc" },
      });
      const inShot = chars.filter((c) => c.name && (c.description || "").trim() && promptMentions(prompt, c.name));
      if (inShot.length) {
        const refBlock = inShot
          .map((c) => `【${c.name}】${charDesignIdentity(c.description).replace(/\s*\n\s*/g, " ")}`)
          .join("\n");
        prompt = `${prompt}\n\n【角色参考设定（身份/服装按此设计与已出角色资产一致；武器/道具不由此决定，以分镜描述为准）】\n${refBlock}`;
      }
    } catch {
      // 角色参考注入失败不阻断
    }
    const result = await getImageProvider().generate({
      type: "storyboard",
      name: `sb-${sb.index}`,
      prompt,
      ratio: project?.videoRatio ?? "9:16",
      refImages,
    });
    // updateMany：生成期间分镜可能已被删除（重拆/删除竞态），记录不存在返回 0 不抛错
    await prisma.storyboard.updateMany({
      where: { id },
      data: { state: "SUCCEEDED", filePath: result.filePath },
    });
    void memoryUpsert({
      text: `分镜 #${sb.index}：${sb.prompt ?? ""}`,
      kind: "storyboard",
      type: "storyboard",
      filePath: result.filePath,
      projectId: sb.projectId,
      episodeId: sb.episodeId,
    });
  } catch (e) {
    // 分镜可能已被删除（P2025 记录不存在），此时不能再 update，静默退出避免进程崩溃
    const msg = e instanceof Error ? e.message : String(e);
    try {
      await prisma.storyboard.update({ where: { id }, data: { state: "FAILED", errorReason: msg } });
    } catch {
      // ignore: 记录已不存在
    }
  } finally {
    await prisma.$disconnect();
  }
}

export default router;
