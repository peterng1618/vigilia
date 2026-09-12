import type { Fill, Sample } from '../types.js';
import { hasPlottableValue } from '../types.js';
import { resolveThresholdColor, toLinearGradient } from './fill.js';
import type { EngineColor, LinearGradientColor } from './fill.js';

// Part of this module's surface before the shared resolution moved to fill.ts.
export type { EngineColor, LinearGradientColor };

/**
 * Typed settings → ECharts option for the line / filled-area / sparkline family
 * (§81). Same boundary rule as the gauge adapter: typed settings in, engine
 * options out, no raw executable options in the theme format (§87).
 *
 * ## Gradients work here, and that is not a contradiction
 *
 * The gauge adapter has to fake an angular gradient with discrete segments
 * because `axisLine.lineStyle.color` only accepts `[proportion, color]` pairs.
 * A line chart is different: it is cartesian, so a real ECharts `linearGradient`
 * object applies directly. The gauge limitation exists *because* gradients are
 * resolved in cartesian space and therefore cannot follow an arc — which is the
 * same fact, seen from the other side.
 *
 * ## The gap rule, in series form
 *
 * §83 requires missing samples to create gaps rather than zeroes. In a series
 * that means emitting an explicit `null` y-value, **not** omitting the point:
 * omitting it makes the line join the two neighbours and silently hide the
 * outage. `connectNulls` is therefore pinned to `false`.
 */

/** How a series is interpolated between points. */
export type Interpolation = 'linear' | 'smooth' | 'step';

/** One data point: epoch milliseconds and a value, or `null` for a gap. */
export type SeriesPoint = readonly [number, number | null];

/** Typed settings for a line-family chart. */
export interface LineSettings {
  readonly lineWidth: number;
  readonly interpolation: Interpolation;
  /** Stroke for the first series, and the fallback for any series the palette does not cover. */
  readonly stroke: Fill;
  /**
   * Per-series strokes, cycled by series index.
   *
   * §81 calls for multi-series line charts, and without this every series drew
   * in {@link LineSettings.stroke} — two traces in one colour, which is not a
   * multi-series chart in any useful sense. Index 0 falls back to `stroke`, so a
   * single-series chart needs no palette at all.
   */
  readonly palette?: readonly Fill[];
  /** Area fill under the line. Omit for a plain line — §83 wants this independent of the stroke. */
  readonly area?: Fill;
  readonly showMarkers: boolean;
  readonly markerSize: number;
  /** Visible time window, in seconds (§83). */
  readonly windowSeconds: number;
  /**
   * Hard cap on retained points per series (§122: bound chart points).
   * A safety valve — when exceeded the **oldest** points are dropped. Nothing is
   * averaged or interpolated, so no value is ever invented.
   */
  readonly maxPoints: number;
  /** Fixed axis minimum. Omit to let the engine choose. */
  readonly min?: number;
  readonly max?: number;
  readonly showAxes: boolean;
  /**
   * Largest-Triangle-Three-Buckets render-time downsampling. Reduces draw cost
   * without changing retained data. Off by default — enable once measured
   * against real hardware rather than on assumption (§120).
   */
  readonly sampling?: 'lttb' | 'average' | 'none';
}

/** Sensible starting point for a filled-area chart. */
export const defaultLineSettings: LineSettings = {
  lineWidth: 2,
  interpolation: 'smooth',
  stroke: { kind: 'solid', color: '#00b8d9' },
  area: {
    kind: 'gradient',
    stops: [
      { offset: 0, color: '#00b8d9' },
      { offset: 1, color: '#00b8d900' },
    ],
  },
  showMarkers: false,
  markerSize: 4,
  windowSeconds: 60,
  maxPoints: 600,
  showAxes: true,
  sampling: 'none',
};

/** One series of samples for one sensor. */
export interface SeriesInput {
  readonly sensorId: string;
  readonly samples: readonly Sample[];
  /** Legend label. Falls back to `sensorId`. */
  readonly label?: string;
}

/** The emitted option shape. Local and explicit, like the gauge adapter's. */
export interface LineOption {
  readonly animation: boolean;
  readonly grid: {
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
    readonly containLabel: boolean;
  };
  readonly xAxis: {
    readonly type: 'time';
    readonly show: boolean;
    readonly min: number;
    readonly max: number;
  };
  readonly yAxis: {
    readonly type: 'value';
    readonly show: boolean;
    readonly min?: number;
    readonly max?: number;
  };
  readonly series: readonly {
    readonly type: 'line';
    readonly name: string;
    readonly data: readonly SeriesPoint[];
    readonly showSymbol: boolean;
    readonly symbolSize: number;
    readonly smooth: boolean;
    readonly step: 'end' | false;
    readonly connectNulls: false;
    readonly lineStyle: { readonly width: number; readonly color: EngineColor };
    readonly areaStyle?: { readonly color: EngineColor };
    readonly sampling?: 'lttb' | 'average';
    readonly silent: true;
  }[];
}

