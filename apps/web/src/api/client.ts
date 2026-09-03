import axios from "axios";

export const http = axios.create({
  baseURL: "/api",
  timeout: 30000,
});

export interface FlowResponse {
  data: {
    project: { id: number; name: string };
    episodeId: number;
    nodes: unknown[];
    edges: unknown[];
    updatedAt: string | null;
  };
}

export async function getProjects() {
  const res = await http.get("/projects");
  return res.data.data as { id: number; name: string }[];
}

export async function loadFlow(projectId: number, episodeId: number): Promise<FlowResponse["data"]> {
  const res = await http.get<FlowResponse>(`/projects/${projectId}/episodes/${episodeId}/flow`);
  return res.data.data;
}

export async function saveFlow(projectId: number, episodeId: number, nodes: unknown[], edges: unknown[]) {
  const res = await http.put(`/projects/${projectId}/episodes/${episodeId}/flow`, { nodes, edges });
  return res.data.data;
}

// ---- M2 资产 ----
export interface Asset {
  id: number;
  projectId: number;
  episodeId: number;
  flowId: string;
  parentId: number | null;
  type: "character" | "scene" | "prop";
  name: string;
  prompt: string;
  filePath: string | null;
  refImagePath: string | null; // 参考图（scene/prop 图生图用）
  state: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  errorReason: string | null;
  voiceActor: string | null;
  voiceDialect: string | null;
}

export async function createAsset(
  projectId: number,
  episodeId: number,
  input: { flowId: string; type: Asset["type"]; name: string; prompt?: string },
): Promise<Asset> {
  const res = await http.post(`/projects/${projectId}/episodes/${episodeId}/assets`, input);
  return res.data.data;
}

export async function listAssets(projectId: number, episodeId: number): Promise<Asset[]> {
  const res = await http.get(`/projects/${projectId}/episodes/${episodeId}/assets`);
  return res.data.data;
}

export async function generateAsset(projectId: number, episodeId: number, assetId: number) {
  const res = await http.post(`/projects/${projectId}/episodes/${episodeId}/assets/${assetId}/generate`);
  return res.data.data;
}

export async function getAsset(projectId: number, episodeId: number, assetId: number): Promise<Asset> {
  const res = await http.get(`/projects/${projectId}/episodes/${episodeId}/assets/${assetId}`);
  return res.data.data;
}

export async function updateAsset(
  projectId: number,
  episodeId: number,
  assetId: number,
  patch: { name?: string; type?: Asset["type"]; prompt?: string; voiceActor?: string | null; voiceDialect?: string | null },
): Promise<Asset> {
  const res = await http.put(`/projects/${projectId}/episodes/${episodeId}/assets/${assetId}`, patch);
  return res.data.data;
}

export async function deleteAsset(projectId: number, episodeId: number, assetId: number) {
  const res = await http.delete(`/projects/${projectId}/episodes/${episodeId}/assets/${assetId}`);
  return res.data.data;
}

/** 上传图片作为资产内容（raw body；同 项目+集+类型+名 复用资产卡换图） */
export async function uploadAsset(
  projectId: number,
  episodeId: number,
  input: { type: Asset["type"]; name: string; file: File },
): Promise<Asset> {
  const res = await http.post(
    `/projects/${projectId}/episodes/${episodeId}/assets/upload`,
    input.file,
    {
      params: { type: input.type, name: input.name },
      headers: { "Content-Type": input.file.type || "application/octet-stream" },
      timeout: 120000,
    },
  );
  return res.data.data;
}

/** 上传参考图（scene/prop 图生图用）：raw body → 记录 refImagePath */
export async function uploadAssetRefImage(
  projectId: number,
  episodeId: number,
  assetId: number,
  file: File,
): Promise<Asset> {
  const res = await http.post(
    `/projects/${projectId}/episodes/${episodeId}/assets/${assetId}/ref-image`,
    file,
    {
      headers: { "Content-Type": file.type || "application/octet-stream" },
      timeout: 120000,
    },
  );
  return res.data.data;
}

