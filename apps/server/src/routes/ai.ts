import { Router } from "express";
import { z } from "zod";

const router = Router();

const AI_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8001";

const splitSchema = z.object({
  script: z.string().min(1),
  projectId: z.number().int().positive().optional(),
  sceneDirectors: z.record(z.string(), z.string()).optional().default({}), // 按场导演覆盖 {sceneIndex: "Director_XXX"}
});

const novelSchema = z.object({
  novel: z.string().min(1),
  projectId: z.number().int().positive(),
  episodeCount: z.number().int().min(0).max(10).default(0), // 0=按全剧时长自动分析
  totalDurationMin: z.number().int().min(0).max(300).default(0), // 全剧总时长（分钟）
});

/** 从 DB 读项目手册 + DeepSeek key */
async function getProjectContext(projectId: number) {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  let visualSkill = "";
  let directorSkill = "";
  let videoRatio = "9:16";
  if (projectId) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (project) {
      visualSkill = project.visualSkill ?? "";
      directorSkill = project.directorSkill ?? "";
      videoRatio = project.videoRatio ?? "9:16";
    }
  }
  const keyRow = await prisma.setting.findUnique({ where: { key: "deepseek_api_key" } });
  await prisma.$disconnect();
  return { visualSkill, directorSkill, videoRatio, apiKey: keyRow?.value ?? "" };
}

// POST /api/ai/storyboard-split —— 剧本 → 分镜卡列表（转发到 Python AI 服务）
router.post("/ai/storyboard-split", async (req, res, next) => {
  try {
    const { script, projectId, sceneDirectors } = splitSchema.parse(req.body ?? {});
    const ctx = await getProjectContext(projectId ?? 0);

    const upstream = await fetch(`${AI_URL}/ai/storyboard-split`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ctx.apiKey ? { "x-api-key": ctx.apiKey } : {}),
      },
      body: JSON.stringify({ script, visual_skill: ctx.visualSkill, director_skill: ctx.directorSkill, video_ratio: ctx.videoRatio, scene_directors: sceneDirectors }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!upstream.ok) {
      const text = await upstream.text();
      res.status(upstream.status).json({ message: text.slice(0, 300) });
      return;
    }
    const json = await upstream.json();
    res.json(json);
  } catch (e: any) {
    if (e?.name === "TimeoutError" || e?.name === "AbortError") {
      res.status(504).json({ message: "AI 服务响应超时" });
      return;
    }
    res.status(502).json({ message: `AI 服务不可用（${AI_URL}）: ${e?.message ?? e}` });
  }
});

// POST /api/ai/novel-to-script —— 小说 → 多集剧本（转发 AI 服务）
router.post("/ai/novel-to-script", async (req, res, next) => {
  try {
    const { novel, projectId, episodeCount, totalDurationMin } = novelSchema.parse(req.body ?? {});
    const ctx = await getProjectContext(projectId);

    const upstream = await fetch(`${AI_URL}/ai/novel-to-script`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ctx.apiKey ? { "x-api-key": ctx.apiKey } : {}),
      },
      body: JSON.stringify({
        novel,
        episode_count: episodeCount,
        total_duration_min: totalDurationMin,
        visual_skill: ctx.visualSkill,
        director_skill: ctx.directorSkill,
        video_ratio: ctx.videoRatio,
      }),
      signal: AbortSignal.timeout(300_000),
    });
    if (!upstream.ok) {
      const text = await upstream.text();
      res.status(upstream.status).json({ message: text.slice(0, 300) });
      return;
    }
    const json = await upstream.json();
    res.json(json);
  } catch (e: any) {
    if (e?.name === "TimeoutError" || e?.name === "AbortError") {
      res.status(504).json({ message: "AI 服务响应超时" });
      return;
    }
    res.status(502).json({ message: `AI 服务不可用（${AI_URL}）: ${e?.message ?? e}` });
  }
});

