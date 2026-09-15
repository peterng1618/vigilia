/** Maximum chart oversample factor. */
export const MAX_RENDER_SCALE = 3;

/**
 * Maximum detached-canvas area. Scale alone does not bound memory because cost
 * grows with `width × height × scale²`.
 */
export const MAX_BACKING_PIXELS = 486_000;

export const DEFAULT_RENDER_SCALE = 2;

/**
 * Bound oversampling by both factor and backing area. Never return below 1x;
 * oversized-at-1x charts are a layout problem, not a reason to blur silently.
 */
export function clampRenderScale(scale: number, width: number, height: number): number {
  const requested = Number.isFinite(scale) && scale > 0 ? scale : DEFAULT_RENDER_SCALE;

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return Math.min(requested, MAX_RENDER_SCALE);
  }

  const byArea = Math.max(1, Math.sqrt(MAX_BACKING_PIXELS / (width * height)));

  return Math.min(requested, MAX_RENDER_SCALE, byArea);
}
