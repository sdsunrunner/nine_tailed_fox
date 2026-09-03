# 本仓库 skill vs 官方 h3-prompt-writing 对比

本仓库的 `SKILL.md`（导演化融合版）与 `official/h3-prompt-writing/`（官方原样收录）同源同目标，但侧重不同。本仓库版以官方字段规范为骨架，叠加了导演思维与连续性框架。

## 一句话对比

| | 本仓库 SKILL.md（升级版） | 官方 h3-prompt-writing |
|---|---|---|
| 定位 | 导演 + 工程师 | 纯工程师 |
| 核心强项 | 镜头语言、情绪弧线、连续性 | 字段精确、格式规范、标签体系 |
| 输出骨架 | 官方三字段 + 导演层 | 官方三字段 / 六段式 |
| 语言 | 中文说明 + 英文提示词 | 纯英文 |

## 模式覆盖

| 模式 | 本仓库版 | 官方版 |
|------|:---:|:---:|
| T2VA | ✅ | ✅ |
| I2VA | ✅ | ✅ |
| FL2VA | ✅ | ✅ |
| L2VA | ✅ | ✅ |
| Ref2VA | ✅ | ✅ |

两套都覆盖官方全部五种模式。

## 输出结构对比

| 维度 | 本仓库版 | 官方版 |
|------|----------|--------|
| 基础模式骨架 | `integrated_multimodal_description` / `overall_soundscape` / `non_diegetic_music` | 同左 |
| Ref2VA 骨架 | 六段式（subject_definitions → summary → retention_analysis → detailed_description → 声音两字段） | 同左 |
| 镜头标记 | `[Shot 1]` 无时间戳；`[Shot N] At 00:MM.SSS` | 同左 |
| 运镜 | 类型 + 幅度 + 速度 + **导演动机** | 类型 + 幅度 + 速度 |
| 说话人 | `(S1)` + `<d>[语言] 原文</d>` | 同左 |
| 画外音 | `lips remain completely closed` | 同左 |
| 屏幕文字 | 双引号保留原语言 | 同左 |
| 关键帧对齐语句 | 与官方一致，三字段对齐语句全收录 | 规范来源 |

## 差异重点

### 本仓库版独有的（导演层）
- **导演四问**：高概念 / 目标情绪 / 情绪弧线，先定方向再拆镜头
- **景别 = 镜头任务**：景别表 + "远→近聚焦、近→远揭示"的剪辑逻辑
- **运镜动机**：每种运镜标注导演意图（推=逼近、拉=疏离、跟=陪伴、摇=环顾）
- **机位语法**：180° 轴线、视线匹配、正反打
- **镜头衔接四法**：动作衔接、匹配剪辑、声音先入（J-cut）、静音呼吸
- **连续性六维自检表**：身份/空间/动作/光线/色调/时间 + 逐条对策
- **高频翻车对策**：人脸漂移、物体消失、方向反转、光线跳变

### 官方版独有的（工程层，本仓库版已吸收为主骨架）
- `retention_analysis` 关系标记体系（fully_preserved / attribute_transfer / weak_reference 等）
- `summary` 任务类型前缀（keyframe completion / video editing / video continuation / audio reuse / audio reference）
- `<Subject N>` / `<Picture N>` / `<Video N>` / `<Audio N>` 四类标签的定义与配对规则
- 运镜三要素（幅度/速度）的英文表达规范
- 六段式完整案例（base-en.txt / ref-en.txt）

## 适用场景

| 场景 | 推荐用 |
|------|--------|
| 想拍出有电影感的片子，需要镜头设计和情绪节奏 | 本仓库版 |
| 要严格对齐 H3 API 字段，做工程化/批量提示词 | 官方版 |
| Ref2VA 复杂多参考，需要 retention_analysis 精确标记 | 官方版（或本仓库版 + 官方 ref-en.txt 查细节） |
| 拍一条 15 秒短片，既要镜头感又要字段正确 | 本仓库版 |

## 怎么配合使用

1. **日常出片**：用本仓库 `SKILL.md`，三字段骨架 + 导演层，直接产出可跑的提示词
2. **复杂参考**：Ref2VA 参考多、关系复杂时，翻 `official/h3-prompt-writing/references/ref-en.txt` 查标签与 retention 规则
3. **格式核对**：吃不准 `[Shot N]` 时间戳、对白标记、对齐语句时，以 `official/h3-prompt-writing/references/base-en.txt` 为准
4. **模板与案例**：本仓库 `prompts/`、`examples/` 是中文导演化的配套素材，官方 references 是英文工程规范，互补使用
