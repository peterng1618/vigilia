import * as echarts from 'echarts/core';
import { classRegistry, FabricObject } from 'fabric/es';
import {
  toEngineOption,
  type ChartContent,
  type ChartFamily,
  type ChartOption,
} from '@vigilia/renderer-core';
import './chart-engine.js';
import { clampRenderScale, DEFAULT_RENDER_SCALE } from './render-scale.js';

/**
 * A Vigilia chart as a Fabric object.
 *
 * ECharts draws into a **detached** canvas that is never in the document, and
 * {@link VigiliaChart._render} blits that canvas into the Fabric scene. So the
 * chart is a first-class scene object — it moves, rotates and serialises like
 * any other — while ECharts keeps doing the drawing it is good at.
 *
 * Spec 0013 holds the measurements and the staging; what follows is only what
 * you need to not break this file.
 *
 * ## Four settings are load-bearing, not preferences
 *
 * `objectCaching: false` (caching a live chart is ~60x slower at DPR 2.75, and
 * its capped raster becomes the bitmap label §91 forbids past zoom ~8),
 * `animation: false` on the option (ECharts' loop does not drive Fabric, so it
 * repaints the whole canvas ~31 times for one visible change — Vigilia's own
 * appear animations live in the plan), a `center` origin, and `strokeWidth: 0`
 * (Fabric folds stroke width into `_getTransformedDimensions`, so the default
 * of 1 inflates the bounding box, hit area and every control position).
 *
 * ## Why the invalidation hook is not optional
 *
 * Fabric has no idea the detached canvas changed. Without
 * `zr.on('rendered', …)` marking this object dirty, a chart fed new data
 * repaints its own canvas and **nothing reaches the screen** — measured as 0
 * Fabric renders and a visibly frozen chart. That is the single most
 * load-bearing line in this file.
 *
 * It goes through `set('dirty', true)` rather than a field assignment, because
 * `FabricObject._set` is what propagates dirtiness to `this.parent`. A Fabric
 * `Group` caches by default, so a direct assignment marks this object dirty
 * while leaving the group's cache valid — and the group then redraws its stale
 * bitmap. Same frozen chart, one layer up, visible only once grouped.
 *
 * `requestRenderAll` rather than `renderAll`: N charts updating in one tick
 * coalesce into one frame.
 *
 * ## Origin is Fabric's default, not Vigilia's
 *
 * `PlanBox` is top-left and Fabric's `left`/`top` mean the object's centre. The
 * conversion is two additions in the adapter, once, because Fabric 7 marks
 * every origin except `center` **deprecated**. Pinning `'left'` would have put
 * the persisted format on an API Fabric intends to remove, and §134 asks only
 * that the origin be *explicit*.
 *
 * `_render` works in centred local space regardless. The one non-obvious cost
 * is that the origin now *equals* the default, so Fabric's default-stripping
 * drops it — which is what {@link toObject} exists to prevent.
 *
 * ## Telemetry cannot reach a serialised property
 *
 * The persisted surface is {@link CHART_SERIALISED_KEYS}: the **authored**
 * `family` and `settings`, which are exactly `ChartContent`'s keys. The built
 * engine option is derived — `plan.ts` rebuilds it from those settings, the
 * theme's tokens and the current samples every frame — so it lives in a private
 * field and is **never written out**.
 *
 * That makes §67 true by construction rather than by inspection. A serialised
 * built option carries live readings inside `series[].data`, where a check on
 * key *names* cannot see them; one was written, and it passed. Any
 * canvas-snapshot history serialises the whole scene, so such a sample gets
 * baked into the next undo entry taken for an unrelated reason and undo then
 * restores a stale number.
 */

/**
 * Everything {@link VigiliaChart} persists beyond Fabric's own properties.
 *
 * These are `ChartContent`'s keys — the document's own chart shape — so the
 * persisted Fabric object and the theme format cannot disagree about what a
 * chart is. Fabric's `toObject` picks them up through
 * {@link VigiliaChart.customProperties}, so this list *is* the behaviour rather
 * than a description of it.
 */
export const CHART_SERIALISED_KEYS = ['family', 'settings'] as const satisfies readonly (keyof ChartContent)[];

export type ChartSerialisedKey = (typeof CHART_SERIALISED_KEYS)[number];

/**
 * Forces a decision when `ChartContent` grows a key.
 *
 * A new key would otherwise be dropped from the persisted object in silence.
 * This resolves to `never` only while every `ChartContent` key is persisted; if
 * one is added, it is a compile error here — which is the point.
 */
type AssertNever<T extends never> = T;
type _EveryContentKeyIsPersisted = AssertNever<Exclude<keyof ChartContent, ChartSerialisedKey>>;

/**
 * Strips engine animation from a built option.
 *
 * Returns a new object rather than mutating: the option came from the plan,
 * which is pure and may be shared between frames.
 */
