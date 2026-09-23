/* eslint-disable no-use-before-define -- public renderer functions sit above their internal primitives. */
import type { Canvas } from "fabric/es";

import { GUIDE_COLOR, GUIDE_WIDTH } from "./constants.js";
import { resolveDisplayDistance } from "./distance.js";
import { drawGuideLabel } from "./guide-painting.js";
import type { GuideBounds, GuideLine, SpacingGuide } from "./types.js";

/**
 * Paints verified line and spacing guides into the canvas upper context.
 */
export function renderSnappingGuides({
  canvas,
  guideBounds,
  guides,
  spacingGuides,
}: {
  canvas: Canvas;
  guideBounds: GuideBounds | null;
  guides: readonly GuideLine[];
  spacingGuides: readonly SpacingGuide[];
}): void {
  if (!guides.length && !spacingGuides.length) return;

  const context = canvas.getSelectionContext();
  if (!context) return;

  const bounds = guideBounds ?? calculateSnappingViewportBounds({ canvas });
  const { viewportTransform } = canvas;
  const zoom = canvas.getZoom() || 1;

  context.save();
  try {
    if (Array.isArray(viewportTransform)) {
      context.transform(...viewportTransform);
    }
    context.lineWidth = GUIDE_WIDTH / zoom;
    context.strokeStyle = GUIDE_COLOR;
    context.setLineDash([4, 4]);
    drawLineGuides({ context, bounds, guides });
    drawSpacingGuides({ context, zoom, guides: spacingGuides });
  } finally {
    context.restore();
  }
}

/** Returns the current viewport as scene bounds for guide painting. */
export function calculateSnappingViewportBounds({
  canvas,
}: {
  canvas: Canvas;
}): GuideBounds {
  const { viewportTransform } = canvas;
  const width = canvas.getWidth();
  const height = canvas.getHeight();
  const [scaleX = 1, , , scaleY = 1, translateX = 0, translateY = 0] =
    viewportTransform ?? [];

  return {
    left: (0 - translateX) / scaleX,
    top: (0 - translateY) / scaleY,
    right: (width - translateX) / scaleX,
    bottom: (height - translateY) / scaleY,
  };
}

/** Paints regular guides within the given scene bounds. */
function drawLineGuides({
  context,
  bounds,
  guides,
}: {
  context: CanvasRenderingContext2D;
  bounds: GuideBounds;
  guides: readonly GuideLine[];
}): void {
  const { left, right, top, bottom } = bounds;

  for (const guide of guides) {
    context.beginPath();
    if (guide.type === "vertical") {
      context.moveTo(guide.position, top);
      context.lineTo(guide.position, bottom);
    } else {
      context.moveTo(left, guide.position);
      context.lineTo(right, guide.position);
    }
    context.stroke();
  }
}

/** Paints a spacing guide with uniformly rounded labels. */
function drawSpacingGuides({
  context,
  zoom,
  guides,
}: {
  context: CanvasRenderingContext2D;
  zoom: number;
  guides: readonly SpacingGuide[];
}): void {
  for (const guide of guides) {
    drawSpacingGuide({
      context,
      guide,
      zoom,
      distanceLabel: resolveDisplayDistance({
        distance: guide.distance,
      }).toString(),
    });
  }
}

/**
 * Paints the lines and badges for equal-spacing intervals.
 */
export const drawSpacingGuide = ({
  context,
  guide,
  zoom,
  distanceLabel,
}: {
  context: CanvasRenderingContext2D;
  guide: SpacingGuide;
  zoom: number;
  distanceLabel: string;
}): void => {
  const { type, axis, refStart, refEnd, activeStart, activeEnd } = guide;

  context.beginPath();
  if (type === "vertical") {
    context.moveTo(axis, refStart);
    context.lineTo(axis, refEnd);
    context.moveTo(axis, activeStart);
    context.lineTo(axis, activeEnd);
  } else {
    context.moveTo(refStart, axis);
    context.lineTo(refEnd, axis);
    context.moveTo(activeStart, axis);
    context.lineTo(activeEnd, axis);
  }
  context.stroke();

  const labelColor = GUIDE_COLOR;

  drawGuideLabel({
    context,
    type,
    axis,
    start: refStart,
    end: refEnd,
    text: distanceLabel,
    zoom,
    color: labelColor,
    lineWidth: GUIDE_WIDTH,
  });
  drawGuideLabel({
    context,
    type,
    axis,
    start: activeStart,
    end: activeEnd,
    text: distanceLabel,
    zoom,
    color: labelColor,
    lineWidth: GUIDE_WIDTH,
  });
};
