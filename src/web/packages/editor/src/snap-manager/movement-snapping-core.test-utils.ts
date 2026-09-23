import type { ObjectBounds } from "./bounds.js";
import {
  createMovementSnapEnvironment,
  type MovementSnapCandidateSource,
} from "./movement-snap-candidates.js";
import {
  createMovementGestureBaseline,
  type FinalMovementGeometry,
  type MovementGestureBaseline,
  type MovementRawIntent,
} from "./movement-snapping-resolver.js";

/** Builds exact bounds of a translated object, centres derived from the same edges. */
export function createMovementBounds({
  left,
  top,
  width = 30,
  height = 30,
}: {
  left: number;
  top: number;
  width?: number;
  height?: number;
}): ObjectBounds {
  return {
    left,
    right: left + width,
    top,
    bottom: top + height,
    centerX: left + width / 2,
    centerY: top + height / 2,
  };
}

/** Builds a movement-gesture baseline with an immutable target snapshot. */
export function createMovementBaseline({
  bounds = createMovementBounds({ left: 0, top: 0 }),
  sources = [],
  zoom = 1,
}: {
  bounds?: ObjectBounds;
  sources?: readonly MovementSnapCandidateSource[];
  zoom?: number;
} = {}): MovementGestureBaseline {
  return createMovementGestureBaseline({
    bounds,
    position: {
      left: bounds.left,
      top: bounds.top,
    },
    environment: createMovementSnapEnvironment({
      sources,
      zoom,
    }),
  });
}

/** Builds a raw movement intent for an object with left/top origin. */
export function createMovementRawIntent({
  left,
  top,
  width = 30,
  height = 30,
  canSnapX = true,
  canSnapY = true,
  ctrlKey = false,
}: {
  left: number;
  top: number;
  width?: number;
  height?: number;
  canSnapX?: boolean;
  canSnapY?: boolean;
  ctrlKey?: boolean;
}): MovementRawIntent {
  return {
    bounds: createMovementBounds({ left, top, width, height }),
    position: {
      left,
      top,
    },
    axes: {
      x: canSnapX,
      y: canSnapY,
    },
    modifiers: {
      ctrlKey,
    },
  };
}

/** Builds the actual movement geometry after the computed position applies. */
export function createFinalMovementGeometry({
  left,
  top,
  width = 30,
  height = 30,
}: {
  left: number;
  top: number;
  width?: number;
  height?: number;
}): FinalMovementGeometry {
  return {
    bounds: createMovementBounds({ left, top, width, height }),
    position: {
      left,
      top,
    },
  };
}
