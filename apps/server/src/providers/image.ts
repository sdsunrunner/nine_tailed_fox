// 图像 Provider 抽象（M2 占位实现）
// 对应 Doc/05-AI-Provider-Design.md：能力接口 + Provider 可插拔。
// M2 用 MockProvider 模拟生成；M3 接 ComfyUI（本地 Z-image 工作流已就绪）。

export interface ImageGenerateInput {
  type: string; // character | scene | prop | storyboard
  name: string;
  prompt: string;
  ratio?: string; // 影片比例（9:16 / 16:9 / 1:1 …）→ 分镜图尺寸按比例换算
  /** 参考图（槽位名 → oss 相对路径），如 { character, scene, prop }：分镜首帧参考角色/场景/道具图 */
  refImages?: Record<string, string>;
  /** 图生图参考图（scene/prop 资产）：有则走图生图工作流，无则文生图 */
  refImage?: string;
}

export interface ImageGenerateResult {
  filePath: string; // 相对 /oss 的路径（M3 起真实落盘）
  params: Record<string, unknown>; // 生成参数回显（模型/seed/尺寸…）
}

export interface ImageProvider {
  readonly name: string;
  generate(input: ImageGenerateInput): Promise<ImageGenerateResult>;
}

// ---- Mock：模拟生成（延迟 2.5s，返回虚拟文件路径）----
export class MockImageProvider implements ImageProvider {
  readonly name = "mock";
  async generate(input: ImageGenerateInput): Promise<ImageGenerateResult> {
    await new Promise((r) => setTimeout(r, 2500));
    const stamp = Date.now();
    return {
      filePath: `/oss/assets/mock/${input.type}/${input.name}-${stamp}.png`,
      params: { provider: "mock", model: "z_image_turbo_bf16", seed: stamp % 1e9 },
    };
  }
}

// ---- 运行时选择（M3 起：按配置选 ComfyUI / 云端）----
let current: ImageProvider = new MockImageProvider();

export function setImageProvider(p: ImageProvider) {
  current = p;
}

export function getImageProvider(): ImageProvider {
  return current;
}
