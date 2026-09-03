// ComfyUI 工作流 JSON → /prompt API 格式转换
// 对齐 ComfyUI 前端 graphToPrompt 逻辑：
//  1. widget 值按 widgets_values 顺序填充（跳过 control_after_generate 的 UI 状态值）
//  2. link 输入引用转换

export interface ComfyNode {
  id: number;
  type: string;
  inputs?: Array<{
    name: string;
    type?: string;
    link?: number | null;
    widget?: { name: string } | null;
  }>;
  widgets_values?: unknown[];
}

export interface ComfyWorkflow {
  nodes: ComfyNode[];
  links?: Array<[number, number, number, number, number, string]>;
}

export interface ApiPromptInput {
  [nodeId: string]: { class_type: string; inputs: Record<string, unknown> };
}

/** 节点类型 → 带 control_after_generate 的 widget 名称集合 */
export type WidgetControlMap = Record<string, Set<string>>;

/** 从 /object_info 提取各节点类型的 widget 配置（含 control_after_generate 标记） */
export function parseWidgetControlMap(objectInfo: Record<string, any>): WidgetControlMap {
  const map: WidgetControlMap = {};
  for (const [type, info] of Object.entries(objectInfo)) {
    const all: Record<string, any> = {
      ...(info?.input?.required ?? {}),
      ...(info?.input?.optional ?? {}),
    };
    const controlNames = new Set<string>();
    for (const [name, def] of Object.entries(all)) {
      if (Array.isArray(def) && def[1] && typeof def[1] === "object") {
        if ((def[1] as any).control_after_generate) controlNames.add(name);
      }
    }
    map[type] = controlNames;
  }
  return map;
}

// 前端辅助节点类型：无后端实现，提交时跳过
// PrimitiveNode/Note/MarkdownNote/FancyTimerNode 等
const SKIP_NODE_TYPES = new Set([
  "PrimitiveNode",
  "Note",
  "MarkdownNote",
  "FancyTimerNode",
  "Label (rgthree)",
  "Fast Groups Bypasser (rgthree)",
  "Any Switch (rgthree)",
  "Reroute",
  "Workflow",
  "Subgraph",
  "easy clearCacheAll",
]);

// 前端 primitive 节点：无后端实现，值须内联到消费方（ComfyMathExpression 等）
const PRIMITIVE_TYPES = new Set([
  "PrimitiveNode",
  "PrimitiveFloat",
  "PrimitiveInt",
  "PrimitiveString",
  "PrimitiveBoolean",
  "PrimitiveStringMultiline",
]);

/** 工作流 → API prompt 格式 */
export function workflowToApiPrompt(wf: ComfyWorkflow, controlMap?: WidgetControlMap, knownTypes?: Set<string>): ApiPromptInput {
  // mode=4 = bypass（前端禁用节点）：提交时跳过，且其输出链接视为不存在
  const skipIds = new Set<number>();
  for (const node of wf.nodes) {
    if ((node as any).mode === 4) skipIds.add(node.id);
    // 未知节点类型（未安装的自定义节点）→ 同样跳过并断开其输出链接
    if (knownTypes && !knownTypes.has(node.type) && !SKIP_NODE_TYPES.has(node.type) && !PRIMITIVE_TYPES.has(node.type)) {
      skipIds.add(node.id);
    }
  }
  const linkMap = new Map<number, { node: number; slot: number }>();
  for (const l of wf.links ?? []) {
    if (skipIds.has(l[1])) continue; // 源是被禁用/未知节点 → 忽略该链接
    linkMap.set(l[0], { node: l[1], slot: l[2] });
  }

  // Primitive* 节点：前端内部节点，提交时须内联其 widget 值并跳过自身
  const primitiveValues = new Map<number, unknown>();
  for (const node of wf.nodes) {
    if (PRIMITIVE_TYPES.has(node.type) && node.widgets_values?.length) {
      primitiveValues.set(node.id, node.widgets_values[0]);
    }
  }

  const prompt: ApiPromptInput = {};
  for (const node of wf.nodes) {
    if (SKIP_NODE_TYPES.has(node.type) || PRIMITIVE_TYPES.has(node.type)) continue; // 跳过前端辅助节点
    if (skipIds.has(node.id)) continue; // 跳过被禁用/未知节点

    const inputs: Record<string, unknown> = {};

    // 1. widget 值（按 widget 输入顺序；跳过 control_after_generate 状态值）
    //    兼容两种格式：数组（常规）与对象（如 VHS_VideoCombine 的 {frame_rate:16,...}）
    const widgetInputs = (node.inputs ?? []).filter((i) => i.widget);
    if (node.widgets_values) {
      if (Array.isArray(node.widgets_values)) {
        const controlNames = controlMap?.[node.type] ?? new Set<string>();
        let vi = 0;
        for (const w of widgetInputs) {
          if (vi >= node.widgets_values.length) break;
          inputs[w.name] = node.widgets_values[vi];
          vi++;
          if (controlNames.has(w.name)) vi++; // 该 widget 带控制值（如 seed 的 randomize）
        }
      } else {
        // 对象格式：按名字取值
        for (const w of widgetInputs) {
          const v = (node.widgets_values as Record<string, unknown>)[w.name];
          if (v !== undefined) inputs[w.name] = v;
        }
      }
    }

    // 2. 连接引用（link 输入）；PrimitiveNode 源 → 内联其值
    for (const i of node.inputs ?? []) {
      if (i.link != null && linkMap.has(i.link)) {
        const l = linkMap.get(i.link)!;
        if (primitiveValues.has(l.node)) {
          inputs[i.name] = primitiveValues.get(l.node);
        } else {
          inputs[i.name] = [String(l.node), l.slot];
        }
      }
    }

    prompt[String(node.id)] = { class_type: node.type, inputs };
  }
  return prompt;
}
