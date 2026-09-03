---
name: minimax-h3-prompt
description: 编写 MiniMax H3 的视频生成提示词（T2VA / I2VA / FL2VA / L2VA / Ref2VA）。当用户要在 ComfyUI 或海螺上写 H3 提示词、给视频生成写 prompt、或想让 H3 出某个场景的视频时使用。按 integrated_multimodal_description / overall_soundscape / non_diegetic_music 三字段输出，融合导演分镜与镜头语言。ComfyUI 里提示词用英文写。
---

# MiniMax H3 提示词

H3 是开源全模态视频生成模型：一次扩散同时出 24fps 视频 + 32kHz 立体声音频，最高 15 秒 / 2K（本地 768p）。提示词直接对应 H3 的真实输入字段；官方格式规范见本仓库 `official/h3-prompt-writing/`。

## 五模式速览

| 模式 | 做什么 | 关键 |
|------|--------|------|
| **T2VA** | 纯文本构建完整视听时间线 | 导演分镜决定一切 |
| **I2VA** | 首帧起步，向前发展 | `<Picture 1>` 占 0.00s，运动从它出发 |
| **FL2VA** | 首尾帧之间的连续路径 | 首帧→末帧，运动必须能插值 |
| **L2VA** | 推断开场，收敛到末帧 | 末帧锚定，倒推合理前态 |
| **Ref2VA** | 多模态参考生成 | 六段式输出，标签按序引用 |

## 先当导演，再写提示词

写之前回答三问，答案决定后面每个镜头：

1. **高概念**——一句话说清这条视频（"一瓶威士忌的诞生" vs "霓虹雨夜的复仇"）
2. **目标情绪**——观众看完记住什么感觉（高级感 / 压迫 / 温暖 / 酷）
3. **情绪弧线**——15 秒内起承转合，转折点在哪一秒

```
例：0-4s 建立氛围 → 4-10s 展开动作 → 10-13s 高潮 → 13-15s 余韵
```

不能服务弧线的镜头，砍掉。这就是导演和描写的区别：导演给每个镜头分配任务。

## 镜头语言

### 景别 = 镜头任务

| 景别 | 用途 |
|------|------|
| Extreme Wide / Establishing | 定场，交代环境与尺度 |
| Wide / Long | 人物与环境的关系 |
| Full | 完整动作，建立空间 |
| Medium | 对话、动作主体 |
| Close-Up | 情绪、细节 |
| Extreme Close-Up | 强调、符号、关键时刻 |

规则：开场用定场镜头建立世界，进入情绪用近景/特写；景别反差是剪辑冲击的来源；所有镜头停在中景 = 平铺直叙。

### 运镜 = 类型 + 幅度 + 速度 + 动机

官方要求写清三要素，导演层再加动机。写成自然英语句子，别堆标签。

| 运镜类型 | 导演动机 |
|------|------|
| Push In / Zoom In | 逼近、聚焦、心理压迫 |
| Pull Out / Zoom Out | 揭示环境、疏离、收尾 |
| Pan Left / Right | 扫视关系、追踪方向 |
| Truck Left / Right | 平移跟随 |
| Tilt Up / Down | 揭示高度与空间关系 |
| Arc Shot | 环绕揭示、掌控感 |
| Tracking Shot | 跟随运动主体 |
| Static Shot | 稳定、压抑、仪式感 |
| Shake Slightly / Strongly | 不安、纪实、紧张 |
| POV | 主体视角代入 |

幅度用 `with small amplitude` / `with large amplitude`，速度用 `at slow speed` / `at fast speed`（中幅常速可省略）：

```
The camera pushes in with small amplitude at slow speed toward the folded letter in her hands.
The camera pans right with large amplitude at fast speed, revealing the open doorway.
```

规则：一条视频选 1-2 种运镜语言用到底，风格统一。

### 机位、轴线、视线

- **180° 轴线**：对峙/对话机位守在两人连线同一侧，画面左右关系不翻转
- **视线匹配**：人物看画面外 → 下一镜给 TA 看的东西
- **正反打**：对话双方各占画面一侧，别双双居中

### 镜头衔接（让两镜"粘住"）

