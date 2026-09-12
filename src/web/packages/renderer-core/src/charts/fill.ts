import type { Fill, GradientStop } from '../types.js';

/**
 * Shared {@link Fill} → engine-colour resolution for every chart family.
 *
 * §87 puts one rule on all of this: typed settings in, engine options out. This
 * module is the part of that translation that is *family-independent*, so a
 * `thresholds` fill authored once means the same thing on a gauge ring, a bar and
 * a line.
 *
 * ## Threshold semantics, fixed here for all families
 *
 * A band's `offset` is the **upper** bound of its span, matching ECharts'
 * `[proportion, color]` convention on a gauge axis line. So
 * `[{0.8, green}, {1, red}]` means *0–80 % green, 80–100 % red*, and a value at
 * exactly 0.8 is still green.
 *
 * This convention is not obviously the only one — "offset is where the band
 * starts" is equally defensible — but it must be identical everywhere, because
 * the same authored bands are reused across families by the shared style tokens
 * (§87). {@link resolveThresholdColor} is the single definition.
 *
 * ## Where gradients are real, and where they are not
 *
 * Gradients resolve in cartesian space, so they apply natively to bars and lines
 * and *cannot* follow a gauge arc. That one fact produces both halves of the §85
 * engine-gap matrix: `gauge.ts` approximates an angular gradient with discrete
 * segments, while `thresholds` cannot colour a single line series per value.
 * Neither family is strictly more capable.
 */

/**
 * Gradient axis, expressed as the direction colour *travels*.
 *
 * `to-top` exists because a value bar should fade from the axis upward, which is
 * the opposite of the natural top-to-bottom reading order of an area fill.
 */
export type GradientDirection = 'to-right' | 'to-bottom' | 'to-top';

/** An ECharts linear-gradient colour object, resolved in cartesian space. */
export interface LinearGradientColor {
  readonly type: 'linear';
  readonly x: number;
  readonly y: number;
  readonly x2: number;
  readonly y2: number;
  readonly colorStops: readonly { readonly offset: number; readonly color: string }[];
}

/** A stroke or fill colour as the engine accepts it. */
export type EngineColor = string | LinearGradientColor;

/**
 * Builds a linear gradient along `direction`.
 *
 * Degenerate inputs return a plain colour string rather than a one-stop gradient
 * object: engines differ on how they treat a gradient with no span, and a string
 * has exactly one interpretation.
 */
export function toLinearGradient(
  stops: readonly GradientStop[],
  direction: GradientDirection,
): EngineColor {
  if (stops.length === 0) {
    return 'transparent';
  }

  if (stops.length === 1) {
    return stops[0]!.color;
  }

  const axis = gradientAxis(direction);

  return {
    type: 'linear',
    ...axis,
    colorStops: [...stops]
      .sort((a, b) => a.offset - b.offset)
      .map((s) => ({ offset: clamp01(s.offset), color: s.color })),
  };
}

function gradientAxis(direction: GradientDirection): {
  x: number;
  y: number;
  x2: number;
  y2: number;
} {
  switch (direction) {
    case 'to-right':
      return { x: 0, y: 0, x2: 1, y2: 0 };
    case 'to-bottom':
      return { x: 0, y: 0, x2: 0, y2: 1 };
    case 'to-top':
      return { x: 0, y: 1, x2: 0, y2: 0 };
  }
}

/**
 * Resolves the threshold band colour that applies at `position` (0–1).
 *
 * Per the module comment, `offset` is a band's upper bound, so this returns the
 * first band whose offset is at or above the position. A position past the last
 * band falls back to that band rather than going transparent — bands that stop
 * short of 1 are an authoring mistake, and leaving the tail unpainted hides it.
 */
export function resolveThresholdColor(
  bands: readonly GradientStop[],
  position: number,
): string {
  if (bands.length === 0) {
    return 'transparent';
  }

  const sorted = [...bands].sort((a, b) => a.offset - b.offset);
  const clamped = clamp01(position);

  for (const band of sorted) {
    if (clamped <= band.offset) {
      return band.color;
    }
  }

  return sorted.at(-1)!.color;
}

/**
 * Resolves a fill to a single flat colour at `position` (0–1).
 *
 * Used where the engine accepts only one colour per drawn item — a per-item bar
 * colour, for instance. A `gradient` fill is *sampled* at the position rather
 * than approximated, because one item is one flat colour; an author wanting a
 * gradient across a single item gets it through {@link toLinearGradient} instead.
 */
export function resolveFlatColor(fill: Fill, position: number): string {
  switch (fill.kind) {
    case 'solid':
      return fill.color;
    case 'thresholds':
      return resolveThresholdColor(fill.bands, position);
    case 'gradient':
      return colorAt(fill.stops, position);
  }
}

/**
 * Interpolates the colour of a gradient at `position` (0–1).
 *
 * Positions outside the authored stop range clamp to the nearest endpoint, so a
 * gradient that does not start at 0 still paints its whole span.
 */
export function colorAt(stops: readonly GradientStop[], position: number): string {
  if (stops.length === 0) {
    return 'transparent';
  }

  const sorted = [...stops]
    .map((s) => ({ offset: clamp01(s.offset), color: s.color }))
    .sort((a, b) => a.offset - b.offset);

  const first = sorted[0]!;
  const last = sorted.at(-1)!;

  if (position <= first.offset) {
    return first.color;
  }
  if (position >= last.offset) {
    return last.color;
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;

    if (position >= a.offset && position <= b.offset) {
      const span = b.offset - a.offset;
      const t = span === 0 ? 0 : (position - a.offset) / span;
      return mixHex(a.color, b.color, t);
    }
  }

  return last.color;
}

/**
 * Mixes two `#rgb`/`#rrggbb` colours in sRGB.
 *
 * Non-hex inputs cannot be interpolated here, so the nearer endpoint is returned
 * rather than emitting an invalid colour. The schema should restrict gradient
 * stops to hex for this reason.
 */
export function mixHex(from: string, to: string, t: number): string {
  const a = parseHex(from);
  const b = parseHex(to);

  if (!a || !b) {
    return t < 0.5 ? from : to;
  }

  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);

  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(bl)}`;
}

/**
 * Parses `#rgb` or `#rrggbb`. Returns undefined for anything else.
 *
 * The digit check is not redundant with the length check: `red` is three
 * characters, so a length-only test accepted it and `parseInt('rr', 16)`
 * produced `NaN` for one channel, which {@link mixHex} then formatted into an
 * invalid colour that paints nothing. CSS colour keywords are exactly the input
 * an author is most likely to type, so this rejects them here and lets the
 * caller fall back.
 */
export function parseHex(color: string): [number, number, number] | undefined {
  const hex = color.trim().replace(/^#/, '');

  if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) {
    return undefined;
  }

  if (hex.length === 3) {
    const r = hex[0]!;
    const g = hex[1]!;
    const b = hex[2]!;
    return [parseInt(r + r, 16), parseInt(g + g, 16), parseInt(b + b, 16)];
  }

  if (hex.length === 6) {
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }

  return undefined;
}

function toHexByte(value: number): string {
  return Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0');
}

/** Normalises a raw value into 0–1 across a range. A zero-width range yields 0. */
export function normalizePosition(value: number, min: number, max: number): number {
  const span = max - min;
  if (span === 0) {
    return 0;
  }
  return clamp01((value - min) / span);
}

export function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}