/** 清除参考图（删除文件 + 置空；资产内容图保留） */
export async function clearAssetRefImage(projectId: number, episodeId: number, assetId: number): Promise<Asset> {
  const res = await http.post(`/projects/${projectId}/episodes/${episodeId}/assets/${assetId}/ref-image/clear`);
  return res.data.data;
}
/** 清理资产内容（删除图片、保留资产卡） */
export async function clearAsset(projectId: number, episodeId: number, assetId: number): Promise<Asset> {
  const res = await http.post(`/projects/${projectId}/episodes/${episodeId}/assets/${assetId}/clear`);
  return res.data.data;
}

// ---- 集与剧本 ----
export interface Episode {
  id: number;
  projectId: number;
  name: string;
  scriptContent: string;
  index: number;
  updatedAt: string;
}

export async function listEpisodes(projectId: number): Promise<Episode[]> {
  const res = await http.get(`/projects/${projectId}/episodes`);
  return res.data.data;
}

export async function getEpisode(projectId: number, episodeId: number): Promise<Episode> {
  const res = await http.get(`/projects/${projectId}/episodes/${episodeId}`);
  return res.data.data;
}

export async function createEpisode(
  projectId: number,
  name: string,
  opts?: { index?: number; scriptContent?: string },
): Promise<Episode> {
  const res = await http.post(`/projects/${projectId}/episodes`, { name, ...opts });
  return res.data.data;
}

export async function updateEpisode(
  projectId: number,
  episodeId: number,
  patch: { name?: string; scriptContent?: string },
): Promise<Episode> {
  const res = await http.put(`/projects/${projectId}/episodes/${episodeId}`, patch);
  return res.data.data;
}

// ---- AI 剧本修改 ----
export async function aiScriptEdit(
  script: string,
  instruction: string,
  projectId?: number,
): Promise<string> {
  // AI 按用户要求改写剧本，返回修改后的完整剧本
  const res = await http.post("/ai/script-edit", { script, instruction, projectId }, { timeout: 180000 });
  return res.data.data.script;
}

// ---- AI 提示词优化 ----
export async function aiPromptEdit(
  prompt: string,
  instruction: string,
  kind: "firstframe" | "video",
  projectId?: number,
): Promise<string> {
  // AI 按用户要求优化/改写提示词（firstframe=首帧图提示词，video=视频生成提示词 H3）
  const res = await http.post("/ai/prompt-edit", { prompt, instruction, kind, projectId }, { timeout: 180000 });
  return res.data.data.prompt;
}

// ---- AI 资产生图提示词生成（按 资产名+设计描述+项目视觉手册）----
export async function aiAssetPrompt(
  name: string,
  description: string,
  kind: "character" | "scene" | "prop",
  projectId: number,
): Promise<string> {
  const res = await http.post("/ai/asset-prompt", { name, description, kind, projectId }, { timeout: 180000 });
  return res.data.data.prompt;
}

// ---- 分镜卡 ----
export interface Storyboard {
  id: number;
  projectId: number;
  episodeId: number;
  flowId: string;
  index: number;
  duration: number; // 视频推荐时长（秒，≤15，Minimax 一次任务）
  prompt: string;
  videoDesc: string;
  filePath: string | null;
  state: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  errorReason: string | null;
  assetIds: number[];
}

export async function listStoryboards(projectId: number, episodeId: number): Promise<Storyboard[]> {
  const res = await http.get(`/projects/${projectId}/episodes/${episodeId}/storyboards`);
  return res.data.data;
}

export async function createStoryboard(
  projectId: number,
  episodeId: number,
  input: { flowId: string; index?: number; sceneIndex?: number; duration?: number; prompt?: string; videoDesc?: string },
): Promise<Storyboard> {
  const res = await http.post(`/projects/${projectId}/episodes/${episodeId}/storyboards`, input);
  return res.data.data;
}

export async function updateStoryboard(
  projectId: number,
  episodeId: number,
  sbId: number,
  patch: { index?: number; sceneIndex?: number; duration?: number; prompt?: string; videoDesc?: string },
): Promise<Storyboard> {
  const res = await http.put(`/projects/${projectId}/episodes/${episodeId}/storyboards/${sbId}`, patch);
  return res.data.data;
}

