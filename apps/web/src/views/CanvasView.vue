<template>
  <div class="asset-editor">
    <!-- 顶栏 -->
    <header class="topbar">
      <el-button size="small" @click="goBack">← 返回</el-button>
      <span class="brand-name">{{ projectName }} · 资产编辑</span>
      <div class="topbar-right">
        <el-select v-model="episodeId" size="small" style="width: 130px" @change="onEpisodeChange">
          <el-option v-for="e in episodes" :key="e.id" :label="e.name" :value="e.id" />
        </el-select>
        <el-tag v-if="asset" size="small" :type="typeTag(asset.type)">{{ typeLabel(asset.type) }}</el-tag>
      </div>
    </header>

    <!-- 主体：资产区（放大）+ 编辑 -->
    <div class="editor-body">
      <!-- 左：资产区（名称+类型作 title，删除在图上角，生成/上传在底部） -->
      <div class="preview-pane">
        <template v-if="asset">
          <div class="asset-title">
            {{ form.name || "未命名" }}
            <el-tag size="small" :type="typeTag(form.type)" class="title-type">{{ typeLabel(form.type) }}</el-tag>
            <el-tag v-if="asset?.voiceActor" size="small" type="warning" class="title-voice">
              🎙 {{ asset.voiceActor }}{{ asset.voiceDialect ? " · " + asset.voiceDialect : "" }}
            </el-tag>
          </div>
          <div class="preview-img-wrap">
            <img v-if="asset.filePath" :src="asset.filePath" class="preview-img" loading="lazy" />
            <div v-else class="preview-state">
              <el-tag size="small" :type="stateTag(asset.state)">{{ stateText(asset.state) }}</el-tag>
              <div v-if="asset.errorReason" class="error-reason">{{ asset.errorReason }}</div>
              <div v-else-if="asset.state === 'QUEUED'" class="state-hint">尚未生成内容，可「生成」或「上传」图片</div>
            </div>
            <!-- 上一个/下一个：显示在资产大图左右两侧中间 -->
            <button
              class="nav-arrow nav-prev"
              :disabled="switchDisabled"
              title="上一个资产"
              @click="switchAsset(-1)"
            >‹</button>
            <button
              class="nav-arrow nav-next"
              :disabled="switchDisabled"
              title="下一个资产"
              @click="switchAsset(1)"
            >›</button>
            <el-button
              class="del-btn"
              size="small"
              type="danger"
              plain
              circle
              title="删除该资产"
              @click="onDelete"
            >✕</el-button>
          </div>
          <div class="asset-actions">
            <el-button @click="onUpload">上传</el-button>
          </div>
        </template>
        <div v-else class="preview-state">
          <div class="empty-icon">🎨</div>
          <p>未选择资产</p>
          <p class="state-hint">请从「③ 资产」页点击资产卡进入编辑</p>
        </div>
      </div>

      <!-- 右：编辑（设计描述 + 提示词，自动保存） -->
      <aside class="edit-pane">
        <template v-if="asset">
          <div v-if="designDesc" class="prop-block">
            <div class="prop-label">设计描述</div>
            <div class="design-desc">{{ designDesc }}</div>
          </div>
          <div class="prop-block">
            <div class="prop-label">提示词（改动自动保存）</div>
            <el-input
              v-model="form.prompt"
              type="textarea"
              :rows="8"
              placeholder="填写画面描述，或点击「✨ AI 生成」"
            />
            <div class="prompt-bar">
              <!-- AI 生成：点击展开要求输入框 -->
              <el-button size="small" text type="warning" :loading="aiPromptLoading" @click="toggleAiPrompt">✨ AI 生成</el-button>
              <template v-if="aiPromptVisible">
                <el-input
                  v-model="aiPromptInstruction"
                  size="small"
                  placeholder="输入生成要求（可留空，按角色+视觉手册生成）"
                  style="width: 260px"
                  @keyup.enter="onAiGeneratePrompt"
                />
                <el-button size="small" type="primary" :loading="aiPromptLoading" @click="onAiGeneratePrompt">生成</el-button>
                <el-button size="small" text @click="toggleAiPrompt">收起</el-button>
              </template>
              <span class="prompt-bar-spacer"></span>
              <!-- 资产图生成按钮：移到提示词栏下部右侧 -->
              <el-button type="primary" :loading="asset?.state === 'RUNNING'" @click="onGenerate">
                {{ asset?.state === "SUCCEEDED" ? "🔄 重新生成" : "🎨 生成" }}
              </el-button>
            </div>
          </div>

          <!-- 场景/道具类型：参考图上传（有参考图 → 图生图；无 → 文生图） -->
          <div v-if="form.type === 'scene' || form.type === 'prop'" class="prop-block ref-block">
            <div class="prop-label">
              参考图（图生图参考）
              <el-tag size="small" type="info" class="ref-hint-tag">有参考图走图生图 · 无则文生图</el-tag>
            </div>
            <div class="ref-upload-row">
              <el-button size="small" :loading="refUploading" @click="onPickRefImage">📎 上传参考图</el-button>
              <el-button
                v-if="asset?.refImagePath"
                size="small"
                type="danger"
                plain
                :disabled="refUploading"
                @click="onClearRefImage"
              >清除</el-button>
            </div>
            <div v-if="asset?.refImagePath" class="ref-preview">
              <img :src="asset.refImagePath" class="ref-preview-img" loading="lazy" />
              <div class="ref-preview-caption">参考图（生成时将以此为基础图生图）</div>
            </div>
            <div v-else class="ref-empty">未上传参考图 → 生成将走文生图流程</div>
          </div>

          <!-- 角色类型资产：配音演员（按角色设定筛选最多 3 个待选）+ 方言 -->
          <div v-if="form.type === 'character'" class="prop-block voice-block">
            <div class="prop-label">配音演员（按角色设定自动筛选 · 点击卡片试听）</div>
            <div v-if="voiceCandidates.length" class="voice-candidates">
              <div
                v-for="c in voiceCandidates"
                :key="c.name"
                class="voice-card"
                :class="{ active: form.voiceActor === c.name, playing: playingVoice === c.name }"
                @click="onPickVoiceActor(c.name)"
              >
                <div class="voice-card-head">
                  <span class="voice-card-name">{{ c.name }}</span>
                  <button
                    class="voice-play-btn"
                    :class="{ playing: playingVoice === c.name }"
                    :title="playingVoice === c.name ? '停止播放' : '播放音色'"
                    @click.stop="onToggleVoicePlay(c)"
                  >
                    <svg v-if="playingVoice !== c.name" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M8 5.14v13.72L19 12z" />
                    </svg>
                    <svg v-else viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
                    </svg>
                  </button>
                </div>
                <div class="voice-card-desc">{{ c.desc }}</div>
              </div>
            </div>
            <div v-else class="voice-empty">当前角色设定下暂无匹配演员</div>
            <!-- 方言（卡片选择） -->
            <div class="voice-dialect-label">方言</div>
            <div class="voice-dialects">
              <div
                v-for="d in VOICE_DIALECTS"
                :key="d.value"
                class="dialect-card"
                :class="{ on: form.voiceDialect === d.value }"
                @click="onDialectPick(d.value)"
              >{{ d.label }}</div>
            </div>
            <!-- 台词输入（默认 = 参考音频转写文本） -->
            <div class="voice-line-label">台词</div>
            <el-input
              v-model="previewText"
              type="textarea"
              :rows="3"
              placeholder="输入试听台词（默认取参考音频的转写文本）"
              class="preview-text-input"
            />
            <!-- 试听：以 配音演员音色 + 方言 合成声音 -->
            <div class="preview-row">
              <el-button
                type="warning"
                :loading="previewLoading"
                :disabled="previewDisabled"
                :title="previewDisabledHint"
                @click="onPreviewVoice"
              >🎧 试听合成{{ previewDisabledHint ? "（" + previewDisabledHint + "）" : "" }}</el-button>
              <el-button
                type="success"
                :disabled="!form.voiceActor"
                @click="onConfirmVoice"
              >✅ 确定</el-button>
              <audio v-if="previewAudioUrl" :src="previewAudioUrl" controls class="preview-audio" />
            </div>
          </div>
        </template>
        <div v-else class="props-empty">
          请从「③ 资产」页点击资产卡进入编辑
        </div>
      </aside>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/png,image/jpeg,image/webp,image/gif"
      style="display: none"
      @change="onFilePicked"
    />
    <input
      ref="refInput"
      type="file"
      accept="image/png,image/jpeg,image/webp,image/gif"
      style="display: none"
      @change="onRefFilePicked"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  http,
  getProjects,
  listEpisodes,
  listAssets,
  createAsset,
  generateAsset,
  getAsset,
  updateAsset,
  uploadAsset,
  clearAsset,
  uploadAssetRefImage,
  clearAssetRefImage,
  getEpisodeAssets,
  aiAssetPrompt,
  type Asset,
} from "../api/client";
import { applyTemplate, appendStyleRoot, PROMPT_TEMPLATES } from "../utils/promptTemplates";
import { matchVoiceActors, VOICE_ACTORS, VOICE_DIALECTS, type VoiceActor } from "../utils/voiceActors";

