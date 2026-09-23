import type { AnchorBuckets, Bounds, GuideLine } from "./types.js";

/**
 * Finds the nearest snap line along one axis.
 */
export const findAxisSnap = ({
  anchors,
  positions,
  threshold,
}: {
  anchors: number[];
  positions: number[];
  threshold: number;
}): { delta: number; guidePosition: number | null } => {
  let nearestDelta = 0;
  let nearestDistance = threshold + 1;
  let guidePosition: number | null = null;

  for (const position of positions) {
    for (const anchor of anchors) {
      const distance = Math.abs(anchor - position);

      if (distance > threshold || distance >= nearestDistance) continue;

      nearestDelta = anchor - position;
      nearestDistance = distance;
      guidePosition = anchor;
    }
  }

  return {
    delta: nearestDelta,
    guidePosition,
  };
};

/**
 * Computes the shift delta and guide list for the moving object.
 */
export const calculateSnap = ({
  activeBounds,
  threshold,
  anchors,
}: {
  activeBounds: Bounds;
  threshold: number;
  anchors: AnchorBuckets;
}): { deltaX: number; deltaY: number; guides: GuideLine[] } => {
  const { left, right, centerX, top, bottom, centerY } = activeBounds;

  const verticalSnap = findAxisSnap({
    anchors: anchors.vertical,
    positions: [left, centerX, right],
    threshold,
  });
  const horizontalSnap = findAxisSnap({
    anchors: anchors.horizontal,
    positions: [top, centerY, bottom],
    threshold,
  });

  const guides: GuideLine[] = [];

  if (verticalSnap.guidePosition !== null) {
    guides.push({
      type: "vertical",
      position: verticalSnap.guidePosition,
    });
  }

  if (horizontalSnap.guidePosition !== null) {
    guides.push({
      type: "horizontal",
      position: horizontalSnap.guidePosition,
    });
  }

  return {
    deltaX: verticalSnap.delta,
    deltaY: horizontalSnap.delta,
    guides,
  };
};
