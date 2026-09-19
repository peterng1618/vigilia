// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createLayerPanel = vi.hoisted(() => vi.fn());
const destroyLayerPanel = vi.hoisted(() => vi.fn());

vi.mock('../layer-panel.js', () => ({
  createLayerPanel: (...args: readonly unknown[]) => createLayerPanel(...args),
}));
vi.mock('../artboard-panel.js', () => ({ createArtboardPanel: () => panel() }));
vi.mock('../palette-panel.js', () => ({ createPalettePanel: () => panel() }));
vi.mock('../type-preset-panel.js', () => ({ createTypePresetPanel: () => panel() }));
vi.mock('../new-object-panel.js', () => ({ createNewObjectPanel: () => panel() }));
vi.mock('../chart-manager/index.js', () => ({ ChartManager: class { destroy = vi.fn(); setGlobals = vi.fn(); reassignPaletteReferences = vi.fn(); } }));
vi.mock('../persistence-manager/index.js', () => ({ PersistenceManager: class { destroy = vi.fn(); isDirty = vi.fn(() => false); save = vi.fn(); }, confirmDocumentReplacement: vi.fn() }));
vi.mock('../shortcut-manager/index.js', () => ({ ShortcutManager: class { destroy = vi.fn(); register = vi.fn(); } }));

import { ForkExtensions } from './index.js';

describe('ForkExtensions', () => {
  beforeEach(() => {
    createLayerPanel.mockReset();
    destroyLayerPanel.mockReset();
    createLayerPanel.mockReturnValue({ root: document.createElement('section'), destroy: destroyLayerPanel });
  });

  it('owns the semantic layer panel lifecycle', () => {
    const editor = { canvas: { on: vi.fn(), off: vi.fn() } };
    const extensions = new ForkExtensions({
      shell: { editor, scene: {}, snapshot: vi.fn(() => envelope) } as never,
      source: {} as never,
      envelope,
      panelHost: document.body,
      onNew: vi.fn(), onOpen: vi.fn(), onSaved: vi.fn(),
    });

    expect(createLayerPanel).toHaveBeenCalledWith(document.body, editor);
    extensions.destroy();
    expect(destroyLayerPanel).toHaveBeenCalledTimes(1);
  });
});

const envelope = {
  id: 'theme', artboard: { width: 100, height: 100 }, scene: { version: '7.4.0', objects: [] },
};

function panel() {
  return { root: document.createElement('section'), render: vi.fn(), setGlobals: vi.fn() };
}
