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
