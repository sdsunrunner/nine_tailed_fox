// 配音演员气质库：候选演员 = ActorVoice 目录（E:\AIMovie\AIMovieWorkSpace\nine_tailed_fox\ActorVoice）内实际素材
// 每个演员含 气质关键词（tags）用于按角色设定匹配；refFile=目录内参考音频文件名（配音克隆用）
// 仅作音色气质参考，克隆时用非明星素材
export interface VoiceActor {
  name: string;
  gender: "男" | "女";
  tags: string[]; // 气质关键词（匹配角色名/设计描述）
  desc: string; // 一句话气质描述
  refFile: string; // ActorVoice 目录内参考音频文件名
  ageRange: string; // 适合年龄区间（如 "40-55 岁"）
}

/** 从年龄区间推导年龄段（老 55+ / 中 30-55 / 青 <30）；解析失败按「中」 */
export function ageBand(ageRange: string): "青" | "中" | "老" {
  const m = /(\d+)\s*[-—~～]\s*(\d+)/.exec(ageRange ?? "");
  if (!m) return "中";
  const lo = parseInt(m[1], 10);
  const hi = parseInt(m[2], 10);
  if (lo >= 55 || hi >= 65) return "老";
  if (lo < 30 && hi <= 35) return "青";
  return "中";
}

