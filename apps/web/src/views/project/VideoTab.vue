<template>
  <div class="video-workspace">
    <!-- ═══ 第一级：所有集卡片 ═══ -->
    <template v-if="view === 'list'">
      <div class="list-head">
        <h3>分场视频</h3>
        <span class="list-hint">每场一张卡片，点击查看本场镜（项目 → 场 → 镜）</span>
      </div>
      <div class="episodes-grid">
        <div v-for="ep in episodes" :key="ep.id" class="ep-card" @click="enterEpisode(ep.id)">
          <div class="ep-title">{{ ep.name }}</div>
          <div class="ep-stats">
            <span class="stat"><b>{{ storyboardCount(ep.id) }}</b> 分镜</span>
            <span class="stat"><b>{{ epAssetCount(ep.id) }}</b> 资产</span>
            <span class="stat"><b>{{ videoCount(ep.id) }}</b> 视频</span>
          </div>
          <div class="ep-summary">{{ epSummary(ep) }}</div>
          <div class="ep-foot">
            <span class="ep-duration">⏱ {{ episodeDurationText(ep.id) }}</span>
            <span class="ep-enter">查看本场镜 →</span>
          </div>
        </div>
        <el-empty v-if="episodes.length === 0" description="暂无场次（在「小说」页开始制作，或到「剧本」页同步场次）" :image-size="70" />
      </div>
    </template>

    <!-- ═══ 第二级：场详情 ═══ -->
    <template v-else>
      <div class="detail-head">
        <el-button size="small" text @click="backToList">← 所有场</el-button>
        <span class="detail-title">{{ currentEpName }}</span>
        <span class="list-hint">{{ storyboards.length }} 个分镜 · {{ epAssets.length }} 资产</span>
      </div>

      <div class="main-area">
        <!-- 中部行：左资产 + 右详情 -->
        <div class="content-row">
        <!-- 左：本集资产（只展示角色/场景，放大卡片；支持 本集/全集 切换、搜索、类型过滤） -->
        <aside class="asset-panel">
          <div class="panel-head">
            <span class="panel-title">本场资产</span>
            <el-radio-group v-model="assetScope" size="small" class="scope-toggle">
              <el-radio-button value="ep">本场</el-radio-button>
              <el-radio-button value="all">全场</el-radio-button>
            </el-radio-group>
          </div>
          <div class="asset-toolbar">
            <el-input v-model="assetKeyword" size="small" placeholder="搜索资产" clearable class="asset-search">
              <template #prefix><span class="search-icon">🔍</span></template>
            </el-input>
            <div class="asset-filter">
              <span
                v-for="f in assetFilters"
                :key="f.value"
                class="filter-chip"
                :class="{ on: assetFilter === f.value }"
                @click="assetFilter = f.value"
              >{{ f.label }}</span>
            </div>
          </div>
          <template v-if="scopedAssets.length > 0">
            <div v-for="g in assetGroups" :key="g.label" class="asset-group">
              <div class="group-label">{{ g.label }}<span class="group-count">{{ g.items.length }}</span></div>
              <div class="asset-cards">
                <div
                  v-for="a in g.items"
                  :key="a.id ?? a.name"
                  class="asset-card"
                  :title="a.name"
                  @click="a.asset ? $router.push(`/canvas/${projectId}/${a.asset.episodeId ?? selectedEpisodeId}?asset=${a.asset.id}`) : undefined"
                >
                  <div class="asset-card-img">
                    <img v-if="a.asset?.filePath" :src="a.asset.filePath" class="asset-img" loading="lazy" />
                    <div v-else class="asset-img placeholder-img">
                      <span class="thumb-char">{{ a.name.slice(0, 1) }}</span>
                    </div>
                  </div>
                  <div class="asset-card-body">
                    <span class="asset-name">{{ a.name }}</span>
                    <span v-if="a.description" class="asset-desc">{{ a.description }}</span>
                    <el-tag v-if="a.asset" size="small" :type="assetStateTag(a.asset.state)" class="asset-state">
                      {{ assetStateText(a.asset.state) }}
                    </el-tag>
                    <el-tag v-else size="small" type="info" class="asset-state">未生成</el-tag>
                  </div>
                </div>
              </div>
            </div>
          </template>
          <div v-else class="no-asset">
            {{ assetFilter === "all" && !assetKeyword ? (assetScope === "ep" ? "本场暂无资产" : "全场暂无资产") : "当前筛选下暂无资产" }}<br />
            <span class="hint">（先在资产页「分析资产」生成本场清单）</span>
          </div>
        </aside>

        <!-- 右：详情（5:1） -->
        <div class="right-area">
          <div v-if="selectedSb" class="detail-area">
            <main class="desc-panel">
              <!-- 当前分镜信息：第X场 本场 当前镜/总数 镜 时长 -->
              <div class="desc-section desc-info">
                <div class="sb-info-line">
                  <span class="sb-info-item"><b>第 {{ currentEpIndex }} 场</b></span>
                  <span class="sb-info-item">
                    <b>本场 {{ currentSbNo }}/{{ storyboards.length }} 镜</b>
                  </span>
                  <span v-if="selectedSb.duration" class="sb-info-item">
                    <b>⏱ {{ selectedSb.duration }}s</b><em>（≤15s，Minimax 一次视频任务）</em>
                  </span>
                </div>
              </div>

              <!-- ③ 视频生成提示词 | 视频（合并栏；r2v 参考图模式，本段提示词用于重新生成本段视频） -->
              <div class="desc-section desc-merged">
                <!-- 左半：视频生成提示词 -->
                <div class="merged-ffprompt">
                  <div class="wf-prompt-box">
                    <div class="wf-prompt-head">
                      <el-tag size="small" type="warning">视频生成提示词</el-tag>
                      <div class="wf-prompt-actions">
                        <el-button
                          v-if="!wfPromptLoading && !wfPrompt"
                          size="small"
                          text
                          type="info"
                          @click="loadWorkflowPrompt(selectedSb)"
                        >
                          重新生成
                        </el-button>
                        <el-button
                          size="small"
                          text
                          type="warning"
                          :loading="wfDownloading"
                          title="r2v 多参考图（含本镜资产）"
                          @click="onDownloadWorkflow"
                        >
                          {{ wfDownloading ? "生成中…" : "⬇️ 下载 ComfyUI 工作流" }}
                        </el-button>
                      </div>
                    </div>
                    <pre v-if="wfPromptLoading" class="wf-prompt">生成中…（约几秒）</pre>
                    <el-input
                      v-else-if="wfEditing"
                      v-model="wfDraft"
                      type="textarea"
                      class="wf-edit-input"
                      resize="none"
                    />
                    <pre v-else-if="wfPrompt" class="wf-prompt">{{ wfPromptDisplay }}</pre>
                    <div v-else class="wf-prompt-empty">
                      暂无提示词——工作流生成时由 AI 自动产出（点击「下载 ComfyUI 工作流」后自动填充）
                    </div>
                    <div class="wf-prompt-foot">
                      <el-button size="small" text type="primary" :disabled="!wfPrompt" @click="onCopyWorkflowPrompt">📋 复制</el-button>
                      <el-button size="small" text type="warning" :disabled="!wfPrompt || wfEditing" @click="toggleAiEditWf">✨ AI 优化</el-button>
                      <el-button v-if="!wfEditing" size="small" text :disabled="!wfPrompt" @click="startEditWf">✏️ 手动编辑</el-button>
                      <template v-else>
                        <el-button size="small" text type="success" :loading="wfSaving" @click="saveEditWf">💾 保存</el-button>
                        <el-button size="small" text @click="cancelEditWf">取消</el-button>
                      </template>
                      <el-button size="small" text type="primary" @click="camVisible = true">🎥 镜头可视化编辑</el-button>
                    </div>
                    <!-- AI 优化视频提示词：页面内展开输入框 -->
                    <div v-if="wfAiVisible" class="ai-prompt-bar">
                      <el-input
                        v-model="wfAiInstruction"
                        type="textarea"
                        :rows="2"
                        resize="none"
                        placeholder="输入优化要求，例如：让动作更连贯；强化环境音；节奏更快…"
                      />
                      <div class="ai-prompt-actions">
                        <el-button size="small" @click="toggleAiEditWf">收起</el-button>
                        <el-button size="small" type="primary" :loading="wfAiLoading" :disabled="!wfAiInstruction.trim()" @click="onAiEditWf">优化</el-button>
                      </div>
                    </div>
                  </div>
                </div>
                <!-- 右半：视频（默认显示视频；点「镜头可视化编辑」后 CameraPlanner 占据整个右侧区域） -->
                <div class="merged-video">
                  <!-- 镜头与机位规划（默认隐藏；显示时占据整个右侧区域） -->
                  <template v-if="camVisible">
                    <div class="cam-full-head">
                      <span class="cam-full-title">🎥 镜头与机位规划</span>
                      <el-button size="small" text @click="camVisible = false">✕ 关闭</el-button>
                    </div>
                    <CameraPlanner ref="camPlannerRef" @inject="onInjectCameraDesc" class="cam-full-body" />
                  </template>
                  <template v-else>
                    <div class="firstframe-head">
                      <el-tag size="small" type="warning">视频</el-tag>
                      <span class="firstframe-hint">r2v 多图参考生成（不依赖首帧）</span>
                    </div>
                    <div class="video-top">
                      <template v-if="selectedSbVideo">
                        <video :src="selectedSbVideo" controls preload="metadata" class="sb-video" />
                      </template>
                      <template v-else>
                        <div class="no-video">
                          <el-button
                            type="warning"
                            plain
                            size="small"
                            :loading="generating"
                            :disabled="generating"
                            @click="onGenerateVideo"
                          >
                            {{ generating ? "生成中…" : "立即生成" }}
                          </el-button>
                          <span class="hint">（r2v 多图参考生成本段视频，约几分钟）</span>
                        </div>
                      </template>
                    </div>
                    <div class="video-bottom">
                      <el-button
                        v-if="selectedSbVideo"
                        size="small"
                        type="warning"
                        plain
                        :loading="generating"
                        :disabled="generating"
                        @click="onGenerateVideo"
                      >
                        {{ generating ? "生成中…" : "🔄 重新生成视频" }}
                      </el-button>
                    </div>
                  </template>
                </div>
              </div>
            </main>
          </div>
          <div v-else class="detail-placeholder">点选下方分镜卡片查看详情</div>
        </div>
        </div>

        <!-- 页面最底部：本场视频片段（整行通栏；按场 tab 切换，只占一条高度）；未拆解时显示拆解分镜入口 -->
        <div class="storyboards-row">
          <template v-if="storyboards.length > 0">
            <div class="row-head">
              <div class="row-label">本场视频片段（{{ storyboards.length }} 镜 · {{ totalDurationText }}）</div>
              <el-button size="small" type="danger" plain @click="onDeleteAllStoryboards">🗑 删除本场全部分镜</el-button>
            </div>
            <!-- 视觉词典（拆镜附带：角色/场景/道具锁定词条，供后续生图/生视频保持一致性） -->
            <div v-if="visualDict" class="visual-dict">
              <div class="vd-head" @click="dictExpanded = !dictExpanded">
                <span>📖 视觉词典（角色/场景/道具锁定）</span>
                <el-button size="small" text>{{ dictExpanded ? "收起 ▲" : "展开 ▼" }}</el-button>
              </div>
              <div v-if="dictExpanded" class="vd-body">
                <div v-if="visualDict.characters?.length" class="vd-group">
                  <div class="vd-group-title">角色</div>
                  <div v-for="c in visualDict.characters" :key="c.name" class="vd-item">
                    <b>{{ c.name }}</b>
                    <span v-if="c.look">{{ c.look }}</span>
                    <span v-if="c.outfit" class="vd-sub">{{ c.outfit }}</span>
                  </div>
                </div>
                <div v-if="visualDict.scenes?.length" class="vd-group">
                  <div class="vd-group-title">场景</div>
                  <div v-for="s in visualDict.scenes" :key="s.name" class="vd-item">
                    <b>{{ s.name }}</b>
                    <span v-if="s.space">{{ s.space }}</span>
                    <span v-if="s.light" class="vd-sub">{{ s.light }}</span>
                  </div>
                </div>
                <div v-if="visualDict.props?.length" class="vd-group">
                  <div class="vd-group-title">道具</div>
                  <div v-for="p in visualDict.props" :key="p.name" class="vd-item">
                    <b>{{ p.name }}</b>
                    <span v-if="p.look">{{ p.look }}</span>
                    <span v-if="p.state" class="vd-sub">{{ p.state }}</span>
                  </div>
                </div>
              </div>
            </div>
            <!-- 本场全部镜：无场次 tab，直接横向滚动展示本场所有分镜 -->
            <div class="scene-pane">
              <div class="scene-pane-head">
                <span class="scene-count">{{ storyboards.length }} 镜</span>
                <el-tag v-if="sceneLvMap[currentEpIndex]" size="small" :type="lvStateTag(sceneLvMap[currentEpIndex])" class="scene-lv-tag">
                  {{ lvStateText(sceneLvMap[currentEpIndex]) }}
                </el-tag>
                <div class="scene-actions">
                  <el-button
                    size="small"
                    type="warning"
                    plain
                    :loading="sceneLvLoading === currentEpIndex"
                    :disabled="sceneLvLoading !== null || storyboards.length === 0"
                    @click="onGenerateSceneVideo"
                  >
                    {{ sceneLvLoading === currentEpIndex ? "生成中…" : "🎬 生成本场视频" }}
                  </el-button>
                </div>
              </div>
              <div class="sb-scroll-wrap">
                <el-button size="small" circle text class="sb-nav" :disabled="!canScrollSb" @click="scrollSb(-1)">‹</el-button>
                <div ref="sbScrollRef" class="sb-scroll" @wheel="onSbWheel">
                  <div class="sb-cards">
                    <div
                      v-for="s in storyboards"
                      :key="s.id"
                      class="sb-card"
                      :class="{ active: selectedSbId === s.id, 'sb-card-wide': ratioLandscape }"
                      @click="onSelectSb(s)"
                    >
                      <div class="sb-thumbwrap">
                        <!-- 优先显示视频片段 -->
                        <video v-if="videoMap[s.id]" :src="videoMap[s.id]" muted preload="metadata" class="sb-video-thumb" @click.stop="onSelectSb(s)" />
                        <img v-else-if="s.filePath" :src="s.filePath" class="sb-thumb" :style="{ aspectRatio: ratioCss }" loading="lazy" />
                        <div v-else class="sb-noimg" :style="{ aspectRatio: ratioCss }">无图</div>
                        <span v-if="!videoMap[s.id] && videoMap[s.id] === undefined && s.filePath" class="sb-play" title="尚未生成视频" @click.stop="onSelectSb(s)"></span>
                        <span v-if="selectedSbId === s.id" class="sb-check">✓</span>
                      </div>
                      <div class="sb-foot">
                        <span class="sb-index">#{{ s.index }}</span>
                        <span v-if="videoMap[s.id]" class="sb-dur">▶ 视频</span>
                        <span v-else-if="s.duration" class="sb-dur">⏱{{ s.duration }}s</span>
                      </div>
                    </div>
                  </div>
                </div>
                <el-button size="small" circle text class="sb-nav" :disabled="!canScrollSb" @click="scrollSb(1)">›</el-button>
              </div>
            </div>
          </template>
          <!-- 未拆解：拆解分镜入口（已拆解则不显示） -->
          <div v-else class="split-prompt">
            <div class="split-title">本场尚未拆解分镜</div>
            <div class="split-desc">AI 将当前场剧本拆为分镜（每镜 ≤15s），并自动生成分镜图（视频首帧）与 ComfyUI 工作流；拆解后即可在本页逐镜生成视频。</div>
            <el-button type="primary" size="large" :loading="splitting" :disabled="!currentEpScript" @click="onSplit">🎬 拆解分镜</el-button>
            <div v-if="!currentEpScript" class="split-warn">本场暂无剧本，请先在「剧本」页编写整片剧本</div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import CameraPlanner from "./CameraPlanner.vue";
