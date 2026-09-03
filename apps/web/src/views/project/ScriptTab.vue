<template>
  <div class="script-page">
    <!-- ① 场次导航（文本链接，点击滚动定位到对应场；只显示「第 N 场 · 地点（时间）」） -->
    <div class="block scene-nav-block">
      <div class="block-head">
        <h3>场次（{{ scenes.length }}）</h3>
        <el-button size="small" @click="onSyncScenes">⟳ 同步场次</el-button>
      </div>
      <div v-if="scenes.length" class="scene-nav">
        <span
          v-for="sc in scenes"
          :key="sc.index"
          class="scene-link"
          :class="{ active: activeScene === sc.index }"
          @click="onSceneChange(sc.index)"
        >{{ sceneLabel(sc) }}</span>
      </div>
      <el-empty v-else description="暂无场次（剧本中需有 ## 场 N 标题）" :image-size="50" />
    </div>

    <!-- ② 整片剧本（一个项目一部完整剧本，以 ## 场 N 为节点） -->
    <div class="block editor-block">
      <div class="block-head">
        <h3>整片剧本 <span class="script-sub">（以场景切换为节点，共 {{ scenes.length }} 场）</span></h3>
      </div>
      <div class="script-body">
        <el-input
          v-if="editing"
          ref="editorRef"
          v-model="content"
          type="textarea"
          :rows="30"
          placeholder="输入整片剧本（## 场 N 分场；画面/动作/对白）…"
          class="big-editor"
        />
        <pre
          v-else
          ref="viewRef"
          class="script-view"
        >{{ content || "（暂无整片剧本，点击「✏️ 编辑」编写；或到「小说」页开始制作）" }}</pre>
      </div>
      <div class="script-foot">
        <el-button size="small" text type="primary" :disabled="!content" @click="copyScript">📋 复制</el-button>
        <el-button size="small" text type="warning" :disabled="!content || editing" @click="toggleAiEdit">✨ AI 修改</el-button>
        <el-button v-if="!editing" size="small" text @click="startEdit">✏️ 手动编辑</el-button>
        <template v-else>
          <el-button size="small" text type="success" :loading="saving" @click="onSave">💾 保存</el-button>
          <el-button size="small" text @click="cancelEdit">取消</el-button>
        </template>
      </div>
    </div>

    <!-- AI 修改剧本：点击后压缩剧本高度并把对话框带入视口，无需滚动页面 -->
    <div v-show="aiEditVisible" ref="aiBarRef" class="ai-edit-bar">
      <div class="ai-edit-head">
        <span class="ai-title">✨ AI 修改剧本</span>
        <span class="ai-sub">修改前请先保存当前改动</span>
      </div>
      <el-input
        v-model="aiInstruction"
        type="textarea"
        :rows="3"
        placeholder="输入修改要求，例如：把第三场的冲突改得更激烈；加入一个转折；把结局改为开放式…"
      />
      <div class="ai-edit-actions">
        <el-button size="small" @click="toggleAiEdit">收起</el-button>
        <el-button size="small" type="primary" :loading="aiLoading" :disabled="!aiInstruction.trim()" @click="onAiEdit">
          修改
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { getProjects, updateProject, listEpisodes, createEpisode, updateEpisode, aiScriptEdit } from "../../api/client";

const props = defineProps<{ projectId: number }>();
const content = ref("");
const saving = ref(false);
const editing = ref(false);
const viewRef = ref<HTMLPreElement | null>(null);
const editorRef = ref<{ textarea: HTMLTextAreaElement } | null>(null);
// AI 修改
const aiEditVisible = ref(false);
const aiInstruction = ref("");
const aiLoading = ref(false);
const aiBarRef = ref<HTMLElement | null>(null);

// 场次（从整片剧本解析 ## 场 N）
const scenes = ref<Array<{ index: number; name: string; text: string }>>([]);
const activeScene = ref(0);

/** 场次链接文案：只显示「第 N 场 · 地点（时间）」 */
function sceneLabel(sc: { index: number; name: string }): string {
  const t = sc.name.replace(/^场\s*\d+[·\s]*/, "").trim();
  return `第 ${sc.index} 场${t ? " · " + t : ""}`;
}