- **动作衔接**：在动作进行中切（转身/抬手到一半），隐藏剪辑点
- **匹配剪辑**：下一镜用相似构图 / 形状 / 运动接上一镜
- **声音先入（J-cut）**：下一镜头的声音比画面早半秒进入
- **静音呼吸**：高潮前抽空声音再爆发，冲击翻倍

## 提示词结构：三个核心字段

H3 的输入是三个字段，按固定顺序输出。这是所有基础模式的唯一骨架：

```
integrated_multimodal_description: ...   画面/动作/镜头/对白/画内音，沿时间线
overall_soundscape: ...                  环境音/物理动作音/非语言人声
non_diegetic_music: ...                  观众可闻的 BGM
```

### integrated_multimodal_description（主体）

沿时间线写，融合导演语言。规则：

- **镜头标记**：`[Shot 1]` 是第一镜，**不加时间戳**；后续镜头 `[Shot N] At 00:MM.SSS, the camera cuts to ...`。切镜动词用 `the camera cuts to` / `transitions to` / `changes to` / `switches to`。每镜必须引入新信息（主体/空间/状态/视角/时间）；只想变距离或角度就写运镜，别切镜
- **每镜开头**定风格 + 景别：`[Shot 1] Live-action, cinematic, a close-up frames ...`。风格常用 Cinematic / live-action / 2D-animated / 3D CG / claymation / watercolor / vintage film
- **画面三件套**：主体（身份/服装/位置）+ 环境（场景/道具/光线）+ 动作（做什么/反应）
- **运镜**：类型 + 幅度 + 速度 + 动机（见上表）
- **声音**：对白、歌唱、画内音效写在这里（带时间点）
- **连续性**：跨镜锁身份/空间/光线/色调（见自检表）

### overall_soundscape

1-4 句英文连续段落，概括全片环境音、物理动作音、非语言人声（风/雨/车流/脚步/布料/撞击/呼吸/笑喘）。对白、歌唱、BGM 不写这里。全片要求无声才用 N/A。

### non_diegetic_music

1-3 句：只写乐器、速度、节奏、动态变化。不写情绪词、不解释配乐功能。无 BGM 用 N/A。

```
non_diegetic_music: Sparse piano notes at a slow tempo, joined by sustained low
strings that gradually increase in volume before fading out.
```

### 对白与说话人

- 说话人用稳定 ID `(S1)` `(S2)`，多人齐说 `(S1,S2)`，跨镜保持同一 ID；不出声的角色不编号
- 首次出场时给出够建立身份的视听信息（年龄/性别/音色/语速/口音/是否在画面内）
- 对白/歌词原文放进 `<d>[语言] ...</d>`，逐字保留，不翻译：

```
The young woman with a quiet, breathy voice (S1) says: <d>[English] I get off at the next station.</d>
```

- 画外音：用 `says in an off-screen voiceover ... while his lips remain completely closed.`
- 对白跨镜：接点两端写 `<scenetrans>`，注明音频连续（`continues seamlessly across the cut`）
- 屏幕文字（招牌/字幕/霓虹）用英文双引号保留原语言：`A red neon sign reading "营业中" glows above the doorway.`

### 关键帧对齐（I2VA / FL2VA / L2VA）

对齐语句必须是提示词**第一行**，空一行再接三字段：

- **I2VA**：`For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.`
- **FL2VA**：`How the reference pictures align with the target video — Picture 1 (from Shot 1) aligns with the 0.00-second mark of the target video; Picture 2 (from Shot N) aligns with the S.SS-second mark of the target video.`
- **L2VA**：`How the reference pictures align with the target video — <Picture 1> (from [Shot N]) aligns with the S.SS-second mark of the target video.`

关键帧模式怎么写主体：

- **I2VA**：首帧锚点 → 动作起 → 连续发展 → 结果/反应。`<Picture 1>` 就是 0.00s 的真实首帧，从它的构图/主体/场景出发
- **FL2VA**：首帧状态 → 可见中间变化 → 差距渐小 → 末帧状态。一般用单镜，便于模型插值；末帧必须被最后一镜到达
- **L2VA**：合理前态 → 动作与过渡路径 → 末镜渐变收敛 → 末帧落定。`<Picture 1>` 属于末镜，不是第一镜

