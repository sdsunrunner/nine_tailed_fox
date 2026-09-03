# 技术栈选型文档

> nine_tailed_fox — 九尾狐 AI 工作台技术栈全景
>
> 文档版本：v0.8（技术栈定案：Vue + LangChain + Milvus + Docker）
> 最后更新：2026-08-19
> 📌 实现状态：M1 画布 / M2 资产 / M3 ComfyUI 出图 / 剧本 / 分镜 / 视频 / 批量 / 素材库 / 设置 / 技能编辑 / AI 拆镜 均已落地（向量记忆用 chromadb 实现，见 [09-Implementation-Status.md](./09-Implementation-Status.md)）
> 依据：用户决策（前端 **Vue** / AI 编排 **Python LangChain** / 记忆与向量库 **Milvus** / 部署 **Docker** / 图像视频 **本地 ComfyUI**）+ 参考项目 waoowaoo-main + 现有设计文档 02-Architecture / 05-AI-Provider

---

## 0. 选型定位（与 waoowaoo-main 的区别）

| 维度 | waoowaoo-main（参考） | nine_tailed_fox（本项目） |
|------|----------------------|--------------------------|
| 前端形态 | Next.js 15 全栈（SSR/API Routes） | **Vue 3 SPA**（Vite 构建，纯前端，Web 展示） |
| AI 编排 | Vercel AI SDK（ai v6） | **Python LangChain + LangGraph**（独立 FastAPI 服务） |
| 记忆/向量库 | 无（结构化 DB 直查） | **Milvus**（记忆 + 素材/剧本语义检索 + 一致性知识召回） |
| 图像/视频生成 | fal.ai 云端 API + Remotion 合成 | **本地 ComfyUI**（自建/可切云端 API） |
| 无限画布 | 无（分镜列表式） | 规划中（Vue 生态方案，见 §1.4，暂不实现） |
| 后端 | Next API Routes + Express 辅助服务 | **Express 5 统一 REST API**（参照 waoowaoo 的 Express 用法） |
| 任务队列 | BullMQ + Redis + Bull Board | **BullMQ + Redis + Bull Board**（同款） |
| 数据库 | Prisma + MySQL（含 SQLite schema） | **Prisma + MySQL**（同款；单机可 SQLite） |
| 存储 | COS + S3 双 SDK + sharp | **本地 FS + COS/S3 双 SDK + sharp**（SDK 同款） |
| 部署 | Docker Compose | **Docker Compose 全栈**（前端/后端/AI/DB/队列/Milvus/ComfyUI） |

> 共同点：TypeScript（前端/后端）、BullMQ、sharp、Docker 部署、guards 工程体系。
> 九尾狐是**Vue 轻前端 + 重 AI 编排 + 本地算力 + 向量记忆**的架构，waoowaoo 是**React 全栈 + 云端算力**。差异点：前端形态（Vue SPA vs Next）、AI 编排（Python LangChain 独立服务 vs Vercel AI SDK）、记忆/向量（Milvus vs 无）、本地算力（ComfyUI vs fal.ai）。其余（后端/任务/DB/存储/工程化）参照 waoowaoo。

---

## 1. 前端层（Vue 3 SPA）

### 1.0 前端策略（决策：功能自研 + UI/交互对齐 Toonflow）

> **决策（2026-08-19）**：九尾狐前端**功能自研**（Vue 3，见 §1.1），但**视觉与交互设计先完全对齐 Toonflow**——以 Toonflow 实际界面为 UI/UX 基线（其构建产物在 `Toonflow-app-master/data/web`，可直接运行查看；界面截图见其 `docs/screenshot/1-10.png`），减少设计试错、对齐短剧生产工具的行业习惯；后续再按九尾狐定位（本地 ComfyUI 算力 + 向量记忆）迭代差异化。

