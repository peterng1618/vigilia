import type { Transform } from '@vigilia/renderer-core';
import { applyMatrix, invert, localMatrix, type Matrix2D, type Point } from './geometry.js';

/**
 * Legacy pure gesture math until Fabric owns interaction. Rotated resize converts
 * pointer deltas to local space and then restores the opposite anchor.
 */

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
  /** Shift: constrain move/resize and snap rotation. */
  readonly constrain?: boolean;
  /** Alt: resize about the centre. */
  readonly fromCentre?: boolean;
}

export interface GestureNode {
  readonly id: string;
  readonly transform: Transform;
  readonly locked?: boolean;
  /** Ancestor transform; needed to convert document-space input to parent space. */
  readonly parentMatrix?: Matrix2D;
}

export interface GestureStart {
  readonly nodes: readonly GestureNode[];
  readonly handle: Handle;
  readonly origin: Point;
}

export const ROTATION_SNAP_DEGREES = 15;

/** Keep resized nodes recoverable with visible handles. */
export const MIN_SIZE = 1;

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

/** Apply one drag and return only transforms that changed. */
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
    for (const node of movable) {
      const local = toParentDelta(delta, node.parentMatrix);
      const constrained = modifiers.constrain === true ? constrainToAxis(local) : local;

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
      result.set(
        node.id,
        rotateNode(
          node.transform,
          toParentPoint(start.origin, node.parentMatrix),
          toParentPoint(pointer, node.parentMatrix),
          modifiers,
        ),
      );
    }

    return result;
  }

  // Multi-selection resize is deliberately unsupported.
  const node = movable[0];

  if (node === undefined || movable.length > 1) {
    return result;
  }

  result.set(
    node.id,
    resizeNode(node.transform, start.handle, toParentDelta(delta, node.parentMatrix), modifiers),
  );

  return result;
}

/** Re-evaluate the dominant axis from the current delta each frame. */
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

