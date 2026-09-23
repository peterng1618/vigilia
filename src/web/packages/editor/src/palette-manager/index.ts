import type { Artboard, FabricPalette } from "@vigilia/renderer-core";
import { reassignObjectPaletteReferences } from "@vigilia/scene-fabric";
import type { Canvas } from "fabric/es";

export interface PaletteTokenReassignment {
  readonly from: `palette.${string}`;
  readonly to: `palette.${string}`;
  readonly artboard: Artboard;
  readonly palette: FabricPalette;
}

/** Rewrites every canvas/artboard reference to a deleted palette token and drops it. */
export function reassignPaletteToken(
  canvas: Canvas,
  artboard: Artboard,
  palette: FabricPalette,
  id: string,
  replacement: string,
): PaletteTokenReassignment {
  const from = `palette.${id}` as const;
  const to = `palette.${replacement}` as const;
  reassignObjectPaletteReferences(canvas, from, to);
  const nextArtboard = { ...artboard };
  for (const property of ["background", "barColor"] as const) {
    const value = nextArtboard[property];
    if (value !== undefined && "ref" in value && value.ref === from)
      nextArtboard[property] = { ref: to };
  }
  const nextPalette = { ...palette };
  delete nextPalette[id];
  return { from, to, artboard: nextArtboard, palette: nextPalette };
}

export { createPalettePanel, type PalettePanel } from "./panel.js";