| 对齐项 | Toonflow 参考 | 九尾狐落地 |
|--------|--------------|-----------|
| 整体视觉 | 深色影视工作台、高信息密度 | Vue 3 + Element Plus 暗色主题实现同款气质 |
| 登录/项目 | 登录页 + 项目工作台（剧目列表/进度） | 04 文档页面结构不变，视觉按 Toonflow 风格 |
| Agent 对话 | ScriptAgent / ProductionAgent 流式对话面板（reasoning / 文本分块展示） | 前端流式渲染（WebSocket/SSE），交互对齐 |
| 工作台 | 无限画布生产工作台（节点 + 连线自由编排） | §1.4 预留数据模型，交互参考 |
| 设置中心 | 供应商配置 / 模型映射 / 技能在线编辑 / 记忆管理 分组 | 设置页按此信息架构组织（含 §2.5 技能管理） |
| 编辑器 | 剧本 / 分镜结构化编辑体验 | tiptap + 分镜表格，交互对齐 |

### 1.1 已决策（用户指定）

| 项 | 选型 | 说明 |
|----|------|------|
| 框架 | **Vue 3 + TypeScript**（`<script setup>` 组合式 API） | 纯 SPA，以 Web 形式向用户展示，不采用 Next.js |
| 构建工具 | **Vite** | Vue SPA 标配，HMR 快，产物为静态资源可 Docker 化部署 |
| 部署形态 | 构建产物 → Nginx/Caddy 静态托管 + 反向代理 | 与后端同容器编排（见 §6） |

### 1.2 生态选型（定案）

| 项 | 选型 | 说明 |
|----|------|------|
| 路由 | **Vue Router 4** | SPA 路由 |
| 全局状态 | **Pinia** | 轻量状态（工作台/编辑器/画布），Vue 官方推荐 |
| 服务端状态 | **@tanstack/vue-query** | API 缓存、轮询、乐观更新（任务状态、生成进度） |
| UI 组件库 | **Element Plus**（或 Naive UI） | Vue 生态最主流，暗色模式/表单/表格齐全；备选 Naive UI（TS 友好） |
| 原子样式 | **Tailwind CSS**（可选） | 自定义视觉细节时使用 |
| 富文本剧本编辑 | **@tiptap/vue-3** | 结构化剧本（场景/对白/动作块） |
| 拖拽 | **vuedraggable**（SortableJS） | 分镜/素材排序、分场排序 |
| 图标 | **lucide-vue-next** / @element-plus/icons-vue | |
| 校验 | **zod** | 前后端共享 Schema（Vue 表单校验 + Express 入参校验） |
| 实时通信 | **WebSocket**（原生/封装） | 任务进度、SSE 流式（AI 生成过程） |
| 文件下载 | file-saver + jszip | 素材批量导出 |

### 1.3 富媒体与预览

| 项 | 选型 | 说明 |
|----|------|------|
| 图片/视频预览 | 组件库预览 + 自定义 lightbox | 分镜图、生成视频片段 |
| 音视频播放 | 原生 `<video>/<audio>` + 播放器封装 | TTS 试听、成片预览 |
| 画布/白板（规划） | 见 §1.4 | 本期不实现 |

### 1.4 无限画布（规划，暂不实现）

- **@vue-flow/core（Vue Flow）为第一候选**——Toonflow 无限画布的实证方案（已在其 data/web 产物中确认：`nodeTypes`/`defaultEdgeOptions`/`fitView`/`MarkerType`/`applyNodeChanges`/`screenToFlowCoordinate`，背景网格与缩放控件自绘，未用官方附加包），且与「UI 对齐 Toonflow」决策一致，交互可 1:1 对照。
- 备选：**LogicFlow**（滴滴开源，Vue 支持）：节点 + 连线，适合镜头关系图/流程画布；自研 Canvas 画布（Pinia 管理节点数据）作为兜底。
- 本期不实现，仅预留数据模型（画布节点/连线可序列化存储）

> 交互基线：参考 Toonflow 的无限画布生产工作台（节点自由编排、回溯、并行生产），实现时对齐其交互（见 §1.0）。其画布数据模型见 07 文档附录——`o_agentWorkData` 按集存 FlowData JSON，节点经 `flowId` 关联资产/分镜业务数据。

