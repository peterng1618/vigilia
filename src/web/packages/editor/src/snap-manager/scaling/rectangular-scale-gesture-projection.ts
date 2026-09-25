// Ported: fork 9efdd78a src/editor/snapping-manager/scaling/rectangular-scale-gesture-projection.ts
import type { FabricObject, Transform } from "fabric/es";
import type { ObjectBounds } from "../bounds.js";
import type {
  ScaleProjectionVariable,
  ScaleSceneAxis,
  ScaleSceneEdge,
} from "./scale-projection.js";
import type { ScaleProjectionModeInput } from "./scale-snapping-resolver.js";

/** A handle that can resize a rectangular object. */
export type RectangularScaleControlKey =
  | "tl"
  | "tr"
  | "bl"
  | "br"
  | "ml"
  | "mr"
  | "mt"
  | "mb";

/** How the chosen handle resizes the object. */
export type RectangularScaleGestureMode =
  | "horizontal"
  | "vertical"
  | "free"
  | "uniform";

/** The variable through which scale moves the rectangle's edges. */
export type RectangularScaleProjectionVariable =
  | "multiplier-x"
  | "multiplier-y"
  | "uniform-multiplier";

/** An edge of the rectangle's outer bounds in canvas coordinates. */
export type RectangularScaleSceneEdge = ScaleSceneEdge;

/** An axis of the rectangle's outer bounds in canvas coordinates. */
export type RectangularScaleSceneAxis = ScaleSceneAxis;

/** A two-dimensional scale-gesture point. */
export type RectangularScalePoint = Readonly<{
  x: number;
  y: number;
}>;

/** Width and height multipliers relative to the gesture's start. */
export type RectangularScaleMultipliers = Readonly<{
  x: number;
  y: number;
}>;

/** The Fabric transform data needed to calculate a scale. */
export type RectangularScaleGestureTransform = Readonly<{
  target: FabricObject;
  action: Transform["action"];
  corner: string;
  originX: Transform["originX"];
  originY: Transform["originY"];
  original: Readonly<{
    scaleX: number;
    scaleY: number;
  }>;
}>;

/** One edge's dependence on the scale multipliers. */
export type RectangularScaleEdgeProjection = Readonly<{
  axis: RectangularScaleSceneAxis;
  edge: RectangularScaleSceneEdge;
  baselinePosition: number;
  coefficients: readonly number[];
}>;

/** The moving edges of one scale mode. */
export type RectangularScaleModeProjection = Readonly<{
  mode: RectangularScaleGestureMode;
  variables: readonly RectangularScaleProjectionVariable[];
  baselineValues: readonly number[];
  edges: readonly RectangularScaleEdgeProjection[];
}>;

/** The start geometry of one rectangular top-level scale gesture. */
export type RectangularScaleGestureProjection = Readonly<{
  controlKey: RectangularScaleControlKey;
  control: RectangularScalePoint;
  origin: RectangularScalePoint;
  pointerStart: RectangularScalePoint;
  fixedAnchor: RectangularScalePoint;
  u: RectangularScalePoint;
  v: RectangularScalePoint;
  originalScales: RectangularScaleMultipliers;
  baselineBounds: Readonly<ObjectBounds>;
}>;

/** Fabric's four corners in canvas coordinates: tl, tr, br, bl. */
type RectangularScaleCorners = Readonly<{
  topLeft: RectangularScalePoint;
  topRight: RectangularScalePoint;
  bottomRight: RectangularScalePoint;
  bottomLeft: RectangularScalePoint;
}>;

/** The rule for picking an edge out of the four corner coordinates. */
type RectangularScaleEdgeExtremum = "minimum" | "maximum";

/** The width and height contributions to one edge's position. */
type RectangularScaleEdgeCoefficients = Readonly<{
  axis: RectangularScaleSceneAxis;
  edge: RectangularScaleSceneEdge;
  baselinePosition: number;
  multiplierX: number;
  multiplierY: number;
}>;

