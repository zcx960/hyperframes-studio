import { FORMAT_SIZE, STYLE_THEME } from "./composition-theme.js";
import type { WorkflowDraftRequest } from "./domain.js";
import { alpha, escapeHtml } from "./html-utils.js";
import type { SceneAsset } from "./providers/media.js";
import type { Storyboard } from "./providers/model.js";
import type { VoiceAsset } from "./providers/voice.js";
import { type SceneTiming, buildSceneTimings, totalSceneDuration } from "./scene-timing.js";
import { type SceneTypography, sceneTypography } from "./scene-typography.js";
import { formatClipDuration, formatSeconds } from "./time-format.js";
import { createTimelineScript } from "./timeline-script.js";

const FALLBACK_SCENE_TIMING: SceneTiming = { start: 0, duration: 5 };

type SceneHtmlInput = {
  readonly scene: Storyboard["scenes"][number];
  readonly index: number;
  readonly timing: SceneTiming;
  readonly format: WorkflowDraftRequest["format"];
  readonly hasFollowingClip: boolean;
  readonly includeVoiceover: boolean;
  readonly sceneAssets: readonly SceneAsset[];
};

export function composeHyperframesHtml(
  storyboard: Storyboard,
  request: WorkflowDraftRequest,
  sceneAssets: readonly SceneAsset[] = [],
  voiceAssets: readonly VoiceAsset[] = [],
): string {
  const size = FORMAT_SIZE[request.format];
  const sceneTimings = buildSceneTimings(
    storyboard.scenes.length,
    request.includeVoiceover,
    voiceAssets,
  );
  const totalDuration = totalSceneDuration(sceneTimings);
  const theme = STYLE_THEME[request.style];
  const timelineScript = createTimelineScript(sceneTimings.map((timing) => timing.duration));

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(storyboard.title)}</title>
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: ${size.width}px;
        height: ${size.height}px;
        overflow: hidden;
        background: ${theme.bg};
        color: ${theme.fg};
        font-family: Inter, sans-serif;
      }
      [data-composition-id="main"] {
        position: relative;
        width: ${size.width}px;
        height: ${size.height}px;
        overflow: hidden;
        background:
          radial-gradient(circle at 18% 18%, ${alpha(theme.accent, 0.38)}, transparent 34%),
          radial-gradient(circle at 84% 78%, ${alpha(theme.accent2, 0.28)}, transparent 32%),
          ${theme.bg};
      }
      .scene {
        position: absolute;
        inset: 0;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr) auto;
        align-items: stretch;
        gap: ${request.format === "landscape" ? 28 : 40}px;
        box-sizing: border-box;
        padding: ${request.format === "landscape" ? "96px 120px" : "132px 76px"};
        opacity: 0;
      }
      .scene::after {
        content: "";
        position: absolute;
        inset: 0;
        z-index: 0;
        background:
          linear-gradient(90deg, ${alpha(theme.bg, 0.92)} 0%, ${alpha(theme.bg, 0.7)} 52%, ${alpha(theme.bg, 0.38)} 100%),
          radial-gradient(circle at 20% 18%, ${alpha(theme.accent, 0.28)}, transparent 35%);
        pointer-events: none;
      }
      .scene > :not(.scene-bg) {
        position: relative;
        z-index: 1;
      }
      .scene-bg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: ${request.style === "minimal-editorial" ? 0.42 : 0.58};
        filter: saturate(1.08) contrast(1.06);
        transform: scale(1.06);
      }
      .brand {
        align-self: start;
        color: ${alpha(theme.fg, 0.72)};
        font-size: var(--brand-size);
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .copy {
        align-self: center;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: var(--copy-gap);
        max-width: var(--copy-max-width);
        min-height: 0;
        overflow: visible;
      }
      .kicker {
        align-self: flex-start;
        color: ${theme.bg};
        background: ${theme.accent};
        border-radius: 999px;
        padding: 14px 24px;
        font-size: var(--kicker-size);
        font-weight: 800;
        letter-spacing: 0.08em;
      }
      .headline {
        max-width: var(--headline-max-width);
        font-size: var(--headline-size);
        font-weight: 900;
        line-height: var(--headline-line-height);
        text-wrap: pretty;
        overflow-wrap: break-word;
        word-break: normal;
        line-break: strict;
      }
      .body {
        color: ${theme.muted};
        font-size: var(--body-size);
        line-height: var(--body-line-height);
        font-weight: 650;
        text-wrap: pretty;
        overflow-wrap: anywhere;
        word-break: break-word;
        line-break: anywhere;
      }
      .scene-number {
        position: absolute;
        right: ${request.format === "landscape" ? 84 : 56}px;
        bottom: ${request.format === "landscape" ? 68 : 78}px;
        color: ${alpha(theme.fg, 0.5)};
        font-size: var(--caption-size);
        font-variant-numeric: tabular-nums;
      }
      .caption {
        align-self: end;
        max-width: var(--caption-max-width);
        border-left: 8px solid ${theme.accent2};
        padding: 18px 0 18px 26px;
        color: ${alpha(theme.fg, 0.76)};
        font-size: var(--caption-size);
        line-height: var(--caption-line-height);
        overflow: visible;
        text-wrap: pretty;
        overflow-wrap: anywhere;
        word-break: break-word;
        line-break: anywhere;
      }
      .media-credit {
        position: absolute;
        right: ${request.format === "landscape" ? 84 : 56}px;
        top: ${request.format === "landscape" ? 58 : 70}px;
        color: ${alpha(theme.fg, 0.56)};
        font-size: var(--credit-size);
      }
    </style>
  </head>
  <body>
    <div id="stage" data-composition-id="main" data-start="0" data-width="${size.width}" data-height="${size.height}" data-duration="${formatSeconds(totalDuration)}" data-fps="30">
${storyboard.scenes.map((scene, index) => sceneHtml({ scene, index, timing: sceneTimings[index] ?? FALLBACK_SCENE_TIMING, format: request.format, hasFollowingClip: index < storyboard.scenes.length - 1, includeVoiceover: request.includeVoiceover, sceneAssets })).join("\n")}
${voiceAssets.map((asset) => voiceHtml(asset, sceneTimings[asset.sceneIndex] ?? FALLBACK_SCENE_TIMING, hasLaterVoiceAsset(asset, voiceAssets))).join("\n")}
      <script>
${timelineScript}
      </script>
    </div>
  </body>
</html>
`;
}

function sceneHtml(input: SceneHtmlInput): string {
  const { scene, index, timing, includeVoiceover, sceneAssets } = input;
  const sceneNumber = String(index + 1).padStart(2, "0");
  const asset = sceneAssets.find((item) => item.sceneIndex === index);
  const typography = sceneTypography({
    format: input.format,
    headline: scene.headline,
    body: scene.body,
    narration: scene.narration,
    includeVoiceover,
  });
  return `      <section id="scene-${sceneNumber}" class="scene clip" data-start="${formatSeconds(timing.start)}" data-duration="${formatClipDuration(timing.duration, input.hasFollowingClip)}" data-track-index="0" style="${typographyStyle(typography)}">
        ${asset ? `<img class="scene-bg" src="${escapeHtml(asset.path)}" alt="${escapeHtml(asset.alt)}" />` : ""}
        <div class="brand">HyperFrames Studio</div>
        <div class="copy">
          <div class="kicker">${escapeHtml(scene.emphasis ?? sceneNumber)}</div>
          <div class="headline">${escapeHtml(scene.headline)}</div>
          <div class="body">${escapeHtml(scene.body)}</div>
        </div>
        ${includeVoiceover ? `<div class="caption">${escapeHtml(scene.narration)}</div>` : ""}
        ${asset?.attribution ? `<div class="media-credit">${escapeHtml(asset.attribution)}</div>` : ""}
        <div class="scene-number">${sceneNumber}</div>
      </section>`;
}

function typographyStyle(typography: SceneTypography): string {
  return [
    `--headline-size: ${typography.headlineSize}px`,
    `--body-size: ${typography.bodySize}px`,
    `--caption-size: ${typography.captionSize}px`,
    `--kicker-size: ${typography.kickerSize}px`,
    `--brand-size: ${typography.brandSize}px`,
    `--credit-size: ${typography.creditSize}px`,
    `--copy-gap: ${typography.copyGap}px`,
    `--headline-line-height: ${typography.headlineLineHeight}`,
    `--body-line-height: ${typography.bodyLineHeight}`,
    `--caption-line-height: ${typography.captionLineHeight}`,
    `--headline-max-width: ${typography.headlineMaxWidth}`,
    `--copy-max-width: ${typography.copyMaxWidth}`,
    `--caption-max-width: ${typography.captionMaxWidth}`,
  ].join("; ");
}

function voiceHtml(asset: VoiceAsset, timing: SceneTiming, hasFollowingClip: boolean): string {
  const sceneNumber = String(asset.sceneIndex + 1).padStart(2, "0");
  return `      <audio id="voice-${sceneNumber}" data-start="${formatSeconds(timing.start)}" data-duration="${formatClipDuration(timing.duration, hasFollowingClip)}" data-track-index="1" src="${escapeHtml(asset.path)}" data-volume="1"></audio>`;
}

function hasLaterVoiceAsset(asset: VoiceAsset, voiceAssets: readonly VoiceAsset[]): boolean {
  return voiceAssets.some((item) => item.sceneIndex > asset.sceneIndex);
}
