<template>
  <div class="asset-node" :class="stateClass">
    <div class="asset-node-head">
      <span class="asset-node-kind" :class="typeClass">{{ kindText }}</span>
      <span class="asset-node-state">{{ stateText }}</span>
    </div>
    <div class="asset-node-body">
      <img
        v-if="state === 'SUCCEEDED' && imgUrl"
        :src="imgUrl"
        class="asset-thumb"
        alt=""
      />
      <span v-else>{{ displayName }}</span>
    </div>
    <div class="asset-node-foot">
      <el-button
        size="small"
        text
        :type="state === 'SUCCEEDED' ? 'success' : 'primary'"
        :loading="state === 'RUNNING'"
        :disabled="state === 'RUNNING'"
        @click.stop="onGenerate"
      >
        {{ state === "SUCCEEDED" ? "重新生成" : state === "RUNNING" ? "生成中" : "生成" }}
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
const type = computed(() => (data.value.type as string) ?? "character");
const state = computed(() => (data.value.state as string) ?? "QUEUED");
const displayName = computed(() => (data.value.name as string) ?? (data.value.label as string) ?? "未命名");
const imgUrl = computed(() => (data.value.filePath as string) ?? "");
const assetId = computed(() => data.value.assetId as number);

const kindText = computed(
  () => ({ character: "角色", scene: "场景", prop: "道具" })[type.value] ?? "资产",
);
const typeClass = computed(() => `kind-${type.value}`);
const stateText = computed(
  () =>
    ({ QUEUED: "未生成", RUNNING: "生成中", SUCCEEDED: "已完成", FAILED: "失败" })[state.value] ??
    state.value,
);
const stateClass = computed(() => `state-${state.value}`);

function onGenerate() {
  if (assetId.value && state.value !== "RUNNING") {
    store.generate(assetId.value);
  }
}
</script>

<style scoped>
.asset-node {
  min-width: 150px;
  background: #ffffff;
  border: 1px solid #3a4450;
  border-radius: 6px;
  color: #d5dbe3;
  font-size: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}
.asset-node.state-RUNNING { border-color: #b08a3e; }
.asset-node.state-SUCCEEDED { border-color: #4a7a4f; }
.asset-node.state-FAILED { border-color: #d65f5f; }
.asset-node-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  border-bottom: 1px solid #2c343d;
  color: #6b7380;
}
.asset-node-kind { font-weight: 600; font-size: 11px; padding: 1px 6px; border-radius: 3px; }
.kind-character { background: #f0f2f5; color: #4a8fd8; }
.kind-scene { background: #33452e; color: #9cc08f; }
.kind-prop { background: #4d3a2d; color: #d9b08f; }
.asset-node-state { color: #6b7380; }
.state-RUNNING .asset-node-state { color: #e0a03e; }
.state-SUCCEEDED .asset-node-state { color: #7fbf8a; }
.state-FAILED .asset-node-state { color: #e08a8a; }
.asset-node-body {
  padding: 8px 8px 4px;
  color: #d5dbe3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.asset-thumb {
  display: block;
  width: 100%;
  max-height: 160px;
  object-fit: contain;
  border-radius: 4px;
  background: #f5f3ed;
}
.asset-node-foot {
  padding: 0 4px 4px;
  text-align: right;
}
</style>
