import { setObjectAssetReference } from "@vigilia/scene-fabric";
import { FabricImage } from "fabric/es";
import type { EditorInteraction } from "../editor-interaction.js";
import { uiCopy } from "../ui-copy.js";
import {
  type AssetManager,
  assetReferencedBy,
  type LocalAssetReference,
  type PlacedAssetReference,
} from "./index.js";

/** Local-file controls; the editor continues to own canvas selection and history. */
export function createAssetPanel(
  host: HTMLElement,
  manager: AssetManager,
  editor: EditorInteraction,
  changed: () => void,
  isReferenced?: (assetId: string) => boolean,
): HTMLElement {
  const root = document.createElement("section");
  const listLabel = document.createElement("label");
  listLabel.textContent = uiCopy.panels.assetList;
  const select = document.createElement("select");
  select.dataset["vigiliaAssetSelect"] = "";
  listLabel.htmlFor = select.id = `vigilia-asset-${++assetPanelSeq}`;
  const preview = document.createElement("img");
  preview.dataset["vigiliaAssetPreview"] = "";
  preview.style.cssText = "max-width:100%;max-height:120px;object-fit:contain";
  const importInput = input("data-vigilia-asset-import-input");
  const replaceInput = input("data-vigilia-asset-replace-input");
  const importButton = action(
    "vigiliaAssetImport",
    uiCopy.panels.importAsset,
    () => importInput.click(),
  );
  const replaceButton = action(
    "vigiliaAssetReplace",
    uiCopy.panels.replaceAsset,
    () => replaceInput.click(),
  );
  const remove = action("vigiliaAssetRemove", uiCopy.panels.removeAsset, () => {
    const id = select.value;
    if (
      assetReferencedBy(editor.canvas.getObjects(), id) ||
      isReferenced?.(id) === true
    ) {
      report(uiCopy.panels.assetReferenced);
      return;
    }
    if (manager.remove(id)) {
      report("");
      changed();
      render();
    }
  });
  const alert = document.createElement("p");
  alert.setAttribute("role", "alert");
  const field = document.createElement("div");
  field.className = "vigilia-field";
  field.append(listLabel, select);
  const actions = document.createElement("div");
  actions.className = "vigilia-field-row";
  actions.append(importButton, replaceButton, remove);
  root.append(
    Object.assign(document.createElement("h2"), {
      textContent: uiCopy.panels.assets,
    }),
    field,
    preview,
    actions,
    alert,
    importInput,
    replaceInput,
  );
  host.append(root);

  const report = (message: string): void => {
    alert.textContent = message;
  };
  const selected = (): LocalAssetReference | undefined =>
    manager.declarations.find((asset) => asset.id === select.value);
  /** The file an author chose, not the id the package keys it by. */
  const fileNameOf = (asset: LocalAssetReference): string => {
    const separator = asset.path.lastIndexOf("/");
    return separator < 0 ? asset.path : asset.path.slice(separator + 1);
  };
  const drawPreview = (): void => {
    const asset = selected();
    const url = asset === undefined ? undefined : manager.previewUrl(asset.id);
    if (asset === undefined || url === undefined) {
      preview.removeAttribute("src");
      preview.hidden = true;
      return;
    }
    preview.alt = fileNameOf(asset);
    preview.src = url;
    preview.hidden = false;
  };
  const render = (): void => {
    const previous = select.value;
    select.replaceChildren(
      ...manager.declarations.map((asset) =>
        Object.assign(document.createElement("option"), {
          value: asset.id,
          textContent: fileNameOf(asset),
        }),
      ),
    );
    // Rebuilding the options drops the selection, and an author who was
    // pointing at one asset must not find the pane pointing at another.
    if (manager.declarations.some((asset) => asset.id === previous))
      select.value = previous;
    drawPreview();
  };

  const add = async (file: File, replaceSelected: boolean): Promise<void> => {
    if (replaceSelected) {
      await replaceSelectedAsset(file);
      return;
    }
    let asset: LocalAssetReference;
    try {
      asset = await manager.import(file);
    } catch (error) {
      // The manager validates before it mutates, so a refused file leaves the
      // package and the document exactly as they were.
      report(uiCopy.panels.assetImportFailed);
      editor.errorManager.error(
        "image",
        uiCopy.panels.assetImportFailed,
        error,
      );
      return;
    }
    if (!isPlaceable(asset)) {
      report("");
      changed();
      render();
      return;
    }
    try {
      if (!(await place(asset, file))) {
        // The bytes are declared even when no object took them, so the pane
        // still redraws: an asset the author cannot see is worse than one they can.
        report(uiCopy.panels.assetImportFailed);
        changed();
        render();
        return;
      }
    } catch (error) {
      report(uiCopy.panels.assetImportFailed);
      editor.errorManager.error(
        "image",
        uiCopy.panels.assetImportFailed,
        error,
      );
      changed();
      render();
      return;
    }
    report("");
    editor.historyManager.saveState();
    editor.canvas.requestRenderAll();
    changed();
    render();
  };

  /**
   * Swaps the chosen asset's bytes and re-points everything bound to it.
   *
   * This is what "Replace" always meant: the author picked an asset in the
   * dropdown and chose a new file for *it*. Declaring a new asset and
   * re-pointing the selected object left the chosen asset holding its old
   * bytes and grew the package by one file per press.
   */
  const replaceSelectedAsset = async (file: File): Promise<void> => {
    const id = select.value;
    if (!manager.declarations.some((asset) => asset.id === id)) {
      report(uiCopy.panels.assetImportFailed);
      return;
    }
    try {
      await manager.replace(id, file);
      // Rehydration is what carries the new pixels to every object bound to
      // this id, at whatever depth it sits.
      await manager.hydrate(editor.canvas);
    } catch (error) {
      // `replace` validates before it writes, so a refused file leaves the
      // package, the document and the preview exactly as they were.
      report(uiCopy.panels.assetImportFailed);
      editor.errorManager.error(
        "image",
        uiCopy.panels.assetImportFailed,
        error,
      );
      return;
    }
    report("");
    // One committed edit, §67.
    editor.historyManager.saveState();
    editor.canvas.requestRenderAll();
    changed();
    render();
  };

  /** Puts the imported bytes on the canvas as a new object. False means
      nothing took them, which is a refusal the author is told about rather
      than a silent success. */
  const place = async (
    asset: PlacedAssetReference,
    file: File,
  ): Promise<boolean> => {
    await manager.placeImage(editor, file);
    return true;
  };

  select.addEventListener("change", drawPreview);
  importInput.addEventListener("change", () => {
    const file = importInput.files?.[0];
    if (file !== undefined) void add(file, false);
    importInput.value = "";
  });
  replaceInput.addEventListener("change", () => {
    const file = replaceInput.files?.[0];
    if (file !== undefined) void add(file, true);
    replaceInput.value = "";
  });
  render();
  return root;
}

let assetPanelSeq = 0;

function isPlaceable(
  asset: LocalAssetReference,
): asset is PlacedAssetReference {
  return asset.kind === "image" || asset.kind === "svg";
}

function action(
  dataset: string,
  text: string,
  onClick: () => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset[dataset] = "";
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}

function input(
  data: "data-vigilia-asset-import-input" | "data-vigilia-asset-replace-input",
): HTMLInputElement {
  const element = document.createElement("input");
  element.type = "file";
  element.accept =
    ".png,.jpg,.jpeg,.webp,.svg,.mp4,.webm,.woff2,.woff,.ttf,.otf";
  element.hidden = true;
  element.setAttribute(data, "");
  return element;
}
