// @vitest-environment jsdom

/**
 * The Add pane's file section: the declared-asset library the Assets pane used
 * to be.
 *
 * **The list is the declarations, not the placed objects.** That is the whole
 * rule the four cases below are about: an image or an SVG is declared *and*
 * placed, a video or a font is declared only, and both are listed — a font
 * imported once stays removable, and a video the artboard paints as background
 * media stays reachable. A list built from what is on the canvas keeps the
 * placeable files and silently loses the rest.
 *
 * **Replace acts on the chosen asset, never on the shown object.** Choosing a
 * row and swapping its bytes re-points every use of that id; the capability the
 * old panel only ever *claimed* — re-pointing one selected image — is not what
 * this is, and the case below says so.
 */
import { setObjectAssetReference } from "@vigilia/scene-fabric";
import { FabricImage, Group } from "fabric/es";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, type Mock, vi } from "vitest";
import {
  ASSET_FILE_EXTENSIONS,
  AssetManager,
} from "../../asset-manager/index.js";
import type { EditorInteraction } from "../../editor-interaction.js";
import { uiCopy } from "../../ui-copy.js";
import { FileSection } from "./file-section.js";

// React only flushes work scheduled inside `act` when it has been told it is in
// a test; without this, `act` warns and the update lands after the assertion.
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => document.body.replaceChildren());

/**
 * A local file the manager accepts: bytes, a name, and the MIME its extension
 * claims.
 *
 * `arrayBuffer` is answered from the bytes because jsdom's `File` does not
 * implement it — the same shim `asset-manager/index.dom.test.ts` uses, for the
 * same reason.
 */
function file(name: string, type: string, bytes: string): File {
  const source = new TextEncoder().encode(bytes);
  return Object.assign(
    new File([source as unknown as BlobPart], name, { type }),
    {
      arrayBuffer: async () =>
        source.buffer.slice(
          source.byteOffset,
          source.byteOffset + source.byteLength,
        ),
    },
  );
}

const IMAGE_FILE = file("logo.png", "image/png", "png-one");
const OTHER_IMAGE_FILE = file("logo.png", "image/png", "png-two");
const SVG_FILE = file("mark.svg", "image/svg+xml", "<svg/>");
const FONT_FILE = file("body.woff2", "font/woff2", "woff2");
const VIDEO_FILE = file("clip.mp4", "video/mp4", "mp4");

interface Harness {
  readonly host: HTMLElement;
  readonly manager: AssetManager;
  readonly placeImage: Mock;
  readonly replace: Mock;
  readonly hydrate: Mock;
  readonly remove: Mock;
  readonly saveState: Mock;
  readonly error: Mock;
  readonly changed: Mock;
}

/** The file section over a real `AssetManager`, on an editor stub that answers
 *  only what the section asks it: the canvas walk, the history and the errors. */
async function mount(
  isReferenced: (assetId: string) => boolean = () => false,
  objects: readonly unknown[] = [],
): Promise<Harness> {
  const host = document.createElement("div");
  document.body.append(host);
  inflight = [];
  const manager = new AssetManager();
  const placeImage = vi
    .spyOn(manager, "placeImage")
    .mockResolvedValue(undefined);
  const realImport = manager.import.bind(manager);
  vi.spyOn(manager, "import").mockImplementation((chosen) =>
    track(realImport(chosen)),
  );
  const realReplace = manager.replace.bind(manager);
  const replace = vi
    .spyOn(manager, "replace")
    .mockImplementation((assetId, chosen) =>
      track(realReplace(assetId, chosen)),
    );
  const hydrate = vi.spyOn(manager, "hydrate").mockResolvedValue(undefined);
  const remove = vi.spyOn(manager, "remove");
  const saveState = vi.fn();
  const error = vi.fn();
  const changed = vi.fn();
  const editor = {
    canvas: {
      getObjects: () => objects,
      requestRenderAll: vi.fn(),
    },
    historyManager: { saveState },
    errorManager: { error, warn: vi.fn() },
  } as unknown as EditorInteraction;

  await act(async () => {
    createRoot(host).render(
      <FileSection
        manager={manager}
        editor={editor}
        changed={changed}
        isReferenced={isReferenced}
      />,
    );
  });

  return {
    host,
    manager,
    placeImage,
    replace,
    hydrate,
    remove,
    saveState,
    error,
    changed,
  };
}

