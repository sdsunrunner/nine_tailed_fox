# 08 · 无限画布工作台设计（数据模型与 API）

> nine_tailed_fox — 画布节点自由编排的生产工作台：布局与业务数据分离、flowId 关联、任务异步化
>
> 文档版本：v0.1（设计草案）｜ 最后更新：2026-08-19
> 依据：Toonflow 无限画布实证（前端 @vue-flow/core + 后端 o_agentWorkData/flowId 模式，见 07 文档）+ 九尾狐技术栈（Vue 3 / Express 5 / Prisma / BullMQ / LangChain / Milvus / ComfyUI）

---

## 1. 目标与设计原则

1. **一集一张画布**：画布边界 = 集（episode），承载该集的剧本、资产、分镜、视频节点。
2. **布局与业务数据分离**（Toonflow 模式）：节点位置/尺寸/连线等布局存 JSON（Vue Flow 序列化）；业务数据（资产/分镜/视频）存结构化表，通过 **`flowId`** 关联——画布重排不碰业务表，业务生成不依赖画布。
3. **节点即任务入口**：节点上触发生成（资产图/分镜图/视频），异步任务（BullMQ）驱动，状态回写节点，WebSocket 推送。
4. **UI 对齐 Toonflow**：@vue-flow/core，深色影视工作台，交互可 1:1 对照（见 06 文档 §1.0/§1.4）。

## 2. 概念模型

### 2.1 节点类型

| 节点 | 业务实体 | 内容 | 生成能力 |
|------|---------|------|---------|
| 剧本节点 | Episode.script | 该集剧本文本（只读锚点） | — |
| 资产卡 | Asset | 角色/场景/道具设定图，支持**父子衍生**（主图 → 姿态/服化衍生图） | 资产图生成 |
| 分镜卡 | Storyboard | 镜头描述 + 分镜图 + 引用资产卡（连线） | 分镜图/视频生成 |
| 视频节点 | VideoClip | 分镜图 → 视频片段 | 图生视频 |

### 2.2 边类型

| 边 | 语义 |
|----|------|
| 引用边 | 分镜卡 → 资产卡（分镜图生成时注入一致性约束） |
| 衍生边 | 资产主图 → 衍生子图 |
| 顺序边 | 分镜卡按 index 顺序（可用边或表格字段表达） |

### 2.3 节点状态机

```
queued（排队）──► running（执行中）──► succeeded（成功）
      │                  │
      └──────────────────┴──► failed（失败）── 重试 ──► queued
                      （失败可携带 errorReason；用户可丢弃节点）
```

## 3. 数据模型（Prisma schema 草案）

```prisma
// ---- 画布：一集一张，布局 JSON ----
model FlowCanvas {
  id        Int      @id @default(autoincrement())
  projectId Int
  episodeId Int
  nodes     Json     // Vue Flow nodes 序列化（id/type/position/data.flowId）
  edges     Json     // Vue Flow edges 序列化（source/target/handle）
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([projectId, episodeId])
}

// ---- 资产卡（角色/场景/道具 + 父子衍生）----
model Asset {
  id        Int         @id @default(autoincrement())
  projectId Int
  flowId    String?     // 画布节点关联键（对齐 Toonflow）
  parentId  Int?        // 父资产 id（衍生图）；null = 主图
  type      String      // character | scene | prop
  name      String
  prompt    String?
  describe  String?
  filePath  String?
  state     NodeState   @default(QUEUED) // 生成状态
  errorReason String?
  createdAt DateTime    @default(now())
}

// ---- 分镜卡 ----
model Storyboard {
  id        Int         @id @default(autoincrement())
  projectId Int
  episodeId Int
  flowId    String?
  index     Int         // 顺序
  duration  Float?
  prompt    String?
  videoDesc String?
  filePath  String?     // 分镜图
  state     NodeState   @default(QUEUED)
  errorReason String?
  assetIds  Json        // 引用的资产卡 id（或独立关系表 StoryboardAsset）
}

// ---- 视频节点 ----
model VideoClip {
  id          Int        @id @default(autoincrement())
  storyboardId Int
  flowId      String?
  filePath    String?
  duration    Float?
  state       NodeState  @default(QUEUED)
  errorReason String?
}

enum NodeState { QUEUED RUNNING SUCCEEDED FAILED }
```

> 说明：① `flowId` 由前端在新建节点时生成（如 `uuid`），画布保存与业务行创建共享同一键；② 业务元数据存 MySQL（Prisma），**向量**（资产/角色一致性知识）由 AI 服务写 Milvus，经业务 id 关联（见 06 文档 §2.4）；③ 大文件（图/视频）存本地 FS/COS，表内仅存 `filePath`/URL。

## 4. API 设计