// POST /api/ai/generate-director-handbook —— 新增导演手册（联网检索生成，转发 AI 服务）
router.post("/ai/generate-director-handbook", async (req, res, next) => {
  try {
    const body = z
      .object({
        director_name: z.string().min(1),
        extra_hint: z.string().optional().default(""),
      })
      .parse(req.body ?? {});
    // 业务校验：导演名不能为空/纯空格（返回明确失败提示，而非 zod 原始错误）
    const directorName = body.director_name.trim();
    if (!directorName) {
      res.status(400).json({ message: "请先输入导演名称" });
      return;
    }
    const keyRow = await (async () => {
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();
      const row = await prisma.setting.findUnique({ where: { key: "deepseek_api_key" } });
      await prisma.$disconnect();
      return row;
    })();

    const upstream = await fetch(`${AI_URL}/ai/generate-director-handbook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(keyRow?.value ? { "x-api-key": keyRow.value } : {}),
      },
      body: JSON.stringify({ director_name: directorName, extra_hint: body.extra_hint }),
      signal: AbortSignal.timeout(600_000), // 完整手册生成较慢：10 分钟
    });
    if (!upstream.ok) {
      const text = await upstream.text();
      res.status(upstream.status).json({ message: text.slice(0, 300) });
      return;
    }
    const json = await upstream.json();
    res.json(json);
  } catch (e: any) {
    // zod 校验失败：返回友好提示（而不是误报为 AI 服务不可用）
    if (e instanceof z.ZodError) {
      res.status(400).json({ message: "请先输入导演名称" });
      return;
    }
    if (e?.name === "TimeoutError" || e?.name === "AbortError") {
      res.status(504).json({ message: "AI 服务响应超时" });
      return;
    }
    res.status(502).json({ message: `AI 服务不可用（${AI_URL}）: ${e?.message ?? e}` });
  }
});

// POST /api/ai/script-edit —— 按用户要求修改剧本（转发 AI 服务）
router.post("/ai/script-edit", async (req, res, next) => {
  try {
    const body = z
      .object({
        script: z.string().min(1),
        instruction: z.string().min(1),
        projectId: z.number().int().positive().optional(),
      })
      .parse(req.body ?? {});
    const ctx = await getProjectContext(body.projectId ?? 0);

    const upstream = await fetch(`${AI_URL}/ai/script-edit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ctx.apiKey ? { "x-api-key": ctx.apiKey } : {}),
      },
      body: JSON.stringify({
        script: body.script,
        instruction: body.instruction,
        visual_skill: ctx.visualSkill,
        director_skill: ctx.directorSkill,
        video_ratio: ctx.videoRatio,
      }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!upstream.ok) {
      const text = await upstream.text();
      res.status(upstream.status).json({ message: text.slice(0, 300) });
      return;
    }
    const json = await upstream.json();
    res.json(json);
  } catch (e: any) {
    if (e?.name === "TimeoutError" || e?.name === "AbortError") {
      res.status(504).json({ message: "AI 服务响应超时" });
      return;
    }
    res.status(502).json({ message: `AI 服务不可用（${AI_URL}）: ${e?.message ?? e}` });
  }
});

// POST /api/ai/prompt-edit —— 按用户要求优化/改写 首帧图提示词 或 视频生成提示词（转发 AI 服务）
router.post("/ai/prompt-edit", async (req, res, next) => {
  try {
    const body = z
      .object({
        prompt: z.string().min(1),
        instruction: z.string().min(1),
        kind: z.enum(["firstframe", "video"]).default("firstframe"),
        projectId: z.number().int().positive().optional(),
      })
      .parse(req.body ?? {});
    const ctx = await getProjectContext(body.projectId ?? 0);

    const upstream = await fetch(`${AI_URL}/ai/prompt-edit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ctx.apiKey ? { "x-api-key": ctx.apiKey } : {}),
      },
      body: JSON.stringify({
        prompt: body.prompt,
        instruction: body.instruction,
        kind: body.kind,
        visual_skill: ctx.visualSkill,
        director_skill: ctx.directorSkill,
        video_ratio: ctx.videoRatio,
      }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!upstream.ok) {
      const text = await upstream.text();
      res.status(upstream.status).json({ message: text.slice(0, 300) });
      return;
    }
    const json = await upstream.json();
    res.json(json);
  } catch (e: any) {
    if (e?.name === "TimeoutError" || e?.name === "AbortError") {
      res.status(504).json({ message: "AI 服务响应超时" });
      return;
    }
    res.status(502).json({ message: `AI 服务不可用（${AI_URL}）: ${e?.message ?? e}` });
  }
});

// POST /api/ai/asset-prompt —— AI 按 资产名+设计描述+项目视觉手册 生成三段式生图提示词（转发 AI 服务）
router.post("/ai/asset-prompt", async (req, res, next) => {
  try {
    const body = z
      .object({
        name: z.string().min(1),
        description: z.string().optional().default(""),
        kind: z.enum(["character", "scene", "prop"]).default("character"),
        projectId: z.number().int().positive().optional(),
      })
      .parse(req.body ?? {});
    const ctx = await getProjectContext(body.projectId ?? 0);

    const upstream = await fetch(`${AI_URL}/ai/asset-prompt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ctx.apiKey ? { "x-api-key": ctx.apiKey } : {}),
      },
      body: JSON.stringify({
        name: body.name,
        description: body.description,
        kind: body.kind,
        visual_skill: ctx.visualSkill,
        director_skill: ctx.directorSkill,
        video_ratio: ctx.videoRatio,
      }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!upstream.ok) {
      const text = await upstream.text();
      res.status(upstream.status).json({ message: text.slice(0, 300) });
      return;
    }
    const json = await upstream.json();
    res.json(json);
  } catch (e: any) {
    if (e?.name === "TimeoutError" || e?.name === "AbortError") {
      res.status(504).json({ message: "AI 服务响应超时" });
      return;
    }
    res.status(502).json({ message: `AI 服务不可用（${AI_URL}）: ${e?.message ?? e}` });
  }
});

