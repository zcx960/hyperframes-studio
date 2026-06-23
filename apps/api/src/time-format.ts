const SECOND_PRECISION = 10;
const MILLISECOND_PRECISION = 1000;
const CLIP_BOUNDARY_GAP_SECONDS = 0.001;

export function roundSeconds(value: number): number {
  return Math.round(value * SECOND_PRECISION) / SECOND_PRECISION;
}

export function ceilSeconds(value: number): number {
  return Math.ceil(value * SECOND_PRECISION - 1e-9) / SECOND_PRECISION;
}

export function formatSeconds(value: number): string {
  const rounded = roundSeconds(value);
  return formatRoundedSeconds(rounded, 1);
}

export function formatClipDuration(value: number, hasFollowingClip: boolean): string {
  const adjusted = hasFollowingClip ? Math.max(0, value - CLIP_BOUNDARY_GAP_SECONDS) : value;
  const rounded = Math.round(adjusted * MILLISECOND_PRECISION) / MILLISECOND_PRECISION;
  return formatRoundedSeconds(rounded, 3);
}

function formatRoundedSeconds(value: number, fractionDigits: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(fractionDigits).replace(/0+$/, "").replace(/\.$/, "");
}
