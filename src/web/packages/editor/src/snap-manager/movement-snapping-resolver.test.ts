import { describe, expect, it, vi } from "vitest";
import type { MovementSnapCandidateSource } from "./movement-snap-candidates.js";
import {
  FREE_MOVEMENT_HOLD_STATE,
  resolveMovementSnapPlan,
  verifyMovementSnapPlan,
} from "./movement-snapping-resolver.js";
import {
  createFinalMovementGeometry,
  createMovementBaseline,
  createMovementBounds,
  createMovementRawIntent,
} from "./movement-snapping-core.test-utils.js";

/** A narrow target with two close vertical guides. */
const REFERENCE_SOURCE = {
  id: "reference",
  bounds: createMovementBounds({
    left: 100,
    top: 100,
    width: 12,
    height: 40,
  }),
  useForSpacing: true,
} satisfies MovementSnapCandidateSource;

/** Two wide objects giving an equal-spacing position of `left = 35` for a 20-wide target. */
const HORIZONTAL_SPACING_SOURCES = [
  {
    id: "left-spacing-source",
    bounds: createMovementBounds({ left: 0, top: 0, width: 20, height: 300 }),
    useForSpacing: true,
  },
  {
    id: "right-spacing-source",
    bounds: createMovementBounds({ left: 70, top: 0, width: 20, height: 300 }),
    useForSpacing: true,
  },
] satisfies readonly MovementSnapCandidateSource[];

/** First three shapes of a template with exact intervals of `47.25`. */
const FRACTIONAL_CHAIN_SOURCES = [
  {
    id: "first-fractional-shape",
    bounds: createMovementBounds({
      left: -29.875,
      top: 229,
      width: 102,
      height: 102,
    }),
    useForSpacing: true,
  },
  {
    id: "second-fractional-shape",
    bounds: createMovementBounds({
      left: 119.375,
      top: 236.375,
      width: 87.25,
      height: 87.25,
    }),
    useForSpacing: true,
  },
  {
    id: "third-fractional-shape",
    bounds: createMovementBounds({
      left: 253.875,
      top: 230.375,
      width: 100.625,
      height: 100.625,
    }),
    useForSpacing: true,
  },
] satisfies readonly MovementSnapCandidateSource[];

/** First three shapes of a vertical template with exact intervals of `47.25`. */
const VERTICAL_FRACTIONAL_CHAIN_SOURCES = [
  {
    id: "first-vertical-fractional-shape",
    bounds: createMovementBounds({
      left: 229,
      top: -29.875,
      width: 102,
      height: 102,
    }),
    useForSpacing: true,
  },
  {
    id: "second-vertical-fractional-shape",
    bounds: createMovementBounds({
      left: 236.375,
      top: 119.375,
      width: 87.25,
      height: 87.25,
    }),
    useForSpacing: true,
  },
  {
    id: "third-vertical-fractional-shape",
    bounds: createMovementBounds({
      left: 230.375,
      top: 253.875,
      width: 100.625,
      height: 100.625,
    }),
    useForSpacing: true,
  },
] satisfies readonly MovementSnapCandidateSource[];

/** Spacing targets where a Y shift reveals a new nearest neighbour. */
const CHANGING_NEIGHBOR_SOURCES = [
  {
    id: "left-spacing-source",
    bounds: createMovementBounds({ left: 0, top: 0, width: 20, height: 10 }),
    useForSpacing: true,
  },
  {
    id: "closer-spacing-source",
    bounds: createMovementBounds({ left: 25, top: 7, width: 2, height: 4 }),
    useForSpacing: true,
  },
  {
    id: "right-spacing-source",
    bounds: createMovementBounds({ left: 70, top: 0, width: 20, height: 10 }),
    useForSpacing: true,
  },
] satisfies readonly MovementSnapCandidateSource[];

/** Sources for returning to the X guide while the Y guide stays held. */
const CHANGING_NEIGHBOR_WITH_FALLBACK_SOURCES = [
  ...CHANGING_NEIGHBOR_SOURCES,
  {
    id: "fallback-x-line",
    bounds: createMovementBounds({
      left: 37,
      top: -100,
      width: 0,
      height: 300,
    }),
  },
  {
    id: "held-y-line",
    bounds: createMovementBounds({
      left: -100,
      top: 4,
      width: 500,
      height: 0,
    }),
  },
] satisfies readonly MovementSnapCandidateSource[];

/** Two compatible reference guides with different Y overlap. */
const RELATED_REFERENCE_SPACING_SOURCES = [
  {
    id: "before-reference-start",
    bounds: createMovementBounds({ left: -40, top: -2, width: 20, height: 12 }),
    useForSpacing: true,
  },
  {
    id: "before-neighbor",
    bounds: createMovementBounds({ left: 0, top: -2, width: 20, height: 12 }),
    useForSpacing: true,
  },
  {
    id: "after-neighbor",
    bounds: createMovementBounds({ left: 80, top: 0, width: 20, height: 4 }),
    useForSpacing: true,
  },
  {
    id: "after-reference-end",
    bounds: createMovementBounds({ left: 120, top: 0, width: 20, height: 4 }),
    useForSpacing: true,
  },
] satisfies readonly MovementSnapCandidateSource[];

