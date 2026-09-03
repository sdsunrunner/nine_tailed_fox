// 提示词模板（对齐 Toonflow skills 规范 + 铸剑侯孝贤美学预设）
// 参考：Toonflow data/skills art_prompt 规范（角色=四视图/场景=单主视图/道具=四宫格）

/** 铸剑项目风格根（侯孝贤美学，02-资产 固定风格段） */
export const STYLE_ROOT_ZHUJIAN = [
  "侯孝贤电影画面美学风格，中国宋元水墨画质感，自然柔和的阴天散射光，",
  "极低饱和度，青灰冷色调，画面像褪色的旧照片，颗粒感，静谧的氛围，",
  "不要高饱和色，不要戏剧化光线，不要锐利边缘，",
  "古朴、克制、留白、冷眼看生死",
].join("");

export type AssetKind = "character" | "scene" | "prop";

export const KIND_LABEL: Record<AssetKind, string> = {
  character: "角色",
  scene: "场景",
  prop: "道具",
};

/** 分镜模板（竖屏短剧镜头画面） */
export function buildStoryboardTemplate(desc: string): string {
  const trimmed = (desc ?? "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("【画面】")) {
    const tail: string[] = [];
    if (!trimmed.includes("【风格】")) tail.push(`【风格】${STYLE_ROOT_ZHUJIAN}`);
    return tail.length ? `${trimmed}\n${tail.join("\n")}` : trimmed;
  }
  return [
    `【画面】${trimmed}，竖屏 9:16 短剧镜头画面，景别与运镜明确。`,
    "【光影】阴天自然散射光，低饱和青灰冷调。",
    `【风格】${STYLE_ROOT_ZHUJIAN}`,
    "【约束】竖屏构图，主体居中，电影质感。",
  ].join("\n");
}

interface TemplateSpec {
  /** 模板名 */
  label: string;
  /** 生成完整三段式：desc 为画面描述主体 */
  build: (desc: string) => string;
}

/** 按资产类型的三段式模板（Toonflow art_prompt 规范） */
export const PROMPT_TEMPLATES: Record<AssetKind, TemplateSpec> = {
  character: {
    label: "角色设定图 · 四视图",
    build: (desc) =>
      [
        `【画面】${desc}，全身站姿，角色设定图，四视图（正面/侧面/背面/细节特写），素颜底模，服饰妆容衍生。`,
        "【光影】阴天自然散射光，柔和灰白，低饱和青灰冷调。",
        `【风格】${STYLE_ROOT_ZHUJIAN}`,
        "【约束】空白浅米色底，上下留白，不携带武器。",
      ].join("\n"),
  },
  scene: {
    label: "场景空镜 · 单主视图",
    build: (desc) =>
      [
        `【画面】${desc}，场景设定图，单画面主视图，前中后景层次分明。`,
        "【光影】阴天自然散射光，低饱和青灰冷调。",
        `【风格】${STYLE_ROOT_ZHUJIAN}`,
        "【约束】纯场景空镜，严禁人物。",
      ].join("\n"),
  },
  prop: {
    label: "道具 · 单视图静物",
    build: (desc) =>
      [
        `【画面】${desc}，道具设定图，单视图静物图，构图简洁居中。`,
        "【光影】阴天自然散射光，柔和均匀。",
        `【风格】${STYLE_ROOT_ZHUJIAN}`,
        "【约束】纯静物，严禁人物与手部。",
      ].join("\n"),
  },
};

/** 用指定类型模板包裹描述；描述已含【画面】则跳过包装（只补风格/约束） */
export function applyTemplate(kind: AssetKind, desc: string): string {
  const tpl = PROMPT_TEMPLATES[kind];
  const trimmed = (desc ?? "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("【画面】")) {
    // 已结构化：仅追加缺失的风格/约束行
    const hasStyle = trimmed.includes("【风格】");
    const hasConstraint = trimmed.includes("【约束】");
    const tail: string[] = [];
    if (!hasStyle) tail.push(`【风格】${STYLE_ROOT_ZHUJIAN}`);
    if (!hasConstraint) tail.push(tpl.build("").split("\n")[3]); // 【约束】行
    return tail.length ? `${trimmed}\n${tail.join("\n")}` : trimmed;
  }
  return tpl.build(trimmed);
}

/** 追加铸剑风格根（已含则跳过） */
export function appendStyleRoot(prompt: string): string {
  const trimmed = (prompt ?? "").trim();
  if (!trimmed) return STYLE_ROOT_ZHUJIAN;
  if (trimmed.includes(STYLE_ROOT_ZHUJIAN) || trimmed.includes("侯孝贤电影画面美学风格")) {
    return trimmed;
  }
  return `${trimmed}\n\n${STYLE_ROOT_ZHUJIAN}`;
}
