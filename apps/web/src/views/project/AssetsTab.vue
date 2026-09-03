<template>
  <div class="tab-pane">
    <div class="pane-head">
      <h3>资产</h3>
      <div class="pane-actions">
        <el-button type="primary" plain :loading="analyzing" @click="onAnalyze">
          {{ analyzing ? "解析中…" : "🔍 解析剧本资产" }}
        </el-button>
        <el-button type="primary" plain :disabled="!analyzed || generatingAll" :loading="generatingAll" @click="onGenerateAll">
          {{ generatingAll ? ("生成中 " + generateProgress + "/" + generateTotal + "…") : "🎨 生成所有资产" }}
        </el-button>
      </div>
    </div>

    <el-tabs v-model="activeType" @tab-change="load">
      <el-tab-pane label="所有资产" name="all" />
      <el-tab-pane label="角色" name="character" />
      <el-tab-pane label="场景" name="scene" />
      <el-tab-pane label="道具" name="prop" />
      <el-tab-pane label="素材" name="material" />
    </el-tabs>

    <!-- 资产卡：只显示缩略图 + 名字 + 出现集；点击进入详情页编辑 -->
    <div class="asset-grid">
      <div
        v-for="c in cards"
        :key="c.key"
        class="asset-card"
        :title="`${c.name} · 点击进入详情编辑`"
        @click="goDetail(c)"
      >
        <template v-if="c.asset">
          <img v-if="c.asset.filePath" :src="c.asset.filePath" class="asset-img" loading="lazy" />
          <div v-else class="noimg">
            <el-tag size="small" :type="stateTag(c.asset.state)">{{ stateText(c.asset.state) }}</el-tag>
          </div>
        </template>
        <template v-else>
          <div class="placeholder">
            <span class="placeholder-icon">{{ typeIcon(c.type) }}</span>
          </div>
        </template>
        <div class="asset-info">
          <span class="asset-name">{{ c.name }}</span>
        </div>
        <div class="asset-ep">出现于：{{ epLabel(c.episodes) }}</div>
        <div v-if="c.asset?.voiceActor" class="asset-voice">🎙 {{ c.asset.voiceActor }}{{ c.asset.voiceDialect ? " · " + c.asset.voiceDialect : "" }}</div>
      </div>
      <el-empty v-if="!cards.length && !analyzing" :description="emptyHint" :image-size="60" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import {
  http,
  listEpisodes,
  aiScriptCharactersAll,
  aiScriptAssetsAll,
  getEpisodeAssets,
  createAsset,
  generateAsset,
  saveEpisodeAssets,
  type Episode,
  type ScriptCharacterAll,
  type ScriptAssetAll,
  type EpisodeAssetItem,
} from "../../api/client";

const props = defineProps<{ projectId: number }>();
const router = useRouter();
const activeType = ref("all");
const analyzing = ref(false);
const episodes = ref<Episode[]>([]);
// 各类分析卡片：character / scene / prop / material → { type, name, description, episodes, asset?, key }
const cardsByType = ref<Record<string, any[]>>({});
const analyzed = ref(false);

const TYPE_ORDER = ["character", "scene", "prop", "material"] as const;
type CardType = (typeof TYPE_ORDER)[number];

const TYPE_LABEL: Record<string, string> = {
  character: "角色",
  scene: "场景",
  prop: "道具",
  material: "素材",
};

/** 当前 tab 卡片（所有资产 = 四类合并） */
const cards = computed(() => {
  if (activeType.value === "all") {
    const merged: any[] = [];
    for (const t of TYPE_ORDER) merged.push(...(cardsByType.value[t] ?? []));
    return merged;
  }
  return cardsByType.value[activeType.value] ?? [];
});

const emptyHint = computed(() => {
  if (!analyzed.value) return "暂无资产分析结果，请先完成剧本，再点击右上角「解析剧本资产」按钮";
  if (activeType.value === "all") return "分析未返回任何资产";
  return `暂无${TYPE_LABEL[activeType.value] ?? ""}`;
});

function typeIcon(t: string) {
  return t === "character" ? "👤" : t === "scene" ? "🏞️" : t === "prop" ? "🔧" : "✨";
}

function stateText(s: string) {
  return { QUEUED: "未生成", RUNNING: "生成中", SUCCEEDED: "已完成", FAILED: "失败" }[s] ?? s;
}
function stateTag(s: string): "success" | "warning" | "info" | "danger" {
  return { SUCCEEDED: "success", RUNNING: "warning", FAILED: "danger" }[s] ?? "info";
}

function epLabel(eps: number[]) {
  if (!eps?.length) return "—";
  return "第" + [...new Set(eps)].sort((a, b) => a - b).join("、") + "集";
}

