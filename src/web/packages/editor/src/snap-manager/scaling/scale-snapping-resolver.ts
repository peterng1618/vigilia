// Ported: fork 9efdd78a src/editor/snapping-manager/scaling/scale-snapping-resolver.ts
/* eslint-disable no-use-before-define -- the public contracts sit above the internal calculations. */
import { SNAP_THRESHOLD, SPACING_SNAP_HOLD_MARGIN } from "../constants.js";
import type { ObjectBounds } from "../bounds.js";
import {
  createScaleProjection,
  getScaleProjectionCorrectionMagnitude,
  getScaleProjectionEdge,
  projectScaleEdgePositions,
  resolveScaleProjection,
  resolveScaleSceneEdgeAxis,
  type ProjectedScaleEdgePositions,
  type ScaleProjection,
  type ScaleProjectionConstraint,
  type ScaleProjectionInput,
  type ScaleProjectionSolution,
  type ScaleProjectionVariable,
  type ScaleSceneAxis,
  type ScaleSceneEdge,
} from "./scale-projection.js";

/** Guide category participating in the choice between equally distant candidates. */
export type ScaleSnapCandidateCategory =
  | "domain-boundary"
  | "edge"
  | "center"
  | "spacing";

/** A point in scene coordinates, independent of Fabric Point. */
export type ScaleScenePoint = Readonly<{
  x: number;
  y: number;
}>;

/** A named resize mode, before the gesture's raw data is validated. */
export type ScaleProjectionModeInput = Readonly<{
  id: string;
  projection: ScaleProjectionInput;
}>;

/** The validated resize mode for one gesture. */
export type ScaleProjectionMode = Readonly<{
  id: string;
  projection: ScaleProjection;
}>;

/** A snap candidate before the gesture's baseline state is captured. */
export type ScaleSnapCandidateInput = Readonly<{
  id: string;
  axis: ScaleSceneAxis;
  edge: ScaleSceneEdge;
  position: number;
  category: ScaleSnapCandidateCategory;
}>;

/** A candidate for one particular moving edge, captured for the gesture. */
export type ScaleSnapCandidate = Readonly<{
  id: string;
  axis: ScaleSceneAxis;
  edge: ScaleSceneEdge;
  position: number;
  category: ScaleSnapCandidateCategory;
  snapshotIndex: number;
}>;

/** Axis state without a held guide. */
export type FreeScaleAxisHold = Readonly<{
  kind: "free";
}>;

/** A held guide on one axis. */
export type HeldScaleAxisHold = Readonly<{
  kind: "held";
  candidate: ScaleSnapCandidate;
}>;

/** One axis free or held. */
export type ScaleAxisHold = FreeScaleAxisHold | HeldScaleAxisHold;

/** The temporary, independent snapping state of both axes. */
export type ScaleHoldState = Readonly<{
  x: ScaleAxisHold;
  y: ScaleAxisHold;
}>;

/** Snap thresholds in scene coordinates, with zoom applied. */
export type ScaleSnapThresholds = Readonly<{
  acquire: number;
  release: number;
  spacingRelease: number;
  verification: number;
}>;

/** The gesture's start geometry and the available resize modes. */
export type ScaleGestureBaselineInput = Readonly<{
  bounds: ObjectBounds;
  fixedAnchor: ScaleScenePoint;
  projectionModes: readonly ScaleProjectionModeInput[];
  candidates: readonly ScaleSnapCandidateInput[];
  zoom: number;
}>;

/** The validated snapshot of the state at gesture start. */
export type ScaleGestureBaseline = Readonly<{
  bounds: ObjectBounds;
  fixedAnchor: ScaleScenePoint;
  projectionModes: readonly ScaleProjectionMode[];
  candidates: readonly ScaleSnapCandidate[];
  thresholds: ScaleSnapThresholds;
}>;

/** Modifier-key state for one pointer event. */
export type ScaleSnapModifiers = Readonly<{
  ctrlKey: boolean;
  shiftKey: boolean;
}>;

/** The raw canonical values and the mode the object manager chose. */
export type ScaleRawIntent = Readonly<{
  projectionMode: string;
  values: readonly number[];
  modifiers: ScaleSnapModifiers;
}>;

/** Exact bounds and the face dependencies at the current step. */
export type ScaleStepProjectionInput = Readonly<{
  bounds: ObjectBounds;
  projection: ScaleProjectionInput;
}>;

/** The constraints of both axes chosen for one scaling step. */
export type ScaleSnapConstraints = Readonly<{
  x: PlannedScaleConstraint | null;
  y: PlannedScaleConstraint | null;
}>;

/** Translates the chosen guides into local size-projection constraints. */
export function createScaleProjectionConstraints({
  constraints,
}: {
  constraints: ScaleSnapConstraints;
}): readonly ScaleProjectionConstraint[] {
  const projectionConstraints = [constraints.x, constraints.y]
    .filter(
      (constraint): constraint is PlannedScaleConstraint => constraint !== null,
    )
    .map((constraint) =>
      Object.freeze({
        axis: constraint.axis,
        edge: constraint.candidate.edge,
        position: constraint.expectedPosition,
      }),
    );

  return Object.freeze(projectionConstraints);
}

/** The exact projection, canonical values and reached constraints after refinement. */
export type ScaleSnapPlanRefinement = Readonly<{
  constraints: ScaleSnapConstraints;
  effectiveValues: readonly number[];
  stepProjection: ScaleStepProjectionInput;
}>;

