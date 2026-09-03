import { Router } from "express";
import { z } from "zod";

const router = Router();

async function getPrisma() {
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

const querySchema = z.object({
  projectId: z.coerce.number().int().positive().optional(),
  kind: z.enum(["asset", "storyboard", "video", "all"]).default("all"),
});

// GET /api/library?kind=all|asset|storyboard|video&projectId=1
// 汇总资产/分镜/视频（含项目/集名），供素材库页浏览
router.get("/library", async (req, res, next) => {
  try {
    const { projectId, kind } = querySchema.parse(req.query ?? {});
    const prisma = await getPrisma();

    const projectFilter = projectId ? { projectId } : {};
    const whereAll = { ...projectFilter };
    const projectMap: Record<number, { name: string; episodes: Record<number, string> }> = {};
    for (const p of await prisma.project.findMany()) {
      projectMap[p.id] = { name: p.name, episodes: {} };
    }
    for (const e of await prisma.episode.findMany()) {
      if (projectMap[e.projectId]) projectMap[e.projectId].episodes[e.id] = e.name;
    }

    const items: any[] = [];

    if (kind === "all" || kind === "asset") {
      const assets = await prisma.asset.findMany({
        where: { ...whereAll, filePath: { not: null } },
        orderBy: { updatedAt: "desc" },
        take: 500,
      });
      for (const a of assets) {
        items.push({
          id: a.id,
          kind: "asset",
          type: a.type,
          name: a.name,
          filePath: a.filePath,
          state: a.state,
          projectId: a.projectId,
          episodeId: a.episodeId,
          projectName: projectMap[a.projectId]?.name ?? "",
          episodeName: projectMap[a.projectId]?.episodes[a.episodeId] ?? "",
          updatedAt: a.updatedAt,
        });
      }
    }

    if (kind === "all" || kind === "storyboard") {
      const sbs = await prisma.storyboard.findMany({
        where: { ...whereAll, filePath: { not: null } },
        orderBy: { updatedAt: "desc" },
        take: 500,
      });
      for (const s of sbs) {
        items.push({
          id: s.id,
          kind: "storyboard",
          type: "storyboard",
          name: `分镜 #${s.index}`,
          prompt: s.prompt,
          videoDesc: s.videoDesc,
          assetIds: s.assetIds as number[],
          filePath: s.filePath,
          state: s.state,
          projectId: s.projectId,
          episodeId: s.episodeId,
          projectName: projectMap[s.projectId]?.name ?? "",
          episodeName: projectMap[s.projectId]?.episodes[s.episodeId] ?? "",
          updatedAt: s.updatedAt,
        });
      }
    }

    if (kind === "all" || kind === "video") {
      const clips = await prisma.videoClip.findMany({
        where: { ...whereAll, filePath: { not: null } },
        orderBy: { updatedAt: "desc" },
        take: 500,
      });
      for (const c of clips) {
        items.push({
          kind: "video",
          type: "video",
          name: `视频 #${c.storyboardId}`,
          filePath: c.filePath,
          state: c.state,
          projectId: c.projectId,
          episodeId: c.episodeId,
          projectName: projectMap[c.projectId]?.name ?? "",
          episodeName: projectMap[c.projectId]?.episodes[c.episodeId] ?? "",
          updatedAt: c.updatedAt,
        });
      }
    }

    res.json({ data: items });
    await prisma.$disconnect();
  } catch (e) {
    next(e);
  }
});

export default router;