---

## 2. AI 编排层（Python LangChain 架构）

### 2.1 已决策（用户指定）

| 项 | 选型 |
|----|------|
| AI 编排框架 | **Python `langchain`**（langchain-core / langchain-openai / langchain-milvus 等） |
| 多步工作流 | **LangGraph**（剧本→拆镜→资产提示词→生成任务的 Agent 编排） |
| 结构化输出 | **Pydantic v2**（`with_structured_output` / OutputParser） |
| 运行形态 | **独立 Python 服务（FastAPI）**，与 Express 后端通过内部 HTTP API 协作 |

> 决策背景：与用户的 LangChain 学习路径（`E:\langchainLearn`，Python 版）保持一致；Python 生态对 ComfyUI 对接、图像/视频处理、Milvus 向量检索也更友好。**不使用 JS 版 LangChain.js**。

### 2.2 建议补全

| 项 | 选型 | 说明 |
|----|------|------|
| 核心包 | `langchain`、`langchain-core`、`langchain-openai`、`langgraph`、`langchain-milvus` | 基础 + OpenAI 兼容模型 + 图工作流 + Milvus 向量存储 |
| 结构化输出 | **Pydantic v2**（模型定义/校验） | 剧本/分镜/资产 JSON 结构化返回；schema 在 AI 服务内维护 |
| 配置管理 | pydantic-settings + .env | 模型 key、ComfyUI 地址、Milvus 连接等 |
| 提示词管理 | LangChain Prompt Templates + 提示词版本管理 | 对应 waoowaoo 的 prompt-i18n / prompt-json-canary 思路 |
| 与 Provider 层对接 | LangChain Tool（工具调用） | 将「ComfyUI 生成任务」「云端图像/视频 API」封装为 Tool，供 Agent 调用 |
| 检索增强（RAG） | **LangChain + Milvus** | 素材库语义检索、角色一致性知识召回、剧本检索（见 §2.4） |
| 能力配置中心 | 沿用 05-AI-Provider-Design 的 capability → provider 路由 | LangChain 层只面向统一接口，Provider 路由在服务层 |

### 2.3 与后端 / Provider 的边界（混合架构）

```
前端（Vue 3 SPA）
   │  REST + WebSocket / SSE
   ▼
Express 5 后端（业务/任务/存储，参照 waoowaoo）
   │  内部 HTTP API（/ai/*）——上下文传入、结果回传
   ▼
Python AI 服务（FastAPI + LangChain/LangGraph）
   │  · Prompt 构造 · 工具选择 · Pydantic 结果解析
   │  · 向量检索（Milvus）· 记忆读写
   ▼
Provider 路由层（capability → primary/fallback，见 05 文档）
   ▼
  ├── 文本 Provider（云端 LLM / 本地 Ollama）
  ├── 图像 Provider（云端 API / ComfyUI）
  ├── 视频 Provider（云端 API / ComfyUI）
  └── TTS/音乐 Provider
```

> **数据边界（MVP）**：AI 服务为**无状态编排 + 向量记忆**——结构化上下文（剧本/分镜/角色卡）由 Express 通过内部 API 传入，生成结果由 Express 落库（Prisma 管理业务数据）；**向量数据（embedding）由 AI 服务写入 Milvus**，业务元数据与向量通过外部 ID 关联，避免双 ORM 维护。

### 2.4 记忆与向量数据库（Milvus，用户指定）

**定位**：Milvus 承载九尾狐的**记忆与语义检索**能力，是区别于 waoowaoo 的关键差异化组件。

| 场景 | 说明 | Milvus Collection 建议 |
|------|------|------------------------|
| 素材语义检索 | 按语义搜图/搜片段（如"雨天街角的女主镜头"） | `asset_embeddings` |
| 角色一致性知识召回 | 生成前召回角色形象/音色等关键设定，注入 Prompt | `character_knowledge` |
| 剧本语义检索 | 跨集/跨场检索对白与情节（续写/改写时取上下文） | `script_embeddings` |
| 项目记忆 | 创作过程中产生的决策记忆（风格偏好、已选方案），供后续生成引用 | `project_memory` |
| 风格检索 | 全局风格参考图/风格描述向量化，生成时召回 | `style_embeddings` |

