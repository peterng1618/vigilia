import {
  type Binding,
  buildChartPlan,
  type ChartContent,
  type ChartFamily,
  chartPaintFieldsFor,
  type FabricGlobals,
  reassignChartPaintReferences,
  type SampleSource,
} from "@vigilia/renderer-core";
import { type SceneAdapter, VigiliaChart } from "@vigilia/scene-fabric";
import { type FabricObject, Group } from "fabric/es";
import type { EditorInteraction } from "../editor-interaction.js";
import {
  createNewChartDefaults,
  newObjectName,
  nextNewObjectPlacement,
} from "../new-object-defaults.js";
import type { ChartFieldsPort } from "../selection-inspector/per-kind-column.js";
import {
  type ChartFieldHandlers,
  type ChartFieldTarget,
  chartContentFields,
  chartPaintFields,
} from "./panel.js";

/**
 * The family's per-series paint, with one entry per series.
 *
 * `buildChartPlan` makes a line series, a bar and a slice one binding each, and
 * `chartPaintFieldsFor` declares the paint that repeats as `multiple` — so the
 * two are the same length by definition and the editor keeps them so. A new
 * entry repeats the last one, which is what an author extending a chart means:
 * the same look, once more, until they choose otherwise. A gauge's paints are
 * not per-series and are left alone.
 */
function seriesPaintFor(
  family: ChartFamily,
  settings: ChartContent["settings"],
  series: number,
): ChartContent["settings"] {
  const field = chartPaintFieldsFor(family).find((entry) => entry.multiple);
  if (field === undefined) return settings;
  const current = (settings as unknown as Record<string, unknown>)[
    field.property
  ];
  if (!Array.isArray(current)) return settings;
  const wanted = Math.max(1, series);
  if (current.length === wanted) return settings;
  const last = current.at(-1);
  return {
    ...settings,
    [field.property]: Array.from(
      { length: wanted },
      (_, index) => current[index] ?? last,
    ),
  } as ChartContent["settings"];
}

/**
 * Each surviving series' own paint, in its new order.
 *
 * The per-series paint is a positional array sitting beside the bindings, so
 * filtering the bindings without it slides every later series onto its
 * neighbour's colour — silently, with nothing on screen that looks wrong.
 * Measured on the reference trends chart: removing the middle of CPU/GPU/RAM
 * left CPU on its blue and painted **RAM with the GPU's green**, because the GPU
 * entry was still sitting at index 1.
 */
export function carriedPaintFor(
  family: ChartFamily,
  settings: ChartContent["settings"],
  previous: readonly Binding[],
  next: readonly Binding[],
): ChartContent["settings"] {
  const field = chartPaintFieldsFor(family).find((entry) => entry.multiple);
  if (field === undefined) return settings;
  const current = (settings as unknown as Record<string, unknown>)[
    field.property
  ];
  if (!Array.isArray(current)) return settings;
  // **A series is the same series when its `id` is the same.** `next.includes`
  // asked whether the *object* survived, and the one caller that repoints a key
  // hands over `{ ...binding, semanticKey }` — a fresh object for a binding that
  // was not touched. So changing a chart's key reported every series removed,
  // the paint array was emptied, and `seriesPaintFor` grew the empty array back
  // to one entry by repeating `current.at(-1)`, which is `undefined`. The
  // envelope then carried `palette: [null]`.
  //
  // That is not a document the validator can accept: `chartPaint` reads a
  // non-record as "must reference a palette token", so the *next* `snapshot()`
  // threw `Invalid Fabric theme`. `isDirty()` runs inside React's
  // `useSyncExternalStore`, so the throw landed in the render phase and React
  // unmounted the whole editor — canvas, status line and every panel gone —
  // which is what `reference-theme.spec.ts:533` then timed out on, waiting 90 s
  // for a save button that was no longer in the document. Measured: repointing
  // the starter's own sparkline from `cpu.load` to `gpu.load` unmounted the
  // editor in 200 ms.
  //
  // `id` is the identity a binding is minted with and keyed by everywhere else
  // (`panel.ts` mints it, the run editor keys its bindings by it), so it is the
  // identity this filter should have used.
  //
  // **The same filter also emptied the paint in the other two directions.**
  // A paint entry belongs to a *position*, and a position only means something
  // when a series stood there. Binding the first series to a chart inserted
  // from the Add pane reported every entry removed — `previous` was empty, so
  // nothing survived it — and unbinding the last one did the same from the
  // other side. Either way `seriesPaintFor` regrew the empty array by repeating
  // `current.at(-1)`, which is `undefined`, so the envelope carried
  // `palette: [null]` and the panel rendered no colour control at all: **an
  // author who bound a series to a chart could not then choose its colour.**
  // Measured, the reported DOM read going from `[stroke, palette.0]` to `[]` on
  // the chart's own property panel.
  //
  // So an entry is dropped only when the series it paints is *known* to be gone,
  // which is a claim about `previous` rather than about `next`: an entry with no
  // series behind it was never bound, so there is nothing to have removed.
  const kept = current.filter(
    (_paint, index) =>
      index >= previous.length ||
      previous[index]?.id === next[index]?.id ||
      next.some((survivor) => survivor.id === previous[index]?.id),
  );
  // `seriesPaintFor` guarantees a chart at least one series slot to colour, so a
  // filter that returned nothing here would be regrown from `undefined` rather
  // than from a colour. Unbinding the last series therefore keeps the first
  // entry: the series is gone, but the slot it will be chosen into is not, and
  // an author binding again is choosing a colour, not declaring a default.
  const surviving =
    kept.length === 0 && current.length > 0 ? [current[0]!] : kept;
  if (surviving.length === current.length) return settings;
  return {
    ...settings,
    [field.property]: surviving,
  } as ChartContent["settings"];
}