const route = useRoute();
const router = useRouter();
const pid = Number(route.params.projectId);
const eid = Number(route.params.episodeId);

const projectName = ref("");
const episodes = ref<{ id: number; index: number; name: string }[]>([]);
const episodeId = ref(eid);
const asset = ref<Asset | null>(null);
const form = reactive({ name: "", type: "character" as Asset["type"], prompt: "", voiceActor: "", voiceDialect: "" });
const designDesc = ref(""); // 设计描述（EpisodeAsset 分析结果，角色=要素|设定表 / 场景道具=设定要点）
const loading = ref(false);
const pollTimer = ref<number | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const refInput = ref<HTMLInputElement | null>(null);
// 配音演员候选（角色类型）：按 角色名+设计描述 自动推断性别/年龄段后筛选
const voiceCandidates = ref<Array<VoiceActor & { hitTags: string[] }>>([]);

const currentTplLabel = computed(() => PROMPT_TEMPLATES[form.type]?.label ?? "");

/** 从角色设定（角色名 + 设计描述）推断性别：明确女性特征词 → 女；明确男性特征词 → 男；否则 all */
function inferGender(name: string, desc: string): "男" | "女" | "all" {
  const text = `${name ?? ""} ${desc ?? ""}`;
  const femaleWords = ["女", "娲", "母", "嫦娥", "姐", "婆", "姑", "妇", "太太", "娘", "女儿", "她"];
  const maleWords = ["男", "公", "子", "王", "大王", "先生", "父", "伯", "叔", "爷", "郎", "侠", "他"];
  let f = 0;
  let m = 0;
  for (const w of femaleWords) if (text.includes(w)) f++;
  for (const w of maleWords) if (text.includes(w)) m++;
  if (f > m) return "女";
  if (m > f) return "男";
  return "all";
}

