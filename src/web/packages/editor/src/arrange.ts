import { isLocked } from "@vigilia/scene-fabric";
import { ActiveSelection, type FabricObject, Point, util } from "fabric/es";
import type { EditorInteraction } from "./editor-interaction.js";

export type ArrangeAction =
  | "align-left"
  | "align-center-x"
  | "align-right"
  | "align-top"
  | "align-center-y"
  | "align-bottom"
  | "distribute-x"
  | "distribute-y";

interface ArrangeObject extends FabricObject {
  readonly locked?: boolean;
}

/** Moves the current Fabric selection without introducing a separate geometry model. */
export function applyArrange(
  editor: EditorInteraction,
  action: ArrangeAction,
): boolean {
  const active = editor.canvas.getActiveObject();
  if (!(active instanceof ActiveSelection) || !canArrange(editor, action))
    return false;
  const objects = active.getObjects() as ArrangeObject[];

  editor.canvas.discardActiveObject();
  if (action === "distribute-x" || action === "distribute-y")
    distribute(objects, action === "distribute-x" ? "x" : "y");
  else align(objects, action);

  editor.canvas.setActiveObject(
    new ActiveSelection(objects, {
      canvas: editor.canvas,
      multiSelectionStacking: "selection-order",
    }),
  );
  editor.canvas.requestRenderAll();
  editor.historyManager.saveState();
  return true;
}

/** Mirrors command eligibility so controls cannot advertise an invalid action. */
export function canArrange(
  editor: EditorInteraction,
  action: ArrangeAction,
): boolean {
  const active = editor.canvas.getActiveObject();
  if (!(active instanceof ActiveSelection)) return false;
  const objects = active.getObjects() as ArrangeObject[];
  return (
    !objects.some((object) => isLocked(object)) &&
    objects.length >= arrangeMinimum(action)
  );
}

/** How many objects an action needs. The one owner of the threshold, so a
    surface that gates a control cannot advertise an action this one refuses. */
export function arrangeMinimum(action: ArrangeAction): number {
  return action === "distribute-x" || action === "distribute-y" ? 3 : 2;
}

function align(
  objects: readonly ArrangeObject[],
  action: Exclude<ArrangeAction, "distribute-x" | "distribute-y">,
): void {
  const anchor = objects[0]!;
  const bounds = anchor.getBoundingRect();
  const horizontal =
    action === "align-left" ||
    action === "align-center-x" ||
    action === "align-right";
  const target = horizontal
    ? action === "align-left"
      ? bounds.left
      : action === "align-right"
        ? bounds.left + bounds.width
        : bounds.left + bounds.width / 2
    : action === "align-top"
      ? bounds.top
      : action === "align-bottom"
        ? bounds.top + bounds.height
        : bounds.top + bounds.height / 2;

  for (const object of objects) {
    const current = object.getBoundingRect();
    const position = horizontal
      ? action === "align-left"
        ? current.left
        : action === "align-right"
          ? current.left + current.width
          : current.left + current.width / 2
      : action === "align-top"
        ? current.top
        : action === "align-bottom"
          ? current.top + current.height
          : current.top + current.height / 2;
    move(
      object,
      horizontal ? target - position : 0,
      horizontal ? 0 : target - position,
    );
  }
}

function distribute(objects: readonly ArrangeObject[], axis: "x" | "y"): void {
  const ordered = objects
    .slice()
    .sort((left, right) => start(left, axis) - start(right, axis));
  const first = ordered[0]!;
  const last = ordered.at(-1)!;
  const inner = ordered.slice(1, -1);
  const gap =
    (start(last, axis) -
      end(first, axis) -
      inner.reduce((sum, object) => sum + size(object, axis), 0)) /
    (ordered.length - 1);
  let next = end(first, axis) + gap;

  for (const object of inner) {
    move(
      object,
      axis === "x" ? next - start(object, axis) : 0,
      axis === "y" ? next - start(object, axis) : 0,
    );
    next += size(object, axis) + gap;
  }
}

function start(object: ArrangeObject, axis: "x" | "y"): number {
  const bounds = object.getBoundingRect();
  return axis === "x" ? bounds.left : bounds.top;
}

function end(object: ArrangeObject, axis: "x" | "y"): number {
  return start(object, axis) + size(object, axis);
}

function size(object: ArrangeObject, axis: "x" | "y"): number {
  const bounds = object.getBoundingRect();
  return axis === "x" ? bounds.width : bounds.height;
}

/** Moves by a canvas-plane delta, expressed in the plane `left`/`top` live in.
 *
 * `getBoundingRect()` is a canvas coordinate, while `left`/`top` are the
 * parent's plane — for a grouped object the two differ by the group's
 * transform. Writing the one into the other moved a group member by its group's
 * translation a second time, which reads as objects thrown off the canvas.
 *
 * The delta is therefore converted through the parent's inverse with its offset
 * ignored — a delta is a vector, not a point — and added to `left`/`top`,
 * which is a pure translation of the anchor. Going through
 * `setPositionByOrigin(centre, …)` instead is not equivalent: entering a group
 * bakes the group's angle and scale onto the children, and the centre read is
 * then no longer the exact inverse of the write. */
function move(object: ArrangeObject, dx: number, dy: number): void {
  const parent = object.parent;
  const delta = parent
    ? util.transformPoint(
        new Point(dx, dy),
        util.invertTransform(parent.calcTransformMatrix()),
        true,
      )
    : new Point(dx, dy);
  object.set({ left: object.left + delta.x, top: object.top + delta.y });
  object.setCoords();
}
