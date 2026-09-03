# -*- coding: utf-8 -*-
"""九尾狐 AI 服务：FastAPI + LangChain（DeepSeek）
能力：剧本 → 分镜卡列表（三段式提示词 + 运镜描述）
运行：conda run -n langchain python -m uvicorn main:app --port 8001
"""
import json
import os
import re
import threading

from fastapi import FastAPI, Header, HTTPException
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from pydantic import BaseModel

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def load_env():
    """极简 .env 加载（避免额外依赖）"""
    env_path = os.path.join(BASE_DIR, ".env")
    if os.path.exists(env_path):
        with open(env_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip())


load_env()

app = FastAPI(title="九尾狐 AI 服务")


class SplitRequest(BaseModel):
    script: str
    # 项目手册配置（来自项目设置，用于风格/叙事约束）
    visual_skill: str = ""  # 视觉手册（art_skills 画风）
    director_skill: str = ""  # 导演手册（story_skills 叙事）
    video_ratio: str = "9:16"  # 影片比例
    scene_directors: dict = {}  # 按场导演覆盖：{sceneIndex: "Director_XXX"}，指定场的镜头语言改用该导演（如打斗段用徐克）


class NovelToScriptRequest(BaseModel):
    novel: str
    episode_count: int = 0  # 生成集数（0=按全剧时长自动分析；兼容旧调用传 1-10）
    total_duration_min: int = 0  # 全剧总时长（分钟）；>0 时集数自动分析（每集约 5 分钟、最后一集 ≤5 分钟）
    visual_skill: str = ""
    director_skill: str = ""
    video_ratio: str = "9:16"


class GenerateDirectorHandbookRequest(BaseModel):
    director_name: str  # 导演名称（中文名，如「李安」）
    extra_hint: str = ""  # 可选补充要求（风格侧重等）


def load_skill(name: str) -> str:
    path = os.path.join(BASE_DIR, "skills", f"{name}.md")
    with open(path, encoding="utf-8") as f:
        return f.read()


def load_category_skill(category: str, name: str) -> str:
    """读取分类技能（art_skills/story_skills），不存在返回空"""
    if not name:
        return ""
    path = os.path.join(BASE_DIR, "skills", category, f"{name}.md")
    if not os.path.exists(path):
        return ""
    with open(path, encoding="utf-8") as f:
        return f.read()


def get_llm(x_api_key: str | None = None) -> ChatOpenAI:
    api_key = x_api_key or os.environ.get("DEEPSEEK_API_KEY", "")
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="未配置 DeepSeek API Key（设置页填写或 apps/ai/.env 配置 DEEPSEEK_API_KEY）",
        )
    return ChatOpenAI(
        model=os.environ.get("DEEPSEEK_MODEL", "deepseek-chat"),
        api_key=api_key,
        base_url=os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
        temperature=0.7,
        timeout=120,
        max_tokens=16000,  # deepseek-chat 实际输出上限约 8000 tokens；拆镜须控制分镜粒度避免截断
    )


def _clean_script_text(text: str) -> str:
    """清理剧本文本（紧凑模式）：删除所有段落间空行，只在「场」标题（## 场 N）之间保留一个空行。
    LLM 输出常在每个【画面】/【动作】/对白段间插入空行，前端展示冗长；统一为紧凑排版。"""
    if not text:
        return text
    lines = [ln.rstrip() for ln in text.replace("\r\n", "\n").split("\n")]
    out: list[str] = []
    for ln in lines:
        stripped = ln.strip()
        if not stripped:
            continue  # 丢弃所有段落间空行
        # 场标题之间保留一个空行（场标题之前插入空行，首场除外）
        if stripped.startswith("## 场") and out:
            out.append("")
        out.append(ln)
    # 去掉首尾空行
    while out and not out[0].strip():
        out.pop(0)
    while out and not out[-1].strip():
        out.pop()
    return "\n".join(out).strip()


def normalize_ref2va_fieldnames(text: str) -> str:
    """把 LLM 可能本地化的 Ref2VA 六段字段名强制替换回官方英文。
    支持中英混合写法（如「详细描述：」「画面描述（integrated_multimodal_description）」）。"""
    if not text:
        return text
    # (本地化名|英文名) → 官方英文。按出现顺序替换，避免二次匹配。
    replacements = [
        # 详细描述 / 画面描述（可能带括号英文残留，如「详细描述（detailed_description）:」）
        (r"详细描述[（(]?detailed_description[）)]?\s*[：:]", "detailed_description:"),
        (r"详细描述\s*[：:]", "detailed_description:"),
        (r"画面描述（?integrated_multimodal_description）?\s*[：:]", "detailed_description:"),
        (r"integrated_multimodal_description\s*[：:]", "detailed_description:"),
        # 主体定义
        (r"主体定义\s*[：:]", "subject_definitions:"),
        (r"主体定义与参考标签\s*[：:]", "subject_definitions:"),
        # 摘要
        (r"摘要\s*[：:]", "summary:"),
        # 保留分析
        (r"保留分析\s*[：:]", "retention_analysis:"),
        (r"保留等级分析\s*[：:]", "retention_analysis:"),
        # 环境音
        (r"环境音\s*[：:]", "overall_soundscape:"),
        (r"整体环境音\s*[：:]", "overall_soundscape:"),
        # 配乐
        (r"配乐\s*[：:]", "non_diegetic_music:"),
        (r"观众可闻配乐\s*[：:]", "non_diegetic_music:"),
    ]
    for pat, rep in replacements:
        text = re.sub(pat, rep, text)
    return text


def extract_json(text: str):
    """从 LLM 输出中提取 JSON（容忍 markdown 代码块与前后杂文；支持数组与对象）
    增强：当整体解析失败时，用 raw_decode 流式解析顶层元素，容忍数组内元素间多余内容。"""
    text = text.strip()
    # 去掉 ```json ... ``` 包裹
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    # 优先尝试整体解析
    try:
        return json.loads(text)
    except Exception:
        pass
    # 截取第一个 [ 到最后一个 ]（数组）整体解析——容忍数组前后的杂文
    start = text.find("[")
    end = text.rfind("]")
    if start >= 0 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except Exception:
            pass
    # 截取第一个 { 到最后一个 }（对象）整体解析
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except Exception:
            pass
    # 流式解析：raw_decode 依次读顶层值（数组/对象），容忍元素间多余文本
    def stream_parse(s: str):
        decoder = json.JSONDecoder()
        idx = 0
        values = []
        while idx < len(s):
            while idx < len(s) and s[idx] in " \t\r\n,;|":
                idx += 1
            if idx >= len(s):
                break
            if s[idx] in "[{":
                try:
                    val, end = decoder.raw_decode(s, idx)
                except Exception:
                    return None
                values.append(val)
                idx = end
            else:
                # 非 JSON 起始字符：跳过到下一个 [ 或 {
                nxt = len(s)
                for marker in "[{":
                    p = s.find(marker, idx)
                    if p >= 0:
                        nxt = min(nxt, p)
                if nxt >= len(s):
                    break
                idx = nxt
        return values
    vals = stream_parse(text)
    if vals:
        # 数组整体 → 返回该数组；单个对象 → 返回对象；多个对象 → 返回合并后的数组
        if len(vals) == 1:
            return vals[0]
        return vals
    raise ValueError("未找到 JSON 内容")


@app.get("/ai/health")
def health():
    return {"ok": True, "service": "nine-tailed-fox-ai"}


