// Ported: fork 9efdd78a src/editor/text-manager/scaling/text-width-resize-interaction-controller.ts
// (fork coupling stripped — plain `fabric/es` Textbox; guides are returned, not published)
import { Point, Textbox } from "fabric/es";
import type { Canvas, TPointerEvent, Transform } from "fabric/es";

import { getObjectExactBounds, type ObjectBounds } from "../bounds.js";
import {
  collectSnapSources,
  readMovementMarker,
  readMovementModifiers,
} from "../index.js";
import type { GuideLine } from "../types.js";
import { createScaleSnapCandidates } from "./scale-snap-candidates.js";
import { ScaleSnappingRuntime } from "./scale-snapping-runtime.js";
import {
  createScaleGestureBaseline,
  type FinalScaleGeometry,
  type ScaleSnapPlan,
  type VerifiedScaleGuide,
} from "./scale-snapping-resolver.js";
import {
  applyTextboxWidth,
  createTextWidthResizeMeasurer,
  type TextWidthResizeMeasurer,
} from "./text-width-resize-measurer.js";
import {
  createTextWidthResizeGestureProjection,
  createTextWidthResizeStepProjection,
  TEXT_WIDTH_PROJECTION_MODE,
  type TextWidthResizeGestureProjection,
} from "./text-width-resize-projection.js";
import { resolveTextWidthSnapMeasurement } from "./text-width-resize-step.js";

/** The Fabric payload a side-handle width change carries. */
export type TextWidthResizeEvent = Readonly<{
  e?: TPointerEvent | null;
  transform?: Transform | null;
}>;

export interface TextWidthResizeController {
  /** Captures the gesture at `mouse:down`, before Fabric changes the width. */
  startGesture(event: TextWidthResizeEvent | undefined): void;
  /** Handles one `object:resizing` step and returns the guides it verified. */
  runStep(event: TextWidthResizeEvent | undefined): readonly GuideLine[];
  /** Ends the session; safe to call when none is active. */
  finishGesture(): void;
}

/** Properties a width change must leave alone. */
type TextWidthProtectedState = Readonly<{
  angle: number;
  controlKey: string;
  flipX: boolean;
  flipY: boolean;
  fontSize: number;
  minWidth: number;
  originX: Transform["originX"];
  originY: Transform["originY"];
  scaleX: number;
  scaleY: number;
  skewX: number;
  skewY: number;
}>;

/** One active width change. */
type ActiveTextWidthGesture = Readonly<{
  measurer: TextWidthResizeMeasurer;
  projection: TextWidthResizeGestureProjection;
  protectedState: TextWidthProtectedState;
  runtime: ScaleSnappingRuntime;
  textbox: Textbox;
  transform: Transform;
}>;

/** Tolerance when checking text properties and the fixed anchor. */
const TEXT_WIDTH_RESIZE_STATE_EPSILON = 0.000000001;

/** The plan and width to apply once line wrapping has been accounted for. */
type ResolvedTextWidthStep = Readonly<{
  plan: ScaleSnapPlan;
  width: number;
}>;

/** The Textbox this gesture resizes, if the transform is a width change. */
function resolveGestureTextbox({
  event,
}: {
  event: TextWidthResizeEvent;
}): Textbox | null {
  const target = event.transform?.target;
  if (!(target instanceof Textbox)) return null;

  return target;
}

/** Remembers the values a width change must not touch. */
function captureProtectedState({
  textbox,
  transform,
}: {
  textbox: Textbox;
  transform: Transform;
}): TextWidthProtectedState {
  return Object.freeze({
    angle: textbox.angle ?? 0,
    controlKey: transform.corner,
    flipX: Boolean(textbox.flipX),
    flipY: Boolean(textbox.flipY),
    fontSize: textbox.fontSize,
    minWidth: textbox.minWidth,
    originX: transform.originX,
    originY: transform.originY,
    scaleX: textbox.scaleX,
    scaleY: textbox.scaleY,
    skewX: textbox.skewX ?? 0,
    skewY: textbox.skewY ?? 0,
  });
}

/** Whether the object and transform still describe the gesture that started. */
function isSameGesture({
  gesture,
}: {
  gesture: ActiveTextWidthGesture;
}): boolean {
  const { protectedState, textbox, transform } = gesture;

  return (
    transform.target === textbox &&
    transform.corner === protectedState.controlKey &&
    transform.originX === protectedState.originX &&
    transform.originY === protectedState.originY &&
    Math.abs((textbox.angle ?? 0) - protectedState.angle) <=
      TEXT_WIDTH_RESIZE_STATE_EPSILON &&
    Math.abs(textbox.scaleX - protectedState.scaleX) <=
      TEXT_WIDTH_RESIZE_STATE_EPSILON &&
    Math.abs(textbox.scaleY - protectedState.scaleY) <=
      TEXT_WIDTH_RESIZE_STATE_EPSILON
  );
}

