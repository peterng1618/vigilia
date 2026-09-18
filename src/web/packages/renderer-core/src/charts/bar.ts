import type { ChartPaint, Fill, Sample } from '../types.js';
import { hasPlottableValue } from '../types.js';
import { toEngineAnimation, type AnimationSettings, type EngineAnimation } from './animation.js';
import {
  normalizePosition,
  resolveFlatColor,
  toLinearGradient,
  type EngineColor,
} from './fill.js';
import { cartesianGrid, type CartesianGrid } from './grid.js';
import { resolveChartPaint } from './chart-paint.js';
import type { FabricPalette } from '../theme/fabric-envelope.js';

/**
 * Bar/progress adapter. Thresholds are native per bar; one-category bars with a
 * track are progress bars. Missing samples emit `null`, never zero (§83).
 */

export type BarOrientation = 'horizontal' | 'vertical';

export interface BarSettings {
  readonly orientation: BarOrientation;
  readonly min: number;
  readonly max: number;
  readonly barWidth?: number;
  /** Gap between category slots, as a percentage. */
  readonly categoryGapPercent: number;
  readonly cornerRadius: number;
  readonly fill: ChartPaint;
  /** Unfilled remainder; present makes this a progress bar. */
  readonly track?: ChartPaint;
  readonly showAxes: boolean;
  readonly showCategoryLabels: boolean;
  readonly animation?: AnimationSettings;
}

export const defaultBarSettings: BarSettings = {
  orientation: 'horizontal',
  min: 0,
  max: 100,
  barWidth: 14,
  categoryGapPercent: 40,
  cornerRadius: 7,
  fill: { kind: 'solid', color: '#00b8d9' },
  track: { kind: 'solid', color: '#2a2f3a' },
  showAxes: false,
  showCategoryLabels: false,
};

export interface BarInput {
  readonly sensorId: string;
  readonly sample: Sample | undefined;
  readonly label?: string;
}

export interface BarDataItem {
  readonly value: number | null;
  readonly itemStyle: { readonly color: EngineColor; readonly borderRadius: number };
}

interface CategoryAxis {
  readonly type: 'category';
  readonly show: boolean;
  readonly data: readonly string[];
  readonly axisTick: { readonly show: false };
  readonly axisLine: { readonly show: false };
  readonly axisLabel: { readonly show: boolean };
  readonly boundaryGap: true;
  /** ECharts y categories run bottom-up; invert horizontal bars to authored order. */
  readonly inverse: boolean;
}

interface ValueAxis {
  readonly type: 'value';
  readonly show: boolean;
  readonly min: number;
  readonly max: number;
  readonly axisLabel: { readonly show: boolean };
  readonly splitLine: { readonly show: boolean };
}

export interface BarOption extends EngineAnimation {
  readonly grid: CartesianGrid;
  readonly xAxis: CategoryAxis | ValueAxis;
  readonly yAxis: CategoryAxis | ValueAxis;
  readonly series: readonly [
    {
      readonly type: 'bar';
      readonly data: readonly BarDataItem[];
      readonly barWidth?: number;
      readonly barCategoryGap: string;
      readonly showBackground: boolean;
      readonly backgroundStyle?: { readonly color: EngineColor };
      readonly silent: true;
    },
  ];
}

export function buildBarOption(
  settings: BarSettings,
  inputs: readonly BarInput[],
  animate = true,
  palette?: FabricPalette,
): BarOption {
  const horizontal = settings.orientation === 'horizontal';

  const categoryAxis: CategoryAxis = {
    type: 'category',
    show: settings.showAxes || settings.showCategoryLabels,
    data: inputs.map((input) => input.label ?? input.sensorId),
    axisTick: { show: false },
    axisLine: { show: false },
    axisLabel: { show: settings.showCategoryLabels },
    boundaryGap: true,
    inverse: horizontal,
  };

  const valueAxis: ValueAxis = {
    type: 'value',
    show: settings.showAxes,
    // Keep bar fractions stable instead of auto-rescaling with current data.
    min: settings.min,
    max: settings.max,
    axisLabel: { show: settings.showAxes },
    splitLine: { show: settings.showAxes },
  };

  return {
    ...toEngineAnimation(settings.animation, animate),
    grid: cartesianGrid(
      {
        left: settings.showAxes || settings.showCategoryLabels ? 8 : 0,
        right: 0,
        top: 0,
        bottom: settings.showAxes ? 8 : 0,
      },
      settings.showAxes || settings.showCategoryLabels,
    ),
    xAxis: horizontal ? valueAxis : categoryAxis,
    yAxis: horizontal ? categoryAxis : valueAxis,
    series: [
      {
        type: 'bar',
        data: inputs.map((input) => toBarDataItem(settings, input, palette)),
        ...(settings.barWidth === undefined ? {} : { barWidth: settings.barWidth }),
        barCategoryGap: `${clampPercent(settings.categoryGapPercent)}%`,
        showBackground: settings.track !== undefined,
        ...(settings.track === undefined
          ? {}
          : { backgroundStyle: { color: toTrackColor(settings, palette) } }),
        silent: true,
      },
    ],
  };
}

/** Missing samples return `null`; a zero-length bar would be indistinguishable from real zero. */
export function toBarDataItem(settings: BarSettings, input: BarInput, palette?: FabricPalette): BarDataItem {
  const borderRadius = Math.max(0, settings.cornerRadius);

  if (!hasPlottableValue(input.sample)) {
    return {
      value: null,
      itemStyle: { color: 'transparent', borderRadius },
    };
  }

  const raw = input.sample.value;
  // Clamp only what is drawn; preserve the raw reading elsewhere (§83).
  const display = Math.min(Math.max(raw, settings.min), settings.max);
  const position = normalizePosition(raw, settings.min, settings.max);

  return {
    value: display,
    itemStyle: { color: toBarColor(settings, position, palette), borderRadius },
  };
}

/** Resolve per-bar solid/threshold colour or a cartesian growth-direction gradient. */
export function toBarColor(settings: BarSettings, position: number, palette?: FabricPalette): EngineColor {
  const fill = resolveChartPaint(settings.fill, palette);
  if (fill.kind === 'gradient') {
    return toLinearGradient(
      fill.stops,
      settings.orientation === 'horizontal' ? 'to-right' : 'to-top',
    );
  }

  return resolveFlatColor(fill, position);
}

/** Track gradients span the whole slot; threshold tracks resolve to their top band. */
function toTrackColor(settings: BarSettings, palette: FabricPalette | undefined): EngineColor {
  const track = settings.track;

  if (track === undefined) {
    return 'transparent';
  }

  const resolved = resolveChartPaint(track, palette);
  if (resolved.kind === 'gradient') {
    return toLinearGradient(
      resolved.stops,
      settings.orientation === 'horizontal' ? 'to-right' : 'to-top',
    );
  }

  return resolveFlatColor(resolved, 1);
}

function clampPercent(value: number): number {
  return Math.min(Math.max(value, 0), 100);
}
