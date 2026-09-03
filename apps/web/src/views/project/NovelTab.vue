<template>
  <div class="tab-pane">
    <div class="pane-head">
      <h3>源小说（原著）</h3>
      <div>
        <el-button
          size="small"
          type="primary"
          plain
          :disabled="!content.trim()"
          @click="startVisible = true"
        >
          🤖 AI 改编为剧本
        </el-button>
        <el-button size="small" @click="onSave">保存小说</el-button>
      </div>
    </div>

    <!-- 导演手册 / 视觉手册 / 影片比例 / 全剧时长（项目级，AI 改编与拆镜时注入） -->
    <div class="manual-bar">
      <span class="manual-label">导演手册</span>
      <el-select v-model="directorSkill" size="small" filterable style="width: 200px" placeholder="选择叙事类型">
        <el-option v-for="s in storySkills" :key="s.name" :label="s.displayName ?? s.name" :value="s.name" />
      </el-select>
      <span class="manual-label">视觉手册</span>
      <el-select v-model="visualSkill" size="small" filterable style="width: 200px" :placeholder="`默认·${directorAesthetic}`">
        <el-option v-if="directorAesthetic" :label="`${directorAesthetic}（导演默认）`" value="" />
        <el-option v-for="s in artSkills" :key="s.name" :label="s.displayName ?? s.name" :value="s.name" />
      </el-select>
      <span class="manual-label">影片比例</span>
      <el-select v-model="videoRatio" size="small" style="width: 120px">
        <el-option label="9:16 竖屏" value="9:16" />
        <el-option label="16:9 横屏" value="16:9" />
        <el-option label="1:1 方形" value="1:1" />
      </el-select>
      <span class="manual-label">时代设定</span>
      <el-input v-model="era" size="small" style="width: 180px" placeholder="如：春秋战国 / 现代都市 / 未来" />
      <span class="manual-label">短片时长</span>
      <el-input-number v-model="totalDurationMin" :min="5" :max="300" size="small" style="width: 150px" />
      <span class="manual-label">分钟（建议 10-30）</span>
    </div>
    <div class="novel-fields">
      <el-input v-model="title" size="small" style="max-width: 400px" placeholder="小说标题" />
    </div>
    <div class="editor-wrap">
      <el-input
        v-model="content"
        type="textarea"
        :rows="30"
        placeholder="粘贴原著小说内容（后续 AI 改编为剧本）…"
        class="big-editor"
      />
    </div>

    <!-- 开始制作（块样式：提示在上，按钮居中，同卡片背景，对齐剧本页拆解分镜） -->
    <div class="start-block">
      <div class="start-hint">将按确认的 短片时长 / 分屏比例 / 时代设定 / 视觉风格 / 导演风格，由 AI 改编为 10-30 分钟精品短片剧本（对标《爱·死亡·机器人》单篇；按 5 分钟/段技术切割生产）</div>
      <div class="start-action">
        <el-button
          type="primary"
          size="large"
          :disabled="!content.trim()"
          @click="startVisible = true"
        >
          🎬 开始制作
        </el-button>
      </div>
    </div>

    <!-- 开始制作确认框：信息来自页面手册栏，只读确认 -->
    <el-dialog v-model="startVisible" title="开始制作 · 确认创作参数" width="660px" append-to-body>
      <el-form label-width="90px" label-position="left">
        <el-form-item label="导演风格">
          <el-select v-model="directorSkill" filterable disabled style="width: 100%">
            <el-option v-for="s in storySkills" :key="s.name" :label="s.displayName ?? s.name" :value="s.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="视觉风格">
          <el-select v-model="visualSkill" filterable disabled style="width: 100%">
            <el-option v-if="directorAesthetic" :label="`${directorAesthetic}（导演默认）`" value="" />
            <el-option v-for="s in artSkills" :key="s.name" :label="s.displayName ?? s.name" :value="s.name" />
          </el-select>
          <div v-if="!visualSkill && directorAesthetic" class="start-hint">未选视觉风格 → 默认使用导演电影美学「{{ directorAesthetic }}」控制静态画面（资产/分镜首帧）</div>
        </el-form-item>
        <el-form-item label="分屏比例">
          <el-select v-model="videoRatio" disabled style="width: 100%">
            <el-option label="9:16（竖屏短剧）" value="9:16" />
            <el-option label="16:9（横屏）" value="16:9" />
            <el-option label="1:1（方形）" value="1:1" />
          </el-select>
        </el-form-item>
        <el-form-item label="时代设定">
          <el-input v-model="era" disabled style="width: 100%" placeholder="如：春秋战国 / 现代都市 / 未来" />
          <div class="start-hint">用于分镜首帧时代背景约束，禁止出现现代建筑/服饰等越时元素</div>
        </el-form-item>
        <el-form-item label="短片时长">
          <el-input-number v-model="totalDurationMin" :min="5" :max="300" disabled style="width: 100%" />
          <div class="start-hint">精品短片建议 10-30 分钟；AI 按 5 分钟/段技术切割（MiniMax H3 单次时长上限，非编剧结构），段尾落在场景/镜头自然边界，不设每段钩子</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="startVisible = false">取消</el-button>
        <el-button type="primary" :loading="adapting" @click="onStartMake">确认并开始制作</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import {
  http,
  getNovel,
  saveNovel,
  novelToScript,
  listEpisodes,
  createEpisode,
  updateEpisode,
  updateProject,
} from "../../api/client";

