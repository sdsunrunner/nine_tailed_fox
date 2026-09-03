// ComfyUI 视频 Provider（Wan2.2 14B 图生视频）
// 默认工作流：最新万相wan2.2-14B图生视频KJ极速版
// 注入：图片 → LoadImage(131).image；正提示词 → TextInput_(161).text

import fs from "node:fs";
import path from "node:path";
import { workflowToApiPrompt, parseWidgetControlMap, type WidgetControlMap } from "./comfyWorkflow.js";

export interface VideoGenerateInput {
  imagePath: string; // 输入图（oss 相对路径，如 /assets/storyboard/xxx.png）
  prompt: string; // 视频动作/运镜描述（H3 六段式或普通描述）
  refImages?: string[]; // 参考资产图（角色/场景/道具卡，oss 相对路径）→ Ref2VA 多图参考
  videoRatio?: string; // 项目影片比例（9:16 / 16:9 / 1:1 …）→ ResolutionSelector aspect_ratio
  duration?: number; // 视频时长（秒，1-15）→ PrimitiveFloat「视频时长/秒」
}

export interface VideoGenerateResult {
  filePath: string; // /oss/videos/xxx.mp4
  params: Record<string, unknown>;
}

export interface ComfyUIVideoConfig {
  baseUrl: string;
  workflowPath: string;
  ossDir: string; // oss 根（imagePath 的解析根 + 视频落盘根）
}

export class ComfyUIVideoProvider {
  readonly name = "comfyui-video";
  private readonly config: ComfyUIVideoConfig;
  private controlMap: WidgetControlMap | null = null;

  constructor(config: ComfyUIVideoConfig) {
    this.config = config;
  }

