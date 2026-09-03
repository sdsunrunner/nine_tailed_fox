import { Router } from "express";
import { z } from "zod";

const router = Router();

async function getPrisma() {
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

const projectParams = z.object({ projectId: z.coerce.number().int().positive() });

const itemSchema = z.object({
  type: z.enum(["character", "scene", "prop", "material"]),
  name: z.string().min(1),
  description: z.string().default(""),
  episodes: z.array(z.number().int().positive()).default([]),
});

const saveSchema = z.object({
  items: z.array(itemSchema).default([]),
});

// GET /api/projects/:projectId/episode-assets —— 该项目剧本分析的集-资产映射
router.get("/projects/:projectId/episode-assets", async (req, res, next) => {
  try {
    const { projectId } = projectParams.parse(req.params);
    const prisma = await getPrisma();
    const list = await prisma.episodeAsset.findMany({
      where: { projectId },
      orderBy: [{ type: "asc" }, { id: "asc" }],
    });
    res.json({
      data: list.map((a) => ({
        id: a.id,
        type: a.type,
        name: a.name,
        description: a.description,
        episodes: a.episodes as number[],
      })),
    });
    await prisma.$disconnect();
  } catch (e) {
    next(e);
  }
});

// PUT /api/projects/:projectId/episode-assets —— 全量覆盖保存（分析资产后调用）
router.put("/projects/:projectId/episode-assets", async (req, res, next) => {
  try {
    const { projectId } = projectParams.parse(req.params);
    const { items } = saveSchema.parse(req.body ?? {});
    const prisma = await getPrisma();

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      res.status(404).json({ message: "项目不存在" });
      return;
    }

    // 去重：表有 @@unique([projectId, type, name])，AI 分析可能返回重复项 → 撞唯一约束报 500
    const seen = new Set<string>();
    const uniqueItems = items.filter((it) => {
      const key = `${it.type}:${it.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    await prisma.$transaction([
      prisma.episodeAsset.deleteMany({ where: { projectId } }),
      prisma.episodeAsset.createMany({
        data: uniqueItems.map((it) => ({
          projectId,
          type: it.type,
          name: it.name,
          description: it.description,
          episodes: it.episodes,
        })),
      }),
    ]);

    res.json({ data: { saved: uniqueItems.length, deduped: items.length - uniqueItems.length } });
    await prisma.$disconnect();
  } catch (e) {
    next(e);
  }
});

export default router;
