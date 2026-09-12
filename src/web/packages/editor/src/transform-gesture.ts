import type { Transform } from '@vigilia/renderer-core';
import { applyMatrix, invert, localMatrix, type Point } from './geometry.js';

/**
 * Turning a drag into new transforms.
 *
 * Pure: a gesture is `(what was being dragged, where the pointer is now,
 * which modifiers are held) → new transforms`. No DOM, no event listeners, no
 * accumulated state. Every case below is therefore a unit test rather than
 * something that has to be reproduced by hand with a mouse.
 *
 * ## The part that is genuinely hard
 *
 * Resizing a **rotated** node. Two things both have to hold, and naive
 * implementations get one of them:
 *
 * 1. Dragging the east handle must widen the node along **its own** axis, not
 *    the screen's. So the pointer delta is rotated into the node's local space
 *    before it becomes a size change.
 * 2. The handle opposite the one being dragged must not move. That does not
 *    follow from changing the size, because this format rotates a node about its
 *    own **centre** (matching `transform-origin: 50% 50%` in the renderer) — so
 *    growing the width moves the centre, which swings the anchor corner around
 *    it. The fix is to compute the size first, then place `x`/`y` so the
 *    anchor's *world* position is exactly what it was.
 *
 * Without step 2 a rotated node appears to slide away while being resized,
 * which is the single most common bug in hand-built editors.
 *
 * ## What is deliberately not here yet
 *
 * Resizing **several** nodes at once, which needs each node's box mapped
 * proportionally into a scaled group bounds — and for rotated children, that is
 * not expressible as a per-node width/height change at all. Multi-select
 * currently supports move and rotate; resize applies to a single node.
 * Attempting it for many would silently distort rotated children, so it refuses
 * instead.
 */

/** Which handle is being dragged. */
export type Handle =
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w'
  | 'rotate'
  | 'move';

export interface GestureModifiers {
  /**
   * Shift. Preserves aspect ratio while resizing, constrains a move to one
   * axis, and snaps rotation to {@link ROTATION_SNAP_DEGREES}.
   */
  readonly constrain?: boolean;
  /** Alt. Resizes about the centre instead of the opposite handle. */
  readonly fromCentre?: boolean;
}

/** One node as it was when the gesture began. */
export interface GestureNode {
  readonly id: string;
  readonly transform: Transform;
  /** §61: a locked node does not move. */
  readonly locked?: boolean;
}

export interface GestureStart {
  readonly nodes: readonly GestureNode[];
  readonly handle: Handle;
  /** Pointer position in document (artboard) space when the drag began. */
  readonly origin: Point;
}

/** Degrees per step when rotation is constrained. */
export const ROTATION_SNAP_DEGREES = 15;

/**
 * Smallest size a resize may produce, in artboard pixels.
 *
 * Not zero: the schema permits a zero-sized node, but a gesture that produces
 * one leaves the author with nothing to grab and no way back except undo.
 * Resizing stops at 1 instead of flipping through zero, because a handle that
 * inverts the node under the cursor is disorienting and the format has no
 * negative-size representation to flip *to*.
 */
export const MIN_SIZE = 1;

/** Which local corner stays put for each handle. */
const ANCHOR: Record<Exclude<Handle, 'move' | 'rotate'>, Point> = {
  nw: { x: 1, y: 1 },
  n: { x: 0.5, y: 1 },
  ne: { x: 0, y: 1 },
  e: { x: 0, y: 0.5 },
  se: { x: 0, y: 0 },
  s: { x: 0.5, y: 0 },
  sw: { x: 1, y: 0 },
  w: { x: 1, y: 0.5 },
};

/** Which axes a handle changes. */
const AXES: Record<Exclude<Handle, 'move' | 'rotate'>, { x: number; y: number }> = {
  nw: { x: -1, y: -1 },
  n: { x: 0, y: -1 },
  ne: { x: 1, y: -1 },
  e: { x: 1, y: 0 },
  se: { x: 1, y: 1 },
  s: { x: 0, y: 1 },
  sw: { x: -1, y: 1 },
  w: { x: -1, y: 0 },
};

/**
 * Applies a drag, returning the transforms that changed.
 *
 * Only changed nodes appear in the result, so a caller can write an undo entry
 * containing exactly what moved.
 */
