import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { composeHyperframesHtml } from "./composer.js";
import type { JobRecord, JobResult, JobStep, StudioSettings } from "./domain.js";
import { prepareSceneAssets } from "./providers/media.js";
import { type Storyboard, generateStoryboard } from "./providers/model.js";
import { loadSourceText } from "./providers/source.js";
import { prepareVoiceoverAssets } from "./providers/voice.js";
import { assertCompositionValid, assertRenderedFile, renderComposition } from "./render.js";

export interface PipelineDeps {
  readonly loadSourceText: typeof loadSourceText;
  readonly generateStoryboard: typeof generateStoryboard;
  readonly prepareSceneAssets: typeof prepareSceneAssets;
  readonly prepareVoiceoverAssets: typeof prepareVoiceoverAssets;
  readonly renderComposition: typeof renderComposition;
}

export const defaultPipelineDeps: PipelineDeps = {
  loadSourceText,
  generateStoryboard,
  prepareSceneAssets,
  prepareVoiceoverAssets,
  renderComposition,
};

export type ProgressFn = (
  step: JobStep,
  progress: number,
  activity?: string,
) => Promise<void> | void;

export async function runPipeline(
  job: JobRecord,
  settings: StudioSettings,
  projectDir: string,
  onProgress: ProgressFn,
  deps: PipelineDeps = defaultPipelineDeps,
): Promise<JobResult> {
  const { request } = job;

  await onProgress("prepare", 0.05, "读取来源内容");
  await mkdir(projectDir, { recursive: true });
  await mkdir(join(projectDir, "renders"), { recursive: true });
  const sourceText = await deps.loadSourceText(request);
  await writeFile(join(projectDir, "source.md"), `# ${request.title}\n\n${sourceText}\n`, "utf8");

  await onProgress("author", 0.18, "调用配置模型生成 storyboard");
  const storyboard = await deps.generateStoryboard({ request, settings, sourceText });
  await writeFile(join(projectDir, "storyboard.json"), JSON.stringify(storyboard, null, 2), "utf8");

  await onProgress("author", 0.34, "准备场景背景图");
  const sceneAssets = await deps.prepareSceneAssets({
    storyboard,
    request,
    settings,
    projectDir,
    onProgress: (message) => onProgress("author", 0.34, message),
  });

  await onProgress("author", 0.42, "生成旁白音频");
  const voiceAssets = await deps.prepareVoiceoverAssets({
    storyboard,
    request,
    settings,
    projectDir,
    onProgress: (message) => onProgress("author", 0.42, message),
  });

  await onProgress("author", 0.46, "合成 HyperFrames HTML");
  const html = composeHyperframesHtml(storyboard, request, sceneAssets, voiceAssets);
  await assertCompositionValid(html);
  await writeFile(join(projectDir, "index.html"), html, "utf8");

  await onProgress("render", 0.62, "渲染 MP4");
  const outputPath = join(projectDir, "renders", "output.mp4");
  await deps.renderComposition(projectDir, outputPath, (progress, message) => {
    const normalized = Math.max(0, Math.min(1, progress));
    return onProgress("render", 0.62 + normalized * 0.32, message);
  });
  await assertRenderedFile(outputPath);

  await onProgress("render", 0.96, "收集产物");
  return resultFromStoryboard(
    storyboard,
    sceneAssets.map((asset) => asset.path),
    voiceAssets.map((asset) => asset.path),
  );
}

function resultFromStoryboard(
  storyboard: Storyboard,
  sceneAssetPaths: readonly string[],
  voiceAssetPaths: readonly string[],
): JobResult {
  return {
    summary: storyboard.summary,
    htmlFile: "index.html",
    videoFile: "renders/output.mp4",
    artifacts: [
      "index.html",
      "storyboard.json",
      "source.md",
      ...sceneAssetPaths,
      ...voiceAssetPaths,
      "renders/output.mp4",
    ],
    generationMode: "model-template",
  };
}