/** The edge description needed to calculate its position. */
type RectangularScaleEdgeDescriptor = Readonly<{
  axis: RectangularScaleSceneAxis;
  edge: RectangularScaleSceneEdge;
  extremum: RectangularScaleEdgeExtremum;
}>;

/** Tolerance for checking the basis vectors and the coefficients. */
const RECTANGULAR_SCALE_PROJECTION_EPSILON = 0.000000001;

/** Fabric's eight resize handles as normalized coordinates. */
const RECTANGULAR_SCALE_CONTROL_COORDINATES: Readonly<
  Record<RectangularScaleControlKey, RectangularScalePoint>
> = Object.freeze({
  tl: Object.freeze({ x: 0, y: 0 }),
  tr: Object.freeze({ x: 1, y: 0 }),
  bl: Object.freeze({ x: 0, y: 1 }),
  br: Object.freeze({ x: 1, y: 1 }),
  ml: Object.freeze({ x: 0, y: 0.5 }),
  mr: Object.freeze({ x: 1, y: 0.5 }),
  mt: Object.freeze({ x: 0.5, y: 0 }),
  mb: Object.freeze({ x: 0.5, y: 1 }),
});

/** The rectangle's four outer edges and the rule for picking each one. */
const RECTANGULAR_SCALE_EDGE_DESCRIPTORS: readonly RectangularScaleEdgeDescriptor[] =
  Object.freeze([
    Object.freeze({ axis: "x", edge: "left", extremum: "minimum" }),
    Object.freeze({ axis: "x", edge: "right", extremum: "maximum" }),
    Object.freeze({ axis: "y", edge: "top", extremum: "minimum" }),
    Object.freeze({ axis: "y", edge: "bottom", extremum: "maximum" }),
  ]);

/** The scale variables of a left or right handle drag. */
const HORIZONTAL_PROJECTION_VARIABLES: readonly RectangularScaleProjectionVariable[] =
  Object.freeze(["multiplier-x"]);

/** The scale variables of a top or bottom handle drag. */
const VERTICAL_PROJECTION_VARIABLES: readonly RectangularScaleProjectionVariable[] =
  Object.freeze(["multiplier-y"]);

/** The scale variables of a free corner drag. */
const FREE_PROJECTION_VARIABLES: readonly RectangularScaleProjectionVariable[] =
  Object.freeze(["multiplier-x", "multiplier-y"]);

/** The scale variable of a proportional corner drag. */
const UNIFORM_PROJECTION_VARIABLES: readonly RectangularScaleProjectionVariable[] =
  Object.freeze(["uniform-multiplier"]);

/** Maps the rectangle's variables onto the shared snapping resolver's variables. */
const SNAP_VARIABLE_BY_RECTANGULAR_VARIABLE: Readonly<
  Record<RectangularScaleProjectionVariable, ScaleProjectionVariable>
> = Object.freeze({
  "multiplier-x": "scale-x",
  "multiplier-y": "scale-y",
  "uniform-multiplier": "uniform-scale",
});

/** Converts rectangle multipliers into the shared snapping resolver's values. */
export function createRectangularScaleValues({
  mode,
  multipliers,
}: {
  mode: RectangularScaleGestureMode;
  multipliers: RectangularScaleMultipliers;
}): readonly number[] {
  if (mode === "horizontal") return Object.freeze([multipliers.x]);
  if (mode === "vertical") return Object.freeze([multipliers.y]);
  if (mode === "uniform") return Object.freeze([multipliers.x]);

  return Object.freeze([multipliers.x, multipliers.y]);
}

/** Returns rectangle multipliers from the shared snapping resolver's values. */
export function resolveRectangularScaleMultipliers({
  projectionMode,
  effectiveValues,
}: {
  projectionMode: string;
  effectiveValues: readonly number[];
}): RectangularScaleMultipliers {
  const [first, second] = effectiveValues;
  if (first === undefined || !Number.isFinite(first)) {
    throw new Error(
      "Rectangular scale values must contain a finite first multiplier",
    );
  }

  if (projectionMode === "horizontal") return Object.freeze({ x: first, y: 1 });
  if (projectionMode === "vertical") return Object.freeze({ x: 1, y: first });
  if (projectionMode === "uniform")
    return Object.freeze({ x: first, y: first });
  if (projectionMode === "free") {
    if (second !== undefined && Number.isFinite(second)) {
      return Object.freeze({ x: first, y: second });
    }

    throw new Error("Free rectangular scale requires two finite multipliers");
  }

  throw new Error(
    `Unsupported rectangular scale projection mode "${projectionMode}"`,
  );
}