/** How the constraint was chosen at the current pointer step. */
export type ScaleSnapTransition = "acquired" | "held";

/** A constraint on one particular edge, which the object manager must apply once. */
export type PlannedScaleConstraint = Readonly<{
  axis: ScaleSceneAxis;
  candidate: ScaleSnapCandidate;
  transition: ScaleSnapTransition;
  expectedPosition: number;
}>;

/** The immutable result of the snapping calculation for one resize. */
export type ScaleSnapPlan = Readonly<{
  projectionMode: string;
  projection: ScaleProjection;
  variables: readonly ScaleProjectionVariable[];
  rawValues: readonly number[];
  effectiveValues: readonly number[];
  rawPositions: ProjectedScaleEdgePositions;
  effectivePositions: ProjectedScaleEdgePositions;
  constraints: ScaleSnapConstraints;
  refinementCandidates: ScaleSnapConstraints;
  proposedHoldState: ScaleHoldState;
  fixedAnchor: ScaleScenePoint;
  verificationEpsilon: number;
}>;

/** The result of applying one axis's constraint, as reported by the object manager. */
export type ScaleDomainAxisVerdict = "satisfied" | "blocked";

/** The result of applying the constraints and checking the object's protected properties. */
export type FinalScaleDomainVerdict = Readonly<{
  x: ScaleDomainAxisVerdict;
  y: ScaleDomainAxisVerdict;
  protectedState: "preserved" | "changed";
}>;

/** The actual geometry after the plan has been applied once. */
export type FinalScaleGeometry = Readonly<{
  bounds: ObjectBounds;
  fixedAnchor: ScaleScenePoint;
  measuredValues: readonly number[];
  domainVerdict: FinalScaleDomainVerdict;
}>;

/** A guide the object actually reached after the plan was applied. */
export type VerifiedScaleGuide = Readonly<{
  axis: ScaleSceneAxis;
  edge: ScaleSceneEdge;
  position: number;
  candidateId: string;
  category: ScaleSnapCandidateCategory;
  snapshotIndex: number;
}>;

/** The result of checking the applied plan, without resizing the object again. */
export type ScaleSnapVerification = Readonly<{
  guides: readonly VerifiedScaleGuide[];
  blockedAxes: readonly ScaleSceneAxis[];
  holdState: ScaleHoldState;
}>;

/** A candidate on one axis, before checking compatibility with the other axis. */
type ScaleAxisProposal = Readonly<{
  axis: ScaleSceneAxis;
  candidate: ScaleSnapCandidate;
  transition: ScaleSnapTransition;
}>;

/** The compatible constraints and the canonical values calculated for them. */
type ResolvedScaleProposals = Readonly<{
  x: ScaleAxisProposal | null;
  y: ScaleAxisProposal | null;
  solution: ScaleProjectionSolution;
}>;

/** Common tolerance for checking the guide and the fixed point in scene coordinates. */
export const SCALE_SNAP_VERIFICATION_EPSILON = 0.1;

/** Tolerance for checking centres derived from exact bounds. */
const EXACT_BOUNDS_CENTER_EPSILON = 0.000000001;

/** Tolerance within which two displacements are considered equal. */
const SCALE_CORRECTION_COMPARISON_EPSILON = 0.000000001;

/** Category order used when candidates require the same displacement. */
const SCALE_CANDIDATE_CATEGORY_PRIORITY: Readonly<
  Record<ScaleSnapCandidateCategory, number>
> = Object.freeze({
  "domain-boundary": 0,
  edge: 1,
  center: 2,
  spacing: 3,
});

/** The shared immutable axis state without snapping. */
const FREE_SCALE_AXIS_HOLD: FreeScaleAxisHold = Object.freeze({ kind: "free" });

/** The initial state without held guides. */
export const FREE_SCALE_HOLD_STATE: ScaleHoldState = Object.freeze({
  x: FREE_SCALE_AXIS_HOLD,
  y: FREE_SCALE_AXIS_HOLD,
});

/**
 * Validates and captures the geometry, scale modes, candidates and thresholds at gesture start.
 */
export function createScaleGestureBaseline({
  bounds,
  fixedAnchor,
  projectionModes,
  candidates,
  zoom,
}: ScaleGestureBaselineInput): ScaleGestureBaseline {
  const exactBounds = createExactBoundsSnapshot({ bounds });
  const anchorSnapshot = createScenePointSnapshot({
    point: fixedAnchor,
    name: "fixed anchor",
  });
  const modeSnapshot = createProjectionModeSnapshot({
    bounds: exactBounds,
    projectionModes,
  });
  const candidateSnapshot = createCandidateSnapshot({
    candidates,
    projectionModes: modeSnapshot,
  });

  return Object.freeze({
    bounds: exactBounds,
    fixedAnchor: anchorSnapshot,
    projectionModes: modeSnapshot,
    candidates: candidateSnapshot,
    thresholds: createScaleSnapThresholds({ zoom }),
  });
}

/**
 * Calculates a new snapping plan, or keeps holding the chosen guides.
 */
