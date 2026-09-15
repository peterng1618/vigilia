import { Shadow } from 'fabric/es';
import type { ResolvedStyle } from '@vigilia/renderer-core';

/**
 * Resolved style → Fabric properties.
 *
 * The counterpart of `mount.ts`'s `applyCommonStyle`, and it inherits that
 * function's two hard-won rules.
 *
 * **A fixed list, never a pass-through.** The theme format owns its property
 * names. Copying arbitrary keys onto a Fabric object would make the document
 * format depend on whatever Fabric happens to accept, and an unknown property
 * is the validator's business rather than the renderer's.
 *
 * **Box or text is passed in, never inferred.** Several authored properties mean
 * different things depending on it: a `fill` is a background or a glyph colour,
 * an outline is a border or a text stroke. `mount.ts` learned this by inferring
 * it from the element and giving a text node's container box semantics, which
 * silently produced nothing.
 *
 * ## What differs from the DOM, and why each is not a choice
 *
 * - **An absent fill must be written.** CSS leaves a box with no background
 *   transparent; Fabric's default `fill` is opaque **black**, so a rectangle
 *   the author gave no fill would render as a black slab. Absent means `''`.
 * - **An absent stroke must set `strokeWidth: 0`.** Fabric folds stroke width
 *   into `_getTransformedDimensions` whether or not a stroke is painted, so the
 *   default of 1 inflates the bounding box, the hit area and every control
 *   position by half a pixel per edge. Same reason `VigiliaChart` sets it.
 * - **`letterSpacing` is in pixels and `charSpacing` is in 1/1000 em**, so the
 *   conversion needs the resolved font size. With no font size there is no
 *   correct conversion, and the property is dropped rather than guessed —
 *   refuse rather than coerce.
 * - **`tabularNumerals` has no canvas equivalent.** `font-variant-numeric` is
 *   not expressible through a 2D context's `font` string. It is reported as an
 *   unsupported property rather than silently ignored (§85: mark a gap).
 */

/** Whether a node is painted as a box or as text. Never inferred. */
export type PaintMode = 'box' | 'text';

/** Fabric properties to `set()` onto an object. */
export type FabricPaint = Readonly<Record<string, unknown>>;

/**
 * Authored properties this renderer cannot express, by name.
 *
 * Returned rather than logged, so the caller decides what to do about it and
 * this file stays pure.
 */
export function unsupportedPaint(style: ResolvedStyle, mode: PaintMode): readonly string[] {
  const unsupported: string[] = [];

  if (style['tabularNumerals'] === true) {
    unsupported.push('tabularNumerals');
  }

  // A dashed *text* stroke is not expressible on canvas either — and was not
  // in CSS, which is why `mount.ts` applied dashes to boxes only.
  if (mode === 'text' && isDash(style['strokeDash'])) {
    unsupported.push('strokeDash');
  }

  if (mode === 'text' && asNumber(style['letterSpacing']) !== undefined && fontSizeOf(style) === undefined) {
    unsupported.push('letterSpacing');
  }

  return unsupported;
}

/** Everything Fabric can be told about a node's appearance. */
export function paintFor(style: ResolvedStyle, mode: PaintMode): FabricPaint {
  return mode === 'text' ? textPaint(style) : boxPaint(style);
}

function boxPaint(style: ResolvedStyle): FabricPaint {
  const stroke = asCss(style['strokeColor']);
  const strokeWidth = asNumber(style['strokeWidth']);
  const dashed = isDash(style['strokeDash']);
  const painted = stroke !== undefined && strokeWidth !== undefined && strokeWidth > 0;

  return {
    // Explicitly transparent when unset: Fabric's default is opaque black.
    fill: asCss(style['fill']) ?? '',
    opacity: asNumber(style['opacity']) ?? 1,
    stroke: painted ? stroke : null,
    // Zero rather than Fabric's 1, which would inflate the bounding box.
    strokeWidth: painted ? strokeWidth : 0,
    strokeDashArray: painted && dashed ? dashArrayFor(style['strokeDash'], strokeWidth) : null,
    shadow: shadowFor(style),
  };
}

function textPaint(style: ResolvedStyle): FabricPaint {
  const stroke = asCss(style['strokeColor']);
  const strokeWidth = asNumber(style['strokeWidth']);
  const painted = stroke !== undefined && strokeWidth !== undefined && strokeWidth > 0;
  const fontSize = fontSizeOf(style);
  const letterSpacing = asNumber(style['letterSpacing']);
  const fontWeight = style['fontWeight'];
  const fontFamily = asCss(style['fontFamily']);
  const lineHeight = asNumber(style['lineHeight']);

  return {
    // `color` wins over `fill` for text, which is the order `mount.ts` wrote
    // them to CSS in. Both mean the glyph colour here.
    fill: asCss(style['color']) ?? asCss(style['fill']) ?? '',
    opacity: asNumber(style['opacity']) ?? 1,
    stroke: painted ? stroke : null,
    strokeWidth: painted ? strokeWidth : 0,
    // Behind the glyph, so an outline reads as an outline rather than eating
    // into the letterform — `-webkit-text-stroke` plus `paint-order` in CSS.
    ...(painted ? { paintFirst: 'stroke' } : {}),
    shadow: shadowFor(style),
    ...(fontFamily === undefined ? {} : { fontFamily }),
    ...(fontSize === undefined ? {} : { fontSize }),
    ...(typeof fontWeight === 'number' || typeof fontWeight === 'string'
      ? { fontWeight }
      : {}),
    ...(lineHeight === undefined ? {} : { lineHeight }),
    // 1/1000 em, and only where the font size makes the conversion exact.
    ...(letterSpacing === undefined || fontSize === undefined
      ? {}
      : { charSpacing: (letterSpacing / fontSize) * 1000 }),
  };
}

/**
 * Fabric's `Shadow`, or none.
 *
 * `null` rather than an absent key, because an update may be *removing* a
 * shadow an earlier frame set — the same reason `mount.ts` clears a transform
 * it is not writing.
 */
function shadowFor(style: ResolvedStyle): Shadow | null {
  const color = asCss(style['shadowColor']);

  if (color === undefined) {
    return null;
  }

  return new Shadow({
    color,
    blur: Math.max(0, asNumber(style['shadowBlur']) ?? 0),
    offsetX: asNumber(style['shadowOffsetX']) ?? 0,
    offsetY: asNumber(style['shadowOffsetY']) ?? 0,
    // Fabric's `nonScaling` default of false is what §51 needs — blur and
    // offsets are authored in artboard pixels and must scale with everything
    // else — so it is left alone rather than restated here.
  });
}

/**
 * A dash pattern in artboard pixels.
 *
 * CSS `dashed` and `dotted` are the browser's own patterns and have no numeric
 * definition to copy, so these are chosen to read the same way: a dash about
 * three times the stroke width, a dot about one.
 */
function dashArrayFor(dash: unknown, strokeWidth: number): number[] {
  const unit = Math.max(1, strokeWidth);

  return dash === 'dotted' ? [unit, unit * 2] : [unit * 3, unit * 2];
}

function isDash(value: unknown): boolean {
  return value === 'dashed' || value === 'dotted';
}

function fontSizeOf(style: ResolvedStyle): number | undefined {
  return asNumber(style['fontSize']);
}

function asCss(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