## 连续性：逐条锁死

每写完一版提示词，用这张表自检：

| 维度 | 检查什么 | 对策 |
|------|----------|------|
| 身份 | 脸/发型/服装/配饰跨镜头一致 | 锁参考图；文字写死特征；说话人 ID 跨镜统一 |
| 空间 | 物体相对位置、主角站位不跳变 | 时间线写明"始终在画面左侧" |
| 动作 | 跨镜头动作从上一镜结尾续接 | 镜头描述写"接上镜，推门而入" |
| 光线 | 光源方向跨镜头一致 | 明确"日光从左侧来" |
| 色调 | 同一场景调色统一 | 颜色词只在首镜定义，别逐镜乱改 |
| 时间 | 时序清楚，无无提示跳变 | 切镜时间递增；转场有理由 |

高频翻车点与对策：
- **人脸漂移** → Ref2VA 锁参考图，别靠纯文字
- **物体凭空消失** → 写进"必须持续出现"的镜头描述
- **方向反转** → 钉一句：`she stays on the left of frame throughout`
- **光线跳变** → 光源方向/色温只定义一次，后续引用

## Ref2VA 六段式

Ref2VA 用六个段按序输出：

```
subject_definitions    定义每个参考内容 + 标签
summary                [任务类型] + 目标视频摘要与参考关系
retention_analysis     每个参考的保留关系标记
detailed_description   按播放顺序逐镜描述（规则同三字段主体）
overall_soundscape     环境与物理声音
non_diegetic_music     观众可闻 BGM
```

标签体系（跨段语义一致）：
- `<Subject N>`——可复用的可见内容（人/物/场景/服装/风格/动作）
- `<Picture N>`——关键帧、首尾帧、分镜锚
- `<Video N>`——源视频、剪辑/续接/节奏结构来源
- `<Audio N>`——音频信号、音色/节奏参考

`summary` 前缀任务类型：`[reference generation]` / `[keyframe completion]` / `[video editing]` / `[video continuation]` / `[audio reuse]` / `[audio reference]`，多任务用 ` + ` 组合。

`retention_analysis` 关系标记：
- 视觉：`fully_preserved` / `partially_preserved` / `attribute_transfer` / `weak_reference`
- 音频：`fully_copy` / `partially_copy` / `reference` / `weak_reference`

规则：
- 一个参考管一件事；标签在提示词里要真正被引用
- **音频不能单独作为参考，必须搭配图像或视频**
- 参考顺序有语义，换顺序就是换请求
- 参考较多时，`res_multistep` + `beta`/`normal` 调度器优于 `simple`

详细格式与完整案例见 `official/h3-prompt-writing/references/ref-en.txt`。

## 情绪弧线与声音设计

- **情绪线驱动 BGM**：安静→紧张→爆发→余韵，别写"配乐"（在 non_diegetic_music 里落到乐器/速度/动态）
- **环境音是主角**：先写环境，再加音乐，最后决定要不要对白
- **先入音**：切镜前让下一场景的声音先进来
- **静音呼吸**：高潮前 1 秒抽空声音

## 基线参数（冒烟测试）

- 分辨率：0.4 MP（864×480，16:9），短边 768px 上限，取整到 32 的倍数
- 时长 5 秒 / 20 步
- 采样器 `res_multistep` + 调度器 `simple`
- 一条 5 秒约 124 帧（@24fps），正常

## 常用坑

- 提示词别只写"拍个 X 视频"，按三字段/六段式结构写
- 想要字幕/品牌文字时，用双引号写出原文和出现时间
- 批量出片会有废片，先 5 秒试跑再上长片
- 想控制角色一致 → 用 Ref2VA 给参考图，别指望纯文本描述锁脸

## 速查：导演一句话版

- 定场 → 建立 → 推进 → 高潮 → 收尾
- 远→近是聚焦，近→远是揭示
- 推是逼近，拉是疏离，跟是陪伴，摇是环顾
- 轴线别跨，方向别翻，光线别跳
- 静音呼吸，声音先入，动作中切
- 三字段定骨架，导演层填血肉

详见同目录 `prompts/` 模板集、`examples/` 案例、`official/` 官方规范。