export function resolveScaleSnapPlan({
  baseline,
  intent,
  holdState,
  stepProjection,
}: {
  baseline: ScaleGestureBaseline;
  intent: ScaleRawIntent;
  holdState: ScaleHoldState;
  stepProjection?: ScaleStepProjectionInput;
}): ScaleSnapPlan {
  const baselineMode = resolveProjectionMode({
    baseline,
    modeId: intent.projectionMode,
  });
  const projectionMode = resolveStepProjectionMode({
    baselineMode,
    ...(stepProjection ? { stepProjection } : {}),
  });
  assertScaleRawIntent({ projection: projectionMode.projection, intent });
  assertScaleHoldState({ baseline, holdState });

  const rawValues = Object.freeze([...intent.values]);
  const rawPositions = projectScaleEdgePositions({
    projection: projectionMode.projection,
    values: rawValues,
  });
  if (intent.modifiers.ctrlKey) {
    return createScaleSnapPlan({
      baseline,
      projectionMode,
      rawValues,
      rawPositions,
      proposals: Object.freeze({ x: null, y: null }),
      resolved: null,
    });
  }

  const axisProposalContext = {
    baseline,
    projectionMode,
    rawPositions,
    rawValues,
  };
  const x = resolveAxisProposal({
    ...axisProposalContext,
    axis: "x",
    hold: holdState.x,
  });
  const y = resolveAxisProposal({
    ...axisProposalContext,
    axis: "y",
    hold: holdState.y,
  });
  const resolved = resolveCompatibleProposals({
    baseline,
    projectionMode,
    rawValues,
    x,
    y,
  });

  return createScaleSnapPlan({
    baseline,
    projectionMode,
    rawValues,
    rawPositions,
    proposals: Object.freeze({ x, y }),
    resolved,
  });
}

/**
 * Refines the values and the applicable constraints from the object's actual geometry.
 * The original pointer position and the candidates available for refinement do not change.
 */
export function refineScaleSnapPlan({
  plan,
  refinement,
}: {
  plan: ScaleSnapPlan;
  refinement: ScaleSnapPlanRefinement;
}): ScaleSnapPlan {
  const projectionMode = resolveStepProjectionMode({
    baselineMode: Object.freeze({
      id: plan.projectionMode,
      projection: plan.projection,
    }),
    stepProjection: refinement.stepProjection,
  });
  const effectiveValues = Object.freeze([...refinement.effectiveValues]);
  assertScaleValues({
    projection: projectionMode.projection,
    values: effectiveValues,
  });
  const constraints = createRefinedScaleConstraints({
    candidates: plan.refinementCandidates,
    constraints: refinement.constraints,
  });

  const effectivePositions = projectScaleEdgePositions({
    projection: projectionMode.projection,
    values: effectiveValues,
  });
  assertRefinedConstraintsReached({
    bounds: refinement.stepProjection.bounds,
    constraints,
    effectivePositions,
    verificationEpsilon: plan.verificationEpsilon,
  });

  return Object.freeze({
    ...plan,
    projection: projectionMode.projection,
    variables: projectionMode.projection.variables,
    effectiveValues,
    effectivePositions,
    constraints,
    proposedHoldState: createHoldStateFromConstraints(constraints),
  });
}

/**
 * Uses either the gesture's original projection or the exact local model of the current step.
 */
function resolveStepProjectionMode({
  baselineMode,
  stepProjection,
}: {
  baselineMode: ScaleProjectionMode;
  stepProjection?: ScaleStepProjectionInput;
}): ScaleProjectionMode {
  if (!stepProjection) return baselineMode;

  const bounds = createExactBoundsSnapshot({ bounds: stepProjection.bounds });
  const projection = createScaleProjection({
    bounds,
    input: stepProjection.projection,
  });
  assertStepProjectionContract({
    baseline: baselineMode.projection,
    step: projection,
  });

  return Object.freeze({ id: baselineMode.id, projection });
}

/** Validates that the local projection preserves the gesture's variables and moving edges. */
function assertStepProjectionContract({
  baseline,
  step,
}: {
  baseline: ScaleProjection;
  step: ScaleProjection;
}): void {
  const hasSameVariables =
    baseline.variables.length === step.variables.length &&
    baseline.variables.every(
      (variable, index) => variable === step.variables[index],
    );
  if (!hasSameVariables) {
    throw new Error("Scale step projection must preserve gesture variables");
  }

  const baselineEdges = baseline.edges.map(({ edge }) => edge).sort();
  const stepEdges = step.edges.map(({ edge }) => edge).sort();
  const hasSameEdges =
    baselineEdges.length === stepEdges.length &&
    baselineEdges.every((edge, index) => edge === stepEdges[index]);
  if (!hasSameEdges) {
    throw new Error("Scale step projection must preserve gesture edges");
  }
}

/**
 * Checks the plan against the actual geometry and the object manager's applied result.
 */
export function verifyScaleSnapPlan({
  plan,
  finalGeometry,
}: {
  plan: ScaleSnapPlan;
  finalGeometry: FinalScaleGeometry;
}): ScaleSnapVerification {
  const { measuredValues, domainVerdict } = finalGeometry;
  const bounds = createExactBoundsSnapshot({ bounds: finalGeometry.bounds });
  const fixedAnchor = createScenePointSnapshot({
    point: finalGeometry.fixedAnchor,
    name: "final fixed anchor",
  });
  const fixedAnchorMatches = areScenePointsNear({
    first: plan.fixedAnchor,
    second: fixedAnchor,
    epsilon: plan.verificationEpsilon,
  });
  const measuredPositions = projectMeasuredScalePositions({
    plan,
    measuredValues,
  });
  const commonStateMatches =
    fixedAnchorMatches && domainVerdict.protectedState === "preserved";

  const xVerified =
    commonStateMatches &&
    domainVerdict.x === "satisfied" &&
    isMeasuredConstraintEquivalent({
      constraint: plan.constraints.x,
      measuredPositions,
      plan,
    }) &&
    isConstraintReached({ constraint: plan.constraints.x, bounds, plan });
  const yVerified =
    commonStateMatches &&
    domainVerdict.y === "satisfied" &&
    isMeasuredConstraintEquivalent({
      constraint: plan.constraints.y,
      measuredPositions,
      plan,
    }) &&
    isConstraintReached({ constraint: plan.constraints.y, bounds, plan });

  return createScaleSnapVerification({ plan, xVerified, yVerified });
}

