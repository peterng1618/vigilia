/** Maximum chart oversample factor. */
export const MAX_RENDER_SCALE = 3;

/**
 * Maximum detached-canvas area. Scale alone does not bound memory because cost
 * grows with `width × height × scale²`.
 *
 * One 1920 × 1080 frame, and 8.3 MB of RGBA at four bytes a pixel. The point of
 * a ceiling is to catch the chart nobody planned for, not to quietly make the
 * documented default untrue: at the previous 486,000 the shipped starter's
 * 963 × 215 trends chart clamped to **1.53×** while every smaller chart got the
 * full 2×, so the one graph a reader actually looks at was the only aliased one
 * on the board. A chart still past this at 1× is a layout problem, and the
 * clamp stops oversampling rather than undersampling below 1.
 */
export const MAX_BACKING_PIXELS = 2_073_600;

export const DEFAULT_RENDER_SCALE = 2;

/**
 * Bound oversampling by both factor and backing area. Never return below 1x;
 * oversized-at-1x charts are a layout problem, not a reason to blur silently.
 */
export function clampRenderScale(
  scale: number,
  width: number,
  height: number,
): number {
  const requested =
    Number.isFinite(scale) && scale > 0 ? scale : DEFAULT_RENDER_SCALE;

  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return Math.min(requested, MAX_RENDER_SCALE);
  }

  const byArea = Math.max(1, Math.sqrt(MAX_BACKING_PIXELS / (width * height)));

  return Math.min(requested, MAX_RENDER_SCALE, byArea);
}
