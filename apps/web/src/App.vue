<template>
  <div class="app-shell">
    <!-- 左侧可折叠边栏（所有页面共享） -->
    <aside class="app-sider" :class="{ collapsed }">
      <div class="sider-head">
        <div class="brand-wrap">
          <img class="brand-logo" :src="logoUrl" alt="九尾狐" />
          <div v-if="!collapsed" class="brand-text">
            <div class="brand">九尾狐</div>
            <div class="brand-sub">短剧 AI 生产工作台</div>
          </div>
        </div>
        <el-button text class="collapse-btn" @click="toggle">
          <el-icon :size="16"><Expand v-if="collapsed" /><Fold v-else /></el-icon>
        </el-button>
      </div>

      <nav class="sider-nav">
        <div v-if="!collapsed" class="group-label">工作台</div>
        <router-link to="/projects" class="nav-item" :title="'我的项目'">
          <el-icon :size="17"><HomeFilled /></el-icon>
          <span v-if="!collapsed" class="nav-text">我的项目</span>
        </router-link>

        <!-- 最近打开项目（有项目时显示缩略卡片，最多 3 张；项目列表为空则不显示） -->
        <div v-if="!collapsed && hasProjects && recentProjects.length" class="recent-box">
          <router-link
            v-for="p in recentProjects.slice(0, 3)"
            :key="p.id"
            :to="`/project/${p.id}`"
            class="recent-card"
            :title="p.name"
          >
            <div class="recent-thumb">
              <img v-if="p.thumb" :src="p.thumb" loading="lazy" />
              <span v-else class="recent-ph">{{ p.name.slice(0, 1) }}</span>
            </div>
            <span class="recent-name">{{ p.name }}</span>
          </router-link>
        </div>

        <!-- 配音演员（独立页面：音色特征/适合年龄/试听） -->
        <router-link to="/actor-voices" class="nav-item" :title="'配音演员'">
          <el-icon :size="17"><Microphone /></el-icon>
          <span v-if="!collapsed" class="nav-text">配音演员</span>
        </router-link>

        <!-- 技能三栏：外框，紧贴设置组上方 -->
        <div class="sider-group sider-group-skills">
          <router-link
            to="/skills?category=root"
            class="nav-item"
            active-class="custom-none"
            :class="{ 'router-link-active': isSkillsCat('root') }"
            :title="'总控（原根基）'"
          >
            <el-icon :size="17"><Odometer /></el-icon>
            <span v-if="!collapsed" class="nav-text">总控</span>
          </router-link>
          <router-link
            to="/skills?category=story"
            class="nav-item"
            active-class="custom-none"
            :class="{ 'router-link-active': isSkillsCat('story') }"
            :title="'导演手册（叙事）'"
          >
            <el-icon :size="17"><MagicStick /></el-icon>
            <span v-if="!collapsed" class="nav-text">导演手册</span>
          </router-link>
          <router-link
            to="/skills?category=art"
            class="nav-item"
            active-class="custom-none"
            :class="{ 'router-link-active': isSkillsCat('art') }"
            :title="'视觉手册（画风）'"
          >
            <el-icon :size="17"><Brush /></el-icon>
            <span v-if="!collapsed" class="nav-text">视觉手册</span>
          </router-link>
        </div>

        <!-- 设置三项：外框，侧边栏最下部 -->
        <div class="sider-group">
          <router-link
            to="/settings?section=provider"
            class="nav-item"
            active-class="custom-none"
            :class="{ 'router-link-active': isSection('provider') }"
            :title="'Provider 配置'"
          >
            <el-icon :size="17"><Setting /></el-icon>
            <span v-if="!collapsed" class="nav-text">Provider 配置</span>
          </router-link>
          <router-link
            to="/settings?section=workflow"
            class="nav-item"
            active-class="custom-none"
            :class="{ 'router-link-active': isSection('workflow') }"
            :title="'工作流映射'"
          >
            <el-icon :size="17"><Connection /></el-icon>
            <span v-if="!collapsed" class="nav-text">工作流映射</span>
          </router-link>
          <router-link
            to="/settings?section=theme"
            class="nav-item"
            active-class="custom-none"
            :class="{ 'router-link-active': isSection('theme') }"
            :title="'主题'"
          >
            <el-icon :size="17"><Brush /></el-icon>
            <span v-if="!collapsed" class="nav-text">主题</span>
          </router-link>
        </div>
      </nav>

      <div v-if="!collapsed" class="sider-foot">
        <span class="foot-ver">九尾狐 v0.7 · 短剧全流程</span>
      </div>
    </aside>

    <div class="app-main">
      <router-view />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { HomeFilled, MagicStick, Setting, Fold, Expand, Odometer, Brush, Connection, Microphone } from "@element-plus/icons-vue";
