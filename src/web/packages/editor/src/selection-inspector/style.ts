import type { FabricGlobals, FabricPalette } from "@vigilia/renderer-core";
import { uiCopy } from "../ui-copy.js";
import {
  createResolutionLine,
  resolveToken,
  resolveTypePreset,
} from "./appearance.js";

/**
 * The document's own references: every palette token and type preset an object
 * can reference, resolved. It lives in the left column's Document pane, beside
 * the palette and type-preset panels it lists, because it answers a question
 * about the document rather than about a selection.
 *
 * Read-only by design. Every value here is edited in the palette and type-preset
 * panels next to it; a second editable copy would be a second owner. The
 * selection's own resolved references are the selection column's Spends section,
 * which answers that different question in the column the selection lives in.
 */

export interface DocumentReferencesOptions {
  /**
   * Read on demand rather than held: this panel is mounted for the whole
   * session and never writes, so pulling the current globals on each render
   * cannot show a stale copy.
   */
  readonly globals: () => FabricGlobals | undefined;
}

export interface DocumentReferencesPanel {
  readonly root: HTMLElement;
  /** Re-reads the document's globals; call when a theme edit changes them. */
  render(): void;
  destroy(): void;
}

/**
 * What the document offers: the palette tokens and type presets an object can
 * reference. Read from globals directly — the panel lists what exists, so it must
 * not resolve through a selection, and it renders the same list whether or not
 * something is selected.
 */
function documentGlobals(globals: FabricGlobals | undefined): HTMLElement {
  const section = document.createElement("section");
  section.dataset["vigiliaGlobals"] = "";

  const heading = document.createElement("h3");
  heading.textContent = uiCopy.inspectorFields.documentStyle;
  section.append(heading);

  const palette = globals?.palette as FabricPalette | undefined;
  for (const [id, entry] of Object.entries(palette ?? {})) {
    if (id === "none") continue;
    const ref = `palette.${id}`;
    // The row's label is already the authored name, so the reference is what
    // identifies the entry in the document it was read from.
    section.append(
      createResolutionLine(entry?.name ?? ref, ref, resolveToken(globals, ref)),
    );
  }

  for (const [id, entry] of Object.entries(globals?.typePresets ?? {})) {
    const ref = `typePresets.${id}`;
    // The preset's own name is what the author sees in the preset panel, so it
    // is what they can match here.
    section.append(
      createResolutionLine(
        entry?.name ?? ref,
        ref,
        resolveTypePreset(globals, ref),
      ),
    );
  }

  return section;
}

export function createDocumentReferencesPanel(
  host: HTMLElement,
  options: DocumentReferencesOptions,
): DocumentReferencesPanel {
  const root = document.createElement("section");
  root.dataset["vigiliaPanel"] = "style";
  host.append(root);

  const render = (): void => {
    root.replaceChildren(documentGlobals(options.globals()));
  };
  render();

  return {
    root,
    render,
    destroy() {
      root.remove();
    },
  };
}
