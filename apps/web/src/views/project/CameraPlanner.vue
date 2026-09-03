<template>
  <div class="cam-planner">
    <!-- 顶部：标题 + 操作 -->
    <div class="cam-head">
      <span class="cam-title">🎥 镜头与机位规划（参考 H3 Prompt Composer）</span>
      <div class="cam-actions">
        <el-button size="small" text @click="reset">重置</el-button>
        <el-button size="small" type="warning" plain :disabled="!compiledText" @click="$emit('inject', compiledText)">
          注入提示词
        </el-button>
      </div>
    </div>

    <div class="cam-body">
      <!-- 左：俯视可视化 -->
      <div class="cam-visual">
        <svg :viewBox="viewBox" class="cam-svg" @mousedown="onSvgDown" @mousemove="onSvgMove" @mouseup="onSvgUp" @mouseleave="onSvgUp">
          <!-- 网格 -->
          <g class="cam-grid">
            <line v-for="gx in gridX" :key="'gx'+gx" :x1="gx" y1="-6" :x2="gx" y2="6" />
            <line v-for="gz in gridZ" :key="'gz'+gz" x1="-6" :y1="gz" x2="6" :y2="gz" />
          </g>
          <!-- 中轴线（朝向主体） -->
          <line x1="0" y1="-5.5" x2="0" y2="5.5" class="cam-axis" />
          <!-- 主体（角色）位置 -->
          <g class="cam-subject" :transform="subjectTransform">
            <circle r="0.38" />
            <text y="-0.55" text-anchor="middle">主</text>
          </g>
          <!-- 相机路径（折线） -->
          <polyline v-if="pathPoints.length > 1" :points="pathPointsStr" class="cam-path" />
          <!-- 相机机位关键帧 -->
          <g v-for="(k, i) in keyframes" :key="i" class="cam-pos" :transform="posTransform(k)" :class="{ active: i === activeKf }" @mousedown.stop="onKfDown($event, i)">
            <path d="M -0.45 -0.3 L 0.45 -0.3 L 0.3 0.35 L -0.3 0.35 Z" class="cam-icon" />
            <text y="-0.65" text-anchor="middle" class="cam-kf-label">C{{ i + 1 }}</text>
          </g>
          <!-- 视角锥 -->
          <g v-for="(k, i) in keyframes" :key="'fov'+i" class="cam-fov">
            <polygon :points="fovPoints(k)" />
          </g>
          <!-- 拖拽提示 -->
          <text x="0" y="5.9" text-anchor="middle" class="cam-hint">拖动相机图标改机位；主体固定在中心</text>
        </svg>
      </div>

      <!-- 右：参数面板 -->
      <div class="cam-params">
        <div class="cam-field">
          <label>景别（Framing）</label>
          <el-select v-model="framing" size="small" class="w-full">
            <el-option v-for="o in ENUMS.framings" :key="o[0]" :label="o[1]" :value="o[0]" />
          </el-select>
        </div>
        <div class="cam-field">
          <label>机位角度（Angle）</label>
          <el-select v-model="angle" size="small" class="w-full">
            <el-option v-for="o in ENUMS.angles" :key="o[0]" :label="o[1]" :value="o[0]" />
          </el-select>
        </div>
        <div class="cam-field">
          <label>视点方位（Viewpoint）</label>
          <el-select v-model="viewpoint" size="small" class="w-full">
            <el-option v-for="o in ENUMS.viewpoints" :key="o[0]" :label="o[1]" :value="o[0]" />
          </el-select>
        </div>
        <div class="cam-field">
          <label>构图（Composition）</label>
          <el-select v-model="composition" size="small" class="w-full">
            <el-option v-for="o in ENUMS.compositions" :key="o[0]" :label="o[1]" :value="o[0]" />
          </el-select>
        </div>
        <div class="cam-field">
          <label>镜头（Lens）</label>
          <el-select v-model="lens" size="small" class="w-full">
            <el-option v-for="o in ENUMS.lenses" :key="o[0]" :label="o[1]" :value="o[0]" />
          </el-select>
        </div>
        <div class="cam-field">
          <label>景深（DoF）</label>
          <el-select v-model="dof" size="small" class="w-full">
            <el-option v-for="o in ENUMS.dofs" :key="o[0]" :label="o[1]" :value="o[0]" />
          </el-select>
        </div>
        <div class="cam-field">
          <label>运动（Movement）</label>
          <el-select v-model="moveType" size="small" class="w-full">
            <el-option v-for="o in ENUMS.moves" :key="o[0]" :label="o[1]" :value="o[0]" />
          </el-select>
        </div>
        <div class="cam-field">
          <label>运动幅度 / 速度</label>
          <div class="cam-row">
            <el-select v-model="amp" size="small" style="flex:1">
              <el-option v-for="o in ENUMS.amps" :key="o[0]" :label="o[1]" :value="o[0]" />
            </el-select>
            <el-select v-model="spd" size="small" style="flex:1">
              <el-option v-for="o in ENUMS.spds" :key="o[0]" :label="o[1]" :value="o[0]" />
            </el-select>
          </div>
        </div>
        <div class="cam-field">
          <label>机位高度（Elevation）</label>
          <div class="cam-row">
            <el-select v-model="elevation" size="small" style="flex:1">
              <el-option v-for="o in ENUMS.elevations" :key="o[0]" :label="o[1]" :value="o[0]" />
            </el-select>
            <el-input-number v-model="camHeight" :min="0.3" :max="5" :step="0.1" size="small" controls-position="right" style="width:90px" />
          </div>
        </div>
        <div class="cam-field">
          <label>主体位置关系（相对机位）</label>
          <div class="cam-row">
            <el-select v-model="side" size="small" style="flex:1">
              <el-option v-for="o in ENUMS.sides" :key="o[0]" :label="o[1]" :value="o[0]" />
            </el-select>
            <el-select v-model="depth" size="small" style="flex:1">
              <el-option v-for="o in ENUMS.depths" :key="o[0]" :label="o[1]" :value="o[0]" />
            </el-select>
          </div>
        </div>
        <div class="cam-field">
          <label>角色朝向（相对镜头）</label>
          <el-select v-model="subjectFacing" size="small" class="w-full">
            <el-option v-for="o in ENUMS.facings" :key="o[0]" :label="o[1]" :value="o[0]" />
          </el-select>
        </div>
        <!-- 关键帧操作 -->
        <div class="cam-field">
          <label>机位关键帧（{{ keyframes.length }}）</label>
          <div class="cam-row">
            <el-button size="small" @click="addKf">＋ 加机位</el-button>
            <el-button size="small" text type="danger" :disabled="keyframes.length <= 1" @click="removeKf">删当前</el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部：编译出的相机描述 -->
    <div class="cam-compiled">
      <div class="cam-compiled-label">📝 相机描述（将注入提示词）</div>
      <pre class="cam-compiled-text">{{ compiledText || "（设置参数后自动生成，或拖动机位调整）" }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";

// ===== 枚举（从 H3 Prompt Composer 提取） =====
const ENUMS = {
  framings: [
    ["", "未指定"], ["extreme_close_up", "大特写"], ["close_up", "特写"], ["medium_close_up", "中近景"],
    ["medium", "中景"], ["medium_wide", "中全景/三分身"], ["wide", "全景/全身"], ["extreme_wide", "大远景/建立"],
    ["insert", "插入/细节"], ["two_shot", "双人镜"], ["over_shoulder", "过肩"],
  ],
  angles: [
    ["", "自动"], ["eye_level", "平视"], ["slightly_low", "微仰"], ["low", "仰视"],
    ["ground", "地面级仰视"], ["slightly_high", "微俯"], ["high", "俯视"], ["overhead", "俯拍/顶拍"],
    ["waist_level", "腰部高度平视"], ["chest_level", "胸部高度平视"], ["custom", "自定义角度"],
  ],
  viewpoints: [
    ["", "自动"], ["front", "正前方"], ["front_3q_left", "前四分之三偏左"], ["front_3q_right", "前四分之三偏右"],
    ["left_profile", "左侧面"], ["right_profile", "右侧面"], ["rear_3q_left", "后四分之三偏左"],
    ["rear_3q_right", "后四分之三偏右"], ["behind", "正后方"], ["pov", "主观视角"], ["custom", "自定义视点"],
  ],
  compositions: [
    ["", "自动"], ["centered", "居中"], ["left_third", "左三分位"], ["right_third", "右三分位"],
    ["negative_left", "左侧留白"], ["negative_right", "右侧留白"], ["balanced_two", "平衡双人"],
    ["symmetrical", "对称"], ["dirty_single", "脏前景单人"], ["custom", "自定义构图"],
  ],
  lenses: [
    ["", "自动"], ["wide", "广角透视"], ["natural", "自然透视"], ["telephoto", "长焦压缩"], ["macro", "微距/细节"], ["custom", "自定义镜头"],
  ],
  dofs: [
    ["", "自动"], ["deep", "深景深"], ["moderate", "适中景深"], ["shallow", "浅景深"], ["extreme_shallow", "极浅景深"],
  ],
  moves: [
    ["", "固定机位"], ["push_in", "推近"], ["pull_out", "拉远"], ["truck_left", "左移"], ["truck_right", "右移"],
    ["pan_left", "左摇"], ["pan_right", "右摇"], ["tilt_up", "上摇"], ["tilt_down", "下摇"],
    ["pedestal_up", "升降上升"], ["pedestal_down", "升降下降"], ["crane", "吊臂/升降"], ["dolly_diag", "斜向推移"],
    ["orbit", "环绕/弧线"], ["tracking", "跟移"], ["zoom_in", "变焦推近"], ["zoom_out", "变焦拉远"],
    ["dolly_zoom", "推拉变焦"], ["roll_cw", "顺时针滚转"], ["roll_ccw", "逆时针滚转"], ["custom", "自定义运动"],
  ],
  amps: [
    ["", "默认"], ["small", "小幅"], ["large", "大幅"],
  ],
  spds: [
    ["", "默认"], ["slow", "缓慢"], ["moderate", "适中"], ["fast", "快速"],
  ],
  elevations: [
    ["", "自动"], ["eye", "眼平"], ["low", "低机位"], ["high", "高机位"], ["ground", "地面机位"], ["overhead", "俯拍机位"],
  ],
  sides: [
    ["", "居中"], ["left", "偏左"], ["right", "偏右"],
  ],
  depths: [
    ["", "并列"], ["front", "前方"], ["behind", "后方"],
  ],
  facings: [
    ["", "未指定"], ["toward_cam", "面朝镜头"], ["away_cam", "背对镜头"], ["profile", "侧对镜头"],
    ["toward_scene", "面朝场景深处"], ["away_scene", "背对场景深处"],
  ],
} as const;

// ===== 状态 =====
const framing = ref("");
const angle = ref("");
const viewpoint = ref("");
const composition = ref("");
const lens = ref("");
const dof = ref("");
const moveType = ref("");
const amp = ref("");
const spd = ref("");
const elevation = ref("");
const camHeight = ref(1.6);
const side = ref("");
const depth = ref("");
const subjectFacing = ref("");

// 机位关键帧：x=左右（-3..3）, z=前后（负=主体前方，即靠近主体）, h=高度
interface Kf { x: number; z: number; h: number }
const keyframes = ref<Kf[]>([
  { x: 0, z: -2.5, h: 1.6 },
  { x: 1.6, z: -2.2, h: 1.6 },
]);
const activeKf = ref(0);

// 拖拽状态
const dragging = ref<null | { i: number }>(null);

// ===== 计算 =====
const viewBox = "-6 -6 12 12";
const gridX = [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5];
const gridZ = [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5];

const subjectTransform = "translate(0 0)";
function posTransform(k: Kf) {
  return `translate(${k.x} ${k.z})`;
}
/** 视角锥：机位朝向主体（原点），半角约 30° */
function fovPoints(k: Kf) {
  const dx = 0 - k.x, dz = 0 - k.z;
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len, uz = dz / len;
  const px = -uz, pz = ux; // 垂直向量
  const half = 0.7;
  const tipX = k.x + ux * len, tipZ = k.z + uz * len;
  return `${k.x} ${k.z} ${k.x + ux * half + px * half * 0.5} ${k.z + uz * half + pz * half * 0.5} ${k.x + ux * half - px * half * 0.5} ${k.z + uz * half - pz * half * 0.5} ${tipX} ${tipZ}`;
}

const pathPoints = computed(() => keyframes.value.map((k) => ({ x: k.x, z: k.z })));
const pathPointsStr = computed(() => pathPoints.value.map((p) => `${p.x},${p.z}`).join(" "));

/** 编译完整相机描述（中文「机位与人物关系」块，追加到 videoDesc） */
const compiledText = computed(() => {
  const kf = keyframes.value;
  const k0 = kf[0];
  if (!k0) return "";
  const parts: string[] = [];

  // 距离分级
  function distLabel(k: Kf) {
    const d = Math.hypot(k.x, k.z);
    return d < 1 ? "贴近" : d < 3 ? "中距离" : "远处";
  }
  // 镜头相对主体方位（x=左右, z=前后；相机看向原点=主体）
  function camAzimuth(k: Kf) {
    const sideTxt = Math.abs(k.x) < 0.4 ? "" : k.x > 0 ? "偏右" : "偏左";
    const depthTxt = Math.abs(k.z) < 0.4 ? "" : k.z < 0 ? "位于主体前方" : "位于主体后方";
    if (sideTxt && depthTxt) return `${depthTxt}且${sideTxt}`;
    return depthTxt || sideTxt || "与主体并列";
  }
  // 镜头朝向（默认朝向主体=原点）
  function camFacing(k: Kf) {
    return "朝向主体所在方向";
  }
  // 角色朝向（相对镜头）
  function subjectFacingTxt() {
    const m = ENUMS.facings.find(([v]) => v === subjectFacing.value);
    return m && m[0] ? m[1] : "朝向由剧情决定";
  }

  // 主句：镜头位置 + 朝向 + 高度
  const first = kf[0];
  const camLoc = `${distLabel(first)}、${camAzimuth(first)}`;
  const camH = elevation.value
    ? (ENUMS.elevations.find(([v]) => v === elevation.value)?.[1] ?? `${camHeight.value.toFixed(1)}米高`)
    : `${camHeight.value.toFixed(1)}米高`;
  parts.push(
    `机位与人物关系（camera and subject layout）：镜头位于主体${camLoc}，机位高度约${camH}，镜头${camFacing(first)}；角色位于画面主体位置，${subjectFacingTxt()}。`,
  );
  // 景别/视点/角度/构图
  if (framing.value) {
    const fm = ENUMS.framings.find(([v]) => v === framing.value);
    if (fm && fm[0]) parts.push(`景别：${fm[1]}。`);
  }
  if (viewpoint.value) {
    const vp = ENUMS.viewpoints.find(([v]) => v === viewpoint.value);
    if (vp && vp[0]) parts.push(`视点：${vp[1]}。`);
  }
  if (angle.value) {
    const an = ENUMS.angles.find(([v]) => v === angle.value);
    if (an && an[0]) parts.push(`机位角度：${an[1]}。`);
  }
  if (composition.value) {
    const cp = ENUMS.compositions.find(([v]) => v === composition.value);
    if (cp && cp[0]) parts.push(`构图：${cp[1]}。`);
  }
  if (lens.value) {
    const ln = ENUMS.lenses.find(([v]) => v === lens.value);
    if (ln && ln[0]) parts.push(`镜头焦距：${ln[1]}。`);
  }
  if (dof.value) {
    const df = ENUMS.dofs.find(([v]) => v === dof.value);
    if (df && df[0]) parts.push(`景深：${df[1]}。`);
  }
  // 运动
  if (moveType.value) {
    const mv = ENUMS.moves.find(([v]) => v === moveType.value);
    if (mv && mv[0]) {
      const ampTxt = amp.value === "small" ? "小幅" : amp.value === "large" ? "大幅" : "";
      const spdTxt = spd.value === "slow" ? "缓慢" : spd.value === "fast" ? "快速" : "";
      parts.push(`镜头运动：${ampTxt}${spdTxt}${mv[1]}。`);
    }
  }
  // 多机位路径
  if (kf.length > 1) {
    parts.push(
      `机位路径：镜头从${camAzimuth(kf[0])}移动到${camAzimuth(kf[kf.length - 1])}，经过${kf.length}个机位点。`,
    );
  }
  parts.push("全片保持该机位与人物相对关系，禁止在切镜后改变。");
  return parts.join("\n");
});

// ===== 操作 =====
function addKf() {
  const last = keyframes.value[keyframes.value.length - 1];
  keyframes.value.push({ x: last.x + 0.6, z: last.z + 0.3, h: last.h });
  activeKf.value = keyframes.value.length - 1;
}
function removeKf() {
  if (keyframes.value.length <= 1) return;
  keyframes.value.splice(activeKf.value, 1);
  if (activeKf.value >= keyframes.value.length) activeKf.value = keyframes.value.length - 1;
}
function reset() {
  framing.value = angle.value = viewpoint.value = composition.value = lens.value = dof.value = "";
  moveType.value = amp.value = spd.value = elevation.value = side.value = depth.value = "";
  camHeight.value = 1.6;
  keyframes.value = [{ x: 0, z: -2.5, h: 1.6 }, { x: 1.6, z: -2.2, h: 1.6 }];
  activeKf.value = 0;
}

// SVG 坐标转换：viewBox -6..6，实际像素由浏览器缩放
function svgPoint(ev: MouseEvent) {
  const svg = (ev.currentTarget as SVGSVGElement);
  const rect = svg.getBoundingClientRect();
  const scale = 12 / rect.width; // viewBox 宽度 12
  const x = (ev.clientX - rect.left) * scale - 6;
  const z = (ev.clientY - rect.top) * scale - 6;
  return { x, z };
}
function onSvgDown(ev: MouseEvent) {
  // 只在机位上开始拖拽
}
function onKfDown(ev: MouseEvent, i: number) {
  ev.preventDefault();
  ev.stopPropagation();
  activeKf.value = i;
  dragging.value = { i };
  window.addEventListener("mousemove", onDragMove as any);
  window.addEventListener("mouseup", onDragEnd as any);
}
function onSvgMove(ev: MouseEvent) { /* handled by window */ }
function onSvgUp() { onDragEnd(); }
function onDragMove(ev: MouseEvent) {
  if (!dragging.value) return;
  const svg = document.querySelector(".cam-svg") as SVGSVGElement;
  if (!svg) return;
  const rect = svg.getBoundingClientRect();
  const scale = 12 / rect.width;
  const x = (ev.clientX - rect.left) * scale - 6;
  const z = (ev.clientY - rect.top) * scale - 6;
  const k = keyframes.value[dragging.value.i];
  if (k) {
    k.x = Math.max(-5.5, Math.min(5.5, x));
    k.z = Math.max(-5.5, Math.min(5.5, z));
  }
}
function onDragEnd() {
  dragging.value = null;
  window.removeEventListener("mousemove", onDragMove as any);
  window.removeEventListener("mouseup", onDragEnd as any);
}

defineExpose({ compiledText, reset });
</script>

<style scoped>
.cam-planner {
  border: 1px solid #e4e6eb;
  border-radius: 8px;
  background: #ffffff;
  margin-top: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.cam-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: #f8f9fb;
  border-bottom: 1px solid #eef0f4;
}
.cam-title { color: #2b2f36; font-size: 12px; font-weight: 600; }
.cam-actions { display: flex; gap: 6px; }
.cam-body { display: flex; gap: 12px; padding: 10px; flex: 1; min-height: 0; overflow: auto; }
.cam-visual { flex: 1; min-width: 0; }
.cam-svg {
  width: 100%;
  aspect-ratio: 1;
  background: #fbfaf6;
  border: 1px solid #e4e6eb;
  border-radius: 8px;
  cursor: crosshair;
  user-select: none;
}
.cam-grid line { stroke: #e8e6de; stroke-width: 0.03; }
.cam-axis { stroke: #d8d4c8; stroke-width: 0.04; stroke-dasharray: 0.15 0.15; }
.cam-subject circle { fill: #c98a2d; opacity: 0.9; }
.cam-subject text { fill: #fff; font-size: 0.42px; font-weight: 700; }
.cam-path { fill: none; stroke: #c98a2d; stroke-width: 0.07; stroke-dasharray: 0.15 0.12; opacity: 0.7; }
.cam-pos { cursor: grab; }
.cam-pos .cam-icon { fill: #2f5f9e; stroke: #fff; stroke-width: 0.06; }
.cam-pos.active .cam-icon { fill: #c98a2d; }
.cam-kf-label { fill: #2b2f36; font-size: 0.4px; font-weight: 600; }
.cam-fov polygon { fill: #2f5f9e; opacity: 0.08; }
.cam-hint { fill: #a0a69e; font-size: 0.34px; }
.cam-params { width: 300px; flex-shrink: 0; display: flex; flex-direction: column; gap: 7px; }
.cam-field { display: flex; flex-direction: column; gap: 3px; }
.cam-field label { color: #6b7380; font-size: 11px; font-weight: 600; }
.cam-row { display: flex; gap: 6px; }
.w-full { width: 100%; }
.cam-compiled {
  border-top: 1px solid #eef0f4;
  padding: 8px 10px;
  background: #fdfbf7;
}
.cam-compiled-label { color: #6b7380; font-size: 11px; font-weight: 600; margin-bottom: 4px; }
.cam-compiled-text {
  margin: 0;
  white-space: pre-wrap;
  font-family: inherit;
  font-size: 12px;
  line-height: 1.7;
  color: #4a5058;
}
</style>
