import { Router } from "express";
import { z } from "zod";
import { loadSettingsFromDb, saveSettings, comfyuiStatus, type ProviderSettings } from "../providers/manager.js";

const router = Router();

const settingsSchema = z.object({
  comfyuiUrl: z.string().min(1),
  videoComfyuiUrl: z.string().optional(),
  ossDir: z.string().min(1),
  workflows: z.object({
    character: z.object({ path: z.string() }).optional(),
    scene: z.object({ path: z.string() }).optional(),
    prop: z.object({ path: z.string() }).optional(),
    storyboard: z.object({ path: z.string() }).optional(),
  }),
  videoWorkflowPath: z.string(),
  deepseekKey: z.string().optional(),
  // Director 长视频配置（2026-09-02 补：此前 PUT 不含这些字段，保存无效）
  directorComfyuiUrl: z.string().optional(),
  workflowDirectorPath: z.string().optional(),
  directorVideoRatio: z.string().optional(),
  directorComfyOutputDir: z.string().optional(),
});

// GET /api/settings —— 当前设置（DB 覆盖后的生效值）
router.get("/settings", async (_req, res, next) => {
  try {
    const s = await loadSettingsFromDb();
    res.json({ data: s });
  } catch (e) {
    next(e);
  }
});

// PUT /api/settings —— 保存设置 + 热更新 Provider（无需重启）
router.put("/settings", async (req, res, next) => {
  try {
    const body = settingsSchema.parse(req.body ?? {});
    const settings: ProviderSettings = {
      comfyuiUrl: body.comfyuiUrl,
      videoComfyuiUrl: body.videoComfyuiUrl,
      ossDir: body.ossDir,
      workflows: {
        character: { ...(body.workflows.character ?? {}), promptNodeType: "CR Text" },
        scene: { ...(body.workflows.scene ?? {}), promptNodeType: "CLIPTextEncode", size: [1216, 704] },
        prop: { ...(body.workflows.prop ?? {}), promptNodeType: "CLIPTextEncode", size: [1024, 1024] },
        storyboard: { ...(body.workflows.storyboard ?? {}), promptNodeType: "CLIPTextEncode", size: [720, 1280] },
      },
      videoWorkflowPath: body.videoWorkflowPath,
      deepseekKey: body.deepseekKey,
      directorComfyuiUrl: body.directorComfyuiUrl,
      workflowDirectorPath: body.workflowDirectorPath,
      directorVideoRatio: body.directorVideoRatio,
      directorComfyOutputDir: body.directorComfyOutputDir,
    };
    await saveSettings(settings);
    res.json({ data: { saved: true } });
  } catch (e) {
    next(e);
  }
});

// GET /api/settings/comfyui-status —— ComfyUI 在线状态
router.get("/settings/comfyui-status", async (_req, res, next) => {
  try {
    const s = await loadSettingsFromDb();
    const status = await comfyuiStatus(s.comfyuiUrl);
    res.json({ data: { baseUrl: s.comfyuiUrl, ...status } });
  } catch (e) {
    next(e);
  }
});

export default router;
