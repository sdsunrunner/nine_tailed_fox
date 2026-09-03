import { Router } from "express";
import fs from "node:fs";
import path from "node:path";

const router = Router();

// 配音演员音色文件目录（与 /actor-voice 静态服务同源）
const ACTOR_VOICE_DIR =
  process.env.ACTOR_VOICE_DIR || "E:\\AIMovie\\AIMovieWorkSpace\\nine_tailed_fox\\ActorVoice";

// 内置气质元数据：演员 → 声音特征 / 适合年龄 / 性别（与前端 voiceActors.ts 对应）
// 新增演员文件会自动出现（fallback 通用特征），此处登记则展示更准的气质信息
const ACTOR_META: Record<
  string,
  { gender: string; features: string[]; ageRange: string }
> = {
  牛骏峰: { gender: "男", features: ["清亮", "少年感", "青涩倔强"], ageRange: "18-28 岁" },
  董勇: { gender: "男", features: ["浑厚", "硬朗", "威严带狠劲"], ageRange: "40-55 岁" },
  张涵予: { gender: "男", features: ["低沉", "磁性", "冷冽神秘"], ageRange: "40-55 岁" },
  黄志忠: { gender: "男", features: ["浑厚", "刚毅", "正剧担当"], ageRange: "40-55 岁" },
  王志文: { gender: "男", features: ["低缓", "克制", "书卷气"], ageRange: "35-55 岁" },
  斯琴高娃: { gender: "女", features: ["苍劲", "厚重", "史诗感"], ageRange: "50-70 岁" },
  周迅: { gender: "女", features: ["灵动", "清亮", "精灵气质"], ageRange: "20-40 岁" },
  归亚蕾: { gender: "女", features: ["沉稳", "温婉", "岁月沉淀"], ageRange: "50-70 岁" },
  陈数: { gender: "女", features: ["知性", "从容", "清雅"], ageRange: "35-50 岁" },
  林更新: { gender: "男", features: ["年轻", "清朗", "松弛"], ageRange: "20-35 岁" },
  李光洁: { gender: "男", features: ["沉稳", "硬朗", "正剧"], ageRange: "35-50 岁" },
  岳跃利: { gender: "男", features: ["老练", "世故", "市井气"], ageRange: "40-60 岁" },
  郭达: { gender: "男", features: ["官腔", "诙谐", "陕西喜感"], ageRange: "45-60 岁" },
  王劲松: { gender: "男", features: ["文气", "阴郁", "台词精细"], ageRange: "45-60 岁" },
  王庆祥: { gender: "男", features: ["沉稳", "威严", "正剧老戏骨"], ageRange: "50-70 岁" },
  王志刚: { gender: "男", features: ["低沉", "浑厚", "正剧"], ageRange: "40-60 岁" },
  王绘春: { gender: "男", features: ["城府", "老练", "深沉"], ageRange: "40-60 岁" },
  赵立新: { gender: "男", features: ["清亮", "戏剧感", "台词功底深"], ageRange: "35-55 岁" },
  金士杰: { gender: "男", features: ["苍老", "枯涩", "戏剧感强"], ageRange: "60-80 岁" },
  何冰: { gender: "男", features: ["京腔", "机敏", "热络戏味"], ageRange: "40-55 岁" },
  张丰毅: { gender: "男", features: ["低沉", "浑厚", "刚直", "正剧"], ageRange: "45-65 岁" },
  "中年-贵族": { gender: "男", features: ["沉稳", "气度", "威仪"], ageRange: "40-60 岁" },
  秦昊: { gender: "男", features: ["低沉磁性", "慵懒", "神经质", "文艺感"], ageRange: "30-50 岁" },
  闫妮: { gender: "女", features: ["温厚爽朗", "陕西口音", "家常烟火气"], ageRange: "35-55 岁" },
  尤勇: { gender: "男", features: ["低沉浑厚", "硬朗", "正剧老戏骨"], ageRange: "45-60 岁" },
  张雨绮: { gender: "女", features: ["磁性醇厚", "明艳强势", "御姐感"], ageRange: "30-45 岁" },
  // 2026-09-02 新增批次
  陈道明: { gender: "男", features: ["低沉磁性", "沉稳大气", "帝王书卷气"], ageRange: "45-65 岁" },
  高曙光: { gender: "男", features: ["浑厚", "端正", "儒雅正剧"], ageRange: "45-60 岁" },
  高亚麟: { gender: "男", features: ["厚实", "亲和", "家常幽默"], ageRange: "40-55 岁" },
  侯勇: { gender: "男", features: ["硬朗", "粗犷", "军人气"], ageRange: "45-60 岁" },
  蒋雯丽: { gender: "女", features: ["知性温润", "细腻", "书卷气"], ageRange: "40-60 岁" },
  李小冉: { gender: "女", features: ["清冷", "温婉", "细腻"], ageRange: "30-45 岁" },
  李雪健: { gender: "男", features: ["苍劲", "低沉", "老戏骨厚重"], ageRange: "60-80 岁" },
  "路人甲-男-中年": { gender: "男", features: ["普通", "中年", "市井感"], ageRange: "35-55 岁" },
  宁静: { gender: "女", features: ["磁性质感", "豪爽", "大气"], ageRange: "35-50 岁" },
  王志飞: { gender: "男", features: ["沉稳", "磁性", "深情正剧"], ageRange: "45-60 岁" },
  殷桃: { gender: "女", features: ["温润", "柔亮", "细腻灵动"], ageRange: "30-45 岁" },
  喻恩泰: { gender: "男", features: ["书卷气", "机敏", "清亮"], ageRange: "35-50 岁" },
};