const props = defineProps<{ projectId: number }>();
// 通知父组件（顶部信息条）项目参数已变更，需刷新
const emit = defineEmits<{ (e: "project-updated"): void }>();
const title = ref("");
const content = ref("");
const adapting = ref(false);
// 项目手册（视觉/导演）
const visualSkill = ref("");
const directorSkill = ref("");
const videoRatio = ref("9:16");
const era = ref("");
// 全剧时长（分钟）：页面手册栏设置，弹框只读确认；项目级持久化；AI 按 5 分钟/段技术切割（场以 ## 场 N 为节点）
const totalDurationMin = ref(20);
const storySkills = ref<any[]>([]);
// 视觉手册（art 分类）技能列表
const artSkills = ref<any[]>([]);
// 手册栏变更 → 防抖自动保存（AI 改编/拆镜时注入；开始制作时也会再次保存确认值）
let manualSaveTimer: number | null = null;
watch([visualSkill, directorSkill, videoRatio, era, totalDurationMin], () => {
  if (manualSaveTimer != null) clearTimeout(manualSaveTimer);
  manualSaveTimer = window.setTimeout(async () => {
    try {
      await updateProject(props.projectId, {
        visualSkill: visualSkill.value,
        directorSkill: directorSkill.value,
        videoRatio: videoRatio.value,
        era: era.value,
        totalDurationMin: totalDurationMin.value,
      });
    } catch {
      /* 自动保存失败静默（开始制作时会再保存） */
    }
  }, 600);
});
// 当前导演的「电影美学」名称（视觉手册下拉默认显示；未选视觉手册时以此控制静态画风）
const directorAesthetic = computed(() => {
  const d = storySkills.value.find((s) => s.name === directorSkill.value);
  return d?.aesthetic ?? (d?.displayName ? `${d.displayName}电影美学` : "");
});
// 开始制作确认框
const startVisible = ref(false);

async function load() {
  const n = await getNovel(props.projectId);
  title.value = n.title;
  content.value = n.content;
  // 手册技能列表 + 项目当前手册
  const [art, story, projects] = await Promise.all([
    http.get("/skills", { params: { category: "art" } }),
    http.get("/skills", { params: { category: "story" } }),
    http.get("/projects"),
  ]);
  artSkills.value = art.data.data;
  storySkills.value = story.data.data;
  const p = projects.data.data.find((x: any) => x.id === props.projectId);
  if (p) {
    visualSkill.value = p.visualSkill ?? "";
    directorSkill.value = p.directorSkill ?? "";
    videoRatio.value = p.videoRatio ?? "9:16";
    era.value = p.era ?? "";
    totalDurationMin.value = p.totalDurationMin ?? 20;
  }
  // 实测结论（2026-08-31）：小说→剧本环节侯孝贤导演手册效果最佳；项目未指定导演时默认选中
  if (!directorSkill.value && storySkills.value.some((s: any) => s.name === "Director_HouHsiaoHsien")) {
    directorSkill.value = "Director_HouHsiaoHsien";
  }
}