export function withoutEngineAnimation(option: ChartOption): ChartOption {
  return { ...(option as object), animation: false } as ChartOption;
}

/**
 * What a chart may be constructed or revived with.
 *
 * `ChartContent` supplies the persisted half, so family and settings stay
 * correlated at the call site. `option` is accepted but never persisted — a
 * revived chart has no option until the plan supplies one, which is the normal
 * render path.
 */
export type VigiliaChartOptions = ChartContent &
  Record<string, unknown> & {
    readonly width: number;
    readonly height: number;
    readonly option?: ChartOption;
    readonly renderScale?: number;
  };

export class VigiliaChart extends FabricObject {
  public static override type = 'VigiliaChart';

  /**
   * Derived from {@link CHART_SERIALISED_KEYS} so the declared surface and the
   * emitted one are the same thing.
   *
   * Fabric's own `toObject` concatenates this into the properties it picks
   * (`Object.ts:1748`), so the emitted Vigilia keys are never hand-listed. The
   * narrow {@link toObject} override below adds the origin and nothing else,
   * for a reason recorded there.
   */
  public static override customProperties: string[] = [...CHART_SERIALISED_KEYS];

  /**
   * Fabric's own defaults mechanism, so these are declared exactly once.
   *
   * `FabricObject`'s constructor assigns `FabricObject.ownDefaults` by name
   * rather than calling `this.constructor.getDefaults()`, so a subclass applies
   * its own — the pattern `Rect` and `Group` use. Setting them a second time in
   * the constructor body, as this class used to, both duplicated the
   * declaration and silently overrode whatever the caller asked for.
   */
  public static override ownDefaults: Record<string, unknown> = {
    originX: 'center',
    originY: 'center',
    objectCaching: false,
    strokeWidth: 0,
  };

  public static override getDefaults(): Record<string, unknown> {
    return { ...super.getDefaults(), ...VigiliaChart.ownDefaults };
  }

  /** Declared, not initialised: a field initialiser would clobber `setOptions`. */
  public declare family: ChartFamily;

  public declare settings: ChartContent['settings'];

  private _renderScale: number = DEFAULT_RENDER_SCALE;

  private _option: ChartOption | undefined;

  private _element: HTMLCanvasElement | undefined;

  private _chart: echarts.ECharts | undefined;

  private _disposed = false;

  public constructor(options: VigiliaChartOptions) {
    // `super()` without options, then own defaults, then the caller's — Fabric's
    // own subclass order. Passing options to `super` would apply them before the
    // defaults and before this class's fields exist.
    super();
    Object.assign(this, VigiliaChart.ownDefaults);
    this.setOptions(options);

    if (!(this.width > 0) || !(this.height > 0)) {
      // Refuse rather than coerce. A 0-sized box would mount ECharts on a 1×1
      // canvas that silently never draws anything recognisable.
      throw new Error(
        `A chart needs a positive width and height; received ${this.width}×${this.height}.`,
      );
    }

    // Re-clamped now the box is known: `setOptions` walks the options bag in
    // key order, so a `renderScale` arriving before `width` was clamped against
    // nothing.
    this._renderScale = clampRenderScale(this._renderScale, this.width, this.height);

    this._mount();
  }

  /**
   * Device-pixel oversample for the detached canvas.
   *
   * An accessor pair for the same reason {@link option} is one, plus a second:
   * `set({ renderScale })` is Fabric's idiom and is what the adapter will reach
   * for on a DPR change, so a plain field would take the new value and leave
   * the backing canvas at the old size — `_backingSize()` disagreeing with
   * `_element` until some later `resizeTo` made the resolution jump.
   *
   * The ECharts instance is initialised at `devicePixelRatio: 1` with a size
   * already multiplied by this, which is what lets the effective resolution
   * change by a `resize` alone — zrender fixes its painter's DPR at init, so
   * the alternative is disposing and re-initialising on every DPR change.
   */
  public get renderScale(): number {
    return this._renderScale;
  }

  public set renderScale(scale: number) {
    this.setRenderScale(scale);
  }

  /**
   * States the origin unconditionally, which Fabric would otherwise drop.
   *
   * **This is the one thing here Fabric is not left to do**, and it is two keys
   * rather than a re-implemented property list — `customProperties` still
   * carries everything Vigilia adds, and there is no `fromObject` override.
   *
   * §134 requires a persisted object to record its origin explicitly, because
   * Fabric 7 already changed that default once and a scene relying on the old
   * one would have shifted by half its size. But `_removeDefaultValues`
   * exempts only `left`, `top` and `type` (`Object.ts:1858-1875`), and `center`
   * **is** the default — so the origin is stripped the moment defaults are
   * stripped. The object cannot opt out either: `StaticCanvas._toObject` forces
   * `includeDefaultValues = false` onto every instance when the canvas has it
   * off (`StaticCanvas.ts:849-856`).
   *
   * `originX: 'left'` used to survive this, but only by accident — it could
   * never equal the default. Relying on that is how a requirement quietly stops
   * holding, so it is asserted against a stripped `toObject` instead.
   */
  public override toObject(propertiesToInclude: string[] = []): Record<string, unknown> {
    const { originX, originY } = this;

    return { ...super.toObject(propertiesToInclude), originX, originY };
  }

