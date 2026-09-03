// Provider 管理器：集中初始化 + 支持运行时热更新（设置页保存后无需重启）
// 配置优先级：DB（o_setting）> .env 默认值

import fs from "node:fs";
import path from "node:path";
import { setImageProvider, getImageProvider } from "./image.js";
import { ComfyUIProvider, type WorkflowSpec } from "./comfyui.js";
import { initVideoProvider } from "../routes/videos.js";
import { ComfyUIDirectorProvider, type DirectorEpisodeOptions } from "./comfyuiDirector.js";

export interface ProviderSettings {
  comfyuiUrl: string;
  videoComfyuiUrl?: string; // 视频生成专用 ComfyUI（云端 LightCC 等），默认 = comfyuiUrl
  ossDir: string;
  workflows: Record<string, Partial<WorkflowSpec> & { path?: string }>;
  videoWorkflowPath: string;
  deepseekKey?: string;
  directorComfyuiUrl?: string; // Director 长视频专用（本地 ComfyUI 9312）
  workflowDirectorPath?: string; // Director 长视频工作流模板路径
  directorVideoRatio?: string; // 长视频比例（9:16 竖屏短剧）
  directorComfyOutputDir?: string; // ComfyUI output 根（扫描 segment 缓存感知分段进度）
}

const DEFAULT_SETTING_KEYS = [
  "comfyui_url",
  "comfyui_video_url",
  "oss_dir",
  "workflow_character",
  "workflow_scene",
  "workflow_prop",
  "workflow_storyboard",
  "workflow_video",
  "director_comfyui_url",
  "workflow_director",
] as const;

// —— Director 长视频 provider（本地 ComfyUI + Director 节点）——
let directorProvider: ComfyUIDirectorProvider | null = null;
export function getDirectorProvider(): ComfyUIDirectorProvider | null {
  return directorProvider;
}

/** 初始化/热更新 Director provider（可选；指向本地 ComfyUI 9312 + Director 工作流模板） */
export function initDirectorProvider(settings?: ProviderSettings) {
  const s = settings ?? defaultSettings();
  const baseUrl = s.directorComfyuiUrl || s.comfyuiUrl;
  const wfPath = s.workflowDirectorPath;
  if (!baseUrl || !wfPath || !fs.existsSync(wfPath)) {
    directorProvider = null;
    console.log("[provider] Director 长视频未启用（需 workflow_director 模板）");
    return;
  }
  directorProvider = new ComfyUIDirectorProvider({
    baseUrl,
    workflowApiPath: wfPath,
    ossDir: s.ossDir,
    videoRatio: s.directorVideoRatio ?? "9:16",
    comfyOutputDir: s.directorComfyOutputDir,
  });
  console.log(`[provider] Director 长视频已启用 → ${baseUrl} | ${wfPath}`);
}

function defaultSettings(): ProviderSettings {
  const base = "H:\\ComfyUI\\ComfyUI-V18.1\\user\\default\\workflows";
  return {
    comfyuiUrl: process.env.COMFYUI_URL || "http://127.0.0.1:8188",
    videoComfyuiUrl: process.env.COMFYUI_VIDEO_URL || undefined,
    ossDir: process.env.OSS_DIR || path.join(process.cwd(), "oss"),
    workflows: {
      character: { path: process.env.WORKFLOW_CHARACTER_PATH || `${base}\\24 角色三视图生成系列（8~12G）\\AI短剧漫剧专用超逼真人物设定集 Z-IMAGE文生图.json`, promptNodeType: "CR Text", size: [1024, 1024] },
      scene: { path: process.env.WORKFLOW_SCENE_PATH || `${base}\\05 Z-image系列（极速的生图模型8~12G可用）\\Z-image超极速文生图.json`, promptNodeType: "CLIPTextEncode", size: [1216, 704] },
      prop: { path: process.env.WORKFLOW_PROP_PATH || `${base}\\05 Z-image系列（极速的生图模型8~12G可用）\\Z-image超极速文生图.json`, promptNodeType: "CLIPTextEncode", size: [1024, 1024] },
      storyboard: { path: process.env.WORKFLOW_STORYBOARD_PATH || `${base}\\05 Z-image系列（极速的生图模型8~12G可用）\\Z-image超极速文生图.json`, promptNodeType: "CLIPTextEncode", size: [720, 1280] },
    },
    videoWorkflowPath: process.env.WORKFLOW_VIDEO_PATH || `${base}\\27 MinimaxH3最火视频系列（16G）\\Minimax_H3_i2v_图生视频_节点版.json`,
    directorComfyuiUrl: process.env.DIRECTOR_COMFYUI_URL || "http://127.0.0.1:9312",
    workflowDirectorPath: process.env.WORKFLOW_DIRECTOR_PATH || "E:\\AIMovie\\AIMovieWorkSpace\\九尾狐_ComfyUI工作流\\Director_长视频_i2v_本地.json",
    directorVideoRatio: process.env.DIRECTOR_VIDEO_RATIO || "9:16",
    directorComfyOutputDir: process.env.DIRECTOR_COMFY_OUTPUT_DIR || "H:\\ComfyUI\\ComfyUI-V18.1\\output",
  };
}

