# 07 · Toonflow 架构参考（可复用蓝本）

> 对 `Toonflow-app-master`（Apache-2.0，HBAI-Ltd）源码级实现框架的分析，
> 作为九尾狐（nine_tailed_fox）后续设计与能力复用的参考。

文档版本：v1.0　｜　最后更新：2026-08-19　｜　分析对象：Toonflow v1.1.8

---

## 1. 项目定位与技术栈

Toonflow 是 AI 短剧工厂：**小说 → 章节事件图谱 → 剧本（ScriptAgent）→ 分镜/素材/视频（ProductionAgent）→ 无限画布工作台出片**，全流程闭环。

| 层 | 技术 |
|---|---|
| 语言/运行时 | TypeScript 5.x + Node 23 |
| 后端 | Express 5 + express-ws + Socket.IO |
| 数据库 | SQLite（Knex + better-sqlite3） |
| AI | Vercel AI SDK（OpenAI/DeepSeek/Anthropic/Google/智谱/MiniMax/通义/xAI） |
| 本地推理 | @huggingface/transformers + ONNX（all-MiniLM-L6-v2 句子嵌入） |
| 桌面/容器 | Electron 40 / Docker；图像处理 Sharp |

> 对照：九尾狐当前技术栈为 Vue + LangChain + Milvus + Docker。Toonflow 的"SQLite+本地 ONNX 嵌入"方案更轻量、免部署；LangChain+Milvus 则更强检索、可水平扩展。可结合自身定位选择。

## 2. 总体架构（四层）

```
data/web（Vue3 前端产物，内置）  ──┐
scripts/main.ts（Electron 壳）    ├─► src/app.ts 单服务（端口 10588）
data/serve/app.js（生产 bundle）──┘         │
                              ┌────────────┼─────────────────────┐
                              ▼            ▼                     ▼
                     HTTP API 路由      Socket.IO（Agent 流式）  静态资源
                   （core.ts 代码生成）  （ResTool 分块下发）   /oss /skills /assets /web
                              │
                  ┌───────────┼──────────────┐
                  ▼           ▼              ▼
             SQLite(db2)   data/oss 素材库   AI 供应商（vm2 沙箱）
             + memories表  + data/skills    + 本地 ONNX 嵌入
```

## 3. 服务端核心框架

- **入口装配**（`src/app.ts`）：`http.createServer` 同时承载 Express 与 socket.io，再挂 `expressWs`；中间件链 = morgan → cors → json(100mb) → 静态资源（`/oss` 支持 `?size=宽x高|百分比` 动态缩略图、`/skills` 仅放行图片、`/assets`、`/web`）→ **JWT 鉴权**（密钥存 `o_setting.tokenKey`，白名单 `/api/login/login`）→ 路由 → 404/错误兜底。
- **路由代码生成**（`src/core.ts` → `src/router.ts`）：fast-glob 扫描 `src/routes/**/*.ts`，按字典序编号 route1..route169，文件路径自动转 URL（`[id]`→`:id`），以 `// @routes-hash <md5>` 判断是否重写。每个 handler 是默认导出的 `express.Router`，按领域目录分组。
- **单例工具**（`src/utils.ts`）：db/oss/Ai/vm/vendor/task/getPath 聚合为 `u` 对象全局使用。

## 4. AI Agent 系统（核心亮点）

两个 Agent（scriptAgent / productionAgent）**同构**，基于 Vercel AI SDK 的 `streamText/generateText/tool/jsonSchema`：

- **决策 Agent + 子 Agent 工具**：`runDecisionAI(ctx)` 写记忆 → 读主技能 md 作 system prompt → stream 时注入三类工具：
  1. **记忆工具** `memory.getTools()`（deepRetrieve 语义检索）
  2. **业务工具** `useTools()`（get_novel_events / get_planData / get_script_content…，get_planData 经 `socket.emit` 与前端往返读工作区）
  3. **子 Agent 工具** `createSubAgent()`：scriptAgent 挂 4 个（storySkeleton / adaptationStrategy / script / supervision）；productionAgent 挂 7 个（derive_assets / generate_assets / director_plan / storyboard_gen / panel / table / supervision）——每个子 Agent 独立读 .md 技能、内部再开一次 stream。
- **输出协议**：productionAgent 用 `<scriptPlan>/<storyboardTable>/<storyboardItem>` XML 约定，便于结构化落库。
- **技能注入**（`src/utils/agent/skillsTools.ts`）：`parseFrontmatter` / `scanSkills`（fast-glob）/ `useSkill` / `createSkillTools`，封装为 AI SDK tool（`activate_skill`、`read_skill_file`），`isPathInside` 防路径穿越。
- **持久化记忆**（`src/utils/agent/memory.ts`）：SQLite `memories` 表按 isolationKey 隔离；`add()` 用本地 ONNX 嵌入（all-MiniLM-L6-v2，mean pooling）算向量；攒满 3 条消息由 AI 压缩成 summary；`get()` 拼 shortTerm(5) + summaries(10) + rag(向量余弦 top3)；`deepRetrieve()` 两级检索（向量召回 → AI 判断相关性 → 展开原文）。
- **流式下发**：`consumeFullStream` 消费 reasoning/text 增量，经 socket ResTool 分块推给前端。

## 5. 技能库体系（data/skills）★九尾狐已在复用的规范

