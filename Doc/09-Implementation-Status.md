# 09 · 实现进度与运行手册

> nine_tailed_fox — 从设计到落地的完整实现记录、架构、命令与验证

文档版本：v1.0　｜　最后更新：2026-08-19　｜　对应代码：`apps/`（pnpm monorepo）

---

## 1. 总体架构（已实现）

```
┌─ apps/web ── Vue 3 + Vite + Vue Flow + Element Plus（深色影视工作台）
│   页面：工作台(无限画布) / 素材库(语义搜索) / 技能(在线编辑) / 设置(热生效)
├─ apps/server ── Express 5 + Prisma(SQLite) + zod（端口 3000）
│   Provider 管理器(manager.ts)：按类型切换 ComfyUI 工作流，配置热更新
│   /oss 静态服务（生成素材）
├─ apps/ai ── Python FastAPI + LangChain + DeepSeek（端口 8001）
│   能力：AI 拆镜（剧本→分镜卡）/ 向量记忆（embedding + chromadb）
│   本地模型：apps/ai/models/bge-small-zh-v1.5（中文 embedding）
└─ ComfyUI（8188）─ 图像(Z-image 系列) / 视频(Minimax H3) 真实生成
```

## 2. 已实现功能清单（全部实测通过）

| 模块 | 功能 | 验证 |
|---|---|---|
| M1 无限画布 | Vue Flow 节点编排、拉取/保存持久化、缩放/连线/多选删除 | ✅ |
| M2 资产节点 | 角色/场景/道具卡、创建/编辑/删除、生成任务+轮询 | ✅ |
| M3 真实出图 | ComfyUI 按类型切换工作流、图片回显节点 | ✅ 26s/3072² 等 |
| 剧本管理 | 集管理（新建/切换）、剧本抽屉编辑保存 | ✅ |
| 分镜卡 | 序号/三段式提示词模板/分镜图（竖屏 9:16）/视频描述 | ✅ 30s/1440×2560 |
| 视频生成 | 分镜图→Minimax H3 图生视频、节点内播放 | ✅ ~4min/864×480 |
| 批量生成 | 一键批量出图/出视频（自动跳过已完成） | ✅ 3 分镜全通 |
| 素材库 | 集中浏览（资产/分镜/视频）、类型/项目筛选、预览 | ✅ |
| 语义搜索 | 向量记忆检索（生成自动写入） | ✅ 语义排序正确 |
| 设置页 | 工作流路径/ComfyUI 地址/DeepSeek Key，保存即热生效 | ✅ |
| 技能编辑 | 拆镜技能 Markdown 在线编辑，保存即生效 | ✅ |
| M4 AI 拆镜 | 剧本→LangChain+DeepSeek→分镜卡批量创建 | ✅（填 key 即用） |

## 2.1 交互调整阶段（2026-08-19 晚，已全部落地）

| 调整 | 说明 |
|---|---|
| 全局布局 | 左侧**可折叠边栏**（我的项目/技能/设置，折叠 200px↔56px，localStorage 持久化），所有页面共享 |
| 我的项目 | 卡片视图（概述/统计），点击进入项目工作台 |
| 项目工作台 | **四步 tab**：①小说 ②剧本 ③资产 ④分集视频（原分镜 tab 并入视频流程） |
| 新建项目 | 项目名称 + 项目概述（可选）+ 影片比例；视觉/导演手册移至小说页 |
| 小说页 | 视觉手册/导演手册选择栏（保存即项目级生效）+ 小说输入框下「🎬 开始制作」→ 确认框（分屏比例/视觉风格/导演风格）→ 保存参数 + AI 改编为第 1 集剧本 |
| 剧本页 | 主要角色（角色资产横排）+ 分集剧情（各集摘要卡片）+ 剧本编辑器 |
| 资产页 | 四分类 tab：角色/场景/道具/素材（素材=全量含视频） |
| 分集视频 | **两级**：第一级所有集卡片（分镜/资产/视频统计+剧情摘要）→ 第二级集详情（左侧本集资产贯穿到底部 + 详情 5:1〔描述/视频，无视频显示「立即生成」〕+ 底部本集分镜卡片横向滑动） |
| 画布定位 | **只做美术资产生产**：工具栏仅资产相关；素材库/资产页点击资产 → `/canvas?asset=id` 定位选中 |
| 资产绑定 | 资产与**集**绑定（episodeId），非分镜级（移除分镜关联资产 UI） |

## 3. 关键配置（.env 与设置页）

| 项 | 默认值 | 说明 |
|---|---|---|
| ComfyUI | http://127.0.0.1:8188 | 设置页可改 |
| 角色工作流 | 24 角色三视图设定集（Z-IMAGE 文生图） | CR Text 注入，1536² |
| 场景工作流 | 05 Z-image 超极速文生图 | CLIPTextEncode，1216×704 |
| 道具工作流 | 05 同上 | 1024² |
| 分镜工作流 | 05 同上 | 720×1280 竖屏 |
| 视频工作流 | 27 MinimaxH3 图生视频节点版 | 上传分镜图 + 运镜描述 |
| DeepSeek | 设置页填写 | AI 拆镜用（存 DB，不回显） |
| AI 服务 | http://127.0.0.1:8001 | 拆镜/记忆转发 |

> 配置优先级：DB（o_setting，设置页写入）> .env 默认值；保存即热生效无需重启。

## 4. 运行方式

```bash
# 前端（5173）
pnpm --filter @fox/web dev
# 后端（3000）
pnpm --filter @fox/server dev
# AI 服务（8001，conda langchain 环境）
cd apps/ai && conda run -n langchain python -m uvicorn main:app --port 8001
# ComfyUI（8188，独立）
cd H:\ComfyUI\ComfyUI-V18.1 && python\python.exe main.py
```

访问 http://localhost:5173（默认项目「铸剑」第 1 集画布）。

## 5. 技术要点与踩坑记录

- **ComfyUI 工作流提交**：workflow JSON → /prompt API 需处理 `control_after_generate`（seed 后的 randomize）、跳过前端辅助节点（PrimitiveNode/Note/MarkdownNote/FancyTimerNode，Primitive* 值内联）、兼容 VHS 对象格式 widgets
- **视频输出**：SaveVideo 的 mp4 在 history 的 `images` 字段（subfolder=video, animated=true）
- **embedding**：sentence-transformers 6.0 加载模型会挂起，改用 transformers 直接加载（mean pooling）；HF 权重走 `hf-mirror.com` + curl
- **向量库**：chromadb（本地持久化）替代 milvus-lite（网络下载不可用）
- **LangChain**：技能文本里的 JSON 花括号须转义 `{{}}`（模板变量解析）；FastAPI 用 `detail` 参数
- **已知坑**：pwsh 发中文 body 会变 `?`（测试用 Node/UTF-8）；tsx watch 不监听 .env 变更（改配置需重启或走设置页）

## 6. 待办与演进方向

| 项 | 说明 |
|---|---|
| 真实 DeepSeek Key | 设置页填写后 AI 改编/拆镜可用（小说→剧本→分镜全链路） |
| 素材生成时引用一致性 | 分镜图生成引用资产（IPAdapter/参考图） |
| TTS/配音/配乐 | 短剧成片音频环节 |
| 成片导出 | 视频片段拼接（FFmpeg 服务端合成） |
| 多用户 | 数据模型已预留作者字段 |
| 无限画布增强 | 节点自动布局、画布内联编辑 |

---

*关联文档：00-Overview / 02-Architecture / 06-Tech-Stack / 07-Toonflow-Architecture-Reference / 08-Workbench-Canvas-Design*