/** Whether every property a width change must not touch still matches. */
function isProtectedStatePreserved({
  gesture,
}: {
  gesture: ActiveTextWidthGesture;
}): boolean {
  const { protectedState, textbox } = gesture;
  const current = [
    textbox.angle ?? 0,
    textbox.fontSize,
    textbox.minWidth,
    textbox.scaleX,
    textbox.scaleY,
    textbox.skewX ?? 0,
    textbox.skewY ?? 0,
  ];
  const initial = [
    protectedState.angle,
    protectedState.fontSize,
    protectedState.minWidth,
    protectedState.scaleX,
    protectedState.scaleY,
    protectedState.skewX,
    protectedState.skewY,
  ];

  return (
    current.every(
      (value, index) =>
        Math.abs(value - (initial[index] ?? 0)) <=
        TEXT_WIDTH_RESIZE_STATE_EPSILON,
    ) &&
    Boolean(textbox.flipX) === protectedState.flipX &&
    Boolean(textbox.flipY) === protectedState.flipY
  );
}

/** Applies the width and restores the anchor Fabric held. */
function applyTextWidth({
  gesture,
  width,
}: {
  gesture: ActiveTextWidthGesture;
  width: number;
}): void {
  const { projection, textbox, transform } = gesture;

  applyTextboxWidth({ textbox, width });
  textbox.setPositionByOrigin(
    new Point(projection.fixedAnchor.x, projection.fixedAnchor.y),
    transform.originX,
    transform.originY,
  );
  textbox.setCoords();
}

/** Whether one axis reached the guide the plan chose. */
function didReachGuide({
  bounds,
  constraint,
  epsilon,
}: {
  bounds: ObjectBounds;
  constraint: ScaleSnapPlan["constraints"]["x"];
  epsilon: number;
}): boolean {
  if (!constraint) return true;

  return (
    Math.abs(bounds[constraint.candidate.edge] - constraint.expectedPosition) <=
    epsilon
  );
}

/** Reads the geometry the live object actually took, not the plan's. */
function readFinalTextGeometry({
  gesture,
  plan,
  width,
}: {
  gesture: ActiveTextWidthGesture;
  plan: ScaleSnapPlan;
  width: number;
}): FinalScaleGeometry {
  const { textbox, transform } = gesture;
  const bounds = getObjectExactBounds({ object: textbox });
  if (!bounds) {
    throw new Error("A text width change needs exact final bounds");
  }

  const anchor = textbox.getPointByOrigin(transform.originX, transform.originY);
  const protectedState = isProtectedStatePreserved({ gesture })
    ? "preserved"
    : "changed";

  return Object.freeze({
    bounds,
    fixedAnchor: Object.freeze({ x: anchor.x, y: anchor.y }),
    measuredValues: Object.freeze([width]),
    domainVerdict: Object.freeze({
      x: didReachGuide({
        bounds,
        constraint: plan.constraints.x,
        epsilon: plan.verificationEpsilon,
      })
        ? "satisfied"
        : "blocked",
      y: didReachGuide({
        bounds,
        constraint: plan.constraints.y,
        epsilon: plan.verificationEpsilon,
      })
        ? "satisfied"
        : "blocked",
      protectedState,
    }),
  });
}

/** Converts verified scale guides into the renderer's guide lines. */
function createGuideLines({
  guides,
}: {
  guides: readonly VerifiedScaleGuide[];
}): GuideLine[] {
  return guides.map(({ axis, position }) => ({
    type: axis === "x" ? "vertical" : "horizontal",
    position,
  }));
}

/**
 * Owns snapping for one Textbox resized by `ml`/`mr`. Fabric gives a text box
 * `changeWidth` side controls instead of the `scaleX` ones a shape gets, so
 * this gesture arrives as `object:resizing` with a canonical `width` rather
 * than as a scale — and never reaches the scale path's `object:scaling` binding.
 */
