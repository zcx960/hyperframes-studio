import type { VoiceAsset } from "./providers/voice.js";
import { ceilSeconds } from "./time-format.js";

const DEFAULT_SILENT_SCENE_SECONDS = 5;
const DEFAULT_VOICEOVER_SCENE_SECONDS = 8;
const VOICEOVER_TAIL_PADDING_SECONDS = 0.8;

export type SceneTiming = {
  readonly start: number;
  readonly duration: number;
};

export function buildSceneTimings(
  sceneCount: number,
  includeVoiceover: boolean,
  voiceAssets: readonly VoiceAsset[],
): readonly SceneTiming[] {
  let start = 0;
  return Array.from({ length: sceneCount }, (_unused, index) => {
    const duration = sceneDuration(index, includeVoiceover, voiceAssets);
    const timing = { start: ceilSeconds(start), duration };
    start = ceilSeconds(start + duration);
    return timing;
  });
}

export function totalSceneDuration(timings: readonly SceneTiming[]): number {
  const last = timings.at(-1);
  return last ? ceilSeconds(last.start + last.duration) : 0;
}

function sceneDuration(
  index: number,
  includeVoiceover: boolean,
  voiceAssets: readonly VoiceAsset[],
): number {
  const defaultDuration = includeVoiceover
    ? DEFAULT_VOICEOVER_SCENE_SECONDS
    : DEFAULT_SILENT_SCENE_SECONDS;
  const voiceDuration =
    voiceAssets.find((asset) => asset.sceneIndex === index)?.durationSeconds ?? 0;
  if (!includeVoiceover || voiceDuration <= 0) {
    return defaultDuration;
  }
  return ceilSeconds(Math.max(defaultDuration, voiceDuration + VOICEOVER_TAIL_PADDING_SECONDS));
}