/** Copies a point and freezes it. */
function createFrozenPoint({
  point,
}: {
  point: RectangularScalePoint;
}): RectangularScalePoint {
  return Object.freeze({
    x: point.x,
    y: point.y,
  });
}

/** Checks that both of the point's coordinates are finite numbers. */
function isFinitePoint({ point }: { point: RectangularScalePoint }): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

/** Converts one Fabric origin axis into a number between 0 and 1. */
function resolveOriginCoordinate({
  origin,
  startName,
  endName,
}: {
  origin: Transform["originX"] | Transform["originY"];
  startName: "left" | "top";
  endName: "right" | "bottom";
}): number | null {
  if (typeof origin === "number") {
    return Number.isFinite(origin) ? origin : null;
  }
  if (origin === startName) return 0;
  if (origin === "center") return 0.5;
  if (origin === endName) return 1;

  return null;
}

/** Returns the normalized point Fabric scales around. */
function resolveTransformOrigin({
  transform,
}: {
  transform: RectangularScaleGestureTransform;
}): RectangularScalePoint | null {
  const x = resolveOriginCoordinate({
    origin: transform.originX,
    startName: "left",
    endName: "right",
  });
  const y = resolveOriginCoordinate({
    origin: transform.originY,
    startName: "top",
    endName: "bottom",
  });

  if (x === null || y === null) return null;

  return Object.freeze({ x, y });
}

/** Checks that the key names a supported scale handle. */
function isRectangularScaleControlKey(
  corner: string,
): corner is RectangularScaleControlKey {
  return Object.prototype.hasOwnProperty.call(
    RECTANGULAR_SCALE_CONTROL_COORDINATES,
    corner,
  );
}

/** Checks that the Fabric action matches the chosen handle. */
function isMatchingScaleAction({
  action,
  controlKey,
}: {
  action: Transform["action"];
  controlKey: RectangularScaleControlKey;
}): boolean {
  if (controlKey === "ml" || controlKey === "mr") return action === "scaleX";
  if (controlKey === "mt" || controlKey === "mb") return action === "scaleY";

  return action === "scale";
}

/** Checks that the handle does not coincide with the anchor on the axes it moves. */
function hasValidControlLevers({
  controlKey,
  control,
  origin,
}: {
  controlKey: RectangularScaleControlKey;
  control: RectangularScalePoint;
  origin: RectangularScalePoint;
}): boolean {
  const leverX = Math.abs(control.x - origin.x);
  const leverY = Math.abs(control.y - origin.y);
  const requiresX = controlKey !== "mt" && controlKey !== "mb";
  const requiresY = controlKey !== "ml" && controlKey !== "mr";

  return (
    (!requiresX || leverX > RECTANGULAR_SCALE_PROJECTION_EPSILON) &&
    (!requiresY || leverY > RECTANGULAR_SCALE_PROJECTION_EPSILON)
  );
}

/** Reads the rectangle's four corners at the start of the gesture. */
function readRectangularScaleCorners({
  target,
}: {
  target: FabricObject;
}): RectangularScaleCorners | null {
  try {
    const sourceCorners = target.getCoords();
    if (sourceCorners.length !== 4) return null;
    if (
      !sourceCorners.every((point) => {
        return isFinitePoint({ point });
      })
    )
      return null;

    const [topLeft, topRight, bottomRight, bottomLeft] = sourceCorners;
    if (!topLeft || !topRight || !bottomRight || !bottomLeft) return null;

    return Object.freeze({
      topLeft: createFrozenPoint({ point: topLeft }),
      topRight: createFrozenPoint({ point: topRight }),
      bottomRight: createFrozenPoint({ point: bottomRight }),
      bottomLeft: createFrozenPoint({ point: bottomLeft }),
    });
  } catch {
    return null;
  }
}

