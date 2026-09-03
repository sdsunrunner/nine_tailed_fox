import express, { Router } from "express";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { getImageProvider } from "../providers/image.js";
import { memoryUpsert } from "./memory.js";

const router = Router();

// 静态资源根（与 index.ts 一致）：生成图/上传图落盘目录
const OSS_DIR = process.env.OSS_DIR || path.join(process.cwd(), "oss");

async function getPrisma() {
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

const paramsSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  episodeId: z.coerce.number().int().positive(),
});

const assetIdSchema = z.object({ id: z.coerce.number().int().positive() });

const createSchema = z.object({
  flowId: z.string().min(1),
  type: z.enum(["character", "scene", "prop"]),
  name: z.string().min(1),
  prompt: z.string().optional(),
  parentId: z.number().int().positive().optional(),
});

// GET /api/projects/:projectId/episodes/:episodeId/assets —— 画布资产列表（含状态）
router.get("/projects/:projectId/episodes/:episodeId/assets", async (req, res, next) => {
  try {
    const { projectId, episodeId } = paramsSchema.parse(req.params);
    const prisma = await getPrisma();
    const assets = await prisma.asset.findMany({
      where: { projectId, episodeId },
      orderBy: { id: "asc" },
    });
    res.json({ data: assets });
    await prisma.$disconnect();
  } catch (e) {
    next(e);
  }
});

// POST /api/projects/:projectId/episodes/:episodeId/assets —— 新建资产（节点创建时调用）
router.post("/projects/:projectId/episodes/:episodeId/assets", async (req, res, next) => {
  try {
    const { projectId, episodeId } = paramsSchema.parse(req.params);
    const body = createSchema.parse(req.body ?? {});
    const prisma = await getPrisma();

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      res.status(404).json({ message: "项目不存在" });
      return;
    }

    const asset = await prisma.asset.create({
      data: {
        projectId,
        episodeId,
        flowId: body.flowId,
        type: body.type,
        name: body.name,
        prompt: body.prompt ?? "",
        parentId: body.parentId ?? null,
        state: "QUEUED",
      },
    });
    res.status(201).json({ data: asset });
    await prisma.$disconnect();
  } catch (e) {
    next(e);
  }
});

// POST /api/projects/:projectId/episodes/:episodeId/assets/:id/generate —— 触发生成（异步，立即返回）
router.post("/projects/:projectId/episodes/:episodeId/assets/:id/generate", async (req, res, next) => {
  try {
    const { projectId, episodeId } = paramsSchema.parse(req.params);
    const { id } = assetIdSchema.parse(req.params);
    const prisma = await getPrisma();

    const asset = await prisma.asset.findFirst({ where: { id, projectId, episodeId } });
    if (!asset) {
      res.status(404).json({ message: "资产不存在" });
      return;
    }
    if (asset.state === "RUNNING") {
      res.status(409).json({ message: "该资产正在生成中" });
      return;
    }

    // 置为排队/执行中并异步跑生成（M2 无队列，异步任务占位；M3 换 BullMQ）
    await prisma.asset.update({ where: { id }, data: { state: "RUNNING", errorReason: null } });
    void runGenerate(id);
    res.json({ data: { id, state: "RUNNING" } });
  } catch (e) {
    next(e);
  }
});

// GET /api/projects/:projectId/episodes/:episodeId/assets/:id —— 单个资产状态（轮询用）
router.get("/projects/:projectId/episodes/:episodeId/assets/:id", async (req, res, next) => {
  try {
    const { projectId, episodeId } = paramsSchema.parse(req.params);
    const { id } = assetIdSchema.parse(req.params);
    const prisma = await getPrisma();
    const asset = await prisma.asset.findFirst({ where: { id, projectId, episodeId } });
    if (!asset) {
      res.status(404).json({ message: "资产不存在" });
      return;
    }
    res.json({ data: asset });
    await prisma.$disconnect();
  } catch (e) {
    next(e);
  }
});

// PUT /api/projects/:projectId/episodes/:episodeId/assets/:id —— 更新资产（名称/类型/提示词/配音配置）
const updateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["character", "scene", "prop"]).optional(),
  prompt: z.string().optional(),
  voiceActor: z.string().nullable().optional(),
  voiceDialect: z.string().nullable().optional(),
  refImagePath: z.string().nullable().optional(),
});

