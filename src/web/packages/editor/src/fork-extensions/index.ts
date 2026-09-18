import type { Artboard, Binding, FabricPalette, FabricThemeEnvelopeInput, SampleSource } from '@vigilia/renderer-core';
import type { ForkShell } from '../fork-shell.js';
import { createArtboardPanel, type ArtboardPanel } from '../artboard-panel.js';
import { createPalettePanel, type PalettePanel } from '../palette-panel.js';
import { reassignObjectPaletteReferences, reassignObjectTypePresetReferences } from '@vigilia/scene-fabric';
import { createTypePresetPanel, type TypePresetPanel, type TypePresets } from '../type-preset-panel.js';
import { createNewObjectPanel, type NewObjectPanel } from '../new-object-panel.js';
import { ChartManager } from '../chart-manager/index.js';
import { PersistenceManager, confirmDocumentReplacement } from '../persistence-manager/index.js';
import { ShortcutManager } from '../shortcut-manager/index.js';

/** Composition root for Vigilia-specific behaviour layered above the fork. */
export class ForkExtensions {
  readonly charts: ChartManager;
  readonly #artboard: ArtboardPanel;
  readonly #palette: PalettePanel;
  readonly #types: TypePresetPanel;
  readonly #newObjects: NewObjectPanel;
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
    this.#newObjects = createNewObjectPanel(options.panelHost, options.shell.editor, this.#envelope.globals);
    this.#artboard = createArtboardPanel(
      options.panelHost,
      this.#envelope.globals,
      (artboard) => this.#setArtboard(options.shell, artboard),
    );
    this.#artboard.render(this.#envelope.artboard);
    this.#palette = createPalettePanel(options.panelHost, (palette) => this.#setPalette(options.shell, palette), (id, replacement) => this.#deletePalette(options.shell, id, replacement));
    this.#palette.render(this.#envelope.globals?.palette);
    this.#types = createTypePresetPanel(
      options.panelHost,
      (presets) => this.#setTypes(options.shell, presets),
      (id, replacement) => this.#deleteType(options.shell, id, replacement),
    );
    this.#types.render(this.#envelope.globals?.typePresets as TypePresets | undefined);
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
    this.#palette.root.remove();
    this.#types.root.remove();
    this.#newObjects.root.remove();
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

  #setPalette(shell: ForkShell, palette: FabricPalette): void {
    this.#envelope = { ...this.#envelope, globals: { ...this.#envelope.globals, palette } };
    shell.setGlobals(this.#envelope.globals);
    this.#newObjects.setGlobals(this.#envelope.globals);
    this.#artboard.setGlobals(this.#envelope.globals);
    this.#palette.render(palette);
  }

  #deletePalette(shell: ForkShell, id: string, replacement: string): void {
    if (id === 'none' || id === replacement) return;
    const from = `palette.${id}` as const;
    const to = `palette.${replacement}` as const;
    reassignObjectPaletteReferences(shell.editor.canvas, from, to);
    const artboard = { ...this.#envelope.artboard };
    for (const property of ['background', 'barColor'] as const) {
      const value = artboard[property];
      if (value !== undefined && 'ref' in value && value.ref === from) artboard[property] = { ref: to };
    }
    const palette = { ...this.#envelope.globals?.palette };
    delete palette[id];
    this.#envelope = { ...this.#envelope, artboard, globals: { ...this.#envelope.globals, palette } };
    shell.setArtboard(artboard);
    shell.setGlobals(this.#envelope.globals);
    this.#newObjects.setGlobals(this.#envelope.globals);
    this.#artboard.setGlobals(this.#envelope.globals);
    this.#artboard.render(artboard);
    this.#palette.render(palette);
  }

  #setTypes(shell: ForkShell, typePresets: TypePresets): void {
    this.#envelope = { ...this.#envelope, globals: { ...this.#envelope.globals, typePresets } };
    shell.setGlobals(this.#envelope.globals);
    this.#newObjects.setGlobals(this.#envelope.globals);
    this.#types.render(typePresets);
  }

  #deleteType(shell: ForkShell, id: string, replacement: string): void {
    if (id === replacement) return;
    const from = `typePresets.${id}` as const;
    const to = `typePresets.${replacement}` as const;
    reassignObjectTypePresetReferences(shell.editor.canvas, from, to);
    const typePresets = { ...this.#envelope.globals?.typePresets };
    delete typePresets[id];
    this.#envelope = { ...this.#envelope, globals: { ...this.#envelope.globals, typePresets } };
    shell.setGlobals(this.#envelope.globals);
    this.#newObjects.setGlobals(this.#envelope.globals);
    this.#types.render(typePresets as TypePresets);
  }

  #snapshot(shell: ForkShell) {
    return shell.snapshot(this.#envelope);
  }
}
