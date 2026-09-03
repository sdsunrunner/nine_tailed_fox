import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const router = Router();

const ACTOR_VOICE_DIR =
  process.env.ACTOR_VOICE_DIR || "E:\\AIMovie\\AIMovieWorkSpace\\nine_tailed_fox\\ActorVoice";
const TRANSCRIPT_FILE = path.join(process.cwd(), "data", "actor_transcripts.json");

// 方言 → SoulX 方言标签（模型仅支持 Henan/Sichuan/Yue 三种；其余按中原官话/官话族近似映射）
// 实测：<|Henan|> 可近似 陕西关中话/山西晋语/山东/西北 等北方官话腔调；吴语无近似标签 → 普通话
const DIALECT_TAG: Record<string, string> = {
  普通话: "",
  河南话: "<|Henan|>",
  陕西话: "<|Henan|>", // 关中话属中原官话，近似
  山西话: "<|Henan|>", // 晋语（有入声），近似中原官话
  山东话: "<|Henan|>", // 冀鲁官话/胶辽官话，近似
  西北话: "<|Henan|>", // 陇中/中原官话系，近似
  四川话: "<|Sichuan|>",
  粤语: "<|Yue|>",
  豫东腔秦腔: "<|Henan|>", // 豫东腔属中原官话，秦腔旋律在配乐叠加
  吴语: "", // 无对应标签 → 普通话
};

// GET /api/voice/transcript/:actor —— 参考音频的转写台词（默认试听台词）
router.get("/voice/transcript/:actor", async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.actor);
    if (!fs.existsSync(TRANSCRIPT_FILE)) {
      res.json({ data: { name, text: "" } });
      return;
    }
    const map = JSON.parse(fs.readFileSync(TRANSCRIPT_FILE, "utf8"));
    res.json({ data: { name, text: map[name] ?? "" } });
  } catch {
    res.json({ data: { name: req.params.actor, text: "" } });
  }
});

// POST /api/voice/preview —— 提交 SoulX 配音试听合成（提交 ComfyUI，返回 prompt_id 供轮询）
const previewSchema = z.object({
  actor: z.string().min(1), // ActorVoice 文件名（如 张丰毅.wav）
  dialect: z.string().default("普通话"),
  text: z.string().min(1),
});