export async function deleteStoryboard(projectId: number, episodeId: number, sbId: number) {
  const res = await http.delete(`/projects/${projectId}/episodes/${episodeId}/storyboards/${sbId}`);
  return res.data.data;
}

export async function generateStoryboard(projectId: number, episodeId: number, sbId: number) {
  const res = await http.post(`/projects/${projectId}/episodes/${episodeId}/storyboards/${sbId}/generate`);
  return res.data.data;
}

export async function getStoryboard(projectId: number, episodeId: number, sbId: number): Promise<Storyboard> {
  const res = await http.get(`/projects/${projectId}/episodes/${episodeId}/storyboards/${sbId}`);
  return res.data.data;
}

// ---- 批量生成 ----
export interface StoryboardWorkflowItem {
  id: number;
  index: number;
  file: string;
  error?: string;
}

export async function generateStoryboardWorkflows(
  projectId: number,
  episodeId: number,
): Promise<{ count: number; root: string; items: StoryboardWorkflowItem[] }> {
  // 每个分镜都要 AI 生成 H3 六段式提示词，较慢：与后端超时对齐（10 分钟）
  const res = await http.post(
    `/projects/${projectId}/episodes/${episodeId}/storyboards/workflows`,
    {},
    { timeout: 600000 },
  );
  return res.data.data;
}

/** 获取某分镜工作流将注入的提示词（H3 六段式；非六段式时后端会 AI 生成，较慢） */
export async function getStoryboardWorkflowPrompt(
  projectId: number,
  episodeId: number,
  sbId: number,
): Promise<{ prompt: string }> {
  const res = await http.get(
    `/projects/${projectId}/episodes/${episodeId}/storyboards/${sbId}/workflow-prompt`,
    { timeout: 200000 },
  );
  return res.data.data;
}

export async function batchGenerateStoryboardImages(projectId: number, episodeId: number): Promise<{ triggered: number[] }> {
  const res = await http.post(`/projects/${projectId}/episodes/${episodeId}/storyboards/batch-generate-images`);
  return res.data.data;
}

export async function batchGenerateStoryboardVideos(projectId: number, episodeId: number): Promise<{ triggered: number[] }> {
  const res = await http.post(`/projects/${projectId}/episodes/${episodeId}/storyboards/batch-generate-videos`);
  return res.data.data;
}

// ---- AI 拆镜 ----
export interface AiSplitItem {
  index: number;
  sceneIndex?: number; // 所属场次（1 起）
  duration: number; // 秒，≤15（Minimax 一次视频任务）
  prompt: string;
  videoDesc: string;
}

export interface AiVisualDict {
  characters?: Array<{ name: string; look?: string; outfit?: string }>;
  scenes?: Array<{ name: string; space?: string; light?: string }>;
  props?: Array<{ name: string; look?: string; state?: string }>;
}

export interface AiSplitResult {
  items: AiSplitItem[];
  visualDict?: AiVisualDict | null;
}

export async function aiSplitStoryboard(script: string, projectId?: number): Promise<AiSplitItem[]> {
  // AI 拆镜较慢：与后端 180s 超时对齐
  const res = await http.post("/ai/storyboard-split", { script, projectId }, { timeout: 180000 });
  return res.data.data;
}

/** 拆镜（含视觉词典）：返回分镜 + 角色/场景/道具锁定词条；sceneDirectors 按场覆盖导演（如 {9: "Director_TsuiHark"}） */
export async function aiSplitStoryboardWithDict(script: string, projectId?: number, sceneDirectors: Record<string, string> = {}): Promise<AiSplitResult> {
  const res = await http.post("/ai/storyboard-split", { script, projectId, sceneDirectors }, { timeout: 180000 });
  return { items: res.data.data ?? [], visualDict: res.data.visualDict ?? null };
}