// POST /api/ai/script-characters —— 单集剧本 → 本集出场人物（转发 AI 服务）
router.post("/ai/script-characters", async (req, res, next) => {
  try {
    const { script, projectId } = splitSchema.parse(req.body ?? {});
    const ctx = await getProjectContext(projectId ?? 0);

    const upstream = await fetch(`${AI_URL}/ai/script-characters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ctx.apiKey ? { "x-api-key": ctx.apiKey } : {}),
      },
      body: JSON.stringify({
        script,
        visual_skill: ctx.visualSkill,
        director_skill: ctx.directorSkill,
        video_ratio: ctx.videoRatio,
      }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!upstream.ok) {
      const text = await upstream.text();
      res.status(upstream.status).json({ message: text.slice(0, 300) });
      return;
    }
    const json = await upstream.json();
    res.json(json);
  } catch (e: any) {
    if (e?.name === "TimeoutError" || e?.name === "AbortError") {
      res.status(504).json({ message: "AI 服务响应超时" });
      return;
    }
    res.status(502).json({ message: `AI 服务不可用（${AI_URL}）: ${e?.message ?? e}` });
  }
});

// POST /api/ai/script-characters-all —— 全部集剧本 → 汇总出场人物（转发 AI 服务）
router.post("/ai/script-characters-all", async (req, res, next) => {
  try {
    const body = z
      .object({
        episodes: z
          .array(z.object({ index: z.number().int().positive(), script: z.string().min(1) }))
          .min(1),
        projectId: z.number().int().positive().optional(),
      })
      .parse(req.body ?? {});
    const ctx = await getProjectContext(body.projectId ?? 0);

    const upstream = await fetch(`${AI_URL}/ai/script-characters-all`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ctx.apiKey ? { "x-api-key": ctx.apiKey } : {}),
      },
      body: JSON.stringify({
        episodes: body.episodes,
        visual_skill: ctx.visualSkill,
        director_skill: ctx.directorSkill,
        video_ratio: ctx.videoRatio,
      }),
      signal: AbortSignal.timeout(300_000),
    });
    if (!upstream.ok) {
      const text = await upstream.text();
      res.status(upstream.status).json({ message: text.slice(0, 300) });
      return;
    }
    const json = await upstream.json();
    res.json(json);
  } catch (e: any) {
    if (e?.name === "TimeoutError" || e?.name === "AbortError") {
      res.status(504).json({ message: "AI 服务响应超时" });
      return;
    }
    res.status(502).json({ message: `AI 服务不可用（${AI_URL}）: ${e?.message ?? e}` });
  }
});

// POST /api/ai/script-assets-all —— 全部集剧本 → 场景/道具/素材清单（转发 AI 服务）
router.post("/ai/script-assets-all", async (req, res, next) => {
  try {
    const body = z
      .object({
        episodes: z
          .array(z.object({ index: z.number().int().positive(), script: z.string().min(1) }))
          .min(1),
        projectId: z.number().int().positive().optional(),
      })
      .parse(req.body ?? {});
    const ctx = await getProjectContext(body.projectId ?? 0);

    const upstream = await fetch(`${AI_URL}/ai/script-assets-all`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ctx.apiKey ? { "x-api-key": ctx.apiKey } : {}),
      },
      body: JSON.stringify({
        episodes: body.episodes,
        visual_skill: ctx.visualSkill,
        director_skill: ctx.directorSkill,
        video_ratio: ctx.videoRatio,
      }),
      signal: AbortSignal.timeout(300_000),
    });
    if (!upstream.ok) {
      const text = await upstream.text();
      res.status(upstream.status).json({ message: text.slice(0, 300) });
      return;
    }
    const json = await upstream.json();
    res.json(json);
  } catch (e: any) {
    if (e?.name === "TimeoutError" || e?.name === "AbortError") {
      res.status(504).json({ message: "AI 服务响应超时" });
      return;
    }
    res.status(502).json({ message: `AI 服务不可用（${AI_URL}）: ${e?.message ?? e}` });
  }
});

// POST /api/ai/film-reference-prompt —— 电影名称/创作要求 → 视觉 DNA + 提示词（转发 AI 服务）
router.post("/ai/film-reference-prompt", async (req, res, next) => {
  try {
    const body = z
      .object({
        filmName: z.string().default(""),
        request: z.string().default(""),
        mode: z.enum(["quick", "full"]).default("quick"),
        target: z.enum(["video", "image"]).default("video"),
        duration: z.number().int().min(1).max(15).default(6),
        projectId: z.number().int().positive().optional(),
      })
      .parse(req.body ?? {});
    const ctx = await getProjectContext(body.projectId ?? 0);

    const upstream = await fetch(`${AI_URL}/ai/film-reference-prompt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ctx.apiKey ? { "x-api-key": ctx.apiKey } : {}),
      },
      body: JSON.stringify({
        film_name: body.filmName,
        request: body.request,
        mode: body.mode,
        target: body.target,
        duration: body.duration,
        video_ratio: ctx.videoRatio,
        visual_skill: ctx.visualSkill,
        director_skill: ctx.directorSkill,
      }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!upstream.ok) {
      const text = await upstream.text();
      res.status(upstream.status).json({ message: text.slice(0, 300) });
      return;
    }
    const json = await upstream.json();
    res.json(json);
  } catch (e: any) {
    if (e?.name === "TimeoutError" || e?.name === "AbortError") {
      res.status(504).json({ message: "AI 服务响应超时" });
      return;
    }
    res.status(502).json({ message: `AI 服务不可用（${AI_URL}）: ${e?.message ?? e}` });
  }
});

