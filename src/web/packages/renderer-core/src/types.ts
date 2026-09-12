/**
 * Wire types mirroring the C# contracts in `Vigilia.Contracts`.
 *
 * Keep these in lockstep with the C# records. A mismatch here is silent at
 * compile time and produces wrong pixels at runtime, so a change on either side
 * must change both.
 */

/**
 * Per-sample trustworthiness. Mirrors `SensorStatus`.
 *
 * Always branch on this before reading a value: §83 requires missing samples to
 * render as gaps, never as zeroes.
 */
export type SensorStatus = 'ok' | 'missing' | 'stale' | 'error' | 'unavailable';

/** One reading from one sensor. Mirrors the §93 sample contract. */
export interface Sample {
  readonly sensorId: string;
  /** ISO-8601 timestamp. */
  readonly timestamp: string;
  readonly status: SensorStatus;
  /** Raw and unclamped. Absent unless `status === 'ok'`. */
  readonly value?: number;
  readonly textValue?: string;
  readonly booleanValue?: boolean;
  readonly unit?: string;
  /** Pre-redacted diagnostic for a non-ok status. */
  readonly message?: string;
}

/** True when a sample carries a numeric value safe to plot. */
export function hasPlottableValue(sample: Sample | undefined): sample is Sample & { value: number } {
  return sample?.status === 'ok' && typeof sample.value === 'number' && Number.isFinite(sample.value);
}

// Imported the "wrong" way — a base types module reaching into charts/ — because
// GaugeSettings lives here for historical reasons while the other three families
// keep their settings beside their adapters. animation.ts imports nothing back,
// so there is no cycle; moving GaugeSettings to charts/gauge.ts is the real fix
// and is a separate change.
import type { AnimationSettings } from './charts/animation.js';

/** A colour stop in a gradient fill. */
export interface GradientStop {
  /** Position along the gradient, 0–1. */
  readonly offset: number;
  /** Any CSS colour. Hex (`#rrggbb`) is required for gradient approximation. */
  readonly color: string;
}

/**
 * Fill styles expressible by the theme schema.
 *
 * `thresholds` and `gradient` are deliberately distinct. Thresholds are discrete
 * bands with semantic meaning ("above 80 °C is red") and map natively onto
 * ECharts. A gradient is decorative and, on a gauge ring, has to be approximated
 * — see `gauge.ts`.
 */
export type Fill =
  | { readonly kind: 'solid'; readonly color: string }
  | { readonly kind: 'thresholds'; readonly bands: readonly GradientStop[] }
  | { readonly kind: 'gradient'; readonly stops: readonly GradientStop[] };

/** Typed gauge settings. Translated to ECharts options — never raw options (§87). */
export interface GaugeSettings {
  /** Start angle in degrees; 0 is the right of centre, 90 is straight up. Range −360…360. */
  readonly startAngle: number;
  /** End angle in degrees. Range −360…360. */
  readonly endAngle: number;
  readonly min: number;
  readonly max: number;
  /** Ring thickness in artboard pixels. */
  readonly thickness: number;
  readonly track: Fill;
  readonly progress: Fill;
  readonly roundCap: boolean;
  /**
   * Segment count used when approximating a gradient on the ring. Higher is
   * smoother and costlier; 64 is visually smooth at typical sizes.
   */
  readonly gradientSegments?: number;
  /** Omit for the continuous-glide default (see charts/animation.ts). */
  readonly animation?: AnimationSettings;
}

/** Sensible starting point for a progress gauge. */
export const defaultGaugeSettings: GaugeSettings = {
  startAngle: 225,
  endAngle: -45,
  min: 0,
  max: 100,
  thickness: 18,
  track: { kind: 'solid', color: '#2a2f3a' },
  progress: { kind: 'solid', color: '#00b8d9' },
  roundCap: true,
  gradientSegments: 64,
};
