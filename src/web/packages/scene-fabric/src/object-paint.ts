import type { Globals } from "@vigilia/renderer-core";
import { Group, Shadow, type StaticCanvas } from "fabric/es";
import { fabricArtboardPaint } from "./artboard-paint.js";

/** Persisted semantic palette references for Fabric object paint properties. */
export const VIGILIA_PAINT_PROPERTY = "vigiliaPaint";

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

/** Reapply global palette changes without making resolved Fabric paint authored state. */
export function applyObjectPalettePaints(
  canvas: StaticCanvas,
  globals: Globals | undefined,
): void {
  if (
    typeof (canvas as unknown as { getObjects?: unknown }).getObjects !==
    "function"
  )
    return;
  applyPaints(canvas.getObjects(), globals);
  canvas.requestRenderAll();
}

function applyPaints(
  objects: readonly PaintableObject[],
  globals: Globals | undefined,
): void {
  for (const object of objects) {
    const refs = object.get(VIGILIA_PAINT_PROPERTY);
    if (isPaintRefs(refs)) {
      for (const [property, ref] of Object.entries(refs)) {
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
    if (object instanceof Group) applyPaints(object.getObjects(), globals);
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
