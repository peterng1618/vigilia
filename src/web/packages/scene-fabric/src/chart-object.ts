import * as echarts from 'echarts/core';
import { classRegistry, FabricObject } from 'fabric/es';
import { toEngineOption, type ChartOption } from '@vigilia/renderer-core';

/**
 * A Vigilia chart as a Fabric object.
 *
 * ECharts draws into a **detached** canvas that is never in the document, and
 * {@link VigiliaChart._render} blits that canvas into the Fabric scene. So the
 * chart is a first-class scene object — it moves, rotates and serialises like
 * any other — while ECharts keeps doing the drawing it is good at.
 *
 * ## Three settings here are load-bearing, not preferences
 *
 * Each was measured (spec 0013) and each fails in a way that looks like
 * something else:
 *
 * 1. **`objectCaching = false`.** With caching on, a live chart at DPR 2.75
 *    costs 7.99 ms mean and 36.5 ms p95 against 0.12/0.2 ms off, and holds
 *    6.66 MB of cache. Worse, Fabric caps a cache's raster size, so past
 *    viewport zoom ~8 the cached bitmap stops keeping up with the zoom and gets
 *    upscaled — which is exactly the "bitmap label" §91 forbids. Off is both
 *    faster and more correct; there is no trade here.
 * 2. **`animation: false`** on the option, applied by {@link setOption}. ECharts'
 *    animation loop does not drive Fabric, so an animated update fires the
 *    invalidation hook ~31 times for one visible change, each time repainting
 *    the entire canvas. Vigilia's own appear animations live in the *plan*
 *    (`charts/animation.ts`), which is where they can be reasoned about.
 * 3. **Top-left origin.** Fabric 7 changed the default origin to `center`, so
 *    `left`/`top` mean an object's centre. `PlanBox` is top-left, and the
 *    default silently offsets an entire artboard.
 *
 * ## Why the invalidation hook is not optional
 *
 * Fabric has no idea the detached canvas changed. Without
 * `zr.on('rendered', …)` marking this object dirty, a chart fed new data
 * repaints its own canvas and **nothing reaches the screen** — measured as 0
 * Fabric renders and a visibly frozen chart. That is the single most
 * load-bearing line in this file.
 *
 * `requestRenderAll` rather than `renderAll`: N charts updating in one tick
 * coalesce into one frame.
 *
 * ## Telemetry never touches a serialised property
 *
 * Live samples arrive as a rebuilt option through {@link setOption} and are held
 * only in the ECharts instance and the detached canvas — **neither of which is
 * serialised**. {@link toObject} emits the family, the option and the render
 * scale, and a new option replaces the old one wholesale rather than mutating
 * `width`, `angle`, `fill` or anything else Fabric writes out.
 *
 * This is what keeps §67 true. Any canvas-snapshot history serialises the whole
 * scene, so a sample sitting on a serialised property would be baked into the
 * next undo entry taken for an unrelated reason, and undo would then restore a
 * stale reading. `chart-object.test.ts` asserts it rather than trusting it.
 */

/** Chart families, as the plan names them. */
export type ChartObjectFamily = 'gauge' | 'line' | 'bar' | 'pie';

export interface VigiliaChartProps {
  readonly family: ChartObjectFamily;
  readonly option: ChartOption;
  /**
   * Device-pixel oversample for the detached canvas.
   *
   * The ECharts instance is initialised at `devicePixelRatio: 1` with a size
   * already multiplied by this, which is what lets the effective resolution
   * change later by a `resize` alone — zrender fixes its own painter DPR at
   * init, so the alternative would be disposing and re-initialising on every
   * DPR or zoom change.
   *
   * Needs a ceiling: one 300x180 chart re-rasterised at viewport zoom 4 cost
   * 13.18 MB. See {@link MAX_RENDER_SCALE}.
   */
  readonly renderScale: number;
}

/**
 * Everything {@link VigiliaChart.toObject} adds beyond Fabric's own properties.
 *
 * Declared as data, and `toObject` is derived from it, so "what does this
 * object persist?" has one answer a test can read. The test that matters asserts
 * **no key here can carry a sample**: `option` is a rebuilt plan option and
 * every other entry is authored configuration. A live reading stored on a
 * serialised property would be baked into the next canvas snapshot taken for an
 * unrelated reason (§67), and that is invisible until undo restores a stale
 * number.
 */
