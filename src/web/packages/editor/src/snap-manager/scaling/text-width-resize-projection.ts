// Ported: fork 9efdd78a src/editor/text-manager/scaling/text-width-resize-projection.ts
// (fork coupling stripped — plain `fabric/es` Textbox, no EditorTextbox/BackgroundTextbox)
import type { Textbox, Transform } from "fabric/es";

import { getObjectExactBounds, type ObjectBounds } from "../bounds.js";
import type { ScaleSceneEdge } from "./scale-projection.js";
import type {
  ScaleProjectionModeInput,
  ScaleStepProjectionInput,
} from "./scale-snapping-resolver.js";

/** The side handle Fabric resizes a Textbox's canonical width with. */
export type TextWidthResizeControlKey = "ml" | "mr";

/** A point in scene coordinates, independent of Fabric Point. */
export type TextWidthResizeScenePoint = Readonly<{
  x: number;
  y: number;
}>;

/** The immutable geometry of one Textbox width change by a side handle. */
export type TextWidthResizeGestureProjection = Readonly<{
  anchorOriginX: Transform["originX"];
  anchorOriginY: Transform["originY"];
  baselineBounds: ObjectBounds;
  baselineWidth: number;
  controlKey: TextWidthResizeControlKey;
  fixedAnchor: TextWidthResizeScenePoint;
  movingEdges: readonly ScaleSceneEdge[];
  projectionModes: readonly ScaleProjectionModeInput[];
}>;

/** Below this a width coefficient is not a scene displacement worth snapping. */
const TEXT_WIDTH_PROJECTION_EPSILON = 0.000000001;

/** The one-dimensional projection mode a width change uses. */
export const TEXT_WIDTH_PROJECTION_MODE = "text-width";

/** Whether Fabric's transform is a side-handle width change of a Textbox. */
function isTextWidthResizeControl(
  transform: Transform,
): transform is Transform & { corner: TextWidthResizeControlKey } {
  return (
    transform.action === "resizing" &&
    (transform.corner === "ml" || transform.corner === "mr")
  );
}

/** Checks both spellings Fabric uses for a centred origin. */
function isCenterOrigin(
  origin: Transform["originX"] | Transform["originY"],
): boolean {
  return origin === "center" || origin === 0.5;
}

/** Checks both spellings Fabric uses for a side origin. */
function isSideOrigin({
  origin,
  expected,
}: {
  origin: Transform["originX"];
  expected: "left" | "right";
}): boolean {
  if (origin === expected) return true;

  return expected === "left" ? origin === 0 : origin === 1;
}

/**
 * Text geometry the width scene vector cannot describe. A flip or a skew turns
 * the linear model into an affine one the shared projection cannot express, and
 * `path`-bound text wraps along a curve rather than a box.
 */
function hasUnsupportedTextGeometry({
  textbox,
}: {
  textbox: Textbox;
}): boolean {
  return (
    Boolean(textbox.flipX) ||
    Boolean(textbox.flipY) ||
    Boolean(textbox.path) ||
    Math.abs(textbox.skewX ?? 0) > TEXT_WIDTH_PROJECTION_EPSILON ||
    Math.abs(textbox.skewY ?? 0) > TEXT_WIDTH_PROJECTION_EPSILON
  );
}

/**
 * The scene-space shift of the moving side per unit of canonical width. Fabric
 * scales a Textbox's width by its own X basis, so the matrix column is the
 * projection's coefficient; rotation is already carried by it.
 */
function resolveWidthSceneVector({
  textbox,
  controlKey,
  centered,
}: {
  textbox: Textbox;
  controlKey: TextWidthResizeControlKey;
  centered: boolean;
}): TextWidthResizeScenePoint | null {
  const [matrixX, matrixY] = textbox.calcTransformMatrix();
  const direction = centered || controlKey === "mr" ? 1 : -1;
  const x = matrixX * direction;
  const y = matrixY * direction;

  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (Math.hypot(x, y) <= TEXT_WIDTH_PROJECTION_EPSILON) return null;

  return Object.freeze({ x, y });
}

/** One scene edge and how far it travels per unit of canonical width. */
type MovingEdge = Readonly<{
  edge: ScaleSceneEdge;
  coefficients: readonly number[];
}>;

/**
 * A centred resize moves both sides apart, so each carries half the width's
 * displacement. A side resize moves one edge by all of it.
 */