/** The options the declared list is drawing, in the order it draws them. */
function listedNames(host: HTMLElement): readonly string[] {
  return [...host.querySelectorAll("[data-vigilia-asset-select] option")].map(
    (option) => option.textContent ?? "",
  );
}

const selectControl = (host: HTMLElement): HTMLSelectElement =>
  host.querySelector<HTMLSelectElement>("[data-vigilia-asset-select]")!;

const alert = (host: HTMLElement): HTMLElement =>
  host.querySelector<HTMLElement>('[role="alert"]')!;

/** Points the list at one asset the way choosing it does. */
async function selectAsset(host: HTMLElement, assetId: string): Promise<void> {
  const control = selectControl(host);
  control.value = assetId;
  await act(async () =>
    control.dispatchEvent(new Event("change", { bubbles: true })),
  );
}

/**
 * The promises the manager handed back since the last `mount`, so a case can
 * wait for the real async work — `import` and `replace` hash the bytes with
 * `crypto.subtle`, which takes more than one turn under a loaded worker —
 * rather than guessing a turn count and flaking when it is wrong.
 */
let inflight: Promise<unknown>[] = [];

function track<T>(promise: Promise<T>): Promise<T> {
  inflight.push(promise);
  return promise;
}

/**
 * Waits for every tracked submission to land, then one turn for the render.
 *
 * A refusal is a rejection, and the component already turns it into a message;
 * this only waits, so it settles rather than rejects.
 */
async function drain(): Promise<void> {
  while (inflight.length > 0) {
    const batch = inflight;
    inflight = [];
    await Promise.allSettled(batch);
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Answers a file picker the way a browser does once a control opens it: the
 * files are set on the hidden input and its `change` fires, and the submission
 * it starts is waited out inside `act`.
 */
async function choose(
  host: HTMLElement,
  selector: string,
  chosen: File,
): Promise<void> {
  const input = host.querySelector<HTMLInputElement>(selector)!;
  Object.defineProperty(input, "files", {
    value: [chosen],
    configurable: true,
  });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await drain();
  });
}

/** Imports through the control the author presses. */
async function importFile(host: HTMLElement, chosen: File): Promise<void> {
  await choose(host, "[data-vigilia-asset-import-input]", chosen);
}

/** Chooses an asset and swaps its bytes, in that order. */
async function replaceFile(
  host: HTMLElement,
  assetId: string,
  chosen: File,
): Promise<void> {
  await selectAsset(host, assetId);
  await choose(host, "[data-vigilia-asset-replace-input]", chosen);
}

const removeControl = (host: HTMLElement): HTMLButtonElement =>
  host.querySelector<HTMLButtonElement>("[data-vigilia-asset-remove]")!;

