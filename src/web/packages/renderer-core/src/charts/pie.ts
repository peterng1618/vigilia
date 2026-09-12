import type { Fill, Sample } from '../types.js';
import { hasPlottableValue } from '../types.js';
import { toEngineAnimation, type AnimationSettings, type EngineAnimation } from './animation.js';
import { resolveFlatColor, type EngineColor } from './fill.js';

/**
 * Typed settings → ECharts option for the pie / donut family (§81).
 *
 * ## A pie is composition; a gauge is progress
 *
 * §83 requires these to be distinguished rather than treated as two skins of a
 * ring, and the difference is not cosmetic — it changes what a missing sample
 * means.
 *
 * A gauge shows **one value against a range**. The range is authored, so a
 * missing sample simply draws the track: nothing about the range was inferred
 * from the sample.
 *
 * A pie shows **parts of a whole**, and each slice's angle depends on the
 * *other* slices. So if one of four slices is missing and the pie re-normalises
 * over the three that remain, those three grow to fill the circle — silently
 * asserting that they account for everything. That is a fabricated reading
 * (§97), produced by arithmetic rather than by a bad sensor.
 *
 * This adapter therefore makes the whole explicit, via {@link PieTotal}:
 *
 * - `sum` — the whole *is* the known parts. A missing slice shrinks the set
 *   being shown, and {@link PieComposition.complete} goes false so the caller
 *   can say so in text. The remaining slices still fill the circle, because
 *   with an unknown total there is no honest alternative; what is not allowed is
 *   doing that *without reporting it*.
 * - `fixed` — the whole is an authored constant (32 GB of RAM, 8 cores). Here
 *   the unaccounted remainder is a real measured quantity, `total − known`, so
 *   drawing it as a remainder slice is reporting rather than inventing. A
 *   missing slice then correctly enlarges the remainder instead of enlarging
 *   its peers.
 *
 * Neither mode substitutes zero for a missing part, which is the one thing §83
 * rules out outright.
 *
 * ## Verified against the documentation (ECharts 6.1.0), not visually
 *
 * `radius` as `[inner, outer]`, `startAngle`, `endAngle`, `padAngle` and
 * `itemStyle.borderRadius` are all documented pie-series properties; `padAngle`
 * and pie `endAngle` arrived in 5.5, so they exist in 6.1. **No pixels have been
 * drawn yet.** In particular, how `padAngle` interacts with a very small slice
 * (whether the gap can consume the slice entirely) is not documented and needs
 * the Playwright harness.
 */

/** How the whole is determined. See the module comment — this is the crux. */
export type PieTotal =
  | { readonly kind: 'sum' }
  | { readonly kind: 'fixed'; readonly value: number };

/** Typed settings for a pie-family chart. */
export interface PieSettings {
  /** Inner radius as a percentage of the element. 0 is a pie; above 0 a donut. */
  readonly innerRadiusPercent: number;
  readonly outerRadiusPercent: number;
  /** Degrees; 90 is straight up. */
  readonly startAngle: number;
  /** Degrees. Omit for a full sweep. */
  readonly endAngle?: number;
  /** Gap between slices, in degrees (§81's "pie gaps"). */
  readonly padAngle: number;
  /** Slice corner rounding in artboard pixels. */
  readonly cornerRadius: number;
  readonly total: PieTotal;
  /**
   * Fill for the unaccounted remainder. Only ever drawn when `total` is `fixed`,
   * because only then is the remainder a measured quantity.
   */
  readonly remainderFill?: Fill;
  /** Cycled per slice when a slice declares no fill of its own. */
  readonly palette: readonly Fill[];
  /**
   * Engine-drawn slice labels. Off by default: typography is rendered by our own
   * text elements (§91), which is the only way shared tokens apply.
   */
  readonly showLabels: boolean;
  /** Omit for the continuous-glide default. */
  readonly animation?: AnimationSettings;
}

