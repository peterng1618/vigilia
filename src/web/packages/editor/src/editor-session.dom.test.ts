// @vitest-environment jsdom

import type { FabricThemeEnvelope } from "@vigilia/renderer-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const saveMock = vi.hoisted(() => vi.fn(async () => {}));
const markSavedMock = vi.hoisted(() => vi.fn());
/** Shared, so a test can recover the registered `(id, handler)` pairs. */
const registerMock = vi.hoisted(() => vi.fn());

vi.mock("./artboard-panel.js", () => ({ createArtboardPanel: () => panel() }));
vi.mock("./palette-manager/index.js", () => ({
  createPalettePanel: () => panel(),
}));
vi.mock("./type-preset-manager/index.js", () => ({
  createTypePresetPanel: () => panel(),
}));
vi.mock("./new-object-panel.js", () => ({
  createNewObjectPanel: () => panel(),
}));
vi.mock("./chart-manager/index.js", () => ({
  ChartManager: class {
    destroy = vi.fn();
    setGlobals = vi.fn();
    reassignPaletteReferences = vi.fn();
  },
}));
vi.mock("./persistence-manager/index.js", () => ({
  PersistenceManager: class {
    destroy = vi.fn();
    isDirty = vi.fn(() => false);
    save = saveMock;
    markSaved = markSavedMock;
  },
  confirmDocumentReplacement: vi.fn(async () => "discard"),
}));
vi.mock("./shortcut-manager/index.js", () => ({
  ShortcutManager: class {
    destroy = vi.fn();
    register = registerMock;
  },
}));

import { EditorSession } from "./editor-session.js";
import { fontTrio } from "./font-catalog.js";

const envelope: FabricThemeEnvelope = {
  schemaVersion: 2,
  fabricVersion: "7.4.0",
  id: "theme",
  metadata: { locale: "en" },
  artboard: { width: 100, height: 100 },
  scene: { version: "7.4.0", objects: [] },
};

