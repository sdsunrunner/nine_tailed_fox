// ComfyUI 图像 Provider（M3 真实出图）
// 默认工作流：24 角色三视图生成系列 / AI短剧漫剧专用超逼真人物设定集 Z-IMAGE文生图.json
// 注入策略：提示词 → CR Text 节点（widgets_values[0]）；种子 → KSampler 节点（widgets_values[0]）

import fs from "node:fs";
import path from "node:path";
import { workflowToApiPrompt, parseWidgetControlMap, type WidgetControlMap } from "./comfyWorkflow.js";
import type { ImageProvider, ImageGenerateInput, ImageGenerateResult } from "./image.js";

export interface WorkflowSpec {
  /** 工作流 JSON 绝对路径 */
  path: string;
  /** 提示词注入节点类型：CR Text（Comfyroll）或 CLIPTextEncode */
  promptNodeType: "CR Text" | "CLIPTextEncode";
  /** 尺寸注入（EmptyLatentImage）；缺省则用工作流自带尺寸 */
  size?: [number, number];
  /** 参考图槽位 → LoadImage 节点 id（如 { character: 81, scene: 76, prop: 99 }），分镜首帧参考图注入用 */
  refImageNodeIds?: Record<string, number>;
}

export interface ComfyUIConfig {
  baseUrl: string; // http://127.0.0.1:8188
  workflows: Record<string, WorkflowSpec>; // 按资产类型（character/scene/prop）映射
  ossDir: string; // 生成图落盘目录（静态服务 /oss 根）
  defaultType?: string; // 未知类型回退
  /** 图生图（img2img）参数：scene/prop 有参考图时用 */
  i2i?: {
    /** 图生图去噪强度（denoise）：0.5~0.9，越大越偏离参考图 */
    denoise?: number;
    /** 重绘比例（参考图缩放目标尺寸；缺省用类型工作流 size） */
  };
}

interface QueueResponse {
  prompt_id: string;
  number?: number;
}

interface HistoryImage {
  filename: string;
  subfolder: string;
  type: string;
}

export class ComfyUIProvider implements ImageProvider {
  readonly name = "comfyui";
  private readonly config: ComfyUIConfig;
  private controlMap: WidgetControlMap | null = null;

  constructor(config: ComfyUIConfig) {
    this.config = config;
  }

