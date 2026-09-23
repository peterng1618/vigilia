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

/** How to read exact bounds versus rounded bounds compatible with older code. */
type VisualBoundsMode = "exact" | "compatible";

/** Objects may report their own snapping extent; the fork's crop frame did. */
interface SnappingBoundsSource {
  getObjectSnappingBounds?: () => ObjectBounds | undefined;
}

/** Custom bounds are usable in geometry only when every component is finite. */
function isFiniteObjectBounds({ bounds }: { bounds: ObjectBounds }): boolean {
  return (
    Number.isFinite(bounds.left) &&
    Number.isFinite(bounds.right) &&
    Number.isFinite(bounds.top) &&
    Number.isFinite(bounds.bottom) &&
    Number.isFinite(bounds.centerX) &&
    Number.isFinite(bounds.centerY)
  );
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
  mode,
}: {
  object: FabricObject;
  mode: VisualBoundsMode;
}): ObjectBounds | null {
  try {
    object.setCoords();
    const rect = object.getBoundingRect();
    const left = mode === "compatible" ? (rect.left ?? 0) : rect.left;
    const top = mode === "compatible" ? (rect.top ?? 0) : rect.top;
    const width = mode === "compatible" ? (rect.width ?? 0) : rect.width;
    const height = mode === "compatible" ? (rect.height ?? 0) : rect.height;

    return createObjectBounds({
      left,
      right: left + width,
      top,
      bottom: top + height,
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

  const visualBounds = getObjectVisualBounds({ object, mode: "exact" });
  if (!visualBounds) return null;

  assertExactObjectBounds({
    bounds: visualBounds,
    source: "visual bounds",
  });

  return visualBounds;
};

/** Object bounds rounded to whole pixels, transform included. */
export const getObjectBounds = ({
  object,
}: {
  object?: FabricObject | null;
}): ObjectBounds | null => {
  if (!object) return null;

  const customBounds = (
    object as FabricObject & SnappingBoundsSource
  ).getObjectSnappingBounds?.();
  if (customBounds && isFiniteObjectBounds({ bounds: customBounds })) {
    return customBounds;
  }

  const bounds = getObjectVisualBounds({ object, mode: "compatible" });
  if (!bounds) return null;

  const roundedWidth = Math.round(bounds.right - bounds.left);
  const roundedHeight = Math.round(bounds.bottom - bounds.top);
  const right = bounds.left + roundedWidth;
  const bottom = bounds.top + roundedHeight;

  return {
    left: bounds.left,
    right,
    top: bounds.top,
    bottom,
    centerX: bounds.left + roundedWidth / 2,
    centerY: bounds.top + roundedHeight / 2,
  };
};
