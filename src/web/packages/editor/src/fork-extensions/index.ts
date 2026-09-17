import type { FabricThemeEnvelopeInput, SampleSource } from '@vigilia/renderer-core';
import type { ForkShell } from '../fork-shell.js';
import { ChartManager } from '../chart-manager/index.js';
import { PersistenceManager, confirmDocumentReplacement } from '../persistence-manager/index.js';
import { ShortcutManager } from '../shortcut-manager/index.js';

/** Composition root for Vigilia-specific behaviour layered above the fork. */
export class ForkExtensions {
  readonly charts: ChartManager;
  readonly #persistence: PersistenceManager;
  readonly #shortcuts = new ShortcutManager();

  constructor(options: {
    readonly shell: ForkShell;
    readonly source: SampleSource;
    readonly envelope: FabricThemeEnvelopeInput;
    readonly panelHost: HTMLElement;
    readonly onOpen: () => void;
    readonly onSaved: () => void;
  }) {
    if (options.shell.scene === undefined) {
      throw new Error('The fork shell needs a scene adapter for Vigilia extensions.');
    }
    this.charts = new ChartManager({
      editor: options.shell.editor,
      scene: options.shell.scene,
      source: options.source,
      ...(options.envelope.bindings === undefined ? {} : { bindings: options.envelope.bindings }),
      panelHost: options.panelHost,
    });
    this.#persistence = new PersistenceManager(options.shell.snapshot(options.envelope));
    this.#shortcuts.register('file.save', () => {
      this.#persistence.save(options.shell.snapshot(options.envelope));
      options.onSaved();
    });
    this.#shortcuts.register('file.open', () => { void this.#open(options); });
  }

  destroy(): void {
    this.#shortcuts.destroy();
    this.#persistence.destroy();
    this.charts.destroy();
  }

  async #open(options: {
    readonly shell: ForkShell;
    readonly envelope: FabricThemeEnvelopeInput;
    readonly onOpen: () => void;
    readonly onSaved: () => void;
  }): Promise<void> {
    const current = options.shell.snapshot(options.envelope);

    if (this.#persistence.isDirty(current)) {
      const choice = await confirmDocumentReplacement();

      if (choice === 'cancel') return;
      if (choice === 'save') {
        this.#persistence.save(current);
        options.onSaved();
      }
    }

    options.onOpen();
  }
}