/**
 * Converts the thresholds from screen pixels into scene coordinates, with zoom applied.
 */
function createScaleSnapThresholds({
  zoom,
}: {
  zoom: number;
}): ScaleSnapThresholds {
  if (!Number.isFinite(zoom) || zoom <= 0) {
    throw new Error("Scale snapping zoom must be a finite positive number");
  }

  return Object.freeze({
    acquire: SNAP_THRESHOLD / zoom,
    release: SNAP_THRESHOLD / zoom,
    spacingRelease: (SNAP_THRESHOLD + SPACING_SNAP_HOLD_MARGIN) / zoom,
    verification: SCALE_SNAP_VERIFICATION_EPSILON,
  });
}

/**
 * Validates and copies the exact bounds without rounding.
 */
function createExactBoundsSnapshot({
  bounds,
}: {
  bounds: ObjectBounds;
}): ObjectBounds {
  const { left, right, top, bottom, centerX, centerY } = bounds;
  const edges = [left, right, top, bottom];
  if (!edges.every(Number.isFinite) || right < left || bottom < top) {
    throw new Error("Scale snapping bounds must contain finite ordered edges");
  }
  if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) {
    throw new Error("Scale snapping bounds must contain finite centers");
  }

  const expectedCenterX = left + (right - left) / 2;
  const expectedCenterY = top + (bottom - top) / 2;
  if (
    Math.abs(centerX - expectedCenterX) > EXACT_BOUNDS_CENTER_EPSILON ||
    Math.abs(centerY - expectedCenterY) > EXACT_BOUNDS_CENTER_EPSILON
  ) {
    throw new Error(
      "Scale snapping bounds centers must be derived from their edges",
    );
  }

  return Object.freeze({ left, right, top, bottom, centerX, centerY });
}

/**
 * Validates and copies a point in scene coordinates.
 */
function createScenePointSnapshot({
  point,
  name,
}: {
  point: ScaleScenePoint;
  name: string;
}): ScaleScenePoint {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new Error(`Scale snapping ${name} must contain finite coordinates`);
  }

  return Object.freeze({ x: point.x, y: point.y });
}

/**
 * Validates and captures every available resize mode.
 */
function createProjectionModeSnapshot({
  bounds,
  projectionModes,
}: {
  bounds: ObjectBounds;
  projectionModes: readonly ScaleProjectionModeInput[];
}): readonly ScaleProjectionMode[] {
  if (projectionModes.length === 0) {
    throw new Error(
      "Scale gesture baseline must contain at least one projection mode",
    );
  }

  const modeIds = new Set<string>();
  const snapshot = projectionModes.map(({ id, projection }) => {
    if (id.trim().length === 0 || modeIds.has(id)) {
      throw new Error(
        `Scale projection mode id "${id}" must be non-empty and unique`,
      );
    }
    modeIds.add(id);

    return Object.freeze({
      id,
      projection: createScaleProjection({ bounds, input: projection }),
    });
  });

  return Object.freeze(snapshot);
}

/**
 * Returns the mode the object manager chose for the current pointer event.
 */
function resolveProjectionMode({
  baseline,
  modeId,
}: {
  baseline: ScaleGestureBaseline;
  modeId: string;
}): ScaleProjectionMode {
  const projectionMode = baseline.projectionModes.find(
    ({ id }) => id === modeId,
  );
  if (!projectionMode) {
    throw new Error(`Unknown scale projection mode "${modeId}"`);
  }

  return projectionMode;
}

/**
 * Validates the candidates and keeps their original order for the gesture.
 */
function createCandidateSnapshot({
  candidates,
  projectionModes,
}: {
  candidates: readonly ScaleSnapCandidateInput[];
  projectionModes: readonly ScaleProjectionMode[];
}): readonly ScaleSnapCandidate[] {
  const candidateIds = new Set<string>();
  const snapshot = candidates.map((candidate, snapshotIndex) => {
    assertScaleCandidate({ candidate, projectionModes, candidateIds });
    candidateIds.add(candidate.id);

    return Object.freeze({ ...candidate, snapshotIndex });
  });

  return Object.freeze(snapshot);
}

/**
 * Validates a candidate's id, axis and support by at least one mode.
 */
function assertScaleCandidate({
  candidate,
  projectionModes,
  candidateIds,
}: {
  candidate: ScaleSnapCandidateInput;
  projectionModes: readonly ScaleProjectionMode[];
  candidateIds: ReadonlySet<string>;
}): void {
  if (candidate.id.trim().length === 0 || candidateIds.has(candidate.id)) {
    throw new Error(
      `Scale snap candidate id "${candidate.id}" must be non-empty and unique`,
    );
  }
  if (!Number.isFinite(candidate.position)) {
    throw new Error(
      `Scale snap candidate "${candidate.id}" position must be finite`,
    );
  }
  if (resolveScaleSceneEdgeAxis({ edge: candidate.edge }) !== candidate.axis) {
    throw new Error(
      `Scale snap candidate "${candidate.id}" edge does not belong to ${candidate.axis} axis`,
    );
  }

  const isSupported = projectionModes.some(({ projection }) => {
    return Boolean(
      getScaleProjectionEdge({ projection, edge: candidate.edge }),
    );
  });
  if (!isSupported) {
    throw new Error(
      `Scale snap candidate "${candidate.id}" edge is not moved by any projection mode`,
    );
  }
}