  /**
   * The current built option, and the only route for new telemetry.
   *
   * A real accessor pair rather than a bare getter: Fabric's `_setOptions`
   * assigns every key of the options bag straight onto the instance, so a
   * getter with no setter makes `new VigiliaChart({ option })` throw
   * `TypeError: Cannot set property option … which has only a getter`. The
   * prototype-shape test in `chart-object.test.ts` guards the general case.
   */
  public get option(): ChartOption | undefined {
    return this._option;
  }

  public set option(option: ChartOption | undefined) {
    this.setOption(option);
  }

  /** Whether {@link dispose} has run. A disposed chart draws nothing and accepts nothing. */
  public get disposed(): boolean {
    return this._disposed;
  }

  /**
   * Replaces the option.
   *
   * `notMerge` because a plan option is complete: merging would leave a removed
   * series or a shortened dataset behind. `lazyUpdate: false` because the repaint
   * must happen before Fabric blits, and ECharts otherwise defers it to its own
   * animation frame.
   */
  public setOption(option: ChartOption | undefined): void {
    if (this._disposed) {
      return;
    }

    this._option = option;

    if (option === undefined) {
      return;
    }

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

    // `width` and `height` are `cacheProperties`, so `_set` marks this dirty
    // and propagates to an enclosing group without help.
    this.set({ width, height, scaleX: 1, scaleY: 1 });
    // Re-clamped, not carried over: the area ceiling depends on the box, so
    // growing a chart can make its current factor unaffordable.
    this._renderScale = clampRenderScale(this._renderScale, width, height);
    this._resizeBackingCanvas();
    this.setCoords();
  }

  /**
   * Changes the oversample factor without disposing the ECharts instance.
   *
   * Used for device pixel ratio and viewport zoom. The {@link renderScale}
   * setter routes here, so assignment and this method cannot diverge.
   */
  public setRenderScale(scale: number): void {
    const next = clampRenderScale(scale, this.width, this.height);

    if (this._disposed || next === this._renderScale) {
      return;
    }

    this._renderScale = next;
    this._resizeBackingCanvas();
    this.set('dirty', true);
  }

  /**
   * Releases the ECharts instance and the backing store.
   *
   * **`canvas.remove()` does not call this** — it only fires `object:removed`
   * (`Collection.ts:68`). `StaticCanvas.destroy()` does call it on every object
   * (`StaticCanvas.ts:1473`), so teardown is covered but removal is not;
   * whatever owns the canvas must wire `object:removed` to it.
   *
   * Measured: 100 create-and-dispose cycles cost 82 KB of heap; the same 100
   * without disposing cost 15,955 KB — 196x. Zeroing the canvas dimensions is
   * what actually frees the pixels, which a JS-heap measurement cannot see.
   *
   * Fabric declares `dispose()` on `FabricObject` as the hook for exactly this,
   * and its own implementation cancels running animations and detaches
   * listeners — so it is chained rather than replaced.
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

  /**
   * Draws the detached canvas in local coordinates.
   *
   * Fabric has already applied the object's rotation and scale to `ctx`, which
   * is why rotation needs no work here at all: the blit is axis-aligned in local
   * space and the transform does the rest. Measured correct at arbitrary angles.
   *
   * `ctx` is inside Fabric's own `save`/`restore` pair (`Object.ts:662`), so the
   * smoothing settings do not leak to the next object.
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

    // Through `set`, so `_set` propagates dirtiness to an enclosing Group's
    // cache. A field assignment would leave a grouped chart frozen.
    this.set('dirty', true);
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
    // `setRenderScale` possible without a dispose: zrender fixes its painter's
    // DPR at init, so the alternative is re-initialising on every DPR change.
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
      width: Math.max(1, Math.round(this.width * this._renderScale)),
      height: Math.max(1, Math.round(this.height * this._renderScale)),
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
//
// `fromObject` is deliberately NOT overridden: `FabricObject.fromObject` routes
// through `_fromObject`, which runs `enlivenObjectEnlivables` first — the step
// that turns a serialised `clipPath`, gradient or pattern back into an instance.
// An override that called `new VigiliaChart(object)` directly would skip it and
// revive a clip path as a plain object.
classRegistry.setClass(VigiliaChart);