/** Returns the vector between two canvas points. */
function subtractPoints({
  point,
  origin,
}: {
  point: RectangularScalePoint;
  origin: RectangularScalePoint;
}): RectangularScalePoint {
  return Object.freeze({
    x: point.x - origin.x,
    y: point.y - origin.y,
  });
}

/** Returns the determinant of the basis formed by u and v. */
function getBasisDeterminant({
  u,
  v,
}: {
  u: RectangularScalePoint;
  v: RectangularScalePoint;
}): number {
  return u.x * v.y - u.y * v.x;
}

/** Converts normalized rectangle coordinates into canvas coordinates. */
function projectBaselinePoint({
  topLeft,
  u,
  v,
  coordinates,
}: {
  topLeft: RectangularScalePoint;
  u: RectangularScalePoint;
  v: RectangularScalePoint;
  coordinates: RectangularScalePoint;
}): RectangularScalePoint {
  return Object.freeze({
    x: topLeft.x + coordinates.x * u.x + coordinates.y * v.x,
    y: topLeft.y + coordinates.x * u.y + coordinates.y * v.y,
  });
}

/** Returns the outer bounds of four rectangle corners. */
function createBoundsFromCorners({
  corners,
}: {
  corners: RectangularScaleCorners;
}): Readonly<ObjectBounds> {
  const points = [
    corners.topLeft,
    corners.topRight,
    corners.bottomRight,
    corners.bottomLeft,
  ];
  const xCoordinates = points.map(({ x }) => x);
  const yCoordinates = points.map(({ y }) => y);
  const left = Math.min(...xCoordinates);
  const right = Math.max(...xCoordinates);
  const top = Math.min(...yCoordinates);
  const bottom = Math.max(...yCoordinates);

  return Object.freeze({
    left,
    right,
    top,
    bottom,
    centerX: left + (right - left) / 2,
    centerY: top + (bottom - top) / 2,
  });
}

/** Validates Fabric's original scale values. */
function hasValidOriginalScales({
  original,
}: {
  original: RectangularScaleGestureTransform["original"];
}): boolean {
  return (
    Number.isFinite(original.scaleX) &&
    Number.isFinite(original.scaleY) &&
    original.scaleX > RECTANGULAR_SCALE_PROJECTION_EPSILON &&
    original.scaleY > RECTANGULAR_SCALE_PROJECTION_EPSILON
  );
}

/** Validates the input before the start geometry is calculated. */
function canCreateRectangularScaleProjection({
  transform,
  pointerStart,
  controlKey,
}: {
  transform: RectangularScaleGestureTransform;
  pointerStart: RectangularScalePoint;
  controlKey: RectangularScaleControlKey;
}): boolean {
  return (
    isMatchingScaleAction({ action: transform.action, controlKey }) &&
    hasValidOriginalScales({ original: transform.original }) &&
    isFinitePoint({ point: pointerStart })
  );
}

/**
 * Records the start geometry of a rectangular top-level scale gesture.
 * Returns null when the control or the affine state is unsupported.
 */
