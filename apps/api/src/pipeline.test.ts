import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type JobRecord, type StudioSettings } from "./domain.js";
import { type PipelineDeps, runPipeline } from "./pipeline.js";
import type { Storyboard } from "./providers/model.js";

const JOB: JobRecord = {
  id: "t",
  createdAt: "2026-01-01T00:00:00.000Z",
  status: "running",
  step: "prepare",
  progress: 0,
  request: {
    title: "微信文章短视频",
    sourceType: "script",
    source: "一段用于测试的脚本。",
    style: "news-flash",
    format: "portrait",
    sceneCount: 3,
    includeVoiceover: true,
  },
};

const SETTINGS: StudioSettings = {
  ...DEFAULT_SETTINGS,
  llm: { ...DEFAULT_SETTINGS.llm, apiKey: "test-key", model: "gpt-test" },
};

const STORYBOARD: Storyboard = {
  title: "测试视频",
  summary: "本片解释了一个用于测试的核心观点。",
  scenes: [
    {
      headline: "开场观点",
      body: "用一句清晰的判断抓住注意力。",
      narration: "这是第一段旁白。",
      visual: "高对比信息流标题页。",
      emphasis: "观点",
    },
    {
      headline: "关键证据",
      body: "补充上下文，让观众理解为什么重要。",
      narration: "这是第二段旁白。",
      visual: "数据卡片与重点标注。",
      emphasis: "证据",
    },
  ],
};

describe("runPipeline (model-driven)", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "hf-model-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("loads source, generates storyboard, writes HyperFrames HTML, and renders video", async () => {
    const steps: string[] = [];
    let seenSource = "";
    const deps: PipelineDeps = {
      loadSourceText: async (request) => request.source,
      generateStoryboard: async ({ sourceText }) => {
        seenSource = sourceText;
        return STORYBOARD;
      },
      prepareSceneAssets: async () => [
        {
          sceneIndex: 0,
          path: "assets/scene-01.png",
          alt: "高对比信息流标题页。",
        },
      ],
      prepareVoiceoverAssets: async () => [
        {
          sceneIndex: 0,
          path: "assets/voice-01.wav",
          narration: "这是第一段旁白。",
          durationSeconds: 3.2,
        },
      ],
      renderComposition: async (_projectDir, outputPath) => {
        await writeFile(outputPath, "fake mp4", "utf8");
      },
    };

    const result = await runPipeline(
      JOB,
      SETTINGS,
      dir,
      (step) => {
        steps.push(step);
      },
      deps,
    );

    expect(seenSource).toBe("一段用于测试的脚本。");
    expect(await readFile(join(dir, "source.md"), "utf8")).toContain("一段用于测试的脚本");
    expect(await readFile(join(dir, "storyboard.json"), "utf8")).toContain("开场观点");
    expect(await readFile(join(dir, "index.html"), "utf8")).toContain('data-composition-id="main"');
    expect(await readFile(join(dir, "index.html"), "utf8")).toContain(
      'class="scene-bg" src="assets/scene-01.png"',
    );
    expect(await readFile(join(dir, "index.html"), "utf8")).toContain('<audio id="voice-01"');
    expect(steps).toContain("prepare");
    expect(steps).toContain("author");
    expect(steps).toContain("render");
    expect(result.videoFile).toBe("renders/output.mp4");
    expect(result.htmlFile).toBe("index.html");
    expect(result.artifacts).toContain("assets/scene-01.png");
    expect(result.artifacts).toContain("assets/voice-01.wav");
    expect(result.generationMode).toBe("model-template");
  });

  it("fails before rendering when the generated storyboard produces invalid HTML", async () => {
    const invalid: Storyboard = {
      ...STORYBOARD,
      scenes: [],
    };
    const deps: PipelineDeps = {
      loadSourceText: async (request) => request.source,
      generateStoryboard: async () => invalid,
      prepareSceneAssets: async () => [],
      prepareVoiceoverAssets: async () => [],
      renderComposition: async () => {
        throw new Error("render should not run");
      },
    };

    await expect(runPipeline(JOB, SETTINGS, dir, () => undefined, deps)).rejects.toThrow();
  });

  it("fails when render does not produce a usable video file", async () => {
    const deps: PipelineDeps = {
      loadSourceText: async (request) => request.source,
      generateStoryboard: async () => STORYBOARD,
      prepareSceneAssets: async () => [],
      prepareVoiceoverAssets: async () => [],
      renderComposition: async (_projectDir, outputPath) => {
        await writeFile(outputPath, "", "utf8");
      },
    };

    await expect(runPipeline(JOB, SETTINGS, dir, () => undefined, deps)).rejects.toThrow(
      /渲染产物为空文件/,
    );
  });

  it("forwards render progress promises so job state writes can be awaited", async () => {
    let renderProgressResult: Promise<void> | undefined;
    const deps: PipelineDeps = {
      loadSourceText: async (request) => request.source,
      generateStoryboard: async () => STORYBOARD,
      prepareSceneAssets: async () => [],
      prepareVoiceoverAssets: async () => [],
      renderComposition: async (_projectDir, outputPath, onProgress) => {
        renderProgressResult = onProgress?.(0.5, "Streaming frame 1/2") ?? undefined;
        await renderProgressResult;
        await writeFile(outputPath, "fake mp4", "utf8");
      },
    };

    await runPipeline(
      JOB,
      SETTINGS,
      dir,
      async () => {
        await Promise.resolve();
      },
      deps,
    );

    expect(renderProgressResult).toBeInstanceOf(Promise);
  });
});
