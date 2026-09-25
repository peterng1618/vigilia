// Ported: fork 9efdd78a src/editor/snapping-manager/scaling/standard-scale-control.ts
import {
  controlsUtils,
  type Control,
  type FabricObject,
  type TPointerEvent,
  type Transform,
} from "fabric/es";

/** Fabric's reference handles for ordinary rectangular scaling. */
const STANDARD_RECTANGULAR_SCALE_CONTROLS: Readonly<Record<string, Control>> =
  Object.freeze(controlsUtils.createObjectDefaultControls());

/** Tolerance for comparing a standard Fabric handle's geometry. */
const STANDARD_SCALE_CONTROL_EPSILON = 0.000000001;

/** Compares two of a handle's numeric properties, allowing missing values. */
function areControlNumbersEqual({
  first,
  second,
}: {
  // The explicit `| undefined` is what `exactOptionalPropertyTypes` needs to
  // accept an absent-ish value read out of a Fabric control.
  first?: number | undefined;
  second?: number | undefined;
}): boolean {
  if (first === undefined || second === undefined) return first === second;

  return (
    Number.isFinite(first) &&
    Number.isFinite(second) &&
    Math.abs(first - second) <= STANDARD_SCALE_CONTROL_EPSILON
  );
}

/** Checks the handlers and the position of the active handle against Fabric's default. */
export function isStandardRectangularScaleControl({
  target,
  transform,
}: {
  target: FabricObject;
  transform: Transform;
}): boolean {
  const control = target.controls[transform.corner];
  const standardControl = STANDARD_RECTANGULAR_SCALE_CONTROLS[transform.corner];
  if (!control || !standardControl) return false;

  const behaviorMatches = [
    control.actionHandler === standardControl.actionHandler,
    control.getActionHandler === standardControl.getActionHandler,
    control.positionHandler === standardControl.positionHandler,
    control.getTransformAnchorPoint === standardControl.getTransformAnchorPoint,
    control.transformAnchorPoint === standardControl.transformAnchorPoint,
  ];
  if (!behaviorMatches.every(Boolean)) return false;

  return [
    [control.x, standardControl.x],
    [control.y, standardControl.y],
    [control.offsetX, standardControl.offsetX],
    [control.offsetY, standardControl.offsetY],
  ].every(([value, standardValue]) => {
    return areControlNumbersEqual({ first: value, second: standardValue });
  });
}

/** Checks that the modifier switched a side handle from scaling to skewing. */
export function didSideScaleSwitchToSkew({
  controlKey,
  pointerEvent,
  target,
}: {
  controlKey: string;
  pointerEvent: TPointerEvent;
  target: FabricObject;
}): boolean {
  const isSideControl =
    controlKey === "ml" ||
    controlKey === "mr" ||
    controlKey === "mt" ||
    controlKey === "mb";
  if (!isSideControl) return false;

  const altActionKey = target.canvas?.altActionKey;
  if (!altActionKey) return false;

  return Reflect.get(pointerEvent, altActionKey) === true;
}