/** 从角色设定推断年龄段：青/中/老；无明显信号 → all */
function inferAge(name: string, desc: string): "青" | "中" | "老" | "all" {
  const text = `${name ?? ""} ${desc ?? ""}`;
  if (/少年|青年|少女|年轻|青涩|童子/.test(text)) return "青";
  if (/老年|年长|老迈|苍老|老者|白须|枯涩/.test(text)) return "老";
  if (/中年|中老年|妇人|壮年/.test(text)) return "中";
  return "all";
}

/** 按当前角色设定自动筛选配音候选（最多 3 个），并记录命中标签 */
function refreshVoiceCandidates() {
  if (form.type !== "character") {
    voiceCandidates.value = [];
    return;
  }
  const gender = inferGender(form.name, designDesc.value);
  const age = inferAge(form.name, designDesc.value);
  const top = matchVoiceActors(form.name, designDesc.value, 3, gender, age);
  // 重新计算命中标签用于展示
  const nameText = form.name.toLowerCase();
  const descText = designDesc.value.toLowerCase();
  voiceCandidates.value = top.map((a) => ({
    ...a,
    hitTags: a.tags.filter((t) => nameText.includes(t.toLowerCase()) || descText.includes(t.toLowerCase())),
  }));
}

/** 按 类型+名称 匹配并加载设计描述（资产生成分析结果） */
async function loadDesignDesc(type: string, name: string) {
  designDesc.value = "";
  try {
    const items = await getEpisodeAssets(pid);
    const hit = items.find((it) => it.type === type && it.name === name);
    designDesc.value = hit?.description ?? "";
  } catch {
    /* 设计描述加载失败不阻断编辑 */
  }
  refreshVoiceCandidates();
  // 设计描述已生成且提示词为空 → 自动生成提示词（按 资产名+设计描述+视觉手册）
  if (designDesc.value && asset.value && !(form.prompt ?? "").trim()) {
    try {
      const prompt = await aiAssetPrompt(name, designDesc.value, type as "character" | "scene" | "prop", pid);
      if (prompt) {
        form.prompt = prompt;
        await updateAsset(pid, asset.value.episodeId, asset.value.id, { prompt }).catch(() => {});
      }
    } catch {
      /* 自动生成失败静默，用户可手动点 AI 生成 */
    }
  }
}

/** 统一设置当前资产：同步表单 + 加载设计描述 */
function setAsset(a: Asset) {
  asset.value = a;
  // 同步当前场为资产实际所在场（切换/跨集后保持一致）
  episodeId.value = a.episodeId;
  syncForm(a);
  void loadDesignDesc(a.type, a.name);
}

