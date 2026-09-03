<template>
  <div class="page hub">
    <div class="page-head">
      <div>
        <h2 class="page-title">我的项目</h2>
        <div class="page-sub">短剧全流程 AI 生产工作台 · 从小说到成片</div>
      </div>
    </div>

    <!-- 项目卡片网格 -->
    <div class="project-grid">
      <div
        v-for="p in projects"
        :key="p.id"
        class="project-card"
        @click="openProject(p)"
      >
        <div class="card-glow"></div>
        <!-- 删除按钮：卡片右上角（垃圾桶图标） -->
        <el-button size="small" text class="card-del" @click.stop="onDelete(p)">
          <el-icon><Delete /></el-icon>
        </el-button>
        <div class="card-thumb">{{ p.name.slice(0, 1) }}</div>
        <div class="card-body">
          <div class="card-name">{{ p.name }}</div>
          <div class="card-time">创建于 {{ fmt(p.createdAt) }}</div>
        </div>
        <div class="card-stats">
          <div class="card-stat">
            <div class="card-num">{{ p.stats?.episodes ?? 0 }}</div>
            <div class="card-label">集</div>
          </div>
          <div class="card-stat">
            <div class="card-num">{{ p.stats?.assets ?? 0 }}</div>
            <div class="card-label">资产</div>
          </div>
          <div class="card-stat">
            <div class="card-num">{{ p.stats?.storyboards ?? 0 }}</div>
            <div class="card-label">分镜</div>
          </div>
          <div class="card-stat">
            <div class="card-num">{{ p.stats?.videos ?? 0 }}</div>
            <div class="card-label">视频</div>
          </div>
        </div>
        <div class="card-foot">
          <!-- 总时长：左下角 -->
          <span class="card-duration">⏱ {{ fmtDuration(p.stats?.durationSec ?? 0) }}</span>
          <!-- 进入生产工作台：右下角 -->
          <span class="card-enter">进入生产工作台 →</span>
        </div>
      </div>

      <div class="project-card create-card" @click="createVisible = true">
        <div class="create-plus">＋</div>
        <div class="create-text">新建项目</div>
      </div>
    </div>

    <div v-if="projects.length === 0" class="empty-hint">还没有项目，点击「新建项目」卡片开始</div>

    <!-- 新建项目 -->
    <el-dialog v-model="createVisible" title="新建项目" width="460px" append-to-body>
      <el-form label-width="90px" label-position="left">
        <el-form-item label="项目名称" required>
          <el-input
            v-model="newName"
            placeholder="如：铸剑 · 侯孝贤美学版"
            maxlength="60"
            @keyup.enter="onCreate"
          />
        </el-form-item>
        <el-form-item label="项目概述">
          <el-input
            v-model="newOverview"
            type="textarea"
            :rows="3"
            maxlength="500"
            placeholder="一句话说明项目（题材/风格/目标，可选）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="onCreate">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { Delete } from "@element-plus/icons-vue";
import { http } from "../api/client";
import { removeRecentProject } from "../utils/recentProjects";

const router = useRouter();
const projects = ref<any[]>([]);
const createVisible = ref(false);
const newName = ref("");
const newOverview = ref("");
const newRatio = ref("9:16");
const creating = ref(false);

function fmt(iso: string | undefined) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("zh-CN");
}

/** 秒 → "X 分 Y 秒" / "X 秒" */
function fmtDuration(sec: number) {
  const s = Number(sec) || 0;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m} 分 ${r} 秒` : `${r} 秒`;
}

async function load() {
  const res = await http.get("/projects");
  projects.value = res.data.data;
}

function openProject(p: any) {
  router.push(`/project/${p.id}`);
}

async function onCreate() {
  const name = newName.value.trim();
  if (!name) {
    ElMessage.warning("请输入项目名称");
    return;
  }
  creating.value = true;
  try {
    const res = await http.post("/projects", {
      name,
      overview: newOverview.value,
      videoRatio: newRatio.value,
    });
    createVisible.value = false;
    newName.value = "";
    newOverview.value = "";
    ElMessage.success("项目已创建（含场 1）");
    router.push(`/project/${res.data.data.id}`);
  } catch (e: any) {
    ElMessage.error(`创建失败：${e?.response?.data?.message ?? e?.message}`);
  } finally {
    creating.value = false;
  }
}

async function onDelete(p: any) {
  try {
    await ElMessageBox.confirm(`删除项目「${p.name}」？其画布/剧本/资产/分镜/视频将一并删除。`, "确认删除", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消",
    });
  } catch {
    return;
  }
  try {
    await http.delete(`/projects/${p.id}`);
    removeRecentProject(p.id);
    ElMessage.success("项目已删除");
    await load();
  } catch (e: any) {
    ElMessage.error(`删除失败：${e?.response?.data?.message ?? e?.message}`);
  }
}

onMounted(load);
</script>

<style scoped>
.hub {
  box-sizing: border-box;
}
/* 项目卡片网格 */
.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
  max-width: 1080px;
}
.project-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border: 1px solid #e4e6eb;
  border-radius: 12px;
  padding: 14px;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.2s, transform 0.15s, box-shadow 0.2s;
}
.project-card:hover {
  border-color: rgba(201, 138, 45, 0.45);
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(60, 70, 90, 0.1);
}
.card-glow {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(201, 138, 45, 0.7), transparent);
  opacity: 0;
  transition: opacity 0.25s;
}
.project-card:hover .card-glow { opacity: 1; }
.card-thumb {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: linear-gradient(135deg, #f0f2f5, #e6eaf0);
  color: #4a8fd8;
  font-size: 20px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  border: 1px solid #e4e6eb;
}
.card-body { flex: 1; min-width: 0; }
.card-name {
  color: #2b2f36;
  font-size: 15px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-time { color: #b0b6bf; font-size: 11px; margin-top: 3px; }
.card-stats {
  display: flex;
  gap: 6px;
  margin: 12px 0 10px;
}
.card-stat {
  flex: 1;
  text-align: center;
  background: #f8f9fb;
  border: 1px solid #eef0f4;
  border-radius: 8px;
  padding: 6px 2px;
}
.card-num { color: #c98a2d; font-size: 15px; font-weight: 700; }
.card-label { color: #9aa1ab; font-size: 10px; margin-top: 1px; }
.card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #b0b6bf;
  font-size: 11px;
}
/* 删除按钮：卡片右上角（垃圾桶图标，绝对定位不占布局） */
.card-del {
  position: absolute;
  top: 6px;
  right: 6px;
  color: #d65f5f;
  z-index: 2;
  padding: 4px;
}
/* 总时长：左下角 */
.card-duration { color: #c98a2d; font-weight: 600; }
/* 进入生产工作台：右下角 */
.card-enter { color: #6b7380; }
.create-card {
  align-items: center;
  justify-content: center;
  gap: 10px;
  border-style: dashed;
  min-height: 170px;
  color: #9aa1ab;
}
.create-card:hover {
  color: #c98a2d;
  border-color: rgba(201, 138, 45, 0.5);
}
.create-plus { font-size: 34px; }
.create-text { font-size: 13px; }
.empty-hint {
  margin-top: 40px;
  text-align: center;
  color: #b0b6bf;
  font-size: 13px;
}
</style>