export const CHART_SERIALISED_KEYS = ['family', 'option', 'renderScale'] as const;

export type ChartSerialisedKey = (typeof CHART_SERIALISED_KEYS)[number];

/** Measured: 13.18 MB for one small chart at 4. Beyond this, accept softness. */
export const MAX_RENDER_SCALE = 3;

export const DEFAULT_RENDER_SCALE = 2;

export function clampRenderScale(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) {
    return DEFAULT_RENDER_SCALE;
  }

  return Math.min(scale, MAX_RENDER_SCALE);
}

/**
 * Strips engine animation from a built option.
 *
 * Returns a new object rather than mutating: the option came from the plan,
 * which is pure and may be shared between frames.
 */
export function withoutEngineAnimation(option: ChartOption): ChartOption {
  return { ...(option as object), animation: false } as ChartOption;
}

type ChartObjectOptions = Partial<VigiliaChartProps> &
  Record<string, unknown> & {
    readonly width?: number;
    readonly height?: number;
  };

export class VigiliaChart extends FabricObject {
  public static override type = 'VigiliaChart';

  public family: ChartObjectFamily = 'line';

  public renderScale: number = DEFAULT_RENDER_SCALE;

  private _option: ChartOption;

  private _element: HTMLCanvasElement | undefined;

  private _chart: echarts.ECharts | undefined;

  private _disposed = false;

  public constructor(options: ChartObjectOptions = {}) {
    super(options);

    this.family = options.family ?? 'line';
    this.renderScale = clampRenderScale(options.renderScale ?? DEFAULT_RENDER_SCALE);
    this._option = (options.option ?? {}) as ChartOption;

    // §51/§57: the plan's boxes are top-left, and Fabric 7 defaults to centre.
    this.set({ originX: 'left', originY: 'top', objectCaching: false });

    this._mount();
  }

  public static override getDefaults(): Record<string, unknown> {
    return {
      ...super.getDefaults(),
      originX: 'left',
      originY: 'top',
      objectCaching: false,
      renderScale: DEFAULT_RENDER_SCALE,
    };
  }

  /** The chart's current option. Read-only to callers; replace it via {@link setOption}. */
  public get option(): ChartOption {
    return this._option;
  }

  /** Whether {@link dispose} has run. A disposed chart draws nothing and accepts nothing. */
  public get disposed(): boolean {
    return this._disposed;
  }

  /**
   * Replaces the option — the only route for new telemetry.
   *
   * `notMerge` because a plan option is complete: merging would leave a removed
   * series or a shortened dataset behind. `lazyUpdate: false` because the repaint
   * must happen before Fabric blits, and ECharts otherwise defers it to its own
   * animation frame.
   */
  public setOption(option: ChartOption): void {
    if (this._disposed) {
      return;
    }

    this._option = option;
    this._chart?.setOption(toEngineOption(withoutEngineAnimation(option)), {
      notMerge: true,
      lazyUpdate: false,
    });
  }

  /**
   * Re-lays the chart out at a new size, leaving the Fabric scale at 1.
   *
   * Re-layout rather than scaling already-drawn pixels: ECharts recomputes axis
   * tick density and keeps type at its authored size, which scaling cannot do —
   * measured, naive scaling grew glyphs 2.17x and could not re-tick an axis.
   *
   * Costs ~9.7 ms, so a resize *gesture* should let Fabric scale naively and
   * call this once on commit.
   */
  public resizeTo(width: number, height: number): void {
    if (this._disposed) {
      return;
    }

    this.set({ width, height, scaleX: 1, scaleY: 1 });
    this._resizeBackingCanvas();
    this.setCoords();
    this.dirty = true;
  }

  /**
   * Changes the oversample factor without disposing the ECharts instance.
   *
   * Used for device pixel ratio and viewport zoom. Clamped, because the cost is
   * quadratic in memory.
   */
  public setRenderScale(scale: number): void {
    const next = clampRenderScale(scale);

    if (this._disposed || next === this.renderScale) {
      return;
    }

    this.renderScale = next;
    this._resizeBackingCanvas();
    this.dirty = true;
  }