/** Sensible starting point for a donut showing composition of a known whole. */
export const defaultPieSettings: PieSettings = {
  innerRadiusPercent: 60,
  outerRadiusPercent: 100,
  startAngle: 90,
  padAngle: 2,
  cornerRadius: 4,
  total: { kind: 'sum' },
  palette: [
    { kind: 'solid', color: '#00b8d9' },
    { kind: 'solid', color: '#6554c0' },
    { kind: 'solid', color: '#36b37e' },
    { kind: 'solid', color: '#ffab00' },
    { kind: 'solid', color: '#ff5630' },
  ],
  remainderFill: { kind: 'solid', color: '#2a2f3a' },
  showLabels: false,
};

/** One part of the whole. */
export interface PieSliceInput {
  readonly sensorId: string;
  readonly sample: Sample | undefined;
  readonly label?: string;
  /** Overrides the palette for this slice. */
  readonly fill?: Fill;
}

/** A slice that has a value and will be drawn. */
export interface PieSlice {
  readonly sensorId: string;
  readonly label: string;
  readonly value: number;
  /** This slice's fraction of {@link PieComposition.whole}, 0–1. */
  readonly share: number;
}

/**
 * What the samples actually say about the whole.
 *
 * Returned separately from the option so the caller can surface incompleteness
 * in text without the chart having to encode it. A pie cannot show "one part is
 * unknown" in its own geometry — that is precisely why this exists.
 */
export interface PieComposition {
  readonly slices: readonly PieSlice[];
  /** Sensor IDs whose sample carried no plottable value. */
  readonly missing: readonly string[];
  /** Sum of the parts that are known. */
  readonly knownTotal: number;
  /** The denominator the shares were computed against. */
  readonly whole: number;
  /**
   * `whole − knownTotal` for a fixed total, when positive. Undefined for a
   * `sum` total, where a remainder is not a measurable thing.
   */
  readonly remainder?: number;
  /** False when at least one part is missing, so the pie shows less than it claims. */
  readonly complete: boolean;
  /**
   * True when the known parts exceed a fixed total. The authored total is then
   * wrong, or the sensors overlap. Reported rather than clamped silently,
   * because a negative remainder cannot be drawn and pretending otherwise would
   * hide a misconfiguration.
   */
  readonly overflow: boolean;
}

/** One emitted slice. */
export interface PieDataItem {
  readonly name: string;
  readonly value: number;
  readonly itemStyle: { readonly color: EngineColor; readonly borderRadius: number };
}

/** The emitted option shape. Local and explicit, like the other adapters'. */
export interface PieOption extends EngineAnimation {
  readonly series: readonly [
    {
      readonly type: 'pie';
      readonly radius: readonly [string, string];
      readonly center: readonly ['50%', '50%'];
      readonly startAngle: number;
      readonly endAngle?: number;
      readonly padAngle: number;
      readonly label: { readonly show: boolean };
      readonly labelLine: { readonly show: boolean };
      /** Composition is authored order, not magnitude order — see the note at the use site. */
      readonly avoidLabelOverlap: false;
      readonly data: readonly PieDataItem[];
      readonly silent: true;
    },
  ];
}

/**
 * Resolves samples into a composition.
 *
 * Exported because the caller needs the incompleteness facts for its text
 * layer, and because this — not the option building — is where the semantics
 * live.
 */