@app.post("/ai/storyboard-split")
def storyboard_split(req: SplitRequest, x_api_key: str | None = Header(default=None)):
    if not req.script.strip():
        raise HTTPException(status_code=400, detail="剧本为空")
    skill = _escape_braces(load_skill("storyboard_split"))
    h3_skill = _load_minimax_h3_skill()
    emotion_skill = _load_emotion_skill()

    # 注入项目手册：画风（视觉手册 / 未选时回退导演电影美学）+ 导演手册（叙事）+ 影片比例
    visual_label, visual = _resolve_visual_style(req.visual_skill, req.director_skill)
    director = load_category_skill("story_skills", req.director_skill)
    ratio_hint = {
        "9:16": "竖屏 9:16 短剧构图",
        "16:9": "横屏 16:9 电影构图",
        "1:1": "方形 1:1 构图",
    }.get(req.video_ratio, f"构图比例 {req.video_ratio}")
    print(
        f"[storyboard-split] 手册注入: visual={req.visual_skill or visual_label or '(无)'} "
        f"director={req.director_skill or '(无)'} ratio={req.video_ratio}",
        flush=True,
    )

    parts = [skill]
    parts.append(
        "\n## 技能职责分区（必须严格遵守）\n"
        "- **prompt（生图提示词，三段式：画面/光影/风格）**：画面风格遵循【本项目视觉手册（画风）】，"
        "只用于分镜图生成；不要在此部分使用导演叙事/情绪表演内容。\n"
        "- **videoDesc（视频生成提示词）**：叙事结构与镜头语言遵循【本项目导演手册】，"
        "人物情绪/表情/眼神/微动作遵循【角色情绪与微表情表演规范】，"
        "格式严格遵循【Minimax H3 提示词方法论】。画风手册不用于 videoDesc。\n"
        "- 两个字段职责分离：prompt 管「静态画面」，videoDesc 管「动态影像」。"
    )
    if h3_skill:
        parts.append(f"\n## Minimax H3 提示词方法论（videoDesc 必须严格遵循：I2VA 三字段结构/导演三问/镜头语言/时间线/连续性）\n{h3_skill}\n\n## 视频提示词语言规范（优先级最高）\n{H3_LANG_RULE}")
    if emotion_skill:
        parts.append(f"\n## 角色情绪与微表情表演规范（通用角色演出层：适用于所有导演手册，与本项目导演手册叠加使用；仅 videoDesc 使用；prompt 不用。涉及人物情绪、表情、眼神、微动作时必须遵循：把情绪写成可见动作过程，避免'悲伤/震惊'等空洞标签）\n{emotion_skill}")
    if visual:
        parts.append(f"\n## 本项目{visual_label}·静态资产画风（职责：角色/场景/道具/分镜首帧图的生图提示词；仅 prompt 生图使用，videoDesc 不用）\n{visual}")
    if director:
        parts.append(f"\n## 本项目导演手册（职责边界：仅用于 videoDesc 视频提示词，生图 prompt 不使用；提供叙事手法+视听语言+镜头风格倾向根。静态画面画风以项目视觉手册为准，本手册风格根只指导镜头语言与画面氛围，不与视觉手册冲突）\n{director}")
    # 按场导演覆盖（scene_directors）：指定场的镜头语言改用对应导演手册（如铸剑打斗段用徐克）
    if req.scene_directors:
        scene_director_lines = []
        for scene_key, dir_name in sorted(req.scene_directors.items(), key=lambda x: str(x[0])):
            try:
                scene_no = int(scene_key)
            except (TypeError, ValueError):
                continue
            scene_dir = load_category_skill("story_skills", dir_name)
            if not scene_dir:
                continue
            scene_director_lines.append(
                f"### 第 {scene_no} 场·导演覆盖为「{dir_name}」\n"
                f"本场（sceneIndex={scene_no}）的 videoDesc 镜头语言与节奏**改用以下导演手册**，"
                f"覆盖项目默认导演；其余场仍遵循项目默认导演。\n{scene_dir}"
            )
        if scene_director_lines:
            parts.append("\n## 按场导演覆盖（重要：指定场次用覆盖导演，其余场用默认导演）\n" + "\n\n".join(scene_director_lines))
            print(f"[storyboard-split] 按场导演覆盖: { {k: v for k, v in req.scene_directors.items()} }", flush=True)
    # 整合 novel-to-script-team 方法论：剧本视觉化改写（情绪动作化）+ 分镜画面要素检查
    viz_skill = _escape_braces(load_skill("script_visualize"))
    if viz_skill:
        parts.append(f"\n## 剧本视觉化改写（Show Don't Tell，情绪动作化铁律）：prompt 与 videoDesc 的画面描述禁止出现情绪形容词（伤心/愤怒/害怕/失望等），必须翻译为可拍动作（咬唇/握拳指节泛白/后退抵墙/垂眼）；参照此技能的情绪翻译表与视觉化检查\n{viz_skill}")
    frame_skill = _escape_braces(load_skill("frame_description_elements"))
    if frame_skill:
        parts.append(f"\n## 分镜画面描述要素（prompt 的【画面】必须含 7 项必备要素：景别/机位角度/方位构图/光线类型/人物位置/人物朝向/姿态动作；近景特写补表情眼神/光源方向/光影效果，全景远景补前景/背景/景深/人物距离；参照此技能完整检查表）\n{frame_skill}")
    parts.append(f"\n## 画面构图约束\n本项目影片比例为 {req.video_ratio}（{ratio_hint}），所有分镜构图遵循该比例。")
    parts.append(
        _escape_braces(
            "\n## 输出格式（必须严格遵守）\n"
            "只输出 JSON 对象（不要 markdown 代码块标记），结构如下：\n"
            "顶层对象含两个字段：visualDict（视觉词典对象）与 storyboards（分镜数组）。\n"
            "visualDict = {\"characters\": [{\"name\": \"角色名\", \"look\": \"外貌锁定一句\", \"outfit\": \"服装一句\"}], "
            "\"scenes\": [{\"name\": \"场景名\", \"space\": \"空间锁定一句\", \"light\": \"光照一句\"}], "
            "\"props\": [{\"name\": \"道具名\", \"look\": \"外观一句\", \"state\": \"状态变化一句\"}]}\n"
            "storyboards 每项 = {\"index\": 0, \"sceneIndex\": 1, \"duration\": 8, \"prompt\": \"...\", \"videoDesc\": \"...\"}\n"
            "visualDict 精简：每词条 1-2 句。"
        )
    )

    system = "\n".join(parts)
    prompt = ChatPromptTemplate.from_messages(
        [("system", system), ("human", "剧本：\n{script}")]
    )
    chain = prompt | get_llm(x_api_key)
    try:
        result = chain.invoke({"script": req.script})
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM 调用失败: {e}")
    try:
        parsed = extract_json(result.content)
    except Exception as e:
        # 诊断：打印 LLM 原始输出的类型与前后各 300 字符（repr 防转义干扰）
        content = result.content
        raw_repr = repr(content)[:600]
        print(f"[storyboard-split] 解析失败: {e}", flush=True)
        print(f"[storyboard-split] content type={type(content).__name__}", flush=True)
        print(f"[storyboard-split] content repr head: {raw_repr}", flush=True)
        try:
            s = str(content)
            print(f"[storyboard-split] content str head: {s[:300]!r}", flush=True)
            print(f"[storyboard-split] content str tail: {s[-300:]!r}", flush=True)
        except Exception:
            pass
        raise HTTPException(
            status_code=502,
            detail=f"LLM 输出解析失败: {e}",
        )
    # 支持两种输出：对象 {"visualDict":..., "storyboards":[...]} 或旧数组 [...]
    visual_dict = None
    if isinstance(parsed, dict):
        storyboard_list = parsed.get("storyboards", [])
        if not isinstance(storyboard_list, list):
            raise HTTPException(status_code=502, detail="storyboards 不是数组")
        visual_dict = parsed.get("visualDict") if isinstance(parsed.get("visualDict"), dict) else None
    elif isinstance(parsed, list):
        storyboard_list = parsed
    else:
        raise HTTPException(status_code=502, detail="LLM 输出不是对象或数组")
    # 归一化：index 递增、duration 1-15s（Minimax 单次任务上限）
    normalized = []
    for i, item in enumerate(storyboard_list):
        if not isinstance(item, dict):
            continue
        try:
            duration = int(item.get("duration", 6))
        except (TypeError, ValueError):
            duration = 6
        normalized.append(
            {
                "index": int(item.get("index", i)),
                "sceneIndex": int(item.get("sceneIndex", 1) or 1),
                "duration": max(1, min(duration, 15)),
                "prompt": str(item.get("prompt", "")),
                "videoDesc": str(item.get("videoDesc", "")),
            }
        )
    return {"data": normalized, "visualDict": visual_dict}


