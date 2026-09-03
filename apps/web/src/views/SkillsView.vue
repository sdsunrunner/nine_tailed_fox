<template>
  <div class="page skills">
    <div class="page-head skills-head">
      <div>
        <h2 class="page-title">技能 · 在线编辑</h2>
        <div class="page-sub">核心提示词外化为 Markdown 技能，保存即生效</div>
      </div>
      <!-- 视觉手册/导演手册分类：列表顶部新增手册入口 -->
      <el-button
        v-if="newMeta"
        type="primary"
        plain
        size="small"
        @click="startNewSkill"
      >
        {{ newMeta.button }}
      </el-button>
    </div>

    <div class="skills-body">
      <!-- 左侧技能列表（全部分类显示；总控为根级技能，中文名） -->
      <el-menu class="skills-list" :default-active="currentName" @select="onSelect">
        <el-menu-item v-if="newSkillActive" :index="NEW_SKILL_KEY" class="new-skill-item">
          <div>
            <div class="skill-name">＋ {{ newMeta?.draft }}</div>
            <div class="skill-desc">{{ newMeta?.draftDesc }}</div>
          </div>
        </el-menu-item>
        <el-menu-item v-for="s in list" :key="s.name" :index="s.name">
          <div>
            <div class="skill-name">{{ s.displayName ?? s.name }}</div>
            <div class="skill-desc" v-if="s.description">{{ s.description }}</div>
          </div>
        </el-menu-item>
      </el-menu>

      <!-- 右侧编辑器 -->
      <div class="skills-editor">
        <div class="editor-head" v-if="currentName">
          <span v-if="currentName === NEW_SKILL_KEY" class="editor-title">{{ newMeta?.draft }}</span>
          <span v-else class="editor-title">{{ currentName }}.md</span>
          <span class="editor-hint">{{ isRoot ? "总控技能为系统内置，只读不可编辑" : "保存即生效（AI 服务实时读取，无需重启）" }}</span>
        </div>
        <el-input
          v-model="content"
          type="textarea"
          class="editor-textarea"
          :disabled="isRoot"
          placeholder="选择技能进行编辑…"
        />
        <!-- 总控：只读，不提供保存/删除 -->
        <div class="editor-foot" v-if="currentName && !isRoot">
          <el-button type="primary" :loading="saving" @click="onSave">
            {{ currentName === NEW_SKILL_KEY ? newMeta?.saveLabel : "保存技能" }}
          </el-button>
          <el-button v-if="currentName === NEW_SKILL_KEY" @click="cancelNewSkill">取消草稿</el-button>
          <el-button v-else type="danger" plain :loading="deleting" @click="onDelete">删除</el-button>
        </div>
      </div>
    </div>

    <!-- 保存新手册：填写文件名称（视觉手册草稿流程） -->
    <el-dialog v-model="nameDialogVisible" :title="newMeta?.saveTitle ?? '保存' " width="420px" append-to-body>
      <el-form label-width="90px" label-position="left">
        <el-form-item label="文件名称">
          <el-input v-model="newHandbookName" placeholder="英文小写+下划线，如 90s_wuxia_film / Director_XXX" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="nameDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="confirmSaveNew">创建</el-button>
      </template>
    </el-dialog>

    <!-- 新增导演手册：只输入导演名称，AI 联网检索自动生成完整手册 -->
    <el-dialog v-model="genDialogVisible" title="＋ 新增导演手册" width="460px" append-to-body>
      <el-form label-width="90px" label-position="left" @submit.prevent>
        <el-form-item label="导演名称">
          <el-input
            v-model="genDirectorName"
            placeholder="如：李安 / 王家卫 / 是枝裕和"
            :disabled="genLoading"
            @keyup.enter="onGenDirector"
          />
        </el-form-item>
        <el-form-item v-if="genLoading" label-width="0">
          <div class="gen-hint">🔍 正在联网检索该导演公开资料并生成完整手册（约 1-3 分钟）…</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="genLoading" @click="genDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="genLoading" :disabled="!genDirectorName.trim()" @click="onGenDirector">
          {{ genLoading ? "生成中…" : "新建" }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { http, generateDirectorHandbook } from "../api/client";

const route = useRoute();
const category = ref<string>((route.query.category as string) || "art");
// 总控（root）：系统内置技能，只读不可编辑/删除
const isRoot = computed(() => category.value === "root");
const list = ref<{ name: string; description: string }[]>([]);
const currentName = ref("");
const content = ref("");
const saving = ref(false);
const deleting = ref(false);

// —— 新建手册（草稿项）：视觉手册分类显示「新增视觉手册」入口，内容载入对应编写模板技能 ——
const NEW_SKILL_KEY = "__new_handbook__";
const newSkillActive = ref(false);
const nameDialogVisible = ref(false);
const newHandbookName = ref("");

// —— 新增导演手册（AI 自动生成）：只输入导演名称，联网检索生成完整手册 ——
const genDialogVisible = ref(false);
const genDirectorName = ref("");
const genLoading = ref(false);

/** 分类 → 新建手册文案与模板技能映射 */
const NEW_HANDBOOK_META: Record<string, { button: string; draft: string; draftDesc: string; saveTitle: string; saveLabel: string; skill: string; category: string }> = {
  art: {
    button: "＋ 新增视觉手册",
    draft: "新建视觉手册（草稿）",
    draftDesc: "按规则填写，保存后创建新视觉手册",
    saveTitle: "保存为新视觉手册",
    saveLabel: "保存为视觉手册",
    skill: "new_visual_handbook",
    category: "art",
  },
  story: {
    button: "＋ 新增导演手册",
    draft: "新建导演手册（草稿）",
    draftDesc: "AI 联网检索自动生成完整导演手册",
    saveTitle: "保存为新导演手册",
    saveLabel: "保存为导演手册",
    skill: "new_director_handbook",
    category: "story",
  },
};
const newMeta = computed(() => NEW_HANDBOOK_META[category.value] ?? null);

watch(
  () => route.query.category,
  (c) => {
    if (c) {
      category.value = c as string;
      loadList();
    }
  },
);

async function loadList() {
  const res = await http.get("/skills", { params: { category: category.value } });
  list.value = res.data.data;
  if (list.value.length > 0) {
    await onSelect(list.value[0].name);
  } else {
    currentName.value = "";
    content.value = "";
  }
}

async function onSelect(name: string) {
  currentName.value = name;
  if (name === NEW_SKILL_KEY) {
    // 草稿项：载入对应分类的「新建XX手册」技能（编写规则+标准模板）
    newSkillActive.value = true;
    try {
      const res = await http.get("/skills/content", { params: { category: "root", name: newMeta.value?.skill ?? "" } });
      content.value = res.data.data.content;
    } catch {
      content.value = "";
    }
    return;
  }
  newSkillActive.value = false;
  const res = await http.get("/skills/content", { params: { category: category.value, name } });
  content.value = res.data.data.content;
}

function onReload() {
  onSelect(currentName.value);
}

/** 取消新建草稿：移除草稿项，回到第一个真实技能 */
function cancelNewSkill() {
  newSkillActive.value = false;
  if (list.value.length > 0) {
    void onSelect(list.value[0].name);
  } else {
    currentName.value = "";
    content.value = "";
  }
}

/** 删除当前技能（弹窗确认） */
async function onDelete() {
  const name = currentName.value;
  if (!name) return;
  try {
    await ElMessageBox.confirm(`确定删除技能「${name}」？此操作不可恢复。`, "删除确认", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消",
      confirmButtonClass: "el-button--danger",
    });
  } catch {
    return; // 用户取消
  }
  deleting.value = true;
  try {
    await http.delete("/skills", { params: { category: category.value, name } });
    ElMessage.success("技能已删除");
    await loadList();
  } catch (e: any) {
    ElMessage.error(`删除失败：${e?.response?.data?.message ?? e?.message}`);
  } finally {
    deleting.value = false;
  }
}

