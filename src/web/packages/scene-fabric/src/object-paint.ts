import { Group, type StaticCanvas } from "fabric/es";
import type { Globals } from "@vigilia/renderer-core";
import { fabricArtboardPaint } from "./artboard-paint.js";

/** Persisted semantic palette references for Fabric object paint properties. */
export const VIGILIA_PAINT_PROPERTY = "vigiliaPaint";

export interface FabricPaintRefs {
  readonly fill?: `palette.${string}`;
  readonly stroke?: `palette.${string}`;
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
        if (paint !== undefined) object.set(property, paint);
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
      (property === "fill" || property === "stroke") &&
      typeof ref === "string" &&
      ref.startsWith("palette."),
  );
}
