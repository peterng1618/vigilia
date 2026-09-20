// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FabricThemeEnvelope } from "@vigilia/renderer-core";

const createLayerPanel = vi.hoisted(() => vi.fn());
const destroyLayerPanel = vi.hoisted(() => vi.fn());
const saveMock = vi.hoisted(() => vi.fn(async () => {}));
const markSavedMock = vi.hoisted(() => vi.fn());

vi.mock("../layer-panel.js", () => ({
  createLayerPanel: (...args: readonly unknown[]) => createLayerPanel(...args),
}));
vi.mock("../artboard-panel.js", () => ({ createArtboardPanel: () => panel() }));
vi.mock("../palette-panel.js", () => ({ createPalettePanel: () => panel() }));
vi.mock("../type-preset-panel.js", () => ({
  createTypePresetPanel: () => panel(),
}));
vi.mock("../new-object-panel.js", () => ({
  createNewObjectPanel: () => panel(),
}));
vi.mock("../chart-manager/index.js", () => ({
  ChartManager: class {
    destroy = vi.fn();
    setGlobals = vi.fn();
    reassignPaletteReferences = vi.fn();
  },
}));
vi.mock("../persistence-manager/index.js", () => ({
  PersistenceManager: class {
    destroy = vi.fn();
    isDirty = vi.fn(() => false);
    save = saveMock;
    markSaved = markSavedMock;
  },
  confirmDocumentReplacement: vi.fn(async () => "discard"),
}));
vi.mock("../shortcut-manager/index.js", () => ({
  ShortcutManager: class {
    destroy = vi.fn();
    register = vi.fn();
  },
}));

import { ForkExtensions } from "./index.js";
import { fontTrio } from "../font-catalog.js";

const envelope: FabricThemeEnvelope = {
  schemaVersion: 2,
  fabricVersion: "7.4.0",
  id: "theme",
  artboard: { width: 100, height: 100 },
  scene: { version: "7.4.0", objects: [] },
};