// ---- AI 电影质感提示词（film-reference-prompt-writer）----
export interface FilmRefParams {
  filmName?: string;
  request?: string;
  mode?: "quick" | "full";
  target?: "video" | "image";
  duration?: number;
  projectId?: number;
}
export async function aiFilmReferencePrompt(p: FilmRefParams): Promise<string> {
  const res = await http.post("/ai/film-reference-prompt", p, { timeout: 180000 });
  return res.data.data?.analysis ?? "";
}

// ---- AI 出场人物分析 ----
export interface ScriptCharacter {
  name: string;
  role: string; // 主角 / 配角 / 群演
  description: string;
}

export async function aiScriptCharacters(script: string, projectId?: number): Promise<ScriptCharacter[]> {
  // AI 分析单集剧本出场人物
  const res = await http.post("/ai/script-characters", { script, projectId }, { timeout: 180000 });
  return res.data.data;
}

// ---- AI 全部集出场人物汇总 ----
export interface ScriptCharacterAll extends ScriptCharacter {
  episodes: number[]; // 出现的集序号
}

export async function aiScriptCharactersAll(
  episodes: { index: number; script: string }[],
  projectId?: number,
): Promise<ScriptCharacterAll[]> {
  // AI 分析全部集剧本，汇总出场人物并标注出现集（较慢，超时 5 分钟）
  const res = await http.post("/ai/script-characters-all", { episodes, projectId }, { timeout: 300000 });
  return res.data.data;
}

// ---- AI 全部集场景/道具/素材分析 ----
export interface ScriptAssetAll {
  type: "scene" | "prop" | "material";
  name: string;
  description: string;
  episodes: number[];
}

export async function aiScriptAssetsAll(
  episodes: { index: number; script: string }[],
  projectId?: number,
): Promise<ScriptAssetAll[]> {
  // AI 分析全部集剧本，提取场景/道具/素材清单（较慢，超时 5 分钟）
  const res = await http.post("/ai/script-assets-all", { episodes, projectId }, { timeout: 300000 });
  return res.data.data;
}

// ---- 集-资产映射（分析资产持久化） ----
export interface EpisodeAssetItem {
  id: number;
  type: "character" | "scene" | "prop" | "material";
  name: string;
  description: string;
  episodes: number[]; // 出现的集序号
}

export async function getEpisodeAssets(projectId: number): Promise<EpisodeAssetItem[]> {
  const res = await http.get(`/projects/${projectId}/episode-assets`);
  return res.data.data;
}

export async function saveEpisodeAssets(
  projectId: number,
  items: { type: EpisodeAssetItem["type"]; name: string; description: string; episodes: number[] }[],
): Promise<{ saved: number }> {
  const res = await http.put(`/projects/${projectId}/episode-assets`, { items });
  return res.data.data;
}

// ---- H3 Ref2VA 提示词生成（人物/场景/道具一致性） ----
export interface Ref2VAAsset {
  name: string;
  type: "character" | "scene" | "prop" | "material";
  description: string;
}

export interface Ref2VAResult {
  zh_prompt: string;
  zh_summary: string;
}

export async function h3Ref2vaPrompt(
  videoDesc: string,
  duration: number,
  assets: Ref2VAAsset[],
  projectId?: number,
): Promise<Ref2VAResult> {
  // AI 生成 H3 Ref2VA 六段式提示词（较慢，超时 5 分钟）
  const res = await http.post(
    "/ai/h3-ref2va-prompt",
    { videoDesc, duration, assets, projectId },
    { timeout: 300000 },
  );
  return res.data.data;
}

export interface H3VideoPromptResult {
  mode: string; // ref2va | t2va | multishot
  zh_prompt: string;
  zh_summary: string;
}

export async function h3VideoPrompt(
  videoDesc: string,
  duration: number,
  assets: Ref2VAAsset[],
  multishot: boolean,
  projectId?: number,
): Promise<H3VideoPromptResult> {
  // H3 视频提示词总入口（导演路由：单镜 Ref2VA / 多镜 multishot，较慢，超时 5 分钟）
  const res = await http.post(
    "/ai/h3-video-prompt",
    { videoDesc, duration, assets, multishot, projectId },
    { timeout: 300000 },
  );
  return res.data.data;
}