function newChart(
  family: ChartFamily,
  globals: FabricGlobals | undefined,
  id: string,
  placement: { readonly left: number; readonly top: number },
): VigiliaChart {
  const common = {
    id,
    // The family is what the author just chose, so it is what the layer list
    // shows; a new chart that arrived as a bare uuid would be unreadable.
    name: newObjectName(family),
    // The same cascade a shape and a text object take. A chart used to carry
    // its own `120, 80`, which is how a gauge inserted after a rectangle landed
    // in a second corner rather than beside it: two origins for one rule, and
    // neither of them knew the other existed.
    ...placement,
    width: 240,
    height: 160,
    // Artboard coordinates, as a panel and a text object now both are, so the
    // inspector's X and Y are the chart's corner. A chart is the object whose
    // position a dashboard is most sensitive to — six of them, each sitting in
    // a card — and a centre origin put every one of them half its own size away
    // from where the author put it: measured, a 200 × 200 gauge placed at
    // (1069, 258) drew at (969, 158). `boxFrom` converts between the two
    // origins on the way out, so a saved chart is unaffected.
    originX: "left",
    originY: "top",
  };

  switch (family) {
    case "gauge":
      return new VigiliaChart({
        ...common,
        family,
        settings: createNewChartDefaults(globals, family),
      });
    case "line":
      return new VigiliaChart({
        ...common,
        family,
        settings: createNewChartDefaults(globals, family),
      });
    case "bar":
      return new VigiliaChart({
        ...common,
        family,
        settings: createNewChartDefaults(globals, family),
      });
    case "pie":
      return new VigiliaChart({
        ...common,
        family,
        settings: createNewChartDefaults(globals, family),
      });
  }
}

/** The ratios the line-chart control group offers, widest last. */
const ASPECT_RATIOS: readonly number[] = [2, 3, 4];

/**
 * The offered ratio a chart is at, or nothing when it is at none of them.
 *
 * Read off the object rather than remembered from the last click, so a chart
 * the author dragged is described by its own shape. A chart at 2.004:1 is at
 * none of them: rounding to the nearest would light up a ratio that was never
 * applied, which is the disagreement this state exists to remove.
 */
function aspectOf(
  chart: VigiliaChart,
  ratios: readonly number[],
): { readonly aspect: number } | Record<string, never> {
  const width = chart.width * chart.scaleX;
  const height = chart.height * chart.scaleY;
  if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0) {
    return {};
  }
  const ratio = width / height;
  const match = ratios.find((candidate) => Math.abs(candidate - ratio) < 0.01);
  return match === undefined ? {} : { aspect: match };
}