/** 从 DB 读取覆盖设置（o_setting），无则用默认 */
export async function loadSettingsFromDb(): Promise<ProviderSettings> {
  const s = defaultSettings();
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const rows = await prisma.setting.findMany();
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    await prisma.$disconnect();

    if (map.comfyui_url) s.comfyuiUrl = map.comfyui_url;
    if (map.comfyui_video_url) s.videoComfyuiUrl = map.comfyui_video_url;
    if (map.oss_dir) s.ossDir = map.oss_dir;
    if (map.workflow_character) s.workflows.character.path = map.workflow_character;
    if (map.workflow_scene) s.workflows.scene.path = map.workflow_scene;
    if (map.workflow_prop) s.workflows.prop.path = map.workflow_prop;
    if (map.workflow_storyboard) s.workflows.storyboard.path = map.workflow_storyboard;
    if (map.workflow_video) s.videoWorkflowPath = map.workflow_video;
    if (map.director_comfyui_url) s.directorComfyuiUrl = map.director_comfyui_url;
    if (map.workflow_director) s.workflowDirectorPath = map.workflow_director;
    if (map.director_video_ratio) s.directorVideoRatio = map.director_video_ratio;
    if (map.director_comfy_output_dir) s.directorComfyOutputDir = map.director_comfy_output_dir;
    // DB 未配置 ratio 时按项目比例回退？不——Director ratio 是生成端参数，保留 DB 值或默认
  } catch {
    // DB 不可用则用默认
  }
  return s;
}

/** 按设置初始化/热更新全部 Provider */
export async function initProviders(settings?: ProviderSettings) {
  const s = settings ?? (await loadSettingsFromDb());

  // 图片 provider：任一工作流路径有效则启用 ComfyUI，否则 Mock
  const workflows: Record<string, WorkflowSpec> = {};
  for (const [type, spec] of Object.entries(s.workflows)) {
    // 分镜首帧：FLUX2-Klein 多参考工作流，角色/场景/道具参考图槽位 → LoadImage 节点 10/13/16
    const extra = type === "storyboard" ? { refImageNodeIds: { character: 10, scene: 13, prop: 16 } as Record<string, number> } : {};
    workflows[type] = {
      path: spec.path ?? "",
      promptNodeType: (spec.promptNodeType as "CR Text" | "CLIPTextEncode") ?? "CLIPTextEncode",
      ...(spec.size ? { size: spec.size as [number, number] } : {}),
      ...extra,
    };
  }
  const hasWorkflow = Object.values(workflows).some((w) => w.path && fs.existsSync(w.path));
  if (hasWorkflow) {
    fs.mkdirSync(s.ossDir, { recursive: true });
    setImageProvider(new ComfyUIProvider({ baseUrl: s.comfyuiUrl, workflows, ossDir: s.ossDir, defaultType: "character" }));
    console.log("[provider] ComfyUI 已启用（按类型切换工作流）");
    for (const [k, v] of Object.entries(workflows)) {
      console.log(`  ${k}: ${v.path || "(未配置)"}${v.size ? ` ×${v.size.join("x")}` : ""}`);
    }
  } else {
    console.log("[provider] 使用 MockProvider（未配置有效工作流路径）");
  }

  // 视频 provider（可独立指向云端 ComfyUI）
  if (s.videoWorkflowPath && fs.existsSync(s.videoWorkflowPath)) {
    fs.mkdirSync(s.ossDir, { recursive: true });
    const videoUrl = s.videoComfyuiUrl || s.comfyuiUrl;
    initVideoProvider(videoUrl, s.videoWorkflowPath, s.ossDir);
    console.log(`[provider] ComfyUI 视频已启用 → ${videoUrl} | ${s.videoWorkflowPath}`);
  } else {
    console.log("[provider] 视频 provider 未配置");
  }

  // Director 长视频 provider（本地 ComfyUI + Director 节点，独立可选）
  initDirectorProvider(s);
}

/** 保存设置到 DB + 热更新 Provider（无需重启） */
export async function saveSettings(settings: ProviderSettings): Promise<void> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const rows: Record<string, string> = {
    comfyui_url: settings.comfyuiUrl,
    comfyui_video_url: settings.videoComfyuiUrl || "",
    oss_dir: settings.ossDir,
    workflow_character: settings.workflows.character?.path ?? "",
    workflow_scene: settings.workflows.scene?.path ?? "",
    workflow_prop: settings.workflows.prop?.path ?? "",
    workflow_storyboard: settings.workflows.storyboard?.path ?? "",
    workflow_video: settings.videoWorkflowPath,
    director_comfyui_url: settings.directorComfyuiUrl || "",
    workflow_director: settings.workflowDirectorPath || "",
    director_video_ratio: settings.directorVideoRatio || "",
    director_comfy_output_dir: settings.directorComfyOutputDir || "",
  };
  // key 不回显（GET 不返回）；仅非空时写入，避免空值覆盖已有 key
  if (settings.deepseekKey) {
    rows.deepseek_api_key = settings.deepseekKey;
  }
  for (const [key, value] of Object.entries(rows)) {
    await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
  await prisma.$disconnect();
  // 热更新
  await initProviders(settings);
}

/** ComfyUI 在线状态（供设置页显示） */
export async function comfyuiStatus(baseUrl: string) {
  try {
    const res = await fetch(`${baseUrl}/system_stats`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { online: false };
    const stats: any = await res.json();
    const dev = stats?.system?.devices?.[0];
    return {
      online: true,
      gpu: dev?.name ?? "未知",
      vramGB: dev?.vram_total ? Math.round(dev.vram_total / 2 ** 30) : undefined,
      version: stats?.system?.comfyui_version,
    };
  } catch {
    return { online: false };
  }
}

export { DEFAULT_SETTING_KEYS };
export { getImageProvider };