/**
 * Converts samples into series points, preserving gaps.
 *
 * Windowing is applied first, then the point cap. Input is sorted defensively:
 * the host should deliver ordered samples, but an out-of-order one would draw a
 * visibly wrong chart rather than failing, which is harder to notice.
 *
 * @param nowMs Epoch milliseconds for the right edge of the window.
 */
export function toSeriesPoints(
  samples: readonly Sample[],
  settings: Pick<LineSettings, 'windowSeconds' | 'maxPoints'>,
  nowMs: number,
): SeriesPoint[] {
  const windowStart = nowMs - settings.windowSeconds * 1000;

  const points: SeriesPoint[] = [];

  for (const sample of samples) {
    const t = Date.parse(sample.timestamp);

    // An unparseable timestamp cannot be placed on a time axis. Dropping it
    // beats plotting it at epoch 0, which would stretch the axis to 1970.
    if (!Number.isFinite(t) || t < windowStart || t > nowMs) {
      continue;
    }

    // §83: a non-Ok sample becomes an explicit null so the line BREAKS.
    // Omitting the point instead would connect its neighbours and hide the
    // outage — the specific mistake this guards against.
    points.push([t, hasPlottableValue(sample) ? sample.value : null]);
  }

  points.sort((a, b) => a[0] - b[0]);

  // §122: bound retained points. Drop the oldest; never average or interpolate.
  if (points.length > settings.maxPoints) {
    return points.slice(points.length - settings.maxPoints);
  }

  return points;
}

/** Builds the option for one or more line series. */
export function buildLineOption(
  settings: LineSettings,
  series: readonly SeriesInput[],
  nowMs: number,
  animate = true,
): LineOption {
  const windowStart = nowMs - settings.windowSeconds * 1000;
  const sampling = settings.sampling && settings.sampling !== 'none' ? settings.sampling : undefined;

  return {
    animation: animate,
    grid: {
      left: settings.showAxes ? 8 : 0,
      right: settings.showAxes ? 8 : 0,
      top: 8,
      bottom: settings.showAxes ? 8 : 0,
      // A sparkline must reach the element edges; axis labels must not steal
      // space from the artboard geometry the author laid out.
      containLabel: settings.showAxes,
    },
    xAxis: {
      type: 'time',
      show: settings.showAxes,
      // Pin the window so the chart scrolls with time instead of rescaling to
      // whatever data happens to be present.
      min: windowStart,
      max: nowMs,
    },
    yAxis: {
      type: 'value',
      show: settings.showAxes,
      ...(settings.min === undefined ? {} : { min: settings.min }),
      ...(settings.max === undefined ? {} : { max: settings.max }),
    },
    series: series.map((input, index) => ({
      type: 'line' as const,
      name: input.label ?? input.sensorId,
      data: toSeriesPoints(input.samples, settings, nowMs),
      showSymbol: settings.showMarkers,
      symbolSize: settings.markerSize,
      smooth: settings.interpolation === 'smooth',
      step: settings.interpolation === 'step' ? ('end' as const) : (false as const),
      // Pinned false: true would bridge gaps and defeat §83.
      connectNulls: false as const,
      lineStyle: {
        width: settings.lineWidth,
        color: toEngineColor(strokeFor(settings, index), 'stroke'),
      },
      // Only the first series gets the area fill. Stacked translucent areas
      // turn into mud and hide the very crossings a multi-series chart exists
      // to show; the lines stay distinguishable by palette instead.
      ...(settings.area === undefined || index > 0
        ? {}
        : { areaStyle: { color: toEngineColor(settings.area, 'area') } }),
      ...(sampling === undefined ? {} : { sampling }),
      silent: true as const,
    })),
  };
}

/** The stroke for one series: the palette entry if there is one, else `stroke`. */
export function strokeFor(settings: LineSettings, index: number): Fill {
  const palette = settings.palette;

  if (palette === undefined || palette.length === 0) {
    return settings.stroke;
  }

  return palette[index % palette.length] ?? settings.stroke;
}

/**
 * Converts a {@link Fill} into an engine colour.
 *
 * - `solid` → the colour string.
 * - `gradient` → a real vertical `linearGradient`. Unlike the gauge case this
 *   needs no approximation, because a cartesian chart is exactly where an
 *   ECharts gradient is defined.
 * - `thresholds` → the band colour that applies at the top of the range. A
 *   line's colour is a property of the whole series, so per-value banding is not
 *   expressible here; §85 requires such gaps to be explicit rather than silently
 *   approximated, and this one is recorded in the Gate 0 matrix.
 */
export function toEngineColor(fill: Fill, usage: 'stroke' | 'area'): EngineColor {
  switch (fill.kind) {
    case 'solid':
      return fill.color;

    case 'gradient':
      // Vertical for an area fill, so it fades toward the axis; horizontal for a
      // stroke, so a line gradient reads along the time axis instead.
      return toLinearGradient(fill.stops, usage === 'area' ? 'to-bottom' : 'to-right');

    case 'thresholds':
      // A line's colour is a property of the whole series, so the band at the
      // top of the range stands in for all of them (see the doc comment).
      return resolveThresholdColor(fill.bands, 1);
  }
}
