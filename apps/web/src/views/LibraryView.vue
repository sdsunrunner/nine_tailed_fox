<template>
  <div class="library">
    <!-- 筛选栏 -->
    <div class="lib-toolbar">
      <el-radio-group v-model="kind" @change="load">
        <el-radio-button label="all">全部</el-radio-button>
        <el-radio-button label="asset">角色/场景/道具</el-radio-button>
        <el-radio-button label="storyboard">分镜图</el-radio-button>
        <el-radio-button label="video">视频</el-radio-button>
      </el-radio-group>
      <el-select v-model="projectId" size="small" style="width: 200px" clearable placeholder="全部项目" @change="load">
        <el-option v-for="p in projects" :key="p.id" :label="p.name" :value="p.id" />
      </el-select>
      <span class="lib-count">共 {{ items.length }} 项</span>
      <div class="search-box">
        <el-input
          v-model="searchQuery"
          size="small"
          placeholder="语义搜索（如：月光下的少年）"
          clearable
          @keyup.enter="onSemanticSearch"
        />
        <el-button size="small" type="primary" :loading="searching" @click="onSemanticSearch">
          语义搜索
        </el-button>
        <el-button v-if="searchMode" size="small" text @click="exitSearch">退出搜索</el-button>
      </div>
    </div>

    <div v-if="searchMode" class="search-result-info">
      语义搜索结果（基于记忆向量检索）：{{ searchQuery }}
    </div>

    <!-- 卡片网格 -->
    <div class="lib-grid">
      <div v-for="(item, i) in items" :key="i" class="lib-card" @click="onCardClick(item)">
        <div class="lib-media">
          <video
            v-if="item.kind === 'video'"
            :src="item.filePath"
            muted
            preload="metadata"
            class="lib-video"
          />
          <img v-else :src="item.filePath" class="lib-img" loading="lazy" />
        </div>
        <div class="lib-info">
          <div class="lib-name">{{ item.name }}</div>
          <div class="lib-meta">
            <el-tag size="small" :type="tagType(item)">{{ tagText(item) }}</el-tag>
            <span class="lib-loc">{{ item.projectName }} / {{ item.episodeName }}</span>
          </div>
        </div>
      </div>
      <el-empty v-if="items.length === 0" description="暂无素材" :image-size="80" />
    </div>

    <!-- 预览大图 -->
    <el-dialog v-model="previewVisible" :title="preview?.name ?? ''" width="auto" append-to-body>
      <video v-if="preview?.kind === 'video'" :src="preview.filePath" controls class="preview-video" />
      <img v-else :src="preview.filePath" class="preview-img" />
      <div class="preview-meta" v-if="preview">
        类型：{{ tagText(preview) }} ｜ 项目：{{ preview.projectName }} / {{ preview.episodeName }}
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { http, getProjects } from "../api/client";

const router = useRouter();

const kind = ref("all");
const projectId = ref<number | undefined>(undefined);
const projects = ref<{ id: number; name: string }[]>([]);
const items = ref<any[]>([]);
const preview = ref<any | null>(null);
const searchQuery = ref("");
const searching = ref(false);
const searchMode = ref(false);

const previewVisible = computed({
  get: () => preview.value != null,
  set: (v: boolean) => {
    if (!v) preview.value = null;
  },
});

const KIND_LABEL: Record<string, string> = {
  asset_character: "角色",
  asset_scene: "场景",
  asset_prop: "道具",
  storyboard: "分镜图",
  video: "视频",
};

function tagText(item: any) {
  if (item.kind === "asset") return KIND_LABEL[`asset_${item.type}`] ?? "资产";
  return KIND_LABEL[item.kind] ?? item.kind;
}

function tagType(item: any): "primary" | "success" | "warning" | "info" {
  if (item.kind === "video") return "warning";
  if (item.kind === "storyboard") return "success";
  return "primary";
}

async function load() {
  const params = new URLSearchParams();
  params.set("kind", kind.value);
  if (projectId.value) params.set("projectId", String(projectId.value));
  const res = await http.get(`/library?${params.toString()}`);
  items.value = res.data.data;
}

/** 资产单项 → 进入画布定位生产；分镜/视频 → 预览 */
function onCardClick(item: any) {
  if (item.kind === "asset" && item.id != null) {
    router.push(`/canvas/${item.projectId}/${item.episodeId ?? 1}?asset=${item.id}`);
  } else {
    preview.value = item;
  }
}

async function onSemanticSearch() {
  const q = searchQuery.value.trim();
  if (!q) {
    ElMessage.warning("请输入搜索内容");
    return;
  }
  searching.value = true;
  try {
    const res = await http.post("/memory/search", { query: q, top_k: 12 });
    const hits = res.data.data;
    items.value = hits.map((h: any) => ({
      kind: h.kind,
      type: h.type,
      name: h.text.split("：")[0] ?? "素材",
      filePath: h.filePath,
      state: "SUCCEEDED",
      projectId: h.projectId,
      episodeId: h.episodeId,
      projectName: `score ${h.score}`,
      episodeName: "",
    }));
    searchMode.value = true;
  } catch (e: any) {
    ElMessage.error(`语义搜索失败：${e?.response?.data?.message ?? e?.message}`);
  } finally {
    searching.value = false;
  }
}

function exitSearch() {
  searchMode.value = false;
  searchQuery.value = "";
  load();
}

onMounted(async () => {
  projects.value = await getProjects();
  await load();
});
</script>

<style scoped>
.library {
  height: 100vh;
  padding: 16px;
  overflow-y: auto;
  box-sizing: border-box;
}
.lib-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.lib-count { color: #8a919c; font-size: 12px; }
.search-box { display: flex; align-items: center; gap: 6px; margin-left: auto; }
.search-box .el-input { width: 240px; }
.search-result-info { color: #c98a2d; font-size: 12px; margin-bottom: 12px; }
.lib-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}
.lib-card {
  background: #ffffff;
  border: 1px solid #e4e6eb;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.2s;
}
.lib-card:hover { border-color: #c98a2d; }
.lib-media {
  height: 200px;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.lib-img, .lib-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.lib-info { padding: 8px; }
.lib-name {
  color: #d5dbe3;
  font-size: 13px;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lib-meta { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.lib-loc { color: #8a919c; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.preview-img { max-width: 70vw; max-height: 65vh; display: block; }
.preview-video { max-width: 70vw; max-height: 65vh; }
.preview-meta { color: #6b7380; font-size: 12px; margin-top: 8px; }
</style>
