import type { Fill, GaugeSettings, GradientStop, Sample } from '../types.js';
import { hasPlottableValue } from '../types.js';
import {
  colorAt,
  mixHex,
  normalizePosition,
  resolveFlatColor,
  toLinearGradient,
  type EngineColor,
} from './fill.js';

// Re-exported because it was part of this module's surface before the shared
// resolution moved to fill.ts, and colour mixing is not gauge-specific.
export { mixHex };

/**
 * Translates typed gauge settings into an ECharts gauge option.
 *
 * §87 requires typed chart settings translated into ECharts configuration, with
 * no raw executable options crossing the boundary. This module is that
 * translation for the gauge family.
 *
 * ## Verified engine behaviour (ECharts 6.1.0, checked 2026-09-12)
 *
 * - **Arbitrary sweep works.** `startAngle` and `endAngle` each accept −360…360
 *   (defaults 225 / −45), so full, half and arbitrary-sweep gauges are all
 *   natively expressible — §81 is satisfied directly.
 * - **Gradients along the ring do not.** `axisLine.lineStyle.color` takes
 *   `[[proportion, color], …]` pairs and produces *discrete colour segments*.
 *   Gradient objects are not documented for this property.
 *
 * The second point is the §85 "engine gap". For the **track**, the approach is
 * to approximate an angular gradient with many small segments
 * ({@link GaugeSettings.gradientSegments}), because it keeps one renderer and one
 * JSON representation for both editor and display. It is an approximation:
 * banding is visible at low segment counts and very large radii.
 *
 * The **progress** arc cannot use that path at all — `axisLine` is a single
 * property and the track already owns it — so its fill is resolved by
 * {@link progressItemStyle} instead. The gap therefore has two halves, and only
 * a human can settle it (recorded in `docs/gates/gate-0.md`).
 *
 * If Gate 0 review rejects the approximation, the alternative is a shared native
 * overlay arc — which stays consistent with §91's rule that a native text/vector
 * overlay is acceptable but a *bitmap* substitute never is.
 */

/** An ECharts `[proportion, color]` pair. */
type ColorSegment = [number, string];

/**
 * Minimal structural type for what this module emits. Deliberately local rather
 * than `echarts.EChartsOption`: it keeps the emitted shape explicit and reviewable,
 * and avoids coupling the theme schema to the engine's full option surface.
 */
export interface GaugeOption {
  series: [
    {
      type: 'gauge';
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
      animation: boolean;
    },
  ];
}

/**
 * Builds the option for one gauge.
 *
 * @param settings Typed settings from the theme document.
 * @param sample The latest sample, or undefined if none has arrived.
 * @param animate Whether to animate the transition. Disable for screenshot tests.
 */
export function buildGaugeOption(
  settings: GaugeSettings,
  sample: Sample | undefined,
  animate = true,
): GaugeOption {
  const plottable = hasPlottableValue(sample);

  // §83: preserve the raw value, clamp only for display. A gauge whose sensor
  // reads 105 % must still report 105 % elsewhere while drawing a full ring.
  const displayValue = plottable ? clamp(sample.value, settings.min, settings.max) : settings.min;

  return {
    series: [
      {
        type: 'gauge',
        startAngle: settings.startAngle,
        endAngle: settings.endAngle,
        min: settings.min,
        max: settings.max,
        radius: '100%',
        splitNumber: 1,
        axisLine: {
          roundCap: settings.roundCap,
          lineStyle: {
            width: settings.thickness,
            color: toColorSegments(settings.track, settings),
          },
        },
        progress: {
          // A missing sample draws the track only — a gap, not a zero-length ring
          // that would read as "0 %".
          show: plottable,
          width: settings.thickness,
          roundCap: settings.roundCap,
          ...progressItemStyle(settings.progress, settings, displayValue),
        },
        // Everything below is suppressed because typography is rendered by our
        // own text elements (§91), not by the chart engine.
        pointer: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        detail: { show: false },
        data: [{ value: displayValue }],
        silent: true,
        animation: animate,
      },
    ],
  };
}