  async generate(input: VideoGenerateInput): Promise<VideoGenerateResult> {
    // 1. 上传输入图到 ComfyUI input 目录，得到文件名（r2v 多参考模式主图可为空——由参考资产图驱动）
    let uploadedName: string | null = null;
    if (input.imagePath) {
      const localImage = path.join(this.config.ossDir, input.imagePath.replace(/^\//, ""));
      if (fs.existsSync(localImage)) {
        uploadedName = await this.uploadImage(localImage);
      } else {
        console.warn(`[comfyui-video] 主图不存在: ${localImage}（r2v 多参考模式将跳过主图）`);
      }
    }

    // 1.5 上传参考资产图（Ref2VA 多图参考）
    const uploadedRefs: string[] = [];
    if (input.refImages?.length) {
      for (const refPath of input.refImages) {
        const local = path.join(this.config.ossDir, refPath.replace(/^\//, ""));
        if (!fs.existsSync(local)) continue; // 缺失参考图跳过（不阻断）
        uploadedRefs.push(await this.uploadImage(local));
      }
    }

    // 2. 加载工作流 + 注入
    const wf = JSON.parse(fs.readFileSync(this.config.workflowPath, "utf-8"));
    const hasMainImage = !!uploadedName;
    injectLoadImage(wf, uploadedName);
    if (uploadedRefs.length > 0) {
      injectRefImages(wf, uploadedRefs, hasMainImage);
    }
    try {
      injectVideoPrompt(wf, input.prompt);
    } catch {
      // t2v 等未声明 prompt widget 的工作流：退化写核心节点 widgets_values[0]
      injectVideoPromptT2V(wf, input.prompt);
    }
    injectVideoSeed(wf);
    injectVideoRatio(wf, input.videoRatio);
    injectVideoDuration(wf, input.duration);
    injectVramFix(wf);
    bypassOrphanLoadImages(wf);
    await this.fixLoras(wf); // 校正缺失/不匹配的 lora 引用
    const info = await this.getObjectInfo();
    const apiPrompt = workflowToApiPrompt(wf, parseWidgetControlMap(info), new Set(Object.keys(info)));

    // 3. 提交
    const queue = await this.post("/prompt", {
      prompt: apiPrompt,
      client_id: `nine-tailed-fox-video-${Date.now()}`,
    });
    const promptId = queue.prompt_id;
    if (!promptId) throw new Error("ComfyUI 未返回 prompt_id");

    // 4. 轮询视频输出（视频生成慢，超时 20 分钟）
    const video = await this.pollHistory(promptId);

    // 5. 下载 mp4 到 oss/videos
    const fileName = `video-${Date.now()}.mp4`;
    const absDir = path.join(this.config.ossDir, "videos");
    fs.mkdirSync(absDir, { recursive: true });
    const absPath = path.join(absDir, fileName);
    const viewUrl = `${this.config.baseUrl}/view?filename=${encodeURIComponent(video.filename)}&subfolder=${encodeURIComponent(video.subfolder ?? "")}&type=${encodeURIComponent(video.type ?? "output")}`;
    await this.download(viewUrl, absPath);

    return {
      filePath: `/oss/videos/${fileName}`,
      params: { provider: "comfyui-video", workflow: path.basename(this.config.workflowPath), promptId },
    };
  }

  /** 校正 WanVideoLoraSelect 的 lora 引用（工作流默认 lora 可能未安装） */
  private async fixLoras(wf: any) {
    let loraOptions: string[] | null = null;
    for (const node of wf.nodes) {
      if (node.type !== "WanVideoLoraSelect") continue;
      if (!node.widgets_values || node.widgets_values.length < 2) continue;
      const current = String(node.widgets_values[0]);
      if (loraOptions === null) {
        try {
          const info = await this.get("/object_info");
          const def = info?.["WanVideoLoraSelect"]?.input?.required?.lora;
          loraOptions = Array.isArray(def) && Array.isArray(def[0]) ? def[0] : [];
        } catch {
          loraOptions = [];
        }
      }
      if (loraOptions.length > 0 && !loraOptions.includes(current)) {
        // 替换为匹配的 lora（优先 lightx2v/Wan，其次第一项）
        const match = loraOptions.find((l) => /lightx2v|wan2/i.test(l)) ?? loraOptions[0];
        console.log(`[comfyui-video] lora 校正: ${current} → ${match}`);
        node.widgets_values[0] = match;
      }
    }
  }

  private async uploadImage(localPath: string): Promise<string> {
    const name = path.basename(localPath);
    const form = new FormData();
    form.append("image", new Blob([fs.readFileSync(localPath)], { type: "image/png" }), name);
    form.append("overwrite", "true");
    const res = await fetch(`${this.config.baseUrl}/upload/image`, { method: "POST", body: form });
    if (!res.ok) throw new Error(`上传图片失败 ${res.status}`);
    const data: any = await res.json();
    if (!data.name) throw new Error("上传图片未返回 name");
    return data.name;
  }

  private async pollHistory(promptId: string, timeoutMs = 1_200_000): Promise<{ filename: string; subfolder?: string; type?: string }> {
    const start = Date.now();
    for (;;) {
      if (Date.now() - start > timeoutMs) throw new Error(`视频生成超时（${timeoutMs / 1000}s）`);
      await sleep(3000);
      const hist = await this.get(`/history/${promptId}`);
      const entry = hist?.[promptId];
      if (!entry) continue;
      const outputs = entry.outputs ?? {};
      for (const out of Object.values(outputs) as Array<{
        images?: Array<{ filename: string; subfolder?: string; type?: string }>;
        videos?: Array<{ filename: string; subfolder?: string; type?: string }>;
      }>) {
        // SaveVideo 的 mp4 经 images 字段返回（animated=true）；兼容 videos 字段
        if (out.images && out.images.length > 0) return out.images[0];
        if (out.videos && out.videos.length > 0) return out.videos[0];
      }
    }
  }

  private async getControlMap(): Promise<WidgetControlMap> {
    return parseWidgetControlMap(await this.getObjectInfo());
  }

  private objectInfoCache: Record<string, any> | null = null;
  private async getObjectInfo(): Promise<Record<string, any>> {
    if (!this.objectInfoCache) {
      this.objectInfoCache = await this.get("/object_info");
    }
    return this.objectInfoCache;
  }

  private async post(url: string, body: unknown): Promise<any> {
    const res = await fetch(`${this.config.baseUrl}${url}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ComfyUI POST ${url} 失败 ${res.status}: ${text.slice(0, 800)}`);
    }
    return res.json();
  }

  private async get(url: string): Promise<any> {
    const res = await fetch(`${this.config.baseUrl}${url}`);
    if (!res.ok) throw new Error(`ComfyUI GET ${url} 失败 ${res.status}`);
    return res.json();
  }

  private async download(url: string, dest: string): Promise<void> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`下载视频失败 ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buf);
  }
}

// 主图注入：优先 ReferenceToVideo 的 ref_image_0 源节点（Ref2VA 工作流）；
// 其次 MiniMaxH3ImageToVideo 的 first_frame 源 LoadImage（i2v 工作流）；
// 最后回退第一个 LoadImage
function injectLoadImage(wf: any, uploadedName: string | null) {
  // 无主图（r2v 多参考：未生成首帧）→ 主槽位保持空，由 injectRefImages 从资产图填充 ref_image_0..N
  if (!uploadedName) {
    const refNode0 = wf.nodes.find((n: any) => n.type === "MiniMaxH3ReferenceToVideo");
    if (refNode0) {
      // 清掉模板自带示例图（LoadImage 137/139 等）：置空并 bypass，等待资产图填充
      for (const n of wf.nodes) {
        if (n.type !== "LoadImage") continue;
        const outLink = n.outputs?.[0]?.links?.[0];
        if (outLink == null) continue;
        // 只清连到 r2v ref 槽的 LoadImage 模板图（保留其他 LoadImage）
        const l = wf.links?.find((x: any) => x[0] === outLink);
        if (!l) continue;
        const tgt = wf.nodes.find((x: any) => x.id === l[3]);
        if (tgt?.type !== "MiniMaxH3ReferenceToVideo") continue;
        n.widgets_values = ["None", "image"];
        n.mode = 4;
      }
      console.log("[comfyui-video] 无主图：r2v 模式模板示例图已清空，由参考资产图填充 ref_image_0..N");
      return;
    }
    console.warn("[comfyui-video] 无主图且工作流非 r2v（i2v/t2v 需主图）");
    return;
  }
  // Ref2VA：主图 = ref_image_0 的源 LoadImage
  const refNode = wf.nodes.find((n: any) => n.type === "MiniMaxH3ReferenceToVideo");
  if (refNode) {
    const slot0 = (refNode.inputs ?? []).find((i: any) => i.name === "ref_images.ref_image_0");
    if (slot0?.link != null && Array.isArray(wf.links)) {
      const link = wf.links.find((l: any) => l[0] === slot0.link);
      if (link) {
        let src = wf.nodes.find((n: any) => n.id === link[1]);
        // 若源是被禁用（bypass）的中间节点（如 ResizeShortestToNode），沿其输入向上找 LoadImage 并直连
        if (src && (src.mode === 4 || !src.type.startsWith("LoadImage"))) {
          const up = (src.inputs ?? []).find((i: any) => i.name === "image" && i.link != null);
          if (up) {
            const upLink = wf.links.find((l: any) => l[0] === up.link);
            if (upLink) {
              const upSrc = wf.nodes.find((n: any) => n.id === upLink[1]);
              if (upSrc?.type === "LoadImage") {
                // 直连：新建 link 使 LoadImage → ref_image_0
                const maxLinkId = wf.links.reduce((m: number, l: any) => Math.max(m, Number(l[0]) || 0), 0);
                const newLinkId = maxLinkId + 1;
                wf.links.push([newLinkId, upSrc.id, 0, refNode.id, 3, "IMAGE"]); // slot 3 = ref_image_0
                slot0.link = newLinkId;
                upSrc.mode = 0;
                src = upSrc;
              }
            }
          }
        }
        if (src) {
          if (src.mode === 4) src.mode = 0;
          if (!src.widgets_values) src.widgets_values = [];
          src.widgets_values[0] = uploadedName;
          return;
        }
      }
    }
  }
  // i2v：主图 = MiniMaxH3ImageToVideo.first_frame 的源 LoadImage（沿 bypass 链向上）
  const i2vNode = wf.nodes.find((n: any) => n.type === "MiniMaxH3ImageToVideo");
  if (i2vNode) {
    const ff = (i2vNode.inputs ?? []).find((i: any) => i.name === "first_frame");
    if (ff?.link != null && Array.isArray(wf.links)) {
      const link = wf.links.find((l: any) => l[0] === ff.link);
      if (link) {
        let src = wf.nodes.find((n: any) => n.id === link[1]);
        if (src && (src.mode === 4 || !src.type.startsWith("LoadImage"))) {
          const up = (src.inputs ?? []).find((i: any) => i.name === "image" && i.link != null);
          if (up) {
            const upLink = wf.links.find((l: any) => l[0] === up.link);
            if (upLink) {
              const upSrc = wf.nodes.find((n: any) => n.id === upLink[1]);
              if (upSrc?.type === "LoadImage") src = upSrc;
            }
          }
        }
        if (src?.type === "LoadImage") {
          if (src.mode === 4) src.mode = 0;
          if (!src.widgets_values) src.widgets_values = [];
          src.widgets_values[0] = uploadedName;
          return;
        }
      }
    }
  }
  // 普通工作流：第一个 LoadImage（纯 t2v 工作流无 LoadImage 时跳过——图片注入非必需）
  const node = wf.nodes.find((n: any) => n.type === "LoadImage" && n.mode !== 4);
  if (!node) {
    console.warn("[comfyui-video] 工作流无 LoadImage 节点（纯文本 t2v），跳过图片注入");
    return;
  }
  if (!node.widgets_values) node.widgets_values = [];
  node.widgets_values[0] = uploadedName;
}

// Ref2VA 参考图注入：把参考资产图依次接入 MiniMaxH3ReferenceToVideo 的 ref_image_N 槽位
// hasMainImage=true：主图已占 ref_image_0 → 资产图从 ref_image_1 起；
// hasMainImage=false（r2v 多参考无首帧）：资产图从 ref_image_0 起填主槽（模板示例图会被覆盖）
function injectRefImages(wf: any, refNames: string[], hasMainImage = true) {
  // 找 ReferenceToVideo 节点
  const refNode = wf.nodes.find((n: any) => n.type === "MiniMaxH3ReferenceToVideo");
  if (!refNode) {
    // 非 Ref2VA 工作流：参考图无对应槽位，忽略（保持兼容）
    console.warn("[comfyui-video] 工作流无 MiniMaxH3ReferenceToVideo，参考图已忽略");
    return;
  }
  // 已有 LoadImage 节点清单（第一个已被主图占用）
  const loadImages = wf.nodes.filter((n: any) => n.type === "LoadImage");
  const links = wf.links ?? [];
  let maxLinkId = links.reduce((m: number, l: any) => Math.max(m, Number(l[0]) || 0), 0);

  // 找 ref_images.ref_image_N 输入槽位（name 前缀 ref_images.ref_image_）
  const refInputs = (refNode.inputs ?? []).filter((i: any) =>
    String(i.name ?? "").startsWith("ref_images.ref_image_"),
  );
  const startSlot = hasMainImage ? 1 : 0; // 无主图（r2v 多参考）→ 资产图填主槽 ref_image_0

  for (let k = 0; k < refNames.length; k++) {
    const slotName = `ref_images.ref_image_${k + startSlot}`; // 参考图从 ref_image_0/1 起（按主图占用情况）
    const slot = refInputs.find((i: any) => i.name === slotName);
    if (!slot) {
      console.warn(`[comfyui-video] 无 ${slotName} 槽位，参考图 ${refNames[k]} 已忽略`);
      continue;
    }
    // 该槽位已被链接 → 复用其源 LoadImage（含 bypass 节点：激活并写入图片）
    let srcNode: any = null;
    if (slot.link != null) {
      const link = links.find((l: any) => l[0] === slot.link);
      if (link) {
        srcNode = wf.nodes.find((n: any) => n.id === link[1]);
        if (srcNode?.mode === 4) srcNode.mode = 0; // 激活被禁用的 LoadImage
      }
    }
    if (!srcNode) {
      // 无空闲 LoadImage 则新建（以未使用 id 前缀避免冲突）
      const maxId = wf.nodes.reduce((m: number, n: any) => Math.max(m, Number(n.id) || 0), 0);
      const newId = 10000 + k;
      srcNode = {
        id: newId,
        type: "LoadImage",
        pos: [-2200, 4900 + k * 40],
        size: [320, 260],
        flags: {},
        order: 50 + k,
        mode: 0,
        inputs: [
          { name: "image", type: "COMBO", widget: { name: "image" }, link: null },
          { name: "upload", type: "IMAGEUPLOAD", widget: { name: "upload" }, link: null },
        ],
        outputs: [{ name: "IMAGE", type: "IMAGE", links: [] }],
        properties: { "Node name for S&R": "LoadImage" },
        widgets_values: [refNames[k], "image"],
        title: `参考图 ${k + 1}`,
      };
      wf.nodes.push(srcNode);
      // 建立链接：新 LoadImage 输出 → ref_image_N 输入
      const linkId = ++maxLinkId;
      links.push([linkId, newId, 0, refNode.id, refInputs.indexOf(slot), "IMAGE"]);
      slot.link = linkId;
      srcNode.outputs[0].links.push(linkId);
    } else {
      // 复用已有 LoadImage：只改图片 widget
      srcNode.widgets_values[0] = refNames[k];
    }
  }
  // 清空未使用的参考槽：仍有空 image 的 LoadImage 参考节点 → bypass（避免 None 校验失败）
  for (const slot of refInputs) {
    if (slot.link == null) continue;
    const link = links.find((l: any) => l[0] === slot.link);
    if (!link) continue;
    const src = wf.nodes.find((n: any) => n.id === link[1]);
    const img = src?.widgets_values?.[0];
    const hasImg = typeof img === "string" && img && img !== "None";
    if (src?.type === "LoadImage" && !hasImg) {
      src.mode = 4; // 空参考图 → 禁用
    }
  }
}

// 提示词注入：找第一个含 prompt widget 输入的节点（MinimaxH3 / Wan 均适用）
// 若 prompt 输入已被 Primitive* 节点连接，改写入源 primitive 节点的值（内联到消费方）
function injectVideoPrompt(wf: any, prompt: string) {
  const node = wf.nodes.find((n: any) =>
    (n.inputs ?? []).some((i: any) => i.name === "prompt" && i.widget),
  );
  if (!node) throw new Error("工作流中未找到 prompt widget 输入节点");
  if (!node.widgets_values) node.widgets_values = [];

  // 检查 prompt 输入是否被源节点连接（Primitive* 或 CR Prompt Text 等文本源）
  // 被连接时 widget 值无效，必须写入源节点才能生效
  const promptInput = (node.inputs ?? []).find((i: any) => i.name === "prompt" && i.widget);
  if (promptInput?.link != null && Array.isArray(wf.links)) {
    const link = wf.links.find((l: any) => l[0] === promptInput.link);
    if (link) {
      const src = wf.nodes.find((n: any) => n.id === link[1]);
      if (src && Array.isArray(src.widgets_values) && src.widgets_values.length > 0) {
        // 文本源节点（Primitive* / CR Prompt Text / Text 类）：写第一个 widget（文本值）
        const first = src.widgets_values[0];
        if (typeof first === "string" || first == null) {
          src.widgets_values[0] = prompt;
          return;
        }
      }
    }
  }

  // 常规路径：写入 prompt widget 值
  const widgetInputs = (node.inputs ?? []).filter((i: any) => i.widget);
  const idx = widgetInputs.findIndex((i: any) => i.name === "prompt");
  if (idx < 0) throw new Error("未找到 prompt widget");
  while (node.widgets_values.length <= idx) node.widgets_values.push("");
  node.widgets_values[idx] = prompt;
}

// 提示词注入（兼容 t2v）：部分工作流的 ImageToVideo/ReferenceToVideo 未在 inputs 声明 prompt widget，
// prompt 是 widgets_values[0]。找不到声明式 prompt 时，找核心生成节点写 widgets_values[0]。
function injectVideoPromptT2V(wf: any, prompt: string) {
  const core = wf.nodes.find((n: any) =>
    n.type === "MiniMaxH3ImageToVideo" || n.type === "MiniMaxH3ReferenceToVideo" || n.type === "MiniMaxH3TextToVideo",
  );
  if (!core) throw new Error("工作流中未找到 H3 生成节点");
  if (!core.widgets_values) core.widgets_values = [];
  core.widgets_values[0] = prompt; // t2v/i2v 的 prompt 是第一个 widget
}

// 种子注入：找 noise_seed / seed widget
// 若该 widget 输入被源节点连接（SeedNode 等），直写 widget 值不生效 → 写入源节点的 seed widget
function injectVideoSeed(wf: any) {
  const node = wf.nodes.find((n: any) =>
    (n.inputs ?? []).some((i: any) => (i.name === "noise_seed" || i.name === "seed") && i.widget),
  );
  if (!node) return;
  const widgetInputs = (node.inputs ?? []).filter((i: any) => i.widget);
  const idx = widgetInputs.findIndex((i: any) => i.name === "noise_seed" || i.name === "seed");
  if (idx < 0) return;

  // 若 seed 输入被源节点连接（SeedNode / Primitive 等），写入源节点（直写本节点 widget 无效）
  const seedInput = widgetInputs[idx];
  if (seedInput.link != null && Array.isArray(wf.links)) {
    const link = wf.links.find((l: any) => l[0] === seedInput.link);
    if (link) {
      const src = wf.nodes.find((n: any) => n.id === link[1]);
      if (src && Array.isArray(src.widgets_values) && src.widgets_values.length > 0) {
        const first = src.widgets_values[0];
        if (typeof first === "number" || typeof first === "string" || first == null) {
          src.widgets_values[0] = Math.floor(Math.random() * 2 ** 31);
          return;
        }
      }
    }
  }

  // 常规路径：直写 widget 值
  if (!node.widgets_values) node.widgets_values = [];
  while (node.widgets_values.length <= idx) node.widgets_values.push("");
  node.widgets_values[idx] = Math.floor(Math.random() * 2 ** 31);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// 项目比例 → ResolutionSelector.aspect_ratio（ComfyUI 选项文本）
// 支持 9:16 / 16:9 / 1:1 / 3:4 / 4:3 / 2:3 / 3:2 / 21:9 及 "9:16 (Portrait Widescreen)" 等带后缀写法
const RATIO_OPTIONS: Record<string, string> = {
  "1:1": "1:1 (Square)",
  "2:3": "2:3 (Portrait Photo)",
  "3:2": "3:2 (Photo)",
  "3:4": "3:4 (Portrait Standard)",
  "4:3": "4:3 (Standard)",
  "9:16": "9:16 (Portrait Widescreen)",
  "16:9": "16:9 (Widescreen)",
  "21:9": "21:9 (Ultrawide)",
};

function injectVideoRatio(wf: any, ratio?: string) {
  if (!ratio) return;
  const node = wf.nodes.find((n: any) => n.type === "ResolutionSelector");
  if (!node) return; // 无 ResolutionSelector 的工作流跳过
  const option = RATIO_OPTIONS[ratio] ?? RATIO_OPTIONS[ratio.split(" ")[0]];
  if (!option) return; // 未识别的比例不注入
  if (!node.widgets_values) node.widgets_values = [];
  node.widgets_values[0] = option;
  console.log(`[comfyui-video] 分辨率比例注入: ${ratio} → ${option}`);
}

// 视频时长注入：找 PrimitiveFloat「视频时长/秒」（ComfyMathExpression 的 values.a 源），写秒数
function injectVideoDuration(wf: any, duration?: number) {
  if (!duration || duration < 1) return;
  const node = wf.nodes.find(
    (n: any) =>
      n.type === "PrimitiveFloat" &&
      /时长|duration/i.test(String(n.title ?? "") + " " + String(n.widgets_values?.[1] ?? "")),
  );
  if (!node) {
    console.warn("[comfyui-video] 未找到「视频时长/秒」PrimitiveFloat，时长未注入");
    return;
  }
  if (!node.widgets_values) node.widgets_values = [];
  node.widgets_values[0] = duration;
  console.log(`[comfyui-video] 视频时长注入: ${duration}s`);
}

// ReservedVRAMSetter 修复：auto_max_reserved 必须是数字（模板残留 "randomize" 会让 ComfyUI
// validation 失败并忽略整条输出链）
function injectVramFix(wf: any) {
  for (const n of wf.nodes) {
    if (n.type !== "ReservedVRAMSetter") continue;
    if (!Array.isArray(n.widgets_values)) continue;
    // 按 inputs 顺序定位 auto_max_reserved 的 widget 位
    const widgetInputs = (n.inputs ?? []).filter((i: any) => i.widget);
    const idx = widgetInputs.findIndex((i: any) => i.name === "auto_max_reserved");
    if (idx < 0) continue;
    const v = n.widgets_values[idx];
    if (typeof v === "number") continue;
    n.widgets_values[idx] = 0.0; // FLOAT 默认 0（不设上限）
    console.log(`[comfyui-video] ReservedVRAMSetter auto_max_reserved 校正: ${JSON.stringify(v)} → 0.0`);
  }
}

// 无输出连接的废弃 LoadImage → bypass（避免提交不存在的模板图，如 H3 工作流的 LoadImage 136）
function bypassOrphanLoadImages(wf: any) {
  for (const n of wf.nodes) {
    if (n.type !== "LoadImage") continue;
    const outLink = n.outputs?.[0]?.links?.[0];
    if (outLink == null && n.mode !== 4) {
      n.mode = 4;
      console.log(`[comfyui-video] 废弃 LoadImage(${n.id}) → bypass`);
    }
  }
}