describe("EditorSession", () => {
  beforeEach(() => {
    saveMock.mockReset();
    markSavedMock.mockReset();
    registerMock.mockReset();
    document.body.replaceChildren();
  });

  it("dispatches package and library actions through the shell façade", async () => {
    const editor = {
      canvas: {
        on: vi.fn(),
        off: vi.fn(),
        getActiveObject: () => undefined,
        getObjects: () => [],
        requestRenderAll: vi.fn(),
      },
    };
    const onOpenPackage = vi.fn();
    const onSaved = vi.fn();
    const mockClient = {
      list: vi.fn(async () => []),
      open: vi.fn(async () => new Uint8Array()),
      save: vi.fn(async () => {}),
    };

    const extensions = new EditorSession({
      shell: {
        editor,
        scene: {},
        snapshot: vi.fn(() => envelope),
        setBackgroundMedia: vi.fn(),
      } as never,
      source: {} as never,
      envelope,
      panelHosts: {
        add: document.body,
        assets: document.body,
        document: document.body,
        chart: document.body,
        selection: document.body,
        style: document.body,
      },
      libraryClient: mockClient,
      onNew: vi.fn(),
      onOpenPackage,
      onSaved,
    });

    // The File menu owns these now; the panel section is gone.
    expect(
      document.body.querySelector("[data-vigilia-file-actions]"),
    ).toBeNull();
    const session = extensions.actionFacade();

    session.openPackage();
    await Promise.resolve();
    expect(onOpenPackage).toHaveBeenCalled();

    await session.savePackage();
    expect(onSaved).toHaveBeenCalled();

    await session.saveLibrary();
    expect(mockClient.save).toHaveBeenCalled();

    extensions.destroy();
  });

  it("bumps the release version only from Release", async () => {
    vi.stubGlobal(
      "prompt",
      vi.fn(() => "patch"),
    );
    const shell = {
      editor: {
        canvas: {
          on: vi.fn(),
          off: vi.fn(),
          getActiveObject: () => undefined,
          getObjects: () => [],
          requestRenderAll: vi.fn(),
        },
      },
      scene: {},
      snapshot: vi.fn((input) => ({ ...envelope, ...input })),
      setBackgroundMedia: vi.fn(),
    };
    const extensions = new EditorSession({
      shell: shell as never,
      source: {} as never,
      envelope: { ...envelope, metadata: { version: "1.2.3", locale: "en" } },
      panelHosts: {
        add: document.body,
        assets: document.body,
        document: document.body,
        chart: document.body,
        selection: document.body,
        style: document.body,
      },
      onNew: vi.fn(),
      onSaved: vi.fn(),
    });

    const session = extensions.actionFacade();
    await session.savePackage();
    expect(saveMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        metadata: { version: "1.2.3", locale: "en" },
      }),
      expect.anything(),
    );

    await session.releasePackage();
    expect(saveMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        metadata: { version: "1.2.4", locale: "en" },
      }),
      expect.anything(),
    );
    extensions.destroy();
  });

  it("adopts a trio and replaces every assigned preset face", async () => {
    const fetch = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));
    vi.stubGlobal("fetch", fetch);
    const shell = {
      editor: {
        canvas: {
          on: vi.fn(),
          off: vi.fn(),
          getActiveObject: () => undefined,
          getObjects: () => [],
          requestRenderAll: vi.fn(),
        },
        historyManager: { saveState: vi.fn() },
      },
      scene: {},
      snapshot: vi.fn((input) => ({ ...envelope, ...input })),
      setBackgroundMedia: vi.fn(),
      setGlobals: vi.fn(),
    };
    const extensions = new EditorSession({
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
      panelHosts: {
        add: document.body,
        assets: document.body,
        document: document.body,
        chart: document.body,
        selection: document.body,
        style: document.body,
      },
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
        canvas: {
          on: vi.fn(),
          off: vi.fn(),
          getActiveObject: () => undefined,
          getObjects: () => [],
          requestRenderAll: vi.fn(),
        },
        historyManager: { saveState: vi.fn() },
      },
      scene: {},
      snapshot: vi.fn((input) => ({ ...envelope, ...input })),
      setBackgroundMedia: vi.fn(),
      setGlobals: vi.fn(),
    };
    const extensions = new EditorSession({
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
      panelHosts: {
        add: document.body,
        assets: document.body,
        document: document.body,
        chart: document.body,
        selection: document.body,
        style: document.body,
      },
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

  it("closes an open nudge burst before undoing", async () => {
    let suspended = 0;
    const suspend = vi.fn(() => {
      suspended += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        suspended -= 1;
      };
    });
    const saveState = vi.fn();
    const undo = vi.fn();
    const object = {
      locked: false,
      getRelativeCenterPoint: () => ({ x: 10, y: 20 }),
      setPositionByOrigin: vi.fn(),
      setCoords: vi.fn(),
    };
    // The inspector renders whatever is selectable at construction, so the
    // selection is armed only once the session exists.
    const selection = { active: undefined as unknown };
    const shell = {
      editor: {
        canvas: {
          on: vi.fn(),
          off: vi.fn(),
          fire: vi.fn(),
          getActiveObject: () => selection.active,
          getObjects: () => [],
          requestRenderAll: vi.fn(),
        },
        historyManager: { suspend, saveState, undo, redo: vi.fn() },
      },
      scene: {},
      snapshot: vi.fn((input) => ({ ...envelope, ...input })),
      setBackgroundMedia: vi.fn(),
    };
    const extensions = new EditorSession({
      shell: shell as never,
      source: {} as never,
      envelope,
      panelHosts: {
        add: document.body,
        assets: document.body,
        document: document.body,
        chart: document.body,
        selection: document.body,
        style: document.body,
      },
      onNew: vi.fn(),
      onSaved: vi.fn(),
    });

    const handler = (id: string): ((event?: KeyboardEvent) => void) => {
      const call = registerMock.mock.calls.find(([key]) => key === id);
      if (call === undefined) throw new Error(`${id} is not registered`);
      return call[1] as (event?: KeyboardEvent) => void;
    };
    const press = new KeyboardEvent("keydown", { key: "ArrowRight" });

    // Two presses, so the burst is open and nothing is recorded yet.
    selection.active = object;
    handler("canvas.nudge-right")(press);
    handler("canvas.nudge-right")(press);
    expect(suspended).toBe(1);
    expect(saveState).not.toHaveBeenCalled();

    // Undo inside the idle window: the burst must close first, or the entry it
    // would step back to does not exist yet.
    handler("edit.undo")();
    expect(saveState).toHaveBeenCalledTimes(1);
    expect(suspend).toHaveBeenCalledTimes(1);
    expect(suspended).toBe(0);
    expect(undo).toHaveBeenCalledTimes(1);

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
        canvas: {
          on: vi.fn(),
          off: vi.fn(),
          getActiveObject: () => undefined,
          getObjects: () => [],
          requestRenderAll: vi.fn(),
        },
        historyManager: { saveState: vi.fn() },
      },
      scene: {},
      snapshot: vi.fn((input) => ({ ...envelope, ...input })),
      setBackgroundMedia: vi.fn(),
      setGlobals: vi.fn(),
    };
    const extensions = new EditorSession({
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
      panelHosts: {
        add: document.body,
        assets: document.body,
        document: document.body,
        chart: document.body,
        selection: document.body,
        style: document.body,
      },
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