export function createRectangularScaleGestureProjection({
  transform,
  pointerStart,
}: {
  transform: RectangularScaleGestureTransform;
  pointerStart: RectangularScalePoint;
}): RectangularScaleGestureProjection | null {
  if (!isRectangularScaleControlKey(transform.corner)) return null;
  if (
    !canCreateRectangularScaleProjection({
      transform,
      pointerStart,
      controlKey: transform.corner,
    })
  )
    return null;

  const origin = resolveTransformOrigin({ transform });
  const control = RECTANGULAR_SCALE_CONTROL_COORDINATES[transform.corner];
  if (
    !origin ||
    !hasValidControlLevers({ controlKey: transform.corner, control, origin })
  )
    return null;

  const corners = readRectangularScaleCorners({ target: transform.target });
  if (!corners) return null;

  const u = subtractPoints({
    point: corners.topRight,
    origin: corners.topLeft,
  });
  const v = subtractPoints({
    point: corners.bottomLeft,
    origin: corners.topLeft,
  });
  if (
    Math.abs(getBasisDeterminant({ u, v })) <=
    RECTANGULAR_SCALE_PROJECTION_EPSILON
  )
    return null;

  return Object.freeze({
    controlKey: transform.corner,
    control: createFrozenPoint({ point: control }),
    origin,
    pointerStart: createFrozenPoint({ point: pointerStart }),
    fixedAnchor: projectBaselinePoint({
      topLeft: corners.topLeft,
      u,
      v,
      coordinates: origin,
    }),
    u,
    v,
    originalScales: Object.freeze({
      x: transform.original.scaleX,
      y: transform.original.scaleY,
    }),
    baselineBounds: createBoundsFromCorners({ corners }),
  });
}

/** Checks that the chosen handle supports the given scale mode. */
function isModeSupportedByControl({
  controlKey,
  mode,
}: {
  controlKey: RectangularScaleControlKey;
  mode: RectangularScaleGestureMode;
}): boolean {
  if (controlKey === "ml" || controlKey === "mr") return mode === "horizontal";
  if (controlKey === "mt" || controlKey === "mb") return mode === "vertical";

  return mode === "free" || mode === "uniform";
}

/** Converts the pointer displacement into the baseline rectangle's local axes. */
function resolvePointerBasisDelta({
  projection,
  pointer,
}: {
  projection: RectangularScaleGestureProjection;
  pointer: RectangularScalePoint;
}): RectangularScalePoint | null {
  if (!isFinitePoint({ point: pointer })) return null;

  const deltaX = pointer.x - projection.pointerStart.x;
  const deltaY = pointer.y - projection.pointerStart.y;
  const determinant = getBasisDeterminant({
    u: projection.u,
    v: projection.v,
  });
  if (Math.abs(determinant) <= RECTANGULAR_SCALE_PROJECTION_EPSILON)
    return null;

  return Object.freeze({
    x: (deltaX * projection.v.y - deltaY * projection.v.x) / determinant,
    y: (projection.u.x * deltaY - projection.u.y * deltaX) / determinant,
  });
}

/** Calculates the independent width and height multipliers. */
function resolveFreeMultipliers({
  projection,
  pointerDelta,
}: {
  projection: RectangularScaleGestureProjection;
  pointerDelta: RectangularScalePoint;
}): RectangularScaleMultipliers {
  const leverX = projection.control.x - projection.origin.x;
  const leverY = projection.control.y - projection.origin.y;

  return Object.freeze({
    x:
      Math.abs(leverX) > RECTANGULAR_SCALE_PROJECTION_EPSILON
        ? (leverX + pointerDelta.x) / leverX
        : 1,
    y:
      Math.abs(leverY) > RECTANGULAR_SCALE_PROJECTION_EPSILON
        ? (leverY + pointerDelta.y) / leverY
        : 1,
  });
}

/** Returns the length of a baseline-geometry vector. */
function getVectorLength({
  vector,
}: {
  vector: RectangularScalePoint;
}): number {
  return Math.sqrt(vector.x ** 2 + vector.y ** 2);
}

/** Calculates the proportional scale multiplier the way Fabric does. */
function resolveUniformMultiplier({
  projection,
  pointerDelta,
}: {
  projection: RectangularScaleGestureProjection;
  pointerDelta: RectangularScalePoint;
}): number | null {
  const leverX = projection.control.x - projection.origin.x;
  const leverY = projection.control.y - projection.origin.y;
  const currentLeverX = leverX + pointerDelta.x;
  const currentLeverY = leverY + pointerDelta.y;
  if (leverX * currentLeverX < 0 || leverY * currentLeverY < 0) return null;

  const uLength = getVectorLength({ vector: projection.u });
  const vLength = getVectorLength({ vector: projection.v });
  const baselineDistance =
    Math.abs(leverX) * uLength + Math.abs(leverY) * vLength;
  if (baselineDistance <= RECTANGULAR_SCALE_PROJECTION_EPSILON) return null;

  const currentDistance =
    Math.abs(currentLeverX) * uLength + Math.abs(currentLeverY) * vLength;

  return currentDistance / baselineDistance;
}

