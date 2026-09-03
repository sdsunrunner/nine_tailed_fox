# R2V 参考生成案例

用 ref2va 权重，素材直接作为参考输入。标签按序引用，顺序必须与连线一致。素材路径见 `references/assets-index.md`。

## 案例 1：角色一致性表演（三视图 + 概念图）

参考：`character-sheet/001-赛博战士三视图`（身份）+ `character-concept/001-赛博朋克女战士`（氛围）

```
<Picture 1> is the CHARACTER reference: keep her face, armor, and palette exactly.
<Picture 2> is the MOOD reference: match this art direction for every frame.

0-4s: she stands in a neon alley, idle breathing.
4-9s: walks toward camera, dolly-in from wide to medium.
9-12s: stops, draws a weapon, glares.

City ambience stereo-wide, metal footsteps, low synth drone.
Keep face and armor consistent across all cuts.
```

## 案例 2：品牌动态化（海报做风格参考）

参考：`brand-poster/003-高端腕表品牌海报`（风格）+ 可选一段运镜视频

```
<Picture 1> sets the brand look: dark premium, gold accents, studio lighting.
<Video 1> provides the camera movement: use its pacing and orbit.

0-5s: watch on dark marble, slow orbital arc.
5-10s: macro push into the dial, hands sweep, light catches the bezel.
10-12s: product settles, brand text fades in bottom-third.

Subtle pad, tick-tock Foley on macro, soft whoosh on camera moves.
Keep brand text and product shape pixel-consistent.
```

## 案例 3：UI 动效（UI 设计图 → 交互动效）

参考：`ui-design/001-电商APP首页`（界面）+ `003-社交APP个人主页`（次屏）

```
<Picture 1> is the UI reference: rebuild this exact layout, keep every element.
<Picture 2> is the secondary screen for the second segment.

0-4s: home screen scrolls, cards stagger in with spring easing.
4-8s: tap a card, it expands into detail view.
8-12s: camera gently pushes in, then settles.

UI feedback ticks and soft whooshes, subtle pop on expand.
Keep text, icons, and spacing exactly as in the reference.
```

## 案例 4：产品宣传片（产品图 + 声音）

参考：`product-concept/001-概念智能手机`（产品）+ 一段参考音频（旁白/音乐）

```
<Picture 1> is the PRODUCT reference: keep silhouette and interface exact.
<Audio 1> is the VOICE reference: match this tone and pacing for the narration.

0-5s: product orbits on seamless studio background.
5-10s: macro detail of screen, interface glows.
10-12s: product settles, logo appears, narration lands the tagline.

Match the vocal tone from Audio 1, keep background music subtle.
Keep product colors and screen UI accurate.
```

## 通用提示

- 每个参考明确一个职责（身份/风格/动作/镜头/声音），一个参考管一件事
- 音频不能单独作为参考，必须搭配图像或视频
- 参考较多时用 `res_multistep` + `beta`/`normal` 调度器
- 参考顺序有语义，换顺序就是换请求
