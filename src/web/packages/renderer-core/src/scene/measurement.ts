import { describeSemanticKey } from "../data/semantic-keys.js";

/**
 * A consumer's measurement preference, applied when a value is displayed.
 *
 * Conversion happens here and never in the sample: a provider reports what it
 * measured, and a display derives the form the consumer reads. Storing a
 * converted value would put a derived number where a measurement belongs
 * (§97, and product goal 5).
 */

export type MeasurementSystem = "metric" | "imperial";

export const DEFAULT_MEASUREMENT_SYSTEM: MeasurementSystem = "metric";

/** Families that convert, keyed by what the vocabulary declares. */
export type ConvertibleFamily = "temperature";

export interface ConvertedValue {
  readonly value: number;
  /** The symbol for the converted form; unchanged when nothing converted. */
  readonly unit: string | undefined;
}

/** °F is a scale and an offset, so this is not a ratio like a byte unit. */
function toFahrenheit(celsius: number): number {
  return celsius * 1.8 + 32;
}

/**
 * The value and unit a display shows for one sample. Metric returns what the
 * provider measured, untouched.
 */
export function convertForDisplay(
  semanticKey: string,
  value: number,
  unit: string | undefined,
  system: MeasurementSystem,
): ConvertedValue {
  if (system === "metric") {
    return { value, unit };
  }

  // Only a family the vocabulary says converts may be touched; anything else
  // keeps its reported unit rather than being guessed at.
  const family = describeSemanticKey(semanticKey)?.converts;
  if (family !== "temperature" || unit !== "°C") {
    return { value, unit };
  }

  return { value: toFahrenheit(value), unit: "°F" };
}