/**
 * Returns the scale multipliers from the pointer's displacement since the gesture started.
 * The calculation does not depend on the object's current geometry.
 */
export function resolveRectangularScalePointerMultipliers({
  projection,
  pointer,
  mode,
}: {
  projection: RectangularScaleGestureProjection;
  pointer: RectangularScalePoint;
  mode: RectangularScaleGestureMode;
}): RectangularScaleMultipliers | null {
  if (!isModeSupportedByControl({ controlKey: projection.controlKey, mode }))
    return null;

  const pointerDelta = resolvePointerBasisDelta({ projection, pointer });
  if (!pointerDelta) return null;

  if (mode === "uniform") {
    const multiplier = resolveUniformMultiplier({ projection, pointerDelta });
    if (multiplier === null) return null;

    return Object.freeze({ x: multiplier, y: multiplier });
  }

  const freeMultipliers = resolveFreeMultipliers({ projection, pointerDelta });
  if (mode === "horizontal")
    return Object.freeze({ x: freeMultipliers.x, y: 1 });
  if (mode === "vertical") return Object.freeze({ x: 1, y: freeMultipliers.y });

  return freeMultipliers;
}

/** Calculates one corner's position after scaling around the fixed anchor. */
function projectScaledPoint({
  projection,
  multipliers,
  coordinates,
}: {
  projection: RectangularScaleGestureProjection;
  multipliers: RectangularScaleMultipliers;
  coordinates: RectangularScalePoint;
}): RectangularScalePoint {
  const localX = coordinates.x - projection.origin.x;
  const localY = coordinates.y - projection.origin.y;

  return Object.freeze({
    x:
      projection.fixedAnchor.x +
      localX * multipliers.x * projection.u.x +
      localY * multipliers.y * projection.v.x,
    y:
      projection.fixedAnchor.y +
      localX * multipliers.x * projection.u.y +
      localY * multipliers.y * projection.v.y,
  });
}

/** Returns the outer bounds of the calculated corner coordinates. */
function createProjectedBounds({
  topLeft,
  topRight,
  bottomRight,
  bottomLeft,
}: RectangularScaleCorners): Readonly<ObjectBounds> {
  return createBoundsFromCorners({
    corners: Object.freeze({ topLeft, topRight, bottomRight, bottomLeft }),
  });
}

/**
 * Calculates the bounds for the given multipliers without touching the object.
 */
export function projectRectangularScaleBounds({
  projection,
  multipliers,
}: {
  projection: RectangularScaleGestureProjection;
  multipliers: RectangularScaleMultipliers;
}): Readonly<ObjectBounds> | null {
  if (!Number.isFinite(multipliers.x) || !Number.isFinite(multipliers.y))
    return null;

  const topLeft = RECTANGULAR_SCALE_CONTROL_COORDINATES.tl;
  const topRight = RECTANGULAR_SCALE_CONTROL_COORDINATES.tr;
  const bottomRight = RECTANGULAR_SCALE_CONTROL_COORDINATES.br;
  const bottomLeft = RECTANGULAR_SCALE_CONTROL_COORDINATES.bl;

  return createProjectedBounds({
    topLeft: projectScaledPoint({
      projection,
      multipliers,
      coordinates: topLeft,
    }),
    topRight: projectScaledPoint({
      projection,
      multipliers,
      coordinates: topRight,
    }),
    bottomRight: projectScaledPoint({
      projection,
      multipliers,
      coordinates: bottomRight,
    }),
    bottomLeft: projectScaledPoint({
      projection,
      multipliers,
      coordinates: bottomLeft,
    }),
  });
}

/** Returns the baseline position of the given edge. */
function getBaselineEdgePosition({
  bounds,
  edge,
}: {
  bounds: Readonly<ObjectBounds>;
  edge: RectangularScaleSceneEdge;
}): number {
  if (edge === "left") return bounds.left;
  if (edge === "right") return bounds.right;
  if (edge === "top") return bounds.top;

  return bounds.bottom;
}

