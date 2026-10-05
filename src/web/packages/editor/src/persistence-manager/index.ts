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
    thumbnail?: Uint8Array,
  ): Promise<void> {
    const result = serializeThemePackage(theme, assets, thumbnail);
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

/**
 * Authored state only: a thumbnail is a rendering of one machine, so a
 * different one is not a change to the document.
 *
 * The asset half of the key is each path's *declared* `sha256`, not its bytes.
 * The bytes made the key a one-boxed-number-per-byte array and its stringified
 * form an ~86 MB retained string for a 24 MB asset, paid on every open, new and
 * save, and it answered a question the digest already answers — a byte can only
 * reach the map by being imported, replaced or adopted, and every one of those
 * recomputes the declaration the envelope carries. The envelope's own JSON is in
 * the key too, so a document whose fields moved while its assets stood still is
 * still a changed document, and the map's own paths are listed so bytes with no
 * declaration — and a rename, an addition or a removal — cannot hide behind it.
 */
export function documentKey(
  theme: FabricThemeEnvelope,
  assets: Readonly<Record<string, Uint8Array>>,
): string {
  const declared = new Map(
    (theme.assets ?? []).map((asset) => [asset.path, asset.sha256 ?? null]),
  );
  // The union, not the loaded map. Enumerating `assets` alone caught the case it
  // was written for — bytes with no declaration — but made the key a function of
  // *how much has loaded*: a theme whose asset bytes arrive after the manager was
  // constructed read as edited with nothing touched. Measured on the Starter,
  // whose one declared asset is exactly that: the key gained its
  // `assets/starter-backdrop.jpg` entry when the backdrop finished loading, and
  // every later prompt to replace a document asked about work nobody had done. A
  // declared path is in the list whether or not its bytes are here, so loading
  // stops being an edit, and an undeclared one still appears with a null digest.
  const paths = [
    ...new Set([...declared.keys(), ...Object.keys(assets)]),
  ].sort();
  return JSON.stringify([
    authoredOnly(theme),
    paths.map((path) => [path, declared.get(path) ?? null]),
  ]);
}

/**
 * The document as its author left it, with what the renderer paints taken out.
 *
 * A bound text object carries its authored content in `vigiliaText.runs` — a
 * value run naming a binding, a literal run saying what it says, each with its
 * own `style`. The renderer resolves those into the Fabric `text` and `styles`
 * properties, and those resolutions are what change while the author watches:
 * the clock ticks, a gauge fills, a trend extends. They are renderings of the
 * document, not the document.
 *
 * Leaving them in the key makes the guard untestable in the only way that
 * matters. Measured: one live pass rewrites `.styles` on 18 of the Starter's 52
 * objects — exactly its binding count — with nothing touched, and every later
 * prompt to replace a document asks about work nobody did.
 *
 * This is the narrow half of vg-041: the two properties the live pass actually
 * writes, on the objects whose runs are the authored truth. An object without
 * runs owns its `text` and `styles`, so they are kept there and a real edit is
 * never hidden.
 */
function authoredOnly(theme: FabricThemeEnvelope): FabricThemeEnvelope {
  const objects = (theme.scene as { readonly objects?: readonly unknown[] })
    .objects;
  if (!Array.isArray(objects)) return theme;

  // Into groups: the starter's cards are groups, and every reading they carry
  // lives one level down. A walk that stopped at the canvas would keep those
  // resolutions in the key and the Starter would read as edited the moment it
  // opened — which is the defect this function exists to prevent, reintroduced
  // by the one change that moved the readings a level deeper.
  const strip = (list: readonly unknown[]): unknown[] =>
    list.map((object) => {
      const entry = object as {
        readonly vigiliaText?: unknown;
        readonly text?: unknown;
        readonly styles?: unknown;
        readonly objects?: readonly unknown[];
      };
      const children = Array.isArray(entry.objects)
        ? { objects: strip(entry.objects) }
        : {};
      if (entry.vigiliaText === undefined) return { ...entry, ...children };
      const { text: _text, styles: _styles, ...rest } = entry;
      return { ...rest, ...children };
    });

  return {
    ...theme,
    scene: { ...theme.scene, objects: strip(objects) },
  };
}
