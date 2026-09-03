import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import flowRouter from "./routes/flow.js";
import assetsRouter from "./routes/assets.js";
import episodesRouter from "./routes/episodes.js";
import storyboardsRouter from "./routes/storyboards.js";
import videosRouter from "./routes/videos.js";
import longVideoRouter from "./routes/longVideo.js";
import settingsRouter from "./routes/settings.js";
import libraryRouter from "./routes/library.js";
import aiRouter from "./routes/ai.js";
import skillsRouter from "./routes/skills.js";
import memoryRouter from "./routes/memory.js";
import projectsRouter from "./routes/projects.js";
import novelsRouter from "./routes/novels.js";
import episodeAssetsRouter from "./routes/episodeAssets.js";
import actorVoicesRouter from "./routes/actorVoices.js";
import voicePreviewRouter from "./routes/voicePreview.js";
import { initProviders, loadSettingsFromDb } from "./providers/manager.js";
import { z } from "zod";

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "50mb" }));

// /oss 静态服务（生成图/素材）
const OSS_DIR = process.env.OSS_DIR || path.join(process.cwd(), "oss");
fs.mkdirSync(OSS_DIR, { recursive: true });
app.use("/oss", express.static(OSS_DIR, { acceptRanges: false }));

// /actor-voice 静态服务（配音演员参考音频：ActorVoice 目录，供资产编辑页试听/克隆）
const ACTOR_VOICE_DIR = process.env.ACTOR_VOICE_DIR || "E:\\AIMovie\\AIMovieWorkSpace\\nine_tailed_fox\\ActorVoice";
app.use("/actor-voice", express.static(ACTOR_VOICE_DIR, { acceptRanges: false }));

// Provider 初始化（DB 设置优先，支持设置页热更新）
await initProviders(await loadSettingsFromDb());

// 简单请求日志
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// 健康检查
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "nine-tailed-fox-server", time: new Date().toISOString() });
});

// 画布：拉取 / 保存
app.use("/api", flowRouter);
// 项目：列表(含统计) / 新建 / 删除
app.use("/api", projectsRouter);
// 源小说：读 / 存
app.use("/api", novelsRouter);
app.use("/api", episodeAssetsRouter);
app.use("/api", actorVoicesRouter);
app.use("/api", voicePreviewRouter);
// 资产：创建 / 列表 / 生成 / 状态
app.use("/api", assetsRouter);
// 集：列表 / 新建 / 详情 / 更新剧本
app.use("/api", episodesRouter);
// 分镜：创建 / 列表 / 更新 / 删除 / 生成 / 状态
app.use("/api", storyboardsRouter);
// 视频：分镜图 → 图生视频
app.use("/api", videosRouter);
// 整集长视频：MiniMaxH3 Director 串联（支持分段重跑）
app.use("/api", longVideoRouter);
// 设置：工作流路径等（热生效）
app.use("/api", settingsRouter);
// 素材库：资产/分镜/视频汇总
app.use("/api", libraryRouter);
// AI：剧本拆镜（转发 Python 服务）
app.use("/api", aiRouter);
// 技能：在线编辑（保存即生效）
app.use("/api", skillsRouter);
// 记忆：素材语义写入/检索（转发 AI 服务）
app.use("/api", memoryRouter);

// 404
app.use((_req, res) => res.status(404).json({ message: "API 404 Not Found" }));

// 错误处理
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const message = err instanceof Error ? err.message : String(err);
  if (err instanceof z.ZodError) {
    res.status(400).json({ message: "参数校验失败", issues: err.issues });
    return;
  }
  res.status(500).json({ message });
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`[九尾狐 server] http://localhost:${PORT}`);
});