@app.post("/ai/novel-to-script")
def novel_to_script(req: NovelToScriptRequest, x_api_key: str | None = Header(default=None)):
    """小说 → 按全剧时长切割的精品长篇电影剧本全集（JSON 数组）。
    整片对标院线电影（三幕节奏），分集为 MiniMax H3 技术切割（每段 ≤5 分钟、最后一段 ≤5 分钟），不设每集钩子。
    时长模式：total_duration_min>0 → 段数=ceil(T/5)；
    兼容旧模式：episode_count 1-10 直接指定段数。"""
    novel = (req.novel or "").strip()
    if not novel:
        raise HTTPException(status_code=400, detail="小说内容为空")

    # 集数分析：优先按全剧时长（每集约 5 分钟，最后一集 ≤5 分钟）
    duration_mode = req.total_duration_min and req.total_duration_min > 0
    if duration_mode:
        T = req.total_duration_min
        count = max(1, min((T + 4) // 5, 20))  # ceil(T/5)，1-20 封顶
    else:
        count = max(1, min(req.episode_count or 3, 10))  # 旧模式：1-10

    skill = load_skill("novel_to_script")

    # 实测结论（2026-08-31）：小说→剧本环节，侯孝贤导演手册输出质量最佳；
    # 项目未指定导演时回退到侯孝贤，保证默认结果可控可复现。
    if not req.director_skill:
        req.director_skill = "Director_HouHsiaoHsien"

    visual_label, visual = _resolve_visual_style(req.visual_skill, req.director_skill)
    director = load_category_skill("story_skills", req.director_skill)
    mode_desc = f"全剧 {T} 分钟" if duration_mode else f"指定 {count} 集"
    print(
        f"[novel-to-script] 手册注入: visual={req.visual_skill or visual_label or '(无)'} "
        f"director={req.director_skill or '(无)'} 模式={mode_desc} 集数={count}",
        flush=True,
    )

    parts = [skill]
    if director:
        parts.append(f"\n## 本项目导演手册（叙事风格，必须遵循）\n{director}")
    if visual:
        parts.append(f"\n## 本项目{visual_label}（画面风格参考）\n{visual}")
    if duration_mode:
        parts.append(
            f"\n## 目标（时长模式）\n"
            f"整部短片对标《爱·死亡·机器人》单篇质感：全片总时长 {T} 分钟 → 按技术上限切割为 {count} 段。"
            f"每段约 5 分钟（约 1100-1300 字），最后一段 ≤5 分钟（按其剩余时长对应字数，可短不可超）。"
            f"分集仅为 MiniMax H3 单次视频时长上限与方便修正镜头的技术切割，不是编剧结构："
            f"按整片三幕节奏写作，段尾落在场景/镜头自然边界，不设每段钩子、不制造人工悬念。"
        )
    else:
        parts.append(f"\n## 目标\n改编为共 {count} 段剧本，整片对标《爱·死亡·机器人》单篇，分集为技术切割，不设每段钩子。")

    prompt = ChatPromptTemplate.from_messages(
        [("system", "\n".join(parts)), ("human", "小说原文：\n{novel}")]
    )
    chain = prompt | get_llm(x_api_key)
    try:
        result = chain.invoke({"novel": novel})
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM 调用失败: {e}")
    try:
        parsed = extract_json(result.content)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM 输出解析失败: {e}")
    if not isinstance(parsed, list):
        raise HTTPException(status_code=502, detail="LLM 输出不是数组")
    # 归一化：确保 episode 从 1 递增、script/title 存在；清理多余空行
    episodes = []
    for i, item in enumerate(parsed):
        if not isinstance(item, dict):
            continue
        episodes.append(
            {
                "episode": int(item.get("episode", i + 1)),
                "title": str(item.get("title", f"第 {i + 1} 集")),
                "script": _clean_script_text(str(item.get("script", ""))),
            }
        )
    if not episodes:
        raise HTTPException(status_code=502, detail="未解析到任何集剧本")
    return {"data": {"count": len(episodes), "episodes": episodes}}


@app.post("/ai/generate-director-handbook")
def generate_director_handbook(
    req: GenerateDirectorHandbookRequest, x_api_key: str | None = Header(default=None)
):
    """新增导演手册：输入导演名称 → 联网检索公开资料 → 按 new_director_handbook 规格生成完整手册。
    返回 {content}（frontmatter + 五段 + 十六章节完整版 markdown，可直接保存为 story_skills 技能）。"""
    name = (req.director_name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="导演名称不能为空")

    # 1. 联网检索（Bing 免 key）：导演电影美学 / 代表作 / 镜头语言
    queries = [
        f"{name} 导演 电影美学 镜头语言 代表作品",
        f"{name} 导演 访谈 影像风格 构图 光影",
    ]
    search_results: list[dict] = []
    seen_urls: set[str] = set()
    for q in queries:
        for r in _bing_search(q):
            if r["url"] not in seen_urls:
                seen_urls.add(r["url"])
                search_results.append(r)
        if len(search_results) >= 8:
            break
    print(f"[generate-director-handbook] {name} 检索到 {len(search_results)} 条资料", flush=True)
    search_block = "\n".join(
        f"- {r['title']}｜{r['url']}\n  {r['snippet']}" for r in search_results
    ) or "（未能联网检索到该导演的公开资料，请基于你的知识撰写，但标志性案例必须真实可考）"

    # 2. 规格注入（new_director_handbook：五步规则+标准模板+十六章节骨架+硬性要求）
    spec = _escape_braces(load_skill("new_director_handbook"))
    # 注入一个完整版范例（李安手册）供结构参考
    example = _escape_braces(load_category_skill("story_skills", "Director_AngLee"))

    parts = [
        f"\n## 编写规格（必须严格遵循）\n{spec}",
        f"\n## 联网检索到的公开资料（以此为事实依据，提炼该导演真实风格；资料不足时可结合你的知识补充，但不得编造不存在的电影/技法）\n{search_block}",
        "\n## 结构范例（参照其章节组织与详略，但内容必须属于目标导演）\n"
        "下面是已存在手册 Director_AngLee 的完整结构范例，仅作章节骨架与写作深度的参照：\n"
        f"{example}",
        "\n## 任务\n"
        f"为导演「{name}」编写完整导演手册。\n"
        "- 输出为 Markdown 纯文本（不要代码块围栏、不要 JSON、不要解释性前言）\n"
        "- frontmatter 必须包含：name（英文小写下划线文件名，形如 director_xxx）/ displayName（导演中文名）/ "
        "description（以「知名导演『中文名』导演手册——完整版视听语言法则（…）」开头，列举该导演标志技法）/ "
        "aesthetic（「中文名电影美学」）/ metaData: production_skills\n"
        "- 正文前置五段（**缺一不可，顺序固定**）：\n"
        "  ① `## <中文名> · 导演专属电影美学（静态画面·资产·首帧控制）`——含美学名称/概述/静态画面控制"
        "（色彩/光影/构图/质感/人物/背景，每条可落生图提示词）/核心视听法则/参考片例\n"
        "  ② `## 代表作视觉 DNA（电影质感强化）`——含 共性视觉 DNA（跨作品稳定规律：色彩系统/影调曝光/灯光/构图/镜头运镜）"
        "＋ 逐部代表作视觉参数（每部含色彩/灯光/构图/镜头/材质/声音与节奏，结尾 → 转提示词）＋ 该导演·提示词速查\n"
        "  ③ `## 一、<中文名> · <定位短语>叙事（<风格标签>）`——核心叙事手法＋短剧适配\n"
        "  ④ `## 二、<中文名> · 视听语言`——构图/运镜/色彩光影/剪辑声音＋风格提示词根（代码块）\n"
        "  ⑤ `## 三、<中文名> · 分镜表手法`——镜头序列/景别节奏/镜间衔接/分镜表特征/短剧应用\n"
        "- 五段之后展开十六章节完整版：`# 完整版 · <中文名>电影画面美学（十六章节）`\n"
        "（概述/至少10个技法章节/与其他大师差异表/实操设计检查清单/核心片单/导演自述/参考文献）\n"
        "- 标志性案例必须真实（该导演真实电影中的真实场景），禁止编造；参考文献列出来源（影评/期刊/访谈）\n"
        "- **长度预算（硬约束，防止截断）**：全文控制在 300-420 行、约 8000-10500 字符。"
        "每章节精炼：核心法则 1-2 句 + 执行参数表/清单 + 1-2 个标志性案例，禁止冗长散文与重复阐述。\n"
        "- **完整性优先级（最高）**：宁可压缩各章节篇幅，也必须输出完整结尾——"
        "十六章节全部到齐、末尾含 参考文献 与 职责边界两句。绝不允许中途截断；"
        "若感觉篇幅紧张，优先砍掉每个章节的次要案例，而不是省略章节或结尾。\n"
        "- 文末照抄职责边界两句（见规格第五部分硬性要求）\n",
    ]
    if req.extra_hint.strip():
        parts.append(f"\n## 补充要求\n{req.extra_hint.strip()}")

    system = "\n".join(parts)
    prompt = ChatPromptTemplate.from_messages(
        [("system", system), ("human", "请为导演「{name}」生成完整导演手册：")]
    )
    chain = prompt | get_llm(x_api_key)
    try:
        result = chain.invoke({"name": name})
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM 调用失败: {e}")
    content = str(result.content).strip()
    # 剥离可能的 markdown 围栏
    content = re.sub(r"^```(?:markdown|md)?\s*\n?", "", content)
    content = re.sub(r"\n?```\s*$", "", content).strip()
    if not content:
        raise HTTPException(status_code=502, detail="LLM 未返回内容")
    return {"data": {"name": name, "content": content}}


class ScriptCharactersRequest(BaseModel):
    script: str
    visual_skill: str = ""
    director_skill: str = ""
    video_ratio: str = "9:16"


class Ref2VARequest(BaseModel):
    """Ref2VA 提示词生成请求：分镜描述 + 参考资产清单"""
    video_desc: str = ""  # 分镜的视频描述（画面/运镜/台词/音效）
    duration: int = 6  # 视频时长（秒，1-15）
    assets: list[dict] = []  # [{name, type(character/scene/prop), description}]
    visual_skill: str = ""
    director_skill: str = ""
    video_ratio: str = "9:16"


class H3VideoPromptRequest(BaseModel):
    """H3 视频提示词总入口请求（导演路由：单镜 Ref2VA / 多镜 multishot）"""
    video_desc: str = ""  # 分镜的视频描述（画面/运镜/台词/音效）
    duration: int = 6  # 视频时长（秒，1-15）
    assets: list[dict] = []  # [{name, type(character/scene/prop), description}]
    multishot: bool = False  # 是否多镜头（动作多节拍）
    visual_skill: str = ""
    director_skill: str = ""
    video_ratio: str = "9:16"


def _load_official_ref_guide() -> str:
    """读取官方 Ref2VA 改写格式指南（不存在返回空）"""
    ref_guide_path = os.path.join(BASE_DIR, "skills", "h3-prompt-writing", "references", "ref-en.txt")
    if os.path.exists(ref_guide_path):
        with open(ref_guide_path, encoding="utf-8") as f:
            return f.read()
    return ""


def _strip_frontmatter(text: str) -> str:
    """剥离 Markdown frontmatter（--- 块），避免其中的指令（如"用英文写"）干扰 LLM"""
    if text.startswith("---"):
        end = text.find("\n---", 3)
        if end > 0:
            return text[end + 4 :]
    return text


def _escape_braces(text: str) -> str:
    """LangChain f-string 模板转义：所有 { → {{、所有 } → }}（无条件双写，保证可逆）。
    注意不能只对「单个」花括号转义：相邻花括号（如 JSON 示例 {...}}）必须全部双写，
    f-string 解析时 {{、}} 各还原为单个字面量，序列长度总是 2N，往返无损。"""
    return text.replace("{", "{{").replace("}", "}}")


def _bing_search(query: str, n: int = 6, timeout: int = 15) -> list[dict]:
    """Bing 网页搜索（免 key）：返回 [{title, url, snippet}]，失败返回 []。
    用于「新增导演手册」时联网检索导演公开资料（电影美学/镜头语言/代表作）。"""
    import urllib.parse
    import urllib.request

    try:
        url = "https://www.bing.com/search?q=" + urllib.parse.quote(query) + "&setlang=zh-hans"
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
        )
        html = urllib.request.urlopen(req, timeout=timeout).read().decode("utf-8", "ignore")
    except Exception as e:
        print(f"[bing-search] 请求失败: {e}", flush=True)
        return []
    results: list[dict] = []
    for m in re.finditer(r'<li class="b_algo".*?</li>', html, re.S):
        block = m.group(0)
        tm = re.search(r'<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>', block, re.S)
        if not tm:
            continue
        url = tm.group(1)
        title = re.sub(r"<[^>]+>", "", tm.group(2)).strip()
        pm = re.search(r"<p[^>]*>(.*?)</p>", block, re.S)
        snippet = re.sub(r"<[^>]+>", "", pm.group(1)).strip() if pm else ""
        if title:
            results.append({"title": title, "url": url, "snippet": snippet[:300]})
        if len(results) >= n:
            break
    return results


def _load_emotion_skill() -> str:
    """读取角色情绪与微表情表演规范（emotion_microexpression.md 核心章节）：
    默认原则 / 工作流程（简报·基准·触发·通道·弧线·身体道具·时间轴·稳定性·真实向约束）/
    单一表情·复合情绪·禁忌 / 微表情库使用规则·强度节奏·易混情绪·原子动作词典。
    按章节标记提取（不依赖行号，技能文件编辑新增章节不会错位），控制注入体积。"""
    path = os.path.join(BASE_DIR, "skills", "emotion_microexpression.md")
    if not os.path.exists(path):
        return ""
    with open(path, encoding="utf-8") as f:
        lines = f.read().splitlines()

    def slice_between(start_marker: str, end_marker: str) -> list[str]:
        """提取从 start_marker 章节到 end_marker 章节之间的内容（含起止章节正文）"""
        out: list[str] = []
        active = False
        for ln in lines:
            stripped = ln.strip()
            if active and stripped.startswith(end_marker):
                break
            if active:
                out.append(ln)
            if not active and stripped.startswith(start_marker):
                active = True
        return out

    # 方法论核心：默认原则 ~ 禁忌；微表情库：使用规则 ~ 道具反馈（不含 A-F 模块全文）
    core = slice_between("## 默认原则", "## 示例")
    library = slice_between("## 使用规则", "## A. 自然、认知与思考")
    return _escape_braces("\n".join(core + ["\n# 内置微表情与演员微动作库（核心）\n"] + library))


def _load_director_aesthetic(director_skill: str) -> tuple[str, str]:
    """读取导演手册的「导演专属电影美学」：返回 (美学名称, 章节正文)；
    无 aesthetic 字段或章节时返回 (None, "")。"""
    if not director_skill:
        return "", ""
    path = os.path.join(BASE_DIR, "skills", "story_skills", f"{director_skill}.md")
    if not os.path.exists(path):
        return "", ""
    with open(path, encoding="utf-8") as f:
        text = f.read()
    m = re.search(r"^aesthetic:\s*(.+)$", text, re.M)
    aesthetic = m.group(1).strip() if m else ""
    sm = re.search(
        r"^#{2,3}\s+[^\n]*导演专属电影美学[^\n]*\n(.*?)(?=^#{1,3}\s+\S|\Z)",
        text,
        re.M | re.S,
    )
    section = sm.group(1).strip() if sm else ""
    return aesthetic, section


def _resolve_visual_style(visual_skill: str, director_skill: str) -> tuple[str, str]:
    """画面画风解析（资产/分镜首帧的静态画风控制）：
    优先视觉手册（art_skills）；未选视觉手册时回退导演专属电影美学。
    返回 (来源标签, 正文)。"""
    if visual_skill:
        return "视觉手册", load_category_skill("art_skills", visual_skill)
    aesthetic, section = _load_director_aesthetic(director_skill)
    if section:
        label = f"导演专属电影美学（{aesthetic or director_skill}）"
        return label, section
    return "视觉手册", ""


def _load_minimax_h3_skill() -> str:
    """读取 minimax-h3-prompt-skill（SKILL.md + 中文模板/术语表 + r2v 案例），不存在返回空
    模板占位符 {xxx} 转义为 {{xxx}}，避免被 LangChain 当作模板变量。"""
    skill_dir = os.path.join(BASE_DIR, "skills", "minimax-h3-prompt-skill")
    parts = []
    for rel in (
        "SKILL.md",
        "prompts/glossaries.md",
        "prompts/i2v-templates.md",
        "prompts/r2v-templates.md",
        "examples/r2v-examples.md",
    ):
        p = os.path.join(skill_dir, rel)
        if os.path.exists(p):
            with open(p, encoding="utf-8") as f:
                text = _strip_frontmatter(f.read())
            parts.append(_escape_braces(text))
    return "\n\n".join(parts)


# H3 提示词语言规范（中文输出版）：格式元素保留英文原样，正文用中文
H3_LANG_RULE = (
    "- 输出语言：提示词正文一律用中文书写（H3 支持中文正文，能正常出片）。"
    "integrated_multimodal_description / overall_soundscape / non_diegetic_music 的正文必须是中文，"
    "禁止输出英文描述性正文（方法论文档中的英文仅为格式示例，不要照抄成英文正文）。\n"
    "- 保留的格式元素（不可翻译）：字段名 integrated_multimodal_description / overall_soundscape / "
    "non_diegetic_music（Ref2VA 六段式为 subject_definitions / summary / retention_analysis / "
    "detailed_description / overall_soundscape / non_diegetic_music）；标签 <Picture N> / <Subject N> / "
    "<Video N> / <Audio N>；镜头标记 [Shot N]；对白/歌词/画面可见文字用 <d>[语言]原文</d> 保留原语言（如 <d>[zh-CN]…</d>）。\n"
    "- 字段名、标签、镜头标记必须与英文原版完全一致，仅正文描述性文字用中文。"
)


@app.post("/ai/h3-video-prompt")
def h3_video_prompt(req: H3VideoPromptRequest, x_api_key: str | None = Header(default=None)):
    """分镜 → H3 视频提示词（导演路由：creative-director + multishot-planner + ref2va 三技能）"""
    desc = (req.video_desc or "").strip()
    if not desc:
        raise HTTPException(status_code=400, detail="分镜视频描述为空")
    if not req.assets:
        raise HTTPException(status_code=400, detail="缺少参考资产（需至少一张角色/场景/道具图）")

    director = load_skill("h3_creative_director")
    multishot = load_skill("h3_multishot_planner")
    ref2va = load_skill("h3_ref2va_prompt")
    ref_guide = _load_official_ref_guide()
    h3_skill = _load_minimax_h3_skill()
    emotion_skill = _load_emotion_skill()
    director_master = load_category_skill("story_skills", req.director_skill)

    parts = [director]
    if director_master:
        parts.append(f"\n## 本项目导演手册（叙事手法+视听语言+镜头风格倾向根，视频叙事与镜头语言必须遵循；静态画面画风以项目视觉手册为准，本手册不覆盖画风）\n{director_master}")
    parts.append(f"\n## 多镜头规划规则（仅当分镜为多镜头/多动作节拍时使用）\n{multishot}")
    parts.append(f"\n## Ref2VA 六段式输出规范（最终输出格式）\n{ref2va}")
    if ref_guide:
        parts.append(f"\n## 官方 Ref2VA 改写格式指南（必须遵循）\n{ref_guide}")
    if h3_skill:
        parts.append(f"\n## MiniMax H3 提示词方法论（内置 skill，必须遵循：导演三问/镜头语言/三字段结构/连续性自检/中文模板）\n{h3_skill}")
    if emotion_skill:
        parts.append(f"\n## 角色情绪与微表情表演规范（通用角色演出层：适用于所有导演手册，与本项目导演手册叠加使用；detailed_description 中涉及人物情绪/表情/眼神/微动作时必须遵循：把情绪写成按时间发生的可见动作过程，避免空洞情绪标签；默认真实向表演，保持真实人脸比例/皮肤质感/动作物理，禁止卡通化——表情符号化、情绪开关化、五官夸张、弹跳位移）\n{emotion_skill}")
    parts.append("\n## 职责说明\n本接口只生成视频提示词（不生成静态图提示词），画风手册不适用；画面风格倾向由导演手册的风格提示词根提供，若与项目视觉手册的静态画风冲突，以视觉手册画风为基准，导演风格根仅指导镜头语言与画面氛围。")

    ratio_hint = {
        "9:16": "竖屏 9:16 短剧构图",
        "16:9": "横屏 16:9 电影构图",
        "1:1": "方形 1:1 构图",
    }.get(req.video_ratio, f"构图比例 {req.video_ratio}")

    asset_lines = "\n".join(
        f"- <Picture {i + 1}>（{a.get('type', '')}）{a.get('name', '')}：{a.get('description', '')}"
        for i, a in enumerate(req.assets)
    )
    # 图片语义（2026-09-02 修正）：每张 Picture 都是对应的角色/场景/道具【设定图】本体——
    #   角色图 = 该角色单人全身设定图（人物即图中主体）；场景图 = 环境空镜；道具图 = 静物。
    #   subject_definitions 必须写「<Subject N> = <Picture N>（该图即 X 的设定形象/环境/道具）」，严禁写成
    #   「X 是 Picture N 中的人物」（那会把设定图误读成含人物的场景画面，导致模型不从图取形象）。
    picture_hint = (
        "- 参考图语义：每张 <Picture N> 即对应角色/场景/道具的【设定图】本体——"
        "角色图是该角色的单人全身设定图（画面主体就是该角色本人，形象/服装/面容直接采用）；"
        "场景图是环境空镜（空间布局/光线直接采用）；道具图是静物（外观/材质直接采用）。\n"
        "- subject_definitions 表述规范：一律写「<Subject N> = <Picture N>（该图即 X 的设定形象/环境/道具），形象以此为准、全程保持」；"
        "严禁写「X 是 Picture N 中的人物/出现的角色」这类把设定图当成场景画面的措辞。"
        "subject_definitions 必须严格按真实图片内容定义 Subject，严禁凭空编造图中不存在的对象。"
    )
    parts.append(
        f"\n## 任务\n"
        f"将以下分镜生成 H3 视频提示词。\n"
        f"- 视频时长：{req.duration}s（≤15s，Minimax 单次任务）\n"
        f"- 构图：{req.video_ratio}（{ratio_hint}）\n"
        f"- 参考图（按上传顺序编号为 <Picture N>，上传顺序即 ComfyUI ref_image 顺序）：\n{asset_lines}\n"
        f"{picture_hint}\n"
        f"- 多镜头标记：{'是（按 multishot 规划拆分 Shot 再输出）' if req.multishot else '否（单镜头连续动作）'}\n"
        f"- 一致性要求：<Picture N> 对应角色/场景/道具在视频中按保留等级全量保持（主角/关键道具 fully_preserved）\n"
        f"{H3_LANG_RULE}\n"
        f"- 输出 JSON 对象，字段：mode（ref2va|t2va|multishot）、zh_prompt（中文提示词，遵循三字段/六段式结构）、zh_summary（中文要点）"
    )

    system = "\n".join(parts)
    prompt = ChatPromptTemplate.from_messages(
        [("system", system), ("human", "分镜视频描述：\n{video_desc}")]
    )
    chain = prompt | get_llm(x_api_key)
    try:
        result = chain.invoke({"video_desc": desc})
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM 调用失败: {e}")
    try:
        parsed = extract_json(result.content)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM 输出解析失败: {e}")
    if not isinstance(parsed, dict):
        raise HTTPException(status_code=502, detail="LLM 输出不是对象")
    return {
        "data": {
            "mode": str(parsed.get("mode", "ref2va")),
            "zh_prompt": str(parsed.get("zh_prompt", "")),
            "zh_summary": str(parsed.get("zh_summary", "")),
        }
    }


@app.post("/ai/h3-ref2va-prompt")
def h3_ref2va_prompt(req: Ref2VARequest, x_api_key: str | None = Header(default=None)):
    """分镜 → MiniMax H3 Ref2VA 六段式提示词（人物/场景/道具一致性）"""
    desc = (req.video_desc or "").strip()
    if not desc:
        raise HTTPException(status_code=400, detail="分镜视频描述为空")
    if not req.assets:
        raise HTTPException(status_code=400, detail="缺少参考资产（需至少一张角色/场景/道具图）")

    skill = load_skill("h3_ref2va_prompt")
    # 官方 Ref2VA 改写格式指南（标签/retention/示例）
    ref_guide = _load_official_ref_guide()
    h3_skill = _load_minimax_h3_skill()
    emotion_skill = _load_emotion_skill()
    director_master = load_category_skill("story_skills", req.director_skill)

    parts = [skill]
    if director_master:
        parts.append(f"\n## 本项目导演手册（叙事手法+视听语言+镜头风格倾向根，视频叙事与镜头语言必须遵循；静态画面画风以项目视觉手册为准，本手册不覆盖画风）\n{director_master}")
    if ref_guide:
        parts.append(f"\n## 官方 Ref2VA 改写格式指南（必须遵循）\n{ref_guide}")
    if h3_skill:
        parts.append(f"\n## MiniMax H3 提示词方法论（内置 skill，必须遵循：Ref2VA 六段式/连续性自检/中文模板）\n{h3_skill}")
    if emotion_skill:
        parts.append(f"\n## 角色情绪与微表情表演规范（通用角色演出层：适用于所有导演手册，与本项目导演手册叠加使用；detailed_description 中涉及人物情绪/表情/眼神/微动作时必须遵循：把情绪写成按时间发生的可见动作过程，避免空洞情绪标签；默认真实向表演，保持真实人脸比例/皮肤质感/动作物理，禁止卡通化——表情符号化、情绪开关化、五官夸张、弹跳位移）\n{emotion_skill}")
    parts.append("\n## 职责说明\n本接口只生成视频提示词（不生成静态图提示词），画风手册不适用；画面风格倾向由导演手册的风格提示词根提供，若与项目视觉手册的静态画风冲突，以视觉手册画风为基准，导演风格根仅指导镜头语言与画面氛围。")
    # 整合 novel-to-script-team 方法论：情绪动作化 + 画面要素（detailed_description 更可执行）
    viz_skill = _escape_braces(load_skill("script_visualize"))
    if viz_skill:
        parts.append(f"\n## 剧本视觉化改写（Show Don't Tell，detailed_description 情绪动作化铁律）：涉及人物情绪/表情/眼神时，把情绪写成按时间发生的可见动作过程（刺激抵达→本能反应→压住反应→身体泄露→作出选择→留下余波），禁止情绪形容词；参照此技能的情绪翻译表\n{viz_skill}")
    frame_skill = _escape_braces(load_skill("frame_description_elements"))
    if frame_skill:
        parts.append(f"\n## 分镜画面描述要素（detailed_description 的镜头句参照：景别/机位角度/构图/光线/人物位置朝向姿态等要素，保证画面可执行；近景特写补表情眼神/光源方向/光影效果）\n{frame_skill}")
    ratio_hint = {
        "9:16": "竖屏 9:16 短剧构图",
        "16:9": "横屏 16:9 电影构图",
        "1:1": "方形 1:1 构图",
    }.get(req.video_ratio, f"构图比例 {req.video_ratio}")

    asset_lines = "\n".join(
        f"- <Picture {i + 1}>（{a.get('type', '')}）{a.get('name', '')}：{a.get('description', '')}"
        for i, a in enumerate(req.assets)
    )
    parts.append(
        f"\n## 任务\n"
        f"将以下分镜生成 H3 Ref2VA 六段式提示词。\n"
        f"- 视频时长：{req.duration}s（≤15s，Minimax 单次任务）\n"
        f"- 构图：{req.video_ratio}（{ratio_hint}）\n"
        f"- 参考资产（按上传顺序编号为 <Picture N>）：\n{asset_lines}\n"
        f"- 一致性要求：<Picture N> 对应角色/场景/道具在视频中按保留等级全量保持（主角/关键道具 fully_preserved）\n"
        f"- 输出格式（铁律）：六段字段名必须原样保留英文，顺序为——\n"
        f"  `subject_definitions:` → `summary:` → `retention_analysis:` → `detailed_description:` → `overall_soundscape:` → `non_diegetic_music:`\n"
        f"  **禁止把 detailed_description 写成『详细描述』或其他中文/本地化形式**；禁止使用 integrated_multimodal_description（那是 T2VA/I2VA 单镜字段名，Ref2VA 不用）\n"
        f"  zh_prompt 的六段字段名必须严格按下述骨架（英文原样，不可翻译）：\n"
        f"  subject_definitions:\n"
        f"  summary:\n"
        f"  retention_analysis:\n"
        f"  detailed_description:\n"
        f"  overall_soundscape:\n"
        f"  non_diegetic_music:\n"
        f"- retention_analysis 每行带出现镜头标注，官方格式：`<Subject N> (appears in [Shot 1], [Shot 3]): fully_preserved - ...`\n"
        f"- 风格总述写在 detailed_description 的 `[Shot 1]` 之前（1-2 句）\n"
        f"- 参考图数量：单镜 1-3 张、整片 ≤5-6 张，群臣等多角色只保 2-3 个最有辨识度的\n"
        f"{H3_LANG_RULE}\n"
        f"- 输出 JSON 对象，字段：zh_prompt（中文提示词，六段式结构，字段名保留英文原样）、zh_summary（中文要点）"
    )

    system = "\n".join(parts)
    prompt = ChatPromptTemplate.from_messages(
        [("system", system), ("human", "分镜视频描述：\n{video_desc}")]
    )
    chain = prompt | get_llm(x_api_key)
    try:
        result = chain.invoke({"video_desc": desc})
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM 调用失败: {e}")
    try:
        parsed = extract_json(result.content)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM 输出解析失败: {e}")
    if not isinstance(parsed, dict):
        raise HTTPException(status_code=502, detail="LLM 输出不是对象")
    zh_prompt = str(parsed.get("zh_prompt", ""))
    # 字段名规范化：LLM 可能把六段字段名本地化（如「详细描述:」），强制替换回官方英文
    zh_prompt = normalize_ref2va_fieldnames(zh_prompt)
    return {
        "data": {
            "zh_prompt": zh_prompt,
            "zh_summary": str(parsed.get("zh_summary", "")),
        }
    }


@app.post("/ai/script-characters")
def script_characters(req: ScriptCharactersRequest, x_api_key: str | None = Header(default=None)):
    """分析单集剧本 → 本集出场人物清单（JSON 数组）"""
    script = (req.script or "").strip()
    if not script:
        raise HTTPException(status_code=400, detail="剧本为空")
    skill = load_skill("character_generation")
    director = load_category_skill("story_skills", req.director_skill)
    parts = [skill]
    parts.append(f"\n## 本任务职责\n本任务是【角色生成总控】的步骤一·角色清单提取（单集剧本）。仅应用该技能的「步骤一：角色清单提取」章节，输出本集出场人物清单，不进入四视图/设定资产生成。")
    if director:
        parts.append(f"\n## 本项目导演手册（叙事风格参考）\n{director}")
    parts.append(f"\n## 任务\n分析以下单集剧本，提取本集出场人物。")

    prompt = ChatPromptTemplate.from_messages(
        [("system", "\n".join(parts)), ("human", "单集剧本：\n{script}")]
    )
    chain = prompt | get_llm(x_api_key)
    try:
        result = chain.invoke({"script": script})
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM 调用失败: {e}")
    try:
        parsed = extract_json(result.content)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM 输出解析失败: {e}")
    if not isinstance(parsed, list):
        raise HTTPException(status_code=502, detail="LLM 输出不是数组")
    # 归一化：name/role/description
    characters = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name", "")).strip()
        if not name:
            continue
        characters.append(
            {
                "name": name,
                "role": str(item.get("role", "配角")),
                "description": str(item.get("description", "")),
            }
        )
    return {"data": characters}


class ScriptCharactersAllRequest(BaseModel):
    episodes: list[dict] = []  # [{index: 1, script: "..."}]
    visual_skill: str = ""
    director_skill: str = ""
    video_ratio: str = "9:16"


@app.post("/ai/script-characters-all")
def script_characters_all(req: ScriptCharactersAllRequest, x_api_key: str | None = Header(default=None)):
    """分析全部集剧本 → 汇总所有出场人物（含出现集标注）"""
    episodes = [e for e in req.episodes if isinstance(e, dict) and str(e.get("script", "")).strip()]
    if not episodes:
        raise HTTPException(status_code=400, detail="无剧本内容")
    skill = load_skill("character_generation")
    director = load_category_skill("story_skills", req.director_skill)
    parts = [skill]
    parts.append(f"\n## 本任务职责\n本任务是【角色生成总控】的步骤一·角色清单提取（全部集剧本）。仅应用该技能的「步骤一：角色清单提取」章节，汇总所有集出场人物并标注出现集，不进入四视图/设定资产生成。")
    if director:
        parts.append(f"\n## 本项目导演手册（叙事风格参考）\n{director}")
    parts.append("\n## 任务\n分析以下全部集剧本，汇总所有出场人物并标注出现集。")

    # 组装多集剧本输入
    script_text = "\n\n".join(
        f"## 集 {e.get('index', i + 1)}\n{e['script']}" for i, e in enumerate(episodes)
    )
    prompt = ChatPromptTemplate.from_messages(
        [("system", "\n".join(parts)), ("human", "全部集剧本：\n{script}")]
    )
    chain = prompt | get_llm(x_api_key)
    try:
        result = chain.invoke({"script": script_text})
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM 调用失败: {e}")
    try:
        parsed = extract_json(result.content)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM 输出解析失败: {e}")
    if not isinstance(parsed, list):
        raise HTTPException(status_code=502, detail="LLM 输出不是数组")
    # 归一化：name/role/description/episodes
    characters = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name", "")).strip()
        if not name:
            continue
        raw_eps = item.get("episodes", [])
        eps = (
            [int(x) for x in raw_eps if str(x).strip().isdigit()]
            if isinstance(raw_eps, list)
            else []
        )
        characters.append(
            {
                "name": name,
                "role": str(item.get("role", "配角")),
                "description": str(item.get("description", "")),
                "episodes": eps,
            }
        )
    return {"data": characters}


class ScriptEditRequest(BaseModel):
    script: str = ""  # 原剧本全文
    instruction: str = ""  # 用户修改要求
    visual_skill: str = ""
    director_skill: str = ""
    video_ratio: str = "9:16"


@app.post("/ai/script-edit")
def script_edit(req: ScriptEditRequest, x_api_key: str | None = Header(default=None)):
    """按用户修改要求，改写单集剧本 → 返回修改后的完整剧本文本"""
    script = (req.script or "").strip()
    instruction = (req.instruction or "").strip()
    if not script:
        raise HTTPException(status_code=400, detail="剧本为空")
    if not instruction:
        raise HTTPException(status_code=400, detail="修改要求为空")
    skill = load_skill("script_edit")
    director = load_category_skill("story_skills", req.director_skill)
    parts = [skill]
    if director:
        parts.append(f"\n## 本项目导演手册（叙事风格约束，修改须与该导演叙事风格一致）\n{director}")
    parts.append("\n## 修改要求\n严格按用户要求修改，未要求处尽量保留原样，输出完整剧本。")

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", "\n".join(parts)),
            ("human", "原剧本：\n{script}\n\n用户修改要求：\n{instruction}"),
        ]
    )
    chain = prompt | get_llm(x_api_key)
    try:
        result = chain.invoke({"script": script, "instruction": instruction})
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM 调用失败: {e}")
    content = str(result.content or "").strip()
    if not content:
        raise HTTPException(status_code=502, detail="LLM 未返回剧本内容")
    return {"data": {"script": content}}