export const VOICE_ACTORS: VoiceActor[] = [
  { name: "牛骏峰", ageRange: "18-28 岁", gender: "男", tags: ["少年", "清亮", "青涩", "倔强", "年轻"], desc: "清亮少年音、青涩倔强", refFile: "牛骏峰.wav" },
  { name: "董勇", ageRange: "40-55 岁", gender: "男", tags: ["威严", "暴戾", "中年", "浑厚", "硬朗", "狠", "王", "大王"], desc: "浑厚硬朗、威严带狠劲", refFile: "董勇.wav" },
  { name: "张涵予", ageRange: "40-55 岁", gender: "男", tags: ["低沉", "磁性", "冷冽", "神秘", "慢", "沉重"], desc: "低沉磁性、冷冽神秘", refFile: "张涵予.wav" },
  { name: "奚美娟", ageRange: "50-65 岁", gender: "女", tags: ["温厚", "隐忍", "母亲", "母", "中老年", "克制"], desc: "温厚克制、隐忍", refFile: "" },
  { name: "黄渤", ageRange: "35-50 岁", gender: "男", tags: ["山东", "憨厚", "喜感", "松弛", "荒诞", "直率"], desc: "青岛腔松弛喜感、直率憨厚", refFile: "" },
  { name: "张雨绮", ageRange: "30-45 岁", gender: "女", tags: ["山东", "泼辣", "清亮", "家常", "爽利"], desc: "清亮泼辣、山东爽利", refFile: "" },
  { name: "黄志忠", ageRange: "40-55 岁", gender: "男", tags: ["浑厚", "刚毅", "正剧", "大禹", "沉稳", "厚重"], desc: "浑厚刚毅、正剧担当", refFile: "黄志忠.wav" },
  { name: "李雪健", ageRange: "55-70 岁", gender: "男", tags: ["沙哑", "沧桑", "正剧", "厚重", "老者", "老"], desc: "沙哑沧桑、厚重正剧", refFile: "" },
  { name: "范伟", ageRange: "40-60 岁", gender: "男", tags: ["官腔", "诙谐", "油滑", "喜剧", "官"], desc: "官腔诙谐、油滑辛辣", refFile: "" },
  { name: "宋丹丹", ageRange: "40-60 岁", gender: "女", tags: ["絮叨", "家常", "泼辣", "喜剧", "媳妇", "太太"], desc: "絮叨家常、怨而不怒", refFile: "" },
  { name: "巩俐", ageRange: "35-55 岁", gender: "女", tags: ["厚重", "大气", "女中音", "史诗", "创世", "女娲"], desc: "厚重女中音、大气磅礴", refFile: "" },
  { name: "斯琴高娃", ageRange: "50-70 岁", gender: "女", tags: ["苍劲", "厚重", "史诗", "中老年", "女中音"], desc: "苍劲厚重、草原史诗感", refFile: "斯琴高娃.wav" },
  { name: "王志文", ageRange: "35-55 岁", gender: "男", tags: ["低缓", "克制", "书卷", "文气", "温吞", "哲人"], desc: "低缓克制、书卷气", refFile: "王志文.wav" },
  { name: "葛优", ageRange: "40-60 岁", gender: "男", tags: ["油滑", "市侩", "松弛", "喜剧", "势利"], desc: "油滑市侩、松弛冷幽默", refFile: "" },
  { name: "倪虹洁", ageRange: "35-50 岁", gender: "女", tags: ["尖刻", "市井", "利落", "泼辣"], desc: "上海人、尖利市井", refFile: "" },
  { name: "张丰毅", ageRange: "45-65 岁", gender: "男", tags: ["低沉", "浑厚", "刚直", "年长", "武士", "正剧", "墨", "侠"], desc: "浑厚正剧男声、刚直不屈", refFile: "张丰毅.wav" },
  { name: "赵立新", ageRange: "35-55 岁", gender: "男", tags: ["机敏", "清亮", "戏剧", "自负", "台词", "匠", "巧"], desc: "台词功底深、清亮戏剧感", refFile: "赵立新.wav" },
  { name: "陈建斌", ageRange: "40-55 岁", gender: "男", tags: ["沉郁", "威严", "慵懒", "傲慢", "王", "暴戾"], desc: "沉郁威严、不怒自威", refFile: "" },
  { name: "陈道明", ageRange: "45-60 岁", gender: "男", tags: ["沉稳", "清冽", "哲人", "温厚", "从容", "道"], desc: "沉稳清冽、从容自若", refFile: "" },
  { name: "何冰", ageRange: "40-55 岁", gender: "男", tags: ["京腔", "机敏", "热络", "圆滑", "戏味", "官吏", "官"], desc: "京腔机敏、热络带戏味", refFile: "何冰.wav" },
  { name: "张志坚", ageRange: "40-55 岁", gender: "男", tags: ["文气", "焦躁", "阴郁", "机锋"], desc: "文气阴郁、锋芒内敛", refFile: "" },
  { name: "王劲松", ageRange: "45-60 岁", gender: "男", tags: ["文气", "阴郁", "冷峻", "台词"], desc: "文气阴郁、台词精细", refFile: "王劲松.wav" },
  { name: "姜文", ageRange: "45-60 岁", gender: "男", tags: ["沙哑", "京腔", "机锋", "荒诞", "诙谐", "庄子"], desc: "沙哑京腔、机锋诙谐", refFile: "" },
  { name: "金士杰", ageRange: "60-80 岁", gender: "男", tags: ["苍老", "枯涩", "戏剧", "戏谑", "骷髅", "老"], desc: "苍老枯涩、戏剧感强", refFile: "金士杰.wav" },
  { name: "周迅", ageRange: "20-40 岁", gender: "女", tags: ["灵动", "清亮", "古灵精怪", "少女"], desc: "灵动清亮、精灵气质", refFile: "周迅.wav" },
  { name: "归亚蕾", ageRange: "50-70 岁", gender: "女", tags: ["沉稳", "温婉", "中老年", "大家"], desc: "沉稳温婉、岁月沉淀", refFile: "归亚蕾.wav" },
  { name: "陈数", ageRange: "35-50 岁", gender: "女", tags: ["知性", "从容", "清雅", "中年"], desc: "知性从容、清雅干练", refFile: "陈数.wav" },
  { name: "林更新", ageRange: "20-35 岁", gender: "男", tags: ["年轻", "清朗", "东北", "松弛"], desc: "年轻清朗、东北松弛", refFile: "林更新.wav" },
  { name: "李光洁", ageRange: "35-50 岁", gender: "男", tags: ["沉稳", "正剧", "中年", "硬朗"], desc: "沉稳硬朗、正剧气质", refFile: "李光洁.wav" },
  { name: "岳跃利", ageRange: "40-60 岁", gender: "男", tags: ["老练", "市侩", "中年", "世故"], desc: "老练世故、市井气", refFile: "岳跃利.wav" },
  { name: "郭达", ageRange: "45-60 岁", gender: "男", tags: ["官腔", "诙谐", "喜剧", "机敏"], desc: "官腔诙谐、陕西喜感", refFile: "郭达.wav" },
  { name: "王庆祥", ageRange: "50-70 岁", gender: "男", tags: ["沉稳", "威严", "正剧", "年长"], desc: "沉稳威严、正剧老戏骨", refFile: "王庆祥.wav" },
  { name: "王志刚", ageRange: "40-60 岁", gender: "男", tags: ["低沉", "浑厚", "正剧", "年长"], desc: "低沉浑厚、正剧男声", refFile: "王志刚.wav" },
  { name: "王绘春", ageRange: "40-60 岁", gender: "男", tags: ["城府", "老练", "深沉", "中年"], desc: "城府深沉、老练", refFile: "王绘春.wav" },
  { name: "中年-贵族", ageRange: "40-60 岁", gender: "男", tags: ["贵族", "中年", "沉稳", "气度", "威严"], desc: "中年贵族气度、沉稳有威仪", refFile: "中年-贵族.wav" },
];

