// Ported: fork 9efdd78a src/editor/snapping-manager/scaling/scaling-snap-guard.ts
/** Tolerance for an edge's subpixel drift around a guide after a Fabric resize. */
export const SNAP_GUARD_POSITION_EPSILON = 0.1;

/** Tolerance for holding a crop frame at the guide a live scale started next to. */
export const SOURCE_SCALED_GUIDE_HOLD_EPSILON = 1;

/** The edge a guide holds during the current resize. */
export type ScalingStepSnapGuard = {
  type: "vertical" | "horizontal";
  edge: "left" | "right" | "top" | "bottom";
  position: number;
};

/** The minimal bounds shape that can be checked against a snap guard. */
export interface SnapGuardBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Returns the distance from the bounds' held edge to the guide. */
export function getBoundsSnapGuardDistance({
  bounds,
  snapGuard,
}: {
  bounds: SnapGuardBounds;
  snapGuard: ScalingStepSnapGuard;
}): number {
  const { edge, position } = snapGuard;

  if (edge === "left") return Math.abs(bounds.left - position);
  if (edge === "right") return Math.abs(bounds.right - position);
  if (edge === "top") return Math.abs(bounds.top - position);

  return Math.abs(bounds.bottom - position);
}

/** Checks the bounds' held edge against the guide after rounding. */
export function isBoundsInsideSnapGuard({
  bounds,
  snapGuard,
}: {
  bounds: SnapGuardBounds;
  snapGuard: ScalingStepSnapGuard;
}): boolean {
  const { edge, position } = snapGuard;

  if (edge === "left")
    return bounds.left >= position - SNAP_GUARD_POSITION_EPSILON;
  if (edge === "right")
    return bounds.right <= position + SNAP_GUARD_POSITION_EPSILON;
  if (edge === "top")
    return bounds.top >= position - SNAP_GUARD_POSITION_EPSILON;

  return bounds.bottom <= position + SNAP_GUARD_POSITION_EPSILON;
}

/** Checks whether the bounds' held edge sits exactly on the guide after rounding. */
export function isBoundsOnSnapGuide({
  bounds,
  snapGuard,
}: {
  bounds: SnapGuardBounds;
  snapGuard: ScalingStepSnapGuard;
}): boolean {
  return (
    getBoundsSnapGuardDistance({ bounds, snapGuard }) <=
    SNAP_GUARD_POSITION_EPSILON
  );
}
