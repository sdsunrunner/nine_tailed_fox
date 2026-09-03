<template>
  <div class="page settings">
    <div class="page-head">
      <div>
        <h2 class="page-title">设置</h2>
        <div class="page-sub">Provider / 工作流映射 / 主题</div>
      </div>
    </div>
    <div class="settings-body">
      <!-- 内容区（section 由侧边栏 ?section= 驱动） -->
      <div class="settings-content">
        <!-- Provider -->
        <template v-if="activeMenu === 'provider'">
          <h3 class="group-title">Provider 配置</h3>
          <el-card shadow="never" class="set-card">
            <div class="set-card-head">
              <span>ComfyUI 状态</span>
              <el-tag :type="status.online ? 'success' : 'danger'" size="small">
                {{ status.online ? "在线" : "离线" }}
              </el-tag>
            </div>
            <div class="status-line" v-if="status.online">
              版本 {{ status.version }} ｜ {{ status.gpu }}
            </div>
            <div class="status-line" v-else>未检测到 ComfyUI（地址：{{ form.comfyuiUrl }}）</div>
          </el-card>
          <el-card shadow="never" class="set-card">
            <template #header>连接配置</template>
            <el-form label-width="130px" label-position="left">
              <el-form-item label="ComfyUI 地址">
                <el-input v-model="form.comfyuiUrl" placeholder="http://127.0.0.1:8188" />
              </el-form-item>
              <el-form-item label="OSS 素材目录">
                <el-input v-model="form.ossDir" placeholder="生成素材落盘目录" />
              </el-form-item>
              <el-form-item label="DeepSeek Key">
                <el-input
                  v-model="form.deepseekKey"
                  type="password"
                  show-password
                  placeholder="sk-...（AI 拆镜用，保存即生效）"
                />
              </el-form-item>
            </el-form>
          </el-card>
        </template>

        <!-- 工作流 -->
        <template v-else-if="activeMenu === 'workflow'">
          <h3 class="group-title">工作流映射</h3>
          <el-card shadow="never" class="set-card">
            <template #header>
              生成工作流
              <span class="head-hint">（保存后立即热生效，无需重启）</span>
            </template>
            <el-form label-width="130px" label-position="left">
              <el-form-item v-for="w in workflowKeys" :key="w" :label="workflowLabels[w]">
                <el-input v-model="form.workflows[w].path" placeholder="工作流 JSON 绝对路径" />
                <div class="field-hint" v-if="workflowSizes[w]">注入尺寸：{{ workflowSizes[w] }}</div>
              </el-form-item>
              <el-form-item label="视频工作流">
                <el-select v-model="form.videoWorkflowPath" filterable size="small" style="width: 100%">
                  <el-option v-for="o in videoWfOptions" :key="o.path" :label="o.label" :value="o.path" />
                </el-select>
                <el-input v-model="form.videoWorkflowPath" size="small" class="mt-input" placeholder="或手动输入工作流 JSON 绝对路径" />
                <div class="field-hint">预设：⚔ 武打戏特化（H3 武打 lora + 多图参考）/ ① i2v 云端版（默认）/ ③ r2v 多参考；选预设或手动输入，保存后立即热生效</div>
              </el-form-item>
            </el-form>
          </el-card>
        </template>

        <!-- 主题 -->
        <template v-else>
          <h3 class="group-title">主题</h3>
          <el-card shadow="never" class="set-card">
            <template #header>界面主题（对齐 Toonflow 主题设置）</template>
            <el-form label-width="130px" label-position="left">
              <el-form-item label="主题模式">
                <el-radio-group v-model="themeMode" @change="applyTheme">
                  <el-radio-button label="dark">深色（影视工作台）</el-radio-button>
                  <el-radio-button label="light">亮色</el-radio-button>
                </el-radio-group>
              </el-form-item>
              <el-form-item label="主色调">
                <el-color-picker v-model="themeColor" @change="applyTheme" />
                <span class="field-hint" style="margin-left: 10px">当前：{{ themeColor }}</span>
              </el-form-item>
            </el-form>
          </el-card>
        </template>

        <div class="save-bar">
          <el-button type="primary" :loading="saving" @click="onSave">保存设置</el-button>
          <span class="save-hint">保存后立即生效（主题即时应用）</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { ElMessage } from "element-plus";
import { http } from "../api/client";