/**
 * Validates the raw canonical values for the chosen mode.
 */
function assertScaleRawIntent({
  projection,
  intent,
}: {
  projection: ScaleProjection;
  intent: ScaleRawIntent;
}): void {
  if (intent.values.length !== projection.variables.length) {
    throw new Error("Scale raw intent has invalid values length");
  }
  if (!intent.values.every(Number.isFinite)) {
    throw new Error("Scale raw intent values must be finite");
  }
  if (
    typeof intent.modifiers.ctrlKey !== "boolean" ||
    typeof intent.modifiers.shiftKey !== "boolean"
  ) {
    throw new Error("Scale raw intent modifiers must be boolean");
  }
}

/** Validates the canonical values of the refined projection. */
function assertScaleValues({
  projection,
  values,
}: {
  projection: ScaleProjection;
  values: readonly number[];
}): void {
  if (values.length !== projection.variables.length) {
    throw new Error("Scale refinement has invalid values length");
  }
  if (!values.every(Number.isFinite)) {
    throw new Error("Scale refinement values must be finite");
  }
}

/** Validates that the refined plan's exact geometry reaches the original constraints. */
function assertRefinedConstraintsReached({
  bounds,
  constraints,
  effectivePositions,
  verificationEpsilon,
}: {
  bounds: ObjectBounds;
  constraints: ScaleSnapConstraints;
  effectivePositions: ProjectedScaleEdgePositions;
  verificationEpsilon: number;
}): void {
  for (const constraint of [constraints.x, constraints.y]) {
    if (!constraint) continue;

    const { edge } = constraint.candidate;
    const projectedPosition = effectivePositions[edge];
    const exactPosition = bounds[edge];
    if (
      projectedPosition === null ||
      Math.abs(projectedPosition - constraint.expectedPosition) >
        verificationEpsilon ||
      Math.abs(exactPosition - constraint.expectedPosition) >
        verificationEpsilon
    ) {
      throw new Error(`Refined scale plan does not reach ${edge} constraint`);
    }
  }
}

/** Validates the chosen constraints and builds their immutable snapshot. */
function createRefinedScaleConstraints({
  candidates,
  constraints,
}: {
  candidates: ScaleSnapConstraints;
  constraints: ScaleSnapConstraints;
}): ScaleSnapConstraints {
  return Object.freeze({
    x: resolveRefinedScaleConstraint({
      axis: "x",
      candidate: candidates.x,
      constraint: constraints.x,
    }),
    y: resolveRefinedScaleConstraint({
      axis: "y",
      candidate: candidates.y,
      constraint: constraints.y,
    }),
  });
}

/** Validates the chosen constraint and returns the snapshot from the original plan. */
function resolveRefinedScaleConstraint({
  axis,
  candidate,
  constraint,
}: {
  axis: ScaleSceneAxis;
  candidate: PlannedScaleConstraint | null;
  constraint: PlannedScaleConstraint | null;
}): PlannedScaleConstraint | null {
  if (!constraint) return null;
  if (
    !candidate ||
    !arePlannedScaleConstraintsEqual({ first: candidate, second: constraint })
  ) {
    throw new Error(
      `Refined ${axis} constraint does not belong to scale plan candidates`,
    );
  }

  return candidate;
}

/**
 * Validates that the held candidate belongs to the current gesture.
 */
function assertScaleHoldState({
  baseline,
  holdState,
}: {
  baseline: ScaleGestureBaseline;
  holdState: ScaleHoldState;
}): void {
  for (const axis of ["x", "y"] as const) {
    const axisHold = holdState[axis];
    if (axisHold.kind === "free") continue;
    if (axisHold.candidate.axis !== axis) {
      throw new Error(
        `Held scale candidate belongs to ${axisHold.candidate.axis}, not ${axis} axis`,
      );
    }

    const baselineCandidate =
      baseline.candidates[axisHold.candidate.snapshotIndex];
    if (
      !baselineCandidate ||
      !areScaleCandidatesEqual({
        first: baselineCandidate,
        second: axisHold.candidate,
      })
    ) {
      throw new Error(
        `Held scale candidate "${axisHold.candidate.id}" does not belong to baseline snapshot`,
      );
    }
  }
}

/**
 * Keeps the held guide, or chooses a new candidate on one axis.
 */
function resolveAxisProposal({
  axis,
  baseline,
  projectionMode,
  rawPositions,
  rawValues,
  hold,
}: {
  axis: ScaleSceneAxis;
  baseline: ScaleGestureBaseline;
  projectionMode: ScaleProjectionMode;
  rawPositions: ProjectedScaleEdgePositions;
  rawValues: readonly number[];
  hold: ScaleAxisHold;
}): ScaleAxisProposal | null {
  if (hold.kind === "held") {
    const rawPosition = rawPositions[hold.candidate.edge];
    const releaseThreshold =
      hold.candidate.category === "spacing"
        ? baseline.thresholds.spacingRelease
        : baseline.thresholds.release;
    if (
      rawPosition !== null &&
      Math.abs(rawPosition - hold.candidate.position) <= releaseThreshold &&
      canProjectScaleCandidate({
        baseline,
        candidate: hold.candidate,
        projectionMode,
        rawValues,
      })
    ) {
      return Object.freeze({
        axis,
        candidate: hold.candidate,
        transition: "held",
      });
    }
  }

  const candidate = findBestScaleCandidate({
    axis,
    baseline,
    projectionMode,
    rawPositions,
    rawValues,
  });
  if (!candidate) return null;

  return Object.freeze({ axis, candidate, transition: "acquired" });
}