/** 点击卡片 → 详情页编辑（有资产 ?asset=id；无资产 ?create=type&name 先进详情，上传/生成在详情页操作） */
function goDetail(c: any) {
  const ep = resolveEp(c);
  if (!ep) {
    ElMessage.warning("暂无可归属的集，请先创建集");
    return;
  }
  if (c.asset?.id != null) {
    router.push(`/canvas/${props.projectId}/${c.asset.episodeId ?? ep.id}?asset=${c.asset.id}`);
  } else {
    const type = c.type === "material" ? "prop" : c.type;
    router.push(`/canvas/${props.projectId}/${ep.id}?create=${type}&name=${encodeURIComponent(c.name)}`);
  }
}

/** 卡片所属集（首次出现的集，兜底第一集） */
function resolveEp(c: any): Episode | undefined {
  const firstIndex = (c.episodes ?? [])[0];
  return episodes.value.find((e) => e.index === firstIndex) ?? episodes.value[0];
}

async function loadTypeAssets(type: string) {
  const res = await http.get(`/library?kind=asset&projectId=${props.projectId}`);
  return res.data.data.filter((a: any) => a.type === type);
}

function matchAsset(name: string, assets: any[]) {
  return (
    assets.find((a) => a.name === name || a.name.includes(name) || name.includes(a.name)) ?? null
  );
}

/** 从整片剧本解析「场号 → 场文本」（## 场 N 为节点，含场标题行） */
function parseSceneTexts(script: string): Array<{ index: number; script: string }> {
  const list: Array<{ index: number; script: string }> = [];
  const lines = (script ?? "").split(/\r?\n/);
  let cur: { index: number; text: string[] } | null = null;
  for (const ln of lines) {
    const m = /^##\s*场\s*(\d+)([^\n]*)/.exec(ln.trim());
    if (m) {
      if (cur) list.push({ index: cur.index, script: cur.text.join("\n") });
      cur = { index: parseInt(m[1], 10), text: [] };
      cur.text.push(ln);
    } else if (cur) {
      cur.text.push(ln);
    }
  }
  if (cur) list.push({ index: cur.index, script: cur.text.join("\n") });
  return list;
}

/** 一键分析资产：出场人物 + 场景 + 道具 + 素材（一次全部） */
async function onAnalyze() {
  // 剧本权威源 = 整片剧本（Project.scriptContent）；场记录 scriptContent 已废弃
  let sceneScripts: Array<{ index: number; script: string }> = [];
  try {
    const res = await http.get("/projects");
    const proj = (res.data?.data ?? []).find((p: any) => p.id === props.projectId);
    sceneScripts = parseSceneTexts(proj?.scriptContent ?? "");
  } catch {
    sceneScripts = [];
  }
  if (!sceneScripts.length) {
    ElMessage.warning("暂无剧本，请先在「小说」页开始制作或到「剧本」页编写整片剧本");
    return;
  }
  analyzing.value = true;
  try {
    // 1. 出场人物
    const charList: ScriptCharacterAll[] = await aiScriptCharactersAll(sceneScripts, props.projectId);
    // 2. 场景/道具/素材
    const assetList: ScriptAssetAll[] = await aiScriptAssetsAll(sceneScripts, props.projectId);

    const charAssets = await loadTypeAssets("character");
    cardsByType.value.character = (charList ?? []).map((c, i) => ({
      type: "character",
      name: c.name,
      description: c.description,
      episodes: c.episodes ?? [],
      asset: matchAsset(c.name, charAssets),
      key: `character-${i}`,
    }));

    for (const t of ["scene", "prop", "material"] as const) {
      const typeAssets = await loadTypeAssets(t);
      cardsByType.value[t] = (assetList ?? [])
        .filter((a) => a.type === t)
        .map((a, i) => ({
          type: t,
          name: a.name,
          description: a.description,
          episodes: a.episodes ?? [],
          asset: matchAsset(a.name, typeAssets),
          key: `${t}-${i}`,
        }));
    }
    analyzed.value = true;
    // 持久化分析结果（记录出现的集 → 分集视频详情页直接查询显示）
    const items = TYPE_ORDER.flatMap((t) =>
      (cardsByType.value[t] ?? []).map((c) => ({
        type: t,
        name: c.name,
        description: c.description,
        episodes: c.episodes ?? [],
      })),
    );
    try {
      await saveEpisodeAssets(props.projectId, items);
    } catch {
      // 持久化失败不阻断展示
    }
    const total = TYPE_ORDER.reduce((s, t) => s + (cardsByType.value[t]?.length ?? 0), 0);
    ElMessage.success(`已分析 ${total} 项：${TYPE_ORDER.map((t) => `${TYPE_LABEL[t]} ${cardsByType.value[t]?.length ?? 0}`).join(" / ")}`);
  } catch (e: any) {
    ElMessage.error(`分析失败：${e?.response?.data?.message ?? e?.message}`);
  } finally {
    analyzing.value = false;
  }
}

