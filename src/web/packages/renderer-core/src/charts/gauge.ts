import type { Fill, GaugeSettings, GradientStop, Sample } from "../types.js";
import { hasPlottableValue } from "../types.js";
import { toEngineAnimation, type EngineAnimation } from "./animation.js";
import {
  colorAt,
  mixHex,
  normalizePosition,
  resolveFlatColor,
  toLinearGradient,
  type EngineColor,
} from "./fill.js";
import { resolveChartPaint } from "./chart-paint.js";
import type { FabricPalette } from "../theme/fabric-envelope.js";

// Preserved public export; implementation moved to fill.ts.
export { mixHex };

/**
 * Gauge adapter. ECharts supports arbitrary sweeps, but not true angular
 * gradients on `axisLine`; track gradients are approximated with segments (§85).
 */

type ColorSegment = [number, string];

/** Local emitted shape keeps raw ECharts options out of the theme model (§87). */
export interface GaugeOption {
  series: [
    {
      type: "gauge";
      startAngle: number;
      endAngle: number;
      min: number;
      max: number;
      radius: string;
      splitNumber: number;
      axisLine: {
        roundCap: boolean;
        lineStyle: { width: number; color: ColorSegment[] };
      };
      progress: {
        show: boolean;
        width: number;
        roundCap: boolean;
        itemStyle: { color: EngineColor };
      };
      pointer: { show: false };
      axisTick: { show: false };
      splitLine: { show: false };
      axisLabel: { show: false };
      detail: { show: false };
      data: { value: number }[];
      silent: true;
    } & EngineAnimation,
  ];
}

export function buildGaugeOption(
  settings: GaugeSettings,
  sample: Sample | undefined,
  animate = true,
  palette?: FabricPalette,
): GaugeOption {
  const plottable = hasPlottableValue(sample);

  // Clamp only the drawn arc; preserve the raw reading elsewhere (§83).
  const displayValue = plottable
    ? clamp(sample.value, settings.min, settings.max)
    : settings.min;

  return {
    series: [
      {
        type: "gauge",
        startAngle: settings.startAngle,
        endAngle: settings.endAngle,
        min: settings.min,
        max: settings.max,
        radius: "100%",
        splitNumber: 1,
        axisLine: {
          roundCap: settings.roundCap,
          lineStyle: {
            width: settings.thickness,
            color: toColorSegments(
              resolveChartPaint(settings.track, palette),
              settings,
            ),
          },
        },
        progress: {
          // Missing samples show only the track, never a false zero (§83).
          show: plottable,
          width: settings.thickness,
          roundCap: settings.roundCap,
          ...progressItemStyle(
            resolveChartPaint(settings.progress, palette),
            settings,
            displayValue,
          ),
        },
        // Chart typography is rendered by shared text elements (§91).
        pointer: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        detail: { show: false },
        data: [{ value: displayValue }],
        silent: true,
        ...toEngineAnimation(settings.animation, animate),
      },
    ],
  };
}

/** Convert a fill to ECharts `[proportion, color]` ring segments. */
export function toColorSegments(
  fill: Fill,
  settings: GaugeSettings,
): ColorSegment[] {
  switch (fill.kind) {
    case "solid":
      return [[1, fill.color]];

    case "thresholds":
      return normalizeBands(fill.bands);

    case "gradient":
      return approximateGradient(fill.stops, settings.gradientSegments ?? 64);
  }
}

/** ECharts needs ascending, unique segment ends covering the full ring. */
function normalizeBands(bands: readonly GradientStop[]): ColorSegment[] {
  if (bands.length === 0) {
    return [[1, "transparent"]];
  }

  const sorted = [...bands]
    .map((b) => ({ offset: clamp(b.offset, 0, 1), color: b.color }))
    .sort((a, b) => a.offset - b.offset);

  const segments: ColorSegment[] = [];

  for (const band of sorted) {
    const previous = segments.at(-1);
    if (previous && previous[0] === band.offset) {
      previous[1] = band.color;
      continue;
    }
    segments.push([band.offset, band.color]);
  }

  const last = segments.at(-1)!;
  if (last[0] < 1) {
    segments.push([1, last[1]]);
  }

  return segments;
}

/** Approximate an angular gradient with bounded flat-colour segments. */
export function approximateGradient(
  stops: readonly GradientStop[],
  segmentCount: number,
): ColorSegment[] {
  if (stops.length === 0) {
    return [[1, "transparent"]];
  }

  if (stops.length === 1) {
    return [[1, stops[0]!.color]];
  }

  const sorted = [...stops]
    .map((s) => ({ offset: clamp(s.offset, 0, 1), color: s.color }))
    .sort((a, b) => a.offset - b.offset);

  const count = Math.max(2, Math.min(256, Math.floor(segmentCount)));
  const segments: ColorSegment[] = [];

  for (let i = 1; i <= count; i++) {
    const proportion = i / count;
    const midpoint = (i - 0.5) / count;
    segments.push([proportion, colorAt(sorted, midpoint)]);
  }

  return segments;
}

/**
 * Resolve the progress arc separately from the track. Gradient progress uses a
 * cartesian gradient, so it does not follow the arc; that remains a §85 gap.
 */
function progressItemStyle(
  fill: Fill,
  settings: GaugeSettings,
  value: number,
): { itemStyle: { color: EngineColor } } {
  if (fill.kind === "gradient") {
    return { itemStyle: { color: toLinearGradient(fill.stops, "to-right") } };
  }

  return {
    itemStyle: {
      color: resolveFlatColor(
        fill,
        normalizePosition(value, settings.min, settings.max),
      ),
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
