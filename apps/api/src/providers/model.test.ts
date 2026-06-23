import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { DEFAULT_SETTINGS, type StudioSettings, type WorkflowDraftRequest } from "../domain.js";
import { generateStoryboard } from "./model.js";

const ChatCompletionRequestSchema = z.object({
  messages: z.array(z.object({ role: z.string(), content: z.string() })),
});

const REQUEST: WorkflowDraftRequest = {
  title: "20 场景视频",
  sourceType: "script",
  source: "测试内容",
  style: "cinematic",
  format: "portrait",
  sceneCount: 20,
  includeVoiceover: true,
};

const SETTINGS: StudioSettings = {
  ...DEFAULT_SETTINGS,
  llm: {
    ...DEFAULT_SETTINGS.llm,
    apiKey: "test-key",
    model: "gpt-test",
  },
};

describe("generateStoryboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("Given a 20 scene request When the model returns 20 scenes Then the storyboard is accepted", async () => {
    const requests: Request[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      requests.push(request);
      return Response.json({
        choices: [{ message: { content: JSON.stringify(storyboardJson(20)) } }],
      });
    });

    const storyboard = await generateStoryboard({
      request: REQUEST,
      settings: SETTINGS,
      sourceText: "一段足够长的测试内容",
    });

    const firstRequest = requests.at(0);
    if (!firstRequest) {
      throw new Error("Expected chat completion request.");
    }
    const body = ChatCompletionRequestSchema.parse(await firstRequest.json());
    const prompt = body.messages.map((message) => message.content).join("\n");

    expect(prompt).toContain("目标场景数：20");
    expect(storyboard.scenes).toHaveLength(20);
  });

  it("Given an optional empty emphasis When the model returns a storyboard Then the scene is accepted", async () => {
    vi.stubGlobal("fetch", async () =>
      Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                ...storyboardJson(1),
                scenes: [{ ...storyboardJson(1).scenes[0], emphasis: "" }],
              }),
            },
          },
        ],
      }),
    );

    const storyboard = await generateStoryboard({
      request: { ...REQUEST, sceneCount: 1 },
      settings: SETTINGS,
      sourceText: "一段足够长的测试内容",
    });

    expect(storyboard.scenes[0]?.emphasis).toBeUndefined();
  });
});

function storyboardJson(count: number) {
  return {
    title: "20 场景视频",
    summary: "测试 20 个场景是否可以通过后端校验。",
    scenes: Array.from({ length: count }, (_, index) => ({
      headline: `第 ${index + 1} 场`,
      body: "这是用于测试的场景正文。",
      narration: "这是用于测试的旁白文案。",
      visual: "一张电影感背景图。",
      emphasis: "测试",
    })),
  };
}
