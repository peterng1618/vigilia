import type { FabricThemeEnvelopeInput, SampleSource } from '@vigilia/renderer-core';
import type { ForkShell } from '../fork-shell.js';
import { ChartManager } from '../chart-manager/index.js';
import { PersistenceManager } from '../persistence-manager/index.js';
import { ShortcutManager } from '../shortcut-manager/index.js';

/** Composition root for Vigilia-specific behaviour layered above the fork. */
export class ForkExtensions {
  readonly charts: ChartManager;
  readonly #persistence = new PersistenceManager();
  readonly #shortcuts = new ShortcutManager();

  constructor(options: {
    readonly shell: ForkShell;
    readonly source: SampleSource;
    readonly envelope: FabricThemeEnvelopeInput;
    readonly panelHost: HTMLElement;
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
    this.#shortcuts.register('file.save', () => {
      this.#persistence.save(options.shell.snapshot(options.envelope));
      options.onSaved();
    });
  }

  destroy(): void {
    this.#shortcuts.destroy();
    this.#persistence.destroy();
    this.charts.destroy();
  }
}
