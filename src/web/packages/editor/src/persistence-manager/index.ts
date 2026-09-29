import type { FabricThemeEnvelope } from "@vigilia/renderer-core";
import { fileNameFor, serializeThemePackage } from "../persist.js";
import { uiCopy } from "../ui-copy.js";

export type Downloader = (name: string, bytes: Uint8Array) => void;

function defaultDownloader(name: string, bytes: Uint8Array): void {
  const blob = new Blob([bytes as unknown as BlobPart], {
    type: "application/octet-stream",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/** Product file export for .vigilia-theme packages. */
export class PersistenceManager {
  #savedDocument: string;
  readonly #downloader: Downloader;

  constructor(
    initial: FabricThemeEnvelope,
    initialAssets: Readonly<Record<string, Uint8Array>> = {},
    options?: { readonly downloader?: Downloader },
  ) {
    this.#savedDocument = documentKey(initial, initialAssets);
    this.#downloader = options?.downloader ?? defaultDownloader;
  }

  isDirty(
    theme: FabricThemeEnvelope,
    assets: Readonly<Record<string, Uint8Array>> = {},
  ): boolean {
    return documentKey(theme, assets) !== this.#savedDocument;
  }

  markSaved(
    theme: FabricThemeEnvelope,
    assets: Readonly<Record<string, Uint8Array>> = {},
  ): void {
    this.#savedDocument = documentKey(theme, assets);
  }

  async save(
    theme: FabricThemeEnvelope,
    assets: Readonly<Record<string, Uint8Array>> = {},
  ): Promise<void> {
    const result = serializeThemePackage(theme, assets);
    if (!result.ok) {
      throw new Error(result.message);
    }
    this.#downloader(fileNameFor(theme), result.bytes);
    this.#savedDocument = documentKey(theme, assets);
  }

  destroy(): void {}
}

/** Asks before a document is replaced. A prompt the author reads on the way to
 *  losing their work, so it is named, centred and keyboard-dismissable like the
 *  other two: an unclassed `<dialog>` picked up no margin from the preflight
 *  reset and landed over the very menu it was opened from, asking its question
 *  in the corner of the screen. */
export async function confirmDocumentReplacement(): Promise<
  "save" | "discard" | "cancel"
> {
  const dialog = document.createElement("dialog");
  dialog.className = "vigilia-dialog";
  dialog.setAttribute("aria-label", uiCopy.replaceDocument.question);

  const form = document.createElement("div");
  form.className = "vigilia-dialog-form";
  const lead = document.createElement("p");
  lead.className = "vigilia-dialog-lead";
  lead.textContent = uiCopy.replaceDocument.question;
  const actions = document.createElement("div");
  actions.className = "vigilia-dialog-actions";

  // Discard last among the answers, because it is the one that loses work and
  // Cancel sits beside it, where a slip lands on Cancel and not on Discard.
  for (const [value, text] of [
    ["save", uiCopy.replaceDocument.save],
    ["cancel", uiCopy.replaceDocument.cancel],
    ["discard", uiCopy.replaceDocument.discard],
  ] as const) {
    const button = document.createElement("button");
    button.type = "button";
    button.value = value;
    button.textContent = text;
    button.addEventListener("click", () => {
      dialog.close(value);
    });
    actions.append(button);
  }

  form.append(lead, actions);
  dialog.append(form);
  document.body.append(dialog);

  return new Promise((resolve) => {
    dialog.addEventListener(
      "close",
      () => {
        dialog.remove();
        resolve(
          dialog.returnValue === "save" || dialog.returnValue === "discard"
            ? dialog.returnValue
            : "cancel",
        );
      },
      { once: true },
    );
    dialog.showModal();
  });
}

function documentKey(
  theme: FabricThemeEnvelope,
  assets: Readonly<Record<string, Uint8Array>>,
): string {
  return JSON.stringify([
    theme,
    Object.entries(assets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, bytes]) => [path, [...bytes]]),
  ]);
}
