import {
  charSpacingPx,
  panel,
  type StarterPaletteId,
  solidOf,
} from "./new-fabric-theme-globals.js";
import type { PathCommand } from "./new-fabric-theme-icons.js";

/**
 * The scene primitives the starter's cards are written in.
 *
 * Every colour is named by its palette token, never by a hex literal at the call
 * site: the reference is what the validator checks, the resolved colour is what
 * Fabric draws, and one token owns both.
 */

export type ObjectJson = Readonly<Record<string, unknown>>;

// Authored positions are artboard top-left coordinates, never Fabric's centred defaults.
export const positioned = { originX: "left", originY: "top" } as const;
export const backgroundOnly = {
  ...positioned,
  selectable: false,
  evented: false,
} as const;

export function rect(
  id: string,
  left: number,
  top: number,
  width: number,
  height: number,
  fill: unknown,
  radius: number,
  interaction: ObjectJson = positioned,
  token?: StarterPaletteId,
): ObjectJson {
  return {
    type: "Rect",
    id,
    left,
    top,
    width,
    height,
    fill,
    rx: radius,
    ry: radius,
    vigiliaPaint: { fill: `palette.${token ?? "panel"}` },
    ...interaction,
  };
}

export function card(
  id: string,
  left: number,
  top: number,
  width: number,
  height: number,
): ObjectJson {
  return {
    // Measured off the reference theme, not chosen: its card border occupies two
    // pixels and first appears ten pixels in from the top-left corner on both
    // axes. The outline token is already the right value — a translucent cool
    // line of that alpha composites to about the border the reference shows.
    ...rect(id, left, top, width, height, panel, 10),
    stroke: "#9fc7e52b",
    strokeWidth: 2,
    vigiliaPaint: { fill: "palette.panel", stroke: "palette.panelStroke" },
  };
}

/** One run's palette token and type; the size and weight pick the preset. */
export interface Run {
  readonly kind: "literal" | "value";
  /** The binding this run reads; literal runs have none. */
  readonly bindingId?: string;
  readonly text?: string;
  readonly token: StarterPaletteId;
  readonly size: number;
  readonly weight: string;
  readonly precision?: number;
  /** `"none"` when a later literal run writes the unit instead. */
  readonly unitDisplay?: "none" | "short" | "long";
}

/**
 * A text object built from its runs, positioned by its own left edge.
 *
 * The first run carries the object's own resolved Fabric fields, because that
 * is the run whose preset Fabric measures: the same rule
 * `applyObjectTypePresets` follows, and the reason a mixed-size label still
 * opens at the right size.
 *
 * There is deliberately no `align` option. `vigiliaText.align` is honoured by
 * `refreshLayout`, whose arithmetic assumes a **centre** origin: it places a
 * centred run at `box.x + box.width / 2`, and a `box` reconstructed from a
 * top-left-origin object is that object's left minus half its width. The two
 * cancel only while the authored box and the measured run are the same width.
 * Authored wide, a centred reading walks on every refresh — measured in the
 * player, where the storage figure drifted off the artboard and the VRAM ring's
 * percentage left its card. A left edge is stable whatever the reading is.
 */
export function text(
  id: string,
  left: number,
  top: number,
  width: number,
  runs: readonly Run[],
): ObjectJson {
  const first = runs[0] as Run;
  const presetId = `${first.size}-${first.weight}`;
  const spacing = charSpacingPx(presetId, first.size);
  return {
    type: "Textbox",
    id,
    left,
    top,
    width,
    text: plain(runs),
    fontFamily: "Segoe UI, sans-serif",
    fontSize: first.size,
    fontWeight: first.weight,
    fill: solidOf[first.token],
    lineHeight: 1.18,
    ...(spacing === undefined ? {} : { charSpacing: spacing }),
    vigiliaPaint: { fill: `palette.${first.token}` },
    vigiliaText: {
      runs: runs.map((run) =>
        run.kind === "literal"
          ? {
              kind: "literal",
              text: run.text ?? "",
              typePreset: `typePresets.${run.size}-${run.weight}`,
              style: { color: { ref: `palette.${run.token}` } },
            }
          : {
              kind: "value",
              bindingId: run.bindingId ?? "",
              ...(run.precision === undefined
                ? {}
                : { precision: run.precision }),
              ...(run.unitDisplay === undefined
                ? {}
                : { unitDisplay: run.unitDisplay }),
              typePreset: `typePresets.${run.size}-${run.weight}`,
              style: { color: { ref: `palette.${run.token}` } },
            },
      ),
    },
    ...positioned,
  };
}

/**
 * The Fabric `text` field's own copy, so a document reads before its first
 * sample. A value run previews as the em dash the renderer substitutes for a
 * reading it does not have — the same marker, so the authored text and the
 * first live text agree rather than the card starting blank.
 */
function plain(runs: readonly Run[]): string {
  return runs
    .map((run) => (run.kind === "literal" ? (run.text ?? "") : "—"))
    .join("");
}

export function label(
  id: string,
  left: number,
  top: number,
  width: number,
  value: string,
  size: number,
  token: StarterPaletteId,
  weight = "400",
): ObjectJson {
  return text(id, left, top, width, [
    { kind: "literal", text: value, token, size, weight },
  ]);
}

/** A label whose whole text is one reading. */
export function valueLabel(
  id: string,
  left: number,
  top: number,
  width: number,
  size: number,
  token: StarterPaletteId,
  weight: string,
  bindingId: string,
): ObjectJson {
  return text(id, left, top, width, [
    { kind: "value", bindingId, token, size, weight },
  ]);
}

export function path(
  id: string,
  left: number,
  top: number,
  points: readonly PathCommand[],
  token: StarterPaletteId,
  strokeWidth: number,
): ObjectJson {
  return {
    type: "Path",
    id,
    left,
    top,
    path: points,
    fill: null,
    stroke: solidOf[token],
    strokeWidth,
    strokeLineCap: "round",
    strokeLineJoin: "round",
    vigiliaPaint: { stroke: `palette.${token}` },
    ...positioned,
  };
}

export function chart(
  id: string,
  left: number,
  top: number,
  width: number,
  height: number,
  family: string,
  settings: unknown,
): ObjectJson {
  return {
    type: "VigiliaChart",
    id,
    left,
    top,
    width,
    height,
    family,
    settings,
    originX: "center",
    originY: "center",
  };
}
