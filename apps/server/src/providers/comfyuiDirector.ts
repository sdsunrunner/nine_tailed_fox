// ComfyUI MiniMaxH3 Director 长视频 Provider
// 把一集的全部分镜组装成 Director 时间线（每分镜 = 1 段 r2v 多图参考生成），
// 提供角色/场景/道具参考图 + <Picture N> 描述，依赖 Director 段间引导(continuity) 一次生成一集，
// 分段导出每段独立 mp4。提交云端 ComfyUI 生成；支持 run-select 只重跑指定段。
// 依赖：ComfyUI_MiniMaxH3_Director + ComfyUI-MiniMaxH3-ChainDirector（云端 custom_nodes）

import fs from "node:fs";
import path from "node:path";

// Director 节点 task 类型：r2v（参考主体生视频，多图参考约束角色/场景/道具一致性）
const TASK_R2V = "r2v — 参考主体生视频(Reference to Video)";

// 参考图类型 → <Picture N> 描述前缀
const REF_DESC_PREFIX: Record<string, string> = {
  character: "该角色正面全身设定图（身份/服装/面容/体型以此为准）",
  scene: "该场景环境设定图（空间布局/光线/色调以此为准）",
  prop: "该道具外观设定图（形状/材质/细节以此为准）",
};

export interface DirectorEpisodeOptions {
  projectId: number;
  episodeId: number;
  ossDir: string; // 九尾狐 oss 根（参考图解析根 + 视频落盘根）
  modelPath: string; // 不用 —— Director 用工作流内 UNETLoader
  workflowApiPath: string; // 基础 Director API 工作流 JSON（含模型加载/输出节点）
  baseUrl: string; // 云端 ComfyUI
  comfyOutputDir?: string; // ComfyUI output 根（扫描 segment 缓存用）；缺省无法感知分段进度
  videoRatio?: string; // 9:16 / 16:9 / 1:1
  videoSize?: [number, number]; // 强制视频尺寸（覆盖 videoRatio，用于低显存调优）
  durationPerSeg?: number; // 每段秒数（默认 5）
  seed?: number;
  steps?: number;
}

// 参考图条目：文件名 + <Picture N> 描述
interface RefImage {
  file: string; // ComfyUI input 文件名
  picture: number; // <Picture N> 编号
  desc: string; // 该图的中文描述（角色/场景/道具）
  type: string; // character/scene/prop
  name: string; // 资产名（角色名/场景名），用于分镜 prompt 的 <Picture> 引用匹配
}

export interface DirectorGenerateResult {
  filePath: string; // /oss/videos/long_xxx.mp4
  promptId: string;
  segmentCount: number;
  totalFrames: number;
}

/** 读取一集分镜，返回按 index 排序的数组 */
export async function collectEpisodeStoryboards(projectId: number, episodeId: number, prisma: any) {
  return prisma.storyboard.findMany({
    where: { projectId, episodeId },
    orderBy: { index: "asc" },
  });
}