describe("the Add pane's file section", () => {
  it("places an image or an SVG, and declares a video or a font without placing it", async () => {
    const { host, manager, placeImage } = await mount();

    await importFile(host, IMAGE_FILE);
    expect(manager.declarations.map((asset) => asset.id)).toEqual(["logo"]);
    expect(placeImage).toHaveBeenCalledTimes(1);
    expect(placeImage.mock.calls[0]?.[2]).toMatchObject({
      id: "logo",
      kind: "image",
    });

    await importFile(host, FONT_FILE);
    expect(manager.declarations.map((asset) => asset.id)).toEqual([
      "logo",
      "body",
    ]);
    // The font is declared and never placed: there is no image object for it.
    expect(placeImage).toHaveBeenCalledTimes(1);

    await importFile(host, VIDEO_FILE);
    expect(manager.declarations.map((asset) => asset.kind)).toEqual([
      "image",
      "font",
      "video",
    ]);
    expect(placeImage).toHaveBeenCalledTimes(1);

    await importFile(host, SVG_FILE);
    expect(manager.declarations.at(-1)).toMatchObject({ kind: "svg" });
    expect(placeImage).toHaveBeenCalledTimes(2);
  });

  it("keeps a declared-but-unplaced asset in the list, because it has no layer to hang on", async () => {
    const { host } = await mount();

    await importFile(host, FONT_FILE);

    // Review Focus 5: the list is the declarations, not the placed objects —
    // which is what keeps a font imported once removable.
    expect(listedNames(host)).toEqual(["body.woff2"]);
    expect(
      listedNames(host),
      "the file's name, never the id the package keys it by",
    ).not.toContain("body");
  });

  it("refuses to remove an asset the scene or the document still references, in words", async () => {
    const image = new FabricImage(document.createElement("img"), {
      id: "image-1",
    });
    setObjectAssetReference(image, { assetId: "logo", kind: "image" });
    const group = new Group([image]);
    group.set("id", "group-1");
    const { host, remove } = await mount(() => false, [group]);

    await importFile(host, IMAGE_FILE);
    await selectAsset(host, "logo");
    await act(async () => removeControl(host).click());

    expect(remove).not.toHaveBeenCalled();
    expect(alert(host).textContent).toBe(uiCopy.panels.assetReferenced);
    // Nothing was removed, so the list is untouched.
    expect(listedNames(host)).toEqual(["logo.png"]);
  });

  it("refuses a removal the document's own references ask for, which the canvas cannot see", async () => {
    const { host, remove } = await mount((assetId) => assetId === "logo");

    await importFile(host, IMAGE_FILE);
    await selectAsset(host, "logo");
    await act(async () => removeControl(host).click());

    expect(remove).not.toHaveBeenCalled();
    expect(alert(host).textContent).toBe(uiCopy.panels.assetReferenced);
  });

  it("removes an unreferenced asset, and the list follows the declarations", async () => {
    const { host, manager, changed } = await mount();

    await importFile(host, IMAGE_FILE);
    await selectAsset(host, "logo");
    await act(async () => removeControl(host).click());

    expect(manager.declarations).toEqual([]);
    expect(listedNames(host)).toEqual([]);
    expect(alert(host).textContent).toBe("");
    expect(changed).toHaveBeenCalled();
  });

  it("leaves the author's selection alone when a second file is imported", async () => {
    const { host } = await mount();

    // Nothing was selected and the list was empty, so the first import is the
    // one the list falls back to.
    await importFile(host, IMAGE_FILE);
    expect(selectControl(host).value).toBe("logo");

    await importFile(host, FONT_FILE);
    // Parity with the panel this replaces: adding a file never moved the list
    // off the asset the author was pointing at.
    expect(selectControl(host).value).toBe("logo");
  });

  it("keeps replace as the chosen asset's own byte swap, which is what it always meant", async () => {
    const { host, replace, hydrate, saveState } = await mount();

    await importFile(host, IMAGE_FILE);
    // The import is one committed edit; the replace below is what this case is
    // about, so the counter starts from the import.
    const afterImport = saveState.mock.calls.length;
    await replaceFile(host, "logo", OTHER_IMAGE_FILE);

    expect(replace).toHaveBeenCalledTimes(1);
    expect(
      replace.mock.calls[0]?.[0],
      "the chosen asset, never the selected one",
    ).toBe("logo");
    expect(replace.mock.calls[0]?.[1]).toBe(OTHER_IMAGE_FILE);
    // Rehydration is what carries the new pixels to every object bound to the
    // id; one committed edit.
    expect(hydrate).toHaveBeenCalledTimes(1);
    expect(saveState.mock.calls.length - afterImport).toBe(1);
  });

  it("replaces the asset the author chose, not the one a rebuild happened to leave selected", async () => {
    const { host, replace } = await mount();

    await importFile(host, IMAGE_FILE);
    await importFile(host, file("mark.svg", "image/svg+xml", "<svg/>"));
    await replaceFile(
      host,
      "mark",
      file("mark.svg", "image/svg+xml", "<svg><g/></svg>"),
    );

    expect(replace.mock.calls[0]?.[0]).toBe("mark");
  });

  it("shows a refused replacement's reason without touching the document", async () => {
    const { host, manager, saveState, error } = await mount();

    await importFile(host, IMAGE_FILE);
    const afterImport = saveState.mock.calls.length;
    await replaceFile(host, "logo", FONT_FILE);

    // A `.png` replaced by a `.woff2` keeps its path but not its format, and
    // `replace` refuses before it writes.
    expect(alert(host).textContent).toBe(uiCopy.panels.assetImportFailed);
    expect(error).toHaveBeenCalledWith(
      "image",
      uiCopy.panels.assetImportFailed,
      expect.any(Error),
    );
    // The refusal wrote nothing, so the import's own entry is all there is.
    expect(saveState.mock.calls.length).toBe(afterImport);
    expect(manager.declarations.map((asset) => asset.id)).toEqual(["logo"]);
  });

  it("reports a refused import without touching the document", async () => {
    const { host, manager, saveState, error } = await mount();

    // The extension is not one the package accepts at all.
    await importFile(host, file("notes.txt", "text/plain", "hi"));

    expect(manager.declarations).toEqual([]);
    expect(alert(host).textContent).toBe(uiCopy.panels.assetImportFailed);
    expect(error).toHaveBeenCalledWith(
      "image",
      uiCopy.panels.assetImportFailed,
      expect.any(Error),
    );
    expect(saveState).not.toHaveBeenCalled();
  });

  it("records exactly one history entry for an imported image", async () => {
    const { host, saveState } = await mount();

    await importFile(host, IMAGE_FILE);

    expect(saveState).toHaveBeenCalledTimes(1);
  });

  it("names each asset by the file it came from and previews the selection", async () => {
    const { host } = await mount();

    await importFile(host, IMAGE_FILE);
    await importFile(host, VIDEO_FILE);

    const select = selectControl(host);
    expect([...select.options].map((option) => option.textContent)).toEqual([
      "logo.png",
      "clip.mp4",
    ]);
    expect(host.querySelector("label")?.htmlFor).toBe(select.id);

    const preview = host.querySelector<HTMLImageElement>(
      "[data-vigilia-asset-preview]",
    )!;
    await selectAsset(host, "logo");
    expect(preview.getAttribute("src")).toBeTruthy();
    expect(preview.alt).toBe("logo.png");

    // A video has nothing to preview, and the section says so by clearing the
    // image rather than leaving the previous asset's picture standing.
    await selectAsset(host, "clip");
    expect(preview.getAttribute("src")).toBeNull();
    expect(preview.hidden).toBe(true);
  });

  it("opens each file input from a visible, named control", async () => {
    const { host } = await mount();

    const importInput = host.querySelector<HTMLInputElement>(
      "[data-vigilia-asset-import-input]",
    )!;
    const replaceInput = host.querySelector<HTMLInputElement>(
      "[data-vigilia-asset-replace-input]",
    )!;
    const importButton = host.querySelector<HTMLElement>(
      "[data-vigilia-asset-import]",
    )!;
    const replaceButton = host.querySelector<HTMLElement>(
      "[data-vigilia-asset-replace]",
    )!;

    expect(importButton.textContent).toBe(uiCopy.panels.importFile);
    expect(replaceButton.textContent).toBe(uiCopy.panels.replaceAsset);

    // **The accept rule, derived rather than restated.** Both pickers carry the
    // manager's own extension list, so adding an extension to `TYPES` moves the
    // string and this case with it; a hand-kept second list could widen only by
    // drifting silently.
    expect(ACCEPT).not.toBe("");
    expect(importInput.accept).toBe(ACCEPT);
    expect(replaceInput.accept).toBe(ACCEPT);

    const opened = [
      vi.spyOn(importInput, "click"),
      vi.spyOn(replaceInput, "click"),
    ];
    await act(async () => {
      importButton.click();
      replaceButton.click();
    });

    expect(opened[0]).toHaveBeenCalledOnce();
    expect(opened[1]).toHaveBeenCalledOnce();
  });
});

/** The file types both pickers offer — derived from the manager's own exported
 *  list, so an extension added to `TYPES` and not offered here, or offered here
 *  and not readable there, is red. */
const ACCEPT = ASSET_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(",");
