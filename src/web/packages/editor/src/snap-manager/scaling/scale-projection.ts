// Ported: fork 9efdd78a src/editor/snapping-manager/scaling/scale-projection.ts
/* eslint-disable no-use-before-define -- the exported functions sit above their internal calculations. */
import type { ObjectBounds } from "../bounds.js";

/** Coordinate axis a guide is checked against. */
export type ScaleSceneAxis = "x" | "y";

/** Visible bounding-box edge whose position moves with the object's size. */
export type ScaleSceneEdge = "left" | "right" | "top" | "bottom";

/** Canonical parameter one resize manager uses to change the object's size. */
export type ScaleProjectionVariable =
  | "scale-x"
  | "scale-y"
  | "uniform-scale"
  | "text-width";

/** Coefficients of one checked edge's position against the canonical size parameters. */
export type ScaleProjectionEdgeInput = Readonly<{
  edge: ScaleSceneEdge;
  coefficients: readonly number[];
}>;

/** Raw data of the chosen resize mode's linear model. */
export type ScaleProjectionInput = Readonly<{
  variables: readonly ScaleProjectionVariable[];
  baselineValues: readonly number[];
  /** Handle distance in scene coordinates per unit change of the parameter. */
  variableSceneWeights: readonly number[];
  edges: readonly ScaleProjectionEdgeInput[];
}>;

/** Validated linear model of one participating edge. */
export type ScaleProjectionEdge = Readonly<{
  axis: ScaleSceneAxis;
  edge: ScaleSceneEdge;
  baselinePosition: number;
  coefficients: readonly number[];
}>;

/** Model of the participating edges and the weights for comparing displacements. */
export type ScaleProjection = Readonly<{
  variables: readonly ScaleProjectionVariable[];
  baselineValues: readonly number[];
  variableSceneWeights: readonly number[];
  edges: readonly ScaleProjectionEdge[];
}>;

/** Positions of every edge participating in the chosen resize mode. */
export type ProjectedScaleEdgePositions = Readonly<{
  left: number | null;
  right: number | null;
  top: number | null;
  bottom: number | null;
}>;

/** Constraint bringing one checked edge onto a guide. */
export type ScaleProjectionConstraint = Readonly<{
  axis: ScaleSceneAxis;
  edge: ScaleSceneEdge;
  position: number;
}>;

/** Canonical values and edge positions after the constraints are applied. */
export type ScaleProjectionSolution = Readonly<{
  values: readonly number[];
  positions: ProjectedScaleEdgePositions;
}>;

/** Minimum relative tolerance for checking the linear projection's rank. */
const PROJECTION_RANK_EPSILON = 0.000000001;

/** Maximum number of degrees of freedom the supported resize allows. */
const MAX_SCALE_PROJECTION_VARIABLES = 2;

/** Empty positions before the participating edges are calculated. */
const EMPTY_PROJECTED_EDGE_POSITIONS: ProjectedScaleEdgePositions =
  Object.freeze({
    left: null,
    right: null,
    top: null,
    bottom: null,
  });

/**
 * Builds and validates the linear model from the gesture's exact start geometry.
 */
export function createScaleProjection({
  bounds,
  input,
}: {
  bounds: ObjectBounds;
  input: ScaleProjectionInput;
}): ScaleProjection {
  assertProjectionVariables({ input });
  if (input.edges.length === 0) {
    throw new Error(
      "Scale projection must contain at least one moving scene edge",
    );
  }

  const edgeNames = new Set<ScaleSceneEdge>();
  const edges = input.edges.map((edgeInput) => {
    if (edgeNames.has(edgeInput.edge)) {
      throw new Error(
        `Scale projection contains duplicate ${edgeInput.edge} edge`,
      );
    }
    edgeNames.add(edgeInput.edge);

    return createProjectionEdge({
      bounds,
      input: edgeInput,
      variableCount: input.variables.length,
    });
  });
  assertProjectionVariablesAffectGeometry({
    edges,
    variables: input.variables,
  });

  return Object.freeze({
    variables: Object.freeze([...input.variables]),
    baselineValues: Object.freeze([...input.baselineValues]),
    variableSceneWeights: Object.freeze([...input.variableSceneWeights]),
    edges: Object.freeze(edges),
  });
}