```
data/skills/
├─ story_skills/        12 个叙事类型（Xianxia_fantasy、Historical_epic、Horror_supernatural…）
├─ art_skills/          11 个画风（2D_chinese_guofeng、realpeople_ancient_chinese、3D_*…）
├─ production_skills/   2 个通用技法（storyboard_prompt_techniques / storyboard_table_techniques）
└─ 根目录 14 个 script_*.md / production_*.md（剧本/生产 Agent 主技能流程文件）
```

每个类型目录约定（以 2D_chinese_guofeng 为例）：`README.md + prefix.md + art_prompt/（7个）+ driector_skills/（3个）+ images/`

- 文档格式统一为 **YAML frontmatter（name / description / metaData）+ 表格化正文**（约束列 + 提示词列两栏）。
- `art_prompt/` = 美术资产生成手册（art_character / art_character_derivative / art_scene / art_scene_derivative / art_prop / art_prop_derivative / art_storyboard_video）——回答"图怎么画"。
- `driector_skills/` = 导演分镜技法（director_planning_style / director_storyboard / director_storyboard_table_style）——回答"镜头怎么拍"。
- `images/` = 风格样图，经 `/skills` 静态路由（仅图片白名单）供前端预览；`prefix.md` 为风格锚定词前缀（`getArtPrompt.ts` 自动拼接）。
- 代码消费点：`skillsTools.ts`、两个 Agent 的 index.ts、`src/routes/script/extractAssets.ts`（useSkill）、`src/routes/project/*VisualManual*`、`src/routes/assetsGenerate/polish*`、`src/routes/production/**`。

## 6. 数据层

- `src/utils/db.ts`：Knex + better-sqlite3 → `db2.sqlite`；dev 下用 `@rmp135/sql-ts` 反推生成 `src/types/database.d.ts`（hash 判重）。
- `src/lib/initDB.ts`：建表 + 初始数据（admin 用户、两个 Agent 部署位、供应商行）；`src/lib/fixDB.ts`：启动修复（异常退出遗留的"生成中"→"生成失败"、addColumn 增量迁移、按 vendor.json 补供应商）。
- 核心表：o_project（模型存 `"vendorId:模型名"`、artStyle、directorManual）、o_novel、o_script、o_assets/o_image、o_storyboard/o_video/o_videoTrack、o_agentDeploy、o_setting、o_vendorConfig、o_tasks、o_agentWorkData、memories。

## 7. 可编程供应商系统（差异化亮点）

- `src/lib/vendor.json` 内置 TS 模板（atlascloud / deepseek / openai / volcengine…），每份导出 `vendor` 配置（Text/Image/Video/TTSModel）+ `textRequest/imageRequest/videoRequest/ttsRequest` 函数。
- 运行期：`src/utils/vendor.ts` 存取模板；`src/utils/ai.ts` 用 **sucrase 转 JS 后在 vm2 沙箱执行**（注入 createOpenAI/createDeepSeek 等工厂 + zipImage/mergeImages/pollTask/axios 工具）——用户可在设置中心改 TS 即时生效，无需重启。
- `resolveModelName` 按 `o_agentDeploy` 简易/高级模式解析模型；`wrapLanguageModel` 包 `extractReasoningMiddleware` 拆思考内容；`setting/vendorConfig/*` 提供增删改与 text/image/video 在线测试。

## 8. 任务/生成管线

HTTP 同步驱动 + **前端轮询 DB 状态**（无服务端回调）：
- 图片：插 `o_image(生成中)` → `u.Ai.Image(...).run()` 经 `withTaskRecord` 落 `o_tasks` → 供应商返回 base64 → `save()` 到 oss → 置"已完成"；前端轮询路由只查非"生成中"行。
- 视频：先插 `o_video`、立即返回 videoId 后异步生成；模板内用沙箱 `pollTask(fn, 3000, 3000000)` 轮询第三方异步任务。

## 9. 部署与构建

| 形态 | 方式 |
|---|---|
| Web | `yarn dev`（tsx src/app.ts）；生产 `启动服务.bat` → `node data/serve/app.js`，访问 :10588/web/index.html（admin/admin123） |
| Electron | `scripts/main.ts` → esbuild 产 build/main.js；electron-builder 打包 win/mac/linux，extraResources 复制 data（排除 db/logs/oss） |
| Docker | node:24-bookworm-slim，删 electron 依赖后 `yarn dev` 起容器 |

构建链：`scripts/build.ts`（esbuild 双入口：app.ts→data/serve/app.js、main.ts→build/main.js，external 原生模块）→ electron-builder → `license.ts`/`vendor2json.ts`（生成 NOTICES.txt / vendor.json）。

## 10. 对九尾狐的复用建议

1. **技能库规范**（最高价值）：frontmatter + 表格化提示词 + `art_prompt`（怎么画）/`driector_skills`（怎么拍）分层 + `images/` 样图 + `prefix.md` 前缀。九尾狐的铸剑项目已按此规范产出（角色四视图/场景主视图/道具四宫格/三段式分镜提示词）。
2. **Agent 模式**：决策 Agent + 子 Agent 工具 + 技能激活工具（activate_skill / read_skill_file）+ 持久化记忆（短期消息 + 摘要 + 向量召回）。
3. **供应商可编程体系**：TS 模板 + vm2 沙箱热加载——九尾狐如需要私有化多模型接入可借鉴；注意 vm2 已不再维护，替代方案：`isolated-vm` 或 worker 线程。
4. **路由代码生成**：新增接口零注册成本，适合快速迭代，但调试时需理解 hash 机制。
5. **任务模型**：异步生成 + 前端轮询 + 启动修复"生成中"残留，工程上非常务实，可直接采用。