router.put("/projects/:projectId/episodes/:episodeId/assets/:id", async (req, res, next) => {
  try {
    const { projectId, episodeId } = paramsSchema.parse(req.params);
    const { id } = assetIdSchema.parse(req.params);
    const body = updateSchema.parse(req.body ?? {});
    const prisma = await getPrisma();

    const asset = await prisma.asset.findFirst({ where: { id, projectId, episodeId } });
    if (!asset) {
      res.status(404).json({ message: "资产不存在" });
      return;
    }
    const updated = await prisma.asset.update({ where: { id }, data: body });
    res.json({ data: updated });
    await prisma.$disconnect();
  } catch (e) {
    next(e);
  }
});

// DELETE /api/projects/:projectId/episodes/:episodeId/assets/:id —— 删除资产（含其衍生子资产）
router.delete("/projects/:projectId/episodes/:episodeId/assets/:id", async (req, res, next) => {
  try {
    const { projectId, episodeId } = paramsSchema.parse(req.params);
    const { id } = assetIdSchema.parse(req.params);
    const prisma = await getPrisma();

    const asset = await prisma.asset.findFirst({ where: { id, projectId, episodeId } });
    if (!asset) {
      res.status(404).json({ message: "资产不存在" });
      return;
    }
    const result = await prisma.asset.deleteMany({
      where: { id: { in: [id, ...(await prisma.asset.findMany({ where: { parentId: id }, select: { id: true } })).map((a) => a.id)] } },
    });
    res.json({ data: { id, deleted: result.count } });
    await prisma.$disconnect();
  } catch (e) {
    next(e);
  }
});

// 角色参考图布局规范（角色正面全身照）：单张 1024×1024 正面全身照，空手面对观众，纯白底无背景
// 场景/道具：强制「严禁人物」等类型约束
function buildAssetPrompt(asset: { type: string; prompt: string | null }): string {
  const base = asset.prompt ?? "";
  if (asset.type === "character") {
    const layout =
      "纯白色背景（PURE WHITE BACKGROUND），画面背景完全空白、无任何内容——无山水、无建筑、无动物、无树木、无纹理、无水墨渲染、无渐变、无其他人物、无道具、无文字。\n" +
      "【画面布局】单张角色正面全身照（1:1 正方形）：角色正面站立，完整露出头部至脚底，全身居中，双脚完整可见。" +
      "空手面对观众，不持任何武器/道具，不做复杂动作，双臂自然垂放。\n" +
      "画面只呈现角色本人（人物外貌/服装/发型/妆容），角色为同一人、同一套服装、同一发型妆容。\n" +
      "自检：背景为纯白空白，画面仅角色一人，无任何背景元素。";
    return base ? `${layout}\n${base}` : layout;
  }
  if (asset.type === "scene") {
    // 场景：严禁人物约束前置（Z-image 对开头词敏感），base 为主体描述
    const constraint =
      "【画面】" + (base || "场景设定图") + "\\n" +
      "【约束】纯场景空镜，【画面中严禁任何人物】——无人物、无人物剪影、无骑乘者、无人形、无脸/手/身体任何人的部分；前中后景层次分明，构图疏朗留白，画面空无一人，仅场景与环境。";
    return constraint;
  }
  if (asset.type === "prop") {
    const constraint =
      "【画面】" + (base || "道具设定图") + "\\n" +
      "【约束】纯道具静物单视图，【严禁人物与手部】——无人物、无手持、无人手出现；只呈现道具本身（造型/材质/细节），构图简洁居中。";
    return constraint;
  }
  return base;
}

/** 从视觉手册提取风格段（按资产类型）：
 *  - character：只取「色彩与调色」「光影与质感」章节（纯画风，不含场景/动物/建筑等元素）
 *  - scene/prop：取「生图提示词根」代码块（含场景/道具元素合适） */