/** Two guides for compatible intervals around the dragged object. */
const RELATED_REFERENCE_SPACING_GUIDES = [
  {
    type: "horizontal",
    axis: 5,
    refStart: -20,
    refEnd: 0,
    activeStart: 20,
    activeEnd: 40,
    distance: 20,
  },
  {
    type: "horizontal",
    axis: 5,
    refStart: 100,
    refEnd: 120,
    activeStart: 60,
    activeEnd: 80,
    distance: 20,
  },
] as const;

/** Identical spacing bounds in two non-overlapping rows. */
const SAME_SPACING_EDGES_IN_DIFFERENT_ROWS = [
  {
    id: "first-row-left",
    bounds: createMovementBounds({ left: 0, top: 0, width: 20, height: 8 }),
    useForSpacing: true,
  },
  {
    id: "first-row-right",
    bounds: createMovementBounds({ left: 70, top: 0, width: 20, height: 8 }),
    useForSpacing: true,
  },
  {
    id: "second-row-left",
    bounds: createMovementBounds({ left: 0, top: 12, width: 20, height: 8 }),
    useForSpacing: true,
  },
  {
    id: "second-row-right",
    bounds: createMovementBounds({ left: 70, top: 12, width: 20, height: 8 }),
    useForSpacing: true,
  },
] satisfies readonly MovementSnapCandidateSource[];

/** Spacing targets for independent X-hold and Y-acquisition checks. */
const PER_AXIS_SPACING_SOURCES = [
  ...HORIZONTAL_SPACING_SOURCES,
  {
    id: "top-spacing-source",
    bounds: createMovementBounds({
      left: -200,
      top: 0,
      width: 300,
      height: 20,
    }),
    useForSpacing: true,
  },
  {
    id: "bottom-spacing-source",
    bounds: createMovementBounds({
      left: -200,
      top: 70,
      width: 300,
      height: 20,
    }),
    useForSpacing: true,
  },
] satisfies readonly MovementSnapCandidateSource[];

it("holds the chosen guides even when a neighbouring line becomes closer", () => {
  const baseline = createMovementBaseline({
    sources: [REFERENCE_SOURCE],
  });
  const acquiredPlan = resolveMovementSnapPlan({
    baseline,
    intent: createMovementRawIntent({ left: 101, top: 101 }),
    holdState: FREE_MOVEMENT_HOLD_STATE,
  });
  const acquired = verifyMovementSnapPlan({
    baseline,
    plan: acquiredPlan,
    finalGeometry: createFinalMovementGeometry({ left: 100, top: 100 }),
  });
  const heldPlan = resolveMovementSnapPlan({
    baseline,
    intent: createMovementRawIntent({ left: 104, top: 104 }),
    holdState: acquired.holdState,
  });
  const held = verifyMovementSnapPlan({
    baseline,
    plan: heldPlan,
    finalGeometry: createFinalMovementGeometry({ left: 100, top: 100 }),
  });
  const acquiredX = acquiredPlan.constraints.x;
  const acquiredY = acquiredPlan.constraints.y;
  const heldX = heldPlan.constraints.x;

  expect(acquiredX?.kind).toBe("line");
  expect(acquiredY?.kind).toBe("line");
  expect(heldX?.kind).toBe("line");
  if (
    acquiredX?.kind !== "line" ||
    acquiredY?.kind !== "line" ||
    heldX?.kind !== "line"
  ) {
    throw new Error("plain line constraints must be selected in this scenario");
  }

  expect(acquiredX.candidate.id).toBe("reference:left");
  expect(acquiredY.candidate.id).toBe("reference:top");
  expect(heldX.transition).toBe("held");
  expect(heldX.candidate.id).toBe("reference:left");
  expect(heldPlan.nextPosition).toEqual({ left: 100, top: 100 });
  expect(held.guides).toHaveLength(2);
});

it("releases X while Y keeps holding", () => {
  const baseline = createMovementBaseline({
    sources: [REFERENCE_SOURCE],
  });
  const acquiredPlan = resolveMovementSnapPlan({
    baseline,
    intent: createMovementRawIntent({ left: 101, top: 101 }),
    holdState: FREE_MOVEMENT_HOLD_STATE,
  });
  const acquired = verifyMovementSnapPlan({
    baseline,
    plan: acquiredPlan,
    finalGeometry: createFinalMovementGeometry({ left: 100, top: 100 }),
  });
  const releasedPlan = resolveMovementSnapPlan({
    baseline,
    intent: createMovementRawIntent({ left: 140, top: 104 }),
    holdState: acquired.holdState,
  });
  const released = verifyMovementSnapPlan({
    baseline,
    plan: releasedPlan,
    finalGeometry: createFinalMovementGeometry({ left: 140, top: 100 }),
  });

  expect(releasedPlan.constraints.x).toBeNull();
  expect(releasedPlan.constraints.y?.transition).toBe("held");
  expect(releasedPlan.nextPosition).toEqual({ left: 140, top: 100 });
  expect(released.holdState.x.kind).toBe("free");
  expect(released.holdState.y.kind).toBe("line");
  expect(released.guides.map((guide) => guide.axis)).toEqual(["y"]);
});

