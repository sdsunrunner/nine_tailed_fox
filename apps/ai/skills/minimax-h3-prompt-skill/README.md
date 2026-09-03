# MiniMax H3 Prompt Skill

针对 **MiniMax H3**（开源全模态视频生成模型）的提示词技能包：一个 Claude skill + 一套提示词集 + 配套案例。

H3 一次扩散同时生成 24fps 视频 + 32kHz 立体声音频，支持三种模式：

| 模式 | 做什么 | 用哪个权重 |
|------|--------|-----------|
| **T2V** | 文本 → 视频 | fl2va |
| **I2V** | 首帧/尾帧/首尾帧 → 视频 | fl2va |
| **R2V** | 多模态参考 → 视频（最多 9 图 + 3 视频 + 3 音频） | ref2va |

## 目录

```
minimax-h3-prompt-skill/
├── SKILL.md                        # Claude skill（主文件，复制到 .claude/skills/ 使用）
├── prompts/
│   ├── t2v-templates.md            # 文生视频提示词模板
│   ├── i2v-templates.md            # 图生视频提示词模板
│   ├── r2v-templates.md            # 参考生成提示词模板
│   └── glossaries.md               # 镜头运动 / 灯光词汇表
├── examples/
│   ├── t2v-examples.md             # 文生案例
│   ├── i2v-examples.md             # 图生案例
│   └── r2v-examples.md             # 参考生成案例
├── references/
│   └── assets-index.md             # 素材库索引（GPT-Image2 图库分类）
└── official/
    └── h3-prompt-writing/          # 官方 skill（原样收录，五模式规范对照）
```

## 用法

1. 把 `SKILL.md` 复制到你的 `.claude/skills/minimax-h3-prompt/` 目录
2. 对 Claude 说"用 H3 写个 XX 视频的提示词"
3. 或直接抄 `prompts/` 里的模板

## 案例素材

案例中的参考素材来自 GPT-Image2 图库（`awesome-gpt-image-2-main/generated-images`），分类涵盖品牌海报、角色概念/三视图、活动海报、产品概念、UI 设计、微信封面。详见 `references/assets-index.md`。

## 官方参考

- 官方 h3-prompt-writing skill（本仓库 `official/h3-prompt-writing/` 原样收录）：T2VA/I2VA/FL2VA/L2VA/Ref2VA 五模式规范 + 完整提示词结构
- MiniMax 官方提示写作指南：`MiniMaxAI/MiniMax-H3` 仓库 `VIDEO_PROMPT_WRITING_GUIDE_base_en.md`
- ComfyUI 官方 H3 工作流：https://docs.comfy.org/tutorials/video/minimax/minimax-h3
- 提示词校验工具：https://github.com/babicat4242-svg/minimax-h3-prompting

## 作者 / 联系

**AD** · 微信号 `wwwr600a`

<img src="wechat-qr.jpg" alt="微信二维码" width="200" />

- 微信公众号：**AD玩AI**
- 视频号：**AD玩AI-视频版**

## License

提示词和模板内容开放使用。素材库图片来源见其各自出处。