  /**
   * Releases the ECharts instance and the backing store.
   *
   * **Fabric's `canvas.remove()` does not do this.** Measured: 100 create and
   * dispose cycles cost 82 KB of heap; the same 100 without disposing cost
   * 15,955 KB — 196x. Whatever owns chart objects must call this on removal,
   * and zeroing the canvas dimensions is what actually frees the pixels, which
   * a JS-heap measurement cannot see.
   *
   * Fabric declares `dispose()` on `FabricObject` precisely as the hook for
   * this, and its own implementation cancels running animations — so it is
   * chained rather than replaced.
   */
  public override dispose(): void {
    if (this._disposed) {
      super.dispose();
      return;
    }

    this._disposed = true;
    this._chart?.getZr().off('rendered', this._onEngineRendered);
    this._chart?.dispose();
    this._chart = undefined;

    if (this._element !== undefined) {
      this._element.width = 0;
      this._element.height = 0;
      this._element = undefined;
    }

    super.dispose();
  }

  public override toObject(propertiesToInclude: string[] = []): Record<string, unknown> {
    // Derived from CHART_SERIALISED_KEYS rather than hand-listed, so the
    // declared surface and the emitted one cannot drift. A `Record` keyed by the
    // union makes a new key a compile error here.
    const own: Record<ChartSerialisedKey, unknown> = {
      family: this.family,
      option: this._option,
      renderScale: this.renderScale,
    };

    return { ...super.toObject(propertiesToInclude), ...own };
  }

  public static override fromObject(object: Record<string, unknown>): Promise<VigiliaChart> {
    return Promise.resolve(new VigiliaChart(object as ChartObjectOptions));
  }

  /**
   * Draws the detached canvas in local coordinates.
   *
   * Fabric has already applied the object's rotation and scale to `ctx`, which
   * is why rotation needs no work here at all: the blit is axis-aligned in local
   * space and the transform does the rest. Measured correct at arbitrary angles.
   */
  // Public because Fabric declares it so. It is the sanctioned subclassing hook
  // despite the underscore, and the only underscore-prefixed Fabric API this
  // package depends on.
  public override _render(ctx: CanvasRenderingContext2D): void {
    const element = this._element;

    if (this._disposed || element === undefined || element.width === 0) {
      return;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      element,
      0,
      0,
      element.width,
      element.height,
      -this.width / 2,
      -this.height / 2,
      this.width,
      this.height,
    );
  }

  /**
   * Marks this object dirty when ECharts has painted.
   *
   * An arrow property, so removing the listener in {@link dispose} passes the
   * same reference that was registered — a bound method would not, and the
   * listener would outlive the object.
   */
  private readonly _onEngineRendered = (): void => {
    if (this._disposed) {
      return;
    }

    this.dirty = true;
    this.canvas?.requestRenderAll();
  };

  private _mount(): void {
    // Detached on purpose: never appended to the document. It is a pixel source,
    // and putting it in the DOM would give the scene two representations.
    const element = document.createElement('canvas');
    this._element = element;

    const { width, height } = this._backingSize();
    element.width = width;
    element.height = height;

    // A detached element has no layout, so the size must be passed explicitly.
    // `devicePixelRatio: 1` with an already-multiplied size is what makes
    // `setRenderScale` possible without a dispose.
    this._chart = echarts.init(element, null, {
      renderer: 'canvas',
      devicePixelRatio: 1,
      width,
      height,
    });

    this._chart.getZr().on('rendered', this._onEngineRendered);
    this.setOption(this._option);
  }

  private _backingSize(): { width: number; height: number } {
    return {
      width: Math.max(1, Math.round(this.width * this.renderScale)),
      height: Math.max(1, Math.round(this.height * this.renderScale)),
    };
  }

  private _resizeBackingCanvas(): void {
    const chart = this._chart;

    if (chart === undefined) {
      return;
    }

    chart.resize(this._backingSize());

    // `resize()` defers its repaint to zrender's own animation frame, so
    // without this Fabric can blit a half-cleared canvas. Measured: chart ink
    // 598 -> 586 immediately after `resize()`, -> 1151 after the flush. This
    // would have been an intermittent, unreproducible blank chart.
    chart.getZr().flush();
  }
}

// Registers under both `VigiliaChart` and `vigiliachart`, which is all
// `loadFromJSON` needs to revive one. Passing an explicit type string is
// redundant.
classRegistry.setClass(VigiliaChart);