it("Ctrl restores the raw Fabric position and clears the transient hold", () => {
  const baseline = createMovementBaseline({
    sources: [REFERENCE_SOURCE],
  });
  const acquiredPlan = resolveMovementSnapPlan({
    baseline,
    intent: createMovementRawIntent({ left: 101, top: 101 }),
    holdState: FREE_MOVEMENT_HOLD_STATE,
  });
  const acquired = verifyMovementSnapPlan({
    baseline,
    plan: acquiredPlan,
    finalGeometry: createFinalMovementGeometry({ left: 100, top: 100 }),
  });
  const disabledPlan = resolveMovementSnapPlan({
    baseline,
    intent: createMovementRawIntent({
      left: 104.25,
      top: 104.25,
      ctrlKey: true,
    }),
    holdState: acquired.holdState,
  });
  const disabled = verifyMovementSnapPlan({
    baseline,
    plan: disabledPlan,
    finalGeometry: createFinalMovementGeometry({ left: 104.25, top: 104.25 }),
  });

  expect(disabledPlan.nextPosition).toEqual({ left: 104.25, top: 104.25 });
  expect(disabledPlan.constraints).toEqual({ x: null, y: null });
  expect(disabled.guides).toHaveLength(0);
  expect(disabled.spacingGuides).toHaveLength(0);
  expect(disabled.holdState).toEqual(FREE_MOVEMENT_HOLD_STATE);
});

it("does not publish or hold a line the final geometry never reached", () => {
  const baseline = createMovementBaseline({
    sources: [REFERENCE_SOURCE],
  });
  const plan = resolveMovementSnapPlan({
    baseline,
    intent: createMovementRawIntent({ left: 101, top: 101 }),
    holdState: FREE_MOVEMENT_HOLD_STATE,
  });
  const verification = verifyMovementSnapPlan({
    baseline,
    plan,
    finalGeometry: createFinalMovementGeometry({ left: 105, top: 100 }),
  });

  expect(verification.blockedAxes).toEqual(["x"]);
  expect(verification.guides.map((guide) => guide.axis)).toEqual(["y"]);
  expect(verification.holdState.x.kind).toBe("free");
  expect(verification.holdState.y.kind).toBe("line");
});

it("converts the acquire threshold from screen pixels through zoom", () => {
  const zoomedBaseline = createMovementBaseline({
    sources: [REFERENCE_SOURCE],
    zoom: 2,
  });
  const plan = resolveMovementSnapPlan({
    baseline: zoomedBaseline,
    intent: createMovementRawIntent({ left: 103, top: 103, canSnapY: false }),
    holdState: FREE_MOVEMENT_HOLD_STATE,
  });

  expect(zoomedBaseline.thresholds.acquire).toBe(2.5);
  expect(plan.constraints.x).toBeNull();
  expect(plan.constraints.y).toBeNull();
  expect(plan.nextPosition).toEqual({ left: 103, top: 103 });
});

it("combines position rounding with exact equal spacing", () => {
  const spacingBaseline = createMovementBaseline({
    bounds: createMovementBounds({
      left: 0,
      top: 0,
      width: 20,
      height: 30,
    }),
    sources: HORIZONTAL_SPACING_SOURCES,
  });
  const spaced = resolveMovementSnapPlan({
    baseline: spacingBaseline,
    intent: createMovementRawIntent({
      left: 33.19,
      top: 100.6,
      width: 20,
    }),
    holdState: FREE_MOVEMENT_HOLD_STATE,
  });
  const verifiedSpacing = verifyMovementSnapPlan({
    baseline: spacingBaseline,
    plan: spaced,
    finalGeometry: createFinalMovementGeometry({
      left: 35,
      top: 101,
      width: 20,
    }),
  });
  const heldSpacing = resolveMovementSnapPlan({
    baseline: spacingBaseline,
    intent: createMovementRawIntent({
      left: 39.27,
      top: 100.6,
      width: 20,
    }),
    holdState: verifiedSpacing.holdState,
  });
  const xConstraint = spaced.constraints.x;

  expect(spaced.nextPosition).toEqual({ left: 35, top: 101 });
  expect(xConstraint?.kind).toBe("spacing");
  if (xConstraint?.kind !== "spacing") {
    throw new Error("exact equal spacing must be selected on X");
  }

  expect(xConstraint.selections[0]?.guide).toEqual({
    type: "horizontal",
    axis: 116,
    refStart: 20,
    refEnd: 35,
    activeStart: 55,
    activeEnd: 70,
    distance: 15,
  });
  expect(spaced.constraints.y).toBeNull();
  expect(heldSpacing.nextPosition).toEqual({ left: 35, top: 101 });
  expect(verifiedSpacing.spacingGuides.length).toBeGreaterThan(0);
  expect(verifiedSpacing.holdState.x.kind).toBe("spacing");
});

