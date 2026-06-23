import { z } from "zod";

export const MAX_SCENE_COUNT = 40;

export const LlmProviderSchema = z.enum(["openai-compatible", "anthropic-compatible", "custom"]);
export const TtsProviderSchema = z.enum(["mimo", "minimax", "openai", "custom"]);
export const VideoFormatSchema = z.enum(["portrait", "landscape", "square"]);
export const VisualStyleSchema = z.enum([
  "news-flash",
  "cinematic",
  "infographic",
  "minimal-editorial",
]);

// API keys, model and voice may be empty while the workbench is still being
// configured — the workflow warns about missing keys rather than rejecting them.
export const LlmSettingsSchema = z.object({
  provider: LlmProviderSchema,
  baseUrl: z.string().url(),
  apiKey: z.string(),
  model: z.string(),
  temperature: z.number().min(0).max(2),
});

export const TtsSettingsSchema = z.object({
  provider: TtsProviderSchema,
  baseUrl: z.string().url(),
  apiKey: z.string(),
  model: z.string(),
  voice: z.string(),
  format: z.enum(["mp3", "wav", "pcm16"]),
  speed: z.number().min(0.5).max(2.5),
});

export const ImageProviderSchema = z.enum(["pexels", "openai", "none"]);

export const MediaSettingsSchema = z.object({
  /** Where scene backgrounds come from: Pexels stock, OpenAI image gen, or none. */
  imageProvider: ImageProviderSchema,
  pexelsApiKey: z.string().optional(),
  // OpenAI-compatible image generation (e.g. gpt-image-2)
  imageBaseUrl: z.string(),
  imageApiKey: z.string(),
  imageModel: z.string(),
});

export const RenderSettingsSchema = z.object({
  format: VideoFormatSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  targetScenes: z.number().int().min(1).max(40),
  outputDirectory: z.string().min(1),
});

export const StudioSettingsSchema = z.object({
  llm: LlmSettingsSchema,
  tts: TtsSettingsSchema,
  media: MediaSettingsSchema,
  render: RenderSettingsSchema,
});

export const WorkflowDraftRequestSchema = z.object({
  title: z.string().min(1),
  sourceType: z.enum(["script", "document", "wechat-url"]),
  source: z.string().min(1),
  style: VisualStyleSchema,
  format: VideoFormatSchema,
  sceneCount: z.number().int().min(1).max(MAX_SCENE_COUNT),
  includeVoiceover: z.boolean(),
});

export const WorkflowStepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  status: z.enum(["ready", "needs-config", "queued"]),
});

export const WorkflowDraftSchema = z.object({
  title: z.string().min(1),
  estimatedDurationSeconds: z.number().positive(),
  steps: z.readonly(z.array(WorkflowStepSchema)),
  scenePlan: z.readonly(z.array(z.string().min(1))),
  configWarnings: z.readonly(z.array(z.string().min(1))),
});

export type StudioSettings = z.infer<typeof StudioSettingsSchema>;
export type WorkflowDraftRequest = z.infer<typeof WorkflowDraftRequestSchema>;
export type WorkflowDraft = z.infer<typeof WorkflowDraftSchema>;

export const JobResultSchema = z.object({
  summary: z.string(),
  htmlFile: z.string().optional(),
  videoFile: z.string().optional(),
  artifacts: z.array(z.string()),
  durationSeconds: z.number().nonnegative().optional(),
  generationMode: z.literal("model-template"),
});

export const JOB_STEPS = ["prepare", "author", "render"] as const;
export const JobStepSchema = z.enum(JOB_STEPS);
export const JobStatusSchema = z.enum(["queued", "running", "succeeded", "failed"]);

export const JobRecordSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  status: JobStatusSchema,
  step: JobStepSchema,
  progress: z.number().min(0).max(1),
  activity: z.array(z.string()).optional(),
  request: WorkflowDraftRequestSchema,
  result: JobResultSchema.optional(),
  error: z.string().optional(),
});

export type JobResult = z.infer<typeof JobResultSchema>;
export type JobStep = z.infer<typeof JobStepSchema>;
export type JobStatus = z.infer<typeof JobStatusSchema>;
export type JobRecord = z.infer<typeof JobRecordSchema>;

export const DEFAULT_SETTINGS: StudioSettings = {
  llm: {
    provider: "openai-compatible",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4.1-mini",
    temperature: 0.7,
  },
  tts: {
    provider: "mimo",
    baseUrl: "https://api.xiaomimimo.com/v1",
    apiKey: "",
    model: "mimo-v2.5-tts",
    voice: "冰糖",
    format: "wav",
    speed: 1.2,
  },
  media: {
    imageProvider: "none",
    pexelsApiKey: "",
    imageBaseUrl: "https://api.openai.com/v1",
    imageApiKey: "",
    imageModel: "gpt-image-2",
  },
  render: {
    format: "portrait",
    width: 1080,
    height: 1920,
    targetScenes: 20,
    outputDirectory: "/workspace/renders",
  },
};
