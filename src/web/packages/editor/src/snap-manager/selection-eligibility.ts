import { Textbox } from "fabric/es";
import type { ActiveSelection, FabricObject } from "fabric/es";

// Ported: fork 9efdd78a src/editor/snapping-manager/movement/movement-snapping-controller.ts:180-197
// Dropped clause: the fork's per-child kind allow-list. The fork needed it because
// its movement path was type-specific (`isShapeGroup`); Vigilia's snap path is
// type-agnostic (`getObjectExactBounds` accepts any `FabricObject`). The fork's own
// list (`FabricImage || Textbox || isShapeGroup`) would have refused a plain `Rect`
// and a `VigiliaChart`, so it was never a claim about which Vigilia objects snap.
// Kept clauses: member count, no parented child, unit scale when text is present.

/** Whether a composed selection may snap as a unit. */
export function isSupportedActiveSelection(input: {
  readonly selection: ActiveSelection;
}): boolean {
  const objects: readonly FabricObject[] = input.selection.getObjects();
  if (objects.length < 2) return false;

  // A scaled selection containing text: the text finalization path could
  // reinterpret movement as unfinished scaling.
  const hasText = objects.some((object) => object instanceof Textbox);
  if (hasText && (input.selection.scaleX !== 1 || input.selection.scaleY !== 1))
    return false;

  // A parented child's bounds are relative to its parent, not the canvas.
  return objects.every((object) => object.parent === undefined);
}