/** 读取 WAV 头获取时长（秒）与采样率 */
function wavInfo(file: string): { duration: number; sampleRate: number } | null {
  try {
    const fd = fs.openSync(file, "r");
    const buf = Buffer.alloc(64);
    fs.readSync(fd, buf, 0, 64, 0);
    fs.closeSync(fd);
    if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") return null;
    const sampleRate = buf.readUInt32LE(24);
    const bits = buf.readUInt16LE(34);
    const channels = buf.readUInt16LE(22);
    const dataSize = buf.readUInt32LE(40);
    const byteRate = buf.readUInt32LE(28);
    if (!sampleRate || !byteRate) return null;
    const duration = dataSize / byteRate;
    return { duration, sampleRate };
  } catch {
    return null;
  }
}

// GET /api/actor-voices —— 扫描 ActorVoice 目录，返回配音演员列表（含声音特征/适合年龄/时长）
router.get("/actor-voices", async (_req, res) => {
  try {
    if (!fs.existsSync(ACTOR_VOICE_DIR)) {
      res.json({ data: [], count: 0 });
      return;
    }
    const files = fs
      .readdirSync(ACTOR_VOICE_DIR)
      .filter((f) => /\.(wav|mp3|flac|aac|m4a)$/i.test(f))
      .sort((a, b) => a.localeCompare(b, "zh"));
    const items = files.map((f) => {
      const name = f.replace(/\.[^.]+$/, "");
      const meta = ACTOR_META[name];
      const info = wavInfo(path.join(ACTOR_VOICE_DIR, f));
      return {
        name,
        file: f,
        url: `/actor-voice/${encodeURIComponent(f)}`,
        gender: meta?.gender ?? "未知",
        features: meta?.features ?? ["（待标注）"],
        ageRange: meta?.ageRange ?? "（待标注）",
        duration: info ? Math.round(info.duration * 10) / 10 : null,
        sampleRate: info?.sampleRate ?? null,
      };
    });
    res.json({ data: items, count: items.length });
  } catch (e: any) {
    res.status(500).json({ message: e?.message ?? "扫描失败" });
  }
});

export default router;