/**
 * Chooses the nearest candidate, with category and original order as tie-breaks.
 */
function findBestScaleCandidate({
  axis,
  baseline,
  projectionMode,
  rawPositions,
  rawValues,
}: {
  axis: ScaleSceneAxis;
  baseline: ScaleGestureBaseline;
  projectionMode: ScaleProjectionMode;
  rawPositions: ProjectedScaleEdgePositions;
  rawValues: readonly number[];
}): ScaleSnapCandidate | null {
  let bestCandidate: ScaleSnapCandidate | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of baseline.candidates) {
    if (candidate.axis !== axis) continue;
    if (
      !getScaleProjectionEdge({
        projection: projectionMode.projection,
        edge: candidate.edge,
      })
    ) {
      continue;
    }

    const rawPosition = rawPositions[candidate.edge];
    if (rawPosition === null) continue;
    const distance = Math.abs(candidate.position - rawPosition);
    if (distance > baseline.thresholds.acquire) continue;
    if (
      !canProjectScaleCandidate({
        baseline,
        candidate,
        projectionMode,
        rawValues,
      })
    )
      continue;
    if (
      isScaleCandidatePreferred({
        candidate,
        distance,
        bestCandidate,
        bestDistance,
      })
    ) {
      bestCandidate = candidate;
      bestDistance = distance;
    }
  }

  return bestCandidate;
}

/** Validates that the candidate's constraint can be satisfied in the step's local projection. */
function canProjectScaleCandidate({
  baseline,
  candidate,
  projectionMode,
  rawValues,
}: {
  baseline: ScaleGestureBaseline;
  candidate: ScaleSnapCandidate;
  projectionMode: ScaleProjectionMode;
  rawValues: readonly number[];
}): boolean {
  return (
    resolveScaleProjection({
      projection: projectionMode.projection,
      rawValues,
      constraints: [
        {
          axis: candidate.axis,
          edge: candidate.edge,
          position: candidate.position,
        },
      ],
      epsilon: baseline.thresholds.verification,
    }) !== null
  );
}

/**
 * Compares candidates by distance, category and original order.
 */
function isScaleCandidatePreferred({
  candidate,
  distance,
  bestCandidate,
  bestDistance,
}: {
  candidate: ScaleSnapCandidate;
  distance: number;
  bestCandidate: ScaleSnapCandidate | null;
  bestDistance: number;
}): boolean {
  if (!bestCandidate) return true;

  const distanceDifference = distance - bestDistance;
  if (distanceDifference < -SCALE_CORRECTION_COMPARISON_EPSILON) return true;
  if (distanceDifference > SCALE_CORRECTION_COMPARISON_EPSILON) return false;

  const categoryPriority =
    SCALE_CANDIDATE_CATEGORY_PRIORITY[candidate.category];
  const bestCategoryPriority =
    SCALE_CANDIDATE_CATEGORY_PRIORITY[bestCandidate.category];
  if (categoryPriority !== bestCategoryPriority) {
    return categoryPriority < bestCategoryPriority;
  }

  return candidate.snapshotIndex < bestCandidate.snapshotIndex;
}

/**
 * Combines the constraints of both axes, or keeps the one priority constraint.
 */
function resolveCompatibleProposals({
  baseline,
  projectionMode,
  rawValues,
  x,
  y,
}: {
  baseline: ScaleGestureBaseline;
  projectionMode: ScaleProjectionMode;
  rawValues: readonly number[];
  x: ScaleAxisProposal | null;
  y: ScaleAxisProposal | null;
}): ResolvedScaleProposals {
  const orderedProposals = orderScaleProposals({
    projectionMode,
    rawValues,
    x,
    y,
  });
  const constraints = orderedProposals.map(createProjectionConstraint);
  const solution = resolveScaleProjection({
    projection: projectionMode.projection,
    rawValues,
    constraints,
    epsilon: baseline.thresholds.verification,
  });

  if (solution) return Object.freeze({ x, y, solution });
  const [preferred] = orderedProposals;
  if (!preferred) {
    throw new Error("Raw scale intent must have a projection solution");
  }

  const preferredSolution = resolveScaleProjection({
    projection: projectionMode.projection,
    rawValues,
    constraints: [createProjectionConstraint(preferred)],
    epsilon: baseline.thresholds.verification,
  });
  if (!preferredSolution) {
    throw new Error(
      `Scale constraint for ${preferred.candidate.edge} edge must have a projection solution`,
    );
  }

  return Object.freeze({
    x: preferred.axis === "x" ? preferred : null,
    y: preferred.axis === "y" ? preferred : null,
    solution: preferredSolution,
  });
}

/**
 * Orders a held constraint first, then the smaller correction, then the X axis.
 */
function orderScaleProposals({
  projectionMode,
  rawValues,
  x,
  y,
}: {
  projectionMode: ScaleProjectionMode;
  rawValues: readonly number[];
  x: ScaleAxisProposal | null;
  y: ScaleAxisProposal | null;
}): readonly ScaleAxisProposal[] {
  const proposals: ScaleAxisProposal[] = [];
  if (x) proposals.push(x);
  if (y) proposals.push(y);
  if (!x || !y) return Object.freeze(proposals);

  const preferred = selectPrimaryScaleProposal({
    projectionMode,
    rawValues,
    x,
    y,
  });
  return preferred.axis === "x" ? Object.freeze([x, y]) : Object.freeze([y, x]);
}