router.post("/voice/preview", async (req, res) => {
  try {
    const { actor, dialect, text } = previewSchema.parse(req.body ?? {});
    const actorFile = path.basename(actor);
    const actorPath = path.join(ACTOR_VOICE_DIR, actorFile);
    if (!fs.existsSync(actorPath)) {
      res.status(404).json({ message: `未找到演员音频：${actorFile}` });
      return;
    }

    // 同步参考音频到 ComfyUI input 根目录（LoadAudio 从 input 根加载；同名冲突加前缀覆盖）
    const comfyUrl = process.env.DIRECTOR_COMFYUI_URL || "http://127.0.0.1:9312";
    const comfyInputDir = process.env.COMFYUI_INPUT_DIR || "H:\\ComfyUI\\ComfyUI-V18.1\\input";
    const flatName = `vp_${actorFile}`; // 平铺到 input 根，避免子目录兼容问题
    try {
      fs.mkdirSync(comfyInputDir, { recursive: true });
      fs.copyFileSync(actorPath, path.join(comfyInputDir, flatName));
    } catch {
      res.status(500).json({ message: "参考音频同步到 ComfyUI 失败" });
      return;
    }

    const dialectTag = DIALECT_TAG[dialect] ?? "";
    // 标准方言参考句：作为 dialect_prompt 给模型提供「该方言怎么发音」的声音特征
    // （不能用户台词——普通话台词会引导普通话腔调；测试脚本用河南话专用句成功）
    const DIALECT_PROMPT: Record<string, string> = {
      普通话: "今天天气不错，我们一起去看看。",
      河南话: "俺走了十天十夜，鞋底子都磨穿了，就为来跟恁辩个理：杀人夺地，中不中？",
      陕西话: "额走了十天十夜，鞋底子都磨穿咧，就为来跟恁辩个理，中不中？",
      山西话: "咱走了十天十夜，鞋底子都磨穿唻，就为来跟恁说个理，行不行？",
      山东话: "俺走了十天十夜，鞋底子都磨穿了，就来跟你论个理，中不中？",
      西北话: "我走了十天十夜，鞋底子都磨穿了，就来跟你讲个理，行不行？",
      四川话: "我走了十天十夜，鞋底板儿都磨穿了，就为来跟你掰扯个道理，要得不？",
      粤语: "我行咗十日十夜，鞋底都磨穿喇，就係嚟同你講道理，得唔得？",
      豫东腔秦腔: "俺走了十天十夜，鞋底子都磨穿了，就为来跟恁辩个理，中不中？",
      吴语: "我走了十日十夜，鞋底都磨穿了，就来搭侬讲讲道理，好勿啦？",
    };
    const dialectPrompt = DIALECT_PROMPT[dialect] ?? DIALECT_PROMPT["普通话"];
    const promptText =
      "喜欢攀岩、徒步、滑雪的语言爱好者，以及过两天要带着全部家当去景德镇做陶瓷的白日梦想家。";

    const jsonConfig = {
      speakers: {
        S1: {
          prompt_text: promptText,
          dialect_prompt: `${dialectTag}${dialectPrompt}`,
        },
      },
      text: [["S1", `${dialectTag}${text}`]],
    };

    const apiPrompt = {
      "1": { class_type: "LoadAudio", inputs: { audio: flatName } },
      "3": {
        class_type: "SoulXPodcastLoader",
        inputs: { model_name: "SoulX-Podcast-1.7B-dialect", llm_engine: "hf", fp16_flow: false, seed: Math.floor(Math.random() * 1e9) },
      },
      "4": {
        class_type: "SoulXPodcastInputParser",
        inputs: {
          soulx_model: ["3", 0],
          S1_prompt_audio: ["1", 0],
          input_mode: "json",
          dialogue_script: "",
          json_config: JSON.stringify(jsonConfig),
        },
      },
      "5": {
        class_type: "SoulXPodcastGenerate",
        inputs: {
          soulx_model: ["3", 0],
          podcast_input: ["4", 0],
          seed: Math.floor(Math.random() * 1e9),
          temperature: 0.7,
          repetition_penalty: 1.3,
          top_k: 100,
          top_p: 0.9,
          min_tokens: 8,
          max_tokens: 3000,
        },
      },
      "6": {
        class_type: "SaveAudio",
        inputs: { audio: ["5", 0], filename_prefix: "soulx/voice_preview" },
      },
    };

    // 提交本地 ComfyUI（comfyUrl 已在函数开头声明）
    const r = await fetch(`${comfyUrl}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: apiPrompt, client_id: `voice-preview-${Date.now()}` }),
    });
    const j: any = await r.json();
    if (!r.ok || !j.prompt_id) {
      res.status(502).json({ message: `ComfyUI 提交失败：${JSON.stringify(j).slice(0, 300)}` });
      return;
    }
    res.json({ data: { promptId: j.prompt_id } });
  } catch (e: any) {
    res.status(400).json({ message: e?.message ?? "提交失败" });
  }
});

// GET /api/voice/preview/:promptId —— 轮询合成结果，返回音频 URL（完成后）
router.get("/voice/preview/:promptId", async (req, res) => {
  try {
    const promptId = req.params.promptId;
    const comfyUrl = process.env.DIRECTOR_COMFYUI_URL || "http://127.0.0.1:9312";
    const r = await fetch(`${comfyUrl}/history/${promptId}`);
    const j: any = await r.json();
    const entry = j[promptId];
    if (!entry) {
      res.json({ data: { status: "running" } });
      return;
    }
    if (entry.status?.status_str === "error") {
      res.json({ data: { status: "error", message: JSON.stringify(entry.status).slice(0, 300) } });
      return;
    }
    const audio = entry.outputs?.["6"]?.audio?.[0];
    if (audio) {
      res.json({
        data: {
          status: "done",
          // 经 server 代理播放（ComfyUI 无 CORS 头，浏览器跨域拦截 <audio>）
          url: `/api/voice/audio/${encodeURIComponent(audio.filename)}?type=${audio.type}&subfolder=${encodeURIComponent(audio.subfolder || "")}`,
          filename: audio.filename,
        },
      });
    } else {
      res.json({ data: { status: "running" } });
    }
  } catch (e: any) {
    res.status(502).json({ message: e?.message ?? "查询失败" });
  }
});

// GET /api/voice/audio/:filename —— 代理播放 ComfyUI 合成音频（server 加 CORS，前端可跨域播放）
router.get("/voice/audio/:filename", async (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const type = (req.query.type as string) ?? "output";
    const subfolder = (req.query.subfolder as string) ?? "";
    const comfyUrl = process.env.DIRECTOR_COMFYUI_URL || "http://127.0.0.1:9312";
    const url = `${comfyUrl}/view?filename=${encodeURIComponent(filename)}&type=${encodeURIComponent(type)}&subfolder=${encodeURIComponent(subfolder)}`;
    const r = await fetch(url);
    if (!r.ok) {
      res.status(502).json({ message: "音频拉取失败" });
      return;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", r.headers.get("content-type") ?? "audio/flac");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Accept-Ranges", "bytes");
    res.send(buf);
  } catch (e: any) {
    res.status(502).json({ message: e?.message ?? "代理失败" });
  }
});

export default router;
