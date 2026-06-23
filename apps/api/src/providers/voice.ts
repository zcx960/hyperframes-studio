import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import ky from "ky";
import { z } from "zod";
import type { StudioSettings, WorkflowDraftRequest } from "../domain.js";
import { ceilSeconds } from "../time-format.js";
import { mapConcurrent, withRetry } from "./media-runtime.js";
import type { Storyboard } from "./model.js";

const DEFAULT_TTS_CONCURRENCY = 2;
const MIN_ESTIMATED_VOICE_SECONDS = 1.2;
const CJK_CHARS_PER_SECOND = 4.2;
const LATIN_WORDS_PER_SECOND = 2.6;
const execFileAsync = promisify(execFile);

const MimoSpeechChoiceSchema = z.object({
  message: z.object({
    audio: z.object({
      data: z.string().min(1),
    }),
  }),
});

const MimoSpeechResponseSchema = z.object({
  choices: z.tuple([MimoSpeechChoiceSchema]).rest(MimoSpeechChoiceSchema),
});

class UnsupportedTtsProviderError extends Error {
  readonly name = "UnsupportedTtsProviderError";

  constructor(readonly provider: string) {
    super(`Unsupported TTS provider: ${provider}`);
  }
}

export type VoiceAsset = {
  readonly sceneIndex: number;
  readonly path: string;
  readonly narration: string;
  readonly durationSeconds: number;
};

export interface VoiceAssetInput {
  readonly storyboard: Storyboard;
  readonly request: WorkflowDraftRequest;
  readonly settings: StudioSettings;
  readonly projectDir: string;
  readonly onProgress?: (message: string) => Promise<void> | void;
}

export async function prepareVoiceoverAssets(
  input: VoiceAssetInput,
): Promise<readonly VoiceAsset[]> {
  if (!input.request.includeVoiceover) {
    return [];
  }

  const apiKey = input.settings.tts.apiKey.trim();
  const model = input.settings.tts.model.trim();
  const voice = input.settings.tts.voice.trim();
  if (!apiKey || !model || !voice) {
    await input.onProgress?.("未配置语音 API Key、Model 或 Voice，跳过旁白音频");
    return [];
  }

  await mkdir(join(input.projectDir, "assets"), { recursive: true });
  const format = playableSpeechFormat(input.settings.tts.format);
  return mapConcurrent(
    input.storyboard.scenes,
    ttsConcurrency(input.storyboard.scenes.length),
    async (scene, index) => {
      const sceneNumber = String(index + 1).padStart(2, "0");
      await input.onProgress?.(`生成旁白音频 ${sceneNumber}/${input.storyboard.scenes.length}`);
      const audio = await withRetry(
        async () => {
          switch (input.settings.tts.provider) {
            case "mimo": {
              const response = await ky
                .post(joinUrl(input.settings.tts.baseUrl, "chat/completions"), {
                  timeout: 180_000,
                  headers: { "api-key": apiKey },
                  json: {
                    model,
                    messages: [
                      {
                        role: "user",
                        content: `请用自然清晰的中文短视频旁白风格朗读，语速约为 ${input.settings.tts.speed.toFixed(1)} 倍。`,
                      },
                      { role: "assistant", content: scene.narration },
                    ],
                    audio: {
                      format: format.responseFormat,
                      voice,
                    },
                  },
                })
                .json<unknown>();
              const body = MimoSpeechResponseSchema.parse(response);
              return Buffer.from(body.choices[0].message.audio.data, "base64");
            }
            case "custom":
            case "minimax":
            case "openai": {
              const speech = await ky
                .post(joinUrl(input.settings.tts.baseUrl, "audio/speech"), {
                  timeout: 180_000,
                  headers: { Authorization: `Bearer ${apiKey}` },
                  json: {
                    model,
                    voice,
                    input: scene.narration,
                    response_format: format.responseFormat,
                    speed: input.settings.tts.speed,
                  },
                })
                .arrayBuffer();
              return Buffer.from(speech);
            }
            default:
              return assertNever(input.settings.tts.provider);
          }
        },
        `旁白音频 ${sceneNumber}`,
        input.onProgress,
      );
      const relativePath = `assets/voice-${sceneNumber}${format.extension}`;
      const outputPath = join(input.projectDir, relativePath);
      await writeFile(outputPath, audio);
      return {
        sceneIndex: index,
        path: relativePath,
        narration: scene.narration,
        durationSeconds: await audioDurationSeconds(
          outputPath,
          scene.narration,
          input.settings.tts.speed,
        ),
      };
    },
  );
}

async function audioDurationSeconds(
  path: string,
  narration: string,
  speed: number,
): Promise<number> {
  const probed = await probeAudioDurationSeconds(path);
  if (probed !== null) {
    return probed;
  }
  return estimateNarrationDurationSeconds(narration, speed);
}

async function probeAudioDurationSeconds(path: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      path,
    ]);
    const duration = Number.parseFloat(stdout.trim());
    return Number.isFinite(duration) && duration > 0 ? roundUpSeconds(duration) : null;
  } catch (error: unknown) {
    if (error instanceof Error) {
      return null;
    }
    throw error;
  }
}

function estimateNarrationDurationSeconds(narration: string, speed: number): number {
  const cjkCount = Array.from(narration.matchAll(/[\u3400-\u9fff]/g)).length;
  const latinWordCount = narration.match(/[A-Za-z0-9]+/g)?.length ?? 0;
  const baseSeconds = cjkCount / CJK_CHARS_PER_SECOND + latinWordCount / LATIN_WORDS_PER_SECOND;
  const normalizedSpeed = Number.isFinite(speed) && speed > 0 ? speed : 1;
  return roundUpSeconds(Math.max(MIN_ESTIMATED_VOICE_SECONDS, baseSeconds / normalizedSpeed));
}

function roundUpSeconds(value: number): number {
  return ceilSeconds(value);
}

function playableSpeechFormat(format: StudioSettings["tts"]["format"]): {
  readonly responseFormat: "mp3" | "wav";
  readonly extension: ".mp3" | ".wav";
} {
  if (format === "mp3") {
    return { responseFormat: "mp3", extension: ".mp3" };
  }
  return { responseFormat: "wav", extension: ".wav" };
}

function ttsConcurrency(sceneCount: number): number {
  const { HF_TTS_CONCURRENCY: raw } = process.env;
  const value = raw ? Number.parseInt(raw, 10) : DEFAULT_TTS_CONCURRENCY;
  return Math.min(
    Number.isFinite(value) && value > 0 ? value : DEFAULT_TTS_CONCURRENCY,
    sceneCount,
  );
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path}`;
}

function assertNever(provider: never): never {
  throw new UnsupportedTtsProviderError(provider);
}