function extractStyleRoot(visualSkill: string, type: string): string {
  if (!visualSkill) return "";
  const SKILLS_DIR = process.env.SKILLS_DIR || path.resolve(process.cwd(), "../ai/skills");
  const file = path.join(SKILLS_DIR, "art_skills", `${visualSkill}.md`);
  try {
    const content = fs.readFileSync(file, "utf-8");
    if (type === "character" || type === "prop") {
      // 角色/道具：只取「色彩与调色」「光影与质感」章节（纯画风，无场景元素——道具图不该有山/关隘/骑乘人物等）
      const styleSections: string[] = [];
      const lines = content.split(/\r?\n/);
      let inStyle = false;
      for (const ln of lines) {
        if (/^##\s*(色彩与调色|光影与质感)/.test(ln.trim())) {
          inStyle = true;
          continue;
        }
        if (inStyle && /^##\s*(构图与镜头语言|生图提示词根|严禁内容)/.test(ln.trim())) {
          inStyle = false;
          continue;
        }
        if (!inStyle || !ln.trim()) continue;
        // 跳过含场景/建筑/动物元素的句子（保留纯画风：色调/质感/光影/纹理）
        if (/山|关|城|楼|殿|宫|牛|马|狗|屋|树|水|桥|路|建筑|风景|背景/.test(ln.trim())) continue;
        styleSections.push(ln.trim());
      }
      return styleSections.join("\\n");
    }
    // scene：生图提示词根代码块——过滤三类元素：
    //  1) 人物/动物/骑乘词（场景空镜严禁人物）
    //  2) 具体场景地标/建筑词（函谷关/关隘/城楼/城墙/大殿等）——手册根的场景地标会强推模型画出特定建筑，
    //     而资产可能是室内/他处（如城楼大厅、厢房），具体场景元素由 AI 资产 prompt 描述，风格根只负责画风
    //  3) 自然景观元素词（山雾/山峦/远山/峰/岭/云海/孤影等）——纯室内场景不该出现远山
    // 只取「## 生图提示词根」章节内的代码块（排除「高潮段/分镜段」等特例块）
    const peopleAnimalRe =
      /(老子|孔子|墨子|墨翟|庄子|眉间尺|大王|君王|黑衣人|女娲|嫦娥|后羿|伯夷|叔齐|大禹|人物|人形|剪影|身影|衣袂|官僚|群像|骷髅|巨神|隐士|车马|骑|驾|青牛|牛|马|驴|犬|飞天|神情|面容|眼神|淡泊|超然|悲壮|悲悯|站立|立于|拄杖|麻衣|相对而立|函谷关|关隘|城楼|城墙|城门|大殿|宫殿|楼阁|塔|烽火台|亭|宅|房屋|建筑|出关|关外|关卡|山雾|山峦|远山|山景|孤山|峰峦|层峦|云海|山石|孤影|山间|山巅|山坡|山野|荒山)/;
    const parts: string[] = [];
    // 定位「生图提示词根」章节（到下一个 ## 标题为止），只取该章节内代码块
    const lines = content.split(/\r?\n/);
    let inRoot = false;
    let buf: string[] = [];
    for (const ln of lines) {
      if (/^##\s*生图提示词根/.test(ln.trim())) {
        inRoot = true;
        continue;
      }
      if (inRoot && /^##\s*/.test(ln.trim())) {
        inRoot = false; // 进入下一章节，结束
      }
      if (!inRoot) continue;
      buf.push(ln);
    }
    const section = buf.join("\n");
    const blocks = section.match(/\`\`\`[^\n]*\n([\s\S]*?)\`\`\`/g) ?? [];
    for (const b of blocks) {
      let body = b.replace(/^\`\`\`[^\n]*\n/, "").replace(/\`\`\`$/, "").trim();
      if (!body) continue;
      // 替换法：画风关键句中的山景/人物词替换为中性表述（保留画风参考，不整句丢弃）
      body = body
        .replace(/郭熙《早春图》山雾质感/g, "宋元文人画雾霭质感")
        .replace(/山雾质感/g, "雾霭质感")
        .replace(/山峦远淡|孤影/g, "");
      // 按中文标点切成短句，逐句过滤人物/动物/地标/山景词，只保留纯画风子句
      const sentences = body.split(/[，,、：:\n]+/).map((s) => s.trim()).filter(Boolean);
      const clean = sentences.filter((s) => !peopleAnimalRe.test(s));
      if (clean.length) parts.push(clean.join("，"));
    }
    return parts.join("\\n");
  } catch {
    return "";
  }
}

// 异步生成执行（不阻塞请求；错误落库）
async function runGenerate(id: number) {
  const prisma = await getPrisma();
  try {
    const asset = await prisma.asset.findUnique({ where: { id } });
    // 资产提示词为空时，从本项目的资产生成分析结果（EpisodeAsset description，含身份锚点：年龄/体型/服装/五官…）补充，
    // 避免「去生成」只带布局句、缺角色身份信息
    let prompt = asset.prompt ?? "";
    if (!prompt.trim()) {
      const ep = await prisma.episodeAsset.findFirst({
        where: { projectId: asset.projectId, type: asset.type, name: asset.name },
      });
      prompt = ep?.description ?? "";
    }
    // 注入项目美术风格（视觉手册风格段）→ 与项目画风一致
    // 注入项目美术风格：角色=纯画风（色彩/光影，已过滤场景词，纯白底由布局规范保证）；场景/道具=完整风格段
    let styleRoot = "";
    try {
      const project = await prisma.project.findUnique({ where: { id: asset.projectId } });
      if (project?.visualSkill) {
        styleRoot = extractStyleRoot(project.visualSkill, asset.type);
      }
    } catch {
      /* 风格注入失败不阻断生成 */
    }
    const finalPrompt = [buildAssetPrompt({ type: asset.type, prompt }), styleRoot].filter(Boolean).join("\n");
    const result = await getImageProvider().generate({
      type: asset.type,
      name: asset.name,
      prompt: finalPrompt,
      // scene/prop 有参考图 → 图生图工作流；无 → 文生图（character 不走图生图）
      refImage: (asset.type === "scene" || asset.type === "prop") ? (asset.refImagePath ?? undefined) : undefined,
    });
    // updateMany：生成期间资产卡可能已被删除（清理/删除竞态），记录不存在返回 0 不抛错，避免崩进程
    await prisma.asset.updateMany({
      where: { id },
      data: { state: "SUCCEEDED", filePath: result.filePath },
    });
    // 写入语义记忆（供素材库语义检索）
    void memoryUpsert({
      text: `${asset.name}：${asset.prompt ?? ""}`,
      kind: "asset",
      type: asset.type,
      filePath: result.filePath,
      projectId: asset.projectId,
      episodeId: asset.episodeId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.asset.updateMany({ where: { id }, data: { state: "FAILED", errorReason: msg } });
  } finally {
    await prisma.$disconnect();
  }
}

// ---------- 上传 / 清理（资产生成流程优化）----------

/** 图片魔数嗅探 → 扩展名（png/jpg/webp/gif；不支持返回 null） */
function sniffImageExt(buf: Buffer): string | null {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (buf.length > 6 && buf.toString("ascii", 0, 4) === "GIF8") return "gif";
  return null;
}

/** 尽力删除 oss 文件（不存在/失败忽略） */
function tryRemoveOssFile(filePath: string) {
  try {
    const rel = filePath.replace(/^\/oss\//, "");
    const abs = path.join(OSS_DIR, rel);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {
    /* 清理失败不阻断 */
  }
}

// POST /api/projects/:pid/episodes/:eid/assets/upload?type=character&name=xxx
// 上传图片作为资产内容（raw body 图片字节）；同 项目+集+类型+名 复用资产卡（换图）
router.post(
  "/projects/:projectId/episodes/:episodeId/assets/upload",
  express.raw({ type: () => true, limit: "25mb" }),
  async (req, res, next) => {
    try {
      const { projectId, episodeId } = paramsSchema.parse(req.params);
      const type = z.enum(["character", "scene", "prop"]).parse(req.query.type);
      const name = z.string().min(1).max(60).parse(req.query.name);
      const buf = req.body;
      if (!Buffer.isBuffer(buf) || buf.length === 0) {
        res.status(400).json({ message: "缺少图片内容" });
        return;
      }
      const ext = sniffImageExt(buf);
      if (!ext) {
        res.status(400).json({ message: "不支持的图片格式（仅 png/jpg/webp/gif）" });
        return;
      }
      const prisma = await getPrisma();
      try {
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) { res.status(404).json({ message: "项目不存在" }); return; }
        const ep = await prisma.episode.findUnique({ where: { id: episodeId } });
        if (!ep) { res.status(404).json({ message: "集不存在" }); return; }

        // 落盘 oss/assets/{type}/
        const safeName = name.replace(/[\\/:*?"<>|]/g, "_").slice(0, 40);
        const fileName = `${safeName}-${Date.now()}.${ext}`;
        const relDir = `assets/${type}`;
        const absDir = path.join(OSS_DIR, relDir);
        fs.mkdirSync(absDir, { recursive: true });
        fs.writeFileSync(path.join(absDir, fileName), buf);
        const filePath = `/oss/${relDir}/${fileName}`;

        // upsert：同 项目+集+类型+名 复用资产卡（旧图删除，内容替换）
        const existing = await prisma.asset.findFirst({ where: { projectId, episodeId, type, name } });
        let asset;
        if (existing) {
          if (existing.filePath) tryRemoveOssFile(existing.filePath);
          asset = await prisma.asset.update({
            where: { id: existing.id },
            data: { filePath, state: "SUCCEEDED", errorReason: null },
          });
        } else {
          asset = await prisma.asset.create({
            data: {
              projectId, episodeId,
              flowId: `asset-upload-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              type, name, prompt: "", parentId: null,
              state: "SUCCEEDED", filePath,
            },
          });
        }
        void memoryUpsert({ text: `${name}：${asset.prompt ?? ""}`, kind: "asset", type, filePath, projectId, episodeId });
        res.json({ data: asset });
      } finally {
        await prisma.$disconnect();
      }
    } catch (e) {
      next(e);
    }
  },
);

