import { describe, expect, it } from "vitest";
import type { ObjectBounds } from "../bounds.js";
import type { ScaleSceneEdge } from "./scale-projection.js";
import {
  FREE_SCALE_HOLD_STATE,
  type FinalScaleGeometry,
  type ScaleGestureBaseline,
  type ScaleRawIntent,
  type ScaleScenePoint,
  type ScaleSnapCandidateInput,
  createScaleGestureBaseline,
  createScaleProjectionConstraints,
  refineScaleSnapPlan,
  resolveScaleSnapPlan,
  verifyScaleSnapPlan,
} from "./scale-snapping-resolver.js";

// The fork's own fixture helpers, reproduced verbatim in defaults but inlined
// here because Vigilia's tests build their fixtures in-file. Keeping the
// fork's `width: 100`, `height: 100`, `zoom: 1` and `fixedAnchor` at
// `(left, top)` is what keeps its asserted numbers valid.

/** Exact bounds with the centre derived from the same edges. */
function createScaleBounds({
  left,
  top,
  right,
  bottom,
}: {
  left: number;
  top: number;
  right: number;
  bottom: number;
}): ObjectBounds {
  return {
    left,
    top,
    right,
    bottom,
    centerX: left + (right - left) / 2,
    centerY: top + (bottom - top) / 2,
  };
}

/** The fork's baseline: a free and a uniform mode over an `width x height` box. */
function createScaleBaseline({
  width = 100,
  height = 100,
  candidates = [],
  zoom = 1,
}: {
  width?: number;
  height?: number;
  candidates?: readonly ScaleSnapCandidateInput[];
  zoom?: number;
} = {}): ScaleGestureBaseline {
  const bounds = createScaleBounds({
    left: 0,
    top: 0,
    right: width,
    bottom: height,
  });

  return createScaleGestureBaseline({
    bounds,
    fixedAnchor: { x: bounds.left, y: bounds.top },
    projectionModes: [
      {
        id: "free",
        projection: {
          variables: ["scale-x", "scale-y"],
          baselineValues: [1, 1],
          variableSceneWeights: [width, height],
          edges: [
            { edge: "right", coefficients: [width, 0] },
            { edge: "bottom", coefficients: [0, height] },
          ],
        },
      },
      {
        id: "uniform",
        projection: {
          variables: ["uniform-scale"],
          baselineValues: [1],
          variableSceneWeights: [Math.hypot(width, height)],
          edges: [
            { edge: "right", coefficients: [width] },
            { edge: "bottom", coefficients: [height] },
          ],
        },
      },
    ],
    candidates,
    zoom,
  });
}

/** A guide on the active right or bottom edge. */
function createScaleCandidate({
  id,
  axis,
  edge = axis === "x" ? "right" : "bottom",
  position,
  category = "edge",
}: {
  id: string;
  axis: "x" | "y";
  edge?: ScaleSceneEdge;
  position: number;
  category?: ScaleSnapCandidateInput["category"];
}): ScaleSnapCandidateInput {
  return {
    id,
    axis,
    edge,
    position,
    category,
  };
}

/** A scale intent with the modifiers given explicitly. */
function createScaleRawIntent({
  projectionMode = "free",
  values,
  ctrlKey = false,
  shiftKey = false,
}: {
  projectionMode?: string;
  values: readonly number[];
  ctrlKey?: boolean;
  shiftKey?: boolean;
}): ScaleRawIntent {
  return Object.freeze({
    projectionMode,
    values: Object.freeze([...values]),
    modifiers: Object.freeze({ ctrlKey, shiftKey }),
  });
}

/** The final exact geometry, from bounds and the fixed point. */
function createFinalScaleGeometry({
  left = 0,
  top = 0,
  right,
  bottom,
  fixedAnchor = { x: left, y: top },
  measuredValues = [1, 1],
  domainX = "satisfied",
  domainY = "satisfied",
  protectedState = "preserved",
}: {
  left?: number;
  top?: number;
  right: number;
  bottom: number;
  fixedAnchor?: ScaleScenePoint;
  measuredValues?: readonly number[];
  domainX?: FinalScaleGeometry["domainVerdict"]["x"];
  domainY?: FinalScaleGeometry["domainVerdict"]["y"];
  protectedState?: FinalScaleGeometry["domainVerdict"]["protectedState"];
}): FinalScaleGeometry {
  return {
    bounds: createScaleBounds({ left, top, right, bottom }),
    fixedAnchor,
    measuredValues,
    domainVerdict: {
      x: domainX,
      y: domainY,
      protectedState,
    },
  };
}