/**
 * Returns the model of one particular edge, or null when the chosen mode does not move it.
 */
export function getScaleProjectionEdge({
  projection,
  edge,
}: {
  projection: ScaleProjection;
  edge: ScaleSceneEdge;
}): ScaleProjectionEdge | null {
  return (
    projection.edges.find((projectionEdge) => projectionEdge.edge === edge) ??
    null
  );
}

/**
 * Calculates the positions of every participating edge for the given canonical values.
 */
export function projectScaleEdgePositions({
  projection,
  values,
}: {
  projection: ScaleProjection;
  values: readonly number[];
}): ProjectedScaleEdgePositions {
  assertProjectionValues({ projection, values });
  const positions: Record<ScaleSceneEdge, number | null> = {
    ...EMPTY_PROJECTED_EDGE_POSITIONS,
  };

  for (const projectionEdge of projection.edges) {
    positions[projectionEdge.edge] = projectEdgePosition({
      projection,
      projectionEdge,
      values,
    });
  }

  return Object.freeze(positions);
}

/**
 * Finds the canonical values at which one or two constraints hold.
 */
export function resolveScaleProjection({
  projection,
  rawValues,
  constraints,
  epsilon,
}: {
  projection: ScaleProjection;
  rawValues: readonly number[];
  constraints: readonly ScaleProjectionConstraint[];
  epsilon: number;
}): ScaleProjectionSolution | null {
  assertProjectionValues({ projection, values: rawValues });
  assertProjectionConstraints({ projection, constraints, epsilon });

  if (constraints.length === 0) {
    return createProjectionSolution({ projection, values: rawValues });
  }
  if (constraints.length === 1) {
    const constraint = constraints[0];
    if (!constraint) {
      throw new Error("Scale projection constraint is missing");
    }

    return resolveSingleConstraint({
      projection,
      rawValues,
      constraint,
      epsilon,
    });
  }

  return resolveConstraintPair({ projection, rawValues, constraints, epsilon });
}

/**
 * Returns the change in the canonical parameters one constraint needs.
 */
export function getScaleProjectionCorrectionMagnitude({
  projection,
  rawValues,
  constraint,
}: {
  projection: ScaleProjection;
  rawValues: readonly number[];
  constraint: ScaleProjectionConstraint;
}): number {
  const solution = resolveScaleProjection({
    projection,
    rawValues,
    constraints: [constraint],
    epsilon: PROJECTION_RANK_EPSILON,
  });
  if (!solution) {
    throw new Error(
      `Scale constraint for ${constraint.edge} edge cannot be projected`,
    );
  }

  return resolveVectorDistance({
    projection,
    first: rawValues,
    second: solution.values,
  });
}

/**
 * Returns the coordinate axis of one particular edge.
 */
export function resolveScaleSceneEdgeAxis({
  edge,
}: {
  edge: ScaleSceneEdge;
}): ScaleSceneAxis {
  return edge === "left" || edge === "right" ? "x" : "y";
}

/**
 * Validates the canonical size parameters, their baseline values and the weights.
 */
function assertProjectionVariables({
  input,
}: {
  input: ScaleProjectionInput;
}): void {
  const { variables, baselineValues, variableSceneWeights } = input;
  if (
    variables.length === 0 ||
    variables.length > MAX_SCALE_PROJECTION_VARIABLES
  ) {
    throw new Error("Scale projection must contain one or two variables");
  }
  if (variables.length !== baselineValues.length) {
    throw new Error(
      "Scale projection variables and baseline values must have equal length",
    );
  }
  if (variables.length !== variableSceneWeights.length) {
    throw new Error(
      "Scale projection variables and scene weights must have equal length",
    );
  }
  if (new Set(variables).size !== variables.length) {
    throw new Error("Scale projection variables must be unique");
  }
  if (!baselineValues.every(Number.isFinite)) {
    throw new Error("Scale projection baseline values must be finite");
  }
  if (
    !variableSceneWeights.every(
      (weight) => Number.isFinite(weight) && weight > 0,
    )
  ) {
    throw new Error(
      "Scale projection scene weights must be finite positive numbers",
    );
  }
}

