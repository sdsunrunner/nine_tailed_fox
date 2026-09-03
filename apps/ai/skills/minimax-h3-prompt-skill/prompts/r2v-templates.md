# R2V 参考生成提示词模板

用独立的 ref2va 权重。最多 9 张参考图 + 3 段参考视频 + 3 段音频。标签按序引用，顺序必须与连线完全一致。

## 标签引用骨架

```
[Roles]
Picture 1: overall mood / location / film look
Picture 2: character identity
Picture 3: product / hero prop
Video 1: camera movement / pacing
Audio 1: vocal tone / emotion

[Shot List]               ← 分镜：每镜带景别和运镜，别只写秒数
0–Xs   [shot size] 画面内容 / 运镜 / 声音
X–Ys   [shot size] 画面内容 / 运镜 / 声音
Y–15s  [shot size] 画面内容 / 运镜 / 声音

[Camera & look]
Move / lens / light / grade / texture

[Sound]
Ambience: …
SFX at timestamps: …
Music / dialogue: …

[Locks & bans]
Must keep: …
Never show: subtitles, watermarks, soft dissolves, …
```

## 多参考连续性锁定

参考越多，越要钉"参考之间的一致性"：

- **时空一致**：身份图里的服装/光线必须和场景图里的环境一致，否则模型在中间帧调和时出跳变
- **一个参考管一件事**：身份只靠身份图，风格只靠风格图，别让两个参考对同一属性提要求
- **镜头节奏从视频参考来**：`Video 1` 定运镜和节奏，`Video 2` 定第二段动作，别让纯文字另起一套运动
- **方向一致**：参考视频里主体从右向左，文字里就别写成从左向右

示例：
```
"Picture 2 locks her face and outfit. Picture 3 is the bar interior — match
 its neon and reflections. Video 1 sets the slow dolly pacing. Keep her
 walking direction consistent with Video 1 (right to left)."
```

## 强弱对比

弱（不推荐）：
> "use these images."

强（推荐）：
> "Picture 1 sets film stock and scene mood; Picture 2 locks the heroine's face; Picture 3 locks the bottle; Picture 4 is the end-card logo."

## 多模态桥接（跨参考素材）

```
"Reference the camera movement and pacing from Video 1.
 Apply the lighting style and color grade from Image 2.
 Have the character match the vocal tone from Audio 3.
 The scene: {your description}."
```

## 角色一致性（身份/风格锁定）

```
<Picture 1> is the CHARACTER reference: keep her face, outfit exactly as designed.
<Picture 2> is the STYLE reference: match this art direction for every frame.
<Picture 3> is the ENVIRONMENT reference: use this location's lighting and palette.
```

## 采样器提示

- 参考较多时，`res_multistep` + `beta` 或 `normal` 调度器通常优于 `simple`
- `ref_image_size`：`match`（缩小到生成分辨率，更快）vs `max`（短边最长 2048px，身份保真更强但更慢）

## 硬限制

- 最多 9 图 + 3 视频 + 3 音频
- 音频不能单独作为参考，必须搭配图像或视频
- 参考顺序有语义，换顺序就是换请求
