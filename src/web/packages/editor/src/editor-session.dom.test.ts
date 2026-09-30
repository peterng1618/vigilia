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
import { AssetManager } from "./asset-manager/index.js";
import { fontTrio } from "./font-catalog.js";

/** What the chooser answered, per test. The chooser is a modal dialog with no
    jsdom implementation, so it is stubbed here and driven where it is real. */
const chooserMock = vi.hoisted(() =>
  vi.fn(async () => ({
    ratio: "16:9" as const,
    resolution: "1080p" as const,
    orientation: "landscape" as const,
  })),
);
vi.mock("./new-document-chooser.js", () => ({
  chooseArtboardPreset: () => chooserMock(),
}));

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
      textManager: {
        addText: vi.fn(),
        setAuthoringView: vi.fn(),
        setRepaint: vi.fn(),
      },
    };
    const onOpenPackage = vi.fn();
    const onSaved = vi.fn();
    const mockClient = {
      list: vi.fn(async () => []),
      open: vi.fn(async () => ({ envelope, assets: {} })),
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
      onNewFromStarter: vi.fn(),
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

  it("New creates at the size the chooser answered, and a dismissal creates nothing", async () => {
    const onNew = vi.fn(async () => undefined);
    const extensions = new EditorSession({
      shell: {
        editor: {
          canvas: {
            on: vi.fn(),
            off: vi.fn(),
            getActiveObject: () => undefined,
            getObjects: () => [],
            requestRenderAll: vi.fn(),
          },
          textManager: {
            addText: vi.fn(),
            setAuthoringView: vi.fn(),
            setRepaint: vi.fn(),
          },
        },
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
      onNew,
      onNewFromStarter: vi.fn(),
      onSaved: vi.fn(),
    });
    const session = extensions.actionFacade();

    chooserMock.mockResolvedValueOnce({
      ratio: "4:3",
      resolution: "2k",
      orientation: "portrait",
    } as never);
    await session.newDocument();
    // The three ids the author picked, resolved into the size they mean: 4:3
    // portrait at 2K is 1440 wide by 1920 high, the short edge being the width
    // once the orientation swaps. The chooser owns that arithmetic, so the
    // session must not restate it.
    expect(onNew).toHaveBeenCalledWith({ width: 1440, height: 1920 });

    // A chooser dismissed resolves nothing, and a New that creates nothing must
    // not be a New: the open document is untouched.
    onNew.mockClear();
    chooserMock.mockResolvedValueOnce(undefined as never);
    await session.newDocument();
    expect(onNew).not.toHaveBeenCalled();

    extensions.destroy();
  });

  it("New from starter creates the composition, and does not ask for a size", async () => {
    const onNewFromStarter = vi.fn(async () => undefined);
    const extensions = new EditorSession({
      shell: {
        editor: {
          canvas: {
            on: vi.fn(),
            off: vi.fn(),
            getActiveObject: () => undefined,
            getObjects: () => [],
            requestRenderAll: vi.fn(),
          },
          textManager: {
            addText: vi.fn(),
            setAuthoringView: vi.fn(),
            setRepaint: vi.fn(),
          },
        },
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
      onNew: vi.fn(),
      onNewFromStarter,
      onSaved: vi.fn(),
    });

    chooserMock.mockClear();
    await extensions.actionFacade().newFromStarter();

    // The starter is what it always was, at its own 1672x941: a template is
    // not resized to a preset the new-document list happens to offer.
    expect(onNewFromStarter).toHaveBeenCalled();
    expect(chooserMock).not.toHaveBeenCalled();

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
        textManager: {
          addText: vi.fn(),
          setAuthoringView: vi.fn(),
          setRepaint: vi.fn(),
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
      onNewFromStarter: vi.fn(),
      onSaved: vi.fn(),
    });

    const session = extensions.actionFacade();
    // The third argument is the picture the package carries; this canvas has
    // nothing laid out, so it renders none and the export happens regardless.
    await session.savePackage();
    expect(saveMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        metadata: { version: "1.2.3", locale: "en" },
      }),
      expect.anything(),
      undefined,
    );

    await session.releasePackage();
    expect(saveMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        metadata: { version: "1.2.4", locale: "en" },
      }),
      expect.anything(),
      undefined,
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
        textManager: {
          addText: vi.fn(),
          setAuthoringView: vi.fn(),
          setRepaint: vi.fn(),
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
      onNewFromStarter: vi.fn(),
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
        textManager: {
          addText: vi.fn(),
          setAuthoringView: vi.fn(),
          setRepaint: vi.fn(),
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
      onNewFromStarter: vi.fn(),
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
        textManager: {
          addText: vi.fn(),
          setAuthoringView: vi.fn(),
          setRepaint: vi.fn(),
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
      onNewFromStarter: vi.fn(),
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
        textManager: {
          addText: vi.fn(),
          setAuthoringView: vi.fn(),
          setRepaint: vi.fn(),
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
      onNewFromStarter: vi.fn(),
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

  it("re-hydrates declared image bytes after an undo rebuilds the scene", async () => {
    // U4: an undo crossed an image and the image never came back, because the
    // persisted `src` is an object URL `image-manager` already revoked. The
    // author saw their asset deleted rather than their transform reverted.
    const listeners = new Map<string, (() => void)[]>();
    const editor = {
      canvas: {
        on: vi.fn((event: string, handler: () => void) => {
          listeners.set(event, [...(listeners.get(event) ?? []), handler]);
        }),
        off: vi.fn(),
        getActiveObject: () => undefined,
        getObjects: () => [],
        requestRenderAll: vi.fn(),
      },
      textManager: {
        addText: vi.fn(),
        setAuthoringView: vi.fn(),
        setRepaint: vi.fn(),
      },
    };
    const hydrate = vi.spyOn(AssetManager.prototype, "hydrate");
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
      onNew: vi.fn(),
      onNewFromStarter: vi.fn(),
      onSaved: vi.fn(),
    });

    // Several owners listen on this one event, so every handler runs — the
    // mock is a single-handler map in some other test, and it hid this one.
    expect(listeners.get("editor:history-state-loaded")).toBeDefined();
    expect(hydrate).not.toHaveBeenCalled();

    for (const handler of listeners.get("editor:history-state-loaded") ?? [])
      handler();

    await vi.waitFor(() => expect(hydrate).toHaveBeenCalledOnce());

    extensions.destroy();
    hydrate.mockRestore();
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