import logoUrl from "./assets/logo.png";
import { http } from "./api/client";
import { recentProjects, pruneRecentProjects } from "./utils/recentProjects";

const route = useRoute();
const collapsed = ref(localStorage.getItem("fox-sider-collapsed") === "1");
// 项目列表（判断是否为空 → 空则不显示最近卡片）
const hasProjects = ref(false);

/** 同步项目列表：项目为空则隐藏最近卡片，并清理失效的最近记录 */
async function syncProjects() {
  try {
    const res = await http.get("/projects");
    const list = (res.data?.data ?? []) as any[];
    hasProjects.value = list.length > 0;
    pruneRecentProjects(list.map((p) => p.id));
  } catch {
    hasProjects.value = false;
  }
}
onMounted(syncProjects);
watch(() => route.fullPath, syncProjects);

/** 技能中心三个入口：按 ?category= 判断当前激活项（router-link 默认忽略 query，需手动匹配） */
function isSkillsCat(c: string) {
  return route.path === "/skills" && route.query.category === c;
}

/** 设置三个子项：按 ?section= 判断当前激活项 */
function isSection(s: string) {
  return route.path === "/settings" && route.query.section === s;
}

function toggle() {
  collapsed.value = !collapsed.value;
  localStorage.setItem("fox-sider-collapsed", collapsed.value ? "1" : "0");
}
</script>

<style scoped>
.app-shell {
  height: 100vh;
  display: flex;
  background: #f5f3ed;
}
.app-sider {
  width: 200px;
  background: #fffdf9;
  border-right: 1px solid #e4e6eb;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: width 0.2s;
}
.app-sider.collapsed { width: 56px; }
.sider-head {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px 0 14px;
  border-bottom: 1px solid #eef0f4;
  flex-shrink: 0;
}
.collapsed .sider-head { justify-content: center; padding: 0; }
.brand-wrap { display: flex; align-items: center; gap: 10px; min-width: 0; }
.brand-logo {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
}
.brand-text { min-width: 0; }
.brand {
  font-weight: 700;
  color: #2b2f36;
  font-size: 15px;
  line-height: 1.2;
  white-space: nowrap;
}
.brand-sub {
  color: #9aa1ab;
  font-size: 10px;
  margin-top: 2px;
  white-space: nowrap;
}
.collapse-btn { color: #9aa1ab; padding: 4px; }
.collapse-btn:hover { color: #c98a2d; }
.sider-nav {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0 12px;
  display: flex;
  flex-direction: column;
}
/* 最近打开项目：我的项目下方缩略卡片（最多 3 张） */
.recent-box {
  margin: 2px 8px 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.recent-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px;
  background: #ffffff;
  border: 1px solid #e4e6eb;
  border-radius: 8px;
  text-decoration: none;
  transition: border-color 0.15s, transform 0.15s;
}
.recent-card:hover { border-color: #c98a2d; transform: translateY(-1px); }
.recent-thumb {
  width: 40px;
  height: 48px;
  border-radius: 4px;
  overflow: hidden;
  background: #f5f3ed;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.recent-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.recent-ph { color: #c98a2d; font-size: 16px; }
.recent-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #4a5058;
  font-size: 12px;
}
/* 分组外框：技能三栏 + 设置三项（技能组紧贴设置组上方，两者都贴底部） */
.sider-group {
  border: 1px solid #e4e6eb;
  border-radius: 10px;
  background: #ffffff;
  padding: 6px 4px;
  margin: 10px 8px;
  display: flex;
  flex-direction: column;
}
.sider-group-skills { margin-top: auto; }
.sider-group .nav-item { margin-left: 4px; margin-right: 4px; }
/* 收起侧边栏时去掉外框，只留图标 */
.collapsed .sider-group { border: none; background: transparent; padding: 0; margin: 4px 0; }
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 38px;
  margin: 2px 8px;
  padding: 0 12px;
  border-radius: 8px;
  color: #6b7380;
  text-decoration: none;
  font-size: 13px;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;
}
.collapsed .nav-item { justify-content: center; padding: 0; }
.nav-item:hover {
  background: #f5f3ed;
  color: #2b2f36;
}
.nav-item.router-link-active {
  background: #faf3e4;
  color: #c98a2d;
}
.sider-foot {
  padding: 10px 16px;
  border-top: 1px solid #eef0f4;
}
.foot-ver { color: #b0b6bf; font-size: 11px; }
.app-main { flex: 1; min-width: 0; overflow: hidden; }
</style>
