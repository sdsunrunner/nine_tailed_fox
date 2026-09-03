import { Router } from "express";
import { z } from "zod";

const router = Router();

// 延迟加载 Prisma，避免启动时 client 未生成
async function getPrisma() {
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

const paramsSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  episodeId: z.coerce.number().int().positive(),
});

// 画布布局 Schema（Vue Flow 序列化结构，宽松校验）
const canvasSchema = z.object({
  nodes: z.array(z.record(z.unknown())).default([]),
  edges: z.array(z.record(z.unknown())).default([]),
});

// GET /api/projects/:projectId/episodes/:episodeId/flow
// 拉取整张画布；无记录时返回空画布（对齐 Toonflow getFlowData 的空态）
router.get("/projects/:projectId/episodes/:episodeId/flow", async (req, res, next) => {
  try {
    const { projectId, episodeId } = paramsSchema.parse(req.params);
    const prisma = await getPrisma();

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      res.status(404).json({ message: "项目不存在" });
      return;
    }

    const canvas = await prisma.flowCanvas.findUnique({
      where: { projectId_episodeId: { projectId, episodeId } },
    });

    res.json({
      data: {
        project: { id: project.id, name: project.name },
        episodeId,
        nodes: (canvas?.nodes as unknown[] | undefined) ?? [],
        edges: (canvas?.edges as unknown[] | undefined) ?? [],
        updatedAt: canvas?.updatedAt ?? null,
      },
    });
    await prisma.$disconnect();
  } catch (e) {
    next(e);
  }
});

// PUT /api/projects/:projectId/episodes/:episodeId/flow
// 保存画布布局（全量快照，upsert）
router.put("/projects/:projectId/episodes/:episodeId/flow", async (req, res, next) => {
  try {
    const { projectId, episodeId } = paramsSchema.parse(req.params);
    const { nodes, edges } = canvasSchema.parse(req.body ?? {});

    const prisma = await getPrisma();

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      res.status(404).json({ message: "项目不存在" });
      return;
    }

    const canvas = await prisma.flowCanvas.upsert({
      where: { projectId_episodeId: { projectId, episodeId } },
      update: { nodes, edges },
      create: { projectId, episodeId, nodes, edges },
    });

    res.json({ data: { id: canvas.id, updatedAt: canvas.updatedAt } });
    await prisma.$disconnect();
  } catch (e) {
    next(e);
  }
});

export default router;