// POST /api/projects/:pid/episodes/:eid/assets/:id/ref-image
// 上传参考图（scene/prop 图生图用）：raw body 图片字节 → 存 oss/assets/{type}/ref-xxx.png → 记录 refImagePath
router.post(
  "/projects/:projectId/episodes/:episodeId/assets/:id/ref-image",
  express.raw({ type: () => true, limit: "25mb" }),
  async (req, res, next) => {
    try {
      const { projectId, episodeId } = paramsSchema.parse(req.params);
      const { id } = assetIdSchema.parse(req.params);
      const buf = req.body;
      if (!Buffer.isBuffer(buf) || buf.length === 0) {
        res.status(400).json({ message: "缺少图片内容" });
        return;
      }
      const ext = sniffImageExt(buf);
      if (!ext) {
        res.status(400).json({ message: "不支持的图片格式（仅 png/jpg/webp/gif）" });
        return;
      }
      const prisma = await getPrisma();
      try {
        const asset = await prisma.asset.findFirst({ where: { id, projectId, episodeId } });
        if (!asset) {
          res.status(404).json({ message: "资产不存在" });
          return;
        }
        // 落盘 oss/assets/{type}/ref-{name}-{ts}.{ext}
        const safeName = asset.name.replace(/[\\/:*?"<>|]/g, "_").slice(0, 40);
        const fileName = `ref-${safeName}-${Date.now()}.${ext}`;
        const relDir = `assets/${asset.type}`;
        const absDir = path.join(OSS_DIR, relDir);
        fs.mkdirSync(absDir, { recursive: true });
        fs.writeFileSync(path.join(absDir, fileName), buf);
        const refImagePath = `/oss/${relDir}/${fileName}`;

        // 旧参考图删除（换图）
        if (asset.refImagePath) tryRemoveOssFile(asset.refImagePath);

        const updated = await prisma.asset.update({
          where: { id },
          data: { refImagePath, errorReason: null },
        });
        res.json({ data: updated });
      } finally {
        await prisma.$disconnect();
      }
    } catch (e) {
      next(e);
    }
  },
);

// POST /api/projects/:pid/episodes/:eid/assets/:id/ref-image/clear
// 清除参考图（删除文件 + 置空）；资产内容图保留
router.post("/projects/:projectId/episodes/:episodeId/assets/:id/ref-image/clear", async (req, res, next) => {
  try {
    const { projectId, episodeId } = paramsSchema.parse(req.params);
    const { id } = assetIdSchema.parse(req.params);
    const prisma = await getPrisma();
    try {
      const asset = await prisma.asset.findFirst({ where: { id, projectId, episodeId } });
      if (!asset) {
        res.status(404).json({ message: "资产不存在" });
        return;
      }
      if (asset.refImagePath) tryRemoveOssFile(asset.refImagePath);
      const updated = await prisma.asset.update({ where: { id }, data: { refImagePath: null } });
      res.json({ data: updated });
    } finally {
      await prisma.$disconnect();
    }
  } catch (e) {
    next(e);
  }
});

// POST /api/projects/:pid/episodes/:eid/assets/:id/clear —— 清理资产内容（删除图片，保留资产卡）
router.post("/projects/:projectId/episodes/:episodeId/assets/:id/clear", async (req, res, next) => {
  try {
    const { projectId, episodeId } = paramsSchema.parse(req.params);
    const { id } = assetIdSchema.parse(req.params);
    const prisma = await getPrisma();
    try {
      const asset = await prisma.asset.findFirst({ where: { id, projectId, episodeId } });
      if (!asset) {
        res.status(404).json({ message: "资产不存在" });
        return;
      }
      if (asset.filePath) tryRemoveOssFile(asset.filePath);
      const updated = await prisma.asset.update({
        where: { id },
        data: { filePath: null, state: "QUEUED", errorReason: null },
      });
      res.json({ data: updated });
    } finally {
      await prisma.$disconnect();
    }
  } catch (e) {
    next(e);
  }
});

export default router;
