import { Router } from "express";
import { z } from "zod";

const router = Router();

async function getPrisma() {
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

const paramsSchema = z.object({ projectId: z.coerce.number().int().positive() });
const updateSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
});

// GET /api/projects/:projectId/novel —— 源小说（无则返回空结构）
router.get("/projects/:projectId/novel", async (req, res, next) => {
  try {
    const { projectId } = paramsSchema.parse(req.params);
    const prisma = await getPrisma();
    const novel = await prisma.novel.findUnique({ where: { projectId } });
    if (!novel) {
      res.json({ data: { projectId, title: "未命名小说", content: "" } });
      return;
    }
    res.json({ data: novel });
    await prisma.$disconnect();
  } catch (e) {
    next(e);
  }
});

// PUT /api/projects/:projectId/novel —— 保存小说（upsert）
router.put("/projects/:projectId/novel", async (req, res, next) => {
  try {
    const { projectId } = paramsSchema.parse(req.params);
    const body = updateSchema.parse(req.body ?? {});
    const prisma = await getPrisma();

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      res.status(404).json({ message: "项目不存在" });
      return;
    }
    const novel = await prisma.novel.upsert({
      where: { projectId },
      update: body,
      create: { projectId, title: body.title ?? "未命名小说", content: body.content ?? "" },
    });
    res.json({ data: novel });
    await prisma.$disconnect();
  } catch (e) {
    next(e);
  }
});

export default router;
