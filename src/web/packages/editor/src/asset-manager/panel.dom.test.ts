// @vitest-environment jsdom
import { FabricImage } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { uiCopy } from "../ui-copy.js";
import { createAssetPanel } from "./index.js";

describe("asset panel", () => {
  it("exposes local import, selected replacement, and protected removal controls", () => {
    const remove = vi.fn(() => false);
    const manager = {
      declarations: [{ id: "logo", kind: "image", path: "assets/logo.png" }],
      previewUrl: () => "blob:logo",
      remove,
    };
    const editor = {
      canvas: {
        getObjects: () => [{ get: () => ({ assetId: "logo", kind: "image" }) }],
      },
    };

    const panel = createAssetPanel(
      document.body,
      manager as never,
      editor as never,
      vi.fn(),
    );

    expect(panel.querySelector("[data-vigilia-asset-import]")).not.toBeNull();
    expect(panel.querySelector("[data-vigilia-asset-replace]")).not.toBeNull();
    expect(panel.querySelector("[data-vigilia-asset-remove]")).not.toBeNull();
    (
      panel.querySelector("[data-vigilia-asset-remove]") as HTMLButtonElement
    ).click();
    expect(remove).not.toHaveBeenCalled();
  });

  it("refuses removal when an artboard background references the asset", () => {
    const remove = vi.fn(() => false);
    const manager = {
      declarations: [{ id: "hero", kind: "image", path: "assets/hero.png" }],
      previewUrl: () => "blob:hero",
      remove,
    };
    const editor = { canvas: { getObjects: () => [] } };

    const panel = createAssetPanel(
      document.body,
      manager as never,
      editor as never,
      vi.fn(),
      (id) => id === "hero",
    );
    (
      panel.querySelector("[data-vigilia-asset-remove]") as HTMLButtonElement
    ).click();

    expect(remove).not.toHaveBeenCalled();
  });

  it("says why a referenced asset cannot be removed", () => {
    const panel = createAssetPanel(
      document.body,
      {
        declarations: [{ id: "hero", kind: "image", path: "assets/hero.png" }],
        previewUrl: () => "blob:hero",
        remove: vi.fn(() => false),
      } as never,
      { canvas: { getObjects: () => [] } } as never,
      vi.fn(),
      () => true,
    );
    (
      panel.querySelector("[data-vigilia-asset-remove]") as HTMLButtonElement
    ).click();

    expect(panel.querySelector('[role="alert"]')?.textContent).toBe(
      uiCopy.panels.assetReferenced,
    );
  });
});

