/**
 * Chart animation, shared by every family.
 *
 * ## Why the engine defaults are wrong here
 *
 * ECharts animates an update over 300 ms with an ease-out curve. That is right
 * for a chart a person clicks on and wrong for a dashboard fed at 1 Hz: the
 * value lunges for a third of a second and then sits perfectly still for the
 * remaining two thirds. The result reads as a stutter once per second, which is
 * exactly what a live display should not do.
 *
 * So the default here is a transition **as long as the sampling interval**, with
 * **linear** easing. The value then travels at constant speed from where it was
 * to where it now is, arriving just as the next sample does. Nothing rests, and
 * nothing accelerates for reasons the data does not justify.
 *
 * This is precisely what §122 allows: "phone animations interpolate locally and
 * must not imply additional measured samples". A gauge arc gliding between two
 * readings is interpolation of a *picture*, and the picture is honest — it is
 * travelling between two values that were really measured.
 *
 * ## What is deliberately NOT interpolated
 *
 * Numeric text. A readout that glided through 61.4, 61.6, 61.8 would be showing
 * numbers no sensor ever reported, and §97 forbids presenting a fabricated
 * reading as a real one. Geometry may be interpolated because nobody reads a
 * value off an arc's position; digits may not, because that is exactly how they
 * are read. Text therefore changes once per sample, and that discontinuity is a
 * feature.
 */

/**
 * Easing curves worth exposing.
 *
 * A deliberately short list: these are the ones that mean something for live
 * data. ECharts supports a few dozen, most of which (bounce, elastic) would
 * make a temperature appear to overshoot and spring back, which is a lie about
 * the measurement.
 */
export const ANIMATION_EASINGS = [
  'linear',
  'cubicOut',
  'cubicInOut',
  'quadraticInOut',
  'quinticInOut',
] as const;

export type AnimationEasing = (typeof ANIMATION_EASINGS)[number];

export interface AnimationSettings {
  /**
   * Duration of a value transition, in milliseconds.
   *
   * Match it to the sampling interval for continuous motion. Shorter leaves the
   * value resting between samples; longer makes it lag behind reality, and a
   * dashboard that is visibly late is worse than one that is visibly stepped.
   */
  readonly durationMs: number;
  readonly easing: AnimationEasing;
  /**
   * Duration of the first appearance, in milliseconds.
   *
   * Separate from the update duration because they are different events: an
   * entrance can afford a curve, while every update after it wants constant
   * speed.
   */
  readonly appearMs: number;
  readonly appearEasing: AnimationEasing;
}

/** Matches the §122 one-second hardware baseline. */
export const defaultAnimationSettings: AnimationSettings = {
  durationMs: 1000,
  easing: 'linear',
  appearMs: 650,
  appearEasing: 'cubicOut',
};

/** The animation fields an ECharts option carries. */
export interface EngineAnimation {
  readonly animation: boolean;
  readonly animationDuration: number;
  readonly animationEasing: AnimationEasing;
  readonly animationDurationUpdate: number;
  readonly animationEasingUpdate: AnimationEasing;
}

/**
 * Builds the animation fields for an option.
 *
 * When `animate` is false every duration is zeroed as well as the flag being
 * cleared. Belt and braces on purpose: a still frame has to be *still*, and
 * relying on one boolean to suppress four behaviours is how a capture ends up
 * catching a transition.
 */
export function toEngineAnimation(
  settings: AnimationSettings | undefined,
  animate: boolean,
): EngineAnimation {
  const resolved = settings ?? defaultAnimationSettings;

  if (!animate) {
    return {
      animation: false,
      animationDuration: 0,
      animationEasing: 'linear',
      animationDurationUpdate: 0,
      animationEasingUpdate: 'linear',
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

/**
 * Keeps a duration sane.
 *
 * The upper bound matters more than it looks: a transition longer than a few
 * seconds means the displayed value is seconds behind the sensor, which turns a
 * monitoring tool into a decorative one.
 */
function clampDuration(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return defaultAnimationSettings.durationMs;
  }

  return Math.min(value, 5000);
}