import { listEpisodes, listAssets, listStoryboards, getVideo, generateVideo, getEpisodeAssets, updateStoryboard, getStoryboardWorkflowPrompt, aiSplitStoryboardWithDict, createStoryboard, deleteStoryboard, batchGenerateStoryboardImages, generateStoryboardWorkflows, aiPromptEdit, getLongVideo, generateLongVideo, rerunLongVideoSegment, http, type Episode, type AiVisualDict } from "../../api/client";

const camPlannerRef = ref<InstanceType<typeof CameraPlanner> | null>(null);
/** 镜头与机位规划栏是否显示（默认隐藏；点「镜头可视化编辑」打开，✕ 关闭） */
const camVisible = ref(false);

const props = defineProps<{ projectId: number; initialEpisodeId?: number; tabActive?: boolean }>();
const view = ref<"list" | "detail">("list");
const episodes = ref<Episode[]>([]);
const selectedEpisodeId = ref<number | null>(null);
const selectedSbId = ref<number | null>(null);
const sbByEp = ref<Record<number, any[]>>({});
const videoMap = ref<Record<number, string>>({});
const assets = ref<any[]>([]);
const generating = ref(false);
const splitting = ref(false);
const wfDownloading = ref(false);
// 拆镜附带：视觉词典（角色/场景/道具锁定词条，来自 storyboard_split 输出的 visualDict）
const visualDict = ref<AiVisualDict | null>(null);
const dictExpanded = ref(false);
// 长视频（按场：MiniMaxH3 Director 串联该场分镜）
const sceneLvMap = ref<Record<number, any>>({});
const sceneLvLoading = ref<number | null>(null);
const lvRerunning = ref<number | null>(null);
let lvPollTimer: ReturnType<typeof setInterval> | null = null;
// 工作流注入提示词（ComfyUI 详情展示）
const wfPrompt = ref("");
const wfPromptLoading = ref(false);
const wfPromptCache = ref<Record<number, string>>({});
// 项目视频比例（默认竖屏 9:16；按项目设置控制分镜缩略图宽高比）
const projectRatio = ref("9:16");
const ratioCss = computed(() => {
  const m = /^(\d+)\s*[:：xX]\s*(\d+)$/.exec(projectRatio.value.trim());
  return m ? `${m[1]} / ${m[2]}` : "9 / 16";
});
const ratioLandscape = computed(() => {
  const m = /^(\d+)\s*[:：xX]\s*(\d+)$/.exec(projectRatio.value.trim());
  return m ? Number(m[1]) > Number(m[2]) : false;
});

