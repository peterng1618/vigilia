import {
  buildScenePlan,
  validateThemeDocument,
  type SampleSource,
  type ThemeDocument,
} from '@vigilia/renderer-core';
import type { ImageEditor } from '@anu3ev/fabric-image-editor';
import type { SceneAdapter } from '@vigilia/scene-fabric';
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
    this.#scene.apply(buildScenePlan({ document: next, source: this.#source, nowMs: Date.now(), animate: false }));
    this.#drawPanel();
  }
}
