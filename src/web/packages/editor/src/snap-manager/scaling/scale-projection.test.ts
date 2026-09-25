import { describe, expect, it } from "vitest";
import { createScaleSnapCandidates } from "./scale-snap-candidates.js";
import {
  createScaleProjection,
  getScaleProjectionCorrectionMagnitude,
  getScaleProjectionEdge,
  projectScaleEdgePositions,
  resolveScaleProjection,
  resolveScaleSceneEdgeAxis,
} from "./scale-projection.js";

// A 200x100 object at (100, 100), modelled the way the fork's text-width path
// models it: the variable is the width itself, so `baselineValues` carries the
// baseline width and a coefficient of 1 means one scene unit of edge movement
// per scene unit of width. This is the convention the fork's own spec pins
// (`specs/.../text-width-resize-projection.spec.ts`: `values: [baselineWidth + 25]`
// against `coefficient: 1`); the rectangular path uses `scale-x` instead, with
// `baselineValues: [1]` and the lever arm as the coefficient. Do not write
// `multiplier-x` here — that is a `RectangularScaleProjectionVariable`, which the
// gesture projection *maps to* `scale-x` before this API ever sees it.
const bounds = {
  left: 100,
  top: 100,
  right: 300,
  bottom: 200,
  centerX: 200,
  centerY: 150,
};
const baselineWidth = bounds.right - bounds.left;
const horizontal = createScaleProjection({
  bounds,
  input: {
    variables: ["text-width"],
    baselineValues: [baselineWidth],
    variableSceneWeights: [1],
    edges: [
      { edge: "left", coefficients: [0] },
      { edge: "right", coefficients: [1] },
    ],
  },
});

describe("scale projection", () => {
  it("moves the right edge by the width delta", () => {
    // 300 + 1 * (225 - 200). The point of the case is that the projection is
    // linear in the delta, not that any particular edge is special.
    expect(
      projectScaleEdgePositions({ projection: horizontal, values: [225] })
        .right,
    ).toBeCloseTo(325, 9);
  });

  it("leaves the opposite edge fixed", () => {
    expect(
      projectScaleEdgePositions({ projection: horizontal, values: [225] }).left,
    ).toBeCloseTo(100, 9);
  });

  it("solves the value that puts an edge on a guide", () => {
    const solution = resolveScaleProjection({
      projection: horizontal,
      rawValues: [225],
      constraints: [{ axis: "x", edge: "right", position: 340 }],
      epsilon: 0.1,
    });
    expect(solution?.positions.right).toBeCloseTo(340, 9);
  });

  it("returns null when a constraint cannot be projected", () => {
    // The left edge cannot move under a text-width-only model: its coefficient
    // is 0, so the constraint is unreachable and the solver declines rather
    // than returning the raw values as though it had satisfied the guide.
    expect(
      resolveScaleProjection({
        projection: horizontal,
        rawValues: [225],
        constraints: [{ axis: "x", edge: "left", position: 340 }],
        epsilon: 0.1,
      }),
    ).toBeNull();
  });

  it("returns only the participating edge and null for the others", () => {
    expect(
      getScaleProjectionEdge({ projection: horizontal, edge: "right" }),
    ).toEqual({
      axis: "x",
      edge: "right",
      baselinePosition: 300,
      coefficients: [1],
    });
    expect(
      getScaleProjectionEdge({ projection: horizontal, edge: "bottom" }),
    ).toBeNull();
  });

  it("measures the correction in scene units, weighted by the scene weight", () => {
    // The solution moves the variable from 225 to 240, so the weighted distance
    // is |225 - 240| * 1. The magnitude is a scene distance, not a variable delta.
    expect(
      getScaleProjectionCorrectionMagnitude({
        projection: horizontal,
        rawValues: [225],
        constraint: { axis: "x", edge: "right", position: 340 },
      }),
    ).toBeCloseTo(15, 9);
  });

  it("maps each edge to its axis", () => {
    expect(resolveScaleSceneEdgeAxis({ edge: "left" })).toBe("x");
    expect(resolveScaleSceneEdgeAxis({ edge: "right" })).toBe("x");
    expect(resolveScaleSceneEdgeAxis({ edge: "top" })).toBe("y");
    expect(resolveScaleSceneEdgeAxis({ edge: "bottom" })).toBe("y");
  });
});

// The fork's own candidates spec numbers: a 100x200 source at (10, 20) gives the
// x lines 10 / 60 / 110, and binding each to the moving `right` edge keeps them
// in that stable source order. `top` repeats the same lines on the y axis.
describe("scale snap candidates", () => {
  it("binds every source line to every moving edge on its axis, in stable order", () => {
    const candidates = createScaleSnapCandidates({
      targetEdges: ["right", "top"],
      sources: [
        {
          id: "source-image",
          bounds: {
            left: 10,
            top: 20,
            right: 110,
            bottom: 220,
            centerX: 60,
            centerY: 120,
          },
        },
      ],
    });

    expect(candidates.map(({ id }) => id)).toEqual([
      "source-image:left->right",
      "source-image:center-x->right",
      "source-image:right->right",
      "source-image:top->top",
      "source-image:center-y->top",
      "source-image:bottom->top",
    ]);
    expect(candidates.map(({ position }) => position)).toEqual([
      10, 60, 110, 20, 120, 220,
    ]);
    expect(candidates.map(({ category }) => category)).toEqual([
      "edge",
      "center",
      "edge",
      "edge",
      "center",
      "edge",
    ]);
    expect(Object.isFrozen(candidates)).toBe(true);
    expect(candidates.every(Object.isFrozen)).toBe(true);
  });

  it("creates separate candidates for two moving edges on one axis", () => {
    const candidates = createScaleSnapCandidates({
      targetEdges: ["left", "right"],
      sources: [
        {
          id: "rotated-target-source",
          bounds: {
            left: 0,
            top: 0,
            right: 100,
            bottom: 80,
            centerX: 50,
            centerY: 40,
          },
          edgeCategory: "domain-boundary",
        },
      ],
    });

    expect(candidates).toHaveLength(6);
    expect(new Set(candidates.map(({ id }) => id)).size).toBe(6);
    expect(
      candidates.filter(({ category }) => category === "domain-boundary"),
    ).toHaveLength(4);
    expect(
      candidates.filter(({ category }) => category === "center"),
    ).toHaveLength(2);
  });

  it("rejects an empty edge list, duplicate edges and duplicate source ids", () => {
    const sourceBounds = {
      left: 0,
      top: 0,
      right: 100,
      bottom: 80,
      centerX: 50,
      centerY: 40,
    };

    expect(() =>
      createScaleSnapCandidates({ targetEdges: [], sources: [] }),
    ).toThrow("at least one edge");
    expect(() =>
      createScaleSnapCandidates({
        targetEdges: ["right", "right"],
        sources: [],
      }),
    ).toThrow("target edges must be unique");
    expect(() =>
      createScaleSnapCandidates({
        targetEdges: ["right"],
        sources: [
          { id: "duplicate", bounds: sourceBounds },
          { id: "duplicate", bounds: sourceBounds },
        ],
      }),
    ).toThrow("source id");
  });
});