/** 点击「新增XX手册」：导演手册 → 弹窗只输导演名自动生成；视觉手册 → 草稿项载入模板 */
function startNewSkill() {
  if (category.value === "story") {
    genDialogVisible.value = true;
    genDirectorName.value = "";
    return;
  }
  newSkillActive.value = true;
  currentName.value = NEW_SKILL_KEY;
  void onSelect(NEW_SKILL_KEY);
}

/** 从生成的 markdown 提取 frontmatter 的 name（文件名），非法回退空串 */
function extractFrontmatterName(md: string): string {
  const m = md.match(/^---\s*\r?\nname:\s*([a-zA-Z0-9_-]+)/);
  return m ? m[1] : "";
}

/** 规范为项目统一文件名：Director_ 前缀 + 驼峰（如 director_koreeda_hirokazu → Director_KoreedaHirokazu） */
function normalizeDirectorFile(raw: string): string {
  let base = raw.replace(/^[Dd]irector_?/, "").replace(/^director_handbook_/, "");
  const parts = base.split(/[_-]+/).filter(Boolean);
  if (!parts.length) return "";
  return "Director_" + parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
}

/** 同步 frontmatter 的 name 为最终文件名（若存在 name 行） */
function syncFrontmatterName(md: string, file: string): string {
  return md.replace(/^(---\s*\r?\nname:\s*)[a-zA-Z0-9_-]+/, `$1${file}`);
}