/**
 * Chooses the single constraint when the two constraints cannot be applied together.
 */
function selectPrimaryScaleProposal({
  projectionMode,
  rawValues,
  x,
  y,
}: {
  projectionMode: ScaleProjectionMode;
  rawValues: readonly number[];
  x: ScaleAxisProposal;
  y: ScaleAxisProposal;
}): ScaleAxisProposal {
  if (x.transition !== y.transition) return x.transition === "held" ? x : y;

  const xMagnitude = getProposalCorrectionMagnitude({
    projectionMode,
    rawValues,
    proposal: x,
  });
  const yMagnitude = getProposalCorrectionMagnitude({
    projectionMode,
    rawValues,
    proposal: y,
  });
  const magnitudeDifference = xMagnitude - yMagnitude;
  if (magnitudeDifference < -SCALE_CORRECTION_COMPARISON_EPSILON) return x;
  if (magnitudeDifference > SCALE_CORRECTION_COMPARISON_EPSILON) return y;

  return x;
}

/**
 * Returns the scale change one constraint needs.
 */
function getProposalCorrectionMagnitude({
  projectionMode,
  rawValues,
  proposal,
}: {
  projectionMode: ScaleProjectionMode;
  rawValues: readonly number[];
  proposal: ScaleAxisProposal;
}): number {
  return getScaleProjectionCorrectionMagnitude({
    projection: projectionMode.projection,
    rawValues,
    constraint: createProjectionConstraint(proposal),
  });
}

/**
 * Turns the chosen candidate into a constraint for one particular edge.
 */
function createProjectionConstraint(
  proposal: ScaleAxisProposal,
): ScaleProjectionConstraint {
  return Object.freeze({
    axis: proposal.axis,
    edge: proposal.candidate.edge,
    position: proposal.candidate.position,
  });
}

/**
 * Assembles the plan with snapping, or with the raw values and no snapping.
 */
function createScaleSnapPlan({
  baseline,
  projectionMode,
  rawValues,
  rawPositions,
  proposals,
  resolved,
}: {
  baseline: ScaleGestureBaseline;
  projectionMode: ScaleProjectionMode;
  rawValues: readonly number[];
  rawPositions: ProjectedScaleEdgePositions;
  proposals: Readonly<{
    x: ScaleAxisProposal | null;
    y: ScaleAxisProposal | null;
  }>;
  resolved: ResolvedScaleProposals | null;
}): ScaleSnapPlan {
  const effectiveValues = resolved ? resolved.solution.values : rawValues;
  const effectivePositions = resolved
    ? resolved.solution.positions
    : rawPositions;
  const constraints = createPlannedScaleConstraints({
    x: resolved?.x ?? null,
    y: resolved?.y ?? null,
  });
  const refinementCandidates = createPlannedScaleConstraints(proposals);
  assertEffectiveConstraintsReached({
    constraints,
    effectivePositions,
    verificationEpsilon: baseline.thresholds.verification,
  });

  return Object.freeze({
    projectionMode: projectionMode.id,
    projection: projectionMode.projection,
    variables: projectionMode.projection.variables,
    rawValues,
    effectiveValues,
    rawPositions,
    effectivePositions,
    constraints,
    refinementCandidates,
    proposedHoldState: createHoldStateFromConstraints(constraints),
    fixedAnchor: baseline.fixedAnchor,
    verificationEpsilon: baseline.thresholds.verification,
  });
}

/** Turns the axis proposals into the plan's immutable constraints. */
function createPlannedScaleConstraints({
  x,
  y,
}: {
  x: ScaleAxisProposal | null;
  y: ScaleAxisProposal | null;
}): ScaleSnapConstraints {
  return Object.freeze({
    x: x ? createPlannedConstraint(x) : null,
    y: y ? createPlannedConstraint(y) : null,
  });
}

/** Validates that the applicable constraints match the calculated edges. */
function assertEffectiveConstraintsReached({
  constraints,
  effectivePositions,
  verificationEpsilon,
}: {
  constraints: ScaleSnapConstraints;
  effectivePositions: ProjectedScaleEdgePositions;
  verificationEpsilon: number;
}): void {
  for (const constraint of [constraints.x, constraints.y]) {
    if (!constraint) continue;

    const position = effectivePositions[constraint.candidate.edge];
    if (
      position === null ||
      Math.abs(position - constraint.expectedPosition) > verificationEpsilon
    ) {
      throw new Error(
        `Scale plan does not reach ${constraint.candidate.edge} constraint`,
      );
    }
  }
}

/**
 * Keeps the chosen constraint in the plan.
 */
function createPlannedConstraint(
  proposal: ScaleAxisProposal,
): PlannedScaleConstraint {
  return Object.freeze({
    axis: proposal.axis,
    candidate: proposal.candidate,
    transition: proposal.transition,
    expectedPosition: proposal.candidate.position,
  });
}

/**
 * Keeps only the compatible constraints for the next step.
 */
function createHoldStateFromConstraints({
  x,
  y,
}: ScaleSnapConstraints): ScaleHoldState {
  return Object.freeze({
    x: createAxisHold({ constraint: x }),
    y: createAxisHold({ constraint: y }),
  });
}