const route = useRoute();
// section 由侧边栏三个子项（?section=provider|workflow|theme）驱动
const activeMenu = ref<string>((route.query.section as string) || "provider");
watch(
  () => route.query.section,
  (s) => {
    if (s) activeMenu.value = s as string;
  },
);
const workflowKeys = ["character", "scene", "prop", "storyboard"] as const;
const workflowLabels: Record<string, string> = {
  character: "角色工作流",
  scene: "场景工作流",
  prop: "道具工作流",
  storyboard: "分镜工作流",
};
const workflowSizes: Record<string, string> = {
  scene: "1216×704",
  prop: "1024×1024",
  storyboard: "720×1280",
};
// 视频生成工作流预设（武打戏特化 / 默认 i2v 云端版 / r2v 多参考）；当前自定义路径自动追加
const videoWfOptions = computed(() => {
  const base = [
    { label: "⚔ 武打戏特化（H3 武打 lora + 多图参考）", path: "E:\\AIMovie\\AIMovieWorkSpace\\九尾狐_ComfyUI工作流\\H3_武打戏特化视频.json" },
    { label: "① i2v 云端版（默认）", path: "E:\\AIMovie\\AIMovieWorkSpace\\九尾狐_ComfyUI工作流\\①_i2v图生视频_云端版.json" },
    { label: "③ r2v 多参考图 480p 8步", path: "E:\\AIMovie\\AIMovieWorkSpace\\九尾狐_ComfyUI工作流\\③_r2v多参考图_480p8步.json" },
  ];
  const cur = form.videoWorkflowPath;
  if (cur && !base.some((o) => o.path === cur)) {
    base.push({ label: `自定义 · ${String(cur).split(/[\\/]/).pop() || "工作流"}`, path: cur });
  }
  return base;
});

const form = reactive({
  comfyuiUrl: "",
  ossDir: "",
  deepseekKey: "",
  workflows: {
    character: { path: "" },
    scene: { path: "" },
    prop: { path: "" },
    storyboard: { path: "" },
  },
  videoWorkflowPath: "",
});

const status = ref<any>({ online: false });
const saving = ref(false);

// 主题（localStorage 即时应用，不强制存 DB）
const themeMode = ref(localStorage.getItem("fox-theme-mode") || "dark");
const themeColor = ref(localStorage.getItem("fox-theme-color") || "#c98a2d");

function applyTheme() {
  const root = document.documentElement;
  root.classList.toggle("dark", themeMode.value === "dark");
  root.classList.toggle("light", themeMode.value === "light");
  root.style.setProperty("--el-color-primary", themeColor.value);
  localStorage.setItem("fox-theme-mode", themeMode.value);
  localStorage.setItem("fox-theme-color", themeColor.value);
}

async function load() {
  const s = (await http.get("/settings")).data.data;
  form.comfyuiUrl = s.comfyuiUrl;
  form.ossDir = s.ossDir;
  form.deepseekKey = s.deepseekKey ?? "";
  for (const k of workflowKeys) {
    form.workflows[k].path = s.workflows[k]?.path ?? "";
  }
  form.videoWorkflowPath = s.videoWorkflowPath;
  status.value = (await http.get("/settings/comfyui-status")).data.data;
  applyTheme();
}

async function onSave() {
  saving.value = true;
  try {
    await http.put("/settings", { ...form });
    ElMessage.success("已保存并热生效");
    status.value = (await http.get("/settings/comfyui-status")).data.data;
  } catch (e: any) {
    ElMessage.error(`保存失败：${e?.response?.data?.message ?? e?.message}`);
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.settings {
  box-sizing: border-box;
  height: 100%;
  overflow-y: auto;
}
.settings-body {
  max-width: 1000px;
}
.settings-content { flex: 1; min-width: 0; }
.group-title { color: #2b2f36; font-size: 15px; margin: 0 0 12px; }
.set-card { margin-bottom: 16px; background: #ffffff; border-color: #e4e6eb; }
.set-card-head { display: flex; align-items: center; justify-content: space-between; }
.status-line { color: #6b7380; font-size: 13px; margin-top: 6px; }
.head-hint { color: #8a919c; font-size: 12px; margin-left: 8px; }
.field-hint { color: #8a919c; font-size: 11px; margin-top: 4px; }
.mt-input { margin-top: 6px; }
.save-bar { margin-top: 8px; display: flex; align-items: center; gap: 10px; }
.save-hint { color: #8a919c; font-size: 12px; }
</style>
