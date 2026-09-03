// M1-M4 种子数据：示例项目 + 集 + 示例剧本
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SCRIPT_SAMPLE = `# 第一幕 · 夜与剑

## 场 1　眉间尺家·卧房（夜）

【画面】狭小的土屋卧房。月光从破窗斜入，在泥地上投下灰白的窗棂影。
眉间尺与母亲并卧，母亲侧身朝里，呼吸匀沉。

眉间尺（低声叱）：「去！去！」

【特写】一只很大的老鼠陷在水瓮里，沿内壁乱爬，转着圈子上不来。

母亲：「尺儿，你在做什么？」
眉间尺（慌忙站起）：「老鼠……」`;

async function main() {
  // 项目
  await prisma.project.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, name: "示例项目 · 铸剑（侯孝贤美学）" },
  });
  await prisma.project.upsert({
    where: { id: 2 },
    update: {},
    create: { id: 2, name: "示例项目 · 九尾狐 Demo" },
  });

  // 集（episode 1：画布边界 + 剧本）
  await prisma.episode.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, projectId: 1, name: "第 1 集", index: 1, scriptContent: SCRIPT_SAMPLE },
  });
  await prisma.episode.upsert({
    where: { id: 2 },
    update: {},
    create: { id: 2, projectId: 2, name: "第 1 集", index: 1, scriptContent: "" },
  });

  console.log("[seed] 项目 2 个 + 集 2 个已就绪");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
