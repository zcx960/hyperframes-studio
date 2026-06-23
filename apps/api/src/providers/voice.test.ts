import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { DEFAULT_SETTINGS, type StudioSettings, type WorkflowDraftRequest } from "../domain.js";
import type { Storyboard } from "./model.js";
import { prepareVoiceoverAssets } from "./voice.js";

const REQUEST: WorkflowDraftRequest = {
  title: "测试短片",
  sourceType: "script",
  source: "测试内容",
  style: "news-flash",
  format: "portrait",
  sceneCount: 1,
  includeVoiceover: true,
};

const STORYBOARD: Storyboard = {
  title: "测试短片",
  summary: "测试摘要",
  scenes: [
    {
      headline: "第一幕",
      body: "测试正文",
      narration: "这是需要生成声音的旁白。",
      visual: "城市夜景",
      emphasis: "声音",
    },
  ],
};

const MIMO_TTS_SETTINGS: StudioSettings = {
  ...DEFAULT_SETTINGS,
  tts: {
    ...DEFAULT_SETTINGS.tts,
    apiKey: "test-mimo-key",
    format: "mp3",
    speed: 1.1,
  },
};

const OPENAI_TTS_SETTINGS: StudioSettings = {
  ...DEFAULT_SETTINGS,
  tts: {
    ...DEFAULT_SETTINGS.tts,
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "test-openai-key",
    model: "gpt-4o-mini-tts",
    voice: "alloy",
    format: "mp3",
    speed: 1.1,
  },
};

const SpeechRequestSchema = z.object({
  model: z.string(),
  voice: z.string(),
  input: z.string(),
  response_format: z.string(),
  speed: z.number(),
});

const MimoSpeechRequestSchema = z.object({
  model: z.string(),
  messages: z.tuple([
    z.object({ role: z.literal("user"), content: z.string() }),
    z.object({ role: z.literal("assistant"), content: z.string() }),
  ]),
  audio: z.object({
    format: z.string(),
    voice: z.string(),
  }),
});

describe("prepareVoiceoverAssets", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "hf-voice-"));
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    await rm(dir, { recursive: true, force: true });
  });

  it("Given MiMo TTS settings When preparing voiceover assets Then posts chat completions and decodes audio data", async () => {
    const requests: Request[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      requests.push(request);
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                audio: { data: Buffer.from("fake mimo mp3").toString("base64") },
              },
            },
          ],
        }),
        { headers: { "content-type": "application/json" } },
      );
    });

    const assets = await prepareVoiceoverAssets({
      storyboard: STORYBOARD,
      request: REQUEST,
      settings: MIMO_TTS_SETTINGS,
      projectDir: dir,
    });

    const firstRequest = requests.at(0);
    if (!firstRequest) {
      throw new Error("Expected speech request.");
    }
    const body = MimoSpeechRequestSchema.parse(await firstRequest.json());

    expect(firstRequest.url).toBe("https://api.xiaomimimo.com/v1/chat/completions");
    expect(firstRequest.headers.get("api-key")).toBe("test-mimo-key");
    expect(body.model).toBe("mimo-v2.5-tts");
    expect(body.messages[0].role).toBe("user");
    expect(body.messages[0].content).toContain("1.1");
    expect(body.messages[1]).toEqual({
      role: "assistant",
      content: "这是需要生成声音的旁白。",
    });
    expect(body.audio).toEqual({ format: "mp3", voice: "冰糖" });
    expect(assets[0]).toMatchObject({
      sceneIndex: 0,
      path: "assets/voice-01.mp3",
      narration: "这是需要生成声音的旁白。",
    });
    expect(assets[0]?.durationSeconds).toBeGreaterThan(0);
    expect(await readFile(join(dir, "assets/voice-01.mp3"), "utf8")).toBe("fake mimo mp3");
  });

  it("Given OpenAI TTS settings When preparing voiceover assets Then posts the speech endpoint", async () => {
    const requests: Request[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      requests.push(request);
      return new Response(Buffer.from("fake openai mp3"));
    });

    const assets = await prepareVoiceoverAssets({
      storyboard: STORYBOARD,
      request: REQUEST,
      settings: OPENAI_TTS_SETTINGS,
      projectDir: dir,
    });

    const firstRequest = requests.at(0);
    if (!firstRequest) {
      throw new Error("Expected speech request.");
    }
    const body = SpeechRequestSchema.parse(await firstRequest.json());

    expect(firstRequest.url).toBe("https://api.openai.com/v1/audio/speech");
    expect(firstRequest.headers.get("Authorization")).toBe("Bearer test-openai-key");
    expect(body).toEqual({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: "这是需要生成声音的旁白。",
      response_format: "mp3",
      speed: 1.1,
    });
    expect(assets[0]?.path).toBe("assets/voice-01.mp3");
    expect(assets[0]?.durationSeconds).toBeGreaterThan(0);
    expect(await readFile(join(dir, "assets/voice-01.mp3"), "utf8")).toBe("fake openai mp3");
  });

  it("Given pcm16 is configured When preparing voiceover assets Then requests wav for playback", async () => {
    const requests: Request[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      requests.push(request);
      return new Response(Buffer.from("fake wav"));
    });

    const assets = await prepareVoiceoverAssets({
      storyboard: STORYBOARD,
      request: REQUEST,
      settings: {
        ...OPENAI_TTS_SETTINGS,
        tts: { ...OPENAI_TTS_SETTINGS.tts, format: "pcm16" },
      },
      projectDir: dir,
    });

    const firstRequest = requests.at(0);
    if (!firstRequest) {
      throw new Error("Expected speech request.");
    }
    const body = SpeechRequestSchema.parse(await firstRequest.json());

    expect(body.response_format).toBe("wav");
    expect(assets[0]?.path).toBe("assets/voice-01.wav");
    expect(assets[0]?.durationSeconds).toBeGreaterThan(0);
  });

  it("Given voiceover is disabled When preparing voiceover assets Then skips TTS", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    const assets = await prepareVoiceoverAssets({
      storyboard: STORYBOARD,
      request: { ...REQUEST, includeVoiceover: false },
      settings: MIMO_TTS_SETTINGS,
      projectDir: dir,
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(assets).toEqual([]);
  });
});
