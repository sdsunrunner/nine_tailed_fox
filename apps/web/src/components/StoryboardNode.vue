<template>
  <div class="sb-node" :class="stateClass">
    <div class="sb-node-head">
      <span class="sb-index">#{{ indexText }}</span>
      <span class="sb-state">{{ stateText }}</span>
    </div>
    <div class="sb-node-body">
      <img v-if="state === 'SUCCEEDED' && imgUrl" :src="imgUrl" class="sb-thumb" alt="" />
      <span v-else class="sb-prompt">{{ promptPreview }}</span>
    </div>
    <div v-if="videoState === 'SUCCEEDED' && videoUrl" class="sb-video">
      <video :src="videoUrl" controls preload="metadata" class="sb-video-player"></video>
    </div>
    <div class="sb-node-foot">
      <el-button
        size="small"
        text
        :type="state === 'SUCCEEDED' ? 'success' : 'primary'"
        :loading="state === 'RUNNING'"
        :disabled="state === 'RUNNING'"
        @click.stop="onGenerate"
      >
        {{ state === "SUCCEEDED" ? "重新生成" : state === "RUNNING" ? "生成中" : "生成分镜图" }}
      </el-button>
      <el-button
        size="small"
        text
        type="warning"
        :loading="videoState === 'RUNNING'"
        :disabled="videoState === 'RUNNING' || state !== 'SUCCEEDED'"
        @click.stop="onGenerateVideo"
      >
        {{ videoText }}
      </el-button>
    </div>
    <Handle type="target" :position="Position.Left" />
    <Handle type="source" :position="Position.Right" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Handle, Position } from "@vue-flow/core";
import type { NodeProps } from "@vue-flow/core";
import { useCanvasStore } from "../stores/canvas";

const props = defineProps<NodeProps>();
const store = useCanvasStore();

const data = computed(() => (props.data ?? {}) as Record<string, unknown>);
const state = computed(() => (data.value.state as string) ?? "QUEUED");
const indexText = computed(() => String((data.value.index as number) ?? ""));
const promptPreview = computed(() => {
  const p = (data.value.prompt as string) ?? "";
  return p ? (p.length > 26 ? p.slice(0, 26) + "…" : p) : "未填写分镜描述";
});
const imgUrl = computed(() => (data.value.filePath as string) ?? "");
const sbId = computed(() => data.value.storyboardId as number);
const videoState = computed(() => (data.value.videoState as string) ?? "QUEUED");
const videoUrl = computed(() => (data.value.videoPath as string) ?? "");
const videoText = computed(() =>
  videoState.value === "SUCCEEDED"
    ? "重新生成视频"
    : videoState.value === "RUNNING"
      ? "视频生成中"
      : state.value === "SUCCEEDED"
        ? "生成视频"
        : "先生成图",
);

const stateText = computed(
  () =>
    ({ QUEUED: "未生成", RUNNING: "生成中", SUCCEEDED: "已完成", FAILED: "失败" })[state.value] ?? state.value,
);
const stateClass = computed(() => `state-${state.value}`);

function onGenerate() {
  if (sbId.value && state.value !== "RUNNING") {
    store.generateStoryboardNode(sbId.value);
  }
}

function onGenerateVideo() {
  if (sbId.value && state.value === "SUCCEEDED" && videoState.value !== "RUNNING") {
    store.generateVideoNode(sbId.value);
  }
}
</script>

<style scoped>
.sb-node {
  min-width: 168px;
  background: #f5f3ed;
  border: 1px solid #2f4a63;
  border-radius: 6px;
  color: #d5dbe3;
  font-size: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}
.sb-node.state-RUNNING { border-color: #b08a3e; }
.sb-node.state-SUCCEEDED { border-color: #4a7a4f; }
.sb-node.state-FAILED { border-color: #d65f5f; }
.sb-node-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  border-bottom: 1px solid #26384a;
  color: #6b7380;
}
.sb-index {
  font-weight: 700;
  color: #4a8fd8;
  background: #eaf3ff;
  padding: 1px 7px;
  border-radius: 3px;
  font-size: 11px;
}
.sb-state { color: #6b7380; }
.state-RUNNING .sb-state { color: #e0a03e; }
.state-SUCCEEDED .sb-state { color: #7fbf8a; }
.sb-node-body {
  padding: 6px 8px;
  min-height: 30px;
}
.sb-prompt { color: #a8b4c2; line-height: 1.5; }
.sb-thumb {
  display: block;
  width: 100%;
  max-height: 200px;
  object-fit: contain;
  border-radius: 4px;
  background: #f5f3ed;
}
.sb-video { padding: 0 6px; }
.sb-video-player {
  display: block;
  width: 100%;
  max-height: 220px;
  border-radius: 4px;
  background: #000;
}
.sb-node-foot { padding: 0 4px 4px; text-align: right; }
</style>
