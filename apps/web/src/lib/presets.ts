import type { StudioSettings } from "../types";

type Llm = StudioSettings["llm"];
type Tts = StudioSettings["tts"];

/** Default endpoint/model presets applied when switching a provider (secrets are kept). */
export const LLM_PRESETS: Record<Llm["provider"], Pick<Llm, "baseUrl" | "model">> = {
  "openai-compatible": { baseUrl: "https://api.openai.com/v1", model: "gpt-4.1-mini" },
  "anthropic-compatible": {
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-sonnet-4-6",
  },
  custom: { baseUrl: "https://api.example.com/v1", model: "" },
};

export const TTS_PRESETS: Record<
  Tts["provider"],
  Pick<Tts, "baseUrl" | "model" | "voice" | "format">
> = {
  mimo: {
    baseUrl: "https://api.xiaomimimo.com/v1",
    model: "mimo-v2.5-tts",
    voice: "冰糖",
    format: "wav",
  },
  minimax: {
    baseUrl: "https://api.minimaxi.com/v1",
    model: "speech-2.8-hd",
    voice: "male-qn-qingse",
    format: "mp3",
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini-tts",
    voice: "alloy",
    format: "mp3",
  },
  custom: { baseUrl: "https://api.example.com/v1", model: "", voice: "", format: "mp3" },
};

export const LLM_PROVIDER_LABELS: Record<Llm["provider"], string> = {
  "openai-compatible": "OpenAI 兼容",
  "anthropic-compatible": "Anthropic 兼容",
  custom: "自定义",
};

export const TTS_PROVIDER_LABELS: Record<Tts["provider"], string> = {
  mimo: "小米 MiMo",
  minimax: "MiniMax",
  openai: "OpenAI",
  custom: "自定义",
};

/** A secret looks masked when the server returned `abcd...wxyz` or `********`. */
export function isMaskedSecret(value: string): boolean {
  return value === "********" || /^.{4}\.\.\..{4}$/.test(value);
}

/** Count of changed leaf fields between two settings objects (for the dirty badge). */
export function countChanges(a: StudioSettings, b: StudioSettings): number {
  let changes = 0;
  const walk = (x: unknown, y: unknown): void => {
    if (typeof x === "object" && x !== null && typeof y === "object" && y !== null) {
      const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
      for (const key of keys) {
        walk((x as Record<string, unknown>)[key], (y as Record<string, unknown>)[key]);
      }
      return;
    }
    if (x !== y) {
      changes += 1;
    }
  };
  walk(a, b);
  return changes;
}
