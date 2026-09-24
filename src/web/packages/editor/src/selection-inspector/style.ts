import type { FabricGlobals, FabricPalette } from "@vigilia/renderer-core";
import type { FabricObject } from "fabric/es";
import type { EditorInteraction } from "../editor-interaction.js";
import { uiCopy } from "../ui-copy.js";
import {
  paintReferenceOf,
  resolveToken,
  resolveTypePreset,
  typePresetOf,
} from "./appearance.js";

/**
 * The Style tab: what the selection's references resolve to, or — with nothing
 * selected — what the document itself offers. It answers "what does this look
 * like" without the author having to select something first, which the Design
 * tab cannot.
 *
 * Read-only by design. Every value here is edited in Design, where the selection
 * it belongs to is visible; a second editable copy would be a second owner.
 */

export interface StylePanelOptions {
  readonly editor: EditorInteraction;
  /**
   * Read on demand rather than held: this panel is mounted for the whole
   * session and never writes, so pulling the current globals on each render
   * cannot show a stale copy.
   */
  readonly globals: () => FabricGlobals | undefined;
}

export interface StylePanel {
  readonly root: HTMLElement;
  /** Re-reads the selection; call on every selection change. */
  render(): void;
  destroy(): void;
}

function line(
  label: string,
  ref: string,
  resolved: string | undefined,
): HTMLElement {
  const entry = document.createElement("p");
  entry.className = "vigilia-resolution";
  entry.dataset["vigiliaResolution"] = label;
  entry.textContent =
    resolved === undefined
      ? `${label}: ${ref} (${uiCopy.inspectorFields.unresolved})`
      : `${label}: ${ref} → ${resolved}`;
  return entry;
}

/**
 * What the document offers, for when nothing is selected: the palette tokens and
 * type presets an object can reference. Read from globals directly — the panel
 * lists what exists, so it must not resolve through a selection.
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
    section.append(line(entry?.name ?? ref, ref, resolveToken(globals, ref)));
  }

  for (const [id, entry] of Object.entries(globals?.typePresets ?? {})) {
    const ref = `typePresets.${id}`;
    // The preset's own name is what the author sees in the preset panel, so it
    // is what they can match here.
    section.append(
      line(entry?.name ?? ref, ref, resolveTypePreset(globals, ref)),
    );
  }

  return section;
}

export function createStylePanel(
  host: HTMLElement,
  options: StylePanelOptions,
): StylePanel {
  const root = document.createElement("section");
  root.dataset["vigiliaPanel"] = "style";
  host.append(root);

  const render = (): void => {
    const globals = options.globals();
    root.replaceChildren();
    const active = options.editor.canvas.getActiveObject() as
      | FabricObject
      | undefined;

    if (active === undefined) {
      root.append(documentGlobals(globals));
      return;
    }

    const paint = paintReferenceOf(active);
    if (paint !== undefined) {
      root.append(
        line(uiCopy.inspectorFields.paint, paint, resolveToken(globals, paint)),
      );
    }

    const preset = typePresetOf(active);
    if (preset !== undefined) {
      root.append(
        line(
          uiCopy.inspectorFields.runPreset,
          preset,
          resolveTypePreset(globals, preset),
        ),
      );
    }
  };

  // The tab is mounted for the whole session, so it follows selection itself
  // rather than relying on the active tab to be re-rendered.
  const events = [
    "selection:created",
    "selection:updated",
    "selection:cleared",
    "object:modified",
  ] as const;
  for (const event of events) options.editor.canvas.on(event, render);
  render();

  return {
    root,
    render,
    destroy() {
      for (const event of events) options.editor.canvas.off(event, render);
      root.remove();
    },
  };
}
