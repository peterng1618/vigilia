import { reassignObjectTypePresetReferences } from "@vigilia/scene-fabric";
import type { Canvas } from "fabric/es";
import type { TypePresets } from "./panel.js";

/** Rewrites every canvas reference to a deleted type preset and drops it. */
export function reassignTypePresetToken(
  canvas: Canvas,
  typePresets: TypePresets,
  id: string,
  replacement: string,
): TypePresets {
  reassignObjectTypePresetReferences(
    canvas,
    `typePresets.${id}` as const,
    `typePresets.${replacement}` as const,
  );
  const next = { ...typePresets };
  delete next[id];
  return next;
}

export {
  createTypePresetPanel,
  type TypePresetFontActions,
  type TypePresetPanel,
  type TypePresets,
} from "./panel.js";
