import {
  buildChartPlan,
  reassignChartPaintReferences,
  type Binding,
  type ChartContent,
  type FabricGlobals,
  type SampleSource,
} from "@vigilia/renderer-core";
import type { ImageEditor } from "@anu3ev/fabric-image-editor";
import { Group } from "fabric/es";
import { VigiliaChart, type SceneAdapter } from "@vigilia/scene-fabric";
import { createForkChartPanel } from "./panel.js";

type PreviewSource = SampleSource & {
  readonly chartStartupDurationMs?: number;
};

/** Vigilia-owned chart semantics layered on the fork's generic canvas mechanics. */
export class ChartManager {
  readonly #editor: ImageEditor;
  readonly #scene: SceneAdapter;
  #source: SampleSource;
  readonly #panel;
  #bindings: Readonly<Record<string, readonly Binding[]>>;
  #globals: FabricGlobals | undefined;
  #chartStartedAtMs = Date.now();
  #chartStartupDurationMs: number | undefined;

  constructor(options: {
    readonly editor: ImageEditor;
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
    this.#chartStartupDurationMs = startupDurationFor(options.source);
    this.#bindings = options.bindings ?? {};
    this.#globals = options.globals;
    this.#panel = createForkChartPanel(
      options.panelHost,
      (id, settings) => this.#updateSettings(id, settings),
      (id, binding) =>
        this.#updateBinding(id, binding, options.onBindingsChange),
    );
    this.#editor.canvas.on("selection:created", this.#drawPanel);
    this.#editor.canvas.on("selection:updated", this.#drawPanel);
    this.#editor.canvas.on("selection:cleared", this.#drawPanel);
    this.#editor.canvas.on(
      "editor:history-state-loaded" as never,
      this.#hydrateRevivedCharts,
    );
    this.#hydrateRevivedCharts();
    this.#drawPanel();
  }

  destroy(): void {
    this.#editor.canvas.off("selection:created", this.#drawPanel);
    this.#editor.canvas.off("selection:updated", this.#drawPanel);
    this.#editor.canvas.off("selection:cleared", this.#drawPanel);
    this.#editor.canvas.off(
      "editor:history-state-loaded" as never,
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
    this.#chartStartedAtMs = Date.now();
    this.#chartStartupDurationMs = startupDurationFor(source);
    this.refresh();
  }

  refresh(): void {
    this.#hydrateRevivedCharts();
  }

  setRefreshRate(rate: 1 | 30): void {
    this.refresh();
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

  /** A revived v2 chart deliberately has no persisted engine pixels or samples. */
  readonly #hydrateRevivedCharts = (): void => {
    for (const id of Object.keys(this.#bindings)) {
      const chart = this.#chartFor(id);
      if (chart instanceof VigiliaChart) this.#applyChart(id, chart);
    }
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
        chartStartedAtMs: this.#chartStartedAtMs,
        ...(this.#chartStartupDurationMs === undefined
          ? {}
          : { chartStartupDurationMs: this.#chartStartupDurationMs }),
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

function startupDurationFor(source: SampleSource): number | undefined {
  const duration = (source as PreviewSource).chartStartupDurationMs;
  return typeof duration === "number" &&
    Number.isFinite(duration) &&
    duration > 0
    ? duration
    : undefined;
}
