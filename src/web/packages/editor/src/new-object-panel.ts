import type { ChartFamily, FabricGlobals } from "@vigilia/renderer-core";
import { Rect } from "fabric/es";
import type { EditorInteraction } from "./editor-interaction.js";
import {
  createNewPanelDefaults,
  createNewTextDefaults,
} from "./new-object-defaults.js";
import { uiCopy } from "./ui-copy.js";

export interface NewObjectPanel {
  readonly root: HTMLElement;
  setGlobals(globals: FabricGlobals | undefined): void;
}

export interface NewObjectActions {
  readonly addChart: (family: ChartFamily) => void;
}

/** Vigilia creates semantic text while the editor retains generic construction and history. */
export function createNewObjectPanel(
  host: HTMLElement,
  editor: EditorInteraction,
  globals: FabricGlobals | undefined,
  actions?: NewObjectActions,
): NewObjectPanel {
  let currentGlobals = globals;
  const root = document.createElement("section");
  root.dataset["vigiliaPanel"] = "add";
  const heading = document.createElement("h2");
  heading.textContent = uiCopy.panels.add;
  /**
   * Runs a construction that refuses when the theme has no reference to give
   * it — a palette without a usable token, or type presets without a body.
   * Reported through the editor's own diagnostics, because a throw out of a
   * click handler leaves the author with a button that silently does nothing.
   *
   * Every construction in this panel goes through it, charts included:
   * `ChartManager.addChart` calls `newChart` into `createNewChartDefaults`
   * with no handler of its own, so an unwrapped chart button would be the only
   * one here that fails silently.
   */
  const constructing = (build: () => void): void => {
    try {
      build();
    } catch (error) {
      editor.errorManager.warn(
        "controls",
        error instanceof Error ? error.message : String(error),
      );
    }
  };
  const text = document.createElement("button");
  text.type = "button";
  text.textContent = uiCopy.panels.text;
  text.addEventListener("click", () =>
    constructing(() => {
      const content = "New text";
      editor.textManager.addText({
        text: content,
        ...createNewTextDefaults(currentGlobals, content),
      });
    }),
  );
  const panel = document.createElement("button");
  panel.type = "button";
  panel.textContent = uiCopy.panels.panel;
  panel.dataset["vigiliaPanelAdd"] = "";
  // One construction, not a shape factory: the defaults module owns what a
  // new panel is, and the canvas and history the editor already exposes own
  // where it lands and how it is recorded.
  panel.addEventListener("click", () =>
    constructing(() => {
      const inserted = new Rect({
        id: `panel-${crypto.randomUUID()}`,
        ...createNewPanelDefaults(currentGlobals),
      });
      editor.canvas.add(inserted);
      editor.canvas.setActiveObject(inserted);
      editor.historyManager.saveState();
      editor.canvas.requestRenderAll();
    }),
  );
  const charts = (
    [
      [uiCopy.chartFamilies.gauge, "gauge"],
      [uiCopy.chartFamilies.line, "line"],
      [uiCopy.chartFamilies.bar, "bar"],
      [uiCopy.chartFamilies.pie, "pie"],
    ] as const
  ).map(([label, family]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", () =>
      constructing(() => actions?.addChart(family)),
    );
    return button;
  });
  root.append(heading, text, panel, ...charts);
  host.append(root);
  return {
    root,
    setGlobals(nextGlobals) {
      currentGlobals = nextGlobals;
    },
  };
}