it("keeps the fractional chain geometry when re-snapping", () => {
  const fourthBounds = createMovementBounds({
    left: 401.75,
    top: 229,
    width: 102,
    height: 102,
  });
  const baseline = createMovementBaseline({
    bounds: fourthBounds,
    sources: FRACTIONAL_CHAIN_SOURCES,
  });
  const plan = resolveMovementSnapPlan({
    baseline,
    intent: createMovementRawIntent({
      left: 398.75,
      top: 229,
      width: 102,
      height: 102,
      canSnapY: false,
    }),
    holdState: FREE_MOVEMENT_HOLD_STATE,
  });
  const verification = verifyMovementSnapPlan({
    baseline,
    plan,
    finalGeometry: createFinalMovementGeometry({
      left: 401.75,
      top: 229,
      width: 102,
      height: 102,
    }),
  });
  const xConstraint = plan.constraints.x;

  expect(xConstraint?.kind).toBe("spacing");
  if (xConstraint?.kind !== "spacing") {
    throw new Error("an equal-spacing chain must be selected on X");
  }

  expect(plan.nextPosition).toEqual({ left: 401.75, top: 229 });
  expect(xConstraint.chainId).not.toBeNull();
  expect(verification.spacingGuides).toHaveLength(2);
  expect(
    verification.spacingGuides.every(({ distance }) => distance === 47),
  ).toBe(true);
});

it("keeps the vertical fractional chain geometry while held", () => {
  const fourthBounds = createMovementBounds({
    left: 229,
    top: 401.75,
    width: 102,
    height: 102,
  });
  const baseline = createMovementBaseline({
    bounds: fourthBounds,
    sources: VERTICAL_FRACTIONAL_CHAIN_SOURCES,
  });
  const plan = resolveMovementSnapPlan({
    baseline,
    intent: createMovementRawIntent({
      left: 229,
      top: 398.75,
      width: 102,
      height: 102,
      canSnapX: false,
    }),
    holdState: FREE_MOVEMENT_HOLD_STATE,
  });
  const verification = verifyMovementSnapPlan({
    baseline,
    plan,
    finalGeometry: createFinalMovementGeometry({
      left: 229,
      top: 401.75,
      width: 102,
      height: 102,
    }),
  });
  const yConstraint = plan.constraints.y;

  expect(yConstraint?.kind).toBe("spacing");
  if (yConstraint?.kind !== "spacing") {
    throw new Error("an equal-spacing chain must be selected on Y");
  }

  expect(plan.nextPosition).toEqual({ left: 229, top: 401.75 });
  expect(yConstraint.chainId).not.toBeNull();
  expect(verification.spacingGuides).toHaveLength(2);
  expect(
    verification.spacingGuides.every(({ type, distance }) => {
      return type === "vertical" && distance === 47;
    }),
  ).toBe(true);
});

it("places the middle object at the exact equal-spacing position for gaps of 47 and 48", () => {
  const middleBounds = createMovementBounds({
    left: 147,
    top: 0,
    width: 100,
    height: 100,
  });
  const baseline = createMovementBaseline({
    bounds: middleBounds,
    sources: [
      {
        id: "first-three-shape-chain-object",
        bounds: createMovementBounds({
          left: 0,
          top: 0,
          width: 100,
          height: 100,
        }),
        useForSpacing: true,
      },
      {
        id: "third-three-shape-chain-object",
        bounds: createMovementBounds({
          left: 295,
          top: 0,
          width: 100,
          height: 100,
        }),
        useForSpacing: true,
      },
    ],
  });
  const plan = resolveMovementSnapPlan({
    baseline,
    intent: createMovementRawIntent({
      left: 144,
      top: 0,
      width: 100,
      height: 100,
      canSnapY: false,
    }),
    holdState: FREE_MOVEMENT_HOLD_STATE,
  });
  const verification = verifyMovementSnapPlan({
    baseline,
    plan,
    finalGeometry: createFinalMovementGeometry({
      left: 147.5,
      top: 0,
      width: 100,
      height: 100,
    }),
  });
  const xConstraint = plan.constraints.x;

  expect(xConstraint?.kind).toBe("spacing");
  if (xConstraint?.kind !== "spacing") {
    throw new Error("the exact equal-spacing position must be selected on X");
  }

  expect(plan.nextPosition).toEqual({ left: 147.5, top: 0 });
  expect(xConstraint.chainId).toBeNull();
  expect(verification.spacingGuides).toHaveLength(1);
  expect(verification.spacingGuides[0]?.distance).toBe(48);
});

