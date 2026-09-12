import type { Fill, Sample } from '../types.js';
import { hasPlottableValue } from '../types.js';
import { toEngineAnimation, type AnimationSettings, type EngineAnimation } from './animation.js';
import {
  normalizePosition,
  resolveFlatColor,
  toLinearGradient,
  type EngineColor,
} from './fill.js';

/**
 * Typed settings → ECharts option for the bar / progress-bar family (§81).
 *
 * ## This family is where thresholds are native
 *
 * The line adapter cannot colour one series by value, because a line's colour is
 * a property of the whole series. A bar chart draws one item per category and
 * each item takes its own `itemStyle.color`, so "above 80 °C is red" is resolved
 * exactly, per bar, with no approximation and no §85 engine gap.
 *
 * It is the mirror image of the gauge's gradient problem, and the pair is what
 * the Gate 0 matrix has to record: gradients are native in cartesian space and
 * approximated on an arc; thresholds are native per-item and unavailable per
 * line series. Neither family dominates.
 *
 * ## Progress bar vs bar chart
 *
 * One shape, two uses, and the difference is only how many categories there are.
 * A single-category bar with a {@link BarSettings.track} is a progress bar; the
 * track is drawn with ECharts' `showBackground`, which spans the full category
 * slot and therefore reads as "the remaining range" exactly like the gauge's
 * track ring does.
 *
 * ## Verified against the documentation (ECharts 6.1.0), not visually
 *
 * `barWidth`, `barCategoryGap`, `itemStyle.borderRadius`, per-item `itemStyle`
 * and `showBackground` / `backgroundStyle` are all documented bar-series
 * properties. **No pixels have been drawn yet**: nothing here is confirmed by
 * screenshot, and two behaviours are genuinely unknown until one exists —
 * whether `backgroundStyle` accepts a gradient object as well as a colour
 * string, and whether the background is still drawn for a `null` data item. Both
 * are marked at their use site. Confirm with the Playwright harness before
 * treating them as settled.
 */

/** Which way bars grow. */
export type BarOrientation = 'horizontal' | 'vertical';

/** Typed settings for a bar-family chart. */
export interface BarSettings {
  readonly orientation: BarOrientation;
  readonly min: number;
  readonly max: number;
  /** Bar thickness in artboard pixels. Omit to let the engine distribute the slot. */
  readonly barWidth?: number;
  /**
   * Gap between category slots, as a percentage of slot width (0–100).
   * ECharts takes this as a string; the theme format keeps it a number so it
   * stays a bounded numeric property in the schema (§141).
   */
  readonly categoryGapPercent: number;
  /** Corner rounding in artboard pixels, applied to all four corners. */
  readonly cornerRadius: number;
  readonly fill: Fill;
  /**
   * Unfilled remainder behind each bar. Present makes this a progress bar;
   * absent makes it a plain bar chart.
   */
  readonly track?: Fill;
  readonly showAxes: boolean;
  /** Category names beside the bars. Independent of the value axis. */
  readonly showCategoryLabels: boolean;
  /** Omit for the continuous-glide default. */
  readonly animation?: AnimationSettings;
}

/** Sensible starting point for a horizontal progress bar. */
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

/** One category: one sensor, one latest sample. */
export interface BarInput {
  readonly sensorId: string;
  readonly sample: Sample | undefined;
  /** Category label. Falls back to `sensorId`. */
  readonly label?: string;
}

/** One emitted bar. A `null` value draws no bar at all — §83's gap. */
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
  /** Bars must start at the axis, so the category axis cannot add half-slot padding. */
  readonly boundaryGap: true;
  /**
   * True for a horizontal chart.
   *
   * ECharts puts category index 0 at the **bottom** of a y axis, so the first
   * authored bar rendered last and a dashboard's bars read in the opposite
   * order from its labels. Inverting restores authored order as reading order —
   * the same rule the pie family follows for slices. A vertical chart already
   * puts index 0 at the left, which is correct, so this is false there.
   */
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

/** The emitted option shape. Local and explicit, like the other adapters'. */
export interface BarOption extends EngineAnimation {
  readonly grid: {
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
    readonly containLabel: boolean;
  };
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

/**
 * Builds the option for a bar-family chart.
 *
 * @param settings Typed settings from the theme document.
 * @param inputs One entry per category, in draw order.
 * @param animate Whether to animate transitions. Disable for screenshot tests.
 */
export function buildBarOption(
  settings: BarSettings,
  inputs: readonly BarInput[],
  animate = true,
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
    // Pinned to the authored range so a bar means the same fraction every frame.
    // Letting the engine choose would rescale the bar when the data moves, which
    // reads as the value changing more than it did.
    min: settings.min,
    max: settings.max,
    axisLabel: { show: settings.showAxes },
    splitLine: { show: settings.showAxes },
  };

