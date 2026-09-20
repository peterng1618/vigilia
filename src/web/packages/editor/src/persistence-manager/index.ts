import type { FabricThemeEnvelope } from "@vigilia/renderer-core";
import { fileNameFor, serializeThemePackage } from "../persist.js";

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

export async function confirmDocumentReplacement(): Promise<
  "save" | "discard" | "cancel"
> {
  const dialog = document.createElement("dialog");
  dialog.innerHTML =
    '<form method="dialog"><p>Save changes before opening another theme?</p><button value="save">Save</button><button value="discard">Discard</button><button value="cancel">Cancel</button></form>';
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