/**
 * Builds and validates the linear model of one participating edge.
 */
function createProjectionEdge({
  bounds,
  input,
  variableCount,
}: {
  bounds: ObjectBounds;
  input: ScaleProjectionEdgeInput;
  variableCount: number;
}): ScaleProjectionEdge {
  if (input.coefficients.length !== variableCount) {
    throw new Error(
      `Scale projection coefficients for ${input.edge} edge have invalid length`,
    );
  }
  if (!input.coefficients.every(Number.isFinite)) {
    throw new Error(
      `Scale projection coefficients for ${input.edge} edge must be finite`,
    );
  }

  return Object.freeze({
    axis: resolveScaleSceneEdgeAxis({ edge: input.edge }),
    edge: input.edge,
    baselinePosition: bounds[input.edge],
    coefficients: Object.freeze([...input.coefficients]),
  });
}

/** Validates that every canonical parameter moves at least one edge. */
function assertProjectionVariablesAffectGeometry({
  edges,
  variables,
}: {
  edges: readonly ScaleProjectionEdge[];
  variables: readonly ScaleProjectionVariable[];
}): void {
  variables.forEach((variable, index) => {
    const affectsGeometry = edges.some(({ coefficients }) => {
      const coefficient = coefficients[index];
      return (
        coefficient !== undefined &&
        Math.abs(coefficient) > PROJECTION_RANK_EPSILON
      );
    });
    if (!affectsGeometry) {
      throw new Error(
        `Scale projection variable "${variable}" must affect at least one edge`,
      );
    }
  });
}

/**
 * Validates the count and finiteness of the given scale values.
 */
function assertProjectionValues({
  projection,
  values,
}: {
  projection: ScaleProjection;
  values: readonly number[];
}): void {
  if (values.length !== projection.variables.length) {
    throw new Error("Scale projection values have invalid length");
  }
  if (!values.every(Number.isFinite)) {
    throw new Error("Scale projection values must be finite");
  }
}

/**
 * Validates the edge constraints and the allowed solution tolerance.
 */
function assertProjectionConstraints({
  projection,
  constraints,
  epsilon,
}: {
  projection: ScaleProjection;
  constraints: readonly ScaleProjectionConstraint[];
  epsilon: number;
}): void {
  if (constraints.length > 2) {
    throw new Error("Scale projection supports at most two scene constraints");
  }
  if (!Number.isFinite(epsilon) || epsilon < 0) {
    throw new Error(
      "Scale projection epsilon must be a finite non-negative number",
    );
  }
  if (
    new Set(constraints.map(({ axis }) => axis)).size !== constraints.length
  ) {
    throw new Error(
      "Scale projection constraints must use different scene axes",
    );
  }

  for (const constraint of constraints) {
    const projectionEdge = getScaleProjectionEdge({
      projection,
      edge: constraint.edge,
    });
    if (!projectionEdge || projectionEdge.axis !== constraint.axis) {
      throw new Error(
        `Scale projection does not contain ${constraint.edge} edge on ${constraint.axis} axis`,
      );
    }
    if (!Number.isFinite(constraint.position)) {
      throw new Error(
        `Scale projection constraint for ${constraint.edge} edge must be finite`,
      );
    }
  }
}

/**
 * Calculates the position of one participating edge.
 */
function projectEdgePosition({
  projection,
  projectionEdge,
  values,
}: {
  projection: ScaleProjection;
  projectionEdge: ScaleProjectionEdge;
  values: readonly number[];
}): number {
  let position = projectionEdge.baselinePosition;
  for (let index = 0; index < values.length; index += 1) {
    const coefficient = projectionEdge.coefficients[index];
    const value = values[index];
    const baselineValue = projection.baselineValues[index];
    if (
      coefficient === undefined ||
      value === undefined ||
      baselineValue === undefined
    ) {
      throw new Error("Scale projection value is missing");
    }

    position += coefficient * (value - baselineValue);
  }

  return position;
}

