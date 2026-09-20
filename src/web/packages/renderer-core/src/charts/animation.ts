/**
 * Shared chart animation policy. Geometry may interpolate locally (§122), but
 * numeric text must only show measured samples (§97).
 */

/** Live-data easing options; excludes curves that imply overshoot. */
export const ANIMATION_EASINGS = [
  "linear",
  "cubicOut",
  "cubicInOut",
  "quadraticInOut",
  "quinticInOut",
] as const;

export type AnimationEasing = (typeof ANIMATION_EASINGS)[number];

export interface AnimationSettings {
  /** Value-transition duration in milliseconds. */
  readonly durationMs: number;
  readonly easing: AnimationEasing;
  /** Initial-appearance duration in milliseconds. */
  readonly appearMs: number;
  readonly appearEasing: AnimationEasing;
}

/** Matches the §122 one-second sampling baseline. */
export const defaultAnimationSettings: AnimationSettings = {
  durationMs: 1000,
  easing: "linear",
  appearMs: 650,
  appearEasing: "cubicOut",
};

export interface EngineAnimation {
  readonly animation: boolean;
  readonly animationDuration: number;
  readonly animationEasing: AnimationEasing;
  readonly animationDurationUpdate: number;
  readonly animationEasingUpdate: AnimationEasing;
}

/** Zero all durations when disabled so capture paths are fully static. */
export function toEngineAnimation(
  settings: AnimationSettings | undefined,
  animate: boolean,
): EngineAnimation {
  const resolved = settings ?? defaultAnimationSettings;

  if (!animate) {
    return {
      animation: false,
      animationDuration: 0,
      animationEasing: "linear",
      animationDurationUpdate: 0,
      animationEasingUpdate: "linear",
    };
  }

  return {
    animation: true,
    animationDuration: clampDuration(resolved.appearMs),
    animationEasing: resolved.appearEasing,
    animationDurationUpdate: clampDuration(resolved.durationMs),
    animationEasingUpdate: resolved.easing,
  };
}

/** Bound lag; invalid durations fall back to the one-second baseline. */
function clampDuration(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return defaultAnimationSettings.durationMs;
  }

  return Math.min(value, 5000);
}