class PromptEditRequest(BaseModel):
    prompt: str = ""  # 原提示词全文
    instruction: str = ""  # 用户修改要求
    kind: str = "firstframe"  # firstframe（分镜首帧图提示词）/ video（视频生成提示词，H3 结构）
    visual_skill: str = ""
    director_skill: str = ""
    video_ratio: str = "9:16"


@app.post("/ai/prompt-edit")
def prompt_edit(req: PromptEditRequest, x_api_key: str | None = Header(default=None)):
    """按用户要求优化/改写 首帧图提示词 或 视频生成提示词 → 返回完整提示词"""
    prompt = (req.prompt or "").strip()
    instruction = (req.instruction or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="提示词为空")
    if not instruction:
        raise HTTPException(status_code=400, detail="修改要求为空")
    skill = load_skill("prompt_edit")
    kind_hint = {
        "firstframe": "分镜首帧图提示词",
        "video": "视频生成提示词（H3 结构）",
    }.get(req.kind, req.kind)
    parts = [skill]
    parts.append(f"\n## 本任务提示词类型\nkind = {req.kind}（{kind_hint}）。严格按该类型的格式规范输出完整提示词。")

    prompt_tpl = ChatPromptTemplate.from_messages(
        [
            ("system", "\n".join(parts)),
            ("human", "原提示词：\n{prompt}\n\n用户修改要求：\n{instruction}"),
        ]
    )
    chain = prompt_tpl | get_llm(x_api_key)
    try:
        result = chain.invoke({"prompt": prompt, "instruction": instruction})
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM 调用失败: {e}")
    content = str(result.content or "").strip()
    if not content:
        raise HTTPException(status_code=502, detail="LLM 未返回提示词内容")
    return {"data": {"prompt": content}}