// ---- 源小说 ----
export interface Novel {
  projectId: number;
  title: string;
  content: string;
}

export async function getNovel(projectId: number): Promise<Novel> {
  const res = await http.get(`/projects/${projectId}/novel`);
  return res.data.data;
}

export async function saveNovel(projectId: number, patch: { title?: string; content?: string }): Promise<Novel> {
  const res = await http.put(`/projects/${projectId}/novel`, patch);
  return res.data.data;
}

export async function updateProject(
  projectId: number,
  patch: { overview?: string; videoRatio?: string; visualSkill?: string; directorSkill?: string; era?: string; episodeCount?: number; totalDurationMin?: number },
): Promise<any> {
  const res = await http.put(`/projects/${projectId}`, patch);
  return res.data.data;
}

export interface NovelEpisode {
  episode: number;
  title: string;
  script: string;
}

export interface NovelToScriptResult {
  count: number;
  episodes: NovelEpisode[];
}

/** 小说 → 剧本：按全剧时长自动分析集数（totalDurationMin>0 时每集约 5 分钟）；兼容旧 episodeCount 模式 */
export async function novelToScript(
  novel: string,
  projectId: number,
  episodeCount = 0,
  totalDurationMin = 0,
): Promise<NovelToScriptResult> {
  // AI 多集改编较慢：与后端 300s 超时对齐，避免 30s 默认超时
  const res = await http.post(
    "/ai/novel-to-script",
    { novel, projectId, episodeCount, totalDurationMin },
    { timeout: 300000 },
  );
  return res.data.data;
}

/** 新增导演手册：输入导演名称 → 联网检索 → 生成完整手册 markdown（可直接保存为 story 技能） */
export async function generateDirectorHandbook(directorName: string, extraHint = ""): Promise<{ name: string; content: string }> {
  const res = await http.post(
    "/ai/generate-director-handbook",
    { director_name: directorName, extra_hint: extraHint },
    { timeout: 600000 },
  );
  return res.data.data;
}

// ---- 视频片段 ----
export interface VideoClip {
  id: number;
  storyboardId: number;
  flowId: string;
  filePath: string | null;
  state: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  errorReason: string | null;
}

export async function generateVideo(projectId: number, episodeId: number, sbId: number): Promise<VideoClip> {
  const res = await http.post(`/projects/${projectId}/episodes/${episodeId}/storyboards/${sbId}/video`);
  return res.data.data;
}

export async function getVideo(projectId: number, episodeId: number, sbId: number): Promise<VideoClip> {
  const res = await http.get(`/projects/${projectId}/episodes/${episodeId}/storyboards/${sbId}/video`);
  return res.data.data;
}

// ---- 整集长视频（MiniMaxH3 Director 串联）----
export interface EpisodeLongVideo {
  id: number;
  projectId: number;
  episodeId: number;
  filePath: string | null;
  state: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  errorReason: string | null;
  segmentCount: number;
  totalFrames: number;
  segments: Array<{ index: number; id: number; prompt: string; firstFrame: string | null }>;
  segmentStates: string[];
}

export async function getLongVideo(projectId: number, episodeId: number, sceneIndex?: number): Promise<EpisodeLongVideo | null> {
  const res = await http.get(`/projects/${projectId}/episodes/${episodeId}/long-video`, {
    params: sceneIndex != null ? { sceneIndex } : undefined,
  });
  return res.data.data;
}

export async function generateLongVideo(projectId: number, episodeId: number, sceneIndex?: number): Promise<any> {
  const res = await http.post(`/projects/${projectId}/episodes/${episodeId}/long-video`, sceneIndex != null ? { sceneIndex } : {});
  return res.data.data;
}

export async function rerunLongVideoSegment(projectId: number, episodeId: number, idx: number, sceneIndex?: number): Promise<any> {
  const res = await http.post(`/projects/${projectId}/episodes/${episodeId}/long-video/segments/${idx}/rerun`, sceneIndex != null ? { sceneIndex } : {});
  return res.data.data;
}