describe("ForkExtensions", () => {
  beforeEach(() => {
    createLayerPanel.mockReset();
    destroyLayerPanel.mockReset();
    saveMock.mockReset();
    markSavedMock.mockReset();
    createLayerPanel.mockReturnValue({
      root: document.createElement("section"),
      destroy: destroyLayerPanel,
    });
    document.body.replaceChildren();
  });

  it("owns the semantic layer panel lifecycle", () => {
    const editor = { canvas: { on: vi.fn(), off: vi.fn() } };
    const extensions = new ForkExtensions({
      shell: {
        editor,
        scene: {},
        snapshot: vi.fn(() => envelope),
        setBackgroundMedia: vi.fn(),
      } as never,
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

  it("renders package and library buttons and dispatches actions", async () => {
    const editor = { canvas: { on: vi.fn(), off: vi.fn() } };
    const onOpenPackage = vi.fn();
    const onSaved = vi.fn();
    const mockClient = {
      list: vi.fn(async () => []),
      open: vi.fn(async () => new Uint8Array()),
      save: vi.fn(async () => {}),
    };

    const extensions = new ForkExtensions({
      shell: {
        editor,
        scene: {},
        snapshot: vi.fn(() => envelope),
        setBackgroundMedia: vi.fn(),
      } as never,
      source: {} as never,
      envelope,
      panelHost: document.body,
      libraryClient: mockClient,
      onNew: vi.fn(),
      onOpenPackage,
      onSaved,
    });

    const openPackageBtn = Array.from(
      document.body.querySelectorAll("button"),
    ).find((b) => b.textContent === "Open package");
    const savePackageBtn = Array.from(
      document.body.querySelectorAll("button"),
    ).find((b) => b.textContent === "Save package");
    const openLibraryBtn = Array.from(
      document.body.querySelectorAll("button"),
    ).find((b) => b.textContent === "Open library");
    const saveLibraryBtn = Array.from(
      document.body.querySelectorAll("button"),
    ).find((b) => b.textContent === "Save to library");
    const releaseBtn = document.body.querySelector<HTMLButtonElement>(
      "[data-vigilia-theme-release]",
    );

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

  it("adopts a trio and replaces every assigned preset face", async () => {
    const fetch = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));
    vi.stubGlobal("fetch", fetch);
    const shell = {
      editor: {
        canvas: { on: vi.fn(), off: vi.fn() },
        historyManager: { saveState: vi.fn() },
      },
      scene: {},
      snapshot: vi.fn((input) => ({ ...envelope, ...input })),
      setBackgroundMedia: vi.fn(),
      setGlobals: vi.fn(),
    };
    const extensions = new ForkExtensions({
      shell: shell as never,
      source: {} as never,
      envelope: {
        ...envelope,
        globals: {
          typePresets: {
            heading: {
              name: "Heading",
              value: {
                family: "Segoe UI",
                size: 32,
                weight: "500",
                trioRole: "heading",
              },
            },
            metric: {
              name: "Metric",
              value: {
                family: "Segoe UI",
                size: 70,
                weight: "300",
                trioRole: "heading",
              },
            },
            custom: { name: "Custom", value: { family: "Georgia", size: 19 } },
          },
        },
      },
      panelHost: document.body,
      onNew: vi.fn(),
      onSaved: vi.fn(),
    });

    const result = await extensions.applyFontTrio("minimal");

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(result.globals?.typePresets).toMatchObject({
      heading: {
        value: {
          family: "Inter",
          size: 32,
          weight: 700,
          face: { assetId: "inter-700" },
        },
      },
      metric: {
        value: {
          family: "Inter",
          size: 70,
          weight: 700,
          face: { assetId: "inter-700" },
        },
      },
      custom: { name: "Custom", value: { family: "Georgia", size: 19 } },
    });
    expect(result.assets).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "inter-700" })]),
    );
    expect(shell.editor.historyManager.saveState).toHaveBeenCalledTimes(1);
    extensions.destroy();
  });

  it("adopts one face without changing the preset role or scale", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([1, 2, 3]))),
    );
    const shell = {
      editor: {
        canvas: { on: vi.fn(), off: vi.fn() },
        historyManager: { saveState: vi.fn() },
      },
      scene: {},
      snapshot: vi.fn((input) => ({ ...envelope, ...input })),
      setBackgroundMedia: vi.fn(),
      setGlobals: vi.fn(),
    };
    const extensions = new ForkExtensions({
      shell: shell as never,
      source: {} as never,
      envelope: {
        ...envelope,
        globals: {
          typePresets: {
            heading: {
              name: "Heading",
              value: {
                family: "Inter",
                size: 32,
                weight: "700",
                trioRole: "heading",
                face: { assetId: "inter-700" },
              },
            },
          },
        },
      },
      panelHost: document.body,
      onNew: vi.fn(),
      onSaved: vi.fn(),
    });

    const result = await extensions.applyPresetFace(
      "heading",
      fontTrio("minimal")!.faces[1]!,
    );

    expect(result.globals?.typePresets).toMatchObject({
      heading: {
        value: {
          family: "Inter",
          size: 32,
          weight: 400,
          trioRole: "heading",
          face: { assetId: "inter-400" },
        },
      },
    });
    expect(result.assets).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "inter-400" })]),
    );
    extensions.destroy();
  });

  it("leaves the document unchanged when a trio download fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(new Uint8Array([1])))
        .mockResolvedValueOnce(new Response("", { status: 404 })),
    );
    const shell = {
      editor: {
        canvas: { on: vi.fn(), off: vi.fn() },
        historyManager: { saveState: vi.fn() },
      },
      scene: {},
      snapshot: vi.fn((input) => ({ ...envelope, ...input })),
      setBackgroundMedia: vi.fn(),
      setGlobals: vi.fn(),
    };
    const extensions = new ForkExtensions({
      shell: shell as never,
      source: {} as never,
      envelope: {
        ...envelope,
        globals: {
          typePresets: {
            heading: {
              name: "Heading",
              value: { family: "Segoe UI", size: 32, trioRole: "heading" },
            },
          },
        },
      },
      panelHost: document.body,
      onNew: vi.fn(),
      onSaved: vi.fn(),
    });

    await expect(extensions.applyFontTrio("minimal")).rejects.toThrow("404");
    expect(extensions.envelope.globals?.typePresets).toEqual({
      heading: {
        name: "Heading",
        value: { family: "Segoe UI", size: 32, trioRole: "heading" },
      },
    });
    expect(shell.editor.historyManager.saveState).not.toHaveBeenCalled();
    extensions.destroy();
  });
});

function panel() {
  return {
    root: document.createElement("section"),
    render: vi.fn(),
    setAssets: vi.fn(),
    setGlobals: vi.fn(),
  };
}
