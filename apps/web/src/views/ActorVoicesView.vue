<template>
  <div class="actor-page">
    <header class="page-head">
      <h3>配音演员 <span class="head-sub">（共 {{ actors.length }} 位 · 音色文件来自 ActorVoice 目录）</span></h3>
      <el-button size="small" :loading="loading" @click="load">⟳ 重新扫描</el-button>
    </header>

    <!-- 筛选栏：性别 + 年龄段 -->
    <div class="filter-bar">
      <div class="filter-group">
        <span class="filter-label">性别</span>
        <span
          v-for="g in genderOptions"
          :key="g.value"
          class="filter-chip"
          :class="{ on: genderFilter === g.value }"
          @click="genderFilter = g.value"
        >{{ g.label }}</span>
      </div>
      <div class="filter-group">
        <span class="filter-label">年龄段</span>
        <span
          v-for="a in ageOptions"
          :key="a.value"
          class="filter-chip"
          :class="{ on: ageFilter === a.value }"
          @click="ageFilter = a.value"
        >{{ a.label }}</span>
      </div>
    </div>

    <div class="actor-grid">
      <div
        v-for="a in filteredActors"
        :key="a.name"
        class="actor-card"
        :class="{ playing: playingName === a.name }"
        @click="onPlay(a)"
      >
        <div class="actor-avatar">
          <span class="avatar-char">{{ a.name.slice(0, 1) }}</span>
          <span class="play-badge">{{ playingName === a.name ? "⏸" : "▶" }}</span>
        </div>
        <div class="actor-body">
          <div class="actor-name-row">
            <span class="actor-name">{{ a.name }}</span>
            <el-tag size="small" :type="a.gender === '女' ? 'danger' : 'primary'" class="actor-gender">{{ a.gender }}</el-tag>
          </div>
          <div class="actor-age">适合年龄：{{ a.ageRange }}</div>
          <div class="actor-features">
            <el-tag v-for="f in a.features" :key="f" size="small" type="warning" class="feature-tag">{{ f }}</el-tag>
          </div>
          <div class="actor-foot">
            <span class="actor-duration">⏱ {{ a.duration != null ? a.duration + "s" : "—" }}</span>
            <span class="actor-sr">{{ a.sampleRate ? a.sampleRate / 1000 + "kHz" : "" }}</span>
          </div>
        </div>
      </div>
    </div>
    <el-empty v-if="!filteredActors.length && !loading" :description="actors.length ? '当前筛选下暂无演员' : 'ActorVoice 目录暂无音色文件'" :image-size="60" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { http } from "../api/client";

interface ActorVoiceItem {
  name: string;
  file: string;
  url: string;
  gender: string;
  features: string[];
  ageRange: string;
  duration: number | null;
  sampleRate: number | null;
}

const actors = ref<ActorVoiceItem[]>([]);
const loading = ref(false);
const playingName = ref("");
let audio: HTMLAudioElement | null = null;

// 筛选：性别（全部/男/女）+ 年龄段（全部/青/中/老）
const genderFilter = ref("all");
const ageFilter = ref("all");
const genderOptions = [
  { label: "全部", value: "all" },
  { label: "男", value: "男" },
  { label: "女", value: "女" },
];
const ageOptions = [
  { label: "全部", value: "all" },
  { label: "青", value: "青" },
  { label: "中", value: "中" },
  { label: "老", value: "老" },
];

/** 从年龄区间推导年龄段（老 55+ / 中 30-55 / 青 <30）；解析失败按「中」 */
function ageBand(ageRange: string): "青" | "中" | "老" {
  const m = /(\d+)\s*[-—~～]\s*(\d+)/.exec(ageRange ?? "");
  if (!m) return "中";
  const lo = parseInt(m[1], 10);
  const hi = parseInt(m[2], 10);
  if (lo >= 55 || hi >= 65) return "老";
  if (lo < 30 && hi <= 35) return "青";
  return "中";
}

const filteredActors = computed(() =>
  actors.value.filter((a) => {
    if (genderFilter.value !== "all" && a.gender !== genderFilter.value) return false;
    if (ageFilter.value !== "all" && ageBand(a.ageRange) !== ageFilter.value) return false;
    return true;
  }),
);

async function load() {
  loading.value = true;
  try {
    const res = await http.get("/actor-voices");
    const next = res.data?.data ?? [];
    const added = next.filter((n) => !actors.value.some((o) => o.file === n.file)).length;
    actors.value = next;
    // 明确反馈：数量变化提示新增，未变化提示已是最新
    if (added > 0) {
      ElMessage.success(`已扫描 ${next.length} 位演员，新增 ${added} 位`);
    } else {
      ElMessage.success(`已扫描 ${next.length} 位演员（无新增）`);
    }
  } catch (e: any) {
    ElMessage.error(`扫描失败：${e?.response?.data?.message ?? e?.message}`);
  } finally {
    loading.value = false;
  }
}

function onPlay(a: ActorVoiceItem) {
  if (playingName.value === a.name) {
    audio?.pause();
    audio = null;
    playingName.value = "";
    return;
  }
  audio?.pause();
  audio = null;
  const el = new Audio(`http://localhost:3000${a.url}`);
  el.onended = () => {
    audio = null;
    playingName.value = "";
  };
  el.play().catch(() => {});
  audio = el;
  playingName.value = a.name;
}

onMounted(load);
onUnmounted(() => audio?.pause());
</script>

<style scoped>
.actor-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 16px 24px;
  box-sizing: border-box;
  overflow: hidden;
}
.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  flex-shrink: 0;
}
.page-head h3 { margin: 0; color: #2b2f36; font-size: 16px; }
.head-sub { color: #8a919c; font-size: 12px; font-weight: normal; margin-left: 8px; }
/* 筛选栏 */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 14px;
  flex-shrink: 0;
}
.filter-group { display: flex; align-items: center; gap: 8px; }
.filter-label { color: #6b7380; font-size: 12px; }
.filter-chip {
  padding: 3px 14px;
  border-radius: 14px;
  font-size: 12px;
  color: #6b7380;
  background: #f0f0e0;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s, color 0.15s;
  user-select: none;
}
.filter-chip:hover { border-color: #c98a2d; color: #c98a2d; }
.filter-chip.on { background: #c98a2d; color: #ffffff; }
.actor-grid {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
  align-content: start;
}
.actor-card {
  background: #ffffff;
  border: 1px solid #e4e6eb;
  border-radius: 10px;
  padding: 14px;
  cursor: pointer;
  display: flex;
  gap: 12px;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
}
.actor-card:hover { border-color: #c98a2d; transform: translateY(-2px); }
.actor-card.playing { border-color: #d65f5f; box-shadow: 0 0 0 1px #d65f5f; }
.actor-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #f5f3ed;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  flex-shrink: 0;
}
.avatar-char { font-size: 22px; font-weight: 700; color: #c98a2d; }
.play-badge {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #c98a2d;
  color: #fff;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #fff;
}
.actor-body { flex: 1; min-width: 0; }
.actor-name-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.actor-name { color: #2b2f36; font-size: 14px; font-weight: 600; }
.actor-gender { transform: scale(0.85); transform-origin: left center; }
.actor-age { color: #6b7380; font-size: 12px; margin-bottom: 6px; }
.actor-features { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; min-height: 22px; }
.feature-tag { transform: scale(0.85); transform-origin: left center; }
.actor-foot {
  display: flex;
  justify-content: space-between;
  color: #a8b0ba;
  font-size: 11px;
  border-top: 1px dashed #eceef2;
  padding-top: 6px;
}
</style>
