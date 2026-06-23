import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { DEFAULT_SETTINGS, type StudioSettings, type WorkflowDraftRequest } from "../domain.js";
import { prepareSceneAssets } from "./media.js";
import type { Storyboard } from "./model.js";

const REQUEST: WorkflowDraftRequest = {
  title: "测试短片",
  sourceType: "script",
  source: "测试内容",
  style: "cinematic",
  format: "portrait",
  sceneCount: 1,
  includeVoiceover: false,
};

const STORYBOARD: Storyboard = {
  title: "测试短片",
  summary: "测试摘要",
  scenes: [
    {
      headline: "第一幕",
      body: "测试正文",
      narration: "测试旁白",
      visual: "城市夜景与屏幕光影",
      emphasis: "测试",
    },
  ],
};

const MULTI_SCENE_STORYBOARD: Storyboard = {
  ...STORYBOARD,
  scenes: [
    ...STORYBOARD.scenes,
    {
      headline: "第二幕",
      body: "测试正文",
      narration: "测试旁白",
      visual: "产品界面与信息卡片",
      emphasis: "并发",
    },
    {
      headline: "第三幕",
      body: "测试正文",
      narration: "测试旁白",
      visual: "电影感收束画面",
      emphasis: "完成",
    },
  ],
};

const IMAGE_SETTINGS: StudioSettings = {
  ...DEFAULT_SETTINGS,
  media: {
    ...DEFAULT_SETTINGS.media,
    imageProvider: "openai",
    imageApiKey: "test-image-key",
    imageModel: "gpt-image-2",
  },
};

const ImageGenerationRequestSchema = z.object({
  model: z.string(),
  prompt: z.string(),
  size: z.string(),
});

describe("prepareSceneAssets", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "hf-media-"));
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    await rm(dir, { recursive: true, force: true });
  });

  it("Given OpenAI image settings When preparing scene assets Then writes generated backgrounds", async () => {
    const requests: Request[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      requests.push(request);
      return Response.json({
        data: [{ b64_json: Buffer.from("fake png").toString("base64") }],
      });
    });

    const assets = await prepareSceneAssets({
      storyboard: STORYBOARD,
      request: REQUEST,
      settings: IMAGE_SETTINGS,
      projectDir: dir,
    });

    const firstRequest = requests.at(0);
    if (!firstRequest) {
      throw new Error("Expected image generation request.");
    }
    const body = ImageGenerationRequestSchema.parse(await firstRequest.json());

    expect(firstRequest.url).toBe("https://api.openai.com/v1/images/generations");
    expect(body.model).toBe("gpt-image-2");
    expect(body.size).toBe("1024x1536");
    expect(body.prompt).toContain("城市夜景与屏幕光影");
    expect(body.prompt).not.toContain(`Video title: ${STORYBOARD.title}`);
    expect(body.prompt).not.toContain(`Scene 1: ${STORYBOARD.scenes[0]?.headline}`);
    expect(body.prompt).toContain("The prompt text is private production context");
    expect(body.prompt).toContain("the image itself must contain zero text");
    expect(body.prompt).toContain("Chinese characters");
    expect(body.prompt).toContain("UI words");
    expect(body.prompt).toContain("abstract blurred shapes with no glyph-like strokes");
    expect(assets).toEqual([
      {
        sceneIndex: 0,
        path: "assets/scene-01.png",
        alt: "城市夜景与屏幕光影",
      },
    ]);
    expect(await readFile(join(dir, "assets/scene-01.png"), "utf8")).toBe("fake png");
  });

  it("Given a transient timeout When preparing scene assets Then retries the failed scene", async () => {
    const requests: Request[] = [];
    vi.stubEnv("HF_IMAGE_RETRY_BASE_MS", "1");
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      requests.push(request);
      if (requests.length === 1) {
        return new Promise<Response>((_resolve, reject) => {
          reject(new DOMException("timeout", "TimeoutError"));
        });
      }
      return Response.json({
        data: [{ b64_json: Buffer.from("retry png").toString("base64") }],
      });
    });

    const assets = await prepareSceneAssets({
      storyboard: STORYBOARD,
      request: REQUEST,
      settings: IMAGE_SETTINGS,
      projectDir: dir,
    });

    expect(requests).toHaveLength(2);
    expect(assets).toHaveLength(1);
    expect(await readFile(join(dir, "assets/scene-01.png"), "utf8")).toBe("retry png");
  });

  it("Given multiple scenes When preparing scene assets Then starts requests up to the concurrency limit", async () => {
    vi.stubEnv("HF_IMAGE_CONCURRENCY", "2");
    let activeRequests = 0;
    let maxActiveRequests = 0;
    vi.stubGlobal("fetch", async () => {
      activeRequests += 1;
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
      await Promise.resolve();
      activeRequests -= 1;
      return Response.json({
        data: [{ b64_json: Buffer.from("parallel png").toString("base64") }],
      });
    });

    const assets = await prepareSceneAssets({
      storyboard: MULTI_SCENE_STORYBOARD,
      request: REQUEST,
      settings: IMAGE_SETTINGS,
      projectDir: dir,
    });

    expect(maxActiveRequests).toBe(2);
    expect(assets.map((asset) => asset.path)).toEqual([
      "assets/scene-01.png",
      "assets/scene-02.png",
      "assets/scene-03.png",
    ]);
  });
});