/** Picks the corner's local coordinate that forms the outer edge. */
function resolveExtremumCoordinate({
  component,
  extremum,
}: {
  component: number;
  extremum: RectangularScaleEdgeExtremum;
}): number {
  if (extremum === "minimum") return component >= 0 ? 0 : 1;

  return component >= 0 ? 1 : 0;
}

/** Calculates the width and height contributions to one edge's position. */
function createEdgeCoefficients({
  projection,
  descriptor,
}: {
  projection: RectangularScaleGestureProjection;
  descriptor: RectangularScaleEdgeDescriptor;
}): RectangularScaleEdgeCoefficients {
  const uComponent = descriptor.axis === "x" ? projection.u.x : projection.u.y;
  const vComponent = descriptor.axis === "x" ? projection.v.x : projection.v.y;
  const localX = resolveExtremumCoordinate({
    component: uComponent,
    extremum: descriptor.extremum,
  });
  const localY = resolveExtremumCoordinate({
    component: vComponent,
    extremum: descriptor.extremum,
  });

  return Object.freeze({
    axis: descriptor.axis,
    edge: descriptor.edge,
    baselinePosition: getBaselineEdgePosition({
      bounds: projection.baselineBounds,
      edge: descriptor.edge,
    }),
    multiplierX: (localX - projection.origin.x) * uComponent,
    multiplierY: (localY - projection.origin.y) * vComponent,
  });
}

/** Returns the scale variables of the chosen mode. */
function getModeVariables({
  mode,
}: {
  mode: RectangularScaleGestureMode;
}): readonly RectangularScaleProjectionVariable[] {
  if (mode === "horizontal") return HORIZONTAL_PROJECTION_VARIABLES;
  if (mode === "vertical") return VERTICAL_PROJECTION_VARIABLES;
  if (mode === "free") return FREE_PROJECTION_VARIABLES;

  return UNIFORM_PROJECTION_VARIABLES;
}

/** Picks the edge coefficients the chosen scale mode needs. */
function resolveModeCoefficients({
  edge,
  mode,
}: {
  edge: RectangularScaleEdgeCoefficients;
  mode: RectangularScaleGestureMode;
}): readonly number[] {
  if (mode === "horizontal") return Object.freeze([edge.multiplierX]);
  if (mode === "vertical") return Object.freeze([edge.multiplierY]);
  if (mode === "free")
    return Object.freeze([edge.multiplierX, edge.multiplierY]);

  return Object.freeze([edge.multiplierX + edge.multiplierY]);
}

/** Checks that the chosen mode really moves the edge. */
function hasActiveModeCoefficient({
  coefficients,
}: {
  coefficients: readonly number[];
}): boolean {
  return coefficients.some(
    (coefficient) =>
      Math.abs(coefficient) > RECTANGULAR_SCALE_PROJECTION_EPSILON,
  );
}

/** Returns the moving edge's projection, or null for a fixed one. */
function createModeEdgeProjection({
  edge,
  mode,
}: {
  edge: RectangularScaleEdgeCoefficients;
  mode: RectangularScaleGestureMode;
}): RectangularScaleEdgeProjection | null {
  const coefficients = resolveModeCoefficients({ edge, mode });
  if (!hasActiveModeCoefficient({ coefficients })) return null;

  return Object.freeze({
    axis: edge.axis,
    edge: edge.edge,
    baselinePosition: edge.baselinePosition,
    coefficients,
  });
}

/**
 * Returns the moving edges of the chosen scale mode.
 * An edge's position is measured from its baseline to where the fixed point intersects.
 */