class AssetPromptRequest(BaseModel):
    name: str = ""  # 资产名（角色/场景/道具）
    description: str = ""  # 设计描述（资产分析结果）
    kind: str = "character"  # character / scene / prop
    visual_skill: str = ""  # 项目视觉手册
    director_skill: str = ""
    video_ratio: str = "9:16"


@app.post("/ai/asset-prompt")
def asset_prompt(req: AssetPromptRequest, x_api_key: str | None = Header(default=None)):
    """按 角色/资产名 + 设计描述 + 项目视觉手册 → 生成三段式生图提示词（画面/光影/风格/约束）"""
    name = (req.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="资产名为空")
    visual_label, visual = _resolve_visual_style(req.visual_skill, req.director_skill)

    kind_hint = {
        "character": "角色设定图（全身站姿，正面全身照，空白浅色底）",
        "scene": "场景设定图（单画面主视图，前中后景层次，纯场景空镜严禁人物）",
        "prop": "道具设定图（单视图静物图，纯静物严禁人物与手部，构图简洁居中）",
    }.get(req.kind, "设定图")

    # scene 类型追加硬约束：设计描述中的人物/动物/角色行动元素必须剥离（场景设定图只留环境）
    if req.kind == "scene":
        kind_hint += (
            "。特别注意：【设计描述中出现的任何人物、动物、角色行动（如某人骑马/骑牛/站立/行走/对话/盘坐等）"
            "一律不得写入场景画面——场景设定图只呈现环境本身（建筑/地形/草木/器物/光线/氛围），"
            "人物与动物由角色资产单独生成，严禁混入场景图"
        )
    # prop 类型追加硬约束：纯色底、严禁任何背景景物/山景词（手册原文的山水意象不得写入）
    if req.kind == "prop":
        kind_hint += (
            "。特别注意：道具设定图必须为纸白/浅色【纯色底】静物特写，"
            "严禁任何背景景物、场景、山水、远山、山峦、建筑、关隘、人物、手部；"
            "【风格】段不得引用手册中的山水意象词（如『郭熙《早春图》山雾质感』『山峦远淡』『孤影』），"
            "只保留纯画风描述（纸白淡墨灰阶/纯水墨无彩色/浓淡过渡细腻/静物质感清雅）"
        )

    parts = [
        "你是影视资产生图提示词专家。根据【角色/资产名称】+【设计描述】+【项目视觉手册】，"
        "生成可执行的生图提示词，格式为四段（每段一行）：",
        "【画面】主体与构图描述（含资产名与关键特征）",
        "【光影】光照与色调（遵循视觉手册光影语言）",
        "【风格】画风与质感（严格遵循视觉手册的风格/质感/色彩，可引用其原文要点）",
        "【约束】构图/底/人物或静物约束（按资产类型规范）",
        "要求：直接输出四行，不要解释；画面描述具体可执行；风格严格贴合视觉手册；禁止与视觉手册风格冲突。",
    ]
    if visual:
        parts.append(f"\n## 项目视觉手册（画风约束，必须严格遵循）\n{visual}")
    parts.append(f"\n## 资产类型约束\n{kind_hint}")

    prompt_tpl = ChatPromptTemplate.from_messages(
        [
            ("system", "\n".join(parts)),
            ("human", "资产名称：{name}\n设计描述：{description}"),
        ]
    )
    chain = prompt_tpl | get_llm(x_api_key)
    try:
        result = chain.invoke({"name": name, "description": req.description or "（无）"})
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM 调用失败: {e}")
    content = str(result.content or "").strip()
    if not content:
        raise HTTPException(status_code=502, detail="LLM 未返回提示词内容")
    return {"data": {"prompt": content}}