  return {
    ...toEngineAnimation(settings.animation, animate),
    grid: {
      left: settings.showAxes || settings.showCategoryLabels ? 8 : 0,
      right: 0,
      top: 0,
      bottom: settings.showAxes ? 8 : 0,
      containLabel: settings.showAxes || settings.showCategoryLabels,
    },
    // Orientation is only which axis carries the categories. Everything else —
    // including the data — is identical, which is why one adapter covers both.
    xAxis: horizontal ? valueAxis : categoryAxis,
    yAxis: horizontal ? categoryAxis : valueAxis,
    series: [
      {
        type: 'bar',
        data: inputs.map((input) => toBarDataItem(settings, input)),
        ...(settings.barWidth === undefined ? {} : { barWidth: settings.barWidth }),
        barCategoryGap: `${clampPercent(settings.categoryGapPercent)}%`,
        // The track. UNVERIFIED: whether ECharts still paints the background for
        // a null data item is not documented, so a missing sample may or may not
        // leave the track visible. Either is defensible — the value bar is
        // absent, which is the part §83 requires — but the Playwright harness
        // must record which one actually happens.
        showBackground: settings.track !== undefined,
        ...(settings.track === undefined
          ? {}
          : { backgroundStyle: { color: toTrackColor(settings) } }),
        silent: true,
      },
    ],
  };
}

/**
 * Converts one sample into one bar.
 *
 * A non-ok sample yields `value: null`. That matters more here than anywhere
 * else in the renderer: a zero-length bar and a bar for the value 0 are
 * *pixel-identical*, so writing 0 for a missing sample would be indistinguishable
 * from a real reading of 0 — exactly the confusion §83 forbids. `null` draws
 * nothing, and the status is surfaced by the text element bound to the same
 * sensor.
 */
export function toBarDataItem(settings: BarSettings, input: BarInput): BarDataItem {
  const borderRadius = Math.max(0, settings.cornerRadius);

  if (!hasPlottableValue(input.sample)) {
    return {
      value: null,
      // A colour is still required by the option shape; it paints nothing.
      itemStyle: { color: 'transparent', borderRadius },
    };
  }

  const raw = input.sample.value;
  // §83: preserve the raw value, clamp only what is drawn. The text element
  // bound to this sensor still reports 105 %.
  const display = Math.min(Math.max(raw, settings.min), settings.max);
  const position = normalizePosition(raw, settings.min, settings.max);

  return {
    value: display,
    itemStyle: { color: toBarColor(settings, position), borderRadius },
  };
}

/**
 * Resolves one bar's colour.
 *
 * - `solid` → the colour.
 * - `thresholds` → the band containing this bar's value. Native and exact; this
 *   is the capability the line family lacks.
 * - `gradient` → a real cartesian gradient along the growth direction, so the
 *   bar fades from the axis outward.
 */
export function toBarColor(settings: BarSettings, position: number): EngineColor {
  if (settings.fill.kind === 'gradient') {
    return toLinearGradient(
      settings.fill.stops,
      settings.orientation === 'horizontal' ? 'to-right' : 'to-top',
    );
  }

  return resolveFlatColor(settings.fill, position);
}

/**
 * Resolves the track colour.
 *
 * The track spans the whole range, so a gradient on it is evaluated across the
 * full slot rather than at a value. UNVERIFIED: `backgroundStyle.color` is
 * documented as a colour; whether it also accepts a gradient object is not.
 * Sampling a `thresholds` track at the top of the range keeps it a single flat
 * colour, which is the only reading a track has.
 */
function toTrackColor(settings: BarSettings): EngineColor {
  const track = settings.track;

  if (track === undefined) {
    return 'transparent';
  }

  if (track.kind === 'gradient') {
    return toLinearGradient(
      track.stops,
      settings.orientation === 'horizontal' ? 'to-right' : 'to-top',
    );
  }

  return resolveFlatColor(track, 1);
}

function clampPercent(value: number): number {
  return Math.min(Math.max(value, 0), 100);
}
