// 修复加速版 r2v 工作流：model 链路重接 UNETLoader，断开缺失节点引用
import fs from "node:fs";

const SRC = "E:/AIMovie/AIMovieWorkSpace/.dsh-filess/session-ddac0d3e-158c-4c37-b2c5-60bb089dac6d/cfa2a553b776-加速版-MiniMax+H3｜多参图像音频极速生视频.json";
const DST = "H:/ComfyUI/ComfyUI-V18.1/user/default/workflows/27 MinimaxH3最火视频系列（16G）/九尾狐_H3_r2v_加速版_修复.json";

const wf = JSON.parse(fs.readFileSync(SRC, "utf-8"));
const links = wf.links;

// 1. model 重接：124/126 的 model 输入改接 UNETLoader(127) 输出（258）
const n124 = wf.nodes.find((n) => n.id === 124);
const n126 = wf.nodes.find((n) => n.id === 126);
const m124 = n124.inputs.find((i) => i.name === "model");
const m126 = n126.inputs.find((i) => i.name === "model");
// 断开原 link（256/257），新建 link 258 → 124/126
m124.link = 258;
m126.link = 258;
// UNETLoader 输出 links 补记
const n127 = wf.nodes.find((n) => n.id === 127);
n127.outputs[0].links = [258, 258];

// 2. 断开缺失节点引用：DF_Int_to_Float（164,191-200）→ ImpactSwitch(205) 输入置空
const missing = new Set([164, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 226, 227]);
for (const n of wf.nodes) {
  for (const i of n.inputs ?? []) {
    if (i.link != null) {
      const l = links.find((x) => x[0] === i.link);
      if (l && missing.has(l[1])) i.link = null;
    }
  }
}

// 2.5 EasyCache(136) model 输入已断（视频链被禁用）→ 整体 bypass 它
const n136 = wf.nodes.find((n) => n.id === 136);
if (n136) n136.mode = 4;

// 2.6 ImpactSwitch(205) 输入全断（DF 缺失）→ bypass 它，length 由 132 独立计算
//     132 的 values.a 来自 205 输出 289 → 改接一个固定 PrimitiveFloat
const n205 = wf.nodes.find((n) => n.id === 205);
if (n205) n205.mode = 4;
const n132 = wf.nodes.find((n) => n.id === 132);
const aInput = n132?.inputs?.find((i) => i.name === "values.a" || i.name === "a");
if (aInput) {
  // 找或建一个 PrimitiveFloat 提供 a=6（默认时长）
  let pf = wf.nodes.find((n) => n.type === "PrimitiveFloat" && n.widgets_values?.[0] === 6);
  if (!pf) {
    const maxId = wf.nodes.reduce((m, n) => Math.max(m, Number(n.id) || 0), 0);
    const newId = maxId + 1;
    pf = {
      id: newId,
      type: "PrimitiveFloat",
      pos: [-1600, 6200],
      size: [200, 60],
      flags: {},
      order: 60,
      mode: 0,
      inputs: [{ name: "value", type: "FLOAT", widget: { name: "value" }, link: null }],
      outputs: [{ name: "FLOAT", type: "FLOAT", links: [] }],
      properties: { "Node name for S&R": "PrimitiveFloat" },
      widgets_values: [6],
      title: "时长(a)",
    };
    wf.nodes.push(pf);
  }
  const maxLinkId = wf.links.reduce((m, l) => Math.max(m, Number(l[0]) || 0), 0);
  const newLinkId = maxLinkId + 1;
  const slotIdx = (n132.inputs ?? []).findIndex((i) => i.name === "values.a" || i.name === "a");
  wf.links.push([newLinkId, pf.id, 0, n132.id, slotIdx, "FLOAT"]);
  aInput.link = newLinkId;
  pf.outputs[0].links.push(newLinkId);
}

// 2.7 LoadAudio(247/248/249) 示例音频缺失 → bypass（ref_audios 可选，不影响主链）
for (const n of wf.nodes) {
  if (n.type === "LoadAudio") n.mode = 4;
}

// 2.8 游离 LoadImage（不在 ref_images 链上、且无有效图）→ bypass
//     ref 链：231-239（连到 230 的 ref_image_0..8）；其余（139/206/161）是旧遗留
const n230b = wf.nodes.find((n) => n.id === 230);
const refLinks = new Set(
  (n230b?.inputs ?? [])
    .filter((i) => String(i.name ?? "").startsWith("ref_images."))
    .map((i) => i.link),
);
for (const n of wf.nodes) {
  if (n.type !== "LoadImage") continue;
  const outLink = n.outputs?.[0]?.links?.[0];
  const isRef = refLinks.has(outLink);
  const img = n.widgets_values?.[0];
  const hasImg = typeof img === "string" && img && img !== "None";
  if (!isRef && !hasImg) n.mode = 4; // 游离且空 → 禁用
}

// 3. 补全 ref_images 槽位：确认 231-239 都接上
const n230 = wf.nodes.find((n) => n.id === 230);
console.log("230 输入完整:", (n230.inputs ?? []).filter((i) => i.name.startsWith("ref_images")).map((i) => `${i.name}=${i.link}`).join(" | "));

// 3.5 固定分辨率 480p（竖屏 480×848，H3 9:16 480p）：断开 230 的 width/height 链接，写入 widget 值
//     减少采样分辨率以显著缩短生成时间
const RES_W = 480;
const RES_H = 848;
const widthInput = n230.inputs.find((i) => i.name === "width");
const heightInput = n230.inputs.find((i) => i.name === "height");
if (widthInput) widthInput.link = null;
if (heightInput) heightInput.link = null;
// widgets_values: [prompt, width, height, length, ref_image_size]
if (Array.isArray(n230.widgets_values)) {  n230.widgets_values[1] = RES_W;
  n230.widgets_values[2] = RES_H;
} else {
  n230.widgets_values = ["", RES_W, RES_H, 124, "match"];
}
console.log(`分辨率固定: ${RES_W}x${RES_H} (480p)`);

// 3.6 采样步骤加速：BasicScheduler(124) steps 25 → 8（H3 支持 8 步，双时钟工作流同参数）
if (n124?.widgets_values && Array.isArray(n124.widgets_values)) {
  n124.widgets_values[1] = 8; // steps
  console.log("采样 steps: 25 → 8");
}

// 4. 输出
fs.writeFileSync(DST, JSON.stringify(wf, null, 2), "utf-8");
console.log("已写出:", DST);
