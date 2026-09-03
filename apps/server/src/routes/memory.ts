import { Router } from "express";
import { z } from "zod";

const router = Router();

const AI_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8001";

const upsertSchema = z.object({
  text: z.string().min(1),
  kind: z.string().default("asset"),
  type: z.string().default(""),
  filePath: z.string().default(""),
  projectId: z.number().default(0),
  episodeId: z.number().default(0),
});

const searchSchema = z.object({
  query: z.string().min(1),
  top_k: z.number().int().min(1).max(20).default(5),
});

async function callAI(path: string, body: unknown) {
  const upstream = await fetch(`${AI_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  const text = await upstream.text();
  if (!upstream.ok) {
    throw new Error(text.slice(0, 300));
  }
  return JSON.parse(text);
}

// POST /api/memory/upsert —— 写入语义记忆（素材生成完成时自动调用）
router.post("/memory/upsert", async (req, res, next) => {
  try {
    const body = upsertSchema.parse(req.body ?? {});
    const json = await callAI("/ai/memory/upsert", body);
    res.json(json);
  } catch (e: any) {
    res.status(502).json({ message: `记忆写入失败：${e?.message ?? e}` });
  }
});

// POST /api/memory/search —— 语义检索素材
router.post("/memory/search", async (req, res, next) => {
  try {
    const body = searchSchema.parse(req.body ?? {});
    const json = await callAI("/ai/memory/search", body);
    res.json(json);
  } catch (e: any) {
    res.status(502).json({ message: `记忆检索失败：${e?.message ?? e}` });
  }
});

/** 供生成路由调用的记忆写入（fire-and-forget） */
export async function memoryUpsert(input: {
  text: string;
  kind: string;
  type?: string;
  filePath?: string;
  projectId?: number;
  episodeId?: number;
}) {
  try {
    await callAI("/ai/memory/upsert", {
      text: input.text,
      kind: input.kind,
      type: input.type ?? "",
      filePath: input.filePath ?? "",
      projectId: input.projectId ?? 0,
      episodeId: input.episodeId ?? 0,
    });
  } catch {
    // 记忆写入失败不影响主流程
  }
}

export default router;