class FilmRefRequest(BaseModel):
    """电影质感提示词：电影名称 / 创作要求 → 视觉 DNA 分析 + 可执行提示词
    （九尾狐 AI 为文本模型，当前支持「电影名称」模式；截图模式需视觉模型后续扩展）"""
    film_name: str = ""  # 电影名称（可选；与 request 至少一个）
    request: str = ""  # 创作要求（如"缓慢推进，表达压迫感"；可选）
    mode: str = "quick"  # quick（快速提示词）/ full（完整分析）
    target: str = "video"  # video（视频提示词）/ image（图像提示词）
    duration: int = 6  # 视频时长秒（target=video 时）
    video_ratio: str = "9:16"
    visual_skill: str = ""  # 项目视觉手册（风格约束）
    director_skill: str = ""  # 项目导演手册（叙事约束）


@app.post("/ai/film-reference-prompt")
def film_reference_prompt(req: FilmRefRequest, x_api_key: str | None = Header(default=None)):
    """电影名称/创作要求 → 提炼视觉 DNA + 生成可执行图像/视频提示词
    技能：film_ref_prompt_writer（含视觉分析/运镜/输出模板三份 references 内联）"""
    film = (req.film_name or "").strip()
    request = (req.request or "").strip()
    if not film and not request:
        raise HTTPException(status_code=400, detail="请提供电影名称或创作要求")
    skill = load_skill("film_ref_prompt_writer")
    parts = [skill]
    parts.append("\n## 本任务参数")
    parts.append(
        f"- 模式：{'完整分析（视觉DNA+运镜DNA+提示词）' if req.mode == 'full' else '快速提示词'}\n"
        f"- 目标：{'视频提示词' if req.target == 'video' else '图像提示词'}"
        + (f"（时长 {req.duration}s，比例 {req.video_ratio}）" if req.target == "video" else "")
    )
    # 项目手册约束（画风/导演）
    visual_label, visual = _resolve_visual_style(req.visual_skill, req.director_skill)
    if visual:
        parts.append(f"\n## 本项目{visual_label}（画风约束：提示词质感需兼容此项目视觉手册，不冲突时优先遵循）\n{visual}")
    if req.director_skill:
        director = load_category_skill("story_skills", req.director_skill)
        if director:
            parts.append(f"\n## 本项目导演手册（叙事/镜头语言约束，叠加使用）\n{director}")

    human = ""
    if film:
        human += f"电影名称/参考：{film}\n"
    if request:
        human += f"创作要求：{request}\n"
    human += "\n请按技能流程输出。"

    prompt = ChatPromptTemplate.from_messages(
        [("system", "\n".join(parts)), ("human", human)]
    )
    chain = prompt | get_llm(x_api_key)
    try:
        result = chain.invoke({})
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM 调用失败: {e}")
    content = str(result.content or "").strip()
    if not content:
        raise HTTPException(status_code=502, detail="LLM 未返回内容")
    return {"data": {"analysis": content}}