**技术要点**：

| 项 | 选型 | 说明 |
|----|------|------|
| 向量库 | **Milvus**（standalone 模式，Docker 部署） | 开源分布式向量数据库，LangChain 官方支持（`langchain-milvus`） |
| 开发模式 | **Milvus Lite**（单文件，无容器） | 本地开发/单机 MVP 可省容器资源 |
| 接入方式 | `langchain-milvus` Milvus VectorStore | 与 LangChain RAG / Retriever 无缝集成 |
| Embedding 模型 | 云端 LLM embedding API 或本地 embedding 模型 | 与 Provider 路由一致，可配置 |
| 数据生命周期 | 素材/角色/剧本删除或版本废弃时同步清理向量 | 与 Express 业务写入协同（外部 ID 关联） |
| 部署 | `milvusdb/milvus` 容器（standalone） | 见 §6 Docker Compose |

### 2.5 技能库与在线编辑（决策：保留 Toonflow skills 能力）

> **决策（2026-08-19）**：九尾狐保留 Toonflow 的「Skill 文件化配置 + 在线编辑调优」能力——Agent 核心提示词外化为 Markdown 技能文件，用户在设置中心直接编辑，**保存后即时生效，无需改代码、无需重启**。
> 参考实现：Toonflow `setting/skillManagement` 路由（getSkillList / getSkillContent / saveSkillContent）与 `utils/agent/skillsTools.ts`（parseFrontmatter / scanSkills / useSkill，详见 07 文档 §5）。

| 项 | 设计 |
|----|------|
| 技能库位置 | 服务端 `data/skills/`（沿用 Toonflow 结构：`story_skills/` 叙事类型、`art_skills/` 画风、`production_skills/` 通用技法 + 根级 `script_*`/`production_*` 主技能），与代码仓库分离便于运行期编辑 |
| 技能文件格式 | YAML frontmatter（name / description / metaData）+ 表格化正文（约束列+提示词列两栏）——沿用 Toonflow 规范 |
| 编辑 API（Express） | `GET /api/skills`（技能树）/ `GET /api/skills/content`（读单文件）/ `POST /api/skills/save`（保存）；保存时 frontmatter 校验 + 自动备份（版本化，可回滚） |
| AI 服务加载（FastAPI） | LangGraph 节点经内部 HTTP 拉取技能内容（或共享文件卷）；**每次会话运行时读取**（按内容 hash 缓存），实现"保存即生效" |
| 技能注入 | LangChain Tool（`read_skill_file` / `activate_skill`）或直接拼入 system prompt；技能内容结构用 Pydantic 校验 |
| 前端（设置页） | 设置中心新增「技能管理」：左侧技能树（叙事类型 / 画风 / 制作技法）、右侧 Markdown 编辑器（frontmatter 字段校验 + 语法高亮）、保存 / 预览 / 回滚、样图 `images/` 上传（复用静态资源机制） |
| 安全 | 技能文件路径白名单（禁止 `../` 穿越，参照 Toonflow `isPathInside`）；`/skills` 静态路由仅放行图片文件 |

> 与 Milvus 记忆协同：技能编辑属「内容配置」不进入向量库；角色/画风等设定类技能可同时维护结构化版本，供一致性召回（见 §2.4 `character_knowledge` / `style_embeddings`）。

---

## 3. 后端服务层（参照 waoowaoo）

### 3.1 后端框架（定版）