// 分镜横向滚动
const sbScrollRef = ref<HTMLElement | null>(null);
const canScrollSb = ref(false);

function updateCanScrollSb() {
  const el = sbScrollRef.value;
  canScrollSb.value = !!el && el.scrollWidth > el.clientWidth + 4;
}

function scrollSb(dir: number) {
  const el = sbScrollRef.value;
  if (!el) return;
  el.scrollBy({ left: dir * 320, behavior: "smooth" });
}

/** 滚轮垂直滚动映射为分镜横向滚动 */
function onSbWheel(e: WheelEvent) {
  const el = sbScrollRef.value;
  if (!el || el.scrollWidth <= el.clientWidth) return;
  e.preventDefault();
  el.scrollLeft += e.deltaY || e.deltaX;
}

const currentEpName = computed(() => episodes.value.find((e) => e.id === selectedEpisodeId.value)?.name ?? "");
const currentEpIndex = computed(() => episodes.value.find((e) => e.id === selectedEpisodeId.value)?.index ?? 0);
/** 当前场剧本：从整片剧本按场号提取（场记录不再独立存剧本） */
const currentEpScript = computed(() => {
  if (selectedEpisodeId.value == null) return "";
  const idx = episodes.value.find((e) => e.id === selectedEpisodeId.value)?.index ?? 0;
  return idx ? (sceneTextByIndex.value[idx] ?? "") : "";
});
const storyboards = computed(() => (selectedEpisodeId.value != null ? sbByEp.value[selectedEpisodeId.value] ?? [] : []));
const selectedSb = computed(() => storyboards.value.find((s) => s.id === selectedSbId.value) ?? null);
/** 当前镜在本集中的序号（按 storyboards 顺序，1 起） */
const currentSbNo = computed(() => {
  if (!selectedSb.value) return 0;
  const idx = storyboards.value.findIndex((s) => s.id === selectedSb.value.id);
  return idx >= 0 ? idx + 1 : 0;
});
/** 本集总时长（所有分镜 duration 之和），格式 "X 分 Y 秒" */
const totalDurationText = computed(() => {
  const sec = storyboards.value.reduce((sum, s) => sum + (Number(s.duration) || 0), 0);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m} 分 ${s} 秒` : `${s} 秒`;
});
const selectedSbVideo = computed(() => (selectedSb.value ? videoMap.value[selectedSb.value.id] ?? "" : ""));

// 分镜数量/视图变化后刷新「是否可横向滚动」判定
watch(
  () => storyboards.value.length,
  () => nextTick(updateCanScrollSb),
);
watch(() => view.value, () => nextTick(updateCanScrollSb));

/** 本集资产：来自「分析资产」持久化的集-资产映射（按出现集过滤），同名匹配资产库显示图 */
const episodeAssets = ref<any[]>([]); // 分析结果（含 type/name/description/episodes）

/** 资产栏交互：本集/全集 切换 + 搜索 + 类型过滤（只展示 角色/场景） */
const assetScope = ref<"ep" | "all">("ep");
const assetKeyword = ref("");
const assetFilter = ref("all");
const assetFilters = [
  { label: "全部", value: "all" },
  { label: "角色", value: "character" },
  { label: "场景", value: "scene" },
];

const epAssets = computed(() => {
  if (selectedEpisodeId.value == null) return [];
  const idx = episodes.value.find((e) => e.id === selectedEpisodeId.value)?.index ?? 0;
  if (!idx) return [];
  // 出现集包含当前集的分析资产，附上资产库同名匹配
  return episodeAssets.value
    .filter((a) => (a.episodes ?? []).includes(idx))
    .map((a) => ({
      ...a,
      asset:
        assets.value.find(
          (x: any) => x.name === a.name || x.name.includes(a.name) || a.name.includes(x.name),
        ) ?? null,
    }));
});

/** 资产栏实际展示列表：范围（本集/全集）+ 搜索关键字 + 类型过滤 */
const scopedAssets = computed(() => {
  let list = episodeAssets.value;
  if (assetScope.value === "ep" && selectedEpisodeId.value != null) {
    const idx = episodes.value.find((e) => e.id === selectedEpisodeId.value)?.index ?? 0;
    if (idx) list = list.filter((a) => (a.episodes ?? []).includes(idx));
  }
  const kw = assetKeyword.value.trim().toLowerCase();
  if (kw) list = list.filter((a) => (a.name ?? "").toLowerCase().includes(kw));
  if (assetFilter.value !== "all") list = list.filter((a) => a.type === assetFilter.value);
  return list.map((a) => ({
    ...a,
    asset:
      assets.value.find(
        (x: any) => x.name === a.name || x.name.includes(a.name) || a.name.includes(x.name),
      ) ?? null,
  }));
});

const assetGroups = computed(() => {
  // 详情页资产栏只保留：角色 → 场景（道具/素材不展示）
  const order: [string, string][] = [
    ["角色", "character"],
    ["场景", "scene"],
  ];
  const groups: { label: string; items: any[] }[] = [];
  for (const [label, t] of order) {
    const items = scopedAssets.value.filter((a) => a.type === t);
    if (items.length) groups.push({ label, items });
  }
  return groups;
});

function assetStateText(s: string) {
  return { QUEUED: "未生成", RUNNING: "生成中", SUCCEEDED: "已完成", FAILED: "失败" }[s] ?? s;
}
function assetStateTag(s: string): "success" | "warning" | "info" | "danger" {
  return { SUCCEEDED: "success", RUNNING: "warning", FAILED: "danger" }[s] ?? "info";
}

function storyboardCount(epId: number) {
  return (sbByEp.value[epId] ?? []).length;
}
function epAssetCount(epId: number) {
  return assets.value.filter((a) => a.episodeId === epId).length;
}
function videoCount(epId: number) {
  return (sbByEp.value[epId] ?? []).filter((s: any) => videoMap.value[s.id]).length;
}
/** 本集总时长文本（分镜 duration 之和，X 分 Y 秒 / X 秒） */
function episodeDurationText(epId: number) {
  const sec = (sbByEp.value[epId] ?? []).reduce((sum: number, s: any) => sum + (Number(s.duration) || 0), 0);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m} 分 ${s} 秒` : `${s} 秒`;
}
function epSummary(ep: Episode) {
  const s = (sceneTextByIndex.value[ep.index] ?? "").trim().replace(/\s+/g, " ");
  return s ? (s.length > 50 ? s.slice(0, 50) + "…" : s) : "（本场暂无剧情）";
}

