import {
  STYLE_PROPERTIES,
  type PlanTextSegment,
  type ResolvedStyle,
} from "@vigilia/renderer-core";
import { paintFor } from "./paint.js";

/**
 * Convert styled runs to Fabric per-grapheme styles on one text object. The
 * splitter is injected so indices exactly match Fabric. Object-only properties
 * are reported when a run tries to override them.
 */

export type FabricTextStyles = Readonly<
  Record<number, Readonly<Record<number, Readonly<Record<string, unknown>>>>>
>;

export interface FabricTextShape {
  readonly text: string;
  readonly styles: FabricTextStyles;
  readonly unsupported: readonly string[];
}

export type GraphemeSplitter = (value: string) => readonly string[];

/** Fabric per-character key → authored properties that may feed it. */
const PER_RUN_PAINT_SOURCES: Readonly<Record<string, readonly string[]>> = {
  fill: ["color", "fill"],
  fontFamily: ["fontFamily"],
  fontSize: ["fontSize"],
  fontWeight: ["fontWeight"],
  stroke: ["strokeColor"],
  strokeWidth: ["strokeWidth"],
};

const PER_RUN_STYLE_PROPERTIES: readonly string[] = Object.values(
  PER_RUN_PAINT_SOURCES,
).flat();

type MutableStyles = Record<number, Record<number, Record<string, unknown>>>;

export function textShapeFor(
  segments: readonly PlanTextSegment[],
  nodeStyle: ResolvedStyle,
  splitGraphemes: GraphemeSplitter,
): FabricTextShape {
  const text = segments.map((segment) => segment.text).join("");

  if (segments.length <= 1) {
    return { text, styles: {}, unsupported: [] };
  }

  const styles: MutableStyles = {};
  const unsupported = new Set<string>();

  let line = 0;
  let grapheme = 0;

  for (const segment of segments) {
    const paint = paintFor(segment.style, "text");
    // Per-character styles override object paint, so include authored keys only.
    const perRun = Object.fromEntries(
      Object.entries(paint).filter(([key]) =>
        (PER_RUN_PAINT_SOURCES[key] ?? []).some(
          (property) => property in segment.style,
        ),
      ),
    );

    for (const property of STYLE_PROPERTIES) {
      if (PER_RUN_STYLE_PROPERTIES.includes(property)) {
        continue;
      }

      if (
        property in segment.style &&
        segment.style[property] !== nodeStyle[property]
      ) {
        unsupported.add(property);
      }
    }

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