| 项 | 选型 | 说明 |
|----|------|------|
| 后端框架 | **Express 5** | 与 waoowaoo 同款（其 worker/board 服务即 Express 5）；承担业务/任务/存储，AI 编排下沉到独立 Python 服务 |
| 语言 | TypeScript（tsx 运行） | 与 Vue 前端同构，类型共享（zod schema 在 Vue/Express 双端复用；AI 服务内部用 Pydantic，两套 schema 由 /ai/* 内部 API 契约隔离） |
| API | Express REST + WebSocket | 任务提交/进度推送（waoowaoo 用 Next API Routes，本项目无 Next，由 Express 统一承担） |
| 进程模型 | 主服务 / worker 独立进程 / watchdog / board | 参照 waoowaoo `dev` 脚本：主服务 + worker + watchdog + Bull Board 并行启动 |

> 说明：waoowaoo 的 API 主体在 Next.js，本项目前端定为 Vue SPA，因此 REST API 全部收敛到 Express 5（与 waoowaoo 的 Express 辅助服务同一框架，迁移/参考成本最低）。

### 3.2 任务队列（参照 waoowaoo，同款）

| 项 | 选型 | 说明 |
|----|------|------|
| 队列 | **BullMQ + Redis（ioredis）** | 异步生成任务（图像/视频/TTS），版本参考 waoowaoo：bullmq ^5 + ioredis ^5 |
| 监控 | **@bull-board/express** | 任务看板，可视化管理 |
| Worker | 独立 worker 进程（tsx watch） | 同 waoowaoo `dev:worker` 模式 |
| 任务模型 | 沿用 05 文档 Task 状态机 | queued → running → succeeded/failed → adopted/discarded |
| 批量任务 | 父任务 + 子任务 | 批量生成故事板/视频，独立重试 |

### 3.3 数据库（参照 waoowaoo）

| 项 | 选型 | 说明 |
|----|------|------|
| ORM | **Prisma**（^6） | 同 waoowaoo；postinstall 自动 generate |
| 数据库 | **MySQL（mysql2）为主**；单机模式可用 **SQLite** | waoowaoo 双 schema（schema.prisma + schema.sqlit.prisma），九尾狐沿用此双模式 |
| 数据模型 | 剧目/剧本/分镜/镜头/角色卡/场景卡/素材/任务 | 作者字段预留多用户扩展（见 02 文档） |
| 与 Milvus 关系 | 业务元数据存 MySQL，向量存 Milvus | 通过业务对象 ID（如 assetId/characterId）关联，见 §2.4 |

### 3.4 存储与媒体（参照 waoowaoo）

| 项 | 选型 | 说明 |
|----|------|------|
| 素材存储 | 本地文件系统为主（Agent 同机） | 大文件默认本地 |
| 对象存储 | **COS（cos-nodejs-sdk-v5）+ S3（@aws-sdk/client-s3）双 SDK** | 同 waoowaoo，配置可切换 |
| 图像处理 | **sharp** | 缩略图/水印/格式转换（同 waoowaoo） |
| 媒体 URL 规范 | 统一内外部 URL 契约 | 借鉴 waoowaoo image-urls-contract / media-normalization 思路，素材引用必须规范化 |

### 3.5 认证授权

| 项 | 选型 | 说明 |
|----|------|------|
| MVP | **JWT + bcryptjs（本地账号）** | 单人优先；bcryptjs 与 waoowaoo 同款 |
| 扩展 | Auth.js / 自定义 | 预留多用户协作（waoowaoo 用 NextAuth，Next 专属；SPA 不沿用） |
| 凭据管理 | API Key 加密存储、服务端代理调用 | 见 05 文档 §6.2 |

---

## 4. 本地 Agent 层（ComfyUI）

沿用现有 05 文档设计，补全工程选型（已核对本地环境 `H:\ComfyUI\ComfyUI-V18.1`）：

| 项 | 选型 | 说明 |
|----|------|------|
| 生成引擎 | **ComfyUI**（http://localhost:8188） | 图像/视频统一执行引擎；本地 V18.1 已部署 |
| 对接方式 | HTTP API：`/prompt` 提交 + 轮询/WebSocket 状态 | 工作流 JSON 注入参数 |
| 客户端封装 | 自研轻量 ComfyUI 客户端（或 comfyui-client 社区库） | 统一任务封装、错误处理 |
| 工作流模板 | 本地已有 12 个模板：GPT-IMAGE / FLUX2-Klein(图片编辑) / LTX2.3 / DasiwaV9 / Z-image / Wan2.2 系列(图生视频/Remix/动作迁移) / SteadyDancer / infinitetalk(数字人) 等 | 对应九尾狐「角色图/场景图/分镜图/图生视频/图片编辑」场景，模板参数化（见 05 文档 §5.3） |
| 一致性 | **IPAdapter + 参考图 + 种子复用**（本地已装 comfyui_ipadapter_plus + Impact Pack） | 角色/场景/风格一致性；input/ 已有 CH-01~04 多视角角色图实战产物 |
| Agent 通信 | HTTP + WebSocket + 心跳 | 服务层感知在线状态、任务下发 |
| 并发 | 按显存配置最大并发 | 队列侧限流 |
| 状态展示 | 前端需体现 Agent 在线/离线/GPU 显存 | ComfyUI 未启动时任务排队或提示启动（交互见 04 文档） |

---

## 5. 工程化与质量（参照 waoowaoo，同款体系）

| 项 | 选型 | waoowaoo 对应 |
|----|------|----------------|
| 代码规范 | ESLint 9 + TypeScript strict（前端/后端）；ruff + mypy（Python） | 同 |
| Git Hooks | **Husky**（commit/push 前校验） | 同（prepare: husky） |
| 运行工具 | **tsx**（worker/watchdog/脚本）、concurrently（并行进程）、cross-env | 同（dev 脚本模式） |
| 测试 | **Vitest**（unit/integration 分级目录）+ 路由覆盖检查 | 同（tests/ 分级） |
| API 契约守卫 | API route contract guard（参数/返回 schema 校验） | check:api-handler |
| 配置守卫 | 禁止硬编码模型能力/价格，统一能力目录 | capability-catalog / pricing-catalog / model-config-contract |
| 媒体契约守卫 | 素材 URL 统一规范 + 引用完整性检查 | image-urls-contract / media-normalization / media-backfill |
| 任务状态守卫 | 禁止轮询/同步兜底，统一任务状态机 | no-polling / task-target-states / no-server-mirror-state |
| 日志规范 | 语义化日志 + 禁止裸 console | check-log-semantic / check-no-console |
| 代码质量 | 文件行数上限、禁止重复 endpoint、变更测试影响检查 | file-line-count / no-duplicate-endpoint / changed-test-impact |
| Python 侧工程 | **uv / poetry + ruff + mypy + pytest** | AI 服务独立质量门槛（语言不同，工具链独立） |
| 清理工具 | rimraf | 同 |

> guards 体系是 waoowaoo 最值得照搬的工程资产：用脚本把架构约束变成可执行检查（CI/git hook 触发），防止架构退化。九尾狐按上表逐步引入。

---

## 6. 部署（Docker 全栈）

### 6.1 Docker Compose 服务编排（MVP 单机）

```
docker-compose.yml 服务清单：
┌──────────────────────── 用户本机 ────────────────────────┐
│  nginx/caddy    前端静态资源（Vue 构建产物）+ 反向代理      │
│  web-frontend   前端（可选独立容器，或并入 nginx）          │
│  backend        Express 5（业务 + 任务队列 + 存储）         │
│  ai-service     FastAPI + Python LangChain/LangGraph       │
│  mysql          Prisma 业务库（可选 SQLite 省容器）        │
│  redis          BullMQ 队列                                │
│  etcd + minio   Milvus 依赖（standalone 模式元数据/存储）   │
│  milvus         Milvus 向量数据库（standalone）            │
│  comfyui        （GPU 容器，可选独立宿主机，镜像自备）     │
└──────────────────────────────────────────────────────────┘
```

**服务依赖关系**：

```
前端(Vue) ──HTTP/WS──> backend(Express) ──HTTP──> ai-service(FastAPI)
                              │                        │
                              ├──> mysql/redis         ├──> milvus ←── etcd/minio
                              └──> comfyui(本地 Agent) │
```

### 6.2 启动方式

| 模式 | 命令 | 说明 |
|------|------|------|
| 全栈 Docker | `docker compose up -d` | 前端/后端/AI/DB/队列/Milvus 全容器化 |
| 开发模式 | 前端 `npm run dev`（Vite）+ 后端 tsx + AI 服务 uvicorn + `docker compose up mysql redis etcd minio milvus -d` | 仅基础设施容器化，业务代码热更新 |
| ComfyUI | 独立部署在本地 GPU 机器（`H:\ComfyUI\ComfyUI-V18.1`），或 GPU 容器 | 与主栈分离，通过地址/心跳接入 |

### 6.3 扩展

- 前端静态产物可部署云服务器（CloudStudio / COS / Nginx）
- Agent 保持本地 GPU 机器（ComfyUI 需要显存）
- 后续多用户：PostgreSQL + 对象存储 + 认证升级
- Milvus 集群化（分布式模式）为后续大规模素材检索预留

---

## 7. 待定项（需后续确认）

| 项 | 候选 | 建议 |
|----|------|------|
| 前端 UI 组件库 | Element Plus / Naive UI | 倾向 **Element Plus**（Vue 生态最主流、暗色模式齐全） |
| Embedding 模型 | 云端 embedding API / 本地模型 | MVP 用云端（随 Provider 配置），本地化可后续切换 |
| LLM 首选 | 云端（通义/智谱/GPT/Claude）或本地 Ollama | MVP 云端起步，ComfyUI 走本地 |
| i18n | 本期不做 / vue-i18n | 参考 waoowaoo 有中英双语，可后置 |
| 成片合成 | Remotion（React 专属）/ FFmpeg / 预留导出 | 本期不做，预留；Vue 生态可考虑 FFmpeg 服务端合成 |
| 无限画布 | LogicFlow / 自研 Canvas | 本期不做，预留数据模型 |

> 已定版：前端 **Vue 3 + Vite**；AI 编排 **Python LangChain + LangGraph（独立 FastAPI 服务，Pydantic 结构化输出）**；记忆/向量 **Milvus（standalone，Docker）**；后端 **Express 5**、任务队列 **BullMQ + Redis + Bull Board**、数据库 **Prisma + MySQL（可 SQLite）**、存储 **本地 FS + COS/S3 双 SDK + sharp**、部署 **Docker Compose 全栈**、图像/视频 **本地 ComfyUI**、工程化 **ESLint + Husky + Vitest + guards 体系**。

---

## 8. 一页速览

```
九尾狐 AI 工作台
├── 前端     Vue 3 + Vite + TS + Element Plus + Pinia + @tanstack/vue-query
│            Vue Router · TipTap(剧本) · vuedraggable(拖拽) · WebSocket/SSE
├── AI 层    Python LangChain + LangGraph（独立 FastAPI 服务）
│            Pydantic 结构化输出 + Tool 封装（ComfyUI/云端）
│            技能库 data/skills + 设置中心在线编辑（保存即生效，见 §2.5）
├── 记忆     Milvus（向量库，standalone）· langchain-milvus · RAG/一致性召回
├── 后端     Express 5(TS) · REST + WebSocket · BullMQ+Redis+Bull Board
│            Prisma + MySQL(单机可 SQLite) · bcryptjs(JWT)
├── 存储     本地文件系统 + COS/S3 双 SDK · sharp 图像处理 · 媒体 URL 契约
├── 本地算力 ComfyUI(图像/视频/图片编辑/数字人) · 工作流模板 + IPAdapter 一致性
├── 部署     Docker Compose 全栈（nginx + backend + ai-service + mysql + redis + etcd/minio + milvus + comfyui）
└── 质量     ESLint+Husky+Vitest · guards 体系(API契约/能力目录/媒体契约/任务状态)
```

---

*关联文档：00-Overview / 01-Product-Requirements / 02-Architecture / 03-User-Flow / 04-Pages-Structure / 05-AI-Provider-Design*