/** 生成所有资产：遍历分析结果，逐个创建（若无资产）并生成；已有图跳过 */
const generatingAll = ref(false);
const generateTotal = ref(0);
const generateProgress = ref(0);
async function onGenerateAll() {
  if (!analyzed.value || generatingAll.value) return; // 生成中不可重复点击
  // 收集待生成任务（按 name 去重：同名资产只生成一次，避免重复创建）
  const tasks: Array<{ type: string; name: string; c: any }> = [];
  const seen = new Set<string>();
  for (const t of ["character", "scene", "prop"] as const) {
    for (const c of cardsByType.value[t] ?? []) {
      const key = t + ":" + c.name;
      if (seen.has(key)) continue;
      seen.add(key);
      // 已有图 → 跳过
      if (c.asset?.filePath) continue;
      tasks.push({ type: t, name: c.name, c });
    }
  }
  generateTotal.value = tasks.length;
  generateProgress.value = 0;
  generatingAll.value = true;
  let ok = 0;
  let fail = 0;
  // 并发 2 个，避免打爆 ComfyUI
  const CONCURRENCY = 2;
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const t = tasks[i++];
      try {
        const ep = resolveEp(t.c);
        if (!ep) {
          fail++;
          continue;
        }
        let asset = t.c.asset;
        if (!asset) {
          // 无资产 → 创建
          const flowId = `asset-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          asset = await createAsset(props.projectId, ep.id, { flowId, type: t.type as any, name: t.name });
        }
        await generateAsset(props.projectId, asset.episodeId, asset.id);
        ok++;
      } catch {
        fail++;
      } finally {
        generateProgress.value++;
      }
    }
  }
  try {
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  } finally {
    generatingAll.value = false; // 无论成败都复位，按钮恢复可点
  }
  // 刷新资产匹配
  await load();
  for (const t of ["character", "scene", "prop"] as const) {
    const assets = await loadTypeAssets(t);
    cardsByType.value[t] = (cardsByType.value[t] ?? []).map((c) => ({
      ...c,
      asset: matchAsset(c.name, assets) ?? c.asset ?? null,
    }));
  }
}

async function load() {
  if (activeType.value === "all") return;
  // 已分析过：仅刷新资产匹配
  if (cardsByType.value[activeType.value]?.length) {
    const assets = await loadTypeAssets(activeType.value);
    cardsByType.value[activeType.value] = cardsByType.value[activeType.value].map((c) => ({
      ...c,
      asset: matchAsset(c.name, assets) ?? c.asset ?? null,
    }));
  }
}

onMounted(async () => {
  episodes.value = await listEpisodes(props.projectId).catch(() => [] as Episode[]);
  // 从 DB 恢复历史分析结果（无需重新分析）
  try {
    const saved: EpisodeAssetItem[] = await getEpisodeAssets(props.projectId);
    if (saved.length) {
      const charAssets = await loadTypeAssets("character");
      for (const t of TYPE_ORDER) {
        const typeAssets = await loadTypeAssets(t);
        cardsByType.value[t] = saved
          .filter((a) => a.type === t)
          .map((a, i) => ({
            type: t,
            name: a.name,
            description: a.description,
            episodes: a.episodes ?? [],
            asset: matchAsset(a.name, t === "character" ? charAssets : typeAssets),
            key: `${t}-${i}`,
          }));
      }
      analyzed.value = true;
    }
  } catch {
    // 无历史分析结果，提示用户点击分析
  }
  await load();
});
</script>

<style scoped>
.tab-pane { padding-top: 8px; }
.pane-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.pane-head h3 { color: #2b2f36; margin: 0; font-size: 15px; }
.pane-actions { display: flex; gap: 8px; align-items: center; }
.asset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 12px;
}
.asset-card {
  background: #ffffff;
  border: 1px solid #e4e6eb;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.2s;
}
.asset-card:hover { border-color: #c98a2d; }
.asset-img { width: 100%; height: 170px; object-fit: cover; display: block; background: #ffffff; }
.noimg {
  width: 100%; height: 170px;
  display: flex; align-items: center; justify-content: center;
  background: #ffffff;
}
.placeholder {
  width: 100%; height: 170px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px;
  background: #f5f3ed;
}
.placeholder-icon { font-size: 34px; }
.asset-info { padding: 8px 10px 2px; display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.asset-name { color: #2b2f36; font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.asset-ep { color: #8a919c; font-size: 11px; padding: 2px 10px 10px; }
.asset-voice { color: #c98a2d; font-size: 11px; padding: 0 10px 8px; }
</style>
