import { Router } from "express";
import { z } from "zod";

const router = Router();

async function getPrisma() {
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

const idSchema = z.object({ id: z.coerce.number().int().positive() });
const createSchema = z.object({
  name: z.string().min(1).max(60),
  overview: z.string().max(500).default(""),
  videoRatio: z.string().default("9:16"),
  visualSkill: z.string().default(""),
  directorSkill: z.string().default(""),
  era: z.string().default(""),
  episodeCount: z.number().int().min(1).max(20).default(3),
  totalDurationMin: z.number().int().min(5).max(300).default(20),
});

const updateSchema = z.object({
  overview: z.string().max(500).optional(),
  videoRatio: z.string().optional(),
  visualSkill: z.string().optional(),
  directorSkill: z.string().optional(),
  era: z.string().optional(),
  episodeCount: z.number().int().min(1).max(20).optional(),
  totalDurationMin: z.number().int().min(5).max(300).optional(),
  scriptContent: z.string().optional(), // 整片剧本（Markdown，含 ## 场 N）
});

// GET /api/projects —— 项目列表（含统计：集数/资产/分镜/视频数/总时长秒）
router.get("/projects", async (_req, res, next) => {
  try {
    const prisma = await getPrisma();
    const projects = await prisma.project.findMany({ orderBy: { id: "asc" } });
    const [epCount, assetCount, sbCount, videoCount, sbDuration] = await Promise.all([
      prisma.episode.groupBy({ by: ["projectId"], _count: { _all: true } }),
      prisma.asset.groupBy({ by: ["projectId"], _count: { _all: true } }),
      prisma.storyboard.groupBy({ by: ["projectId"], _count: { _all: true } }),
      prisma.videoClip.groupBy({ by: ["projectId"], _count: { _all: true } }),
      prisma.storyboard.groupBy({ by: ["projectId"], _sum: { duration: true } }),
    ]);
    const empty = { episodes: 0, assets: 0, storyboards: 0, videos: 0, durationSec: 0 };
    const stats: Record<number, typeof empty> = {};
    for (const g of epCount) stats[g.projectId] = { ...(stats[g.projectId] ?? { ...empty }), episodes: g._count._all };
    for (const g of assetCount) stats[g.projectId] = { ...(stats[g.projectId] ?? { ...empty }), assets: g._count._all };
    for (const g of sbCount) stats[g.projectId] = { ...(stats[g.projectId] ?? { ...empty }), storyboards: g._count._all };
    for (const g of videoCount) stats[g.projectId] = { ...(stats[g.projectId] ?? { ...empty }), videos: g._count._all };
    for (const g of sbDuration) stats[g.projectId] = { ...(stats[g.projectId] ?? { ...empty }), durationSec: g._sum.duration ?? 0 };
    const data = projects.map((p) => ({ ...p, stats: stats[p.id] ?? { ...empty } }));
    res.json({ data });
    await prisma.$disconnect();
  } catch (e) {
    next(e);
  }
});

// POST /api/projects —— 新建项目（自动创建第 1 集）
router.post("/projects", async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body ?? {});
    const prisma = await getPrisma();
    const project = await prisma.project.create({
      data: {
        name: body.name,
        overview: body.overview,
        videoRatio: body.videoRatio,
        visualSkill: body.visualSkill,
        directorSkill: body.directorSkill,
        era: body.era,
        episodeCount: body.episodeCount,
        totalDurationMin: body.totalDurationMin,
      },
    });
    await prisma.episode.create({
      data: { projectId: project.id, name: "场 1", index: 1, scriptContent: "" },
    });
    res.status(201).json({ data: project });
    await prisma.$disconnect();
  } catch (e) {
    next(e);
  }
});

// PUT /api/projects/:id —— 更新项目（概述/比例/视觉手册/导演手册）
router.put("/projects/:id", async (req, res, next) => {
  try {
    const { id } = idSchema.parse(req.params);
    const body = updateSchema.parse(req.body ?? {});
    const prisma = await getPrisma();
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      res.status(404).json({ message: "项目不存在" });
      return;
    }
    const updated = await prisma.project.update({ where: { id }, data: body });
    res.json({ data: updated });
    await prisma.$disconnect();
  } catch (e) {
    next(e);
  }
});

// DELETE /api/projects/:id —— 删除项目（级联删除画布/资产/集/分镜/视频）
router.delete("/projects/:id", async (req, res, next) => {
  try {
    const { id } = idSchema.parse(req.params);
    const prisma = await getPrisma();
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      res.status(404).json({ message: "项目不存在" });
      return;
    }
    await prisma.project.delete({ where: { id } });
    res.json({ data: { id, deleted: true } });
    await prisma.$disconnect();
  } catch (e) {
    next(e);
  }
});

export default router;