/** 展示/输入清理（紧凑模式）：删除段落间空行，只在「场」标题（## 场 N）之间保留一个空行（不写回 DB） */
function cleanScriptText(script: string): string {
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

/** 整片剧本（Project.scriptContent，场文本权威来源） */
const projectScript = ref("");
/** 场号 → 该场剧本文本（从整片剧本按 ## 场 N 解析，含场标题行） */
const sceneTextByIndex = ref<Record<number, string>>({});

/** 从整片剧本解析「场号 → 该场文本」 */
function parseSceneTexts(script: string): Record<number, string> {
  const map: Record<number, string> = {};
  const lines = (script ?? "").split(/\r?\n/);
  let cur: number | null = null;
  const buf: string[] = [];
  for (const ln of lines) {
    const m = /^##\s*场\s*(\d+)([^\n]*)/.exec(ln.trim());
    if (m) {
      if (cur != null) map[cur] = buf.join("\n");
      cur = parseInt(m[1], 10);
      buf.length = 0;
      buf.push(ln);
    } else if (cur != null) {
      buf.push(ln);
    }
  }
  if (cur != null) map[cur] = buf.join("\n");
  return map;
}

async function load() {
  sbByEp.value = {};
  videoMap.value = {};
  assets.value = [];
  episodeAssets.value = [];
  episodes.value = await listEpisodes(props.projectId);
  // 项目设置：视频比例（控制分镜缩略图宽高比）+ 整片剧本（场文本来源）
  try {
    const res = await http.get("/projects");
    const proj = (res.data?.data ?? []).find((p: any) => p.id === props.projectId);
    if (proj?.videoRatio) projectRatio.value = String(proj.videoRatio);
    projectScript.value = proj?.scriptContent ?? "";
  } catch {
    projectRatio.value = "9:16";
  }
  sceneTextByIndex.value = parseSceneTexts(projectScript.value);
  // 加载「分析资产」持久化的集-资产映射（分场视频详情页按出现场显示本场资产）
  try {
    episodeAssets.value = await getEpisodeAssets(props.projectId);
  } catch {
    episodeAssets.value = [];
  }
  // 逐集加载资产（含未出图资产；/library?kind=asset 只返回已出图的不够）
  const allAssets: any[] = [];
  for (const ep of episodes.value) {
    try {
      const list = await listAssets(props.projectId, ep.id);
      allAssets.push(...list);
    } catch {
      // 忽略单集资产加载失败
    }
  }
  assets.value = allAssets;
  // 逐集加载分镜（含无图待生成的分镜；/library?kind=storyboard 只返回已出图的不够）
  for (const ep of episodes.value) {
    try {
      sbByEp.value[ep.id] = await listStoryboards(props.projectId, ep.id);
    } catch {
      sbByEp.value[ep.id] = [];
    }
    for (const s of sbByEp.value[ep.id]) {
      try {
        const clip = await getVideo(props.projectId, ep.id, s.id);
        if (clip?.filePath) videoMap.value[s.id] = clip.filePath;
      } catch {
        // 无视频
      }
    }
  }
  // 始终停留在「所有场卡片」列表，进入某场详情需点击对应场卡片（不随 initialEpisodeId 自动进入）
}

// tab 激活时重新加载（拆解分镜后切到「分场视频」能立即看到新分镜）
watch(
  () => props.tabActive,
  async (active) => {
    if (active) await load();
  },
);

/** 进入场详情 */
async function enterEpisode(epId: number) {
  selectedEpisodeId.value = epId;
  selectedSbId.value = null;
  view.value = "detail";
  sceneLvMap.value = {};
  await nextTick(updateCanScrollSb);
  if (storyboards.value.length > 0) {
    onSelectSb(storyboards.value[0]);
  }
  void loadSceneLongVideos();
}

function backToList() {
  view.value = "list";
  selectedEpisodeId.value = null;
  selectedSbId.value = null;
}

/** 拆解分镜：AI 将当前场剧本拆为分镜（每镜 ≤15s），覆盖本场旧分镜，随后自动生成分镜图与工作流 */
async function onSplit() {
  if (selectedEpisodeId.value == null) return;
  const epId = selectedEpisodeId.value;
  // 拆镜必须用「最新」剧本：整片剧本（Project.scriptContent）为权威源，按场号提取当前场文本
  const sceneIdx = episodes.value.find((e) => e.id === epId)?.index ?? 0;
  const script = cleanScriptText(sceneIdx ? (sceneTextByIndex.value[sceneIdx] ?? "") : "");
  if (!script.trim()) {
    ElMessage.warning("本场暂无剧本，请先在「剧本」页编写整片剧本");
    return;
  }
  const old = await listStoryboards(props.projectId, epId).catch(() => [] as any[]);
  try {
    await ElMessageBox.confirm(
      `将由 AI 按本场剧本拆解为分镜列表（每分镜 ≤15 秒，即 Minimax 一次视频任务），并覆盖本场已有 ${old.length} 个分镜。继续？`,
      "AI 拆解分镜",
      { type: "info", confirmButtonText: "开始拆解", cancelButtonText: "取消" },
    );
  } catch {
    return;
  }
  splitting.value = true;
  try {
    const { items, visualDict: vd } = await aiSplitStoryboardWithDict(script, props.projectId);
    if (!items?.length) throw new Error("AI 未返回分镜");
    visualDict.value = vd ?? null;
    dictExpanded.value = false;
    for (const sb of old) {
      await deleteStoryboard(props.projectId, epId, sb.id);
    }
    const base = Date.now();
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      await createStoryboard(props.projectId, epId, {
        flowId: `sb-${base}-${i}-${Math.floor(Math.random() * 1000)}`,
        index: it.index ?? i,
        sceneIndex: sceneIdx || (it.sceneIndex ?? 1),
        duration: Math.max(1, Math.min(it.duration || 5, 15)),
        prompt: it.prompt ?? "",
        videoDesc: it.videoDesc ?? "",
      });
    }
    ElMessage.success(`拆解完成：本场已生成 ${items.length} 个分镜，正在同步生成分镜图与工作流…`);
    // 刷新分镜数据（自动选中第一镜）
    await load();
    if (episodes.value.some((e) => e.id === epId)) {
      selectedEpisodeId.value = epId;
      await enterEpisode(epId);
    }
    // 后台：批量生成首帧图 + ComfyUI 工作流
    void batchGenerateStoryboardImages(props.projectId, epId).catch(() => {});
    void generateStoryboardWorkflows(props.projectId, epId).catch(() => {});
  } catch (e: any) {
    ElMessage.error(`拆解失败：${e?.response?.data?.message ?? e?.message}`);
  } finally {
    splitting.value = false;
  }
}

