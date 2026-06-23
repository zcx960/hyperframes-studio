import ky from "ky";
import { z } from "zod";
import { MAX_SCENE_COUNT, type StudioSettings, type WorkflowDraftRequest } from "../domain.js";

const OptionalEmphasisSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value),
  z.string().trim().min(1).max(48).optional(),
);

const StoryboardSceneSchema = z.object({
  headline: z.string().min(1).max(80),
  body: z.string().min(1).max(240),
  narration: z.string().min(1).max(320),
  visual: z.string().min(1).max(180),
  emphasis: OptionalEmphasisSchema,
});

export const StoryboardSchema = z.object({
  title: z.string().min(1).max(80),
  summary: z.string().min(1).max(500),
  scenes: z.array(StoryboardSceneSchema).min(1).max(MAX_SCENE_COUNT),
});

export type Storyboard = z.infer<typeof StoryboardSchema>;

export interface StoryboardInput {
  readonly request: WorkflowDraftRequest;
  readonly settings: StudioSettings;
  readonly sourceText: string;
}

type ModelMessage = {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
};

const OpenAiChatResponseSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
});

const AnthropicResponseSchema = z.object({
  content: z.array(
    z.object({
      type: z.string(),
      text: z.string().optional(),
    }),
  ),
});

export class ModelProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelProviderError";
  }
}

export async function generateStoryboard(input: StoryboardInput): Promise<Storyboard> {
  const llm = input.settings.llm;
  const apiKey = llm.apiKey.trim();
  const model = llm.model.trim();
  if (!apiKey || !model) {
    throw new ModelProviderError("未配置文本模型 API Key 或 Model。");
  }

  const messages = buildMessages(input);
  const raw =
    llm.provider === "anthropic-compatible"
      ? await callAnthropicCompatible(llm.baseUrl, apiKey, model, llm.temperature, messages)
      : await callOpenAiCompatible(llm.baseUrl, apiKey, model, llm.temperature, messages);

  return StoryboardSchema.parse(extractJson(raw));
}

function buildMessages(input: StoryboardInput): readonly ModelMessage[] {
  const targetScenes = Math.min(MAX_SCENE_COUNT, input.request.sceneCount);
  return [
    {
      role: "system",
      content: [
        "你是短视频策划模型，只输出严格 JSON，不要 Markdown，不要解释。",
        "把输入内容压缩成可由固定 HTML 模板渲染的 HyperFrames storyboard。",
        "每个 scene 必须适合一屏展示：headline 短、body 具体、narration 可直接作为旁白文案。",
        "visual 用中文描述画面构图，但不要要求外部工具写代码。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `标题：${input.request.title}`,
        `来源类型：${input.request.sourceType}`,
        `目标风格：${input.request.style}`,
        `画幅：${input.request.format}`,
        `目标场景数：${targetScenes}`,
        `是否需要旁白文案：${input.request.includeVoiceover ? "是" : "否"}`,
        "",
        "返回 JSON schema：",
        '{ "title": string, "summary": string, "scenes": [{ "headline": string, "body": string, "narration": string, "visual": string, "emphasis"?: string }] }',
        "emphasis 是可选短标签；如果提供必须是非空字符串，不需要就省略字段，不能返回空字符串。",
        "",
        "内容：",
        input.sourceText,
      ].join("\n"),
    },
  ];
}

async function callOpenAiCompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  temperature: number,
  messages: readonly ModelMessage[],
): Promise<string> {
  const data = await ky
    .post(joinUrl(baseUrl, "chat/completions"), {
      timeout: 120_000,
      headers: { Authorization: `Bearer ${apiKey}` },
      json: {
        model,
        messages,
        temperature,
        response_format: { type: "json_object" },
      },
    })
    .json();

  const parsed = OpenAiChatResponseSchema.parse(data);
  const content = parsed.choices[0]?.message.content;
  if (!content) {
    throw new ModelProviderError("模型没有返回 storyboard 内容。");
  }
  return content;
}

async function callAnthropicCompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  temperature: number,
  messages: readonly ModelMessage[],
): Promise<string> {
  const [system, ...rest] = messages;
  const data = await ky
    .post(joinUrl(baseUrl, "messages"), {
      timeout: 120_000,
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      json: {
        model,
        temperature,
        max_tokens: 4096,
        system: system?.content ?? "",
        messages: rest,
      },
    })
    .json();

  const parsed = AnthropicResponseSchema.parse(data);
  const text = parsed.content
    .filter((block) => block.type === "text" && block.text)
    .map((block) => block.text)
    .join("\n");
  if (!text.trim()) {
    throw new ModelProviderError("模型没有返回 storyboard 内容。");
  }
  return text;
}

function extractJson(text: string): unknown {
  const direct = tryParseJson(text);
  if (direct !== undefined) return direct;

  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fenced?.[1]) {
    const parsed = tryParseJson(fenced[1]);
    if (parsed !== undefined) return parsed;
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const parsed = tryParseJson(text.slice(start, end + 1));
    if (parsed !== undefined) return parsed;
  }

  throw new ModelProviderError("模型返回内容不是有效 JSON。");
}

function tryParseJson(text: string): unknown | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path}`;
}
