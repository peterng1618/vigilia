// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FabricThemeEnvelope } from '@vigilia/renderer-core';

const createLayerPanel = vi.hoisted(() => vi.fn());
const destroyLayerPanel = vi.hoisted(() => vi.fn());
const saveMock = vi.hoisted(() => vi.fn(async () => {}));
const markSavedMock = vi.hoisted(() => vi.fn());

vi.mock('../layer-panel.js', () => ({
  createLayerPanel: (...args: readonly unknown[]) => createLayerPanel(...args),
}));
vi.mock('../artboard-panel.js', () => ({ createArtboardPanel: () => panel() }));
vi.mock('../palette-panel.js', () => ({ createPalettePanel: () => panel() }));
vi.mock('../type-preset-panel.js', () => ({ createTypePresetPanel: () => panel() }));
vi.mock('../new-object-panel.js', () => ({ createNewObjectPanel: () => panel() }));
vi.mock('../chart-manager/index.js', () => ({
  ChartManager: class {
    destroy = vi.fn();
    setGlobals = vi.fn();
    reassignPaletteReferences = vi.fn();
  },
}));
vi.mock('../persistence-manager/index.js', () => ({
  PersistenceManager: class {
    destroy = vi.fn();
    isDirty = vi.fn(() => false);
    save = saveMock;
    markSaved = markSavedMock;
  },
  confirmDocumentReplacement: vi.fn(async () => 'discard'),
}));
vi.mock('../shortcut-manager/index.js', () => ({
  ShortcutManager: class {
    destroy = vi.fn();
    register = vi.fn();
  },
}));

import { ForkExtensions } from './index.js';

const envelope: FabricThemeEnvelope = {
  schemaVersion: 2,
  fabricVersion: '7.4.0',
  id: 'theme',
  artboard: { width: 100, height: 100 },
  scene: { version: '7.4.0', objects: [] },
};

describe('ForkExtensions', () => {
  beforeEach(() => {
    createLayerPanel.mockReset();
    destroyLayerPanel.mockReset();
    saveMock.mockReset();
    markSavedMock.mockReset();
    createLayerPanel.mockReturnValue({ root: document.createElement('section'), destroy: destroyLayerPanel });
    document.body.replaceChildren();
  });

  it('owns the semantic layer panel lifecycle', () => {
    const editor = { canvas: { on: vi.fn(), off: vi.fn() } };
    const extensions = new ForkExtensions({
      shell: { editor, scene: {}, snapshot: vi.fn(() => envelope), setBackgroundMedia: vi.fn() } as never,
      source: {} as never,
      envelope,
      panelHost: document.body,
      onNew: vi.fn(),
      onOpen: vi.fn(),
      onSaved: vi.fn(),
    });

    expect(createLayerPanel).toHaveBeenCalledWith(document.body, editor);
    extensions.destroy();
    expect(destroyLayerPanel).toHaveBeenCalledTimes(1);
  });

  it('renders package and library buttons and dispatches actions', async () => {
    const editor = { canvas: { on: vi.fn(), off: vi.fn() } };
    const onOpenPackage = vi.fn();
    const onSaved = vi.fn();
    const mockClient = {
      list: vi.fn(async () => []),
      open: vi.fn(async () => new Uint8Array()),
      save: vi.fn(async () => {}),
    };

    const extensions = new ForkExtensions({
      shell: { editor, scene: {}, snapshot: vi.fn(() => envelope), setBackgroundMedia: vi.fn() } as never,
      source: {} as never,
      envelope,
      panelHost: document.body,
      libraryClient: mockClient,
      onNew: vi.fn(),
      onOpenPackage,
      onSaved,
    });

    const openPackageBtn = Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.textContent === 'Open package',
    );
    const savePackageBtn = Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.textContent === 'Save package',
    );
    const openLibraryBtn = Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.textContent === 'Open library',
    );
    const saveLibraryBtn = Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.textContent === 'Save to library',
    );
    const releaseBtn = document.body.querySelector<HTMLButtonElement>('[data-vigilia-theme-release]');

    expect(openPackageBtn).toBeDefined();
    expect(savePackageBtn).toBeDefined();
    expect(openLibraryBtn).toBeDefined();
    expect(saveLibraryBtn).toBeDefined();
    expect(releaseBtn).toBeDefined();

    openPackageBtn?.click();
    await Promise.resolve();
    expect(onOpenPackage).toHaveBeenCalled();

    savePackageBtn?.click();
    await Promise.resolve();
    expect(saveMock).toHaveBeenCalled();

    saveLibraryBtn?.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockClient.save).toHaveBeenCalled();

    extensions.destroy();
  });
});

function panel() {
  return { root: document.createElement('section'), render: vi.fn(), setAssets: vi.fn(), setGlobals: vi.fn() };
}