/** 删除本场全部分镜（含分镜图/视频记录，二次确认） */
async function onDeleteAllStoryboards() {
  const epId = selectedEpisodeId.value;
  if (epId == null) return;
  const list = sbByEp.value[epId] ?? [];
  if (!list.length) return;
  const n = list.length;
  try {
    await ElMessageBox.confirm(
      `将删除本场全部 ${n} 个分镜（含分镜图、视频记录，不可恢复）。确定？`,
      "删除本场全部分镜",
      { type: "warning", confirmButtonText: "删除", cancelButtonText: "取消" },
    );
  } catch {
    return;
  }
  try {
    for (const s of list) {
      await deleteStoryboard(props.projectId, epId, s.id);
    }
    sbByEp.value[epId] = [];
    videoMap.value = {};
    selectedSbId.value = null;
    wfPromptCache.value = {};
    ElMessage.success(`已删除本场全部 ${n} 个分镜`);
  } catch (e: any) {
    ElMessage.error(`删除失败：${e?.response?.data?.message ?? e?.message}`);
  }
}

// —— 长视频（按场：MiniMaxH3 Director 串联该场分镜）——

function lvStateTag(lv: any) {
  const s = lv?.state;
  return ({ SUCCEEDED: "success", RUNNING: "warning", FAILED: "danger" } as Record<string, any>)[s] ?? "info";
}
function lvStateText(lv: any) {
  const s = lv?.state;
  return ({ QUEUED: "排队中", RUNNING: "生成中", SUCCEEDED: "已完成", FAILED: "失败" } as Record<string, any>)[s] ?? s;
}
function segStateText(s: string) {
  return { QUEUED: "待生成", RUNNING: "生成中", SUCCEEDED: "已完成", FAILED: "失败" }[s] ?? s;
}

/** 当前场序号（详情页本场） */
const currentSceneIndex = computed(() => currentEpIndex.value || 1);

/** 加载本场长视频状态（MiniMaxH3 Director 串联本场分镜） */
async function loadSceneLongVideos() {
  if (selectedEpisodeId.value == null) return;
  const si = currentSceneIndex.value;
  try {
    const lv = await getLongVideo(props.projectId, selectedEpisodeId.value, si);
    if (lv) sceneLvMap.value[si] = lv;
  } catch {
    /* ignore */
  }
}

/** 触发本场视频生成（本场全部镜串联） */
async function onGenerateSceneVideo() {
  if (selectedEpisodeId.value == null) return;
  if (storyboards.value.length === 0) {
    ElMessage.warning("本场暂无分镜");
    return;
  }
  const si = currentSceneIndex.value;
  sceneLvLoading.value = si;
  try {
    await generateLongVideo(props.projectId, selectedEpisodeId.value, si);
    ElMessage.success(`第 ${si} 场视频开始生成（${storyboards.value.length} 段）`);
    await loadSceneLongVideos();
    startLvPolling();
  } catch (e: any) {
    ElMessage.error(`生成本场视频失败：${e?.response?.data?.message ?? e?.message}`);
  } finally {
    sceneLvLoading.value = null;
  }
}

/** 重跑本场的某一段 */
async function onRerunSceneSegment(idx: number) {
  if (selectedEpisodeId.value == null) return;
  lvRerunning.value = idx;
  try {
    await rerunLongVideoSegment(props.projectId, selectedEpisodeId.value, idx, currentSceneIndex.value);
    ElMessage.success(`正在重新生成第 ${idx + 1} 段（其余段复用缓存）`);
    await loadSceneLongVideos();
    startLvPolling();
  } catch (e: any) {
    ElMessage.error(`重跑失败：${e?.response?.data?.message ?? e?.message}`);
  } finally {
    lvRerunning.value = null;
  }
}

/** 轮询长视频状态（任一场景生成中时 8s 刷新） */
function startLvPolling() {
  if (lvPollTimer) clearInterval(lvPollTimer);
  lvPollTimer = setInterval(async () => {
    const anyRunning = Object.values(sceneLvMap.value).some((lv: any) => lv?.state === "RUNNING");
    if (anyRunning) {
      await loadSceneLongVideos();
    } else {
      if (lvPollTimer) clearInterval(lvPollTimer);
      lvPollTimer = null;
    }
  }, 8000);
}

function onSelectSb(s: any) {
  selectedSbId.value = s.id;
  wfEditing.value = false;
  wfDraft.value = "";
  wfAiVisible.value = false;
  wfAiInstruction.value = "";
  loadWorkflowPrompt(s);
}

