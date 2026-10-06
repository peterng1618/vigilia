import type { Globals } from "@vigilia/renderer-core";
import {
  type FabricObject,
  Group,
  Path,
  Shadow,
  type StaticCanvas,
} from "fabric/es";
import { fabricArtboardPaint } from "./artboard-paint.js";
import { Arc } from "./sector-object.js";

/** Persisted semantic palette references for Fabric object paint properties. */
export const VIGILIA_PAINT_PROPERTY = "vigiliaPaint";

/**
 * What an author is told when their document asks for a fill the arc will not
 * take. Spoken rather than silent, and named as a drawing rather than an error:
 * the document is not malformed, it asks for a figure the product declines to
 * paint. The sentence is here rather than in the editor because the refusal
 * happens here, and a caller with no way to hear it would have no way to say it.
 *
 * Exported so `persist.ts` says the same words about the same refusal from the
 * site that raises it: the sentence is one, wherever it is spoken from.
 */
export const ARC_FILL_REFUSED =
  "This arc's fill was not drawn. An arc is an open curve, and filling one paints the segment its chord cuts rather than the sweep the document asked for, so it is drawn as the curve it is.";

/** Properties a palette reference may own. */
const PAINT_REF_PROPERTIES: ReadonlySet<string> = new Set([
  "fill",
  "stroke",
  "shadowColor",
]);

export interface FabricPaintRefs {
  readonly fill?: `palette.${string}`;
  readonly stroke?: `palette.${string}`;
  /** Fabric keeps the shadow colour inside its native `shadow` object. */
  readonly shadowColor?: `palette.${string}`;
}

type PaintableObject = {
  get(name: string): unknown;
  set(name: string, value: unknown): unknown;
  width?: number;
  height?: number;
  scaleX?: number;
  scaleY?: number;
};

/**
 * Which Fabric property a paint the author picks belongs on.
 *
 * A `Path` carrying no fill is a stroked object, and this product already says
 * so: `newShapeStroke` fills nothing and is the palette's answer for a line, a
 * polyline and — by its own comment — a path. The Starter's icons are authored
 * the same way, `fill: null` and `stroke`/`strokeWidth` carrying the ink.
 *
 * Filling one of those paints whatever region its centrelines happen to
 * enclose, which for a stroke glyph is not the glyph. `starterIcons.storage`
 * declares one closed subpath and no second, so under any fill rule the whole
 * drive body floods and every counter closes: there is no hole in the data for
 * even one to open. What the author meant was the ink, so on an unfilled path
 * the ink is the stroke.
 *
 * Everything else is untouched. A path that arrives filled — a filled author's
 * glyph, the new-path default — keeps filling the region it encloses, and so
 * does a rounded card or a chevron.
 *
 * An unfilled arc is the same case for the same reason: it is stroked, and what
 * it spans is the region between the curve and its chord, which filling would
 * flood. Its wedge is not — a sector is a region, so it fills like any other
 * closed shape.
 */
export function paintPropertyFor(object: FabricObject): "fill" | "stroke" {
  if (refusesFill(object)) return "stroke";
  if (objectHasFill(object)) return "fill";
  return object instanceof Path ? "stroke" : "fill";
}

/**
 * Whether this shape may carry a fill at all.
 *
 * The one exception, and it is about geometry rather than taste. Every shape here
 * fills the region its own path encloses — a polyline with a fill has always
 * filled, and a wedge's sector is a region it really has. An arc is not: a fill
 * under `ctx.arc` closes the subpath with a straight chord, so the figure drawn
 * is a circular segment. Measured on a radius-80 sweep, that is 1933 painted
 * pixels where a quarter-disc is 5027 — a shape the author did not ask for and
 * cannot see the difference in.
 *
 * **The single answer to that question**, consulted wherever it matters. It is
 * exported because revival has to ask it too: Fabric restores a serialised fill
 * inside `loadFromJSON`, so a display that never runs the paint pass would
 * otherwise paint the chord while the editor did not. Two surfaces reading one
 * predicate is what keeps them agreeing about the document.
 */
export function refusesFill(object: unknown): boolean {
  return object instanceof Arc;
}

