import {
  buildChartPlan,
  type Binding,
  type ChartContent,
  type SampleSource,
} from '@vigilia/renderer-core';
import type { ImageEditor } from '@anu3ev/fabric-image-editor';
import { VigiliaChart, type SceneAdapter } from '@vigilia/scene-fabric';
import { createForkChartPanel } from './panel.js';

/** Vigilia-owned chart semantics layered on the fork's generic canvas mechanics. */
export class ChartManager {
  readonly #editor: ImageEditor;
  readonly #scene: SceneAdapter;
  readonly #source: SampleSource;
  readonly #panel;
  readonly #bindings: Readonly<Record<string, readonly Binding[]>>;

  constructor(options: {
    readonly editor: ImageEditor;
    readonly scene: SceneAdapter;
    readonly source: SampleSource;
    readonly bindings?: Readonly<Record<string, readonly Binding[]>>;
    readonly panelHost: HTMLElement;
  }) {
    this.#editor = options.editor;
    this.#scene = options.scene;
    this.#source = options.source;
    this.#bindings = options.bindings ?? {};
    this.#panel = createForkChartPanel(options.panelHost, (id, settings) => this.#updateSettings(id, settings));
    this.#editor.canvas.on('selection:created', this.#drawPanel);
    this.#editor.canvas.on('selection:updated', this.#drawPanel);
    this.#editor.canvas.on('selection:cleared', this.#drawPanel);
    this.#hydrateRevivedCharts();
    this.#drawPanel();
  }

  destroy(): void {
    this.#editor.canvas.off('selection:created', this.#drawPanel);
    this.#editor.canvas.off('selection:updated', this.#drawPanel);
    this.#editor.canvas.off('selection:cleared', this.#drawPanel);
    this.#panel.root.remove();
  }

  readonly #drawPanel = (): void => {
    const chart = this.#selectedChart();
    const id = chart?.get('id');
    this.#panel.render(chart === undefined || typeof id !== 'string'
      ? undefined
      : { id, content: { family: chart.family, settings: chart.settings } as ChartContent });
  };

  #updateSettings(id: string, settings: ChartContent['settings']): void {
    const chart = this.#scene.objectFor(id);

    if (chart instanceof VigiliaChart) {
      chart.set('settings', settings);
      this.#applyChart(id, chart);
      this.#editor.canvas.requestRenderAll();
    }
    this.#drawPanel();
  }

  /** A revived v2 chart deliberately has no persisted engine pixels or samples. */
  #hydrateRevivedCharts(): void {
    for (const id of Object.keys(this.#bindings)) {
      const chart = this.#scene.objectFor(id);
      if (chart instanceof VigiliaChart) this.#applyChart(id, chart);
    }
    this.#editor.canvas.requestRenderAll();
  }

  #applyChart(id: string, chart: VigiliaChart): void {
    const plan = buildChartPlan(id, { family: chart.family, settings: chart.settings } as ChartContent, this.#bindings[id] ?? [], {
      source: this.#source, nowMs: Date.now(), animate: false,
    }, []);
    chart.setOption(plan.option);
  }

  #selectedChart(): VigiliaChart | undefined {
    const object = this.#editor.canvas.getActiveObject();
    return object instanceof VigiliaChart ? object : undefined;
  }
}