/** 展示清理（紧凑模式）：段落间空行删除，场标题之间保留一个空行 */
function cleanForDisplay(script: string): string {
  const out: string[] = [];
  for (const ln of (script ?? "").split(/\r?\n/)) {
    const s = ln.trim();
    if (!s) continue;
    if (s.startsWith("## 场") && out.length) out.push("");
    out.push(ln);
  }
  while (out.length && !out[0].trim()) out.shift();
  while (out.length && !out[out.length - 1].trim()) out.pop();
  return out.join("\n");
}

/** 从整片剧本解析场次（## 场 N）及其文本片段 */
function parseScenes(script: string): Array<{ index: number; name: string; text: string }> {
  const list: Array<{ index: number; name: string; text: string }> = [];
  const lines = (script ?? "").split(/\r?\n/);
  let cur: { index: number; name: string; text: string[] } | null = null;
  for (const ln of lines) {
    const m = /^##\s*场\s*(\d+)([^\n]*)/.exec(ln.trim());
    if (m) {
      if (cur) list.push({ index: cur.index, name: cur.name, text: cur.text.join("\n") });
      const idx = parseInt(m[1], 10);
      const t = m[2].trim();
      cur = { index: idx, name: t ? `场${idx}·${t}` : `场 ${idx}`, text: [] };
      cur.text.push(ln);
    } else if (cur) {
      cur.text.push(ln);
    }
  }
  if (cur) list.push({ index: cur.index, name: cur.name, text: cur.text.join("\n") });
  return list;
}

/** 从剧本同步场记录（Episode 语义=场） */
async function syncSceneRecords() {
  const list = await listEpisodes(props.projectId);
  for (const sc of scenes.value) {
    const existing = list.find((e: any) => e.index === sc.index);
    if (existing) {
      if (existing.name !== sc.name) await updateEpisode(props.projectId, existing.id, { name: sc.name });
    } else {
      await createEpisode(props.projectId, sc.name, { index: sc.index });
    }
  }
}

/** 滚动定位到第 idx 场标题（按行号比例估算滚动位置） */
function scrollToScene(idx: number) {
  const lines = content.value.split("\n");
  const total = lines.length || 1;
  let target = 0;
  for (let i = 0; i < lines.length; i++) {
    if (new RegExp(`^##\\s*场\\s*${idx}(?!\\d)`).test(lines[i].trim())) {
      target = i;
      break;
    }
  }
  const el = editing.value ? (editorRef.value?.textarea ?? null) : viewRef.value;
  if (el) el.scrollTop = (target / total) * el.scrollHeight;
}

async function load() {
  // 整片剧本 = Project.scriptContent
  const projects = await getProjects();
  const p = projects.find((x: any) => x.id === props.projectId);
  content.value = cleanForDisplay(p?.scriptContent ?? "");
  scenes.value = parseScenes(content.value);
  if (scenes.value.length > 0) activeScene.value = scenes.value[0].index;
}

function onSceneChange(idx: number) {
  activeScene.value = idx;
  scrollToScene(idx);
}

async function onSyncScenes() {
  try {
    scenes.value = parseScenes(content.value);
    await syncSceneRecords();
    ElMessage.success(`已同步 ${scenes.value.length} 场次`);
  } catch (e: any) {
    ElMessage.error(`同步失败：${e?.response?.data?.message ?? e?.message}`);
  }
}

function startEdit() {
  editing.value = true;
  aiEditVisible.value = false;
  nextTick(() => scrollToScene(activeScene.value));
}
function cancelEdit() {
  editing.value = false;
}