class ScriptAssetsAllRequest(BaseModel):
    episodes: list[dict] = []  # [{index: 1, script: "..."}]
    visual_skill: str = ""
    director_skill: str = ""
    video_ratio: str = "9:16"


@app.post("/ai/script-assets-all")
def script_assets_all(req: ScriptAssetsAllRequest, x_api_key: str | None = Header(default=None)):
    """分析全部集剧本 → 提取场景/道具/素材清单（含出现集标注）"""
    episodes = [e for e in req.episodes if isinstance(e, dict) and str(e.get("script", "")).strip()]
    if not episodes:
        raise HTTPException(status_code=400, detail="无剧本内容")
    skill = load_skill("script_assets_all")
    visual_label, visual = _resolve_visual_style(req.visual_skill, req.director_skill)
    parts = [skill]
    if visual:
        parts.append(f"\n## 本项目{visual_label}（画风约束，场景/道具/素材的设定要点需符合此画风）\n{visual}")
    parts.append("\n## 任务\n分析以下全部集剧本，提取所需的场景/道具/素材清单。")

    script_text = "\n\n".join(
        f"## 集 {e.get('index', i + 1)}\n{e['script']}" for i, e in enumerate(episodes)
    )
    prompt = ChatPromptTemplate.from_messages(
        [("system", "\n".join(parts)), ("human", "全部集剧本：\n{script}")]
    )
    chain = prompt | get_llm(x_api_key)
    try:
        result = chain.invoke({"script": script_text})
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM 调用失败: {e}")
    try:
        parsed = extract_json(result.content)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM 输出解析失败: {e}")
    if not isinstance(parsed, list):
        raise HTTPException(status_code=502, detail="LLM 输出不是数组")
    # 归一化：type/name/description/episodes
    items = []
    allowed = {"scene", "prop", "material"}
    for item in parsed:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name", "")).strip()
        atype = str(item.get("type", "")).strip()
        if not name or atype not in allowed:
            continue
        raw_eps = item.get("episodes", [])
        eps = (
            [int(x) for x in raw_eps if str(x).strip().isdigit()]
            if isinstance(raw_eps, list)
            else []
        )
        items.append(
            {
                "type": atype,
                "name": name,
                "description": str(item.get("description", "")),
                "episodes": eps,
            }
        )
    return {"data": items}


