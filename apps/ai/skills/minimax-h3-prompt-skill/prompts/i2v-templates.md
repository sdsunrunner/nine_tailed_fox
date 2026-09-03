# I2V 图生视频提示词模板

I2V 本质是"文生视频 + 关键帧锚点"：`first_frame` / `last_frame` 输入可选，模型生成两帧之间的运动。首图给错了也会按提示词走——**图是锚，提示词才是导演**。

## I2V 导演规则

1. **首帧是起点，不是全部**：运动从首帧状态出发，先写清楚"从哪开始动、怎么动、停在哪"
2. **动作承接**：运动的每个节拍都要能从前一帧推导出来（转身 → 走 → 停），别凭空跳
3. **景别跟着运动走**：想逼近就推，想拉开就拉，运镜动机和 T2V 一样
4. **身份连续性靠锁**：图锁身份，文字锁"不准变的部分"

## 模板 A：单图身份锁定（超现实都市角色）

单张静态图作为唯一身份参考，明确种族、服装、禁止拟人化，运动拆成四个节拍：

```
Use one still as the sole identity reference. Spell species, wardrobe,
and "do not humanize the face." Break motion into four beats
(stand → walk → glance → stop). Write city ambience + boot Foley +
fabric rustle + a quiet zipper as the button. Ban captions and soft dissolves.
```

导演注释：
- 四个节拍 = 一个完整动作链，每拍从前一拍的姿态出发（动作承接）
- "button" = 收尾镜头，画面停在安静瞬间，给观众消化时间
- 压力点：毛发/布料微细节、跨步行周期的身份保持、立体声城市底噪跟随脚步声

## 模板 B：参考图 → 打斗节拍

首帧锁定面部、服装、武器和光线；时间线推进：

```
First frame locks face, outfit, weapon, and lighting.
Timeline: standoff → sparks clash → handheld whip-pan fight → kneel, last blow.
Sound: wind bed, metal clangs, breathing, dust, brief silence after the final hit.
```

导演注释：
- 动作链连续：对峙 → 交锋 → 激战 → 跪地，每步都是上一步的结果
- whip-pan 转场 = 用镜头甩动接动作，制造混乱中的连续性
- "brief silence after the final hit" = 静音呼吸，高潮后的停顿

## 模板 C：产品动态化（首帧给产品图）

首帧是静态产品图，提示词描述运镜和氛围：

```
[SCENE] The product from the first frame rotates slowly on a seamless studio background,
catching light on its edges. Camera pushes in for a macro detail.

[CAMERA] Slow arc around product, start eye-level, rise to 45° overhead.

[SOUND] Subtle pad, soft whoosh on camera moves, gentle chime when light catches it.
```

导演注释：
- 产品广告标准语法：环绕揭示 + 平视升俯拍（高级感），与 T2V 模板 B 同套打法
- 运动全部可从前一帧推导：旋转角度、推近距离，别跳

## 关键帧规则

- `first_frame` = 第 0 帧，`last_frame` = 末帧，可只给一个或都给
- 关键帧画布尺寸必须和输出分辨率一致（短边 768px，取整到 32 的倍数）
- 给首帧时，运动从首帧状态出发；给尾帧时，运动收敛到尾帧状态
- 首帧/尾帧的场景、光线、服装必须和提示词写的时空一致，否则模型会在中间帧"纠正"出跳变