/** 方言选项（配音用；SoulX 支持范围 + 规划内方言） */
export const VOICE_DIALECTS: Array<{ label: string; value: string }> = [
  { label: "普通话", value: "普通话" },
  { label: "河南话（中原官话）", value: "河南话" },
  { label: "四川话", value: "四川话" },
  { label: "粤语", value: "粤语" },
  { label: "陕西话（关中腔）", value: "陕西话" },
  { label: "山西话/晋语", value: "山西话" },
  { label: "山东话", value: "山东话" },
  { label: "西北话", value: "西北话" },
  { label: "吴语（南方软语）", value: "吴语" },
  { label: "陕西豫东腔+秦腔", value: "豫东腔秦腔" },
];

/** 按角色设定筛选候选配音演员（最多 maxCount 个）：只显示有实际素材（refFile）的演员
 *  打分 = 角色名命中（权重 3）+ 设计描述命中（权重 1）+ 有素材加成（+0.5）
 *  gender/age 可再按性别/年龄段过滤（"all" 或 男/女 / 青/中/老） */
export function matchVoiceActors(
  roleName: string,
  designDesc: string,
  maxCount = 3,
  gender: string = "all",
  age: string = "all",
): VoiceActor[] {
  const nameText = (roleName ?? "").toLowerCase();
  const descText = (designDesc ?? "").toLowerCase();
  const pool = VOICE_ACTORS.filter((a) => {
    if (!a.refFile) return false; // 无原始音频素材的演员不进入候选
    if (gender !== "all" && a.gender !== gender) return false;
    if (age !== "all" && ageBand(a.ageRange) !== age) return false;
    return true;
  });
  const scored = pool.map((a) => {
    let score = 0;
    const hitTags: string[] = [];
    for (const tag of a.tags) {
      const t = tag.toLowerCase();
      if (nameText && nameText.includes(t)) {
        score += 3;
        hitTags.push(tag);
      } else if (descText && descText.includes(t)) {
        score += 1;
        hitTags.push(tag);
      }
    }
    return { actor: a, score, hitTags };
  });
  const top = scored.filter((s) => s.score > 0).sort((x, y) => y.score - x.score).slice(0, maxCount);
  // 无命中时回退补足：按筛选池顺序补（仅限有素材演员）
  if (top.length < maxCount) {
    const need = maxCount - top.length;
    const used = new Set(top.map((t) => t.actor.name));
    const fill = pool.filter((a) => !used.has(a.name));
    for (const a of fill.slice(0, need)) top.push({ actor: a, score: 0, hitTags: [] });
  }
  return top.map((t) => t.actor);
}