/**
 * Finds the canonical values closest to the raw ones at which one constraint holds.
 */
function resolveSingleConstraint({
  projection,
  rawValues,
  constraint,
  epsilon,
}: {
  projection: ScaleProjection;
  rawValues: readonly number[];
  constraint: ScaleProjectionConstraint;
  epsilon: number;
}): ScaleProjectionSolution | null {
  const projectionEdge = getScaleProjectionEdge({
    projection,
    edge: constraint.edge,
  });
  if (!projectionEdge) {
    throw new Error(
      `Scale projection does not contain ${constraint.edge} edge`,
    );
  }

  const rawPositions = projectScaleEdgePositions({
    projection,
    values: rawValues,
  });
  const rawPosition = rawPositions[constraint.edge];
  if (rawPosition === null) {
    throw new Error(
      `Scale projection did not resolve ${constraint.edge} position`,
    );
  }

  const positionCorrection = constraint.position - rawPosition;
  const coefficientNorm = Math.hypot(...projectionEdge.coefficients);
  if (coefficientNorm <= PROJECTION_RANK_EPSILON) {
    return Math.abs(positionCorrection) <= epsilon
      ? createProjectionSolution({ projection, values: rawValues })
      : null;
  }

  const inverseMetricCoefficients = projectionEdge.coefficients.map(
    (coefficient, index) => {
      const variableSceneWeight = projection.variableSceneWeights[index];
      if (variableSceneWeight === undefined) {
        throw new Error("Scale projection scene weight is missing");
      }

      return coefficient / variableSceneWeight ** 2;
    },
  );
  const constraintMetricNorm = projectionEdge.coefficients.reduce(
    (sum, coefficient, index) => {
      const inverseMetricCoefficient = inverseMetricCoefficients[index];
      if (inverseMetricCoefficient === undefined) {
        throw new Error(
          "Scale projection inverse metric coefficient is missing",
        );
      }

      return sum + coefficient * inverseMetricCoefficient;
    },
    0,
  );
  const values = rawValues.map((value, index) => {
    const inverseMetricCoefficient = inverseMetricCoefficients[index];
    if (inverseMetricCoefficient === undefined) {
      throw new Error("Scale projection inverse metric coefficient is missing");
    }

    return (
      value +
      (inverseMetricCoefficient * positionCorrection) / constraintMetricNorm
    );
  });

  return createProjectionSolution({ projection, values });
}

/**
 * Tries to satisfy two constraints with one or two scale parameters.
 */
function resolveConstraintPair({
  projection,
  rawValues,
  constraints,
  epsilon,
}: {
  projection: ScaleProjection;
  rawValues: readonly number[];
  constraints: readonly ScaleProjectionConstraint[];
  epsilon: number;
}): ScaleProjectionSolution | null {
  const directSolution =
    projection.variables.length === 2
      ? resolveTwoVariableConstraintPair({ projection, rawValues, constraints })
      : null;
  if (
    directSolution &&
    areConstraintsSatisfied({ solution: directSolution, constraints, epsilon })
  ) {
    return directSolution;
  }

  for (const constraint of constraints) {
    const solution = resolveSingleConstraint({
      projection,
      rawValues,
      constraint,
      epsilon,
    });
    if (
      solution &&
      areConstraintsSatisfied({ solution, constraints, epsilon })
    ) {
      return solution;
    }
  }

  return null;
}

/**
 * Solves the non-degenerate system of two constraints for two scale parameters.
 */
