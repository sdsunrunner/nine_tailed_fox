// 最近打开项目：localStorage 持久化 + 跨组件响应式（侧边栏显示，最多 3 条）
import { reactive } from "vue";

export interface RecentProject {
  id: number;
  name: string;
  ts: number;
  /** 项目首图（oss 相对路径），侧边栏缩略卡片用 */
  thumb?: string;
}

const KEY = "fox-recent-projects";
const MAX = 5; // 存储上限（展示只取前 3）

function load(): RecentProject[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

function persist() {
  localStorage.setItem(KEY, JSON.stringify(recentProjects.slice(0, MAX)));
}

export const recentProjects = reactive<RecentProject[]>(load());

/** 按有效项目 id 列表清理失效记录（项目删除/不存在时同步移除） */
export function pruneRecentProjects(validIds: number[]) {
  const valid = new Set(validIds);
  const before = recentProjects.length;
  for (let i = recentProjects.length - 1; i >= 0; i--) {
    if (!valid.has(recentProjects[i].id)) recentProjects.splice(i, 1);
  }
  if (recentProjects.length !== before) persist();
}

/** 项目删除时移除最近记录（侧边栏缩略卡片同步消失） */
export function removeRecentProject(id: number) {
  const idx = recentProjects.findIndex((p) => p.id === id);
  if (idx >= 0) {
    recentProjects.splice(idx, 1);
    persist();
  }
}

/** 打开项目工作台时记录（去重置顶，可带项目首图） */
export function recordRecentProject(id: number, name: string, thumb?: string) {
  const idx = recentProjects.findIndex((p) => p.id === id);
  const prev = idx >= 0 ? recentProjects[idx] : null;
  recentProjects.unshift({ id, name, ts: Date.now(), thumb: thumb ?? prev?.thumb });
  if (idx >= 0) recentProjects.splice(idx + 1, 1);
  if (recentProjects.length > MAX) recentProjects.splice(MAX);
  persist();
}