/** Fabric spells "no fill" three ways across revival, the inspector and authoring. */
function objectHasFill(object: FabricObject): boolean {
  const fill: unknown = object.get("fill");

  return fill !== null && fill !== undefined && fill !== "" && fill !== false;
}

/** Reapply global palette changes without making resolved Fabric paint authored state. */
export function applyObjectPalettePaints(
  canvas: StaticCanvas,
  globals: Globals | undefined,
  options: PaintApplicationOptions = {},
): void {
  if (
    typeof (canvas as unknown as { getObjects?: unknown }).getObjects !==
    "function"
  )
    return;
  applyPaints(canvas.getObjects(), globals, options);
  canvas.requestRenderAll();
}

/**
 * How a caller hears about paint it could not apply.
 *
 * Optional because the pass runs in the player too, which has nothing to tell an
 * author. Where there is an editor, a refusal is reported rather than applied
 * quietly: an author cannot otherwise tell that their document asked for a figure
 * the editor declined to draw.
 *
 * **The same channel revival reports through**, so the sentence and its
 * category are written once whatever raised the refusal.
 */
export interface PaintApplicationOptions {
  readonly onRefusedPaint?: (message: string) => void;
}

function applyPaints(
  objects: readonly PaintableObject[],
  globals: Globals | undefined,
  options: PaintApplicationOptions,
): void {
  for (const object of objects) {
    const refs = object.get(VIGILIA_PAINT_PROPERTY);
    if (isPaintRefs(refs)) {
      for (const [property, ref] of Object.entries(refs)) {
        // Revival refuses at the read — the revived arc's own fill is withheld —
        // and this refuses at the write, because the pass runs after revival and
        // would otherwise re-resolve the reference onto the object. Both are
        // load-bearing for the render: drop this branch and the chord is back on
        // the editor canvas. The reference is kept — `vigiliaPaint` is persisted,
        // so dropping it rewrites the author's document on the next save, and the
        // refusal is re-applied on every load regardless.
        if (property === "fill" && refusesFill(object)) {
          object.set("fill", "");
          options.onRefusedPaint?.(ARC_FILL_REFUSED);
          continue;
        }
        const value = globals?.palette?.[ref.slice("palette.".length)]?.value;
        const paint = fabricArtboardPaint(
          value,
          extent(object.width, object.scaleX),
          extent(object.height, object.scaleY),
        );
        if (paint === undefined) continue;
        // A shadow colour lives inside Fabric's native Shadow, and only a
        // solid paint can fill it; a gradient token leaves the authored shadow
        // alone rather than being coerced into something Fabric cannot draw.
        if (property === "shadowColor") {
          const shadow = object.get("shadow");
          // Spread the live instance rather than `toObject`: persist.ts is the
          // only module allowed to call it, and the native geometry the author
          // set (blur, offsets) must survive the recolour.
          if (shadow instanceof Shadow && typeof paint === "string")
            object.set("shadow", new Shadow({ ...shadow, color: paint }));
        } else object.set(property, paint);
      }
    }
    if (object instanceof Group)
      applyPaints(object.getObjects(), globals, options);
  }
}

function extent(value: number | undefined, scale: number | undefined): number {
  return Math.max(1, (value ?? 1) * Math.abs(scale ?? 1));
}

function isPaintRefs(value: unknown): value is FabricPaintRefs {
  if (typeof value !== "object" || value === null) return false;
  return Object.entries(value).every(
    ([property, ref]) =>
      PAINT_REF_PROPERTIES.has(property) &&
      typeof ref === "string" &&
      ref.startsWith("palette."),
  );
}

/**
 * Whether a revival-time refusal would be reported anyway, by the paint pass.
 *
 * Revival refuses every `refusesFill` object whether or not it carries a
 * palette reference, so it is the only site that sees a hand-authored arc with
 * no `vigiliaPaint` at all. That is the case a report belongs to; the
 * reference-carrying arc is this pass's to report, and revival staying quiet
 * about it is what keeps one refusal from being said twice on one load.
 */
export function refusalIsPaintPasses(
  object: Pick<FabricObject, "get">,
): boolean {
  const refs = object.get(VIGILIA_PAINT_PROPERTY);
  return isPaintRefs(refs) && refs?.fill !== undefined;
}