function typeLabel(t: string) {
  return { character: "角色", scene: "场景", prop: "道具" }[t] ?? t;
}
function typeTag(t: string): "danger" | "warning" | "primary" {
  return t === "character" ? "danger" : t === "scene" ? "warning" : "primary";
}
function stateText(s: string) {
  return { QUEUED: "未生成", RUNNING: "生成中", SUCCEEDED: "已完成", FAILED: "失败" }[s] ?? s;
}
function stateTag(s: string): "success" | "warning" | "info" | "danger" {
  return { SUCCEEDED: "success", RUNNING: "warning", FAILED: "danger" }[s] ?? "info";
}

function syncForm(a: Asset) {
  form.name = a.name;
  form.type = a.type;
  form.prompt = a.prompt ?? "";
  form.voiceActor = a.voiceActor ?? "";
  form.voiceDialect = a.voiceDialect ?? "";
  refreshVoiceCandidates();
  // 已选演员 → 恢复默认台词（转写文本）
  previewAudioUrl.value = "";
  previewText.value = "";
  if (form.voiceActor) void loadTranscript(form.voiceActor);
}

function stopPoll() {
  if (pollTimer.value != null) {
    clearInterval(pollTimer.value);
    pollTimer.value = null;
  }
}

function startPoll(id: number) {
  if (pollTimer.value != null) return;
  pollTimer.value = window.setInterval(async () => {
    try {
      const cur = await getAsset(pid, asset.value?.episodeId ?? eid, id);
      asset.value = cur;
      if (cur.state === "SUCCEEDED" || cur.state === "FAILED") stopPoll();
    } catch {
      stopPoll();
    }
  }, 1500);
}

async function loadAssetById(id: number) {
  loading.value = true;
  try {
    // 用当前 episodeId.value（切换资产时已更新为资产实际所在场），而非 URL 初始常量 eid
    const a = await getAsset(pid, episodeId.value, id);
    setAsset(a);
  } catch {
    // URL 的集与资产实际集不一致 → 跨集定位
    ElMessage.warning("当前集未找到该资产，尝试跨集定位…");
    for (const ep of episodes.value) {
      if (ep.id === episodeId.value) continue;
      try {
        const a = await getAsset(pid, ep.id, id);
        setAsset(a);
        episodeId.value = ep.id;
        router.replace(`/canvas/${pid}/${ep.id}?asset=${id}`);
        return;
      } catch {
        /* 继续找 */
      }
    }
    ElMessage.error("未找到该资产（可能已删除）");
  } finally {
    loading.value = false;
  }
}