### 4.1 REST（Express 5，前缀 `/api`）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/projects/:pid/episodes/:eid/flow` | 拉整张画布：布局 + 节点业务数据 + 缩略图 URL（对齐 Toonflow getFlowData） |
| PUT | `/projects/:pid/episodes/:eid/flow` | 保存画布布局（nodes/edges JSON，全量快照） |
| POST | `/projects/:pid/episodes/:eid/flow/nodes/asset` | 新建资产节点（返回 flowId + 业务行） |
| POST | `/projects/:pid/episodes/:eid/flow/nodes/asset/:id/generate` | 触发资产图生成（入 BullMQ） |
| POST | `/projects/:pid/episodes/:eid/flow/nodes/storyboard/:id/generate-image` | 触发分镜图生成 |
| POST | `/projects/:pid/episodes/:eid/flow/nodes/storyboard/:id/generate-video` | 触发视频生成 |
| GET | `/projects/:pid/episodes/:eid/flow/nodes/:type/:id/state` | 节点状态（轮询兜底） |
| DELETE | `/projects/:pid/episodes/:eid/flow/nodes/:type/:id` | 删除节点（业务行 + 画布节点） |

### 4.2 WebSocket（`/ws/canvas`，按 projectId+episodeId 订阅）

| 事件（服务端→前端） | 载荷 | 说明 |
|---------------------|------|------|
| `node:state` | `{ flowId, state, errorReason? }` | 节点状态变更（BullMQ worker 完成后推送） |
| `node:result` | `{ flowId, src, params }` | 生成结果（缩略图/视频 URL + 生成参数回显） |

> 前端以 WS 为主、`GET .../state` 轮询为兜底（对齐九尾狐"任务状态守卫：禁止纯轮询/同步兜底"的 guards 约束）。

### 4.3 AI 服务协作（内部 HTTP，LangChain/FastAPI）

```
画布节点生成请求
  → Express 入 BullMQ（parent 任务 = 画布节点）
  → worker 调 AI 服务 /ai/*：
      · 资产图：提示词 = 技能(art_prompt) + 一致性约束（Milvus 召回角色/风格知识）
      · 分镜图：提示词 = 分镜描述 + 引用资产卡约束（IPAdapter 参考图）
      · 视频：  分镜图 → 图生视频（ComfyUI 工作流模板）
  → Provider 路由（本地 ComfyUI 主 / 云端备选）
  → 结果落库 + 写 Milvus 向量 + WS 推送 node:state/node:result
```

Agent（LangGraph）读写画布：AI 服务经内部 HTTP 调用 Express 的画布/业务接口（对齐 Toonflow 的 socket `getPlanData` 往返模式，九尾狐改为内部 HTTP 契约）。

## 5. 与 Toonflow 对照

| Toonflow | 九尾狐（本设计） | 差异/增强 |
|----------|-----------------|-----------|
| 前端 @vue-flow/core | 同（@vue-flow/core） | UI 1:1 对齐 |
| `o_agentWorkData` 整画布 JSON | `FlowCanvas.nodes/edges` JSON | 同模式；九尾狐拆得更细（节点表结构化） |
| `flowId` 关联业务行 | `Asset/Storyboard/VideoClip.flowId` | 同 |
| 资产父子（`o_assets.assetsId`） | `Asset.parentId` | 同 |
| `o_assets2Storyboard` 关系表 | `Storyboard.assetIds`（或关系表） | 二选一，MVP 用 Json 数组 |
| 前端轮询 `state` | **BullMQ + WS 推送** + 轮询兜底 | 九尾狐更强（实时推送 + 队列重试 + Board 监控） |
| 生成 = 同步插行 + 轮询 | 生成 = BullMQ 任务（父子/重试/并发限流） | 九尾狐工程化更强（见 06 §3.2） |
| 画布数据无向量检索 | 资产/角色知识入 Milvus 一致性召回 | 九尾狐差异化 |

## 6. MVP 范围与里程碑

| 阶段 | 内容 |
|------|------|
| M1 画布骨架 | FlowCanvas 表 + 拉取/保存 API + Vue Flow 渲染（节点自由摆放/连线/缩放平移自绘） |
| M2 资产节点 | 资产 CRUD + 父子衍生 + 资产图生成（ComfyUI）+ 状态推送 |
| M3 分镜/视频 | 分镜卡 + 引用边 + 分镜图/视频生成 + Milvus 一致性召回接入 |
| M4 集成 | Agent（LangGraph）写回画布（拆镜/改稿）、技能在线编辑联动（06 §2.5） |

---

*关联文档：02-Architecture / 06-Tech-Stack（§1.4、§2.5）/ 07-Toonflow-Architecture-Reference / 05-AI-Provider-Design*
