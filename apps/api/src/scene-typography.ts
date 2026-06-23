import type { WorkflowDraftRequest } from "./domain.js";

type SceneFormat = WorkflowDraftRequest["format"];
type SceneDensity = "short" | "medium" | "dense";

export type SceneTypographyInput = {
  readonly format: SceneFormat;
  readonly headline: string;
  readonly body: string;
  readonly narration: string;
  readonly includeVoiceover: boolean;
};

export type SceneTypography = {
  readonly headlineSize: number;
  readonly bodySize: number;
  readonly captionSize: number;
  readonly kickerSize: number;
  readonly brandSize: number;
  readonly creditSize: number;
  readonly copyGap: number;
  readonly headlineLineHeight: number;
  readonly bodyLineHeight: number;
  readonly captionLineHeight: number;
  readonly headlineMaxWidth: string;
  readonly copyMaxWidth: string;
  readonly captionMaxWidth: string;
};

const TYPOGRAPHY: Record<SceneFormat, Record<SceneDensity, SceneTypography>> = {
  landscape: {
    short: sceneTypographyToken(78, 34, 24, 28, "1240px", "1160px"),
    medium: sceneTypographyToken(68, 30, 23, 24, "1300px", "1240px"),
    dense: sceneTypographyToken(60, 28, 22, 20, "1340px", "1300px"),
  },
  portrait: {
    short: sceneTypographyToken(84, 42, 30, 34, "890px", "860px"),
    medium: sceneTypographyToken(60, 36, 27, 28, "920px", "880px", "680px"),
    dense: sceneTypographyToken(56, 31, 24, 22, "930px", "900px", "760px"),
  },
  square: {
    short: sceneTypographyToken(70, 34, 24, 26, "900px", "860px"),
    medium: sceneTypographyToken(60, 30, 22, 22, "920px", "880px"),
    dense: sceneTypographyToken(50, 26, 20, 18, "930px", "900px"),
  },
};

export function sceneTypography(input: SceneTypographyInput): SceneTypography {
  return TYPOGRAPHY[input.format][sceneDensity(input)];
}

function sceneTypographyToken(
  headlineSize: number,
  bodySize: number,
  captionSize: number,
  copyGap: number,
  copyMaxWidth: string,
  captionMaxWidth: string,
  headlineMaxWidth = copyMaxWidth,
): SceneTypography {
  return {
    headlineSize,
    bodySize,
    captionSize,
    kickerSize: captionSize,
    brandSize: captionSize,
    creditSize: Math.max(16, captionSize - 8),
    copyGap,
    headlineLineHeight: 1.36,
    bodyLineHeight: 1.38,
    captionLineHeight: 1.42,
    headlineMaxWidth,
    copyMaxWidth,
    captionMaxWidth,
  };
}

function sceneDensity(input: SceneTypographyInput): SceneDensity {
  const headlineWeight = textWeight(input.headline);
  const bodyWeight = textWeight(input.body);
  const narrationWeight = input.includeVoiceover ? textWeight(input.narration) : 0;
  if (isDense(input.format, headlineWeight, bodyWeight, narrationWeight)) return "dense";
  if (isMedium(input.format, headlineWeight, bodyWeight, narrationWeight)) return "medium";
  return "short";
}

function isDense(
  format: SceneFormat,
  headlineWeight: number,
  bodyWeight: number,
  narrationWeight: number,
): boolean {
  if (format === "portrait") {
    return headlineWeight > 34 || bodyWeight > 135 || narrationWeight > 210;
  }
  if (format === "square") {
    return headlineWeight > 38 || bodyWeight > 125 || narrationWeight > 190;
  }
  return headlineWeight > 44 || bodyWeight > 58 || narrationWeight > 64;
}

function isMedium(
  format: SceneFormat,
  headlineWeight: number,
  bodyWeight: number,
  narrationWeight: number,
): boolean {
  if (format === "portrait") {
    return headlineWeight > 24 || bodyWeight > 78 || narrationWeight > 120;
  }
  if (format === "square") {
    return headlineWeight > 28 || bodyWeight > 72 || narrationWeight > 105;
  }
  return headlineWeight > 32 || bodyWeight > 58 || narrationWeight > 72;
}

function textWeight(text: string): number {
  return Array.from(text.trim()).reduce((sum, char) => sum + charWeight(char), 0);
}

function charWeight(char: string): number {
  if (/\s/u.test(char)) return 0.2;
  if (/[\u3000-\u9fff\uff00-\uffef]/u.test(char)) return 1;
  if (/[.,;:!?'"()[\]{}<>，。；：！？“”‘’（）《》、]/u.test(char)) return 0.32;
  return 0.56;
}