# ================= Milvus 记忆（milvus-lite 本地嵌入式） =================

MILVUS_DB = os.path.join(BASE_DIR, "milvus.db")
CHROMA_DIR = os.path.join(BASE_DIR, "chroma_db")
COLLECTION_NAME = "fox_memory"
EMBED_DIM = 512  # BAAI/bge-small-zh-v1.5
# 本地 embedding 模型（transformers 直接加载，避免 sentence-transformers 加载问题）
EMBED_MODEL_PATH = os.environ.get(
    "EMBED_MODEL_PATH", os.path.join(BASE_DIR, "models", "bge-small-zh-v1.5")
)
_embedder = None
_collection = None
_memory_lock = threading.Lock()


class _LocalEmbedder:
    """基于 transformers 的本地中文 embedding（mean pooling）"""

    def __init__(self):
        from transformers import AutoModel, AutoTokenizer

        self.tok = AutoTokenizer.from_pretrained(EMBED_MODEL_PATH)
        self.model = AutoModel.from_pretrained(EMBED_MODEL_PATH)
        self.model.eval()

    def embed(self, texts):
        import torch

        enc = self.tok(
            list(texts), padding=True, truncation=True, max_length=512, return_tensors="pt"
        )
        with torch.no_grad():
            out = self.model(**enc).last_hidden_state
        mask = enc["attention_mask"].unsqueeze(-1).float()
        vecs = (out * mask).sum(1) / mask.sum(1)
        return vecs


def get_embedder():
    global _embedder
    if _embedder is None:
        _embedder = _LocalEmbedder()
    return _embedder


def get_collection():
    """chromadb 本地持久化向量库（免容器；Milvus-lite 因网络不可用时的替代）"""
    global _collection
    if _collection is None:
        import chromadb

        client = chromadb.PersistentClient(path=CHROMA_DIR)
        _collection = client.get_or_create_collection(
            COLLECTION_NAME, metadata={"hnsw:space": "cosine"}
        )
    return _collection


class MemoryUpsertRequest(BaseModel):
    text: str
    kind: str = "asset"
    type: str = ""
    filePath: str = ""
    projectId: int = 0
    episodeId: int = 0


class MemorySearchRequest(BaseModel):
    query: str
    top_k: int = 5


@app.post("/ai/memory/upsert")
def memory_upsert(req: MemoryUpsertRequest):
    try:
        text = (req.text or "").strip()
        if not text:
            raise HTTPException(status_code=400, detail="text 为空")
        with _memory_lock:
            vec = get_embedder().embed([text])[0]
            col = get_collection()
            import uuid

            row_id = uuid.uuid4().hex
            col.add(
                ids=[row_id],
                embeddings=[vec.tolist()],
                documents=[text],
                metadatas=[
                    {
                        "kind": req.kind,
                        "type": req.type,
                        "filePath": req.filePath,
                        "projectId": req.projectId,
                        "episodeId": req.episodeId,
                    }
                ],
            )
        return {"data": {"id": row_id}}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"记忆写入失败: {e}")


@app.post("/ai/memory/search")
def memory_search(req: MemorySearchRequest):
    try:
        query = (req.query or "").strip()
        if not query:
            raise HTTPException(status_code=400, detail="query 为空")
        with _memory_lock:
            vec = get_embedder().embed([query])[0]
            col = get_collection()
            res = col.query(
                query_embeddings=[vec.tolist()],
                n_results=req.top_k,
                include=["documents", "metadatas", "distances"],
            )
        results = []
        ids = res.get("ids", [[]])[0]
        docs = res.get("documents", [[]])[0]
        metas = res.get("metadatas", [[]])[0]
        dists = res.get("distances", [[]])[0]
        for i in range(len(ids)):
            m = metas[i] or {}
            results.append(
                {
                    "id": ids[i],
                    "score": round(float(dists[i]), 4),
                    "text": docs[i],
                    "kind": m.get("kind", ""),
                    "type": m.get("type", ""),
                    "filePath": m.get("filePath", ""),
                    "projectId": m.get("projectId", 0),
                    "episodeId": m.get("episodeId", 0),
                }
            )
        return {"data": results}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"记忆检索失败: {e}")
