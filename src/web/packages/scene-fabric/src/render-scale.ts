/**
 * How large a chart's detached canvas may get.
 *
 * Split out of `chart-object.ts` because it is a decision with its own
 * measurements rather than part of the object's behaviour, and because the
 * object was past AGENTS.md's 500-line signal.
 */

/**
 * Hard ceiling on the oversample factor.
 *
 * Independent of {@link MAX_BACKING_PIXELS}: this is what stops a small chart
 * being oversampled absurdly, where the area budget alone would allow it.
 */
export const MAX_RENDER_SCALE = 3;

/**
 * Hard ceiling on the detached canvas's area, in pixels.
 *
 * **A scale cap does not bound memory** — the cost is `width × height × scale²`,
 * so the same factor that is harmless on a badge is not on a full-width chart.
 * The measured figure was one 300×180 chart at scale 4, which is 864,000 px and
 * cost 13.18 MB — more than the 11.59 MB an entire emulated Pixel 3 dashboard
 * used at scale 2. Capping the factor alone would let a 1200×800 chart reach
 * 8.6 M px at the ceiling above.
 *
 * The value is the largest area {@link MAX_RENDER_SCALE} already permits on that
 * measured chart (300 × 180 × 3² = 486,000 px), restated in the unit that
 * actually bounds memory. **The bytes-per-pixel implied by the 13.18 MB figure
 * has not been re-measured**, so treat this as the existing ceiling expressed
 * correctly, not as a new measurement.
 */
export const MAX_BACKING_PIXELS = 486_000;

export const DEFAULT_RENDER_SCALE = 2;

/**
 * The largest oversample factor a box of this size may use.
 *
 * Two independent ceilings, whichever is lower: {@link MAX_RENDER_SCALE} stops a
 * small chart being oversampled absurdly, {@link MAX_BACKING_PIXELS} stops a
 * large one exhausting the budget.
 *
 * **The area ceiling never returns less than 1.** Below 1 the backing store is
 * smaller than the box it fills, so the chart is visibly soft — the cap would
 * be buying memory with resolution the author asked for. A chart big enough to
 * exceed the budget at 1× is a layout problem and needs saying out loud, not
 * quietly blurring. So this bounds *oversampling*, never resolution.
 *
 * Refuses rather than coerces: a scale that cannot produce a drawable canvas
 * falls back to the default, never to 0, because `echarts.init` on a 0×0
 * element does not fail loudly — it just never draws.
 */
export function clampRenderScale(scale: number, width: number, height: number): number {
  const requested = Number.isFinite(scale) && scale > 0 ? scale : DEFAULT_RENDER_SCALE;

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return Math.min(requested, MAX_RENDER_SCALE);
  }

  const byArea = Math.max(1, Math.sqrt(MAX_BACKING_PIXELS / (width * height)));

  return Math.min(requested, MAX_RENDER_SCALE, byArea);
}