/** 收集本集已出图参考资产（角色/场景/道具，带 /oss 相对路径；同 类型+名字 去重取最新一张） */
export async function collectEpisodeAssets(projectId: number, episodeId: number, prisma: any) {
  const assets = await prisma.asset.findMany({
    where: { projectId, episodeId, filePath: { not: null }, type: { in: ["character", "scene", "prop"] } },
    orderBy: { id: "asc" },
  });
  // 类型+名字去重：同名同类型多卡（重生成/多卡残留）只取最新一张，避免 Picture 冲突
  const seen = new Map<string, any>();
  for (const a of assets) {
    const key = `${a.type}:${a.name}`;
    const prev = seen.get(key);
    if (!prev || a.id > prev.id) seen.set(key, a);
  }
  return [...seen.values()].map((a: any) => ({ ...a, relPath: a.filePath.replace(/^\/oss/, "") }));
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export class ComfyUIDirectorProvider {
  readonly name = "comfyui-director";
  private readonly cfg: DirectorEpisodeOptions;
  private objectInfoCache: Record<string, any> | null = null;
  private lastDirectorNodeId: string | null = null;

  constructor(cfg: DirectorEpisodeOptions) {
    this.cfg = cfg;
  }

  /** 上传本地图片到 ComfyUI input，返回文件名 */
  private async uploadImage(localPath: string): Promise<string> {
    const name = path.basename(localPath);
    const form = new FormData();
    form.append("image", new Blob([fs.readFileSync(localPath)], { type: "image/png" }), name);
    form.append("overwrite", "true");
    const res = await fetch(`${this.cfg.baseUrl}/upload/image`, { method: "POST", body: form });
    if (!res.ok) throw new Error(`上传图片失败 ${res.status}: ${await res.text()}`);
    const data: any = await res.json();
    if (!data.name) throw new Error("上传图片未返回 name");
    return data.name;
  }

  private async getObjectInfo(): Promise<Record<string, any>> {
    if (!this.objectInfoCache) {
      this.objectInfoCache = await (await fetch(`${this.cfg.baseUrl}/object_info`)).json();
    }
    return this.objectInfoCache;
  }

  /**
   * 组装 Director 时间线 JSON（r2v 多图参考模式）：
   * - global.refs 挂角色/场景/道具参考图（全片共享一致性）
   * - 每段提示词 = 分镜 videoDesc + <Picture N> 参考图描述（告诉模型每张图是什么）
   * - continuity 段间引导开启（上一段尾帧接力下一段）
   * - exportMode = segments（分段导出，每段独立 mp4）
   */
  private buildTimeline(
    segments: Array<{ prompt: string; negativePrompt?: string; refs: RefImage[] }>,
    globalRefs: RefImage[],
    opts: { totalFrames: number; width: number; height: number; frameRate: number; runSelection?: number[]; continuity?: boolean },
  ) {
    // 参考图描述块：<Picture N> 是「角色/场景/道具」的正面设定图
    const globalRefBlock = globalRefs.map((r) => r.desc).join("\n");
    const tl = {
      version: 4,
      editMode: "global",
      timelineMode: "gen_blank",
      totalFrames: opts.totalFrames,
      frameRate: opts.frameRate,
      width: opts.width,
      height: opts.height,
      refMaxSize: opts.width,
      output: {
        mode: "fixed",
        longEdge: opts.width,
        width: opts.width,
        height: opts.height,
        maxExportFrames: 0,
        exportMode: "segments", // 分段导出：每段独立 mp4
        continuityEnabled: opts.continuity ?? true, // 段间引导（尾帧接力）
        continuityOverlapFrames: 22,
      },
      videoClips: [],
      video: { fileName: "", videoFile: "", subfolder: "", type: "input", frames: [], frameMap: [] },
      global: {
        taskType: TASK_R2V,
        prompt: globalRefBlock || "短剧镜头序列，人物形象与场景保持一致。",
        refs: globalRefs.map((r) => ({ imageFile: r.file, subfolder: "", type: "image", index: r.picture })),
        referenceVideo: {},
        continuousReference: false,
        genImage: { imageFile: "" },
      },
      segments: segments.map((s, i) => ({
        id: `shot${i}`,
        start: i * opts.totalFrames / segments.length,
        length: opts.totalFrames / segments.length,
        frameCount: opts.totalFrames / segments.length,
        durationSec: opts.totalFrames / opts.frameRate / segments.length,
        prompt: s.prompt || "",
        negativePrompt: s.negativePrompt || "",
        isStartFrame: false,
        isEndFrame: i === segments.length - 1,
        genImage: { imageFile: "" },
        endImage: {},
        taskType: TASK_R2V,
        refs: s.refs.map((r) => ({ imageFile: r.file, subfolder: "", type: "image", index: r.picture })),
      })),
      gen: { defaultFrameCount: opts.totalFrames / segments.length },
      runSelectEnabled: !!opts.runSelection,
      runSelection: opts.runSelection ?? [],
    };
    return tl;
  }

  /** 组装并提交 Director API prompt */
  private async submit(
    segments: Array<{ prompt: string; negativePrompt?: string; refs: RefImage[] }>,
    globalRefs: RefImage[],
    opts: { totalFrames: number; width: number; height: number; runSelection?: number[]; seed: number; steps: number; continuity?: boolean; styleHint?: string },
  ): Promise<{ promptId: string; directorNodeId: string }> {
    // 基础工作流模板（含模型加载 + Director + CreateVideo + SaveVideo 的 API dict）
    const wf = JSON.parse(fs.readFileSync(this.cfg.workflowApiPath, "utf-8"));
    const tl = this.buildTimeline(segments, globalRefs, {
      totalFrames: opts.totalFrames,
      width: opts.width,
      height: opts.height,
      frameRate: 24,
      runSelection: opts.runSelection,
      continuity: opts.continuity,
    });

    // 定位 Director 节点
    let directorNodeId: string | null = null;
    for (const [id, node] of Object.entries(wf)) {
      const cls = (node as any).class_type ?? "";
      if (cls === "MiniMaxH3Director") { directorNodeId = id; break; }
    }
    if (!directorNodeId) throw new Error("Director 工作流模板中未找到 MiniMaxH3Director 节点");

    // 参考图描述块（<Picture N> 是什么）+ 全片画风约束 → 写入全局提示词
    const globalRefBlock = globalRefs.map((r) => r.desc).join("\n");
    const styleHint = opts.styleHint?.trim() ?? "";
    const globalPrompt = [
      globalRefBlock || "短剧镜头序列，人物形象与场景保持一致。",
      styleHint ? `全片画面风格（必须严格遵循，不得偏离）：${styleHint}。纯水墨风格、禁止写实电影感、禁止高饱和彩色。` : "",
    ].filter(Boolean).join("\n");
    const dirNode = wf[directorNodeId];
    dirNode.inputs = {
      ...dirNode.inputs,
      task_type: TASK_R2V,
      global_prompt: globalPrompt,
      bd_grp_sample: "采样设置",
      bd_grp_advanced: "高级采样",
      bd_grp_perf: "性能",
      cfg: 1.0,
      seed: opts.seed,
      frame_rate: 24,
      width: opts.width,
      height: opts.height,
      ref_max_size: opts.width,
      total_frames: opts.totalFrames,
      timeline_data: JSON.stringify(tl),
      steps: opts.steps,
      sampler: "res_multistep",
      scheduler: "simple",
      shift_video: 12,
      shift_audio: 3,
      clear_vram_between_segments: false,
      export_source_images: false,
    };

    // SaveVideo 补必填参数（模板可能缺）
    for (const [id, node] of Object.entries(wf)) {
      const cls = (node as any).class_type ?? "";
      if (cls === "SaveVideo") {
        (node as any).inputs.format = (node as any).inputs.format ?? "mp4";
        (node as any).inputs.codec = (node as any).inputs.codec ?? "h264";
      }
    }

    const res = await fetch(`${this.cfg.baseUrl}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: wf, client_id: `ninefox-director-${Date.now()}` }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`ComfyUI 提交失败 ${res.status}: ${text.slice(0, 800)}`);
    const j = JSON.parse(text);
    if (!j.prompt_id) throw new Error(`ComfyUI 未返回 prompt_id: ${text.slice(0, 500)}`);
    return { promptId: j.prompt_id, directorNodeId };
  }

  /** 扫描 ComfyUI segment 缓存，返回已完成段数（基于已落盘的 seg latent 文件） */
  private getCompletedSegments(directorNodeId: string): number {
    if (!this.cfg.comfyOutputDir) return 0;
    try {
      const dir = path.join(this.cfg.comfyOutputDir, "minimax_seg_cache", directorNodeId);
      if (!fs.existsSync(dir)) return 0;
      const segs = fs.readdirSync(dir).filter((f) => /^seg_\d+\.pt$/.test(f));
      // seg_N.pt 存在即该段已完成（与 .av.pt 配对）
      return segs.length;
    } catch {
      return 0;
    }
  }

  /** 轮询视频输出（返回全部输出文件——SaveVideo segments 模式每段一个 mp4） */
  private async pollHistory(
    promptId: string,
    onProgress?: (completed: number) => void,
    timeoutMs = 3_600_000,
  ): Promise<Array<{ filename: string; subfolder?: string; type?: string }>> {
    const start = Date.now();
    for (;;) {
      if (Date.now() - start > timeoutMs) throw new Error(`长视频生成超时（${timeoutMs / 1000}s）`);
      await sleep(4000);
      // 实时上报已完成段数（扫描 ComfyUI segment 缓存）
      if (onProgress && this.cfg.comfyOutputDir) {
        try {
          const completed = this.getCompletedSegments(this.lastDirectorNodeId ?? "");
          if (completed > 0) onProgress(completed);
        } catch {
          /* 进度上报失败不阻断 */
        }
      }
      // 轮询 /history：云端实例可能返回 HTML（"应用加载中"代理页）而非 JSON，需容错重试而非抛错
      const histRes = await fetch(`${this.cfg.baseUrl}/history/${promptId}`);
      const histText = await histRes.text();
      if (!histRes.ok || !histText || histText.trim().startsWith("<")) {
        // 非 JSON（HTML/空），继续轮询
        continue;
      }
      let hist: any = null;
      try {
        hist = JSON.parse(histText);
      } catch {
        // JSON 解析失败，继续轮询
        continue;
      }
      const entry = hist?.[promptId];
      if (!entry) continue;
      const outputs = entry.outputs ?? {};
      for (const out of Object.values(outputs) as Array<{
        images?: Array<{ filename: string; subfolder?: string; type?: string }>;
        videos?: Array<{ filename: string; subfolder?: string; type?: string }>;
      }>) {
        // 收集全部输出文件（Director segments 模式：每段一个 mp4，需全部下载后拼接）
        const all: Array<{ filename: string; subfolder?: string; type?: string }> = [];
        if (out.images) all.push(...out.images);
        if (out.videos) all.push(...out.videos);
        if (all.length > 0) {
          // 按文件名自然序排列（ninefox_long_video_00001 → 00002 … 保证拼接顺序）
          all.sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true }));
          return all;
        }
      }
    }
  }

  /**
   * 生成一集长视频（r2v 多图参考模式，不依赖首帧图）。
   * @param sbs 分镜列表（含 videoDesc/prompt）
   * @param refAssets 参考资产图 [{relPath, name, type}]
   * @param runSelection 可选：只重跑这些段索引
   */
  async generateEpisode(
    sbs: any[],
    refAssets: Array<{ relPath: string; name: string; type: string }>,
    opts: { runSelection?: number[]; onProgress?: (completed: number, total: number) => void; styleHint?: string } = {},
  ): Promise<DirectorGenerateResult> {
    const ratio = this.cfg.videoRatio ?? "9:16";
    let width: number, height: number;
    if (this.cfg.videoSize) {
      width = this.cfg.videoSize[0];
      height = this.cfg.videoSize[1];
    } else if (ratio === "9:16") {
      width = 480; height = 864;
    } else if (ratio === "1:1") {
      width = 512; height = 512;
    } else {
      width = 864; height = 480;
    }
    const durPerSeg = this.cfg.durationPerSeg ?? 5;
    const segCount = sbs.length || 1;
    const totalFrames = segCount * durPerSeg * 24;

    // 上传本集角色/场景/道具参考图 → RefImage（<Picture N> + 描述），不依赖首帧图
    const globalRefs: RefImage[] = [];
    let pic = 1;
    for (const ra of refAssets) {
      // relPath = filePath 去 /oss 前缀 = "/assets/character/xxx.png" → 本地 = ossDir/assets/character/xxx.png
      const rl = path.join(this.cfg.ossDir, ra.relPath.replace(/^\//, ""));
      if (!fs.existsSync(rl)) {
        console.warn(`[director] 参考图本地不存在，跳过: ${rl}`);
        continue;
      }
      const file = await this.uploadImage(rl);
      const prefix = REF_DESC_PREFIX[ra.type] ?? "参考图";
      globalRefs.push({
        file,
        picture: pic,
        desc: `<Picture ${pic}> ${prefix}（${ra.name}）`,
        type: ra.type,
        name: ra.name,
      });
      pic++;
    }
    console.log(`[director] 参考图上传 ${globalRefs.length} 张（共 ${refAssets.length} 项）`);
    // 无任何参考图则回退：用分镜首帧图（若有）作唯一参考
    if (globalRefs.length === 0) {
      for (const sb of sbs) {
        if (!sb.filePath) continue;
        const local = path.join(this.cfg.ossDir, sb.filePath.replace(/^\/oss\//, ""));
        if (!fs.existsSync(local)) continue;
        const file = await this.uploadImage(local);
        globalRefs.push({ file, picture: pic++, desc: `<Picture ${pic - 1}> 本分镜的画面参考`, type: "storyboard", name: "" });
        break;
      }
    }

    // 每段提示词 = 分镜 videoDesc（已是 Minimax 提示词）+ 本镜角色/场景的 <Picture N> 引用
    // （Director r2v 必须显式引用图片，模型才能把「老子」绑定到对应参考图）
    const nameToPicture = new Map<string, RefImage>();
    for (const r of globalRefs) {
      nameToPicture.set(r.name ?? "", r);
    }
    // 全局画风约束（来自项目视觉手册）：置顶每段 prompt 开头（模型对开头词最敏感）
    const styleBlock = opts.styleHint?.trim()
      ? `【全片统一画风，开头即生效，全片每一帧严格遵循不得偏离】\n${opts.styleHint.trim()}。\n画风要求：严格按上述风格渲染（纯水墨灰阶/无彩色/无写实感），禁止任何鲜艳或饱和色彩，禁止写实电影感、禁止现代感。`
      : "";

    const segMeta: Array<{ prompt: string; negativePrompt?: string; refs: RefImage[] }> = sbs.map((sb) => {
      // 风格块置顶（开头权重最高），videoDesc 放其后
      const base = `${sb.videoDesc || sb.prompt || ""}`;
      const withStyle = styleBlock ? `${styleBlock}\n\n${base}` : base;
      // 扫描本镜提示词出现的角色/场景名，收集对应参考图（按出现顺序去重）
      const mentioned = new Set<string>();
      for (const r of globalRefs) {
        const nm = r.name ?? "";
        if (nm && withStyle.includes(nm)) mentioned.add(nm);
      }
      // 追加 Picture 引用块（显式告诉 Director：以下人物/场景以对应参考图为准）
      let prompt = withStyle;
      if (mentioned.size > 0) {
        const refLines: string[] = [];
        for (const nm of mentioned) {
          const r = nameToPicture.get(nm);
          if (r) {
            refLines.push(r.desc);
          }
        }
        if (refLines.length) {
          prompt = `${withStyle}\n\n【本镜人物与场景须严格保持参考形象】\n${refLines.join("\n")}`;
        }
      }
      // 负向提示词：压制 H3 默认淡彩/设色倾向（水墨画风强化）
      const negativePrompt = opts.styleHint?.trim()
        ? "鲜艳色彩, 高饱和度, 彩色渲染, 工笔设色, 写实油画, 现代卡通, 明亮色调, 淡彩晕染, 色彩丰富, 摄影感, 3D渲染, 过度饱和"
        : "";
      return { prompt, negativePrompt, refs: globalRefs };
    });

    const { promptId, directorNodeId } = await this.submit(segMeta, globalRefs, {
      totalFrames,
      width,
      height,
      runSelection: opts.runSelection,
      seed: this.cfg.seed ?? 20260825,
      steps: this.cfg.steps ?? 8,
      continuity: true, // 段间引导（上一段尾帧接力下一段）
      styleHint: opts.styleHint,
    });
    this.lastDirectorNodeId = directorNodeId;

    // 轮询期间：若有进度回调，每轮扫描缓存目录实时上报已完成段数
    const onProgress = opts.onProgress;
    const videos = await this.pollHistory(promptId, (completed) => {
      onProgress?.(completed, segCount);
    });

    // 下载全部段 mp4 → 拼接成完整视频（SaveVideo segments 模式每段一个文件）
    const fileName = `long-video-${Date.now()}.mp4`;
    const absDir = path.join(this.cfg.ossDir, "videos");
    fs.mkdirSync(absDir, { recursive: true });
    const absPath = path.join(absDir, fileName);

    // 单文件（整段/单段模式）直接下载
    if (videos.length === 1) {
      const viewUrl = `${this.cfg.baseUrl}/view?filename=${encodeURIComponent(videos[0].filename)}&subfolder=${encodeURIComponent(videos[0].subfolder ?? "")}&type=${encodeURIComponent(videos[0].type ?? "output")}`;
      const dl = await fetch(viewUrl);
      if (!dl.ok) throw new Error(`下载视频失败 ${dl.status}`);
      fs.writeFileSync(absPath, Buffer.from(await dl.arrayBuffer()));
      return { filePath: `/oss/videos/${fileName}`, promptId, segmentCount: segCount, totalFrames };
    }

    // 多段：下载到临时目录 → ffmpeg concat 拼接
    const tmpDir = path.join(absDir, `.tmp-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const segFiles: string[] = [];
    for (let i = 0; i < videos.length; i++) {
      const v = videos[i];
      const segPath = path.join(tmpDir, `seg_${String(i).padStart(4, "0")}.mp4`);
      const viewUrl = `${this.cfg.baseUrl}/view?filename=${encodeURIComponent(v.filename)}&subfolder=${encodeURIComponent(v.subfolder ?? "")}&type=${encodeURIComponent(v.type ?? "output")}`;
      const dl = await fetch(viewUrl);
      if (!dl.ok) throw new Error(`下载视频段 ${v.filename} 失败 ${dl.status}`);
      fs.writeFileSync(segPath, Buffer.from(await dl.arrayBuffer()));
      segFiles.push(segPath);
      console.log(`[director] 已下载段 ${i + 1}/${videos.length}: ${v.filename}`);
    }
    // ffmpeg concat（找 ffmpeg：ComfyUI python imageio_ffmpeg 或系统 PATH）
    const ffmpeg = findFfmpeg();
    if (!ffmpeg) throw new Error("未找到 ffmpeg，无法拼接多段视频");
    const listFile = path.join(tmpDir, "concat.txt");
    fs.writeFileSync(listFile, segFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"));
    const { execFileSync } = await import("node:child_process");
    execFileSync(ffmpeg, ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", absPath], {
      stdio: "pipe",
    });
    // 清理临时目录
    try {
      for (const f of segFiles) fs.unlinkSync(f);
      fs.unlinkSync(listFile);
      fs.rmdirSync(tmpDir);
    } catch {
      /* 清理失败不阻断 */
    }
    console.log(`[director] 多段拼接完成: ${fileName}（${videos.length} 段）`);

    return { filePath: `/oss/videos/${fileName}`, promptId, segmentCount: segCount, totalFrames };
  }
}

/** 查找 ffmpeg 可执行文件（ComfyUI imageio_ffmpeg 自带 > 系统 PATH） */
function findFfmpeg(): string | null {
  try {
    const candidates = [
      process.env.FFMPEG_PATH,
      "H:\\ComfyUI\\ComfyUI-V18.1\\python\\Lib\\site-packages\\imageio_ffmpeg\\binaries\\ffmpeg-win-x86_64-v7.1.exe",
      "H:\\ComfyUI\\ComfyUI-V18.1\\python\\Lib\\site-packages\\imageio_ffmpeg\\binaries\\ffmpeg-win64-v4.2.2.exe",
    ].filter(Boolean) as string[];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return "ffmpeg"; // 回退 PATH
  } catch {
    return null;
  }
}
