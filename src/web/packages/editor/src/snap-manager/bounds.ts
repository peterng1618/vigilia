import type { FabricObject } from "fabric/es";

/** Object edges and centres, computed in scene coordinates. */
export type ObjectBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
};

/** Objects may report their own snapping extent; the fork's crop frame did. */
interface SnappingBoundsSource {
  getObjectSnappingBounds?: () => ObjectBounds | undefined;
}

/** Builds object bounds and derives centres from the same exact values. */
function createObjectBounds({
  left,
  right,
  top,
  bottom,
}: {
  left: number;
  right: number;
  top: number;
  bottom: number;
}): ObjectBounds {
  return {
    left,
    right,
    top,
    bottom,
    centerX: left + (right - left) / 2,
    centerY: top + (bottom - top) / 2,
  };
}

/** Validates exact bounds before use; bad custom bounds fail loudly. */
function assertExactObjectBounds({
  bounds,
  source,
}: {
  bounds: ObjectBounds;
  source: "custom snapping bounds" | "visual bounds";
}): void {
  const { left, right, top, bottom } = bounds;
  const hasFiniteEdges =
    Number.isFinite(left) &&
    Number.isFinite(right) &&
    Number.isFinite(top) &&
    Number.isFinite(bottom);

  if (!hasFiniteEdges) {
    throw new Error(`Invalid ${source}: edges must be finite`);
  }

  if (right < left || bottom < top) {
    throw new Error(`Invalid ${source}: edges must be ordered`);
  }
}

/** Visible bounds of an object without custom snapping geometry. */
function getObjectVisualBounds({
  object,
}: {
  object: FabricObject;
}): ObjectBounds | null {
  try {
    object.setCoords();
    const rect = object.getBoundingRect();

    return createObjectBounds({
      left: rect.left,
      right: rect.left + rect.width,
      top: rect.top,
      bottom: rect.top + rect.height,
    });
  } catch {
    return null;
  }
}

/** Exact object bounds in scene coordinates, honouring the full transform. */
export const getObjectExactBounds = ({
  object,
}: {
  object?: FabricObject | null;
}): ObjectBounds | null => {
  if (!object) return null;

  const customBounds = (
    object as FabricObject & SnappingBoundsSource
  ).getObjectSnappingBounds?.();
  if (customBounds) {
    assertExactObjectBounds({
      bounds: customBounds,
      source: "custom snapping bounds",
    });

    return createObjectBounds(customBounds);
  }

  const visualBounds = getObjectVisualBounds({ object });
  if (!visualBounds) return null;

  assertExactObjectBounds({
    bounds: visualBounds,
    source: "visual bounds",
  });

  return visualBounds;
};
