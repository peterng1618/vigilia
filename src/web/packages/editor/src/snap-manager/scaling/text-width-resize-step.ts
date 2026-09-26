// Ported: fork 9efdd78a src/editor/text-manager/scaling/text-width-resize-plan.ts
import {
  createScaleProjection,
  resolveScaleProjection,
  type ScaleProjectionConstraint,
} from "./scale-projection.js";
import {
  createScaleProjectionConstraints,
  type ScaleSnapPlan,
} from "./scale-snapping-resolver.js";
import type { TextWidthResizeMeasurementSource } from "./text-width-resize-measurer.js";

/** Most width re-measurements one pointer step may spend. */
const MAX_TEXT_WIDTH_REFINEMENT_STEPS = 8;

/** Below this a re-measured width counts as the one already tried. */
const TEXT_WIDTH_REFINEMENT_EPSILON = 0.0000001;

/** Whether the measured geometry actually reached every chosen guide. */
function didReachPlannedGuides({
  measurement,
  plan,
}: {
  measurement: ReturnType<TextWidthResizeMeasurementSource["measure"]>;
  plan: ScaleSnapPlan;
}): boolean {
  const { bounds } = measurement.projection;

  return [plan.constraints.x, plan.constraints.y].every((constraint) => {
    if (!constraint) return true;

    const position = bounds[constraint.candidate.edge];

    return (
      Math.abs(position - constraint.expectedPosition) <=
      plan.verificationEpsilon
    );
  });
}

/** The width whose own projection would put the edge on the guide. */
function resolveNextWidth({
  constraints,
  measurement,
  plan,
}: {
  constraints: readonly ScaleProjectionConstraint[];
  measurement: ReturnType<TextWidthResizeMeasurementSource["measure"]>;
  plan: ScaleSnapPlan;
}): number | null {
  const projection = createScaleProjection({
    bounds: measurement.projection.bounds,
    input: measurement.projection.projection,
  });
  const solution = resolveScaleProjection({
    projection,
    rawValues: [measurement.width],
    constraints,
    epsilon: plan.verificationEpsilon,
  });
  const [nextWidth] = solution?.values ?? [];

  return typeof nextWidth === "number" && Number.isFinite(nextWidth)
    ? nextWidth
    : null;
}

/** Guards the search against a width it has already measured on this step. */
function isNewWidth({
  measuredWidths,
  width,
}: {
  measuredWidths: readonly number[];
  width: number;
}): boolean {
  return measuredWidths.every(
    (measuredWidth) =>
      Math.abs(measuredWidth - width) > TEXT_WIDTH_REFINEMENT_EPSILON,
  );
}

/**
 * Finds a width that reaches the guides already chosen, measured against real
 * line wrapping. Width to height is a step function of where the words break,
 * so a plan solved on the linear model alone can miss a vertical guide; this
 * searches the real geometry without touching the live Textbox.
 */
export function resolveTextWidthSnapMeasurement({
  measurer,
  plan,
}: {
  measurer: TextWidthResizeMeasurementSource;
  plan: ScaleSnapPlan;
}): ReturnType<TextWidthResizeMeasurementSource["measure"]> | null {
  const [initialWidth] = plan.effectiveValues;
  if (initialWidth === undefined || !Number.isFinite(initialWidth)) return null;

  const constraints = createScaleProjectionConstraints({
    constraints: plan.constraints,
  });
  if (constraints.length === 0) return null;

  const measuredWidths: number[] = [];
  let width = initialWidth;

  for (let step = 0; step < MAX_TEXT_WIDTH_REFINEMENT_STEPS; step += 1) {
    const measurement = measurer.measure({ width });
    measuredWidths.push(measurement.width);
    if (didReachPlannedGuides({ measurement, plan })) return measurement;

    const nextWidth = resolveNextWidth({ constraints, measurement, plan });
    if (nextWidth === null || !isNewWidth({ measuredWidths, width: nextWidth }))
      return null;

    width = nextWidth;
  }

  return null;
}