export function computeComposition(
  settings: PieSettings,
  inputs: readonly PieSliceInput[],
): PieComposition {
  const present: { input: PieSliceInput; value: number }[] = [];
  const missing: string[] = [];

  for (const input of inputs) {
    if (hasPlottableValue(input.sample)) {
      // A negative part has no meaning in a composition and would subtract
      // angle from its neighbours. Treat it as unknown rather than drawing a
      // slice that makes the others wrong.
      if (input.sample.value < 0) {
        missing.push(input.sensorId);
        continue;
      }
      present.push({ input, value: input.sample.value });
    } else {
      missing.push(input.sensorId);
    }
  }

  const knownTotal = present.reduce((sum, p) => sum + p.value, 0);

  const fixedTotal = settings.total.kind === 'fixed' ? Math.max(0, settings.total.value) : undefined;
  const overflow = fixedTotal !== undefined && knownTotal > fixedTotal;

  // With a fixed total that the parts have already exceeded, using the fixed
  // value would produce shares above 1 and a negative remainder. Fall back to
  // the known sum so the drawing stays coherent, and report `overflow` so the
  // misconfiguration is visible rather than absorbed.
  const whole = fixedTotal === undefined || overflow ? knownTotal : fixedTotal;

  const slices = present.map(({ input, value }) => ({
    sensorId: input.sensorId,
    label: input.label ?? input.sensorId,
    value,
    share: whole === 0 ? 0 : value / whole,
  }));

  const remainder =
    fixedTotal !== undefined && !overflow ? fixedTotal - knownTotal : undefined;

  return {
    slices,
    missing,
    knownTotal,
    whole,
    ...(remainder === undefined ? {} : { remainder }),
    complete: missing.length === 0,
    overflow,
  };
}

/**
 * Builds the option for a pie or donut.
 *
 * @param settings Typed settings from the theme document.
 * @param inputs One entry per part, in authored order.
 * @param animate Whether to animate transitions. Disable for screenshot tests.
 */
export function buildPieOption(
  settings: PieSettings,
  inputs: readonly PieSliceInput[],
  animate = true,
): PieOption {
  const composition = computeComposition(settings, inputs);
  const borderRadius = Math.max(0, settings.cornerRadius);

  const data: PieDataItem[] = composition.slices.map((slice, index) => {
    const declared = inputs.find((i) => i.sensorId === slice.sensorId)?.fill;
    const fill = declared ?? paletteAt(settings.palette, index);

    return {
      name: slice.label,
      value: slice.value,
      itemStyle: {
        // A slice fill is resolved at the slice's own share. A `thresholds` fill
        // therefore reads as "this part is over 90 % of the whole", which is the
        // only interpretation available to a part of a composition.
        color: resolveFlatColor(fill, slice.share),
        borderRadius,
      },
    };
  });

  // Only a fixed total has a measurable remainder. Under a `sum` total there is
  // nothing to draw here: the parts ARE the whole by definition.
  if (composition.remainder !== undefined && composition.remainder > 0) {
    data.push({
      name: 'remainder',
      value: composition.remainder,
      itemStyle: {
        color: resolveFlatColor(
          settings.remainderFill ?? { kind: 'solid', color: '#2a2f3a' },
          1,
        ),
        borderRadius,
      },
    });
  }

  return {
    ...toEngineAnimation(settings.animation, animate),
    series: [
      {
        type: 'pie',
        radius: [
          `${clampPercent(settings.innerRadiusPercent)}%`,
          `${clampPercent(settings.outerRadiusPercent)}%`,
        ],
        center: ['50%', '50%'],
        startAngle: settings.startAngle,
        ...(settings.endAngle === undefined ? {} : { endAngle: settings.endAngle }),
        padAngle: Math.max(0, settings.padAngle),
        label: { show: settings.showLabels },
        labelLine: { show: settings.showLabels },
        // Slice order is the author's, and a composition's reading order is part
        // of its meaning ("cores 0..7" must not reorder by load). Label-overlap
        // avoidance would move labels rather than slices, but it is off anyway
        // because labels are ours (§91).
        avoidLabelOverlap: false,
        data,
        silent: true,
      },
    ],
  };
}

/** Cycles the palette. An empty palette yields a neutral rather than throwing. */
function paletteAt(palette: readonly Fill[], index: number): Fill {
  if (palette.length === 0) {
    return { kind: 'solid', color: '#8993a4' };
  }
  return palette[index % palette.length]!;
}

function clampPercent(value: number): number {
  return Math.min(Math.max(value, 0), 100);
}