export function createTextWidthResizeController({
  bounds,
  canvas,
}: {
  canvas: Canvas;
  bounds: () => ObjectBounds;
}): TextWidthResizeController {
  let gesture: ActiveTextWidthGesture | undefined;

  const finishGesture = (): void => {
    gesture?.runtime.finishSession();
    gesture?.measurer.dispose();
    gesture = undefined;
  };

  const startGesture = (event: TextWidthResizeEvent | undefined): void => {
    finishGesture();
    if (!event) return;

    const textbox = resolveGestureTextbox({ event });
    const { transform } = event;
    if (!textbox || !transform) return;

    textbox.setCoords();
    const projection = createTextWidthResizeGestureProjection({
      textbox,
      transform,
    });
    if (!projection) return;

    const runtime = new ScaleSnappingRuntime();
    runtime.startSession({
      baseline: createScaleGestureBaseline({
        bounds: projection.baselineBounds,
        fixedAnchor: projection.fixedAnchor,
        projectionModes: projection.projectionModes,
        candidates: createScaleSnapCandidates({
          targetEdges: projection.movingEdges,
          sources: collectSnapSources({
            canvas,
            bounds,
            activeObject: textbox,
          }),
        }),
        zoom: canvas.getZoom() || 1,
      }),
    });

    gesture = Object.freeze({
      measurer: createTextWidthResizeMeasurer({
        target: textbox,
        gesture: projection,
      }),
      projection,
      protectedState: captureProtectedState({ textbox, transform }),
      runtime,
      textbox,
      transform,
    });
  };

  const runStep = (
    event: TextWidthResizeEvent | undefined,
  ): readonly GuideLine[] => {
    if (!event) return [];
    const active = gesture;
    if (!active || event.transform === undefined || event.transform === null)
      return [];

    if (!isSameGesture({ gesture: active })) {
      finishGesture();
      return [];
    }
    if (!isProtectedStatePreserved({ gesture: active })) {
      finishGesture();
      return [];
    }

    const marker = readMovementMarker({ event });
    const duplicate = active.runtime.getDuplicateStep({ marker });
    if (duplicate)
      return createGuideLines({ guides: duplicate.verification?.guides ?? [] });

    if (!event.e) return [];

    // Fabric applies the width before `object:resizing` fires, so the live width
    // is the raw pointer value — the same `fabric-preview` contract the scale
    // path uses. The step projection re-reads exact bounds because the re-wrap
    // moved the vertical edges too.
    const stepProjection = createTextWidthResizeStepProjection({
      textbox: active.textbox,
      gesture: active.projection,
    });
    const step = active.runtime.resolveScalePlan({
      marker,
      ...(stepProjection ? { stepProjection } : {}),
      intent: Object.freeze({
        projectionMode: TEXT_WIDTH_PROJECTION_MODE,
        values: Object.freeze([active.textbox.width]),
        modifiers: readMovementModifiers({ event }),
      }),
    });
    if (step.kind === "duplicate") return [];

    const resolved = resolveTextWidthStep({ gesture: active, step });
    applyTextWidth({ gesture: active, width: resolved.width });
    const verification = active.runtime.verifyScalePlan({
      token: step.token,
      finalGeometry: readFinalTextGeometry({
        gesture: active,
        plan: resolved.plan,
        width: resolved.width,
      }),
    });
    canvas.requestRenderAll();

    return createGuideLines({ guides: verification.guides });
  };

  /**
   * Refines the chosen guides against real line wrapping. Width to height is a
   * step function of where the words break, so the linear model alone can miss
   * a vertical guide the author is clearly aiming at.
   */
  const resolveTextWidthStep = ({
    gesture: active,
    step,
  }: {
    gesture: ActiveTextWidthGesture;
    step: Extract<
      ReturnType<ScaleSnappingRuntime["resolveScalePlan"]>,
      { kind: "planned" }
    >;
  }): ResolvedTextWidthStep => {
    const pointerWidth = active.textbox.width;
    const { plan } = step;
    if (!plan.constraints.x && !plan.constraints.y) {
      return Object.freeze({ plan, width: pointerWidth });
    }

    const measurement = resolveTextWidthSnapMeasurement({
      measurer: active.measurer,
      plan,
    });
    if (!measurement) return Object.freeze({ plan, width: pointerWidth });

    const refinedPlan = active.runtime.refineScalePlan({
      token: step.token,
      refinement: Object.freeze({
        constraints: plan.constraints,
        effectiveValues: Object.freeze([measurement.width]),
        stepProjection: measurement.projection,
      }),
    });

    return Object.freeze({ plan: refinedPlan, width: measurement.width });
  };

  return Object.freeze({ startGesture, runStep, finishGesture });
}