it("does not return the object to its start when snapping elsewhere in the same chain", () => {
  const baseline = createMovementBaseline({
    bounds: createMovementBounds({ left: 0, top: 0, width: 20, height: 20 }),
    sources: [70, 140, 210].map((left, index) => ({
      id: `chain-shape-${index + 2}`,
      bounds: createMovementBounds({ left, top: 0, width: 20, height: 20 }),
      useForSpacing: true,
    })),
  });
  const plan = resolveMovementSnapPlan({
    baseline,
    intent: createMovementRawIntent({
      left: 280,
      top: 0,
      width: 20,
      height: 20,
      canSnapY: false,
    }),
    holdState: FREE_MOVEMENT_HOLD_STATE,
  });
  const xConstraint = plan.constraints.x;

  expect(xConstraint?.kind).toBe("spacing");
  if (xConstraint?.kind !== "spacing") {
    throw new Error(
      "equal spacing elsewhere in the chain must be selected on X",
    );
  }

  expect(plan.nextPosition).toEqual({ left: 280, top: 0 });
  expect(xConstraint.chainId).toBeNull();
});

it("aligns equal spacing exactly on the vertical axis", () => {
  const baseline = createMovementBaseline({
    bounds: createMovementBounds({ left: 0, top: 0, width: 20, height: 20 }),
    sources: PER_AXIS_SPACING_SOURCES.slice(2),
  });
  const plan = resolveMovementSnapPlan({
    baseline,
    intent: createMovementRawIntent({
      left: 0,
      top: 33.19,
      width: 20,
      height: 20,
      canSnapX: false,
    }),
    holdState: FREE_MOVEMENT_HOLD_STATE,
  });
  const yConstraint = plan.constraints.y;

  expect(yConstraint?.kind).toBe("spacing");
  if (yConstraint?.kind !== "spacing") {
    throw new Error("exact equal spacing must be selected on Y");
  }

  expect(yConstraint.selections[0]?.guide).toEqual({
    type: "vertical",
    axis: 10,
    refStart: 20,
    refEnd: 35,
    activeStart: 55,
    activeEnd: 70,
    distance: 15,
  });
  expect(plan.nextPosition).toEqual({ left: 0, top: 35 });
});

it("re-selects equal spacing after switching to neighbours with identical X bounds", () => {
  const baseline = createMovementBaseline({
    bounds: createMovementBounds({ left: 0, top: 0, width: 20, height: 4 }),
    sources: SAME_SPACING_EDGES_IN_DIFFERENT_ROWS,
  });
  const acquiredPlan = resolveMovementSnapPlan({
    baseline,
    intent: createMovementRawIntent({
      left: 33,
      top: 2,
      width: 20,
      height: 4,
      canSnapY: false,
    }),
    holdState: FREE_MOVEMENT_HOLD_STATE,
  });
  const acquired = verifyMovementSnapPlan({
    baseline,
    plan: acquiredPlan,
    finalGeometry: createFinalMovementGeometry({
      left: 35,
      top: 2,
      width: 20,
      height: 4,
    }),
  });
  const nextPlan = resolveMovementSnapPlan({
    baseline,
    intent: createMovementRawIntent({
      left: 39,
      top: 14,
      width: 20,
      height: 4,
      canSnapY: false,
    }),
    holdState: acquired.holdState,
  });
  const acquiredX = acquiredPlan.constraints.x;
  const nextX = nextPlan.constraints.x;

  expect(acquiredX?.kind).toBe("spacing");
  expect(nextX?.kind).toBe("spacing");
  if (acquiredX?.kind !== "spacing" || nextX?.kind !== "spacing") {
    throw new Error("equal spacing must be selected in both rows");
  }

  expect(nextX.transition).toBe("acquired");
  expect(nextX.candidateId).not.toBe(acquiredX.candidateId);
  expect(acquiredX.selections[0]?.identity.before?.top).toBe(0);
  expect(nextX.selections[0]?.identity.before?.top).toBe(12);
});

it("snaps to a regular X guide during a Y correction when equal spacing gains a new neighbour", () => {
  const baseline = createMovementBaseline({
    bounds: createMovementBounds({ left: 0, top: 0, width: 20, height: 4 }),
    sources: CHANGING_NEIGHBOR_WITH_FALLBACK_SOURCES,
  });
  const heldYCandidate = baseline.candidates.find(
    ({ id }) => id === "held-y-line:top",
  );
  expect(heldYCandidate).toBeDefined();
  if (!heldYCandidate) {
    throw new Error("the Y guide must be part of the baseline");
  }
  const plan = resolveMovementSnapPlan({
    baseline,
    intent: createMovementRawIntent({
      left: 33,
      top: 3,
      width: 20,
      height: 4,
    }),
    holdState: {
      x: FREE_MOVEMENT_HOLD_STATE.x,
      y: {
        kind: "line",
        candidate: heldYCandidate,
        activeAnchor: "top",
      },
    },
  });
  const verification = verifyMovementSnapPlan({
    baseline,
    plan,
    finalGeometry: createFinalMovementGeometry({
      left: plan.nextPosition.left,
      top: plan.nextPosition.top,
      width: 20,
      height: 4,
    }),
  });
  const xConstraint = plan.constraints.x;

  expect(xConstraint?.kind).toBe("line");
  if (xConstraint?.kind !== "line") {
    throw new Error("an X guide must be selected after equal spacing is lost");
  }

  expect(xConstraint.candidate.id).toBe("fallback-x-line:left");
  expect(xConstraint.transition).toBe("acquired");
  expect(plan.constraints.y?.transition).toBe("held");
  expect(plan.nextPosition).toEqual({ left: 37, top: 4 });
  expect(verification.spacingGuides).toHaveLength(0);
  expect(verification.blockedAxes).toEqual([]);
  expect(verification.holdState.x.kind).toBe("line");
  expect(verification.guides.map(({ axis }) => axis)).toEqual(["x", "y"]);
});