/** 展开/收起 AI 修改：展开时压缩剧本高度并把对话框滚入视口（无需手动滚动页面） */
function toggleAiEdit() {
  if (editing.value) {
    ElMessage.warning("请先保存当前手动编辑的内容");
    return;
  }
  aiEditVisible.value = !aiEditVisible.value;
  if (aiEditVisible.value) {
    nextTick(() => aiBarRef.value?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }
}
async function copyScript() {
  if (!content.value) return;
  try {
    await navigator.clipboard.writeText(content.value);
    ElMessage.success("剧本已复制");
  } catch {
    ElMessage.error("复制失败");
  }
}

async function onSave() {
  try {
    // 保存整片剧本（content 始终为整片）
    await updateProject(props.projectId, { scriptContent: content.value });
    scenes.value = parseScenes(content.value);
    editing.value = false;
    ElMessage.success("剧本已保存");
    emit("script-updated");
  } catch (e: any) {
    ElMessage.error(`保存失败：${e?.response?.data?.message ?? e?.message}`);
  }
}

/** AI 修改剧本：调用 LLM 按用户要求改写，直接替换并保存，不弹确认框 */
async function onAiEdit() {
  const instruction = aiInstruction.value.trim();
  if (!instruction) return;
  if (editing.value) {
    ElMessage.warning("请先保存当前手动编辑的内容");
    return;
  }
  aiLoading.value = true;
  try {
    const newScript = await aiScriptEdit(content.value, instruction, props.projectId);
    content.value = newScript;
    await updateProject(props.projectId, { scriptContent: newScript });
    scenes.value = parseScenes(newScript);
    ElMessage.success("剧本已更新");
  } catch (e: any) {
    ElMessage.error(`AI 修改失败：${e?.response?.data?.message ?? e?.message}`);
  } finally {
    aiLoading.value = false;
    aiEditVisible.value = false;
    aiInstruction.value = "";
  }
}

const emit = defineEmits<{ (e: "script-updated"): void }>();

// 供父组件（切页/开始制作后）刷新数据
defineExpose({ reload: load });

onMounted(load);
</script>

<style scoped>
/* 页面占满 tab 容器高度：flex 纵向，剧本栏 flex:1 动态吸收剩余空间，
   AI 修改对话框显示时自动贴底（无底部空白），隐藏时剧本栏撑满 */
.script-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
}
.block {
  background: #fff;
  border: 1px solid #e4e6eb;
  border-radius: 10px;
  padding: 14px;
}
.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  flex-shrink: 0;
}
.block-head h3 { margin: 0; font-size: 15px; color: #2b2f36; }
.script-sub { font-size: 12px; color: #8a919c; font-weight: normal; margin-left: 8px; }
/* 场次导航：文本链接一行排布（自动换行）；不参与伸缩 */
.scene-nav-block { flex-shrink: 0; }
.scene-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 18px;
}
.scene-link {
  font-size: 13px;
  color: #6b7380;
  cursor: pointer;
  white-space: nowrap;
  padding: 2px 2px;
  border-bottom: 1px dashed transparent;
  transition: color 0.15s, border-color 0.15s;
}
.scene-link:hover { color: #c98a2d; }
.scene-link.active {
  color: #c98a2d;
  font-weight: 600;
  border-bottom-color: #c98a2d;
}
/* 剧本块：flex:1 吸收剩余高度，内部展示区 flex:1 滚动 */
.editor-block {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.script-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin-bottom: 8px;
}
.big-editor,
.big-editor :deep(.el-textarea) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.big-editor :deep(.el-textarea__inner) {
  font-family: inherit;
  line-height: 1.7;
  flex: 1;
  min-height: 0;
  resize: none;
}
.script-view {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.8;
  color: #3a3f47;
  background: #faf9f6;
  border: 1px solid #eeece6;
  border-radius: 6px;
  padding: 12px;
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.script-foot { display: flex; gap: 8px; flex-shrink: 0; }
/* AI 修改对话框：不参与伸缩，显示时自然贴底 */
.ai-edit-bar {
  flex-shrink: 0;
  background: #fff;
  border: 1px solid #e4e6eb;
  border-radius: 10px;
  padding: 12px;
}
.ai-edit-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 8px; }
.ai-title { font-size: 14px; font-weight: 600; color: #2b2f36; }
.ai-sub { font-size: 12px; color: #8a919c; }
.ai-edit-actions { margin-top: 8px; display: flex; gap: 8px; }
</style>