export function resolveRectangularScaleModeProjection({
  projection,
  mode,
}: {
  projection: RectangularScaleGestureProjection;
  mode: RectangularScaleGestureMode;
}): RectangularScaleModeProjection | null {
  if (!isModeSupportedByControl({ controlKey: projection.controlKey, mode }))
    return null;

  const edges = RECTANGULAR_SCALE_EDGE_DESCRIPTORS.map((descriptor) =>
    createEdgeCoefficients({ projection, descriptor }),
  )
    .map((edge) => createModeEdgeProjection({ edge, mode }))
    .filter((edge): edge is RectangularScaleEdgeProjection => edge !== null);
  const variables = getModeVariables({ mode });

  return Object.freeze({
    mode,
    variables,
    baselineValues: Object.freeze(variables.map(() => 1)),
    edges: Object.freeze(edges),
  });
}

/** Returns each scale variable's contribution to moving the active handle. */
function resolveScaleVariableWeights({
  projection,
  mode,
}: {
  projection: RectangularScaleGestureProjection;
  mode: RectangularScaleGestureMode;
}): readonly number[] {
  const leverX = projection.control.x - projection.origin.x;
  const leverY = projection.control.y - projection.origin.y;
  const xWeight = Math.abs(leverX) * getVectorLength({ vector: projection.u });
  const yWeight = Math.abs(leverY) * getVectorLength({ vector: projection.v });

  if (mode === "horizontal") return Object.freeze([xWeight]);
  if (mode === "vertical") return Object.freeze([yWeight]);
  if (mode === "free") return Object.freeze([xWeight, yWeight]);

  const uniformVector = {
    x: leverX * projection.u.x + leverY * projection.v.x,
    y: leverX * projection.u.y + leverY * projection.v.y,
  };

  return Object.freeze([getVectorLength({ vector: uniformVector })]);
}

/** Converts the rectangular model into the shared scale resolver's format. */
function createScaleProjectionModeInput({
  projection,
  modeProjection,
}: {
  projection: RectangularScaleGestureProjection;
  modeProjection: RectangularScaleModeProjection;
}): ScaleProjectionModeInput {
  const variables = modeProjection.variables.map((variable) => {
    return SNAP_VARIABLE_BY_RECTANGULAR_VARIABLE[variable];
  });

  return Object.freeze({
    id: modeProjection.mode,
    projection: Object.freeze({
      variables: Object.freeze(variables),
      baselineValues: Object.freeze([...modeProjection.baselineValues]),
      variableSceneWeights: resolveScaleVariableWeights({
        projection,
        mode: modeProjection.mode,
      }),
      edges: Object.freeze(
        modeProjection.edges.map(({ edge, coefficients }) => {
          return Object.freeze({
            edge,
            coefficients: Object.freeze([...coefficients]),
          });
        }),
      ),
    }),
  });
}

/** Returns the scale modes available to the chosen rectangular handle. */
export function createRectangularScaleProjectionModes({
  projection,
}: {
  projection: RectangularScaleGestureProjection;
}): readonly ScaleProjectionModeInput[] {
  let modes: readonly RectangularScaleGestureMode[] = ["free", "uniform"];

  if (projection.controlKey === "ml" || projection.controlKey === "mr") {
    modes = ["horizontal"];
  }
  if (projection.controlKey === "mt" || projection.controlKey === "mb") {
    modes = ["vertical"];
  }

  return Object.freeze(
    modes.map((mode) => {
      const modeProjection = resolveRectangularScaleModeProjection({
        projection,
        mode,
      });
      if (!modeProjection) {
        throw new Error(
          `Rectangular scale projection is missing supported mode "${mode}"`,
        );
      }

      return createScaleProjectionModeInput({ projection, modeProjection });
    }),
  );
}

/** Returns every scene edge the chosen handle can move. */
export function resolveRectangularScaleMovingEdges({
  projectionModes,
}: {
  projectionModes: readonly ScaleProjectionModeInput[];
}): readonly ScaleSceneEdge[] {
  const edges = new Set<ScaleSceneEdge>();

  for (const { projection } of projectionModes) {
    for (const edge of projection.edges) edges.add(edge.edge);
  }
  if (edges.size === 0) {
    throw new Error(
      "Rectangular scale gesture must contain at least one moving edge",
    );
  }

  return Object.freeze([...edges]);
}
