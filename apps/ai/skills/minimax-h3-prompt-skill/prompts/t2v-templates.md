# T2V 文生视频提示词模板

## 导演公式

与 SKILL.md 的导演四段式对应，写作顺序固定：

```
[DIRECTOR'S OVERVIEW]  一句话高概念 + 目标情绪 + 15s 情绪弧线
[SHOT LIST]            镜头表：time / shot size / action / camera / sound
[SOUND DESIGN]         环境音 → 音乐 → 对白/音效，带时间点
[CONTINUITY & LIMITS]  身份/空间/方向/光线锁定 + 禁止清单
```

写的时候按这个顺序走，别跳：

1. **先定弧线**（0-4s 什么情绪、4-8s、8-12s、12-15s 各是什么）
2. **再拆镜头**：每个镜头先定景别（在做什么），再定运镜（为什么动），最后补声音
3. **写完自检**：连续性六维（身份/空间/动作/光线/色调/时间）

## 完整导演示例（可直接改主体套用）

**高概念**：城市霓虹雨夜，一束光从高楼顶端落下，最终落在人物眼中。
**情绪弧线**：0-4s 静谧 → 4-9s 紧张积累 → 9-12s 爆发 → 12-15s 余韵。

```
[DIRECTOR'S OVERVIEW]
A neon-drenched rainy megacity at night. One shaft of light travels down
a skyscraper and lands on a lone figure below. Mood: quiet tension
building to one sharp release. Arc: calm → uneasy → burst → afterglow.

[SHOT LIST]
0-4s   ESTABLISHING   Rain-soaked skyline, single light falls   slow dolly-in    rain ambience, distant thunder
4-6s   FULL           The light lands on her, she turns         locked off       footsteps fade in, traffic muffled
6-9s   CLOSE-UP       Her eyes catch the light, breath fogs     slow push-in     music swells low
9-10s  (gap)          silence drop                              —                music stops
10-12s EXTREME CLOSE  The light ignites in her eyes             crash push       stinger hit
12-15s WIDE           She walks into the dark, light fades      pull back        rain returns, sparse piano

[SOUND DESIGN]
Rain and distant thunder throughout. Footsteps fade in at 5s.
Music: sparse piano 0-6s → low strings 6-9s → SILENCE 9-10s →
stinger at 10s → sparser piano at 12s.

[CONTINUITY & LIMITS]
She stays center-left of frame throughout. Rain direction constant
(from upper-left). Neon palette locked (magenta / cyan). Face unchanged.
No subtitles, no watermark, no cartoon rendering.
```

**导演注释**（这版为什么成立）：
- 景别递进 = 聚焦：大远景定场 → 全景建立 → 近景进入情绪 → 特写爆发
- 9-10s 抽空声音再砸下 = **静音呼吸**，高潮冲击翻倍
- "stays center-left" 钉住空间连续性；"rain direction constant" 锁光线连续性；色调只定义一次

## 模板 A：史诗级全景镜头（压力测试）

```
Wide bridge over a storm abyss, tiny figure, split sky (ember sunset vs starfield),
volumetric god-rays, cold/warm collision grade.
Ban text overlays and cartoon rendering.
```

导演注释：
- 这是**定场镜头**：大远景交代尺度（人只是背景里的小点），用"split sky"制造画面张力
- 冷/暖碰撞 = 色调冲突，也是情绪弧线的起点（后面的镜头要么强化它，要么反转它）
- 压力点：大场景构图、大气透视、史诗感是否会糊成 AI 汤；记得指定风声和波浪声

## 模板 B：奢侈品产品广告（配方书）

```
[SCENE]: {Product Name}, {material descriptor}, centered on a {background} surface.
The product rotates slowly, catching light on its {key feature}.
Macro detail of {specific detail} with shallow depth of field.

[CAMERA]: Slow orbital arc around the product, starting at eye level and
rising to a 45° overhead. Macro push into {detail}. Smooth, no sudden moves.

[LIGHTING]: Studio lighting — key light from 10 o'clock with soft diffusion,
rim light from behind at 4 o'clock creating {material} edge glow.

[COLOR]: Clean, premium — {palette}. Product colors must be accurate.

[AUDIO]: Subtle atmospheric pad. Soft whoosh on camera moves.
A gentle chime as light catches the product.
```

导演注释：
- 运镜动机：**弧线轨道 = 环绕揭示**，从平视升到俯拍 = 从"平实"到"俯视掌控"，制造高级感
- 景别递进：全景建立 → 推特写，是产品广告的标准语法
- 光线一次性定义（10 点钟主光 + 4 点钟轮廓光），后面不换 = 光线连续性
- 声音卡点：每次"光打在关键位置"就一声 chime = 视听同步

## 模板 C：角色出场（景别 + 连续性标注）

```
[DIRECTOR'S OVERVIEW]
Cyberpunk alley at night, neon reflections on wet concrete.
A female warrior with cyan implants walks toward camera.
Mood: intimidation. Arc: approach → pause → ignite.

[SHOT LIST]
0-4s   WIDE      She walks toward camera, rain, neon bokeh    slow dolly-in   rain, distant hovercraft
4-8s   MEDIUM    She stops, glances up, coat flicked by wind  handheld slight footsteps, fabric
8-12s  CLOSE-UP  Eyes ignite with cyan light                  quick push-in   low synth swell

[CONTINUITY & LIMITS]
Trench coat, cyan implants, wet-hair look locked across shots.
She stays on the left of frame. Neon source above-left, constant.
No subtitles, no watermark, no cartoon, realistic CG film look.
```

导演注释：
- 三个镜头 = 标准"建立 → 动作 → 反应"推进，景别由中到近逐步逼近角色 = 压迫感
- 身份连续性：服装 + 植入体 + 湿发造型写死，跨镜不变
- 运镜风格统一：全程以推进为主，中间 handheld 微晃增加不安

## 文本与品牌渲染

要出文字时，明确写出：

- **精确文本**：`The text "REVOLUTION" appears in bold sans-serif`
- **字体特征**：粗细、风格、大小写
- **文字动画**：淡入、方向滑入、打字机、缩放、逐字揭示
- **定位**：居中、底部三分之一、左上角、叠加在元素上
- **时间**：`text appears at 2 seconds, fades at 8 seconds`
