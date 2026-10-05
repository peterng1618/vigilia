import type { Artboard, FabricPalette } from "@vigilia/renderer-core";
import {
  objectPaletteReferences,
  reassignObjectPaletteReferences,
} from "@vigilia/scene-fabric";
import type { Canvas } from "fabric/es";
import type { PaletteTokenUse } from "./panel.js";

export interface PaletteTokenReassignment {
  readonly from: `palette.${string}`;
  readonly to: `palette.${string}`;
  readonly artboard: Artboard;
  readonly palette: FabricPalette;
}

/**
 * Every token's objects, read from the live scene.
 *
 * This sits beside `reassignPaletteToken` on purpose. Both go through
 * `objectPaletteReferences`, so the figure the author reads beside a token and
 * the set a deletion moves come from one walk — a token reported unused is
 * unused in the sense the delete will act on, and cannot be removed from under
 * an object the walk did not reach.
 */
export function paletteTokenUsage(
  canvas: Canvas,
  palette: FabricPalette,
): Record<string, readonly PaletteTokenUse[]> {
  const objects = canvas.getObjects();
  const usage: Record<string, readonly PaletteTokenUse[]> = {};
  for (const id of Object.keys(palette)) {
    usage[id] = objectPaletteReferences(
      objects,
      `palette.${id}` as `palette.${string}`,
    );
  }
  return usage;
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

export {
  createPalettePanel,
  type PalettePanel,
  type PalettePanelOptions,
  type PaletteTokenUse,
} from "./panel.js";
