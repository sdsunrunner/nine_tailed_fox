import { Router } from "express";
import { z } from "zod";

const router = Router();

async function getPrisma() {
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

const projectParams = z.object({ projectId: z.coerce.number().int().positive() });
const episodeParams = projectParams.extend({ episodeId: z.coerce.number().int().positive() });

const createSchema = z.object({
  name: z.string().min(1).default("新的一集"),
  index: z.number().int().positive().optional(),
  scriptContent: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  scriptContent: z.string().optional(),
});

// GET /api/projects/:projectId/episodes —— 集列表
router.get("/projects/:projectId/episodes", async (req, res, next) => {
  try {
    const { projectId } = projectParams.parse(req.params);
    const prisma = await getPrisma();
    const episodes = await prisma.episode.findMany({
      where: { projectId },
      orderBy: { index: "asc" },
    });
    res.json({ data: episodes });
    await prisma.$disconnect();
  } catch (e) {
    next(e);
  }
});

// POST /api/projects/:projectId/episodes —— 新建集
router.post("/projects/:projectId/episodes", async (req, res, next) => {
  try {
    const { projectId } = projectParams.parse(req.params);
    const body = createSchema.parse(req.body ?? {});
    const prisma = await getPrisma();

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      res.status(404).json({ message: "项目不存在" });
      return;
    }

    const max = await prisma.episode.aggregate({
      where: { projectId },
      _max: { index: true },
    });
    const episode = await prisma.episode.create({
      data: {
        projectId,
        name: body.name,
        index: body.index ?? (max._max.index ?? 0) + 1,
        scriptContent: body.scriptContent ?? "",
      },
    });
    res.status(201).json({ data: episode });
    await prisma.$disconnect();
  } catch (e) {
    next(e);
  }
});

// GET /api/projects/:projectId/episodes/:episodeId —— 集详情（含剧本）
router.get("/projects/:projectId/episodes/:episodeId", async (req, res, next) => {
  try {
    const { projectId, episodeId } = episodeParams.parse(req.params);
    const prisma = await getPrisma();
    const episode = await prisma.episode.findFirst({ where: { id: episodeId, projectId } });
    if (!episode) {
      res.status(404).json({ message: "集不存在" });
      return;
    }
    res.json({ data: episode });
    await prisma.$disconnect();
  } catch (e) {
    next(e);
  }
});

// PUT /api/projects/:projectId/episodes/:episodeId —— 更新集（名称/剧本）
router.put("/projects/:projectId/episodes/:episodeId", async (req, res, next) => {
  try {
    const { projectId, episodeId } = episodeParams.parse(req.params);
    const body = updateSchema.parse(req.body ?? {});
    const prisma = await getPrisma();

    const episode = await prisma.episode.findFirst({ where: { id: episodeId, projectId } });
    if (!episode) {
      res.status(404).json({ message: "集不存在" });
      return;
    }
    const updated = await prisma.episode.update({ where: { id: episodeId }, data: body });
    res.json({ data: updated });
    await prisma.$disconnect();
  } catch (e) {
    next(e);
  }
});

export default router;