it("keeps the primary equal spacing when the secondary interval stops applying", () => {
  const baseline = createMovementBaseline({
    bounds: createMovementBounds({ left: 0, top: 0, width: 20, height: 4 }),
    sources: RELATED_REFERENCE_SPACING_SOURCES,
  });
  const rawIntent = createMovementRawIntent({
    left: 40.19,
    top: 3,
    width: 20,
    height: 4,
  });
  const beforeCorrection = resolveMovementSnapPlan({
    baseline,
    intent: {
      ...rawIntent,
      axes: { x: true, y: false },
    },
    holdState: FREE_MOVEMENT_HOLD_STATE,
  });
  const plan = resolveMovementSnapPlan({
    baseline,
    intent: rawIntent,
    holdState: FREE_MOVEMENT_HOLD_STATE,
  });
  const initialX = beforeCorrection.constraints.x;
  const finalX = plan.constraints.x;

  expect(initialX?.kind).toBe("spacing");
  expect(finalX?.kind).toBe("spacing");
  if (initialX?.kind !== "spacing" || finalX?.kind !== "spacing") {
    throw new Error("equal spacing must be selected on X in this scenario");
  }

  expect(initialX.selections.map(({ identity }) => identity.side)).toEqual([
    "before",
    "after",
  ]);
  expect(initialX.selections.map(({ isPrimary }) => isPrimary)).toEqual([
    true,
    false,
  ]);
  expect(initialX.selections.map(({ guide }) => guide)).toEqual(
    RELATED_REFERENCE_SPACING_GUIDES,
  );
  expect(finalX.selections).toHaveLength(1);
  expect(finalX.selections[0]?.identity.side).toBe("before");
  expect(finalX.selections[0]?.isPrimary).toBe(true);
  expect(plan.nextPosition).toEqual({ left: 40, top: 4 });
  expect(plan.constraints.y?.kind).toBe("line");
});

it("aligns the interval in front of the nearest object exactly", () => {
  const baseline = createMovementBaseline({
    bounds: createMovementBounds({ left: 0, top: 0, width: 20, height: 4 }),
    sources: RELATED_REFERENCE_SPACING_SOURCES.slice(2),
  });
  const plan = resolveMovementSnapPlan({
    baseline,
    intent: createMovementRawIntent({
      left: 40.19,
      top: 0,
      width: 20,
      height: 4,
      canSnapY: false,
    }),
    holdState: FREE_MOVEMENT_HOLD_STATE,
  });
  const constraint = plan.constraints.x;

  expect(constraint?.kind).toBe("spacing");
  if (constraint?.kind !== "spacing") {
    throw new Error(
      "equal spacing in front of the nearest object must be selected",
    );
  }

  expect(constraint.selections[0]?.identity.side).toBe("after");
  expect(constraint.selections[0]?.guide).toEqual({
    type: "horizontal",
    axis: 2,
    refStart: 100,
    refEnd: 120,
    activeStart: 60,
    activeEnd: 80,
    distance: 20,
  });
  expect(plan.nextPosition).toEqual({ left: 40, top: 0 });
});

it("hides a secondary interval that disagrees with the primary position", () => {
  const baseline = createMovementBaseline({
    bounds: createMovementBounds({ left: 0, top: 0, width: 20, height: 4 }),
    sources: [
      {
        id: "left-reference-start",
        bounds: createMovementBounds({
          left: -40.1,
          top: 0,
          width: 20,
          height: 4,
        }),
        useForSpacing: true,
      },
      {
        id: "left-neighbor",
        bounds: createMovementBounds({ left: 0, top: 0, width: 20, height: 4 }),
        useForSpacing: true,
      },
      {
        id: "right-neighbor",
        bounds: createMovementBounds({
          left: 80,
          top: 0,
          width: 20,
          height: 4,
        }),
        useForSpacing: true,
      },
      {
        id: "right-reference-end",
        bounds: createMovementBounds({
          left: 120.2,
          top: 0,
          width: 20,
          height: 4,
        }),
        useForSpacing: true,
      },
    ],
  });
  const plan = resolveMovementSnapPlan({
    baseline,
    intent: createMovementRawIntent({
      left: 39.9,
      top: 0,
      width: 20,
      height: 4,
      canSnapY: false,
    }),
    holdState: FREE_MOVEMENT_HOLD_STATE,
  });
  const constraint = plan.constraints.x;

  expect(constraint?.kind).toBe("spacing");
  if (constraint?.kind !== "spacing") {
    throw new Error("the primary equal spacing must be selected on X");
  }

  expect(constraint.selections).toHaveLength(1);
  expect(constraint.selections[0]?.identity.side).toBe("after");
  expect(plan.nextPosition.left).toBeCloseTo(39.8, 10);

  const [selection] = constraint.selections;
  if (selection === undefined) {
    throw new Error("the primary equal spacing must be selected on X");
  }
  expect(selection.guide.activeEnd - selection.guide.activeStart).toBeCloseTo(
    selection.guide.refEnd - selection.guide.refStart,
    10,
  );
});