/** Vigilia-owned chart semantics layered on the editor's generic canvas mechanics. */
export class ChartManager {
  readonly #editor: EditorInteraction;
  readonly #scene: SceneAdapter;
  #source: SampleSource;
  #bindings: Readonly<Record<string, readonly Binding[]>>;
  #globals: FabricGlobals | undefined;
  #onBindingsChange:
    | ((id: string, bindings: readonly Binding[]) => void)
    | undefined;

  /**
   * The chart's own fields, for the selection inspector's column to mount.
   *
   * The mount point moved out of a Data tab and into the chart's own column;
   * the owner did not. Every write these controls make lands on the methods
   * below, so the envelope, the canvas and the panel cannot disagree about what
   * a chart reads.
   */
  readonly fields: ChartFieldsPort = {
    content: (chart) => {
      const target = this.#targetFor(chart);
      return target === undefined
        ? []
        : chartContentFields(target, this.#globals?.palette, this.#handlers);
    },
    paint: (chart) => {
      const target = this.#targetFor(chart);
      return target === undefined
        ? []
        : chartPaintFields(target, this.#globals?.palette, this.#handlers);
    },
  };

  readonly #handlers: ChartFieldHandlers = {
    onSettings: (id, settings) => this.#updateSettings(id, settings),
    onBinding: (id, binding) =>
      this.#updateBinding(id, binding, this.#onBindingsChange),
    onAspect: (id, ratio) => this.#resizeToAspect(id, ratio),
    onAddBinding: (id, semanticKey) =>
      this.#writeBindings(
        id,
        [
          ...(this.#bindings[id] ?? []),
          // Minted here rather than in the panel: the id is what the run
          // editor's bindings are keyed by, so one shape for both keeps a
          // document's two kinds of reference legible together.
          { id: `binding-${crypto.randomUUID()}`, semanticKey },
        ],
        this.#onBindingsChange,
      ),
    onRemoveBinding: (id, bindingId) =>
      this.#writeBindings(
        id,
        (this.#bindings[id] ?? []).filter(
          (binding) => binding.id !== bindingId,
        ),
        this.#onBindingsChange,
      ),
  };