/**
 * Builds the immutable state of one axis.
 */
function createAxisHold({
  constraint,
}: {
  constraint: PlannedScaleConstraint | null;
}): ScaleAxisHold {
  if (!constraint) return FREE_SCALE_AXIS_HOLD;

  return Object.freeze({ kind: "held", candidate: constraint.candidate });
}

/**
 * Checks against the final exact bounds that the object reached the guide.
 */
function isConstraintReached({
  constraint,
  bounds,
  plan,
}: {
  constraint: PlannedScaleConstraint | null;
  bounds: ObjectBounds;
  plan: ScaleSnapPlan;
}): boolean {
  if (!constraint) return false;

  const finalPosition = bounds[constraint.candidate.edge];
  return (
    Math.abs(finalPosition - constraint.expectedPosition) <=
    plan.verificationEpsilon
  );
}

/**
 * Calculates the edge positions for the scale values that were actually applied.
 */
function projectMeasuredScalePositions({
  plan,
  measuredValues,
}: {
  plan: ScaleSnapPlan;
  measuredValues: readonly number[];
}): ProjectedScaleEdgePositions | null {
  if (measuredValues.length !== plan.projection.variables.length) return null;
  if (!measuredValues.every(Number.isFinite)) return null;

  return projectScaleEdgePositions({
    projection: plan.projection,
    values: measuredValues,
  });
}

/**
 * Checks the actual position of only the edge the constraint depends on.
 */
function isMeasuredConstraintEquivalent({
  constraint,
  measuredPositions,
  plan,
}: {
  constraint: PlannedScaleConstraint | null;
  measuredPositions: ProjectedScaleEdgePositions | null;
  plan: ScaleSnapPlan;
}): boolean {
  if (!constraint || !measuredPositions) return false;

  const { edge } = constraint.candidate;
  const measuredPosition = measuredPositions[edge];
  const effectivePosition = plan.effectivePositions[edge];
  if (measuredPosition === null || effectivePosition === null) return false;

  return (
    Math.abs(measuredPosition - effectivePosition) <= plan.verificationEpsilon
  );
}

/**
 * Builds the confirmed guides, the blocked axes and the new hold state.
 */
function createScaleSnapVerification({
  plan,
  xVerified,
  yVerified,
}: {
  plan: ScaleSnapPlan;
  xVerified: boolean;
  yVerified: boolean;
}): ScaleSnapVerification {
  const guides: VerifiedScaleGuide[] = [];
  const blockedAxes: ScaleSceneAxis[] = [];
  const x = resolveVerifiedAxisHold({
    constraint: plan.constraints.x,
    verified: xVerified,
    guides,
    blockedAxes,
  });
  const y = resolveVerifiedAxisHold({
    constraint: plan.constraints.y,
    verified: yVerified,
    guides,
    blockedAxes,
  });

  return Object.freeze({
    guides: Object.freeze(guides),
    blockedAxes: Object.freeze(blockedAxes),
    holdState: Object.freeze({ x, y }),
  });
}

/**
 * Keeps the axis hold only for a constraint that was satisfied.
 */
function resolveVerifiedAxisHold({
  constraint,
  verified,
  guides,
  blockedAxes,
}: {
  constraint: PlannedScaleConstraint | null;
  verified: boolean;
  guides: VerifiedScaleGuide[];
  blockedAxes: ScaleSceneAxis[];
}): ScaleAxisHold {
  if (!constraint) return FREE_SCALE_AXIS_HOLD;
  if (!verified) {
    blockedAxes.push(constraint.axis);
    return FREE_SCALE_AXIS_HOLD;
  }

  guides.push(createVerifiedGuide(constraint));
  return Object.freeze({ kind: "held", candidate: constraint.candidate });
}

/**
 * Builds a confirmed guide carrying the source candidate's id.
 */
function createVerifiedGuide(
  constraint: PlannedScaleConstraint,
): VerifiedScaleGuide {
  const { candidate } = constraint;

  return Object.freeze({
    axis: constraint.axis,
    edge: candidate.edge,
    position: candidate.position,
    candidateId: candidate.id,
    category: candidate.category,
    snapshotIndex: candidate.snapshotIndex,
  });
}

/**
 * Checks that two points match within the common tolerance.
 */
function areScenePointsNear({
  first,
  second,
  epsilon,
}: {
  first: ScaleScenePoint;
  second: ScaleScenePoint;
  epsilon: number;
}): boolean {
  return (
    Math.abs(first.x - second.x) <= epsilon &&
    Math.abs(first.y - second.y) <= epsilon
  );
}

/**
 * Checks that two captured candidates match exactly.
 */
function areScaleCandidatesEqual({
  first,
  second,
}: {
  first: ScaleSnapCandidate;
  second: ScaleSnapCandidate;
}): boolean {
  return (
    first.id === second.id &&
    first.axis === second.axis &&
    first.edge === second.edge &&
    first.position === second.position &&
    first.category === second.category &&
    first.snapshotIndex === second.snapshotIndex
  );
}

/** Checks that two constraints of one candidate match exactly. */
function arePlannedScaleConstraintsEqual({
  first,
  second,
}: {
  first: PlannedScaleConstraint;
  second: PlannedScaleConstraint;
}): boolean {
  return (
    first.axis === second.axis &&
    first.transition === second.transition &&
    first.expectedPosition === second.expectedPosition &&
    areScaleCandidatesEqual({
      first: first.candidate,
      second: second.candidate,
    })
  );
}
