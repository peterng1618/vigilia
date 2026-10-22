import type { TypePreset } from "@yunari/renderer-core";
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type { CuratedFontFace } from "../font-catalog.js";
import {
  PresetList,
  type PresetSelection,
} from "../panes/tokens/preset-list.js";

export type TypePresets = Readonly<
  Record<string, { readonly name: string; readonly value: TypePreset }>
>;

export interface TypePresetPanel {
  readonly root: HTMLElement;
  render(presets: TypePresets | undefined): void;
  /** Unmounts the React tree, then removes the section. A React root
   *  subscribes; removing its container unsubscribes nothing, so the tree would
   *  outlive the pane for the page's lifetime (`react-root-disposal.dom.test.ts`
   *  pins this file's one root). */
  destroy(): void;
}
export interface TypePresetFontActions {
  readonly preview: (face: CuratedFontFace) => Promise<void>;
  readonly applyFace: (
    presetId: string,
    face: CuratedFontFace,
  ) => Promise<void>;
  readonly applyTrio: (trioId: string) => Promise<void>;
}

/**
 * Product-owned global type authoring. Text objects retain stable preset
 * references.
 *
 * The factory keeps its signature and its `root`/`render` pair, so
 * `editor-session.ts` keeps its construction site; what changed is the
 * rendering, which is the Tokens pane's React tree. The heading, the chooser and
 * every field are children of that tree rather than a second `createRoot`, and
 * the panel is a **sibling** section of the palette panel's under the same
 * Tokens-pane host (R36) — it builds its own section and never reaches into the
 * palette's tree.
 *
 * `selection` is the shell's own projection of the selection, handed in so the
 * list can open on the preset the selection is set in and say so (`vg-094`); it
 * is optional, and a panel built without one reads as nothing selected.
 */
export function createTypePresetPanel(
  host: HTMLElement,
  onChange: (presets: TypePresets) => void,
  onDelete?: (id: string, replacement: string) => void,
  fontActions?: TypePresetFontActions,
  selection?: PresetSelection,
): TypePresetPanel {
  const root = document.createElement("section");
  // No `data-yunari-panel` and no title here: `Pane` owns the identity and the
  // title bar, and a second element under either is a strict-mode failure for
  // every locator that browses by it.
  host.append(root);

  const reactRoot: Root = createRoot(root);
  const draw = (presets: TypePresets | undefined): void => {
    // Flushed, so a caller that reads the pane straight after building or
    // refreshing it sees the presets rather than the frame before React commits
    // — the contract the imperative panel had.
    flushSync(() => {
      reactRoot.render(
        createElement(PresetList, {
          presets: presets ?? {},
          onChange,
          onDelete,
          fontActions,
          selection,
        }),
      );
    });
  };
  draw(undefined);

  return {
    root,
    render: draw,
    destroy() {
      reactRoot.unmount();
      root.remove();
    },
  };
}