/** Wrap to −180…180 rather than clamping rotation. */
export function normalizeDegrees(degrees: number): number {
  if (!Number.isFinite(degrees)) {
    return 0;
  }

  const wrapped = ((degrees % 360) + 540) % 360 - 180;

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

  const local = toLocalDelta(delta, transform.rotation ?? 0);

  let newWidth = Math.max(MIN_SIZE, width + axes.x * local.x * (modifiers.fromCentre === true ? 2 : 1));
  let newHeight = Math.max(
    MIN_SIZE,
    height + axes.y * local.y * (modifiers.fromCentre === true ? 2 : 1),
  );

  if (modifiers.constrain === true && width > 0 && height > 0) {
    const ratio = height / width;

    if (axes.x !== 0 && axes.y !== 0) {
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
    return {
      ...resized,
      x: (transform.x ?? 0) - (newWidth - width) / 2,
      y: (transform.y ?? 0) - (newHeight - height) / 2,
    };
  }

  // Changing size moves the center; restore the opposite handle in world space.
  return preserveAnchor(transform, resized, ANCHOR[handle]);
}

/** Undo only rotation; authored scale must not alter resize sensitivity. */
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

/** Keep a unit-space anchor at the same world position. */
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

export function worldCentre(transform: Transform): Point {
  return anchorWorld(transform, { x: 0.5, y: 0.5 });
}

/** Bare-transform handle position is parent-local; use placed variant for drawing. */
export function handlePosition(
  transform: Transform,
  handle: Handle,
  rotateOffset = 24,
): Point {
  return placedHandlePosition(
    {
      matrix: localMatrix(transform),
      width: transform.width ?? 0,
      height: transform.height ?? 0,
    },
    handle,
    rotateOffset,
  );
}

/** Convert a document-space delta to parent space; translation does not affect deltas. */
export function toParentDelta(delta: Point, parentMatrix: Matrix2D | undefined): Point {
  if (parentMatrix === undefined) {
    return delta;
  }

  const linear: Matrix2D = { ...parentMatrix, e: 0, f: 0 };
  const inverse = invert(linear);

  return inverse === undefined ? delta : applyMatrix(inverse, delta);
}

/** Convert a document-space point to parent space. */
export function toParentPoint(point: Point, parentMatrix: Matrix2D | undefined): Point {
  if (parentMatrix === undefined) {
    return point;
  }

  const inverse = invert(parentMatrix);

  return inverse === undefined ? point : applyMatrix(inverse, point);
}

/** World-space handle position for an already composed placement. */
export function placedHandlePosition(
  placed: { readonly matrix: Matrix2D; readonly width: number; readonly height: number },
  handle: Handle,
  rotateOffset = 24,
): Point {
  const local = handleLocalPoint(placed.width, placed.height, handle);
  const world = applyMatrix(placed.matrix, local);

  if (handle !== 'rotate') {
    return world;
  }

  const centre = applyMatrix(placed.matrix, { x: placed.width / 2, y: placed.height / 2 });
  const dx = world.x - centre.x;
  const dy = world.y - centre.y;
  const length = Math.hypot(dx, dy);

  return length === 0
    ? world
    : { x: world.x + (dx / length) * rotateOffset, y: world.y + (dy / length) * rotateOffset };
}

const CORNER_HANDLES: readonly Handle[] = ['nw', 'ne', 'se', 'sw'];

const HANDLE_DIRECTION: Record<string, { readonly x: number; readonly y: number }> = {
  nw: { x: -1, y: -1 },
  n: { x: 0, y: -1 },
  ne: { x: 1, y: -1 },
  e: { x: 1, y: 0 },
  se: { x: 1, y: 1 },
  s: { x: 0, y: 1 },
  sw: { x: -1, y: 1 },
  w: { x: -1, y: 0 },
};

/** Push overlapping tiny-box handles outward while preserving their directions. */
export function spreadHandlesBy(
  world: Point,
  centre: Point,
  direction: Point,
  minRadiusPx: number,
): Point {
  const dx = world.x - centre.x;
  const dy = world.y - centre.y;

  if (Math.hypot(dx, dy) >= minRadiusPx) {
    return world;
  }

  const length = Math.hypot(direction.x, direction.y);

  if (length === 0) {
    return world;
  }

  return {
    x: centre.x + (direction.x / length) * minRadiusPx,
    y: centre.y + (direction.y / length) * minRadiusPx,
  };
}

/** Transform a handle's local outward direction into world space. */
export function handleWorldDirection(matrix: Matrix2D, handle: Handle): Point {
  const local = HANDLE_DIRECTION[handle] ?? { x: 0, y: 0 };

  if (local.x === 0 && local.y === 0) {
    return local;
  }

  const origin = applyMatrix(matrix, { x: 0, y: 0 });
  const tip = applyMatrix(matrix, local);

  return { x: tip.x - origin.x, y: tip.y - origin.y };
}

/** Hide ambiguous edge handles on tiny boxes; corners remain for recovery. */
export function visibleResizeHandles(
  widthPx: number,
  heightPx: number,
  hitSizePx: number,
): readonly Handle[] {
  const roomVertically = Math.abs(heightPx) >= hitSizePx;
  const roomHorizontally = Math.abs(widthPx) >= hitSizePx;

  return [
    ...CORNER_HANDLES,
    ...(roomVertically ? (['n', 's'] as const) : []),
    ...(roomHorizontally ? (['e', 'w'] as const) : []),
  ];
}

function handleLocalPoint(width: number, height: number, handle: Handle): Point {
  if (handle === 'move') {
    return { x: width / 2, y: height / 2 };
  }

  if (handle === 'rotate') {
    return { x: width / 2, y: 0 };
  }

  const unit = { x: 1 - ANCHOR[handle].x, y: 1 - ANCHOR[handle].y };

  return { x: width * unit.x, y: height * unit.y };
}

/** Convert a parent-local point into node-local coordinates. */
export function toLocalPoint(transform: Transform, point: Point): Point | undefined {
  const inverse = invert(localMatrix(transform));

  return inverse === undefined ? undefined : applyMatrix(inverse, point);
}