it("shows only the primary interval when the secondary disappears after the actual move", () => {
  const baseline = createMovementBaseline({
    bounds: createMovementBounds({ left: 0, top: 0, width: 20, height: 4 }),
    sources: RELATED_REFERENCE_SPACING_SOURCES,
  });
  const plan = resolveMovementSnapPlan({
    baseline,
    intent: createMovementRawIntent({
      left: 40,
      top: 3,
      width: 20,
      height: 4,
      canSnapY: false,
    }),
    holdState: FREE_MOVEMENT_HOLD_STATE,
  });
  const verification = verifyMovementSnapPlan({
    baseline,
    plan,
    finalGeometry: createFinalMovementGeometry({
      left: 40,
      top: 4,
      width: 20,
      height: 4,
    }),
  });
  const xConstraint = plan.constraints.x;

  expect(xConstraint?.kind).toBe("spacing");
  if (xConstraint?.kind !== "spacing") {
    throw new Error(
      "two equal-spacing intervals must be selected on X before the move applies",
    );
  }

  expect(xConstraint.selections).toHaveLength(2);
  expect(verification.spacingGuides).toHaveLength(1);
  expect(verification.blockedAxes).toEqual([]);
  expect(verification.holdState.x.kind).toBe("spacing");
});

it("hides equal spacing when a closer neighbour appears after the move", () => {
  const baseline = createMovementBaseline({
    bounds: createMovementBounds({ left: 0, top: 0, width: 20, height: 4 }),
    sources: CHANGING_NEIGHBOR_SOURCES,
  });
  const plan = resolveMovementSnapPlan({
    baseline,
    intent: createMovementRawIntent({
      left: 33,
      top: 3,
      width: 20,
      height: 4,
      canSnapY: false,
    }),
    holdState: FREE_MOVEMENT_HOLD_STATE,
  });
  const verification = verifyMovementSnapPlan({
    baseline,
    plan,
    finalGeometry: createFinalMovementGeometry({
      left: 35,
      top: 4,
      width: 20,
      height: 4,
    }),
  });

  expect(plan.nextPosition).toEqual({ left: 35, top: 3 });
  expect(plan.constraints.x?.kind).toBe("spacing");
  expect(verification.spacingGuides).toHaveLength(0);
  expect(verification.guides).toHaveLength(0);
  expect(verification.blockedAxes).toEqual(["x"]);
  expect(verification.holdState.x.kind).toBe("free");
});

it("holds the line and ignores closer spacing on the same axis", () => {
  const baseline = createMovementBaseline({
    bounds: createMovementBounds({ left: 0, top: 0, width: 20, height: 30 }),
    sources: [
      ...HORIZONTAL_SPACING_SOURCES,
      {
        id: "line-source",
        bounds: createMovementBounds({
          left: 34,
          top: 0,
          width: 0,
          height: 300,
        }),
      },
    ],
  });
  const acquiredPlan = resolveMovementSnapPlan({
    baseline,
    intent: createMovementRawIntent({ left: 33, top: 100.6, width: 20 }),
    holdState: FREE_MOVEMENT_HOLD_STATE,
  });
  const acquired = verifyMovementSnapPlan({
    baseline,
    plan: acquiredPlan,
    finalGeometry: createFinalMovementGeometry({
      left: 34,
      top: 101,
      width: 20,
    }),
  });
  const heldPlan = resolveMovementSnapPlan({
    baseline,
    intent: createMovementRawIntent({ left: 38, top: 100.6, width: 20 }),
    holdState: acquired.holdState,
  });

  expect(acquiredPlan.constraints.x?.kind).toBe("line");
  expect(acquired.spacingGuides).toHaveLength(0);
  expect(acquired.holdState.x.kind).toBe("line");
  expect(heldPlan.constraints.x?.kind).toBe("line");
  expect(heldPlan.constraints.x?.transition).toBe("held");
  expect(heldPlan.nextPosition).toEqual({ left: 34, top: 101 });
});

