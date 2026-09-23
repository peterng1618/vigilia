import {
  type Binding,
  buildChartPlan,
  type ChartContent,
  type ChartFamily,
  type FabricGlobals,
  reassignChartPaintReferences,
  type SampleSource,
} from "@vigilia/renderer-core";
import { type SceneAdapter, VigiliaChart } from "@vigilia/scene-fabric";
import { Group } from "fabric/es";
import type { EditorInteraction } from "../editor-interaction.js";
import { createNewChartDefaults } from "../new-object-defaults.js";
import { createChartPropertyPanel } from "./panel.js";

function newChart(
  family: ChartFamily,
  globals: FabricGlobals | undefined,
  id: string,
): VigiliaChart {
  const common = { id, left: 120, top: 80, width: 240, height: 160 };

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

/** Vigilia-owned chart semantics layered on the editor's generic canvas mechanics. */
export class ChartManager {
  readonly #editor: EditorInteraction;
  readonly #scene: SceneAdapter;
  #source: SampleSource;
  readonly #panel;
  #bindings: Readonly<Record<string, readonly Binding[]>>;
  #globals: FabricGlobals | undefined;

  constructor(options: {
    readonly editor: EditorInteraction;
    readonly scene: SceneAdapter;
    readonly source: SampleSource;
    readonly bindings?: Readonly<Record<string, readonly Binding[]>>;
    readonly globals?: FabricGlobals;
    readonly panelHost: HTMLElement;
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
    this.#panel = createChartPropertyPanel(
      options.panelHost,
      (id, settings) => this.#updateSettings(id, settings),
      (id, binding) =>
        this.#updateBinding(id, binding, options.onBindingsChange),
      (id, ratio) => this.#resizeToAspect(id, ratio),
    );
    this.#editor.canvas.on("selection:created", this.#drawPanel);
    this.#editor.canvas.on("selection:updated", this.#drawPanel);
    this.#editor.canvas.on("selection:cleared", this.#drawPanel);
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
    this.#drawPanel();
  }

  destroy(): void {
    this.#editor.canvas.off("selection:created", this.#drawPanel);
    this.#editor.canvas.off("selection:updated", this.#drawPanel);
    this.#editor.canvas.off("selection:cleared", this.#drawPanel);
    this.#editor.canvas.off("object:modified", this.#rerasterizeScaledChart);
    this.#editor.canvas.off(
      "editor:history-state-loaded" as never,
      this.#hydrateRevivedCharts,
    );
    this.#editor.canvas.off(
      "editor:object-pasted" as never,
      this.#hydrateRevivedCharts,
    );
    this.#panel.root.remove();
  }

  setGlobals(globals: FabricGlobals | undefined): void {
    this.#globals = globals;
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
    const chart = newChart(family, this.#globals, id);
    this.#editor.canvas.add(chart);
    this.#editor.canvas.setActiveObject(chart);
    this.#applyChart(id, chart);
    this.#editor.historyManager.saveState();
    this.#editor.canvas.requestRenderAll();
    this.#drawPanel();
  }

  reassignPaletteReferences(from: string, to: string): void {
    const visit = (object: { get(key: string): unknown }): void => {
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
      const children = object.get("objects");
      if (Array.isArray(children))
        children.forEach((child) => {
          if (
            typeof child === "object" &&
            child !== null &&
            "get" in child &&
            typeof child.get === "function"
          )
            visit(child as { get(key: string): unknown });
        });
    };
    this.#editor.canvas.getObjects().forEach(visit);
    this.#editor.canvas.requestRenderAll();
    this.#drawPanel();
  }

  readonly #drawPanel = (): void => {
    const chart = this.#selectedChart();
    const id = chart?.get("id");
    this.#panel.render(
      chart === undefined || typeof id !== "string"
        ? undefined
        : {
            id,
            content: {
              family: chart.family,
              settings: chart.settings,
            } as ChartContent,
            bindings: this.#bindings[id] ?? [],
          },
      this.#globals?.palette,
    );
  };

  #updateSettings(id: string, settings: ChartContent["settings"]): void {
    const chart = this.#chartFor(id);

    if (chart instanceof VigiliaChart) {
      chart.set("settings", settings);
      this.#applyChart(id, chart);
      this.#editor.canvas.requestRenderAll();
    }
    this.#drawPanel();
  }

  #updateBinding(
    id: string,
    nextBinding: Binding,
    onBindingsChange:
      | ((id: string, bindings: readonly Binding[]) => void)
      | undefined,
  ): void {
    const current = this.#bindings[id] ?? [];
    const bindings = current.map((binding) =>
      binding.id === nextBinding.id ? nextBinding : binding,
    );
    this.#bindings = { ...this.#bindings, [id]: bindings };
    const chart = this.#chartFor(id);
    if (chart instanceof VigiliaChart) this.#applyChart(id, chart);
    this.#editor.canvas.requestRenderAll();
    onBindingsChange?.(id, bindings);
    this.#drawPanel();
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
    this.#drawPanel();
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
  }

  #selectedChart(): VigiliaChart | undefined {
    const object = this.#editor.canvas.getActiveObject();
    return object instanceof VigiliaChart ? object : undefined;
  }
}