/** 加载该分镜工作流将注入的提示词（H3 六段式）：有缓存直接取，否则后端生成 */
async function loadWorkflowPrompt(s: any) {
  if (!s || selectedEpisodeId.value == null) return;
  // videoDesc 已是 H3 六段式 → 直接展示（工作流注入的就是它）
  const desc = s.videoDesc || "";
  if (desc.includes("subject_definitions") || desc.includes("integrated_multimodal_description")) {
    wfPrompt.value = desc;
    return;
  }
  if (wfPromptCache.value[s.id]) {
    wfPrompt.value = wfPromptCache.value[s.id];
    return;
  }
  wfPromptLoading.value = true;
  wfPrompt.value = "";
  try {
    const { prompt } = await getStoryboardWorkflowPrompt(props.projectId, selectedEpisodeId.value, s.id);
    wfPromptCache.value[s.id] = prompt;
    wfPrompt.value = prompt;
  } catch {
    wfPrompt.value = "";
  } finally {
    wfPromptLoading.value = false;
  }
}

/** 复制工作流提示词 */
async function onCopyWorkflowPrompt() {
  if (!wfPrompt.value) return;
  try {
    await navigator.clipboard.writeText(wfPrompt.value);
    ElMessage.success("ComfyUI 提示词已复制");
  } catch {
    ElMessage.error("复制失败");
  }
}

/** 展示用格式化：在 "0-2秒 / 2-5秒 / 5秒" 等时长标记【前】换行——
 * 让 [Shot N] 与开头描述同一段、每个秒数与它对应的内容同一段（仅展示，不改原始数据） */
const wfPromptDisplay = computed(() => {
  const t = wfPrompt.value;
  if (!t) return "";
  return t.replace(/(\d+\s*[-—–~～至]\s*\d+\s*秒|\d+\s*秒)/g, "\n$1");
});

// ComfyUI 提示词编辑/保存
const wfEditing = ref(false);
const wfDraft = ref("");
const wfSaving = ref(false);

function startEditWf() {
  wfDraft.value = wfPrompt.value;
  wfEditing.value = true;
  wfAiVisible.value = false; // 进入手动编辑时隐藏 AI 输入框
}
function cancelEditWf() {
  wfEditing.value = false;
  wfDraft.value = "";
}
/** 保存编辑后的提示词：写入分镜 videoDesc（视频生成/工作流注入即使用它） */
async function saveEditWf() {
  const s = selectedSb.value;
  if (!s || selectedEpisodeId.value == null) return;
  const text = wfDraft.value.trim();
  if (!text) {
    ElMessage.warning("提示词不能为空");
    return;
  }
  wfSaving.value = true;
  try {
    const updated = await updateStoryboard(props.projectId, selectedEpisodeId.value, s.id, {
      videoDesc: text,
    });
    const epList = sbByEp.value[selectedEpisodeId.value] ?? [];
    const idx = epList.findIndex((x) => x.id === s.id);
    if (idx >= 0) epList[idx] = updated;
    delete wfPromptCache.value[s.id];
    void loadWorkflowPrompt(updated);
    wfEditing.value = false;
    wfDraft.value = "";
    ElMessage.success("ComfyUI 提示词已保存（视频生成将使用）");
  } catch (e: any) {
    ElMessage.error(`保存失败：${e?.response?.data?.message ?? e?.message}`);
  } finally {
    wfSaving.value = false;
  }
}

/** 相机规划注入：把相机描述追加到当前分镜 videoDesc（末尾换行追加，不覆盖原内容） */
async function onInjectCameraDesc(camText: string) {
  const s = selectedSb.value;
  if (!s || selectedEpisodeId.value == null) return;
  if (!camText?.trim()) {
    ElMessage.warning("相机描述为空");
    return;
  }
  const base = s.videoDesc || wfPrompt.value || "";
  // 若已含相机段则先去掉旧相机段，避免重复追加
  let cleaned = base;
  const camMarker = "相机：";
  const idx = cleaned.lastIndexOf("\n\n" + camMarker);
  if (idx >= 0) cleaned = cleaned.slice(0, idx);
  const sep = cleaned.trim() ? "\n\n" : "";
  const newText = cleaned + sep + camText.trim();
  try {
    const updated = await updateStoryboard(props.projectId, selectedEpisodeId.value, s.id, { videoDesc: newText });
    const epList = sbByEp.value[selectedEpisodeId.value] ?? [];
    const i = epList.findIndex((x) => x.id === s.id);
    if (i >= 0) epList[i] = updated;
    delete wfPromptCache.value[s.id];
    void loadWorkflowPrompt(updated);
    ElMessage.success("相机描述已注入 videoDesc（重新生成本段视频时生效）");
  } catch (e: any) {
    ElMessage.error(`注入失败：${e?.response?.data?.message ?? e?.message}`);
  }
}

// 视频生成提示词 AI 优化（展开输入框 → LLM 改写 → 直接替换 videoDesc 并保存）
const wfAiVisible = ref(false);
const wfAiInstruction = ref("");
const wfAiLoading = ref(false);

function toggleAiEditWf() {
  if (wfEditing.value) {
    ElMessage.warning("请先保存当前手动编辑的内容");
    return;
  }
  wfAiVisible.value = !wfAiVisible.value;
}

/** AI 优化视频生成提示词：直接替换分镜 videoDesc（H3 结构）并保存 */
async function onAiEditWf() {
  const s = selectedSb.value;
  if (!s || selectedEpisodeId.value == null) return;
  const instruction = wfAiInstruction.value.trim();
  if (!instruction) return;
  const src = wfPrompt.value || s.videoDesc || "";
  if (!src) {
    ElMessage.warning("当前无视频提示词可优化");
    return;
  }
  wfAiLoading.value = true;
  try {
    const newPrompt = await aiPromptEdit(src, instruction, "video", props.projectId);
    const updated = await updateStoryboard(props.projectId, selectedEpisodeId.value, s.id, { videoDesc: newPrompt });
    const epList = sbByEp.value[selectedEpisodeId.value] ?? [];
    const idx = epList.findIndex((x) => x.id === s.id);
    if (idx >= 0) epList[idx] = updated;
    delete wfPromptCache.value[s.id];
    void loadWorkflowPrompt(updated);
    ElMessage.success("视频生成提示词已优化并保存");
  } catch (e: any) {
    ElMessage.error(`AI 优化失败：${e?.response?.data?.message ?? e?.message}`);
  } finally {
    wfAiLoading.value = false;
    wfAiVisible.value = false;
    wfAiInstruction.value = "";
  }
}

