import type { FabricThemeEnvelopeInput, FitMode, SampleSource } from '@vigilia/renderer-core';
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
    this.#artboard = createArtboardPanel(options.panelHost, (fitMode) => this.#setFitMode(options.shell, fitMode));
    this.#artboard.render(this.#envelope.artboard.fitMode ?? 'contain');
    this.charts = new ChartManager({
      editor: options.shell.editor,
      scene: options.shell.scene,
      source: options.source,
      ...(options.envelope.bindings === undefined ? {} : { bindings: options.envelope.bindings }),
      panelHost: options.panelHost,
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

  #setFitMode(shell: ForkShell, fitMode: FitMode): void {
    this.#envelope = { ...this.#envelope, artboard: { ...this.#envelope.artboard, fitMode } };
    shell.setFitMode(fitMode);
    this.#artboard.render(fitMode);
  }

  #snapshot(shell: ForkShell) {
    return shell.snapshot(this.#envelope);
  }
}
