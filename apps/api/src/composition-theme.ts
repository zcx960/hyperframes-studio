import type { WorkflowDraftRequest } from "./domain.js";

export type CompositionTheme = {
  readonly bg: string;
  readonly fg: string;
  readonly muted: string;
  readonly accent: string;
  readonly accent2: string;
};

export const STYLE_THEME: Record<WorkflowDraftRequest["style"], CompositionTheme> = {
  "news-flash": {
    bg: "#080b10",
    fg: "#f7fbff",
    muted: "#bac7d5",
    accent: "#ffce2e",
    accent2: "#ff4d4d",
  },
  cinematic: {
    bg: "#11100e",
    fg: "#fff6e8",
    muted: "#d2c3ad",
    accent: "#e8b45d",
    accent2: "#6cb6ff",
  },
  infographic: {
    bg: "#071512",
    fg: "#effffb",
    muted: "#aed7ce",
    accent: "#3ee7b0",
    accent2: "#7aa7ff",
  },
  "minimal-editorial": {
    bg: "#f7f3ed",
    fg: "#191713",
    muted: "#6d665d",
    accent: "#d94f30",
    accent2: "#245b8f",
  },
};

export const FORMAT_SIZE: Record<
  WorkflowDraftRequest["format"],
  { readonly width: number; readonly height: number }
> = {
  portrait: { width: 1080, height: 1920 },
  landscape: { width: 1920, height: 1080 },
  square: { width: 1080, height: 1080 },
};
