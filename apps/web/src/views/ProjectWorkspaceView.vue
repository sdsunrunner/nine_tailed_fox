<template>
  <div class="workspace">
    <header class="ws-topbar">
      <div class="ws-brand">
        <span class="ws-name">{{ projectName }}</span>
        <el-tag size="small" type="info">{{ project?.videoRatio ?? "9:16" }}</el-tag>
        <el-tag v-if="visualSkillDisplay" size="small" type="warning">{{ visualSkillDisplay }}</el-tag>
        <el-tag v-if="project?.directorSkill" size="small">{{ skillDisplay(project.directorSkill) }}</el-tag>
        <el-tag v-if="project?.totalDurationMin" size="small" type="success">短片约 {{ project.totalDurationMin }} 分钟</el-tag>
      </div>
    </header>

    <el-tabs v-model="active" class="ws-tabs" @tab-change="onTabChange">
      <el-tab-pane label="① 小说" name="novel">
        <NovelTab :project-id="pid" @project-updated="onProjectUpdated" />
      </el-tab-pane>
      <el-tab-pane label="② 剧本" name="script">
        <ScriptTab ref="scriptTabRef" :project-id="pid" />
      </el-tab-pane>
      <el-tab-pane label="③ 资产" name="assets">
        <AssetsTab :project-id="pid" />
      </el-tab-pane>
      <el-tab-pane label="④ 分场视频" name="video">
        <VideoTab :project-id="pid" :initial-episode-id="initialEpisodeId" :tab-active="active === 'video'" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { http } from "../api/client";
import { recordRecentProject } from "../utils/recentProjects";
import NovelTab from "./project/NovelTab.vue";
import ScriptTab from "./project/ScriptTab.vue";
import AssetsTab from "./project/AssetsTab.vue";
import VideoTab from "./project/VideoTab.vue";

const route = useRoute();
const router = useRouter();
const pid = Number(route.params.projectId);
const project = ref<any>(null);
const projectName = ref("");
// 剧本页子组件引用（开始制作/切页时刷新其数据）
const scriptTabRef = ref<{ reload?: () => Promise<void> } | null>(null);

/** 开始制作等事件后：刷新顶部信息条 + 剧本页数据 */
async function onProjectUpdated() {
  await load();
  void scriptTabRef.value?.reload?.();
}

// 支持 ?tab=video&ep=123 从外部定位（如剧本页拆镜后跳转）
const initialEpisodeId = route.query.ep ? Number(route.query.ep) : undefined;

const TAB_NAMES = ["novel", "script", "assets", "video"] as const;
type TabName = (typeof TAB_NAMES)[number];

/** 当前激活 tab：始终以 URL ?tab= 为准（缺省 novel），显示内容与高亮由同一值驱动 */
const active = ref<TabName>(parseTab(route.query.tab));

function parseTab(v: unknown): TabName {
  return typeof v === "string" && (TAB_NAMES as readonly string[]).includes(v) ? (v as TabName) : "novel";
}

/** 切换 tab → 同步 URL（replace 保持历史干净；非视频 tab 移除 ep 残留） */
function onTabChange(name: TabName | string) {
  const t = parseTab(name);
  const query: Record<string, unknown> = { ...route.query, tab: t };
  if (t !== "video") delete query.ep;
  router.replace({ query });
  // 切到剧本页时刷新（开始制作/编辑后返回能看到最新结果）
  if (t === "script") void scriptTabRef.value?.reload?.();
}

// URL query 变化（含浏览器前进/后退、外部链接）→ 同步激活 tab
watch(
  () => route.query.tab,
  (v) => {
    active.value = parseTab(v);
  },
);

// 切换项目（组件复用）时，若 URL 无 tab 参数则回到默认「小说」
watch(
  () => route.params.projectId,
  () => {
    if (route.query.tab == null) active.value = "novel";
  },
);

const skillMap = ref<Record<string, string>>({});

