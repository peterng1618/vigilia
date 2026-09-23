/**
 * Rounds a finite distance for display; invalid geometry fails loudly.
 */
export const resolveDisplayDistance = ({
  distance,
}: {
  distance: number;
}): number => {
  if (!Number.isFinite(distance)) {
    throw new Error("Display distance must be finite");
  }

  return Math.round(Math.max(0, distance));
};

/**
 * Maximum label difference below which two distances read as equal.
 */
export const MAX_DISPLAY_DISTANCE_DIFF = 0;

/** The two rounded distances and their comparison result for the UI. */
export type CommonDisplayDistance = {
  firstDisplayDistance: number;
  secondDisplayDistance: number;
  displayDistanceDiff: number;
  commonDisplayDistance: number;
};

/**
 * Compares two rounded distance labels and returns their common value for the UI.
 */
export const resolveCommonDisplayDistance = ({
  firstDistance,
  secondDistance,
}: {
  firstDistance: number;
  secondDistance: number;
}): CommonDisplayDistance => {
  const firstDisplayDistance = resolveDisplayDistance({
    distance: firstDistance,
  });
  const secondDisplayDistance = resolveDisplayDistance({
    distance: secondDistance,
  });
  const displayDistanceDiff = Math.abs(
    firstDisplayDistance - secondDisplayDistance,
  );
  const commonDisplayDistance = Math.max(
    firstDisplayDistance,
    secondDisplayDistance,
  );

  return {
    firstDisplayDistance,
    secondDisplayDistance,
    displayDistanceDiff,
    commonDisplayDistance,
  };
};