  async generate(input: ImageGenerateInput): Promise<ImageGenerateResult> {
    const spec = this.config.workflows[input.type] ?? this.config.workflows[this.config.defaultType ?? "character"];
    if (!spec) throw new Error(`未配置资产类型 ${input.type} 的工作流`);

    // 图生图（scene/prop 有参考图）：程序化构建 img2img prompt（LoadImage→ImageScale→VAEEncode→KSampler denoise）
    if (input.refImage) {
      return this.generateImg2Img(input, spec);
    }

    // 1. 加载并注入工作流（提示词/种子/尺寸/参考图）
    const wf = JSON.parse(fs.readFileSync(spec.path, "utf-8"));
    injectPrompt(wf, input.prompt, spec.promptNodeType);
    injectSeed(wf);
    // 参考图（角色/场景/道具）→ 上传到 ComfyUI input 并写入对应 LoadImage 节点
    if (input.refImages && spec.refImageNodeIds) {
      for (const [slot, relPath] of Object.entries(input.refImages)) {
        const nodeId = spec.refImageNodeIds[slot];
        if (nodeId == null || !relPath) continue;
        const node = wf.nodes.find((n: any) => n.id === nodeId);
        if (!node) continue;
        const local = path.join(this.config.ossDir, relPath.replace(/^\/+/, "").replace(/^oss\//, ""));
        if (!fs.existsSync(local)) {
          console.warn(`[comfyui] 参考图 ${slot} 不存在: ${local}`);
          continue;
        }
        const uploaded = await this.uploadImage(local);
        if (!node.widgets_values) node.widgets_values = [];
        node.widgets_values[0] = uploaded;
        if (node.mode === 4) node.mode = 0; // 激活被 bypass 的 LoadImage
        console.log(`[comfyui] 参考图 ${slot} → ${uploaded}`);
      }
      // 未提供的参考槽位 → bypass 整条参考链（LoadImage→Kontext缩放→VAEEncode），避免空文件报错
      for (const [slot, nodeId] of Object.entries(spec.refImageNodeIds)) {
        if ((input.refImages ?? {})[slot]) continue;
        bypassRefChain(wf, Number(nodeId));
      }
    }
    // 分镜图按项目比例换算尺寸（短边 720，长边按比例；无 ratio 用工作流默认尺寸）
    if (input.type === "storyboard" && input.ratio) {
      const size = ratioSize(input.ratio, spec.size ?? [720, 1280]);
      injectSize(wf, size);
    } else if (spec.size) {
      injectSize(wf, spec.size);
    }
    const apiPrompt = workflowToApiPrompt(wf, await this.getControlMap());

    // 2. 提交 /prompt
    const queue: QueueResponse = await this.post("/prompt", { prompt: apiPrompt, client_id: `nine-tailed-fox-${Date.now()}` });
    const promptId = queue.prompt_id;
    if (!promptId) throw new Error("ComfyUI 未返回 prompt_id");

    // 3. 轮询 /history 直到出图（最多 10 分钟）
    const images = await this.pollHistory(promptId);

    // 4. 取第一张图，下载到 oss
    const first = images[0];
    if (!first) throw new Error("ComfyUI 执行完成但无输出图片");

    const fileName = `${input.type}-${input.name}-${Date.now()}.png`;
    const relDir = `assets/${input.type}`;
    const absDir = path.join(this.config.ossDir, relDir);
    fs.mkdirSync(absDir, { recursive: true });
    const absPath = path.join(absDir, fileName);

    const viewUrl = `${this.config.baseUrl}/view?filename=${encodeURIComponent(first.filename)}&subfolder=${encodeURIComponent(first.subfolder)}&type=${encodeURIComponent(first.type)}`;
    await this.download(viewUrl, absPath);

    return {
      filePath: `/oss/${relDir}/${fileName}`,
      params: { provider: "comfyui", workflow: path.basename(spec.path), promptId },
    };
  }

  /** 懒加载 /object_info → widget control 映射 */
  private async getControlMap(): Promise<WidgetControlMap> {
    if (!this.controlMap) {
      const info = await this.get("/object_info");
      this.controlMap = parseWidgetControlMap(info);
    }
    return this.controlMap;
  }

  /** 图生图（img2img）：scene/prop 有参考图 → LoadImage→ImageScale→VAEEncode→KSampler(denoise)
   *  模型与文生图工作流一致（从 spec.path 读 UNET/CLIP/VAE 模型名），尺寸取类型工作流 size */
  private async generateImg2Img(input: ImageGenerateInput, spec: WorkflowSpec): Promise<ImageGenerateResult> {
    // 1. 参考图上传到 ComfyUI input
    const local = path.join(this.config.ossDir, input.refImage!.replace(/^\/+/, "").replace(/^oss\//, ""));
    if (!fs.existsSync(local)) throw new Error(`图生图参考图不存在: ${local}`);
    const uploaded = await this.uploadImage(local);

    // 2. 从文生图工作流提取模型名（UNET/CLIP/VAE 的 widgets_values[0]），保证同款模型
    let unet = "z_image_turbo_bf16.safetensors";
    let clip = "qwen_3_4b.safetensors";
    let vae = "Z-VAE.safetensors";
    try {
      const wf = JSON.parse(fs.readFileSync(spec.path, "utf-8"));
      const loader = (type: string, fallback: string) => {
        const n = wf.nodes?.find((x: any) => x.type === type);
        return n?.widgets_values?.[0] ?? fallback;
      };
      unet = loader("UNETLoader", unet);
      clip = loader("CLIPLoader", clip);
      vae = loader("VAELoader", vae);
    } catch {
      /* 提取失败用默认模型名 */
    }

    // 3. 尺寸：类型工作流 size（scene 1216×704 / prop 1024×1024）
    const size = spec.size ?? [1024, 1024];
    const denoise = this.config.i2i?.denoise ?? 0.65;
    const seed = Math.floor(Math.random() * 2 ** 31);

    // 4. 程序化构建 API prompt（节点 id 稳定自编）
    const apiPrompt: Record<string, any> = {
      "1": { class_type: "UNETLoader", inputs: { unet_name: unet, weight_dtype: "default" } },
      "2": { class_type: "CLIPLoader", inputs: { clip_name: clip, type: "qwen_image", device: "default" } },
      "3": { class_type: "VAELoader", inputs: { vae_name: vae } },
      "4": { class_type: "LoadImage", inputs: { image: uploaded } },
      "5": { class_type: "ImageScale", inputs: { image: ["4", 0], upscale_method: "lanczos", width: size[0], height: size[1], crop: "disabled" } },
      "6": { class_type: "VAEEncode", inputs: { pixels: ["5", 0], vae: ["3", 0] } },
      "7": { class_type: "CLIPTextEncode", inputs: { text: input.prompt, clip: ["2", 0] } },
      "8": { class_type: "CLIPTextEncode", inputs: { text: "", clip: ["2", 0] } },
      "9": { class_type: "KSampler", inputs: { model: ["1", 0], positive: ["7", 0], negative: ["8", 0], latent_image: ["6", 0], seed, steps: 10, cfg: 1, sampler_name: "euler", scheduler: "simple", denoise } },
      "10": { class_type: "VAEDecode", inputs: { samples: ["9", 0], vae: ["3", 0] } },
      "11": { class_type: "SaveImage", inputs: { images: ["10", 0], filename_prefix: "ComfyUI" } },
    };

    // 5. 提交
    const queue: QueueResponse = await this.post("/prompt", { prompt: apiPrompt, client_id: `nine-tailed-fox-i2i-${Date.now()}` });
    const promptId = queue.prompt_id;
    if (!promptId) throw new Error("ComfyUI 未返回 prompt_id");

    // 6. 轮询出图
    const images = await this.pollHistory(promptId);
    const first = images[0];
    if (!first) throw new Error("ComfyUI 执行完成但无输出图片");

    // 7. 下载到 oss
    const fileName = `${input.type}-${input.name}-${Date.now()}.png`;
    const relDir = `assets/${input.type}`;
    const absDir = path.join(this.config.ossDir, relDir);
    fs.mkdirSync(absDir, { recursive: true });
    const absPath = path.join(absDir, fileName);
    const viewUrl = `${this.config.baseUrl}/view?filename=${encodeURIComponent(first.filename)}&subfolder=${encodeURIComponent(first.subfolder)}&type=${encodeURIComponent(first.type)}`;
    await this.download(viewUrl, absPath);

    return {
      filePath: `/oss/${relDir}/${fileName}`,
      params: { provider: "comfyui", mode: "img2img", workflow: path.basename(spec.path), promptId, denoise },
    };
  }

  private async pollHistory(promptId: string, timeoutMs = 600_000): Promise<HistoryImage[]> {
    const start = Date.now();
    for (;;) {
      if (Date.now() - start > timeoutMs) throw new Error(`ComfyUI 生成超时（${timeoutMs / 1000}s）`);
      await sleep(1500);
      const hist = await this.get(`/history/${promptId}`);
      const entry = hist?.[promptId];
      if (!entry) continue;
      const outputs = entry.outputs ?? {};
      const images: HistoryImage[] = [];
      for (const out of Object.values(outputs) as Array<{ images?: HistoryImage[] }>) {
        if (out.images) images.push(...out.images);
      }
      if (images.length > 0) return images;
      const status = entry.status;
      if (status && (status.status_str === "error" || status.completed === false && status.status_str !== undefined && images.length === 0)) {
        // 继续轮询（部分节点错误时 status 无 images）
      }
    }
  }

  /** 上传本地图片到 ComfyUI input 目录，返回文件名（参考图注入用） */
  private async uploadImage(localPath: string): Promise<string> {
    const name = path.basename(localPath);
    const form = new FormData();
    form.append("image", new Blob([fs.readFileSync(localPath)], { type: "image/png" }), name);
    form.append("overwrite", "true");
    const res = await fetch(`${this.config.baseUrl}/upload/image`, { method: "POST", body: form });
    if (!res.ok) throw new Error(`上传参考图失败 ${res.status}`);
    const data: any = await res.json();
    if (!data.name) throw new Error("上传参考图未返回 name");
    return data.name;
  }

  private async post(url: string, body: unknown): Promise<any> {
    const res = await fetch(`${this.config.baseUrl}${url}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ComfyUI POST ${url} 失败 ${res.status}: ${text.slice(0, 500)}`);
    }
    return res.json();
  }

  private async get(url: string): Promise<any> {
    const res = await fetch(`${this.config.baseUrl}${url}`);
    if (!res.ok) throw new Error(`ComfyUI GET ${url} 失败 ${res.status}`);
    return res.json();
  }

  private async download(url: string, dest: string): Promise<void> {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`下载生成图失败 ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(dest, buf);
    } catch (e) {
      console.error("[comfyui] 下载失败 dest=", JSON.stringify(dest), "err=", (e as Error).message);
      throw e;
    }
  }
}

// 提示词注入：按节点类型（CR Text 或 CLIPTextEncode）
function injectPrompt(wf: any, prompt: string, nodeType: "CR Text" | "CLIPTextEncode") {
  const node = wf.nodes.find((n: any) => n.type === nodeType);
  if (!node) throw new Error(`工作流中未找到 ${nodeType} 节点（提示词注入点）`);
  if (!node.widgets_values || node.widgets_values.length === 0) node.widgets_values = [""];
  node.widgets_values[0] = prompt;
}

// 参考槽位无图时 → 禁用该 LoadImage 及其下游参考链（Kontext 缩放 / VAEEncode），
// 使对应参考 latent 输入变为未连接（场景/道具为可选槽，无碍；避免空文件校验失败）
// 只绕过 LoadImage→ImageScale→VAEEncode 三级；遇到 Flux2Klein 多参考节点即停（它是主生成链，必须保留）
function bypassRefChain(wf: any, loadImageId: number) {
  const loadNode = wf.nodes.find((n: any) => n.id === loadImageId);
  if (!loadNode) return;
  loadNode.mode = 4;
  let curId = loadImageId;
  for (let i = 0; i < 2; i++) {
    const l = wf.links.find((x: any) => x[1] === curId && x[2] === 0);
    if (!l) break;
    const next = wf.nodes.find((n: any) => n.id === l[3]);
    if (!next) break;
    if (/Flux2Klein|MultiReferenceLatent|ReferenceLatentMethod/.test(next.type)) break; // 多参考主节点不绕过
    next.mode = 4;
    curId = next.id;
  }
  console.log(`[comfyui] 参考链 LoadImage(${loadImageId}) 无参考图 → bypass`);
}

// 种子注入：找第一个 KSampler 节点，置为随机
function injectSeed(wf: any) {
  const node = wf.nodes.find((n: any) => n.type === "KSampler");
  if (!node) return;
  if (!node.widgets_values) node.widgets_values = [];
  node.widgets_values[0] = Math.floor(Math.random() * 2 ** 31);
}

// 尺寸注入：找第一个 EmptyLatentImage 节点
function injectSize(wf: any, size: [number, number]) {
  const node = wf.nodes.find((n: any) => n.type === "EmptyLatentImage");
  if (!node) return;
  if (!node.widgets_values) node.widgets_values = [];
  node.widgets_values[0] = size[0];
  node.widgets_values[1] = size[1];
  node.widgets_values[2] = 1;
}

// 影片比例 → 分镜图尺寸：短边保持 base 短边（720），长边按比例取整到 8 的倍数
function ratioSize(ratio: string, base: [number, number]): [number, number] {
  const r = ratio.split(":")[0] === ratio ? ratio : ratio.split(" ")[0]; // 9:16 / 16:9 / 1:1 …
  const [rw, rh] = r.split(":").map((x) => parseFloat(x));
  if (!rw || !rh || !isFinite(rw) || !isFinite(rh)) return base;
  const round8 = (v: number) => Math.max(64, Math.round(v / 8) * 8);
  const long = (base[0] >= base[1] ? base[0] : base[1]) as number; // 模板长边
  if (rw >= rh) {
    // 横屏：宽 = 长边，高按比例
    return [round8(long), round8((long * rh) / rw)];
  }
  // 竖屏：高 = 长边，宽按比例
  return [round8((long * rw) / rh), round8(long)];
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
