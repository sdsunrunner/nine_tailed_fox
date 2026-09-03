import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const router = Router();

// 技能库根：apps/ai/skills（AI 服务实时读取，保存即生效）
const SKILLS_DIR = process.env.SKILLS_DIR || path.resolve(process.cwd(), "../ai/skills");

// 分类目录（相对 SKILLS_DIR）
const CATEGORIES: Record<string, string> = {
  art: "art_skills", // 视觉手册（画风）
  story: "story_skills", // 导演手册（叙事）
  production: "production", // 制作技能（生产流程）
  root: "", // 根级技能
};

function categoryDir(category: string): string {
  const sub = CATEGORIES[category];
  if (sub === undefined) throw new Error(`未知分类: ${category}`);
  return path.join(SKILLS_DIR, sub);
}

function listSkillFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
}

/** 提取 frontmatter 块（兼容 BOM 与 CRLF） */
function parseFrontmatter(content: string): string {
  const m = content.replace(/^\uFEFF/, "").match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n/);
  return m?.[1] ?? "";
}

/** 解析 YAML frontmatter 的 description */
function parseDescription(content: string): string {
  const fm = parseFrontmatter(content);
  if (!fm) return "";
  const desc = fm.match(/^description:\s*(.+)$/m);
  return desc?.[1]?.trim() ?? "";
}

/** 解析显示名：优先 frontmatter displayName，否则从 description 提取「中文名」，否则用文件名 */
function parseDisplayName(content: string, fallback: string): string {
  const fm = parseFrontmatter(content);
  if (fm) {
    const dn = fm.match(/^displayName:\s*(.+)$/m);
    if (dn?.[1]?.trim()) return dn[1].trim();
    const zh = fm.match(/^description:\s*.+?「(.+?)」/m);
    if (zh?.[1]) return zh[1];
  }
  return fallback;
}

const categorySchema = z.enum(["art", "story", "production", "root"]).default("root");
const nameSchema = z.string().regex(/^[a-zA-Z0-9_-]+$/);

/** 解析 frontmatter 的 aesthetic（导演专属电影美学名称，视觉手册下拉默认显示用） */
function parseAesthetic(content: string): string {
  const fm = parseFrontmatter(content);
  if (!fm) return "";
  return fm.match(/^aesthetic:\s*(.+)$/m)?.[1]?.trim() ?? "";
}

// GET /api/skills?category=art|story|production|root —— 技能列表
router.get("/skills", (req, res, next) => {
  try {
    const category = categorySchema.parse(req.query.category ?? "root");
    const dir = categoryDir(category);
    const list = listSkillFiles(dir).map((f) => {
      const name = f.replace(/\.md$/, "");
      const content = fs.readFileSync(path.join(dir, f), "utf-8");
      const displayName = parseDisplayName(content, name);
      // 始终返回 description（职责/适用范围描述对列表展示有价值，不与显示名重叠）
      return {
        name,
        displayName,
        description: parseDescription(content),
        aesthetic: parseAesthetic(content),
      };
    });
    res.json({ data: list });
  } catch (e) {
    next(e);
  }
});

// GET /api/skills/content?category=..&name=xxx
router.get("/skills/content", (req, res, next) => {
  try {
    const category = categorySchema.parse(req.query.category ?? "root");
    const name = nameSchema.parse(req.query.name);
    const file = path.join(categoryDir(category), `${name}.md`);
    if (!fs.existsSync(file)) {
      res.status(404).json({ message: "技能不存在" });
      return;
    }
    res.json({ data: { name, content: fs.readFileSync(file, "utf-8") } });
  } catch (e) {
    next(e);
  }
});

// PUT /api/skills/content —— 保存（编辑）
router.put("/skills/content", (req, res, next) => {
  try {
    const body = z
      .object({ category: categorySchema, name: nameSchema, content: z.string() })
      .parse(req.body ?? {});
    const dir = categoryDir(body.category);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${body.name}.md`);
    // Windows 文件系统大小写不敏感：若存在仅大小写不同的同名文件（如 Director_Xxx 与 director_xxx），
    // 覆盖前先删除旧文件，避免 readdir 列表出现重复/错乱条目
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        if (f.toLowerCase() === `${body.name}.md`.toLowerCase() && f !== `${body.name}.md`) {
          fs.rmSync(path.join(dir, f));
        }
      }
    }
    fs.writeFileSync(file, body.content, "utf-8");
    res.json({ data: { saved: true, name: body.name } });
  } catch (e) {
    next(e);
  }
});

// POST /api/skills —— 新建技能（默认模板）
const DEFAULT_TEMPLATE = `---
name: {{name}}
description: 新技能描述
metaData: skills
---

## 任务


## 输出格式
`;

router.post("/skills", (req, res, next) => {
  try {
    const body = z.object({ category: categorySchema, name: nameSchema }).parse(req.body ?? {});
    const dir = categoryDir(body.category);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${body.name}.md`);
    if (fs.existsSync(file)) {
      res.status(409).json({ message: "技能已存在" });
      return;
    }
    fs.writeFileSync(file, DEFAULT_TEMPLATE.replaceAll("{{name}}", body.name), "utf-8");
    res.status(201).json({ data: { created: true, name: body.name } });
  } catch (e) {
    next(e);
  }
});

// DELETE /api/skills?category=..&name=xxx —— 删除技能文件
router.delete("/skills", (req, res, next) => {
  try {
    const category = categorySchema.parse(req.query.category ?? "root");
    const name = nameSchema.parse(req.query.name);
    const file = path.join(categoryDir(category), `${name}.md`);
    if (!fs.existsSync(file)) {
      res.status(404).json({ message: "技能不存在" });
      return;
    }
    fs.rmSync(file);
    res.json({ data: { deleted: true, name } });
  } catch (e) {
    next(e);
  }
});

export default router;
