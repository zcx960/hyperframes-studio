import type { StudioSettings, WorkflowDraft, WorkflowDraftRequest } from "./domain.js";

const WORKFLOW_STEPS = [
  ["source", "导入素材", "解析来源，提取标题、段落与关键数据。"],
  ["outline", "模型规划", "调用配置模型生成结构化 storyboard。"],
  ["scenes", "场景规划", "生成逐页场景与旁白文案。"],
  ["media", "场景配图", "按配置生成或下载每页背景图。"],
  ["voice", "旁白文案", "把旁白作为字幕与节奏参考写入 composition。"],
  ["compose", "生成 HTML", "由项目模板生成 HyperFrames HTML 与时间线。"],
  ["inspect", "本地渲染", "lint 后直接用 HyperFrames producer 渲染 MP4。"],
] as const;

export function buildWorkflowDraft(
  request: WorkflowDraftRequest,
  settings: StudioSettings,
): WorkflowDraft {
  const warnings = getWarnings(settings, request.includeVoiceover);
  const secondsPerScene = request.includeVoiceover ? 8 : 5;
  const scenePlan = Array.from({ length: request.sceneCount }, (_, index) =>
    describeScene(index + 1, request.style),
  );

  return {
    title: request.title,
    estimatedDurationSeconds: request.sceneCount * secondsPerScene,
    steps: WORKFLOW_STEPS.map(([id, title, summary]) => ({
      id,
      title,
      summary,
      status: stepStatus(id, settings, request.includeVoiceover),
    })),
    scenePlan,
    configWarnings: warnings,
  };
}

function stepStatus(
  stepId: (typeof WORKFLOW_STEPS)[number][0],
  settings: StudioSettings,
  includeVoiceover: boolean,
): "ready" | "needs-config" {
  if (stepId === "outline" && settings.llm.apiKey.length === 0) {
    return "needs-config";
  }
  if (stepId === "voice" && includeVoiceover && settings.tts.apiKey.length === 0) {
    return "needs-config";
  }
  if (stepId === "media" && mediaNeedsConfig(settings)) {
    return "needs-config";
  }
  return "ready";
}

function mediaNeedsConfig(settings: StudioSettings): boolean {
  if (settings.media.imageProvider === "pexels") {
    return !settings.media.pexelsApiKey;
  }
  if (settings.media.imageProvider === "openai") {
    return settings.media.imageApiKey.length === 0;
  }
  return false;
}

function getWarnings(settings: StudioSettings, includeVoiceover: boolean): readonly string[] {
  const warnings: string[] = [];

  if (settings.llm.apiKey.length === 0) {
    warnings.push("未配置文本模型 API Key。");
  }

  if (includeVoiceover && settings.tts.apiKey.length === 0) {
    warnings.push("未配置 TTS API Key。");
  }

  if (settings.media.imageProvider === "pexels" && !settings.media.pexelsApiKey) {
    warnings.push("未配置 Pexels API Key，将退回纯排版。");
  }
  if (settings.media.imageProvider === "openai" && !settings.media.imageApiKey) {
    warnings.push("未配置图像生成 API Key，将退回纯排版。");
  }

  return warnings;
}

function describeScene(sceneNumber: number, style: WorkflowDraftRequest["style"]): string {
  const rhythm =
    sceneNumber === 1 ? "开场标题" : sceneNumber % 5 === 0 ? "信息图重点页" : "内容推进页";

  return `${sceneNumber.toString().padStart(2, "0")} · ${rhythm} · ${style}`;
}
