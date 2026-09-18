import type { Artboard, Binding, FabricThemeEnvelopeInput, SampleSource } from '@vigilia/renderer-core';
import type { ForkShell } from '../fork-shell.js';
import { createArtboardPanel, type ArtboardPanel } from '../artboard-panel.js';
import { ChartManager } from '../chart-manager/index.js';
import { PersistenceManager, confirmDocumentReplacement } from '../persistence-manager/index.js';
import { ShortcutManager } from '../shortcut-manager/index.js';

/** Composition root for Vigilia-specific behaviour layered above the fork. */
export class ForkExtensions {
  readonly charts: ChartManager;
  readonly #artboard: ArtboardPanel;
  readonly #persistence: PersistenceManager;
  readonly #shortcuts = new ShortcutManager();
  #envelope: FabricThemeEnvelopeInput;

  constructor(options: {
    readonly shell: ForkShell;
    readonly source: SampleSource;
    readonly envelope: FabricThemeEnvelopeInput;
    readonly panelHost: HTMLElement;
    readonly onNew: () => Promise<void>;
    readonly onOpen: () => void;
    readonly onSaved: () => void;
  }) {
    if (options.shell.scene === undefined) {
      throw new Error('The fork shell needs a scene adapter for Vigilia extensions.');
    }
    this.#envelope = options.envelope;
    this.#artboard = createArtboardPanel(options.panelHost, (artboard) => this.#setArtboard(options.shell, artboard));
    this.#artboard.render(this.#envelope.artboard);
    this.charts = new ChartManager({
      editor: options.shell.editor,
      scene: options.shell.scene,
      source: options.source,
      ...(options.envelope.bindings === undefined ? {} : { bindings: options.envelope.bindings }),
      panelHost: options.panelHost,
      onBindingsChange: (id, bindings) => this.#setBindings(id, bindings),
    });
    this.#persistence = new PersistenceManager(this.#snapshot(options.shell));
    this.#shortcuts.register('file.save', () => {
      this.#persistence.save(this.#snapshot(options.shell));
      options.onSaved();
    });
    this.#shortcuts.register('file.open', () => { void this.#open(options); });
    this.#shortcuts.register('file.new', () => { void this.#new(options); });
  }

  destroy(): void {
    this.#shortcuts.destroy();
    this.#persistence.destroy();
    this.charts.destroy();
    this.#artboard.root.remove();
  }

  async #open(options: {
    readonly shell: ForkShell;
    readonly envelope: FabricThemeEnvelopeInput;
    readonly onOpen: () => void;
    readonly onSaved: () => void;
  }): Promise<void> {
    if (!await this.#confirmReplacement(options)) return;
    options.onOpen();
  }

  async #new(options: {
    readonly shell: ForkShell;
    readonly envelope: FabricThemeEnvelopeInput;
    readonly onNew: () => Promise<void>;
    readonly onSaved: () => void;
  }): Promise<void> {
    if (!await this.#confirmReplacement(options)) return;
    await options.onNew();
  }

  async #confirmReplacement(options: {
    readonly shell: ForkShell;
    readonly envelope: FabricThemeEnvelopeInput;
    readonly onSaved: () => void;
  }): Promise<boolean> {
    const current = this.#snapshot(options.shell);

    if (this.#persistence.isDirty(current)) {
      const choice = await confirmDocumentReplacement();

      if (choice === 'cancel') return false;
      if (choice === 'save') {
        this.#persistence.save(current);
        options.onSaved();
      }
    }
    return true;
  }

  #setArtboard(shell: ForkShell, artboard: Artboard): void {
    this.#envelope = { ...this.#envelope, artboard };
    shell.setArtboard(artboard);
    this.#artboard.render(artboard);
  }

  #setBindings(id: string, bindings: readonly Binding[]): void {
    this.#envelope = { ...this.#envelope, bindings: { ...this.#envelope.bindings, [id]: bindings } };
  }

  #snapshot(shell: ForkShell) {
    return shell.snapshot(this.#envelope);
  }
}