/** 下载当前分镜的 ComfyUI r2v 工作流（含本镜资产参考图 + 提示词） */
async function onDownloadWorkflow() {
  const s = selectedSb.value;
  if (!s || selectedEpisodeId.value == null) return;
  wfDownloading.value = true;
  try {
    const res = await http.get(
      `/projects/${props.projectId}/episodes/${selectedEpisodeId.value}/storyboards/${s.id}/workflow`,
      { responseType: "blob", timeout: 30000 },
    );
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `storyboard-${s.index}-r2v.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    ElMessage.success("工作流已下载（含本镜资产参考图，可导入 ComfyUI）");
  } catch (e: any) {
    ElMessage.error(`下载失败：${e?.response?.data?.message ?? e?.message}`);
  } finally {
    wfDownloading.value = false;
  }
}

/** 立即生成当前分镜视频（r2v 模式：依赖角色/场景/道具参考图，不依赖首帧） */
async function onGenerateVideo() {
  const s = selectedSb.value;
  if (!s || selectedEpisodeId.value == null) return;
  generating.value = true;
  try {
    await generateVideo(props.projectId, selectedEpisodeId.value, s.id);
    ElMessage.info("视频生成中（约几分钟）…");
    const timer = setInterval(async () => {
      try {
        const clip = await getVideo(props.projectId, selectedEpisodeId.value!, s.id);
        if (clip?.filePath) {
          videoMap.value[s.id] = clip.filePath;
          clearInterval(timer);
          generating.value = false;
          ElMessage.success("视频已生成");
        }
      } catch {
        clearInterval(timer);
        generating.value = false;
      }
    }, 5000);
  } catch (e: any) {
    ElMessage.error(`生成失败：${e?.response?.data?.message ?? e?.message}`);
    generating.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.video-workspace {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

/* ─── 第一级：集列表 ─── */
.list-head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 14px; }
.list-head h3 { color: #2b2f36; margin: 0; font-size: 16px; }
.list-hint { color: #8a919c; font-size: 12px; }
.episodes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
}
.ep-card {
  background: #ffffff;
  border: 1px solid #e4e6eb;
  border-radius: 10px;
  padding: 16px;
  cursor: pointer;
  transition: border-color 0.2s, transform 0.15s;
}
.ep-card:hover { border-color: #c98a2d; transform: translateY(-2px); }
.ep-title { color: #2b2f36; font-size: 15px; font-weight: 600; margin-bottom: 8px; }
.ep-stats { display: flex; gap: 14px; margin-bottom: 8px; }
.stat { color: #6b7380; font-size: 12px; }
.stat b { color: #c98a2d; font-size: 15px; }
.ep-summary {
  color: #8a919c;
  font-size: 12px;
  line-height: 1.6;
  min-height: 36px;
  margin-bottom: 8px;
}
.ep-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #6b7380;
  font-size: 12px;
}
.ep-duration { color: #c98a2d; font-weight: 600; }
.ep-enter { color: #6b7380; }

/* ─── 第二级：场详情 ─── */
.detail-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}
.detail-title { color: #2b2f36; font-size: 15px; font-weight: 600; }
.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
}
/* 中部行：左资产 + 右详情（分镜条之下，占满剩余高度） */
.content-row { flex: 1; display: flex; gap: 12px; min-height: 0; }
.asset-panel {
  width: 284px;
  background: #f8f9fb;
  border: 1px solid #e4e6eb;
  border-radius: 8px;
  padding: 10px;
  overflow-y: auto;
  flex-shrink: 0;
}
.panel-title { color: #6b7380; font-size: 12px; font-weight: 600; }
.panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.scope-toggle { flex-shrink: 0; }
.asset-toolbar { margin-bottom: 10px; }
.asset-search { margin-bottom: 8px; }
.search-icon { font-size: 12px; }
.asset-filter { display: flex; gap: 6px; }
.filter-chip {
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
  color: #6b7380;
  background: #f0f0e0;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s, color 0.15s;
}
.filter-chip:hover { border-color: #c98a2d; color: #c98a2d; }
.filter-chip.on { background: #c98a2d; color: #ffffff; }
.asset-group { margin-bottom: 16px; }
.group-label { color: #6b7380; font-size: 12px; font-weight: 600; margin-bottom: 8px; }
.group-count { color: #a8b0ba; font-weight: 400; margin-left: 4px; }
/* 卡片网格：图在上、文字在下（2 列，放大展示） */
.asset-cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.asset-card {
  background: #ffffff;
  border: 1px solid #e4e6eb;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;
}
.asset-card:hover {
  border-color: #c98a2d;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(60, 70, 90, 0.08);
}
.asset-card-img { width: 100%; aspect-ratio: 3 / 4; background: #f5f3ed; }
.asset-img { width: 100%; height: 100%; object-fit: cover; object-position: center; display: block; }
.placeholder-img {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7380;
  font-size: 22px;
}
.thumb-char { color: #6b7380; }
.asset-card-body {
  padding: 6px 8px 8px;
  border-top: 1px solid #eef0f4;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}
.asset-name {
  color: #2b2f36;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.35;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-all;
  width: 100%;
}
.asset-desc {
  color: #8a919c;
  font-size: 11px;
  line-height: 1.4;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-all;
  width: 100%;
}
.asset-state { transform: scale(0.85); transform-origin: left center; margin-top: 2px; }
.no-asset { color: #8a919c; font-size: 12px; text-align: center; margin-top: 30px; line-height: 1.8; }
.no-asset .hint { font-size: 11px; }
.right-area { flex: 1; display: flex; flex-direction: column; min-width: 0; gap: 10px; }
.detail-area { flex: 1; display: flex; gap: 10px; min-height: 0; }
.desc-panel {
  flex: 5;
  background: #f8f9fb;
  border: 1px solid #e4e6eb;
  border-radius: 8px;
  padding: 12px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
/* 两段高度：分镜详细描述 1/4 · 合并栏（ComfyUI 提示词 | 视频）2/4 */
.desc-section { min-height: 0; overflow-y: auto; }
.desc-info { flex: 0 0 auto; }
.desc-merged { flex: 1; display: flex; gap: 10px; min-height: 0; overflow: hidden; }
/* 合并栏左半：ComfyUI 提示词（提示词正文填满并内部滚动） */
.merged-wf { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.merged-wf .wf-prompt-box { margin-top: 0; flex: 1; display: flex; flex-direction: column; min-height: 0; }
.merged-wf .wf-prompt-head { flex-shrink: 0; }
.merged-wf .wf-prompt { flex: 1; max-height: none; }
/* 底部操作（栏目中间下部居中）：复制 / 编辑 / 保存 */
.wf-prompt-foot {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #eef0f4;
}
/* 编辑态：textarea 填满并内部滚动 */
.wf-edit-input { flex: 1; min-height: 0; }
.wf-edit-input :deep(.el-textarea) { height: 100%; }
.wf-edit-input :deep(.el-textarea__inner) {
  height: 100% !important;
  overflow-y: auto;
  resize: none;
  font-family: inherit;
  font-size: 12px;
  line-height: 1.7;
  color: #2f5f9e;
}
/* 合并栏右半：视频生成提示词（外框与 ComfyUI 提示词一致：白底 + 细边框 + 圆角） */
.merged-ffprompt {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #e4e6eb;
  border-radius: 8px;
  background: #ffffff;
  padding: 8px 10px;
}
/* ③ 视频栏（白底边框圆角；宽度恢复 flex 1，与提示词栏对半。相机规划打开时占据整个视频栏） */
.merged-video {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #e4e6eb;
  border-radius: 8px;
  background: #ffffff;
  padding: 8px 10px;
}
/* 相机规划占据整个右侧区域：标题行 + 组件主体 */
.cam-full-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  margin-bottom: 6px;
}
.cam-full-title { color: #2b2f36; font-size: 12px; font-weight: 600; }
.cam-full-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin-top: 0;
}
.cam-full-body :deep(.cam-planner) {
  flex: 1;
  min-height: 0;
  margin-top: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.cam-full-body :deep(.cam-body) { flex: 1; min-height: 0; overflow: auto; }
.cam-full-body :deep(.cam-compiled) { flex-shrink: 0; }
.merged-ffprompt .wf-prompt-box { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.merged-ffprompt .wf-prompt-head { flex-shrink: 0; }
.merged-ffprompt .wf-prompt { flex: 1; max-height: none; }
.aside-wf {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #e4e6eb;
}
.aside-wf .wf-prompt { flex: 1; max-height: none; }
.sb-desc { color: #4a5058; font-size: 13px; line-height: 1.8; white-space: pre-wrap; font-family: inherit; margin: 0; }
.video-panel { flex: 1; background: #f8f9fb; border: 1px solid #e4e6eb; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; min-width: 0; overflow: hidden; }
.video-top { flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
.sb-video { width: 100%; border-radius: 6px; background: #000; }
.no-video { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; text-align: center; }
.video-bottom {
  flex-shrink: 0;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #e4e6eb;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
}
.no-video .hint { color: #8a919c; font-size: 11px; }
.detail-placeholder { flex: 1; display: flex; align-items: center; justify-content: center; color: #8a919c; font-size: 13px; border: 1px dashed #e4e6eb; border-radius: 8px; }
.storyboards-row {
  position: sticky;
  bottom: 0;
  z-index: 5;
  flex-shrink: 0;
  min-width: 0;
  background: #f5f3ed;
  padding-top: 6px;
  box-shadow: 0 -2px 6px rgba(0, 0, 0, 0.04);
}
.row-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.row-label { color: #6b7380; font-size: 12px; }
/* 视觉词典（拆镜附带） */
.visual-dict {
  margin-bottom: 8px;
  border: 1px solid #e4e6eb;
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
}
.vd-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  cursor: pointer;
  color: #2b2f36;
  font-size: 13px;
  font-weight: 600;
  user-select: none;
}
.vd-body { display: flex; flex-wrap: wrap; gap: 10px 18px; padding: 4px 12px 10px; }
.vd-group { min-width: 220px; flex: 1 1 240px; }
.vd-group-title { font-size: 12px; color: #8a6d3b; font-weight: 600; margin-bottom: 4px; }
.vd-item { font-size: 12px; color: #3a3f47; line-height: 1.5; display: block; }
.vd-item b { color: #2b2f36; margin-right: 6px; }
.vd-sub { display: block; color: #6b7380; font-size: 11px; }
/* 未拆解：拆解分镜入口卡片 */
.split-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 22px 16px;
  background: #ffffff;
  border: 1px solid #e4e6eb;
  border-radius: 10px;
  text-align: center;
}
.split-title { color: #2b2f36; font-size: 15px; font-weight: 600; }
.split-desc { color: #8a919c; font-size: 12px; line-height: 1.7; max-width: 560px; }
.split-warn { color: #d65f5f; font-size: 12px; }
/* 整集长视频（Director 串联）——已改为按场分组 */
.detail-actions { margin-left: auto; }
/* 本场分镜条（无场次 tab，直接显示本场全部镜） */
.scene-pane { background: #fdfbf7; border: 1px solid #e8e2d2; border-radius: 8px; padding: 8px 10px; }
.scene-pane-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}
.scene-count { color: #8a919c; font-size: 11px; }
.scene-lv-tag { flex-shrink: 0; }
.scene-actions { margin-left: auto; }
.lv-error { color: #d65f5f; font-size: 12px; margin-top: 6px; }
.lv-hint { color: #8a919c; font-size: 12px; margin-top: 8px; line-height: 1.7; }
/* 分镜卡片横向滚动（分镜多时可左右滑动/点箭头） */
.sb-scroll-wrap { display: flex; align-items: center; gap: 4px; }
.sb-scroll {
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 4px;
}
.sb-scroll::-webkit-scrollbar { height: 6px; }
.sb-scroll::-webkit-scrollbar-thumb { background: #3a4550; border-radius: 3px; }
.sb-scroll::-webkit-scrollbar-thumb:hover { background: #4d5a66; }
.sb-nav { color: #6b7380; flex-shrink: 0; }
.sb-cards { display: flex; flex-wrap: nowrap; gap: 10px; min-width: max-content; }
.sb-card { width: 110px; flex-shrink: 0; background: #ffffff; border: 2px solid #e4e6eb; border-radius: 8px; overflow: hidden; cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s; }
.sb-card-wide { width: 170px; }
.sb-card:hover { border-color: #6b7380; }
.sb-card.active {
  border-color: #c98a2d;
  box-shadow: 0 0 0 3px rgba(201, 138, 45, 0.35);
}
.sb-card.active .sb-index { color: #c98a2d; font-weight: 700; }
/* 选中角标：右下角橙色圆形 ✓ */
.sb-check {
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #c98a2d;
  color: #ffffff;
  font-size: 12px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  pointer-events: none;
}
.sb-thumbwrap { position: relative; }
.sb-thumb { width: 100%; object-fit: cover; display: block; }
.sb-noimg { display: flex; align-items: center; justify-content: center; color: #8a919c; font-size: 12px; background: #f8f9fb; }
.sb-play {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  padding-left: 3px;
  cursor: pointer;
  transition: background 0.15s, transform 0.15s;
}
.sb-play:hover { background: #c98a2d; transform: scale(1.08); }
.sb-foot { display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; }
.sb-index { color: #d5dbe3; font-size: 12px; }
.sb-dur { color: #c98a2d; font-size: 12px; margin-left: 6px; }
.sb-dur-line { color: #c98a2d; font-size: 12px; margin-top: 8px; }
/* 分镜信息行：第X集 第X镜 时长 */
.sb-info-line {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 2px 0;
}
.sb-info-item { display: inline-flex; align-items: baseline; gap: 6px; }
.sb-info-item b { color: #2b2f36; font-size: 14px; }
.sb-info-item em { color: #8a919c; font-size: 11px; font-style: normal; }
.desc-actions { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.h3-result {
  margin-top: 10px;
  border: 1px solid #2f5d3a;
  border-radius: 8px;
  background: #ffffff;
  padding: 8px 10px;
}
.h3-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.h3-actions { display: flex; align-items: center; gap: 4px; }
.h3-prompt {
  color: #2f7a4f;
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
  font-family: inherit;
  margin: 0;
  max-height: 260px;
  overflow-y: auto;
}
.h3-zh { color: #3d6b52; font-size: 12px; margin-top: 6px; line-height: 1.6; }
.wf-prompt-box {
  margin-top: 10px;
  border: 1px solid #e4e6eb;
  border-radius: 8px;
  background: #ffffff;
  padding: 8px 10px;
}
.wf-prompt-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.wf-prompt-actions { display: flex; align-items: center; gap: 4px; }
.wf-prompt {
  color: #2f5f9e;
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
  font-family: inherit;
  margin: 0;
  max-height: 260px;
  overflow-y: auto;
}
.wf-prompt-empty { color: #8a919c; font-size: 12px; line-height: 1.7; }
/* AI 优化提示词：栏内展开输入框 */
.ai-prompt-bar {
  flex-shrink: 0;
  border-top: 1px solid #eef0f4;
  margin-top: 8px;
  padding-top: 8px;
}
.ai-prompt-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.ai-prompt-bar :deep(.el-textarea__inner) {
  font-family: inherit;
  font-size: 12px;
  line-height: 1.7;
}
/* 视频栏（右半）头部 */
.firstframe-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-shrink: 0; }
.firstframe-hint { color: #8a919c; font-size: 11px; }
</style>