async function load() {
  const [projectsRes, artRes, storyRes] = await Promise.all([
    http.get("/projects"),
    http.get("/skills", { params: { category: "art" } }),
    http.get("/skills", { params: { category: "story" } }),
  ]);
  // 构建 name → displayName 映射（手册显示中文名）
  const map: Record<string, string> = {};
  for (const s of [...(artRes.data.data ?? []), ...(storyRes.data.data ?? [])]) {
    map[s.name] = s.displayName ?? s.name;
  }
  skillMap.value = map;
  project.value = (projectsRes.data.data as any[]).find((p: any) => p.id === pid) ?? null;
  projectName.value = project.value?.name ?? `项目 ${pid}`;
  // 记录最近打开（侧边栏缩略卡片）；顺带取项目首图作缩略图
  let thumb: string | undefined;
  try {
    const lib = await http.get("/library", { params: { kind: "asset", projectId: pid } });
    const arr = (lib.data?.data ?? []) as any[];
    thumb = arr.find((a: any) => a.filePath)?.filePath ?? undefined;
  } catch {
    thumb = undefined;
  }
  recordRecentProject(pid, projectName.value, thumb);
}

function skillDisplay(key: string | undefined): string {
  if (!key) return "";
  return skillMap.value[key] ?? key;
}

/** 视觉风格显示：优先项目视觉手册；未选时回退为导演电影美学（如「侯孝贤电影美学」） */
const visualSkillDisplay = computed(() => {
  if (project.value?.visualSkill) return skillDisplay(project.value.visualSkill);
  const dk = project.value?.directorSkill;
  if (!dk) return "";
  return `${skillDisplay(dk)}电影美学`;
});

onMounted(load);
</script>

<style scoped>
.workspace {
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 14px 24px 0;
  box-sizing: border-box;
  background: #f5f3ed;
  overflow: hidden; /* 外层不滚动：顶栏 + 页签固定 */
}
.ws-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  padding: 10px 16px;
  background: #ffffff;
  border: 1px solid #e4e6eb;
  border-radius: 10px;
  flex-shrink: 0;
  flex-wrap: wrap;
  gap: 8px;
}
.ws-brand { display: flex; align-items: center; gap: 8px; min-width: 0; }
.ws-name {
  color: #2b2f36;
  font-size: 17px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 顶栏比例/手册标签：暖米色背景（仿参考图，替换深色底） */
.ws-brand :deep(.el-tag) {
  background: #f0f0e0;
  border-color: #e4ddc4;
  color: #7a6c4f;
  border-radius: 6px;
}
.ws-brand :deep(.el-tag--warning) {
  background: #f0e0d0;
  border-color: #e0cdb2;
  color: #9a6f35;
}
.ws-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.ws-tabs :deep(.el-tabs__header) {
  margin-bottom: 10px;
  flex-shrink: 0;
}
.ws-tabs :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
  overflow-y: auto; /* 兜底：内容超长只滚动内容区，页签固定 */
  display: flex;
  flex-direction: column;
}
/* 页签面板用 flex 撑满。注意：不能写成 `:deep(.el-tabs__content) :deep(.el-tab-pane)` 双 :deep 链——
   第二个 :deep() 不会被编译、原样留在选择器里，浏览器会丢弃整条规则 */
.ws-tabs :deep(.el-tab-pane) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.ws-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background: #eef0f4;
}
.ws-tabs :deep(.el-tabs__item) {
  font-size: 14px;
  color: #6b7380;
  height: 42px;
  line-height: 42px;
  padding: 0 20px;
  transition: color 0.15s;
}
.ws-tabs :deep(.el-tabs__item:hover) { color: #2b2f36; }
.ws-tabs :deep(.el-tabs__item.is-active) {
  color: #c98a2d;
  font-weight: 600;
}
.ws-tabs :deep(.el-tabs__active-bar) {
  background: #c98a2d;
  height: 2px;
}
</style>