/**
 * Converts a {@link Fill} into ECharts `[proportion, color]` segments.
 *
 * - `solid` → one segment spanning the ring.
 * - `thresholds` → one segment per band, exactly as authored. Native and exact.
 * - `gradient` → N interpolated segments approximating an angular gradient.
 */
export function toColorSegments(fill: Fill, settings: GaugeSettings): ColorSegment[] {
  switch (fill.kind) {
    case 'solid':
      return [[1, fill.color]];

    case 'thresholds':
      return normalizeBands(fill.bands);

    case 'gradient':
      return approximateGradient(fill.stops, settings.gradientSegments ?? 64);
  }
}

/**
 * ECharts needs ascending, de-duplicated proportions ending at 1. Authored bands
 * may be out of order or stop short, so normalise rather than trusting input.
 */
function normalizeBands(bands: readonly GradientStop[]): ColorSegment[] {
  if (bands.length === 0) {
    return [[1, 'transparent']];
  }

  const sorted = [...bands]
    .map((b) => ({ offset: clamp(b.offset, 0, 1), color: b.color }))
    .sort((a, b) => a.offset - b.offset);

  const segments: ColorSegment[] = [];

  for (const band of sorted) {
    const previous = segments.at(-1);
    if (previous && previous[0] === band.offset) {
      // Same boundary twice: last declaration wins.
      previous[1] = band.color;
      continue;
    }
    segments.push([band.offset, band.color]);
  }

  // The ring must be fully covered or ECharts leaves the tail unpainted.
  const last = segments.at(-1)!;
  if (last[0] < 1) {
    segments.push([1, last[1]]);
  }

  return segments;
}

/**
 * Approximates a gradient with discrete segments.
 *
 * This exists only because `axisLine.lineStyle.color` cannot express a true
 * angular gradient (see the module comment). Each segment is a flat colour, so
 * smoothness is bounded by `segmentCount`.
 */
export function approximateGradient(
  stops: readonly GradientStop[],
  segmentCount: number,
): ColorSegment[] {
  if (stops.length === 0) {
    return [[1, 'transparent']];
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
    // Sample at the segment midpoint so the flat fill best represents the span
    // it covers, rather than being biased to one edge.
    const midpoint = (i - 0.5) / count;
    segments.push([proportion, colorAt(sorted, midpoint)]);
  }

  return segments;
}

/**
 * Resolves the colour of the progress arc.
 *
 * This used to leave `itemStyle` unset for a `thresholds` or `gradient` fill, on
 * the reasoning that such fills are "expressed through axisLine segments
 * instead". They are not: `axisLine` carries the **track**, and the progress arc
 * is drawn over it — so an unset colour fell through to ECharts' default blue
 * and the authored fill was silently discarded. Found by looking at a rendered
 * screenshot; no unit test could see it, because the emitted option was exactly
 * what the adapter intended.
 *
 * - `solid` → the colour.
 * - `thresholds` → the band containing the **current value**, so a ring turns
 *   amber then red as the value crosses the boundaries. Native and exact, the
 *   same resolution the bar family uses per item.
 * - `gradient` → a real cartesian gradient object. It is a true gradient, but it
 *   resolves left-to-right across the ring's box rather than following the arc.
 *   The §85 engine gap is unchanged and still needs a human decision: the
 *   angular segment approximation applies to the **track** only, because one
 *   `axisLine` cannot carry two fills.
 */
function progressItemStyle(
  fill: Fill,
  settings: GaugeSettings,
  value: number,
): { itemStyle: { color: EngineColor } } {
  if (fill.kind === 'gradient') {
    return { itemStyle: { color: toLinearGradient(fill.stops, 'to-right') } };
  }

  return {
    itemStyle: {
      color: resolveFlatColor(fill, normalizePosition(value, settings.min, settings.max)),
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