it("chooses spacing when its new correction beats the line correction", () => {
  const baseline = createMovementBaseline({
    bounds: createMovementBounds({ left: 0, top: 0, width: 20, height: 30 }),
    sources: [
      ...HORIZONTAL_SPACING_SOURCES,
      {
        id: "line-source",
        bounds: createMovementBounds({
          left: 37,
          top: 0,
          width: 0,
          height: 300,
        }),
      },
    ],
  });
  const plan = resolveMovementSnapPlan({
    baseline,
    intent: createMovementRawIntent({ left: 33, top: 100.6, width: 20 }),
    holdState: FREE_MOVEMENT_HOLD_STATE,
  });
  const verified = verifyMovementSnapPlan({
    baseline,
    plan,
    finalGeometry: createFinalMovementGeometry({
      left: 35,
      top: 101,
      width: 20,
    }),
  });

  expect(plan.constraints.x?.kind).toBe("spacing");
  expect(plan.nextPosition).toEqual({ left: 35, top: 101 });
  expect(verified.guides).toHaveLength(0);
  expect(verified.spacingGuides.length).toBeGreaterThan(0);
  expect(verified.holdState.x.kind).toBe("spacing");
});

it("picks the artboard edge when distances are near-equal", () => {
  const baseline = createMovementBaseline({
    sources: [
      {
        id: "object-edge",
        bounds: createMovementBounds({
          left: 100,
          top: 0,
          width: 0,
          height: 300,
        }),
      },
      {
        id: "work-area",
        bounds: createMovementBounds({
          left: 100.0000000005,
          top: 0,
          width: 0,
          height: 300,
        }),
        edgeCategory: "domain-boundary",
      },
    ],
  });
  const plan = resolveMovementSnapPlan({
    baseline,
    intent: createMovementRawIntent({ left: 100, top: 400, canSnapY: false }),
    holdState: FREE_MOVEMENT_HOLD_STATE,
  });
  const constraint = plan.constraints.x;

  expect(constraint?.kind).toBe("line");
  if (constraint?.kind !== "line") {
    throw new Error("a regular guide must be selected in this scenario");
  }

  expect(constraint.candidate.id).toBe("work-area:left");
  expect(constraint.candidate.category).toBe("domain-boundary");
});

it("does not widen the free Y acquisition threshold because of an X spacing hold", () => {
  const baseline = createMovementBaseline({
    bounds: createMovementBounds({ left: 0, top: 0, width: 20, height: 20 }),
    sources: PER_AXIS_SPACING_SOURCES,
  });
  const acquiredPlan = resolveMovementSnapPlan({
    baseline,
    intent: createMovementRawIntent({
      left: 33,
      top: 200,
      width: 20,
      height: 20,
    }),
    holdState: FREE_MOVEMENT_HOLD_STATE,
  });
  const acquired = verifyMovementSnapPlan({
    baseline,
    plan: acquiredPlan,
    finalGeometry: createFinalMovementGeometry({
      left: 35,
      top: 200,
      width: 20,
      height: 20,
    }),
  });
  const heldPlan = resolveMovementSnapPlan({
    baseline,
    intent: createMovementRawIntent({
      left: 39,
      top: 28,
      width: 20,
      height: 20,
    }),
    holdState: acquired.holdState,
  });

  expect(acquired.holdState.x.kind).toBe("spacing");
  expect(acquired.holdState.y.kind).toBe("free");
  expect(heldPlan.constraints.x?.kind).toBe("spacing");
  expect(heldPlan.constraints.x?.transition).toBe("held");
  expect(heldPlan.constraints.y).toBeNull();
  expect(heldPlan.nextPosition).toEqual({ left: 35, top: 28 });
});

it("rejects spacing after the target is resized", () => {
  const baseline = createMovementBaseline({
    bounds: createMovementBounds({ left: 0, top: 0, width: 20, height: 30 }),
    sources: HORIZONTAL_SPACING_SOURCES,
  });
  const plan = resolveMovementSnapPlan({
    baseline,
    intent: createMovementRawIntent({ left: 33, top: 100.6, width: 20 }),
    holdState: FREE_MOVEMENT_HOLD_STATE,
  });
  const verification = verifyMovementSnapPlan({
    baseline,
    plan,
    finalGeometry: createFinalMovementGeometry({
      left: 35,
      top: 101,
      width: 21,
    }),
  });

  expect(plan.constraints.x?.kind).toBe("spacing");
  expect(verification.spacingGuides).toHaveLength(0);
  expect(verification.blockedAxes).toEqual(["x"]);
  expect(verification.holdState.x.kind).toBe("free");
});

it("rejects a raw intent that is not a translation of the start state", () => {
  const baseline = createMovementBaseline();
  const translated = createMovementRawIntent({ left: 10, top: 10 });

  expect(() => {
    resolveMovementSnapPlan({
      baseline,
      intent: createMovementRawIntent({ left: 10, top: 10, width: 31 }),
      holdState: FREE_MOVEMENT_HOLD_STATE,
    });
  }).toThrow("must be a translation of the gesture baseline");
  expect(() => {
    resolveMovementSnapPlan({
      baseline,
      intent: {
        ...translated,
        position: {
          left: translated.position.left + 1,
          top: translated.position.top,
        },
      },
      holdState: FREE_MOVEMENT_HOLD_STATE,
    });
  }).toThrow("must be a translation of the gesture baseline");
});
