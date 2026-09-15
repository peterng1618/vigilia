import { STYLE_PROPERTIES, type PlanTextSegment, type ResolvedStyle } from '@vigilia/renderer-core';
import { paintFor } from './paint.js';

/**
 * §89's styled runs, as one Fabric text object.
 *
 * `mount.ts` gave each run its own `<span>`. Canvas has no such thing, so the
 * runs become **per-character styles** on a single object:
 * `styles[line][charIndex]`, which is Fabric's own mechanism and is what keeps
 * one shared baseline across runs of different sizes. Separate text objects per
 * run would each have their own baseline and would have to be laid out by hand.
 *
 * ## Indices are graphemes, not characters
 *
 * Fabric keys styles by grapheme, splitting with `FabricText.prototype
 * .graphemeSplit`. `'x'.length` and the grapheme count agree for everything in
 * the fixtures and disagree for an emoji or a combining mark, which would shift
 * every style after it by one. So the splitter is **injected** rather than
 * assumed: the adapter passes the text object's own method, and this file stays
 * pure and testable in Node.
 *
 * ## What a run cannot carry, and why it is reported
 *
 * Fabric's per-character style keys are `fill`, `stroke`, `strokeWidth`,
 * `fontSize`, `fontFamily`, `fontWeight`, `fontStyle`, the three decorations,
 * `deltaY` and `textBackgroundColor` (`shapes/Text/constants.ts:59`). Opacity,
 * shadow, letter spacing and line height are **object-level** in Fabric, and
 * tabular numerals are not expressible on a canvas at all.
 *
 * The check is written against `STYLE_PROPERTIES` — the vocabulary's owner —
 * rather than a hand-written list of the ones that fail, so a property added to
 * `capabilities.ts` lands in the reported bucket instead of being dropped in
 * silence. Spec 0013 lists these as §85 gaps; reporting them is what makes the
 * gap visible rather than a mystery.
 */

/** Fabric's per-character style map: line → grapheme index → properties. */
export type FabricTextStyles = Readonly<
  Record<number, Readonly<Record<number, Readonly<Record<string, unknown>>>>>
>;

export interface FabricTextShape {
  /** Every run concatenated, which is what the object's `text` becomes. */
  readonly text: string;
  /** Empty when one run covers the whole object — the object's own paint does it. */
  readonly styles: FabricTextStyles;
  /** Authored properties a *run* carries that only an object can express. */
  readonly unsupported: readonly string[];
}

/** Splits a string the way Fabric indexes it. */
export type GraphemeSplitter = (value: string) => readonly string[];

/**
 * Our style vocabulary mapped onto Fabric's per-character keys.
 *
 * `color` and `fill` both land on `fill` for text, in that precedence, which is
 * `paint.ts`'s rule rather than a second copy of it — this list only says
 * *which* authored properties survive per run.
 */
const PER_RUN_STYLE_PROPERTIES: readonly string[] = [
  'fill',
  'color',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'strokeColor',
  'strokeWidth',
];

/** The Fabric keys a per-character entry may hold, derived from the above. */
const PER_RUN_PAINT_KEYS: readonly string[] = [
  'fill',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'stroke',
  'strokeWidth',
];

/** One line index and one grapheme index, mutable while building. */
type MutableStyles = Record<number, Record<number, Record<string, unknown>>>;

/**
 * Builds the text and the per-character style map for a text node.
 *
 * @param nodeStyle the node's own style, which becomes the object's paint. A
 *   run property equal to it needs no per-character entry, and a *non*-per-run
 *   property equal to it is not a gap — only a run that asks for something
 *   different from the object is.
 */
export function textShapeFor(
  segments: readonly PlanTextSegment[],
  nodeStyle: ResolvedStyle,
  splitGraphemes: GraphemeSplitter,
): FabricTextShape {
  const text = segments.map((segment) => segment.text).join('');

  if (segments.length <= 1) {
    // One run is the object, so there is nothing per-character to say — and no
    // gap either, because every property applies at object level.
    return { text, styles: {}, unsupported: [] };
  }

  const styles: MutableStyles = {};
  const unsupported = new Set<string>();

  let line = 0;
  let grapheme = 0;

  for (const segment of segments) {
    const paint = paintFor(segment.style, 'text');
    const perRun = Object.fromEntries(
      Object.entries(paint).filter(([key]) => PER_RUN_PAINT_KEYS.includes(key)),
    );

    for (const property of STYLE_PROPERTIES) {
      if (PER_RUN_STYLE_PROPERTIES.includes(property)) {
        continue;
      }

      // Authored on the run, and different from what the object will carry.
      if (property in segment.style && segment.style[property] !== nodeStyle[property]) {
        unsupported.add(property);
      }
    }

    // Split on Fabric's own newline rule, because its line indices do.
    const lines = segment.text.split(/\r?\n/);

    for (const [index, lineText] of lines.entries()) {
      if (index > 0) {
        line += 1;
        grapheme = 0;
      }

      const count = splitGraphemes(lineText).length;
      const target = (styles[line] ??= {});

      for (let offset = 0; offset < count; offset += 1) {
        target[grapheme + offset] = perRun;
      }

      grapheme += count;
    }
  }

  return { text, styles, unsupported: [...unsupported] };
}
