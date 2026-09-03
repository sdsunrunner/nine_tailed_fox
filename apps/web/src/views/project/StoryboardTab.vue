<template>
  <div class="tab-pane">
    <div class="pane-head">
      <h3>分镜（镜头卡片）</h3>
      <div class="pane-actions">
        <el-button size="small" type="warning" plain :loading="busy" @click="batch('images')">
          批量生成分镜图
        </el-button>
        <el-button size="small" type="warning" plain :loading="busy" @click="batch('videos')">
          批量生成视频
        </el-button>
        <el-button size="small" type="primary" plain @click="$router.push(`/canvas/${projectId}/1`)">
          去画布编排 →
        </el-button>
      </div>
    </div>
    <el-table :data="items" size="small" stripe class="sb-table">
      <el-table-column label="#" width="50">
        <template #default="{ row }">#{{ row.index }}</template>
      </el-table-column>
      <el-table-column prop="name" label="镜头" width="90" />
      <el-table-column label="描述" min-width="220">
        <template #default="{ row }">
          <div class="sb-prompt">{{ (row.text ?? "").slice(0, 60) }}</div>
        </template>
      </el-table-column>
      <el-table-column label="图" width="70">
        <template #default="{ row }">
          <img v-if="row.filePath" :src="row.filePath" class="sb-thumb" />
        </template>
      </el-table-column>
      <el-table-column label="视频" width="80">
        <template #default="{ row }">
          <span v-if="row.videoPath" class="video-ok">▶ 有视频</span>
          <span v-else class="video-none">无</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag size="small" :type="stateTag(row.state)">{{ stateText(row.state) }}</el-tag>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="items.length === 0" description="暂无分镜" :image-size="70" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { http, batchGenerateStoryboardImages, batchGenerateStoryboardVideos } from "../../api/client";

const props = defineProps<{ projectId: number }>();
const items = ref<any[]>([]);
const busy = ref(false);

function stateText(s: string) {
  return { QUEUED: "未生成", RUNNING: "生成中", SUCCEEDED: "已完成", FAILED: "失败" }[s] ?? s;
}
function stateTag(s: string): "success" | "warning" | "info" | "danger" {
  return { SUCCEEDED: "success", RUNNING: "warning", FAILED: "danger" }[s] ?? "info";
}

async function load() {
  // 分镜 + 视频状态（library storyboard + video 合并）
  const params = new URLSearchParams({ projectId: String(props.projectId) });
  const sb = (await http.get(`/library?${params}&kind=storyboard`)).data.data;
  const videos = (await http.get(`/library?${params}&kind=video`)).data.data;
  const videoMap: Record<number, string> = {};
  for (const v of videos) {
    const m = v.name.match(/视频 #(\d+)/);
    if (m) videoMap[Number(m[1])] = v.filePath;
  }
  items.value = sb.map((s: any) => {
    const idx = Number((s.name ?? "").replace("分镜 #", ""));
    return { ...s, index: idx, videoPath: videoMap[idx] ?? "" };
  });
}

async function batch(kind: "images" | "videos") {
  busy.value = true;
  try {
    const n =
      kind === "images"
        ? (await batchGenerateStoryboardImages(props.projectId, 1)).triggered.length
        : (await batchGenerateStoryboardVideos(props.projectId, 1)).triggered.length;
    ElMessage.success(n > 0 ? `已触发 ${n} 个${kind === "images" ? "分镜图" : "视频"}生成` : "没有待生成项");
  } catch (e: any) {
    ElMessage.error(`批量失败：${e?.response?.data?.message ?? e?.message}`);
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.tab-pane { padding-top: 8px; }
.pane-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.pane-head h3 { color: #2b2f36; margin: 0; font-size: 15px; }
.pane-actions { display: flex; gap: 8px; align-items: center; }
.sb-table { background: #ffffff; --el-table-bg-color: #ffffff; --el-table-tr-bg-color: #ffffff; --el-table-border-color: #e4e6eb; --el-table-header-bg-color: #f8f9fb; --el-table-text-color: #4a5058; }
.sb-prompt { color: #6b7380; font-size: 12px; }
.sb-thumb { width: 48px; height: 60px; object-fit: cover; border-radius: 4px; }
.video-ok { color: #7fbf8a; font-size: 12px; }
.video-none { color: #8a919c; font-size: 12px; }
</style>
