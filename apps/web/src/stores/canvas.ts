import { defineStore } from "pinia";
import { ref } from "vue";
import {
  loadFlow, saveFlow, getProjects,
  createAsset, listAssets, generateAsset, getAsset, updateAsset, deleteAsset,
  listEpisodes, createEpisode, updateEpisode,
  listStoryboards, createStoryboard, updateStoryboard, deleteStoryboard,
  generateStoryboard, getStoryboard,
  generateVideo, getVideo,
  batchGenerateStoryboardImages, batchGenerateStoryboardVideos,
  aiSplitStoryboard,
  type Asset, type Episode, type Storyboard, type VideoClip, type AiSplitItem,
} from "../api/client";

export type AssetType = "character" | "scene" | "prop";

export interface CanvasNodeData {
  assetId?: number;
  flowId?: string;
  kind: "asset" | "storyboard" | "video";
  type?: AssetType;
  name?: string;
  state?: string;
  [k: string]: unknown;
}

export const useCanvasStore = defineStore("canvas", () => {
  const projectId = ref(1);
  const episodeId = ref(1);
  const projectName = ref("");
  const projects = ref<{ id: number; name: string }[]>([]);
  const nodes = ref<any[]>([]);
  const edges = ref<any[]>([]);
  const updatedAt = ref<string | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const dirty = ref(false);
  // 资产业务数据（assetId -> Asset），画布节点 data.assetId 关联
  const assets = ref<Record<number, Asset>>({});
  // 正在轮询的生成任务（assetId -> timer 句柄）
  const polling = ref<Record<number, ReturnType<typeof setInterval>>>({});
  // 正在编辑的资产（编辑面板）
  const editingAssetId = ref<number | null>(null);
  // 当前选中节点（右侧属性面板）
  const selectedNodeId = ref<string | null>(null);

  function selectNode(nodeId: string | null) {
    selectedNodeId.value = nodeId;
    // 同步画布节点 selected 态
    for (const n of nodes.value) {
      n.selected = n.id === nodeId;
    }
  }

  /** 自动布局：direction = 'lr'（横向）| 'tb'（纵向） */
  function autoLayout(direction: "lr" | "tb") {
    const assets = nodes.value.filter((n) => n.type === "asset");
    const storyboards = nodes.value.filter((n) => n.type === "storyboard");
    const others = nodes.value.filter((n) => n.type !== "asset" && n.type !== "storyboard");
    const gapX = 260;
    const gapY = 240;
    const startX = 60;
    const startY = 60;
    let placed: Record<string, { x: number; y: number }> = {};

    if (direction === "lr") {
      // 横向：资产一排在上，分镜一排在下
      assets.forEach((n, i) => (placed[n.id] = { x: startX + i * gapX, y: startY }));
      storyboards.forEach((n, i) => (placed[n.id] = { x: startX + i * gapX, y: startY + 260 }));
      others.forEach((n, i) => (placed[n.id] = { x: startX + i * gapX, y: startY + 520 }));
    } else {
      // 纵向：资产列在上，分镜列在下
      assets.forEach((n, i) => (placed[n.id] = { x: startX, y: startY + i * gapY }));
      storyboards.forEach((n, i) => (placed[n.id] = { x: startX + 320, y: startY + i * gapY }));
      others.forEach((n, i) => (placed[n.id] = { x: startX + 640, y: startY + i * gapY }));
    }
    for (const n of nodes.value) {
      if (placed[n.id]) n.position = { ...placed[n.id] };
    }
    dirty.value = true;
  }
  // 集与剧本
  const episodes = ref<Episode[]>([]);
  const scriptDrawer = ref(false);
  const scriptDraft = ref("");
  const scriptSaving = ref(false);
  // 分镜卡
  const storyboards = ref<Record<number, Storyboard>>({});
  const sbPolling = ref<Record<number, ReturnType<typeof setInterval>>>({});
  const editingStoryboardId = ref<number | null>(null);
  // 视频（按 storyboardId）
  const videos = ref<Record<number, VideoClip>>({});
  const videoPolling = ref<Record<number, ReturnType<typeof setInterval>>>({});

  /** 加载各分镜的视频状态（并发单查，404 跳过） */
  async function loadVideos() {
    const list = await listStoryboards(projectId.value, episodeId.value);
    await Promise.all(
      list.map(async (sb) => {
        try {
          const clip = await getVideo(projectId.value, episodeId.value, sb.id);
          videos.value[sb.id] = clip;
          syncSbVideo(sb.id, clip.state, clip.filePath ?? undefined);
        } catch {
          // 无视频记录
        }
      }),
    );
  }

  /** 触发视频生成 + 轮询（分镜图 → Minimax H3 图生视频） */
  async function generateVideoNode(sbId: number) {
    if (videoPolling.value[sbId]) return;
    const sb = storyboards.value[sbId];
    if (!sb) return;
    const clip = await generateVideo(projectId.value, episodeId.value, sbId);
    videos.value[sbId] = clip;
    syncSbVideo(sbId, "RUNNING");
    startVideoPolling(sbId);
  }

  /** 仅轮询视频（批量触发后使用） */
  function startVideoPolling(sbId: number) {
    if (videoPolling.value[sbId]) return;
    const timer = setInterval(async () => {
      try {
        const cur = await getVideo(projectId.value, episodeId.value, sbId);
        videos.value[sbId] = cur;
        syncSbVideo(sbId, cur.state, cur.filePath ?? undefined);
        if (cur.state === "SUCCEEDED" || cur.state === "FAILED") {
          clearInterval(timer);
          delete videoPolling.value[sbId];
        }
      } catch {
        clearInterval(timer);
        delete videoPolling.value[sbId];
      }
    }, 5000);
    videoPolling.value[sbId] = timer;
  }

  /** 批量生成所有有图分镜的视频 */
  async function batchGenerateVideos() {
    const { triggered } = await batchGenerateStoryboardVideos(projectId.value, episodeId.value);
    for (const id of triggered) {
      if (videos.value[id]) videos.value[id] = { ...videos.value[id], state: "RUNNING" };
      syncSbVideo(id, "RUNNING");
      startVideoPolling(id);
    }
    return triggered.length;
  }

  function syncSbVideo(sbId: number, state: string, filePath?: string) {
    for (const node of nodes.value) {
      if (node.data?.storyboardId === sbId) {
        node.data = {
          ...node.data,
          videoState: state,
          ...(filePath !== undefined ? { videoPath: filePath } : {}),
        };
      }
    }
  }

  /** 加载分镜并同步节点 */
  async function loadStoryboards() {
    const list = await listStoryboards(projectId.value, episodeId.value);
    const map: Record<number, Storyboard> = {};
    for (const s of list) map[s.id] = s;
    storyboards.value = map;
    for (const node of nodes.value) {
      const sbId = node.data?.storyboardId as number | undefined;
      if (sbId && map[sbId]) {
        node.data = {
          ...node.data,
          state: map[sbId].state,
          filePath: map[sbId].filePath,
          prompt: map[sbId].prompt,
          index: map[sbId].index,
        };
      }
    }
  }

  /** 新建分镜节点（业务记录 + 画布节点） */
  async function addStoryboardNode(prompt?: string, videoDesc?: string): Promise<string | null> {
    const flowId = `sb-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const sb = await createStoryboard(projectId.value, episodeId.value, {
      flowId,
      prompt: prompt ?? "",
      videoDesc: videoDesc ?? "",
    });
    storyboards.value[sb.id] = sb;
    const pos = { x: 80 + Math.random() * 300, y: 480 + Math.random() * 200 };
    nodes.value.push({
      id: flowId,
      type: "storyboard",
      position: pos,
      data: {
        storyboardId: sb.id,
        flowId,
        kind: "storyboard",
        index: sb.index,
        prompt: sb.prompt,
        videoDesc: sb.videoDesc,
        state: sb.state,
        filePath: sb.filePath,
      },
    });
    dirty.value = true;
    return flowId;
  }

  /** AI 拆镜：剧本 → 批量创建分镜卡（携带项目手册配置） */
  async function aiSplit(script: string): Promise<number> {
    const items = await aiSplitStoryboard(script, projectId.value);
    // 按 index 排序后创建，位置横向排开
    const sorted = [...items].sort((a, b) => a.index - b.index);
    for (const item of sorted) {
      await addStoryboardNode(item.prompt, item.videoDesc);
    }
    return sorted.length;
  }

  /** 触发生成分镜图 + 轮询 */
  async function generateStoryboardNode(sbId: number) {
    if (sbPolling.value[sbId]) return;
    const sb = storyboards.value[sbId];
    if (!sb) return;
    await generateStoryboard(projectId.value, episodeId.value, sbId);
    sb.state = "RUNNING";
    syncSbState(sbId, "RUNNING");
    startSbPolling(sbId);
  }

  /** 仅轮询（批量触发后使用，不重复触发） */
  function startSbPolling(sbId: number) {
    if (sbPolling.value[sbId]) return;
    const timer = setInterval(async () => {
      try {
        const cur = await getStoryboard(projectId.value, episodeId.value, sbId);
        storyboards.value[sbId] = cur;
        syncSbState(sbId, cur.state, cur.filePath ?? undefined);
        if (cur.state === "SUCCEEDED" || cur.state === "FAILED") {
          clearInterval(timer);
          delete sbPolling.value[sbId];
        }
      } catch {
        clearInterval(timer);
        delete sbPolling.value[sbId];
      }
    }, 1500);
    sbPolling.value[sbId] = timer;
  }

  /** 批量生成所有未完成分镜图 */
  async function batchGenerateImages() {
    const { triggered } = await batchGenerateStoryboardImages(projectId.value, episodeId.value);
    for (const id of triggered) {
      if (storyboards.value[id]) storyboards.value[id] = { ...storyboards.value[id], state: "RUNNING" };
      syncSbState(id, "RUNNING");
      startSbPolling(id);
    }
    return triggered.length;
  }

  function syncSbState(sbId: number, state: string, filePath?: string) {
    for (const node of nodes.value) {
      if (node.data?.storyboardId === sbId) {
        node.data = { ...node.data, state, ...(filePath !== undefined ? { filePath } : {}) };
      }
    }
  }

  async function updateStoryboardInfo(sbId: number, patch: { index?: number; prompt?: string; videoDesc?: string; assetIds?: number[] }) {
    const updated = await updateStoryboard(projectId.value, episodeId.value, sbId, patch);
    storyboards.value[sbId] = updated;
    for (const node of nodes.value) {
      if (node.data?.storyboardId === sbId) {
        node.data = { ...node.data, index: updated.index, prompt: updated.prompt, videoDesc: updated.videoDesc };
      }
    }
    return updated;
  }

  async function removeStoryboardNode(nodeId: string, sbId?: number) {
    if (sbId) {
      if (sbPolling.value[sbId]) {
        clearInterval(sbPolling.value[sbId]);
        delete sbPolling.value[sbId];
      }
      if (editingStoryboardId.value === sbId) editingStoryboardId.value = null;
      try {
        await deleteStoryboard(projectId.value, episodeId.value, sbId);
      } catch {
        // 忽略
      }
      delete storyboards.value[sbId];
    }
    nodes.value = nodes.value.filter((n) => n.id !== nodeId);
    edges.value = edges.value.filter((e) => e.source !== nodeId && e.target !== nodeId);
    dirty.value = true;
  }

  async function loadEpisodes() {
    episodes.value = await listEpisodes(projectId.value);
  }

  async function addEpisode(name: string): Promise<Episode> {
    const ep = await createEpisode(projectId.value, name);
    episodes.value.push(ep);
    return ep;
  }

  async function saveScript(content: string) {
    scriptSaving.value = true;
    try {
      await updateEpisode(projectId.value, episodeId.value, { scriptContent: content });
      return true;
    } finally {
      scriptSaving.value = false;
    }
  }

  async function initProjects() {
    projects.value = await getProjects();
  }

  async function load(pid: number, eid: number) {
    loading.value = true;
    try {
      const data = await loadFlow(pid, eid);
      projectId.value = pid;
      episodeId.value = eid;
      projectName.value = data.project.name;
      nodes.value = data.nodes as any[];
      edges.value = data.edges as any[];
      updatedAt.value = data.updatedAt;
      dirty.value = false;
      await loadAssets();
      await loadEpisodes();
      await loadStoryboards();
      await loadVideos();
    } finally {
      loading.value = false;
    }
  }

  /** 加载资产业务数据，并同步到画布节点 data */
  async function loadAssets() {
    const list = await listAssets(projectId.value, episodeId.value);
    const map: Record<number, Asset> = {};
    for (const a of list) map[a.id] = a;
    assets.value = map;
    // 同步节点状态与图片
    for (const node of nodes.value) {
      const assetId = node.data?.assetId as number | undefined;
      if (assetId && map[assetId]) {
        node.data = { ...node.data, state: map[assetId].state, filePath: map[assetId].filePath };
      }
    }
  }

  async function save() {
    saving.value = true;
    try {
      await saveFlow(projectId.value, episodeId.value, nodes.value, edges.value);
      dirty.value = false;
      updatedAt.value = new Date().toISOString();
      return true;
    } finally {
      saving.value = false;
    }
  }

  /** 新建资产节点（创建业务记录 + 画布节点） */
  async function addAssetNode(type: AssetType, name?: string): Promise<string | null> {
    const flowId = `asset-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const asset = await createAsset(projectId.value, episodeId.value, {
      flowId,
      type,
      name: name ?? `未命名${type === "character" ? "角色" : type === "scene" ? "场景" : "道具"}`,
    });
    assets.value[asset.id] = asset;
    const pos = { x: 80 + Math.random() * 400, y: 80 + Math.random() * 300 };
    nodes.value.push({
      id: flowId,
      type: "asset",
      position: pos,
      data: { assetId: asset.id, flowId, kind: "asset", type, name: asset.name, state: asset.state },
    });
    dirty.value = true;
    return flowId;
  }

  /** 触发生成 + 轮询状态直到终态 */
  async function generate(assetId: number) {
    if (polling.value[assetId]) return; // 已在轮询
    const asset = assets.value[assetId];
    if (!asset) return;
    await generateAsset(projectId.value, episodeId.value, assetId);
    asset.state = "RUNNING";
    syncNodeState(assetId, "RUNNING");

    const timer = setInterval(async () => {
      try {
        const cur = await getAsset(projectId.value, episodeId.value, assetId);
        assets.value[assetId] = cur;
        syncNodeState(assetId, cur.state, cur.filePath ?? undefined);
        if (cur.state === "SUCCEEDED" || cur.state === "FAILED") {
          clearInterval(timer);
          delete polling.value[assetId];
        }
      } catch {
        clearInterval(timer);
        delete polling.value[assetId];
      }
    }, 1200);
    polling.value[assetId] = timer;
  }

  function syncNodeState(assetId: number, state: string, filePath?: string) {
    for (const node of nodes.value) {
      if (node.data?.assetId === assetId) {
        node.data = {
          ...node.data,
          state,
          ...(filePath !== undefined ? { filePath } : {}),
        };
      }
    }
  }

  /** 打开/关闭编辑面板 */
  function openEdit(assetId: number) {
    editingAssetId.value = assetId;
  }
  function closeEdit() {
    editingAssetId.value = null;
  }

  /** 保存资产编辑（名称/类型/提示词），同步节点 data */
  async function updateAssetInfo(assetId: number, patch: { name?: string; type?: Asset["type"]; prompt?: string }) {
    const updated = await updateAsset(projectId.value, episodeId.value, assetId, patch);
    assets.value[assetId] = updated;
    for (const node of nodes.value) {
      if (node.data?.assetId === assetId) {
        node.data = {
          ...node.data,
          name: updated.name,
          type: updated.type,
          prompt: updated.prompt,
        };
      }
    }
    return updated;
  }

  /** 删除节点：清理轮询 + 删除业务资产 + 移除画布节点 */
  async function removeAssetNode(nodeId: string, assetId?: number) {
    if (assetId) {
      if (polling.value[assetId]) {
        clearInterval(polling.value[assetId]);
        delete polling.value[assetId];
      }
      if (editingAssetId.value === assetId) closeEdit();
      try {
        await deleteAsset(projectId.value, episodeId.value, assetId);
      } catch {
        // 资产删除失败不阻断节点移除
      }
      delete assets.value[assetId];
    }
    nodes.value = nodes.value.filter((n) => n.id !== nodeId);
    edges.value = edges.value.filter((e) => e.source !== nodeId && e.target !== nodeId);
    dirty.value = true;
  }

  /** 按节点 id 列表批量删除（Delete 键 / 批量操作） */
  async function removeNodesByIds(ids: string[]) {
    for (const id of ids) {
      const node = nodes.value.find((n) => n.id === id);
      await removeAssetNode(id, node?.data?.assetId as number | undefined);
    }
  }

  function clear() {
    for (const t of Object.values(polling.value)) clearInterval(t);
    for (const t of Object.values(sbPolling.value)) clearInterval(t);
    for (const t of Object.values(videoPolling.value)) clearInterval(t);
    polling.value = {};
    sbPolling.value = {};
    videoPolling.value = {};
    nodes.value = [];
    edges.value = [];
    assets.value = {};
    storyboards.value = {};
    videos.value = {};
    selectedNodeId.value = null;
    dirty.value = true;
  }

  return {
    projectId, episodeId, projectName, projects,
    nodes, edges, updatedAt, loading, saving, dirty,
    assets, polling, editingAssetId,
    episodes, scriptDrawer, scriptDraft, scriptSaving,
    storyboards, sbPolling, editingStoryboardId,
    videos, videoPolling,
    selectedNodeId, selectNode, autoLayout,
    initProjects, load, save, addAssetNode, generate, syncNodeState,
    openEdit, closeEdit, updateAssetInfo, removeAssetNode, removeNodesByIds, clear,
    loadEpisodes, addEpisode, saveScript,
    loadStoryboards, addStoryboardNode, generateStoryboardNode, syncSbState,
    updateStoryboardInfo, removeStoryboardNode,
    loadVideos, generateVideoNode, syncSbVideo,
    startSbPolling, startVideoPolling, batchGenerateImages, batchGenerateVideos,
    aiSplit,
  };
});
