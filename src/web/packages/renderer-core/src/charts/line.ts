import type { ChartPaint, Fill, Sample } from '../types.js';
import { hasPlottableValue } from '../types.js';
import { toEngineAnimation, type AnimationSettings, type EngineAnimation } from './animation.js';
import { resolveThresholdColor, toLinearGradient } from './fill.js';
import type { EngineColor, LinearGradientColor } from './fill.js';
import { cartesianGrid, type CartesianGrid } from './grid.js';
import { resolveChartPaint } from './chart-paint.js';
import type { FabricPalette } from '../theme/fabric-envelope.js';

// Preserved public exports; implementation moved to fill.ts.
export type { EngineColor, LinearGradientColor };

/**
 * Line/area/sparkline adapter. Missing samples are explicit `null` points and
 * `connectNulls` stays false so outages remain visible (§83).
 */

export type Interpolation = 'linear' | 'smooth' | 'step';
export type DashPattern = 'solid' | 'dashed' | 'dotted';
export type SeriesPoint = readonly [number, number | null];

export interface LineSettings {
  readonly lineWidth: number;
  readonly interpolation: Interpolation;
  /** First-series stroke and palette fallback. */
  readonly stroke: ChartPaint;
  /** Per-series strokes, cycled by index. */
  readonly palette?: readonly ChartPaint[];
  readonly dash?: DashPattern;
  /** Independent area fill; omit for a plain line. */
  readonly area?: ChartPaint;
  readonly showMarkers: boolean;
  readonly markerSize: number;
  readonly windowSeconds: number;
  /** Hard point cap; oldest points are dropped without interpolation (§122). */
  readonly maxPoints: number;
  readonly min?: number;
  readonly max?: number;
  readonly showAxes: boolean;
  /** Render-time downsampling; retained samples are unchanged. */
  readonly sampling?: 'lttb' | 'average' | 'none';
  readonly animation?: AnimationSettings;
}

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

export interface SeriesInput {
  readonly sensorId: string;
  readonly samples: readonly Sample[];
  readonly label?: string;
}

/** Local emitted shape keeps raw engine options out of the theme model (§87). */
export interface LineOption extends EngineAnimation {
  readonly grid: CartesianGrid;
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
    readonly lineStyle: {
      readonly width: number;
      readonly color: EngineColor;
      readonly type: DashPattern;
    };
    readonly areaStyle?: { readonly color: EngineColor };
    readonly sampling?: 'lttb' | 'average';
    readonly silent: true;
  }[];
}

/** Window, sort and cap samples while preserving missing-data gaps. */
export function toSeriesPoints(
  samples: readonly Sample[],
  settings: Pick<LineSettings, 'windowSeconds' | 'maxPoints'>,
  nowMs: number,
  windowStart = nowMs - settings.windowSeconds * 1000,
): SeriesPoint[] {
  const points: SeriesPoint[] = [];

  for (const sample of samples) {
    const t = Date.parse(sample.timestamp);

    // Invalid timestamps cannot be placed honestly on a time axis.
    if (!Number.isFinite(t) || t < windowStart || t > nowMs) {
      continue;
    }

    points.push([t, hasPlottableValue(sample) ? sample.value : null]);
  }

  points.sort((a, b) => a[0] - b[0]);

  if (points.length > settings.maxPoints) {
    return points.slice(points.length - settings.maxPoints);
  }

  return points;
}

export function buildLineOption(
  settings: LineSettings,
  series: readonly SeriesInput[],
  nowMs: number,
  animate = true,
  palette?: FabricPalette,
  startedAtMs?: number,
): LineOption {
  const windowMs = settings.windowSeconds * 1000;
  const start = startedAtMs !== undefined && Number.isFinite(startedAtMs)
    ? Math.min(startedAtMs, nowMs)
    : undefined;
  const filling = start !== undefined && nowMs < start + windowMs;
  const windowStart = filling ? start : nowMs - windowMs;
  const windowEnd = filling ? start + windowMs : nowMs;
  const sampling = settings.sampling && settings.sampling !== 'none' ? settings.sampling : undefined;

  return {
    ...toEngineAnimation(settings.animation, animate),
    grid: cartesianGrid(
      {
        left: settings.showAxes ? 8 : 0,
        right: settings.showAxes ? 8 : 0,
        top: 8,
        bottom: settings.showAxes ? 8 : 0,
      },
      settings.showAxes,
    ),
    xAxis: {
      type: 'time',
      show: settings.showAxes,
      // Fill from the render start, then retain a fixed-width scrolling window.
      min: windowStart,
      max: windowEnd,
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
      data: toSeriesPoints(input.samples, settings, nowMs, windowStart),
      showSymbol: settings.showMarkers,
      symbolSize: settings.markerSize,
      smooth: settings.interpolation === 'smooth',
      step: settings.interpolation === 'step' ? ('end' as const) : (false as const),
      connectNulls: false as const,
      lineStyle: {
        width: settings.lineWidth,
        color: toEngineColor(resolveChartPaint(strokeFor(settings, index), palette), 'stroke'),
        type: settings.dash ?? 'solid',
      },
      // Area fill is intentionally limited to the first series for readability.
      ...(settings.area === undefined || index > 0
        ? {}
        : { areaStyle: { color: toEngineColor(resolveChartPaint(settings.area, palette), 'area') } }),
      ...(sampling === undefined ? {} : { sampling }),
      silent: true as const,
    })),
  };
}

/** Palette entry for one series, falling back to `stroke`. */
export function strokeFor(settings: LineSettings, index: number): ChartPaint {
  const palette = settings.palette;

  if (palette === undefined || palette.length === 0) {
    return settings.stroke;
  }

  return palette[index % palette.length] ?? settings.stroke;
}

/**
 * Convert a fill to one line/area engine colour. Per-value threshold colouring
 * is unavailable for one line series, so thresholds resolve to the top band (§85).
 */
export function toEngineColor(fill: Fill, usage: 'stroke' | 'area'): EngineColor {
  switch (fill.kind) {
    case 'solid':
      return fill.color;

    case 'gradient':
      return toLinearGradient(fill.stops, usage === 'area' ? 'to-bottom' : 'to-right');

    case 'thresholds':
      return resolveThresholdColor(fill.bands, 1);
  }
}