  constructor(options: {
    readonly editor: EditorInteraction;
    readonly scene: SceneAdapter;
    readonly source: SampleSource;
    readonly bindings?: Readonly<Record<string, readonly Binding[]>>;
    readonly globals?: FabricGlobals;
    readonly onBindingsChange?: (
      id: string,
      bindings: readonly Binding[],
    ) => void;
  }) {
    this.#editor = options.editor;
    this.#scene = options.scene;
    this.#source = options.source;
    this.#bindings = options.bindings ?? {};
    this.#globals = options.globals;
    this.#onBindingsChange = options.onBindingsChange;
    this.#editor.canvas.on("object:modified", this.#rerasterizeScaledChart);
    this.#editor.canvas.on(
      "editor:history-state-loaded" as never,
      this.#hydrateRevivedCharts,
    );
    this.#editor.canvas.on(
      "editor:object-pasted" as never,
      this.#hydrateRevivedCharts,
    );
    this.#hydrateRevivedCharts();
  }

  destroy(): void {
    this.#editor.canvas.off("object:modified", this.#rerasterizeScaledChart);
    this.#editor.canvas.off(
      "editor:history-state-loaded" as never,
      this.#hydrateRevivedCharts,
    );
    this.#editor.canvas.off(
      "editor:object-pasted" as never,
      this.#hydrateRevivedCharts,
    );
  }

  setGlobals(globals: FabricGlobals | undefined): void {
    this.#globals = globals;
    this.refresh();
  }

  /**
   * The envelope's bindings, whenever they changed somewhere other than here.
   *
   * A chart's series **are** its bindings, so a manager still holding only what
   * it was constructed with draws every chart it did not write itself with no
   * series at all — which is every chart in an inserted card.
   */
  setBindings(bindings: Readonly<Record<string, readonly Binding[]>>): void {
    this.#bindings = bindings;
    this.refresh();
  }

  setSource(source: SampleSource): void {
    this.#source = source;
    this.refresh();
  }

  refresh(): void {
    this.#hydrateRevivedCharts();
  }

  setRefreshRate(rate: 1 | 30): void {
    this.refresh();
  }

  /** Add a typed chart while preserving the editor's canvas and history ownership. */
  addChart(family: ChartFamily): void {
    const id = `chart-${crypto.randomUUID()}`;
    // Placed before the chart joins the canvas, so it takes the n-th slot rather
    // than counting itself.
    const chart = newChart(
      family,
      this.#globals,
      id,
      nextNewObjectPlacement(this.#editor),
    );
    this.#editor.canvas.add(chart);
    this.#editor.canvas.setActiveObject(chart);
    this.#applyChart(id, chart);
    this.#editor.historyManager.saveState();
    this.#editor.canvas.requestRenderAll();
    this.#announce(chart);
  }

  reassignPaletteReferences(from: string, to: string): void {
    // §75: deleting a referenced global forces reassignment, so a chart still
    // naming the deleted token would be a dangling reference in the saved
    // document. A live `Group` keeps its children in `_objects` and exposes
    // `getObjects()` — it has no `objects` property — so reading
    // `object.get("objects")` never descended into one and every chart inside
    // a card kept the token its whole group had just lost.
    const visit = (object: FabricObject): void => {
      if (object instanceof VigiliaChart) {
        const settings = reassignChartPaintReferences(
          object.settings,
          from,
          to,
        );
        if (settings !== object.settings) {
          object.set("settings", settings);
          const id = object.get("id");
          if (typeof id === "string") this.#applyChart(id, object);
        }
      }
      if (object instanceof Group) object.getObjects().forEach(visit);
    };
    this.#editor.canvas.getObjects().forEach(visit);
    this.#editor.canvas.requestRenderAll();
    // The reassignment runs with the palette's own fan-out, which re-renders
    // the column a moment later; this is for the chart the author is looking
    // at, whose settings just changed under it.
    this.#announce(this.#selectedChart());
  }

  /**
   * Reads one chart as the fields' own input: the family and settings off the
   * object, the bindings off the envelope, the ratio off its shape. `undefined`
   * for anything that is not a chart this manager owns by id.
   */
  #targetFor(chart: FabricObject): ChartFieldTarget | undefined {
    if (!(chart instanceof VigiliaChart)) return undefined;
    const id = chart.get("id");
    if (typeof id !== "string") return undefined;
    return {
      id,
      content: {
        family: chart.family,
        settings: chart.settings,
      } as ChartContent,
      bindings: this.#bindings[id] ?? [],
      ...aspectOf(chart, ASPECT_RATIOS),
    };
  }

  /**
   * Says the object changed, which is what the selection inspector re-reads on.
   *
   * A settings or binding edit is not a canvas gesture, so nothing else would
   * tell the column its fields are stale — the panel used to redraw itself, and
   * the column is redrawn by the inspector instead.
   */
  #announce(chart: FabricObject | undefined): void {
    if (!(chart instanceof VigiliaChart)) return;
    this.#editor.canvas.fire("object:modified", { target: chart });
  }

  #updateSettings(id: string, settings: ChartContent["settings"]): void {
    const chart = this.#chartFor(id);

    if (chart instanceof VigiliaChart) {
      chart.set("settings", settings);
      this.#applyChart(id, chart);
      this.#editor.canvas.requestRenderAll();
    }
    this.#announce(chart);
  }

  #updateBinding(
    id: string,
    nextBinding: Binding,
    onBindingsChange:
      | ((id: string, bindings: readonly Binding[]) => void)
      | undefined,
  ): void {
    this.#writeBindings(
      id,
      (this.#bindings[id] ?? []).map((binding) =>
        binding.id === nextBinding.id ? nextBinding : binding,
      ),
      onBindingsChange,
    );
  }

  /**
   * The one place a chart's binding list is written: the key chooser, the key
   * picker and the remove button all end here, so the envelope, the redraw and
   * the panel cannot disagree about what a chart reads.
   */
  #writeBindings(
    id: string,
    bindings: readonly Binding[],
    onBindingsChange:
      | ((id: string, bindings: readonly Binding[]) => void)
      | undefined,
  ): void {
    const previous = this.#bindings[id] ?? [];
    this.#bindings = { ...this.#bindings, [id]: bindings };
    const chart = this.#chartFor(id);
    if (chart instanceof VigiliaChart) {
      // A per-series paint is one entry per series, and a series is a binding.
      // Without this a chart inserted from the Add pane declares one series
      // colour and keeps it however many sensors are bound to it, so a
      // three-series trends chart has three lines and **one** colour control —
      // measured, and the reason the target's blue/violet/teal is unreachable.
      chart.set(
        "settings",
        seriesPaintFor(
          chart.family,
          carriedPaintFor(chart.family, chart.settings, previous, bindings),
          bindings.length,
        ),
      );
      this.#applyChart(id, chart);
    }
    this.#editor.canvas.requestRenderAll();
    onBindingsChange?.(id, bindings);
    this.#announce(chart);
  }

  #resizeToAspect(id: string, ratio: number): void {
    const chart = this.#chartFor(id);
    const width = chart === undefined ? 0 : chart.width * chart.scaleX;
    if (
      !(chart instanceof VigiliaChart) ||
      !Number.isFinite(width) ||
      width <= 0
    ) {
      return;
    }
    chart.resizeTo(width, width / ratio);
    this.#editor.canvas.requestRenderAll();
    // A ratio is a geometry edit, and the object is changed by the time the
    // column has redrawn — measured, 215 → 241 at 4:1 and 482 at 2:1. The
    // selection inspector re-reads on `object:modified` and on nothing else, so
    // without this the Height field kept reporting the height the chart had
    // before the click, on a control an author types into. Announced the way
    // `canvas-nudge` announces a programmatic move.
    this.#announce(chart);
  }

  readonly #rerasterizeScaledChart = (event: { target?: unknown }): void => {
    const chart = event.target;
    if (!(chart instanceof VigiliaChart)) return;
    const width = chart.width * chart.scaleX;
    const height = chart.height * chart.scaleY;
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0
    ) {
      return;
    }
    // A drag changes the ratio too, and this runs on the `object:modified` the
    // inspector re-reads the ratio buttons on — so the buttons follow the drag
    // without anything here announcing a second time.
    chart.resizeTo(width, height);
  };

  /** A revived v2 chart deliberately has no persisted engine pixels or samples. */
  readonly #hydrateRevivedCharts = (): void => {
    const hydrate = (objects: readonly object[]): void => {
      for (const object of objects) {
        if (object instanceof VigiliaChart) {
          const id = object.get("id");
          if (typeof id === "string") this.#applyChart(id, object);
        } else if (object instanceof Group) hydrate(object.getObjects());
      }
    };
    hydrate(this.#editor.canvas.getObjects());
    this.#editor.canvas.requestRenderAll();
  };

  #chartFor(id: string): VigiliaChart | undefined {
    const find = (objects: readonly object[]): VigiliaChart | undefined => {
      for (const object of objects) {
        if (object instanceof VigiliaChart && object.get("id") === id)
          return object;
        if (object instanceof Group) {
          const chart = find(object.getObjects());
          if (chart !== undefined) return chart;
        }
      }
      return undefined;
    };
    return find(this.#editor.canvas.getObjects());
  }

  #applyChart(id: string, chart: VigiliaChart): void {
    // **Per chart, and reported, not swallowed.** `refresh()` runs beside the
    // text repaint in one callback, so a chart that throws would take every
    // bound reading on the canvas down with it. One bad chart costs that chart.
    try {
      const plan = buildChartPlan(
        id,
        { family: chart.family, settings: chart.settings } as ChartContent,
        this.#bindings[id] ?? [],
        {
          source: this.#source,
          nowMs: Date.now(),
          animate: false,
        },
        [],
        this.#globals?.palette,
      );
      chart.setOption(plan.option);
    } catch (error) {
      this.#editor.errorManager.warn(
        "controls",
        `Chart "${id}" failed to draw and was left as it was. ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  #selectedChart(): VigiliaChart | undefined {
    const object = this.#editor.canvas.getActiveObject();
    return object instanceof VigiliaChart ? object : undefined;
  }
}