describe("asset panel reach", () => {
  it("opens each file input from a visible, named control", () => {
    const panel = createAssetPanel(
      document.body,
      emptyManager() as never,
      { canvas: { getObjects: () => [] } } as never,
      vi.fn(),
    );
    const importInput = panel.querySelector<HTMLInputElement>(
      "[data-vigilia-asset-import-input]",
    )!;
    const replaceInput = panel.querySelector<HTMLInputElement>(
      "[data-vigilia-asset-replace-input]",
    )!;
    const importButton = panel.querySelector<HTMLButtonElement>(
      "[data-vigilia-asset-import]",
    )!;
    const replaceButton = panel.querySelector<HTMLButtonElement>(
      "[data-vigilia-asset-replace]",
    )!;
    const opened = [
      vi.spyOn(importInput, "click"),
      vi.spyOn(replaceInput, "click"),
    ];

    expect(importButton.textContent).toBe(uiCopy.panels.importAsset);
    expect(replaceButton.textContent).toBe(uiCopy.panels.replaceAsset);
    importButton.click();
    replaceButton.click();

    expect(opened[0]).toHaveBeenCalledOnce();
    expect(opened[1]).toHaveBeenCalledOnce();
  });

  it("names each asset by the file it came from and previews the selection", () => {
    const panel = createAssetPanel(
      document.body,
      {
        declarations: [
          { id: "hero", kind: "image", path: "assets/hero.png" },
          { id: "loop", kind: "video", path: "assets/loop.mp4" },
        ],
        previewUrl: (id: string) => (id === "hero" ? "blob:hero" : undefined),
        remove: vi.fn(() => false),
      } as never,
      { canvas: { getObjects: () => [] } } as never,
      vi.fn(),
    );
    const select = panel.querySelector<HTMLSelectElement>(
      "[data-vigilia-asset-select]",
    )!;
    const preview = panel.querySelector<HTMLImageElement>(
      "[data-vigilia-asset-preview]",
    )!;

    expect([...select.options].map((option) => option.textContent)).toEqual([
      "hero.png",
      "loop.mp4",
    ]);
    expect(panel.querySelector("label")?.htmlFor).toBe(select.id);
    expect(select.value).toBe("hero");
    expect(preview.getAttribute("src")).toBe("blob:hero");
    expect(preview.alt).toBe("hero.png");
  });

  it("reports a refused import without touching the document", async () => {
    const saveState = vi.fn();
    const error = vi.fn();
    const manager = {
      declarations: [],
      import: vi.fn(() => Promise.reject(new Error("unsupported"))),
      remove: vi.fn(() => false),
    };
    const panel = createAssetPanel(
      document.body,
      manager as never,
      editorWith({ saveState, error }) as never,
      vi.fn(),
    );

    choose(panel, "[data-vigilia-asset-import-input]");
    await vi.waitFor(() =>
      expect(panel.querySelector('[role="alert"]')?.textContent).toBe(
        uiCopy.panels.assetImportFailed,
      ),
    );

    expect(manager.import).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledWith(
      "image",
      uiCopy.panels.assetImportFailed,
      expect.any(Error),
    );
    expect(saveState).not.toHaveBeenCalled();
  });

  it("records exactly one history entry for an imported image", async () => {
    const saveState = vi.fn();
    const image = new FabricImage(document.createElement("img"), {
      id: "image-1",
    });
    const manager = {
      declarations: [],
      import: vi.fn(() =>
        Promise.resolve({
          id: "hero",
          kind: "image",
          path: "assets/hero.png",
        }),
      ),
      previewUrl: () => "blob:hero",
      remove: vi.fn(() => false),
    };
    const panel = createAssetPanel(
      document.body,
      manager as never,
      editorWith({
        saveState,
        error: vi.fn(),
        importImage: vi.fn(() => Promise.resolve({ image })),
      }) as never,
      vi.fn(),
    );

    choose(panel, "[data-vigilia-asset-import-input]");
    await vi.waitFor(() => expect(saveState).toHaveBeenCalledOnce());
  });
});

function emptyManager(): unknown {
  return { declarations: [], remove: vi.fn(() => false) };
}

function editorWith(overrides: {
  readonly saveState?: () => void;
  readonly error?: (category: string, message: string, cause: unknown) => void;
  readonly importImage?: (options: unknown) => Promise<{ image: unknown }>;
}): unknown {
  return {
    canvas: {
      getObjects: () => [],
      getActiveObject: () => undefined,
      setActiveObject: vi.fn(),
      requestRenderAll: vi.fn(),
    },
    imageManager: {
      importImage: overrides.importImage ?? vi.fn(() => Promise.resolve(null)),
    },
    historyManager: { saveState: overrides.saveState ?? vi.fn() },
    errorManager: { error: overrides.error ?? vi.fn(), warn: vi.fn() },
  };
}

/** Hands a file to a hidden input the way a browser does once a control opens it. */
function choose(panel: HTMLElement, selector: string): void {
  const input = panel.querySelector<HTMLInputElement>(selector)!;
  Object.defineProperty(input, "files", {
    value: [
      new File([new Uint8Array([1, 2, 3])], "hero.png", { type: "image/png" }),
    ],
    configurable: true,
  });
  input.dispatchEvent(new Event("change"));
}