// POST /api/ai/h3-video-prompt —— 分镜 → H3 视频提示词（导演路由：Ref2VA/多镜）
router.post("/ai/h3-video-prompt", async (req, res, next) => {
  try {
    const body = z
      .object({
        videoDesc: z.string().min(1),
        duration: z.number().int().min(1).max(15).default(6),
        assets: z
          .array(
            z.object({
              name: z.string().min(1),
              type: z.enum(["character", "scene", "prop", "material"]),
              description: z.string().default(""),
            }),
          )
          .min(1),
        multishot: z.boolean().default(false),
        projectId: z.number().int().positive().optional(),
      })
      .parse(req.body ?? {});
    const ctx = await getProjectContext(body.projectId ?? 0);

    const upstream = await fetch(`${AI_URL}/ai/h3-video-prompt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ctx.apiKey ? { "x-api-key": ctx.apiKey } : {}),
      },
      body: JSON.stringify({
        video_desc: body.videoDesc,
        duration: body.duration,
        assets: body.assets,
        multishot: body.multishot,
        visual_skill: ctx.visualSkill,
        director_skill: ctx.directorSkill,
        video_ratio: ctx.videoRatio,
      }),
      signal: AbortSignal.timeout(300_000),
    });
    if (!upstream.ok) {
      const text = await upstream.text();
      res.status(upstream.status).json({ message: text.slice(0, 300) });
      return;
    }
    const json = await upstream.json();
    res.json(json);
  } catch (e: any) {
    if (e?.name === "TimeoutError" || e?.name === "AbortError") {
      res.status(504).json({ message: "AI 服务响应超时" });
      return;
    }
    res.status(502).json({ message: `AI 服务不可用（${AI_URL}）: ${e?.message ?? e}` });
  }
});

// POST /api/ai/h3-ref2va-prompt —— 分镜 → H3 Ref2VA 六段式提示词（人物/场景/道具一致性）
router.post("/ai/h3-ref2va-prompt", async (req, res, next) => {
  try {
    const body = z
      .object({
        videoDesc: z.string().min(1),
        duration: z.number().int().min(1).max(15).default(6),
        assets: z
          .array(
            z.object({
              name: z.string().min(1),
              type: z.enum(["character", "scene", "prop", "material"]),
              description: z.string().default(""),
            }),
          )
          .min(1),
        projectId: z.number().int().positive().optional(),
      })
      .parse(req.body ?? {});
    const ctx = await getProjectContext(body.projectId ?? 0);

    const upstream = await fetch(`${AI_URL}/ai/h3-ref2va-prompt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ctx.apiKey ? { "x-api-key": ctx.apiKey } : {}),
      },
      body: JSON.stringify({
        video_desc: body.videoDesc,
        duration: body.duration,
        assets: body.assets,
        visual_skill: ctx.visualSkill,
        director_skill: ctx.directorSkill,
        video_ratio: ctx.videoRatio,
      }),
      signal: AbortSignal.timeout(300_000),
    });
    if (!upstream.ok) {
      const text = await upstream.text();
      res.status(upstream.status).json({ message: text.slice(0, 300) });
      return;
    }
    const json = await upstream.json();
    res.json(json);
  } catch (e: any) {
    if (e?.name === "TimeoutError" || e?.name === "AbortError") {
      res.status(504).json({ message: "AI 服务响应超时" });
      return;
    }
    res.status(502).json({ message: `AI 服务不可用（${AI_URL}）: ${e?.message ?? e}` });
  }
});

export default router;