export function applyGesture(
  start: GestureStart,
  pointer: Point,
  modifiers: GestureModifiers = {},
): Map<string, Transform> {
  const movable = start.nodes.filter((node) => node.locked !== true);
  const result = new Map<string, Transform>();

  if (movable.length === 0) {
    return result;
  }

  const delta = { x: pointer.x - start.origin.x, y: pointer.y - start.origin.y };

  if (start.handle === 'move') {
    const constrained = modifiers.constrain === true ? constrainToAxis(delta) : delta;

    for (const node of movable) {
      result.set(node.id, {
        ...node.transform,
        x: (node.transform.x ?? 0) + constrained.x,
        y: (node.transform.y ?? 0) + constrained.y,
      });
    }

    return result;
  }

  if (start.handle === 'rotate') {
    for (const node of movable) {
      result.set(node.id, rotateNode(node.transform, start.origin, pointer, modifiers));
    }

    return result;
  }

  // Resize. Single node only — see the module comment.
  const node = movable[0];

  if (node === undefined || movable.length > 1) {
    return result;
  }

  result.set(node.id, resizeNode(node.transform, start.handle, delta, modifiers));

  return result;
}

/**
 * Locks a move to whichever axis the pointer has travelled further along.
 *
 * Decided per call from the current delta rather than latched at the start of
 * the drag. Latching would be closer to some tools, but it means a gesture that
 * begins with a 2 px wobble is stuck on the wrong axis for the rest of the
 * drag.
 */
function constrainToAxis(delta: Point): Point {
  return Math.abs(delta.x) >= Math.abs(delta.y) ? { x: delta.x, y: 0 } : { x: 0, y: delta.y };
}

function rotateNode(
  transform: Transform,
  origin: Point,
  pointer: Point,
  modifiers: GestureModifiers,
): Transform {
  const centre = worldCentre(transform);

  const startAngle = Math.atan2(origin.y - centre.y, origin.x - centre.x);
  const nowAngle = Math.atan2(pointer.y - centre.y, pointer.x - centre.x);
  const deltaDegrees = ((nowAngle - startAngle) * 180) / Math.PI;

  let rotation = (transform.rotation ?? 0) + deltaDegrees;

  if (modifiers.constrain === true) {
    rotation = Math.round(rotation / ROTATION_SNAP_DEGREES) * ROTATION_SNAP_DEGREES;
  }

  return { ...transform, rotation: normalizeDegrees(rotation) };
}

/**
 * Keeps rotation inside the schema's −360…360.
 *
 * Wrapped rather than clamped: a clamp would make a node stop rotating after a
 * few full turns, which feels broken. −360…360 is what the schema allows, so
 * this wraps into −180…180 and stays comfortably inside it.
 */
export function normalizeDegrees(degrees: number): number {
  if (!Number.isFinite(degrees)) {
    return 0;
  }

  const wrapped = ((degrees % 360) + 540) % 360 - 180;

  // −180 and 180 are the same angle; prefer the positive form so a test and an
  // inspector agree on what to display.
  return wrapped === -180 ? 180 : wrapped;
}

function resizeNode(
  transform: Transform,
  handle: Exclude<Handle, 'move' | 'rotate'>,
  delta: Point,
  modifiers: GestureModifiers,
): Transform {
  const width = transform.width ?? 0;
  const height = transform.height ?? 0;
  const axes = AXES[handle];

  // Step 1: the pointer delta in the node's OWN space, so the east handle
  // widens the node along its axis rather than along the screen's.
  const local = toLocalDelta(delta, transform.rotation ?? 0);

  let newWidth = Math.max(MIN_SIZE, width + axes.x * local.x * (modifiers.fromCentre === true ? 2 : 1));
  let newHeight = Math.max(
    MIN_SIZE,
    height + axes.y * local.y * (modifiers.fromCentre === true ? 2 : 1),
  );

  if (modifiers.constrain === true && width > 0 && height > 0) {
    // Aspect preserved by whichever axis the handle actually drives; an edge
    // handle drives one, so the other follows from the ratio.
    const ratio = height / width;

    if (axes.x !== 0 && axes.y !== 0) {
      // Corner: let the larger change lead, so the shape follows the pointer
      // rather than fighting it.
      if (Math.abs(newWidth - width) >= Math.abs(newHeight - height)) {
        newHeight = Math.max(MIN_SIZE, newWidth * ratio);
      } else {
        newWidth = Math.max(MIN_SIZE, newHeight / ratio);
      }
    } else if (axes.x !== 0) {
      newHeight = Math.max(MIN_SIZE, newWidth * ratio);
    } else {
      newWidth = Math.max(MIN_SIZE, newHeight / ratio);
    }
  }

  const resized: Transform = { ...transform, width: newWidth, height: newHeight };

  if (modifiers.fromCentre === true) {
    // The centre is what stays put, so x/y move by half the size change.
    return {
      ...resized,
      x: (transform.x ?? 0) - (newWidth - width) / 2,
      y: (transform.y ?? 0) - (newHeight - height) / 2,
    };
  }

  // Step 2: put the anchor back. Changing the size moved the centre, and the
  // node rotates about its centre, so the anchor has swung. Without this a
  // rotated node slides away while being resized.
  return preserveAnchor(transform, resized, ANCHOR[handle]);
}

