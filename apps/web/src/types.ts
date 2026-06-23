import { z } from "zod";

export const StudioSettingsSchema = z.object({
  llm: z.object({
    provider: z.enum(["openai-compatible", "anthropic-compatible", "custom"]),
    baseUrl: z.string(),
    apiKey: z.string(),
    model: z.string(),
    temperature: z.number(),
  }),
  tts: z.object({
    provider: z.enum(["mimo", "minimax", "openai", "custom"]),
    baseUrl: z.string(),
    apiKey: z.string(),
    model: z.string(),
    voice: z.string(),
    format: z.enum(["mp3", "wav", "pcm16"]),
    speed: z.number(),
  }),
  media: z.object({
    imageProvider: z.enum(["pexels", "openai", "none"]),
    pexelsApiKey: z.string().optional(),
    imageBaseUrl: z.string(),
    imageApiKey: z.string(),
    imageModel: z.string(),
  }),
  render: z.object({
    format: z.enum(["portrait", "landscape", "square"]),
    width: z.number(),
    height: z.number(),
    targetScenes: z.number(),
    outputDirectory: z.string(),
  }),
});

export const WorkflowDraftSchema = z.object({
  title: z.string(),
  estimatedDurationSeconds: z.number(),
  steps: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      summary: z.string(),
      status: z.enum(["ready", "needs-config", "queued"]),
    }),
  ),
  scenePlan: z.array(z.string()),
  configWarnings: z.array(z.string()),
});

export type StudioSettings = z.infer<typeof StudioSettingsSchema>;
export type WorkflowDraft = z.infer<typeof WorkflowDraftSchema>;

export type WorkflowRequest = {
  readonly title: string;
  readonly sourceType: "script" | "document" | "wechat-url";
  readonly source: string;
  readonly style: "news-flash" | "cinematic" | "infographic" | "minimal-editorial";
  readonly format: "portrait" | "landscape" | "square";
  readonly sceneCount: number;
  readonly includeVoiceover: boolean;
};

export const JOB_STEPS = ["prepare", "author", "render"] as const;

export const JobResultSchema = z.object({
  summary: z.string(),
  htmlFile: z.string().optional(),
  videoFile: z.string().optional(),
  artifacts: z.array(z.string()),
  durationSeconds: z.number().optional(),
  generationMode: z.literal("model-template"),
});

export const JobSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  status: z.enum(["queued", "running", "succeeded", "failed"]),
  step: z.enum(JOB_STEPS),
  progress: z.number(),
  activity: z.array(z.string()).optional(),
  request: z.object({ title: z.string(), includeVoiceover: z.boolean() }).passthrough(),
  result: JobResultSchema.optional(),
  error: z.string().optional(),
});

export const JobSummarySchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  status: z.enum(["queued", "running", "succeeded", "failed"]),
  step: z.enum(JOB_STEPS),
  progress: z.number(),
  title: z.string(),
  durationSeconds: z.number().optional(),
});

export type JobResult = z.infer<typeof JobResultSchema>;
export type Job = z.infer<typeof JobSchema>;
export type JobSummary = z.infer<typeof JobSummarySchema>;
export type JobStep = (typeof JOB_STEPS)[number];