describe("scale snapping resolution", () => {
  it("translates the chosen guide into a local size constraint", () => {
    const baseline = createScaleBaseline({
      candidates: [
        createScaleCandidate({ id: "right-edge", axis: "x", position: 100 }),
      ],
    });
    const plan = resolveScaleSnapPlan({
      baseline,
      intent: createScaleRawIntent({ values: [0.96, 1] }),
      holdState: FREE_SCALE_HOLD_STATE,
    });

    const constraints = createScaleProjectionConstraints({
      constraints: plan.constraints,
    });

    expect(constraints).toEqual([{ axis: "x", edge: "right", position: 100 }]);
    expect(Object.isFrozen(constraints)).toBe(true);
    expect(Object.isFrozen(constraints[0])).toBe(true);
  });

  it("snaps a line on each axis during a resize", () => {
    const baseline = createScaleBaseline({
      candidates: [
        createScaleCandidate({ id: "right", axis: "x", position: 100 }),
        createScaleCandidate({ id: "bottom", axis: "y", position: 100 }),
      ],
    });
    const plan = resolveScaleSnapPlan({
      baseline,
      intent: createScaleRawIntent({ values: [0.97, 0.96] }),
      holdState: FREE_SCALE_HOLD_STATE,
    });
    const verification = verifyScaleSnapPlan({
      plan,
      finalGeometry: createFinalScaleGeometry({ right: 100, bottom: 100 }),
    });

    expect(plan.effectiveValues[0]).toBeCloseTo(1, 8);
    expect(plan.effectiveValues[1]).toBeCloseTo(1, 8);
    expect(plan.constraints.x?.candidate.id).toBe("right");
    expect(plan.constraints.y?.candidate.id).toBe("bottom");
    expect(verification.guides).toHaveLength(2);
    expect(verification.holdState.x.kind).toBe("held");
    expect(verification.holdState.y.kind).toBe("held");
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.effectiveValues)).toBe(true);
  });

  it("holds one axis independently while the other does not snap", () => {
    const baseline = createScaleBaseline({
      candidates: [
        createScaleCandidate({ id: "right", axis: "x", position: 102 }),
        createScaleCandidate({ id: "bottom", axis: "y", position: 196 }),
      ],
    });
    const plan = resolveScaleSnapPlan({
      baseline,
      intent: createScaleRawIntent({ projectionMode: "uniform", values: [1] }),
      holdState: FREE_SCALE_HOLD_STATE,
    });

    // The box is 100x200, so at uniform 1 the right edge is 100 and the bottom 200:
    // the y guide at 196 is 4 away and inside the acquire threshold of 5, the x guide
    // at 102 is 2 away. Only one can be satisfied by a single uniform value, and the
    // smaller correction (x, 2 units) wins.
    expect(plan.constraints.x?.candidate.id).toBe("right");
    expect(plan.constraints.y).toBeNull();
    expect(plan.effectiveValues[0]).toBeCloseTo(1.02, 8);
    expect(plan.effectivePositions.right).toBeCloseTo(102, 8);
  });

  it("restores the fixed point, so the edge opposite the dragged handle does not move", () => {
    const baseline = createScaleBaseline({
      candidates: [
        createScaleCandidate({ id: "right", axis: "x", position: 100 }),
      ],
    });
    const plan = resolveScaleSnapPlan({
      baseline,
      intent: createScaleRawIntent({ values: [0.96, 1] }),
      holdState: FREE_SCALE_HOLD_STATE,
    });

    // The gesture fixed anchor is the box's top-left, and the projection moves only
    // the right edge, so the left edge stays where the anchor is.
    expect(plan.fixedAnchor).toEqual({ x: 0, y: 0 });
    expect(plan.effectivePositions.left).toBeNull();
    expect(plan.effectivePositions.right).toBeCloseTo(100, 8);
  });

  it("releases a hold past the release threshold and re-acquires the next guide", () => {
    const baseline = createScaleBaseline({
      candidates: [
        createScaleCandidate({ id: "first", axis: "x", position: 100 }),
        createScaleCandidate({ id: "second", axis: "x", position: 110 }),
      ],
    });
    const acquired = resolveScaleSnapPlan({
      baseline,
      intent: createScaleRawIntent({ values: [0.98, 1] }),
      holdState: FREE_SCALE_HOLD_STATE,
    });
    const firstVerification = verifyScaleSnapPlan({
      plan: acquired,
      finalGeometry: createFinalScaleGeometry({ right: 100, bottom: 100 }),
    });
    const held = resolveScaleSnapPlan({
      baseline,
      intent: createScaleRawIntent({ values: [1.04, 1] }),
      holdState: firstVerification.holdState,
    });
    const released = resolveScaleSnapPlan({
      baseline,
      intent: createScaleRawIntent({ values: [1.06, 1] }),
      holdState: firstVerification.holdState,
    });

    expect(held.constraints.x?.candidate.id).toBe("first");
    expect(held.constraints.x?.transition).toBe("held");
    expect(released.constraints.x?.candidate.id).toBe("second");
    expect(released.constraints.x?.transition).toBe("acquired");
  });

  it("leaves the raw, unrounded geometry under Ctrl", () => {
    const baseline = createScaleBaseline({
      candidates: [
        createScaleCandidate({ id: "right", axis: "x", position: 100 }),
      ],
    });
    const plan = resolveScaleSnapPlan({
      baseline,
      intent: createScaleRawIntent({ values: [0.98, 1], ctrlKey: true }),
      holdState: FREE_SCALE_HOLD_STATE,
    });

    expect(plan.constraints.x).toBeNull();
    expect(plan.constraints.y).toBeNull();
    expect(plan.effectiveValues).toEqual([0.98, 1]);
    expect(plan.effectivePositions.right).toBeCloseTo(98, 8);
  });

  it("Ctrl lifts a hold, and releasing it re-acquires from the current position", () => {
    const baseline = createScaleBaseline({
      candidates: [
        createScaleCandidate({ id: "right", axis: "x", position: 100 }),
      ],
    });
    const acquired = resolveScaleSnapPlan({
      baseline,
      intent: createScaleRawIntent({ values: [0.98, 1] }),
      holdState: FREE_SCALE_HOLD_STATE,
    });
    const verification = verifyScaleSnapPlan({
      plan: acquired,
      finalGeometry: createFinalScaleGeometry({ right: 100, bottom: 100 }),
    });
    const disabled = resolveScaleSnapPlan({
      baseline,
      intent: createScaleRawIntent({ values: [0.98, 1], ctrlKey: true }),
      holdState: verification.holdState,
    });
    const enabled = resolveScaleSnapPlan({
      baseline,
      intent: createScaleRawIntent({ values: [0.98, 1] }),
      holdState: disabled.proposedHoldState,
    });

    expect(disabled.constraints.x).toBeNull();
    expect(disabled.effectiveValues[0]).toBeCloseTo(0.98, 8);
    expect(enabled.constraints.x?.transition).toBe("acquired");
    expect(enabled.constraints.x?.candidate.id).toBe("right");
  });

  it("projects a rotated object's control onto its own axis", () => {
    const baseline = createScaleGestureBaseline({
      bounds: createScaleBounds({ left: 0, top: 0, right: 100, bottom: 100 }),
      fixedAnchor: { x: 0, y: 0 },
      projectionModes: [
        {
          id: "free",
          projection: {
            variables: ["scale-x", "scale-y"],
            baselineValues: [1, 1],
            variableSceneWeights: [100, 100],
            edges: [
              { edge: "right", coefficients: [80, 60] },
              { edge: "bottom", coefficients: [-60, 80] },
            ],
          },
        },
      ],
      candidates: [
        createScaleCandidate({ id: "right", axis: "x", position: 100 }),
        createScaleCandidate({ id: "bottom", axis: "y", position: 100 }),
      ],
      zoom: 1,
    });
    const plan = resolveScaleSnapPlan({
      baseline,
      intent: createScaleRawIntent({ values: [0.98, 0.97] }),
      holdState: FREE_SCALE_HOLD_STATE,
    });

    expect(plan.constraints.x?.candidate.id).toBe("right");
    expect(plan.constraints.y?.candidate.id).toBe("bottom");
    expect(plan.effectiveValues[0]).toBeCloseTo(1, 8);
    expect(plan.effectiveValues[1]).toBeCloseTo(1, 8);
  });

  it("uses the exact geometry of the current step instead of the gesture projection", () => {
    const baseline = createScaleBaseline({
      candidates: [
        createScaleCandidate({ id: "right", axis: "x", position: 100 }),
      ],
    });
    const plan = resolveScaleSnapPlan({
      baseline,
      intent: createScaleRawIntent({ values: [0.5, 1] }),
      holdState: FREE_SCALE_HOLD_STATE,
      stepProjection: {
        bounds: createScaleBounds({ left: 0, top: 0, right: 98, bottom: 100 }),
        projection: {
          variables: ["scale-x", "scale-y"],
          baselineValues: [0.5, 1],
          variableSceneWeights: [100, 100],
          edges: [
            { edge: "right", coefficients: [100, 0] },
            { edge: "bottom", coefficients: [0, 100] },
          ],
        },
      },
    });

    expect(plan.rawPositions.right).toBe(98);
    expect(plan.constraints.x?.candidate.id).toBe("right");
    expect(plan.effectiveValues[0]).toBeCloseTo(0.52, 8);
    expect(plan.effectivePositions.right).toBeCloseTo(100, 8);
    expect(Object.isFrozen(plan.projection)).toBe(true);
  });

  it("scales the acquire threshold from screen pixels by zoom", () => {
    const baseline = createScaleBaseline({
      zoom: 2,
      candidates: [
        createScaleCandidate({ id: "right", axis: "x", position: 100 }),
      ],
    });
    const atThreshold = resolveScaleSnapPlan({
      baseline,
      intent: createScaleRawIntent({ values: [0.975, 1] }),
      holdState: FREE_SCALE_HOLD_STATE,
    });
    const outsideThreshold = resolveScaleSnapPlan({
      baseline,
      intent: createScaleRawIntent({ values: [0.9749, 1] }),
      holdState: FREE_SCALE_HOLD_STATE,
    });

    expect(baseline.thresholds.acquire).toBe(2.5);
    expect(atThreshold.constraints.x?.candidate.id).toBe("right");
    expect(outsideThreshold.constraints.x).toBeNull();
    expect(outsideThreshold.effectiveValues[0]).toBeCloseTo(0.9749, 8);
  });

  it("uses a wider release zone for spacing guides than for regular ones", () => {
    const baseline = createScaleBaseline({
      zoom: 2,
      candidates: [
        createScaleCandidate({ id: "right", axis: "x", position: 100 }),
        createScaleCandidate({
          id: "spacing",
          axis: "y",
          position: 100,
          category: "spacing",
        }),
      ],
    });
    const acquired = resolveScaleSnapPlan({
      baseline,
      intent: createScaleRawIntent({ values: [0.98, 0.98] }),
      holdState: FREE_SCALE_HOLD_STATE,
    });
    const verification = verifyScaleSnapPlan({
      plan: acquired,
      finalGeometry: createFinalScaleGeometry({ right: 100, bottom: 100 }),
    });
    const nextPlan = resolveScaleSnapPlan({
      baseline,
      intent: createScaleRawIntent({ values: [0.974, 0.951] }),
      holdState: verification.holdState,
    });

    expect(baseline.thresholds.release).toBe(2.5);
    expect(baseline.thresholds.spacingRelease).toBe(5);
    expect(nextPlan.constraints.x).toBeNull();
    expect(nextPlan.constraints.y?.transition).toBe("held");
    expect(nextPlan.effectiveValues[0]).toBeCloseTo(0.974, 8);
    expect(nextPlan.effectiveValues[1]).toBeCloseTo(1, 8);
  });

  it("releases only the axis that did not reach its guide", () => {
    const baseline = createScaleBaseline({
      candidates: [
        createScaleCandidate({ id: "right", axis: "x", position: 100 }),
        createScaleCandidate({ id: "bottom", axis: "y", position: 100 }),
      ],
    });
    const plan = resolveScaleSnapPlan({
      baseline,
      intent: createScaleRawIntent({ values: [0.98, 0.98] }),
      holdState: FREE_SCALE_HOLD_STATE,
    });
    const verification = verifyScaleSnapPlan({
      plan,
      finalGeometry: createFinalScaleGeometry({ right: 99.8, bottom: 100 }),
    });

    expect(verification.blockedAxes).toEqual(["x"]);
    expect(verification.guides.map(({ candidateId }) => candidateId)).toEqual([
      "bottom",
    ]);
    expect(verification.holdState.x.kind).toBe("free");
    expect(verification.holdState.y.kind).toBe("held");
  });

  it("keeps the applicable guide separate from the candidates checked against the geometry", () => {
    const baseline = createScaleBaseline({
      width: 100,
      height: 200,
      candidates: [
        createScaleCandidate({ id: "right", axis: "x", position: 104 }),
        createScaleCandidate({ id: "bottom", axis: "y", position: 198 }),
      ],
    });
    const plan = resolveScaleSnapPlan({
      baseline,
      intent: createScaleRawIntent({ projectionMode: "uniform", values: [1] }),
      holdState: FREE_SCALE_HOLD_STATE,
    });

    expect(plan.constraints.x).toBeNull();
    expect(plan.constraints.y?.candidate.id).toBe("bottom");
    expect(plan.refinementCandidates.x?.candidate.id).toBe("right");
    expect(plan.refinementCandidates.y?.candidate.id).toBe("bottom");
    expect(plan.effectiveValues[0]).toBeCloseTo(0.99, 8);
    expect(plan.effectivePositions.bottom).toBeCloseTo(198, 8);
  });

  it("replaces one guide with two reached ones after checking the object's geometry", () => {
    const baseline = createScaleBaseline({
      width: 100,
      height: 200,
      candidates: [
        createScaleCandidate({ id: "right", axis: "x", position: 104 }),
        createScaleCandidate({ id: "bottom", axis: "y", position: 198 }),
      ],
    });
    const plan = resolveScaleSnapPlan({
      baseline,
      intent: createScaleRawIntent({ projectionMode: "uniform", values: [1] }),
      holdState: FREE_SCALE_HOLD_STATE,
    });
    const refined = refineScaleSnapPlan({
      plan,
      refinement: {
        constraints: plan.refinementCandidates,
        effectiveValues: [1.02],
        stepProjection: {
          bounds: createScaleBounds({
            left: 0,
            top: 0,
            right: 104,
            bottom: 198,
          }),
          projection: {
            variables: ["uniform-scale"],
            baselineValues: [1.02],
            variableSceneWeights: [100],
            edges: [
              { edge: "right", coefficients: [100] },
              { edge: "bottom", coefficients: [200] },
            ],
          },
        },
      },
    });

    expect(refined.constraints.x?.candidate.id).toBe("right");
    expect(refined.constraints.y?.candidate.id).toBe("bottom");
    expect(refined.constraints.x).toBe(plan.refinementCandidates.x);
    expect(refined.constraints.y).toBe(plan.refinementCandidates.y);
    expect(refined.effectivePositions.right).toBeCloseTo(104, 8);
    expect(refined.effectivePositions.bottom).toBeCloseTo(198, 8);
    expect(refined.proposedHoldState.x.kind).toBe("held");
    expect(refined.proposedHoldState.y.kind).toBe("held");
  });

  it("rejects a constraint that was not among the step's candidates", () => {
    const baseline = createScaleBaseline({
      candidates: [
        createScaleCandidate({ id: "right", axis: "x", position: 100 }),
      ],
    });
    const plan = resolveScaleSnapPlan({
      baseline,
      intent: createScaleRawIntent({ values: [0.98, 1] }),
      holdState: FREE_SCALE_HOLD_STATE,
    });
    const xCandidate = plan.refinementCandidates.x;
    if (!xCandidate) throw new Error("The step must have an X candidate");
    const foreignConstraint = Object.freeze({
      ...xCandidate,
      candidate: Object.freeze({
        ...xCandidate.candidate,
        id: "foreign-right",
      }),
    });

    expect(plan.refinementCandidates.x?.candidate.id).toBe("right");
    expect(() =>
      refineScaleSnapPlan({
        plan,
        refinement: {
          constraints: { x: foreignConstraint, y: null },
          effectiveValues: [1, 1],
          stepProjection: {
            bounds: createScaleBounds({
              left: 0,
              top: 0,
              right: 100,
              bottom: 100,
            }),
            projection: {
              variables: ["scale-x", "scale-y"],
              baselineValues: [1, 1],
              variableSceneWeights: [100, 100],
              edges: [
                { edge: "right", coefficients: [100, 0] },
                { edge: "bottom", coefficients: [0, 100] },
              ],
            },
          },
        },
      }),
    ).toThrow("does not belong to scale plan candidates");
  });

  it("blocks only the refused axis, and both when the protected state changed", () => {
    const baseline = createScaleBaseline({
      candidates: [
        createScaleCandidate({ id: "right", axis: "x", position: 100 }),
        createScaleCandidate({ id: "bottom", axis: "y", position: 100 }),
      ],
    });
    const plan = resolveScaleSnapPlan({
      baseline,
      intent: createScaleRawIntent({ values: [0.98, 0.98] }),
      holdState: FREE_SCALE_HOLD_STATE,
    });
    const domainBlocked = verifyScaleSnapPlan({
      plan,
      finalGeometry: createFinalScaleGeometry({
        right: 100,
        bottom: 100,
        domainX: "blocked",
      }),
    });
    const protectedChanged = verifyScaleSnapPlan({
      plan,
      finalGeometry: createFinalScaleGeometry({
        right: 100,
        bottom: 100,
        protectedState: "changed",
      }),
    });

    expect(domainBlocked.blockedAxes).toEqual(["x"]);
    expect(domainBlocked.guides.map(({ candidateId }) => candidateId)).toEqual([
      "bottom",
    ]);
    expect(domainBlocked.holdState.y.kind).toBe("held");
    expect(protectedChanged.blockedAxes).toEqual(["x", "y"]);
    expect(protectedChanged.guides).toEqual([]);
  });

  it("rejects an invalid projection, invalid start bounds and invalid final geometry", () => {
    expect(() =>
      createScaleGestureBaseline({
        bounds: createScaleBounds({ left: 0, top: 0, right: 100, bottom: 100 }),
        fixedAnchor: { x: 0, y: 0 },
        projectionModes: [
          {
            id: "free",
            projection: {
              variables: ["scale-x"],
              baselineValues: [1],
              variableSceneWeights: [0],
              edges: [{ edge: "right", coefficients: [100] }],
            },
          },
        ],
        candidates: [],
        zoom: 1,
      }),
    ).toThrow("scene weights must be finite positive numbers");

    expect(() =>
      createScaleGestureBaseline({
        bounds: createScaleBounds({
          left: 0,
          top: 0,
          right: Number.NaN,
          bottom: 100,
        }),
        fixedAnchor: { x: 0, y: 0 },
        projectionModes: [
          {
            id: "free",
            projection: {
              variables: ["scale-x"],
              baselineValues: [1],
              variableSceneWeights: [100],
              edges: [{ edge: "right", coefficients: [100] }],
            },
          },
        ],
        candidates: [],
        zoom: 1,
      }),
    ).toThrow("finite ordered edges");

    const baseline = createScaleBaseline();
    const plan = resolveScaleSnapPlan({
      baseline,
      intent: createScaleRawIntent({ values: [1, 1] }),
      holdState: FREE_SCALE_HOLD_STATE,
    });
    const invalidFinalGeometry = createFinalScaleGeometry({
      right: 100,
      bottom: 100,
    });
    invalidFinalGeometry.bounds.centerX = 49;

    expect(() =>
      verifyScaleSnapPlan({ plan, finalGeometry: invalidFinalGeometry }),
    ).toThrow("centers");
  });
});