/** 新建导演手册：AI 联网检索生成 → 提取文件名 → 保存为 story 技能 */
async function onGenDirector() {
  const dn = genDirectorName.value.trim();
  if (!dn) {
    ElMessage.warning("请先输入导演名称");
    return;
  }
  genLoading.value = true;
  try {
    const { content: md } = await generateDirectorHandbook(dn);
    // 文件名：优先取 frontmatter name（LLM 生成）并规范为 Director_ 驼峰，非法则回退带时间戳
    let file = normalizeDirectorFile(extractFrontmatterName(md));
    if (!/^[a-zA-Z0-9_-]+$/.test(file)) {
      file = `director_handbook_${Date.now()}`;
    }
    // 重名保护（Windows 文件系统大小写不敏感，必须忽略大小写比较）：
    // 命中已有手册（如 Director_XXX 与 director_xxx 视为同名）→ 追加时间戳后缀避免覆盖
    if (list.value.some((s) => s.name.toLowerCase() === file.toLowerCase())) {
      file = `${file}_${Date.now() % 100000}`;
    }
    const finalContent = syncFrontmatterName(md, file);
    await http.put("/skills/content", { category: "story", name: file, content: finalContent });
    ElMessage.success(`导演手册「${dn}」已生成并保存为 ${file}`);
    genDialogVisible.value = false;
    genDirectorName.value = "";
    await loadList();
    await onSelect(file);
  } catch (e: any) {
    ElMessage.error(`生成失败：${e?.response?.data?.message ?? e?.message}`);
  } finally {
    genLoading.value = false;
  }
}

async function onSave() {
  // 草稿项：先填文件名再保存为新的视觉手册
  if (currentName.value === NEW_SKILL_KEY) {
    nameDialogVisible.value = true;
    return;
  }
  saving.value = true;
  try {
    await http.put("/skills/content", { category: category.value, name: currentName.value, content: content.value });
    ElMessage.success("技能已保存并生效");
    await loadList();
  } catch (e: any) {
    ElMessage.error(`保存失败：${e?.response?.data?.message ?? e?.message}`);
  } finally {
    saving.value = false;
  }
}

/** 草稿保存：以填写的文件名称在当前分类（视觉/导演手册）下创建 */
async function confirmSaveNew() {
  const name = newHandbookName.value.trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    ElMessage.warning("文件名称需为英文小写+下划线（字母数字_-）");
    return;
  }
  const meta = newMeta.value;
  if (!meta) return;
  saving.value = true;
  try {
    await http.put("/skills/content", { category: meta.category, name, content: content.value });
    ElMessage.success(meta.category === "story" ? "新导演手册已创建" : "新视觉手册已创建");
    nameDialogVisible.value = false;
    newSkillActive.value = false;
    newHandbookName.value = "";
    await loadList();
    await onSelect(name);
  } catch (e: any) {
    ElMessage.error(`创建失败：${e?.response?.data?.message ?? e?.message}`);
  } finally {
    saving.value = false;
  }
}

onMounted(loadList);
</script>

<style scoped>
.skills {
  box-sizing: border-box;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.skills-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 8px;
}
.page-title { color: #2b2f36; font-size: 18px; margin: 0; }
.skills-body {
  flex: 1;
  display: flex;
  gap: 16px;
  min-height: 0;
}
.skills-list {
  width: 260px;
  background: #ffffff;
  border: 1px solid #e4e6eb;
  border-radius: 8px;
  overflow-y: auto;
  min-width: 0;
  --el-menu-bg-color: #ffffff;
  --el-menu-text-color: #4a5058;
  --el-menu-active-color: #c98a2d;
  --el-menu-hover-bg-color: #faf3e4;
  --el-menu-item-height: 56px;
}
/* 约束条目宽度：flex 内层容器按栏宽收缩，长描述才可截断（否则溢出交叠错乱） */
.skills-list :deep(.el-menu-item) { min-width: 0; }
.skills-list :deep(.el-menu-item > div) { flex: 1; min-width: 0; }
/* 新建视觉手册草稿项：金色浅底提示 */
.new-skill-item { background: #faf3e4 !important; }
.skill-name { font-size: 13px; line-height: 20px; color: #2b2f36; }
.skill-desc {
  font-size: 11px;
  line-height: 15px; /* 必须显式行高：el-menu-item 行高=条目高度(56px)，继承会让描述向下溢出压到下一项 */
  color: #8a919c;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}
/* 选中状态：金色浅底 + 金色文字（列表项清晰可辨） */
.skills-list :deep(.el-menu-item.is-active) {
  background: #faf3e4;
  color: #c98a2d;
}
.skills-list :deep(.el-menu-item.is-active) .skill-name { color: #c98a2d; font-weight: 600; }
.skills-list :deep(.el-menu-item.is-active) .skill-desc { color: #a08c5c; }
.skills-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
/* 编辑器头部 */
.editor-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 8px;
}
.editor-title { color: #2b2f36; font-weight: 600; font-size: 14px; }
.editor-hint { color: #8a919c; font-size: 12px; }
/* 编辑器主体：撑满剩余高度（按钮贴最底部） */
.editor-textarea {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.editor-textarea :deep(.el-textarea) { flex: 1; min-height: 0; }
.editor-textarea :deep(.el-textarea__inner) {
  height: 100% !important;
  resize: none;
  font-family: "JetBrains Mono", Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  background: #ffffff;
}
.editor-foot { flex-shrink: 0; margin-top: 10px; }
/* AI 生成提示 */
.gen-hint { color: #8a6d3b; font-size: 12px; line-height: 1.5; }
</style>
