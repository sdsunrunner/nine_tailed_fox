// 生成第一集第一镜的正确 r2v 手动工作流
import fs from "node:fs";

const SRC = "H:/ComfyUI/ComfyUI-V18.1/user/default/workflows/27 MinimaxH3最火视频系列（16G）/九尾狐_H3_r2v_加速版_修复.json";
const DST = "E:/AIMovie/AIMovieWorkSpace/九尾狐_ComfyUI工作流/第一集第一镜_r2v_完整.json";

const wf = JSON.parse(fs.readFileSync(SRC, "utf-8"));

const MAIN_IMG = "storyboard-sb-0-1787217202270.png";
const CHAR_IMG = "character-眉间尺·角色卡-1787129505265.png";

const img231 = wf.nodes.find((n) => n.id === 231);
if (img231) img231.widgets_values[0] = MAIN_IMG;
const img232 = wf.nodes.find((n) => n.id === 232);
if (img232) img232.widgets_values[0] = CHAR_IMG;

const refNode = wf.nodes.find((n) => n.id === 230);
const refInputs = (refNode.inputs ?? []).filter((i) => String(i.name ?? "").startsWith("ref_images.ref_image_"));
for (const slot of refInputs) {
  if (slot.link == null) continue;
  const l = wf.links.find((x) => x[0] === slot.link);
  if (!l) continue;
  const src = wf.nodes.find((n) => n.id === l[1]);
  const img = src?.widgets_values?.[0];
  const hasImg = typeof img === "string" && img && img !== "None";
  if (src?.type === "LoadImage" && !hasImg) src.mode = 4;
}
const refLinks = new Set(refInputs.map((i) => i.link));
for (const n of wf.nodes) {
  if (n.type !== "LoadImage") continue;
  const outLink = n.outputs?.[0]?.links?.[0];
  if (!refLinks.has(outLink)) n.mode = 4;
}

const PROMPT = `subject_definitions:
<Subject 1> is the sixteen-year-old boy in <Picture 2> (the character asset), thin-faced, in a plain dark robe, appearance identical to the reference.

summary:
[reference generation] A close-up of <Subject 1> curled on a crude bed inside his family''s ruined thatched hut late at night, pale cold moonlight through the torn paper window falling on his face, eyes narrowed, brows tightly knit, restless and uneasy.

retention_analysis:
<Subject 1>: fully_preserved (identity, robe, appearance from <Picture 2>).
Environment: the ruined thatched hut interior — crude straw bed, torn paper window, cold moonlight — established visually, no scene reference asset required.

detailed_description:
[Shot 1] Cinematic, live-action, ancient Chinese xianxia realism, horror-supernatural mood, cold-white moonlight with heavy shadows, a cold-toned scene with a faint warm undercurrent. The shot opens from the reference frame: a close-up of <Subject 1> curled on the crude straw bed inside the ruined thatched hut, the pale moonlight from the torn paper window falling across his face. The camera holds still (fixed) with minimal drift. He shifts restlessly, drawing the straw mat tighter, brows knit, expression uneasy. A faint tremor passes through his shoulders; his fingers clench the mat edge as the moonlight briefly brightens, deepening the shadowed corners of the room. He lets out a low uneasy breath, lips parting slightly, no words. End on the boy staring toward the window, eyes fixed, sensing something unseen in the night.

overall_soundscape:
Night wind seeps through cracked walls, faint creaks of old wood, rustle of the straw mat, shallow uneasy breathing, a distant owl hoot.

non_diegetic_music:
N/A`;

if (Array.isArray(refNode.widgets_values)) {
  refNode.widgets_values[0] = PROMPT;
} else {
  refNode.widgets_values = [PROMPT, 480, 848, 124, "match"];
}

fs.writeFileSync(DST, JSON.stringify(wf, null, 2), "utf-8");
console.log("已生成:", DST);
console.log("主图(分镜图):", MAIN_IMG);
console.log("角色参考:", CHAR_IMG);
console.log("提示词长度:", PROMPT.length);