/**
 * Rotates a world-space delta into a node's local space.
 *
 * Only the rotation is undone. Scale is deliberately left alone: `scaleX`/
 * `scaleY` are a separate authored property, and folding them in here would make
 * a drag of 10 px change the width by 5 or 20 depending on a value the author
 * set for a different reason.
 */
export function toLocalDelta(delta: Point, rotationDegrees: number): Point {
  if (rotationDegrees === 0) {
    return delta;
  }

  const radians = (-rotationDegrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: delta.x * cos - delta.y * sin,
    y: delta.x * sin + delta.y * cos,
  };
}

/**
 * Adjusts `x`/`y` so that a given local point keeps its world position.
 *
 * `anchor` is in unit coordinates: `{x: 0, y: 0}` is the top-left,
 * `{x: 1, y: 1}` the bottom-right, `{x: 0.5, y: 1}` the bottom-centre.
 */
export function preserveAnchor(
  before: Transform,
  after: Transform,
  anchor: Point,
): Transform {
  const beforeWorld = anchorWorld(before, anchor);
  const afterWorld = anchorWorld(after, anchor);

  return {
    ...after,
    x: (after.x ?? 0) + (beforeWorld.x - afterWorld.x),
    y: (after.y ?? 0) + (beforeWorld.y - afterWorld.y),
  };
}

function anchorWorld(transform: Transform, anchor: Point): Point {
  const local = {
    x: (transform.width ?? 0) * anchor.x,
    y: (transform.height ?? 0) * anchor.y,
  };

  return applyMatrix(localMatrix(transform), local);
}

/** A node's centre in world space. */
export function worldCentre(transform: Transform): Point {
  return anchorWorld(transform, { x: 0.5, y: 0.5 });
}

/**
 * Where a handle sits in world space, for drawing it.
 *
 * The rotate handle is offset outside the top edge along the node's own rotated
 * "up", so it stays above the shape rather than above the screen.
 */
export function handlePosition(
  transform: Transform,
  handle: Handle,
  rotateOffset = 24,
): Point {
  if (handle === 'move') {
    return worldCentre(transform);
  }

  if (handle === 'rotate') {
    const matrix = localMatrix(transform);
    const top = applyMatrix(matrix, { x: (transform.width ?? 0) / 2, y: 0 });
    const centre = worldCentre(transform);

    // Unit vector from centre toward the top edge, extended past it.
    const dx = top.x - centre.x;
    const dy = top.y - centre.y;
    const length = Math.hypot(dx, dy);

    if (length === 0) {
      return top;
    }

    return { x: top.x + (dx / length) * rotateOffset, y: top.y + (dy / length) * rotateOffset };
  }

  const unit = { x: 1 - ANCHOR[handle].x, y: 1 - ANCHOR[handle].y };

  return anchorWorld(transform, unit);
}

/**
 * Brings a world-space point into a node's local space.
 *
 * Exported for the DOM layer's cursor work: knowing where a pointer is *within*
 * a node is what decides which handle it is over.
 */
export function toLocalPoint(transform: Transform, point: Point): Point | undefined {
  const inverse = invert(localMatrix(transform));

  return inverse === undefined ? undefined : applyMatrix(inverse, point);
}