function resolveTwoVariableConstraintPair({
  projection,
  rawValues,
  constraints,
}: {
  projection: ScaleProjection;
  rawValues: readonly number[];
  constraints: readonly ScaleProjectionConstraint[];
}): ScaleProjectionSolution | null {
  const [firstConstraint, secondConstraint] = constraints;
  if (!firstConstraint || !secondConstraint) return null;

  const firstEdge = getScaleProjectionEdge({
    projection,
    edge: firstConstraint.edge,
  });
  const secondEdge = getScaleProjectionEdge({
    projection,
    edge: secondConstraint.edge,
  });
  if (!firstEdge || !secondEdge) return null;

  const [firstA, firstB] = firstEdge.coefficients;
  const [secondA, secondB] = secondEdge.coefficients;
  if (
    firstA === undefined ||
    firstB === undefined ||
    secondA === undefined ||
    secondB === undefined
  ) {
    return null;
  }

  const firstNorm = Math.hypot(firstA, firstB);
  const secondNorm = Math.hypot(secondA, secondB);
  if (
    firstNorm <= PROJECTION_RANK_EPSILON ||
    secondNorm <= PROJECTION_RANK_EPSILON
  ) {
    return null;
  }
  const normalizedFirstA = firstA / firstNorm;
  const normalizedFirstB = firstB / firstNorm;
  const normalizedSecondA = secondA / secondNorm;
  const normalizedSecondB = secondB / secondNorm;
  const relativeDeterminant =
    normalizedFirstA * normalizedSecondB - normalizedFirstB * normalizedSecondA;
  if (Math.abs(relativeDeterminant) <= PROJECTION_RANK_EPSILON) return null;

  const rawPositions = projectScaleEdgePositions({
    projection,
    values: rawValues,
  });
  const firstRawPosition = rawPositions[firstConstraint.edge];
  const secondRawPosition = rawPositions[secondConstraint.edge];
  if (firstRawPosition === null || secondRawPosition === null) return null;

  const firstCorrection =
    (firstConstraint.position - firstRawPosition) / firstNorm;
  const secondCorrection =
    (secondConstraint.position - secondRawPosition) / secondNorm;
  const firstDelta =
    (firstCorrection * normalizedSecondB -
      normalizedFirstB * secondCorrection) /
    relativeDeterminant;
  const secondDelta =
    (normalizedFirstA * secondCorrection -
      firstCorrection * normalizedSecondA) /
    relativeDeterminant;

  const firstRawValue = rawValues[0];
  const secondRawValue = rawValues[1];
  if (firstRawValue === undefined || secondRawValue === undefined) return null;

  return createProjectionSolution({
    projection,
    values: [firstRawValue + firstDelta, secondRawValue + secondDelta],
  });
}

/**
 * Validates that the calculated solution satisfies every constraint.
 */
function areConstraintsSatisfied({
  solution,
  constraints,
  epsilon,
}: {
  solution: ScaleProjectionSolution;
  constraints: readonly ScaleProjectionConstraint[];
  epsilon: number;
}): boolean {
  for (const constraint of constraints) {
    const position = solution.positions[constraint.edge];
    if (
      position === null ||
      Math.abs(position - constraint.position) > epsilon
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Builds the immutable projection result.
 */
function createProjectionSolution({
  projection,
  values,
}: {
  projection: ScaleProjection;
  values: readonly number[];
}): ScaleProjectionSolution {
  const immutableValues = Object.freeze([...values]);

  return Object.freeze({
    values: immutableValues,
    positions: projectScaleEdgePositions({
      projection,
      values: immutableValues,
    }),
  });
}

/**
 * Returns the distance between two value sets, weighted by their scene scale.
 */
function resolveVectorDistance({
  projection,
  first,
  second,
}: {
  projection: ScaleProjection;
  first: readonly number[];
  second: readonly number[];
}): number {
  let squaredDistance = 0;
  for (let index = 0; index < first.length; index += 1) {
    const firstValue = first[index];
    const secondValue = second[index];
    const variableSceneWeight = projection.variableSceneWeights[index];
    if (
      firstValue === undefined ||
      secondValue === undefined ||
      variableSceneWeight === undefined
    ) {
      throw new Error("Scale projection distance operands are missing");
    }

    const sceneDistance = (firstValue - secondValue) * variableSceneWeight;
    squaredDistance += sceneDistance ** 2;
  }

  return Math.sqrt(squaredDistance);
}