async function onCreate(type: string, name: string) {
  loading.value = true;
  try {
    const flowId = `asset-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const a = await createAsset(pid, eid, { flowId, type: type as Asset["type"], name });
    setAsset(a);
    // 不自动生成：进入详情页后由用户选择「生成」或「上传」
  } catch (e: any) {
    ElMessage.error(`创建资产失败：${e?.response?.data?.message ?? e?.message}`);
  } finally {
    loading.value = false;
  }
}

async function doGenerate(a: Asset) {
  try {
    await generateAsset(pid, a.episodeId, a.id);
    startPoll(a.id);
  } catch (e: any) {
    ElMessage.error(`生成触发失败：${e?.response?.data?.message ?? e?.message}`);
  }
}

async function onGenerate() {
  if (!asset.value || asset.value.state === "RUNNING") return;
  await doGenerate(asset.value);
}

// 提示词改动 → 防抖自动保存（去掉「保存」按钮）
let promptSaveTimer: number | null = null;
watch(
  () => form.prompt,
  (v) => {
    if (!asset.value) return;
    if (promptSaveTimer != null) clearTimeout(promptSaveTimer);
    promptSaveTimer = window.setTimeout(async () => {
      try {
        const a = await updateAsset(pid, asset.value.episodeId, asset.value.id, { prompt: v });
        asset.value = a;
      } catch {
        /* 自动保存失败静默 */
      }
    }, 600);
  },
);

function onUpload() {
  fileInput.value?.click();
}

async function onFilePicked(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file || !asset.value) return;
  try {
    const a = await uploadAsset(pid, asset.value.episodeId, {
      type: form.type,
      name: form.name.trim() || "未命名",
      file,
    });
    setAsset(a);
    ElMessage.success("已上传");
  } catch (err: any) {
    ElMessage.error(`上传失败：${err?.response?.data?.message ?? err?.message}`);
  }
}

async function onDelete() {
  if (!asset.value) return;
  try {
    await ElMessageBox.confirm(`删除「${form.name}」的图片内容？资产卡保留，可重新生成或上传。确定？`, "删除图片", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消",
    });
  } catch {
    return;
  }
  try {
    const a = await clearAsset(pid, asset.value.episodeId, asset.value.id);
    setAsset(a);
    ElMessage.success("已清除图片内容（资产卡保留）");
  } catch (e: any) {
    ElMessage.error(`删除失败：${e?.response?.data?.message ?? e?.message}`);
  }
}

// —— 参考图（scene/prop 图生图）——
const refUploading = ref(false);
function onPickRefImage() {
  refInput.value?.click();
}
async function onRefFilePicked(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file || !asset.value) return;
  refUploading.value = true;
  try {
    const a = await uploadAssetRefImage(pid, asset.value.episodeId, asset.value.id, file);
    setAsset(a);
    ElMessage.success("参考图已上传（生成将走图生图）");
  } catch (err: any) {
    ElMessage.error(`参考图上传失败：${err?.response?.data?.message ?? err?.message}`);
  } finally {
    refUploading.value = false;
  }
}
async function onClearRefImage() {
  if (!asset.value) return;
  try {
    await ElMessageBox.confirm("清除参考图？之后生成将走文生图流程。", "清除参考图", {
      type: "warning",
      confirmButtonText: "清除",
      cancelButtonText: "取消",
    });
  } catch {
    return;
  }
  try {
    const a = await clearAssetRefImage(pid, asset.value.episodeId, asset.value.id);
    setAsset(a);
    ElMessage.success("参考图已清除（生成将走文生图）");
  } catch (e: any) {
    ElMessage.error(`清除失败：${e?.response?.data?.message ?? e?.message}`);
  }
}

function applyTemplate() {
  const desc = (form.prompt ?? "").trim();
  if (!desc) {
    ElMessage.info("请先填写画面描述，再应用模板");
    return;
  }
  const built = applyTemplate(form.type, desc);
  if (built === form.prompt) {
    ElMessage.info("已是完整三段式结构");
    return;
  }
  form.prompt = built;
  ElMessage.success(`已应用「${currentTplLabel.value}」模板`);
}

function onAppendStyle() {
  const before = form.prompt ?? "";
  form.prompt = appendStyleRoot(before);
  ElMessage.success(form.prompt === before ? "已包含风格根" : "已追加铸剑风格根");
}

/** AI 生成提示词：按 资产名+设计描述+项目视觉手册（+用户要求）→ 填入提示词并保存 */
const aiPromptLoading = ref(false);
const aiPromptVisible = ref(false);
const aiPromptInstruction = ref("");
function toggleAiPrompt() {
  if (aiPromptLoading.value) return;
  aiPromptVisible.value = !aiPromptVisible.value;
  if (!aiPromptVisible.value) aiPromptInstruction.value = "";
}
async function onAiGeneratePrompt() {
  if (!asset.value) return;
  aiPromptLoading.value = true;
  try {
    const instruction = aiPromptInstruction.value.trim();
    const desc = instruction ? `${designDesc.value}\n（用户要求：${instruction}）` : designDesc.value;
    const prompt = await aiAssetPrompt(form.name, desc, form.type, pid);
    if (!prompt) throw new Error("AI 未返回提示词");
    form.prompt = prompt;
    // 保存到资产（自动保存 watch 也会触发，这里显式保存确保）
    const a = await updateAsset(pid, asset.value.episodeId, asset.value.id, { prompt });
    asset.value = a;
    ElMessage.success("AI 提示词已生成并保存");
  } catch (e: any) {
    ElMessage.error(`AI 生成失败：${e?.response?.data?.message ?? e?.message}`);
  } finally {
    aiPromptLoading.value = false;
    aiPromptVisible.value = false;
    aiPromptInstruction.value = "";
  }
}

/** 选择配音演员（候选卡）：仅更新本地表单，点「确定」才落库显示 */
function onPickVoiceActor(name: string) {
  const n = (name ?? "").trim();
  if (!n) return;
  form.voiceActor = n;
  previewAudioUrl.value = "";
  void loadTranscript(n);
}
/** 点击候选卡试听参考音频（有 refFile 的播放/停止） */
const playingVoice = ref("");
let voiceAudio: HTMLAudioElement | null = null;
function onToggleVoicePlay(c: any) {
  // 正在播同一位：停止
  if (playingVoice.value === c.name) {
    voiceAudio?.pause();
    voiceAudio = null;
    playingVoice.value = "";
    return;
  }
  if (!c.refFile) {
    ElMessage.info(`「${c.name}」暂无参考音频素材`);
    return;
  }
  // 停止上一位
  voiceAudio?.pause();
  voiceAudio = null;
  // 直连 server 3000（vite 代理 /actor-voice 需重启才生效，直接走后端更稳）
  const url = `http://localhost:3000/actor-voice/${encodeURIComponent(c.refFile)}`;
  const audio = new Audio(url);
  audio.onended = () => {
    voiceAudio = null;
    playingVoice.value = "";
  };
  audio.play().catch(() => ElMessage.error("音频播放失败"));
  voiceAudio = audio;
  playingVoice.value = c.name;
}

/** 方言变更（卡片点击）：仅更新本地表单，点「确定」才落库显示 */
function onDialectPick(v: string) {
  form.voiceDialect = v;
}

/** 确定：记录角色配音演员 + 方言（保存到资产，title/卡片显示） */
async function onConfirmVoice() {
  if (!asset.value || !form.voiceActor) {
    ElMessage.warning("请先选用配音演员");
    return;
  }
  try {
    const a = await updateAsset(pid, asset.value.episodeId, asset.value.id, {
      voiceActor: form.voiceActor,
      voiceDialect: form.voiceDialect || null,
    });
    asset.value = a;
    ElMessage.success(`已确定配音：${form.voiceActor}${form.voiceDialect ? " · " + form.voiceDialect : ""}`);
  } catch (e: any) {
    ElMessage.error(`保存失败：${e?.response?.data?.message ?? e?.message}`);
  }
}

// —— 配音试听：以 配音演员音色 + 方言 合成声音 ——
const previewText = ref("");
const previewLoading = ref(false);
const previewAudioUrl = ref("");
/** 当前选中的配音演员（有素材文件）：从完整演员库查找（不限于当前候选 Top3） */
const voiceSelected = computed(() => {
  if (!form.voiceActor) return "";
  const a = VOICE_ACTORS.find((c) => c.name === form.voiceActor);
  return a?.refFile ?? "";
});
/** 试听按钮禁用原因（便于定位问题） */
const previewDisabledHint = computed(() => {
  if (previewLoading.value) return "合成中…";
  if (!form.voiceActor) return "未选演员";
  if (!voiceSelected.value) return "演员无素材";
  if (!previewText.value.trim()) return "未输入台词";
  return "";
});
const previewDisabled = computed(() => !!previewDisabledHint.value);
/** 加载参考音频转写文本作为默认台词 */
async function loadTranscript(actorName: string) {
  if (!actorName) return;
  try {
    const res = await http.get(`/voice/transcript/${encodeURIComponent(actorName)}`);
    const text = res.data?.data?.text ?? "";
    if (text) previewText.value = text;
  } catch {
    /* 转写不可用时留空 */
  }
}
/** 试听合成：提交 SoulX → 轮询 → 播放 */
async function onPreviewVoice() {
  const refFile = voiceSelected.value;
  if (!refFile || !previewText.value.trim()) return;
  previewLoading.value = true;
  previewAudioUrl.value = "";
  try {
    const sub = await http.post("/voice/preview", {
      actor: refFile,
      dialect: form.voiceDialect || "普通话",
      text: previewText.value.trim(),
    });
    const promptId = sub.data?.data?.promptId;
    if (!promptId) throw new Error("未获取到任务 ID");
    ElMessage.info("语音合成中（约 1-2 分钟）…");
    // 轮询
    const t0 = Date.now();
    while (Date.now() - t0 < 3 * 60 * 1000) {
      await new Promise((r) => setTimeout(r, 6000));
      const q = await http.get(`/voice/preview/${promptId}`);
      const st = q.data?.data;
      if (st?.status === "done") {
        previewAudioUrl.value = st.url;
        ElMessage.success("合成完成");
        break;
      }
      if (st?.status === "error") {
        ElMessage.error(`合成失败：${st.message ?? ""}`);
        break;
      }
    }
  } catch (e: any) {
    ElMessage.error(`试听失败：${e?.response?.data?.message ?? e?.message}`);
  } finally {
    previewLoading.value = false;
  }
}

function onEpisodeChange(newEid: number) {
  router.push(`/canvas/${pid}/${newEid}`);
}

function goBack() {
  router.push(`/project/${pid}?tab=assets`);
}

onMounted(async () => {
  const projects = await getProjects().catch(() => [] as { id: number; name: string }[]);
  projectName.value = projects.find((p) => p.id === pid)?.name ?? `项目 ${pid}`;
  episodes.value = await listEpisodes(pid).catch(() => []);

  const assetParam = route.query.asset;
  const createParam = route.query.create;
  const nameParam = route.query.name;
  if (assetParam) {
    await loadAssetById(Number(assetParam));
  } else if (createParam === "character" || createParam === "scene" || createParam === "prop") {
    const name = typeof nameParam === "string" ? decodeURIComponent(nameParam) : "";
    const label = { character: "角色", scene: "场景", prop: "道具" }[createParam];
    await onCreate(createParam, name || `新${label}`);
  }
  await loadAssetList();
});

/** 当前资产所属场的全部资产（含状态；切换跳有图的资产） */
const assetList = ref<Array<{ id: number; state: string; filePath: string | null }>>([]);
async function loadAssetList() {
  const epId = asset.value?.episodeId ?? episodeId.value;
  try {
    const list = await listAssets(pid, epId);
    assetList.value = list.map((a) => ({ id: a.id, state: a.state, filePath: a.filePath }));
    console.log("[CanvasView] loadAssetList ok pid=" + pid + " epId=" + epId + " count=" + assetList.value.length);
  } catch (e) {
    console.error("[CanvasView] loadAssetList FAIL pid=" + pid + " epId=" + epId + " err=" + (e?.message ?? e));
    assetList.value = [];
  }
}
/** 上一个/下一个切换资产：跳到下一个有图（SUCCEEDED）的资产；生成中禁用 */
async function switchAsset(dir: 1 | -1) {
  if (!asset.value || asset.value.state === "RUNNING" || switching.value) return;
  if (assetList.value.length === 0) await loadAssetList();
  if (assetList.value.length === 0) {
    ElMessage.warning("资产列表为空，无法切换");
    return;
  }
  let idx = assetList.value.findIndex((a) => a.id === asset.value!.id);
  if (idx < 0) {
    ElMessage.warning("当前资产不在列表中，已重新加载列表");
    await loadAssetList();
    idx = assetList.value.findIndex((a) => a.id === asset.value!.id);
    if (idx < 0) return;
  }
  // 沿方向找下一个有图资产（跳过 QUEUED/FAILED 空卡）
  const n = assetList.value.length;
  let nextItem = null;
  for (let step = 1; step <= n; step++) {
    const item = assetList.value[(idx + dir * step + n) % n];
    if (item && item.state === "SUCCEEDED" && item.filePath) {
      nextItem = item;
      break;
    }
  }
  if (!nextItem) {
    ElMessage.info(dir === 1 ? "已是最后一个有图资产" : "已是第一个有图资产");
    return;
  }
  if (nextItem.id === asset.value.id) {
    ElMessage.info("仅此一个有图资产");
    return;
  }
  switching.value = true;
  try {
    const epId = asset.value.episodeId ?? episodeId.value;
    router.replace(`/canvas/${pid}/${epId}?asset=${nextItem.id}`);
    await loadAssetById(nextItem.id);
    ElMessage.success("已切换到资产 " + nextItem.id);
  } catch (e: any) {
    ElMessage.error("切换失败：" + (e?.message ?? e));
  } finally {
    switching.value = false;
  }
}
const switching = ref(false);
const switchDisabled = computed(() => !asset.value || asset.value.state === "RUNNING" || switching.value);

onUnmounted(stopPoll);
</script>

<style scoped>
.asset-editor {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f3ed;
}
.topbar {
  height: 48px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  background: #ffffff;
  border-bottom: 1px solid #e4e6eb;
  flex-shrink: 0;
}
.brand-name { color: #2b2f36; font-weight: 600; }
.topbar-right { margin-left: auto; display: flex; align-items: center; gap: 8px; }
.editor-body { flex: 1; display: flex; min-height: 0; }
.preview-pane {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: #f5f3ed;
  overflow-y: auto;
}
.asset-title {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 20px;
  gap: 8px;
  font-size: 17px;
  font-weight: 700;
  color: #2b2f36;
  flex-shrink: 0;
}
.title-type { font-weight: 500; }
.title-voice { font-weight: 500; }
.preview-img-wrap {
  width: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 0;
}
.preview-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  background: #ffffff;
}
/* 上一个/下一个切换按钮：资产大图左右两侧垂直居中，覆盖在图上方 */
.nav-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 35px;
  height: 35px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.85);
  color: #6b7380;
  font-size: 26px;
  line-height: 1;
  cursor: pointer;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(60, 70, 90, 0.18);
  transition: background 0.15s, color 0.15s, transform 0.1s;
  padding: 0 0 3px; /* 视觉微调垂直居中 */
}
.nav-arrow:hover:not(:disabled) { background: #c98a2d; color: #fff; }
.nav-arrow:disabled { opacity: 0.4; cursor: not-allowed; }
.nav-prev { left: 10px; }
.nav-next { right: 10px; }
.del-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 2;
}
.asset-actions {
  width: 100%;
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-shrink: 0;
}
.asset-actions .el-button { margin-left: 0; }
.preview-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: #8a919c;
  font-size: 13px;
}
.empty-icon { font-size: 44px; }
.state-hint { color: #b0b8c4; font-size: 12px; }
.error-reason {
  color: #c0564d;
  font-size: 12px;
  max-width: 420px;
  word-break: break-all;
  text-align: center;
  background: #fdf0ef;
  border: 1px solid #f3d5d1;
  border-radius: 6px;
  padding: 8px 10px;
}
.edit-pane {
  width: 720px;
  flex-shrink: 0;
  background: #f8f9fb;
  border-left: 1px solid #e4e6eb;
  padding: 14px;
  overflow-y: auto;
}
.prop-block { margin-bottom: 12px; }
.prop-label { color: #6b7380; font-size: 12px; margin-bottom: 4px; }
.design-desc {
  background: #ffffff;
  border: 1px solid #e4e6eb;
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.7;
  color: #4a5058;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 560px;
  overflow-y: auto;
}
.prop-actions { display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap; }
.prop-actions .el-button { margin-left: 0; }
.props-empty { color: #8a919c; font-size: 13px; text-align: center; margin-top: 60px; line-height: 1.8; }
.prompt-tools { margin-top: 6px; }
.prompt-tools-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.prompt-tpl-name { color: #6b7380; font-size: 12px; }
.prompt-tpl-hint { color: #8a919c; font-size: 11px; margin-top: 4px; }
/* 提示词操作栏：左=AI 生成，右=图片生成按钮 */
.prompt-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  flex-wrap: wrap;
}
.prompt-bar .el-button { margin-left: 0; }
.prompt-bar-spacer { flex: 1; }
/* 参考图（scene/prop 图生图） */
.ref-block { border-top: 1px dashed #e0ddd3; padding-top: 12px; }
.ref-hint-tag { margin-left: 6px; }
.ref-upload-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.ref-upload-row .el-button { margin-left: 0; }
.ref-preview { margin-top: 4px; }
.ref-preview-img {
  max-width: 220px;
  max-height: 160px;
  object-fit: contain;
  border-radius: 6px;
  border: 1px solid #e4e6eb;
  background: #ffffff;
  display: block;
}
.ref-preview-caption { color: #8a919c; font-size: 11px; margin-top: 4px; }
.ref-empty { color: #b0b8c4; font-size: 12px; padding: 6px 0; }
/* 配音演员（角色类型资产） */
.voice-block { border-top: 1px dashed #e0ddd3; padding-top: 12px; }
/* 候选列表：横向滚动（一排显示不下时滑动）；上下留出空间避免裁掉 hover/选中边框 */
.voice-candidates {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  overflow-y: visible;
  padding: 4px 0 8px;
  margin-bottom: 8px;
  scrollbar-width: thin;
}
.voice-card {
  width: 148px;
  flex-shrink: 0;
  background: #ffffff;
  border: 1px solid #e4e6eb;
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.1s;
  box-sizing: border-box;
}
.voice-card:hover { border-color: #c98a2d; transform: translateY(-1px); }
.voice-card.active { border-color: #c98a2d; box-shadow: 0 0 0 1px #c98a2d; }
.voice-card.playing { border-color: #d65f5f; box-shadow: 0 0 0 1px #d65f5f; }
.voice-card-head { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.voice-card-name { color: #2b2f36; font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* 播放按钮：圆形；用内联 SVG 三角形保证精确居中（▶ 字体字符有基线偏移） */
.voice-play-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  background: #c98a2d;
  color: #fff;
  cursor: pointer;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: background 0.15s, transform 0.1s;
}
.voice-play-btn:hover { background: #b57a20; transform: scale(1.06); }
.voice-play-btn.playing { background: #d65f5f; }
.voice-play-btn svg {
  display: block;
  width: 14px;
  height: 14px;
  margin: 1px 0 0 1px; /* 视觉居中微调 */
}
.voice-card-desc { color: #8a919c; font-size: 11px; margin-top: 6px; line-height: 1.4; min-height: 30px; }
/* 方言卡片选择 */
.voice-dialect-label { color: #6b7380; font-size: 12px; margin-bottom: 6px; }
.voice-dialects {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}
.dialect-card {
  padding: 4px 12px;
  border-radius: 14px;
  font-size: 12px;
  color: #6b7380;
  background: #f0f0e0;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s, color 0.15s;
  user-select: none;
}
.dialect-card:hover { border-color: #c98a2d; color: #c98a2d; }
.dialect-card.on { background: #c98a2d; color: #ffffff; }
/* 台词输入 + 试听 */
.voice-line-label { color: #6b7380; font-size: 12px; margin-bottom: 6px; }
.preview-text-input { margin-bottom: 8px; }
.preview-text-input :deep(.el-textarea__inner) { font-family: inherit; font-size: 12px; line-height: 1.6; }
.preview-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.preview-audio { height: 34px; }
</style>