function createMovingEdges({
  centered,
  widthVector,
}: {
  centered: boolean;
  widthVector: TextWidthResizeScenePoint;
}): readonly MovingEdge[] {
  if (centered) {
    return Object.freeze(
      (
        [
          { edge: "left", coefficient: -widthVector.x / 2 },
          { edge: "right", coefficient: widthVector.x / 2 },
          { edge: "top", coefficient: -widthVector.y / 2 },
          { edge: "bottom", coefficient: widthVector.y / 2 },
        ] as const
      )
        .filter(
          ({ coefficient }) =>
            Math.abs(coefficient) > TEXT_WIDTH_PROJECTION_EPSILON,
        )
        .map(({ edge, coefficient }) =>
          Object.freeze({ edge, coefficients: Object.freeze([coefficient]) }),
        ),
    );
  }

  const edges: (MovingEdge | null)[] = [
    createMovingEdge({ axis: "x", coefficient: widthVector.x }),
    createMovingEdge({ axis: "y", coefficient: widthVector.y }),
  ];

  return Object.freeze(
    edges.filter((edge): edge is MovingEdge => edge !== null),
  );
}

/** The one edge on a scene axis that a width change moves. */
function createMovingEdge({
  axis,
  coefficient,
}: {
  axis: "x" | "y";
  coefficient: number;
}): MovingEdge | null {
  if (Math.abs(coefficient) <= TEXT_WIDTH_PROJECTION_EPSILON) return null;

  const edge: ScaleSceneEdge =
    axis === "x"
      ? coefficient > 0
        ? "right"
        : "left"
      : coefficient > 0
        ? "bottom"
        : "top";

  return Object.freeze({ edge, coefficients: Object.freeze([coefficient]) });
}

/** Wraps the moving edges as the gesture's single one-dimensional mode. */
function createProjectionModes({
  baselineWidth,
  centered,
  widthVector,
}: {
  baselineWidth: number;
  centered: boolean;
  widthVector: TextWidthResizeScenePoint;
}): readonly ScaleProjectionModeInput[] {
  const edges = createMovingEdges({ centered, widthVector });
  const sceneWeight =
    Math.hypot(widthVector.x, widthVector.y) * (centered ? 0.5 : 1);

  return Object.freeze([
    Object.freeze({
      id: TEXT_WIDTH_PROJECTION_MODE,
      projection: Object.freeze({
        variables: Object.freeze(["text-width"] as const),
        baselineValues: Object.freeze([baselineWidth]),
        variableSceneWeights: Object.freeze([sceneWeight]),
        edges: Object.freeze(edges),
      }),
    }),
  ]);
}

/**
 * Captures the exact geometry before the first width change of a Textbox.
 * Returns null when the control or the text geometry is unsupported.
 */
export function createTextWidthResizeGestureProjection({
  textbox,
  transform,
}: {
  textbox: Textbox;
  transform: Transform;
}): TextWidthResizeGestureProjection | null {
  if (!isTextWidthResizeControl(transform)) return null;
  if (transform.target !== textbox || textbox.group !== undefined) return null;
  if (hasUnsupportedTextGeometry({ textbox })) return null;

  // Fabric anchors the opposite side so the dragged edge follows the pointer.
  // Anything else means the side handle is not the gesture this projects.
  const expectedOriginX = transform.corner === "mr" ? "left" : "right";
  const centered = isCenterOrigin(transform.originX);
  if (
    !centered &&
    !isSideOrigin({ origin: transform.originX, expected: expectedOriginX })
  )
    return null;
  if (!isCenterOrigin(transform.originY)) return null;

  const baselineWidth = textbox.width;
  if (!Number.isFinite(baselineWidth) || baselineWidth <= 0) return null;

  const baselineBounds = getObjectExactBounds({ object: textbox });
  const widthVector = resolveWidthSceneVector({
    textbox,
    controlKey: transform.corner,
    centered,
  });
  if (!baselineBounds || !widthVector) return null;

  const anchor = textbox.getPointByOrigin(transform.originX, transform.originY);
  if (!Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) return null;

  const projectionModes = createProjectionModes({
    baselineWidth,
    centered,
    widthVector,
  });
  const [projectionMode] = projectionModes;
  if (!projectionMode) return null;

  return Object.freeze({
    anchorOriginX: transform.originX,
    anchorOriginY: transform.originY,
    baselineBounds,
    baselineWidth,
    controlKey: transform.corner,
    fixedAnchor: Object.freeze({ x: anchor.x, y: anchor.y }),
    movingEdges: Object.freeze(
      projectionMode.projection.edges.map(({ edge }) => edge),
    ),
    projectionModes,
  });
}

/**
 * Rebuilds the local projection from the geometry at the current width, so a
 * re-wrap that changed the height does not distort guide search or hold.
 */
export function createTextWidthResizeStepProjection({
  textbox,
  gesture,
}: {
  textbox: Textbox;
  gesture: TextWidthResizeGestureProjection;
}): ScaleStepProjectionInput | null {
  const bounds = getObjectExactBounds({ object: textbox });
  const { width } = textbox;
  const [projectionMode] = gesture.projectionModes;
  if (!bounds || !projectionMode || !Number.isFinite(width) || width <= 0)
    return null;

  return Object.freeze({
    bounds: Object.freeze({ ...bounds }),
    projection: Object.freeze({
      ...projectionMode.projection,
      baselineValues: Object.freeze([width]),
    }),
  });
}
