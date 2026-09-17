import {
  buildScenePlan,
  validateThemeDocument,
  type PlanNode,
  type SampleSource,
  type ThemeDocument,
} from '@vigilia/renderer-core';
import type { ImageEditor } from '@anu3ev/fabric-image-editor';
import { VigiliaChart, type SceneAdapter } from '@vigilia/scene-fabric';
import { findNode, updateChartSettings } from '../commands.js';
import { createForkChartPanel } from './panel.js';

/** Vigilia-owned chart semantics layered on the fork's generic canvas mechanics. */
export class ChartManager {
  readonly #editor: ImageEditor;
  readonly #scene: SceneAdapter;
  readonly #source: SampleSource;
  readonly #panel;
  #document: ThemeDocument;

  constructor(options: {
    readonly editor: ImageEditor;
    readonly scene: SceneAdapter;
    readonly source: SampleSource;
    readonly document: ThemeDocument;
    readonly panelHost: HTMLElement;
  }) {
    this.#editor = options.editor;
    this.#scene = options.scene;
    this.#source = options.source;
    this.#document = options.document;
    this.#panel = createForkChartPanel(options.panelHost, (id, settings) => this.#updateSettings(id, settings));
    this.#editor.canvas.on('selection:created', this.#drawPanel);
    this.#editor.canvas.on('selection:updated', this.#drawPanel);
    this.#editor.canvas.on('selection:cleared', this.#drawPanel);
    this.#drawPanel();
  }

  get document(): ThemeDocument {
    return this.#document;
  }

  destroy(): void {
    this.#editor.canvas.off('selection:created', this.#drawPanel);
    this.#editor.canvas.off('selection:updated', this.#drawPanel);
    this.#editor.canvas.off('selection:cleared', this.#drawPanel);
    this.#panel.root.remove();
  }

  readonly #drawPanel = (): void => {
    const id = this.#editor.canvas.getActiveObject()?.get('id');
    const node = typeof id === 'string' ? findNode(this.#document.nodes, id) : undefined;
    this.#panel.render(node?.type === 'chart' ? { id: node.id, content: node.content } : undefined);
  };

  #updateSettings(id: string, settings: Parameters<typeof updateChartSettings>[2]): void {
    const next = updateChartSettings(this.#document, id, settings);
    if (!validateThemeDocument(next).ok) {
      this.#drawPanel();
      return;
    }
    this.#document = next;
    const plan = buildScenePlan({ document: next, source: this.#source, nowMs: Date.now(), animate: false });
    const chart = this.#scene.objectFor(id);
    const node = planNodeFor(plan.nodes, id);

    if (chart instanceof VigiliaChart && node?.content.kind === 'chart') {
      chart.set('settings', settings);
      chart.setOption(node.content.option);
      this.#editor.canvas.requestRenderAll();
    } else {
      // The adapter may not have adopted a revived object yet; retain a safe reconciliation path.
      this.#scene.apply(plan);
    }
    this.#drawPanel();
  }
}

function planNodeFor(nodes: readonly PlanNode[], id: string): PlanNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = planNodeFor(node.children ?? [], id);
    if (child !== undefined) return child;
  }
  return undefined;
}