/** 确认并开始制作：保存比例/手册 + AI 改编为多集剧本并批量保存 */
async function onStartMake() {
  if (!content.value.trim()) {
    ElMessage.warning("请先粘贴小说内容");
    return;
  }
  adapting.value = true;
  try {
    // 0. 先持久化源小说（否则刷新丢失；标题留空给默认值）
    await saveNovel(props.projectId, {
      title: title.value.trim() || "未命名小说",
      content: content.value,
    });
    // 1. 保存确认的创作参数（比例 + 手册 + 全剧时长，来自页面手册栏）
    await updateProject(props.projectId, {
      videoRatio: videoRatio.value,
      visualSkill: visualSkill.value,
      directorSkill: directorSkill.value,
      era: era.value,
      totalDurationMin: totalDurationMin.value,
    });
    // 2. AI 改编为整片剧本（以场景切换为节点，输出若干段，段为技术切割）
    const { episodes } = await novelToScript(content.value, props.projectId, 0, totalDurationMin.value);
    if (!episodes?.length) throw new Error("AI 未返回任何剧本");
    // 3. 整片剧本 = 各段拼接（段只是 MiniMax H3 技术切割，场以 ## 场 N 为节点）
    const fullScript = episodes.map((e: any) => e.script).join("\n");
    await updateProject(props.projectId, { scriptContent: fullScript });
    // 4. 解析场清单（## 场 N）→ 同步场记录（Episode 语义=场）
    const sceneRe = /^##\s*场\s*(\d+)([^\n]*)/gm;
    const sceneList: Array<{ index: number; name: string }> = [];
    let sm: RegExpExecArray | null;
    while ((sm = sceneRe.exec(fullScript)) !== null) {
      const idx = parseInt(sm[1], 10);
      const t = sm[2].trim();
      sceneList.push({ index: idx, name: t ? `场${idx}·${t}` : `场 ${idx}` });
    }
    if (sceneList.length) {
      const list = await listEpisodes(props.projectId);
      for (const sc of sceneList) {
        const existing = list.find((e: any) => e.index === sc.index);
        if (existing) {
          await updateEpisode(props.projectId, existing.id, { name: sc.name });
        } else {
          await createEpisode(props.projectId, sc.name, { index: sc.index });
        }
      }
    }
    startVisible.value = false;
    ElMessage.success(`AI 改编完成：共 ${sceneList.length} 场。可到「资产」页点击「解析剧本资产」解析出场人物/场景/道具`);
    // 通知父组件刷新顶部信息条（比例/视觉/导演/时长）
    emit("project-updated");
  } catch (e: any) {
    ElMessage.error(`开始制作失败：${e?.response?.data?.message ?? e?.message}`);
  } finally {
    adapting.value = false;
  }
}

async function onSave() {
  try {
    await saveNovel(props.projectId, {
      title: title.value.trim() || "未命名小说",
      content: content.value,
    });
    ElMessage.success("小说已保存");
  } catch (e: any) {
    ElMessage.error(`保存失败：${e?.response?.data?.message ?? e?.message}`);
  }
}

// 自动保存（防抖 1.2s）：粘贴小说后即使不点保存，刷新也不丢失
let saveTimer: ReturnType<typeof setTimeout> | null = null;
watch(
  [title, content],
  () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (!content.value.trim()) return;
      saveNovel(props.projectId, {
        title: title.value.trim() || "未命名小说",
        content: content.value,
      }).catch(() => {
        // 静默失败，手动保存按钮兜底
      });
    }, 1200);
  },
  { flush: "post" },
);

onMounted(load);
</script>

<style scoped>
.tab-pane {
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  height: 100%;
}
.pane-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.pane-head h3 { color: #2b2f36; margin: 0; font-size: 15px; }
.novel-fields { margin-bottom: 10px; }
.manual-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 10px 14px;
  background: #f8f9fb;
  border: 1px solid #e4e6eb;
  border-radius: 10px;
  flex-wrap: wrap;
}
.manual-label {
  color: #6b7380;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 10px;
  background: #ffffff;
  border: 1px solid #e4e6eb;
  border-radius: 12px;
}
.editor-wrap {
  flex: 1;
  display: flex;
  min-height: 380px;
}
.big-editor {
  flex: 1;
  display: flex;
}
.big-editor :deep(.el-textarea) {
  flex: 1;
  height: 100%;
}
.big-editor :deep(.el-textarea__inner) {
  font-family: "JetBrains Mono", Consolas, monospace;
  font-size: 13px;
  line-height: 1.7;
  background: #ffffff;
  height: 100% !important;
  min-height: 380px;
}
/* 开始制作块：与剧本页拆解分镜块一致（卡片背景，提示在上，按钮居中） */
.start-block {
  margin-top: 16px;
  background: #f8f9fb;
  border: 1px solid #e4e6eb;
  border-radius: 10px;
  padding: 12px 16px 14px;
}
.start-hint {
  color: #8a919c;
  font-size: 12px;
  text-align: center;
  margin-bottom: 10px;
}
.start-action {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
}
.start-hint { color: #8a919c; font-size: 12px; }
</style>
