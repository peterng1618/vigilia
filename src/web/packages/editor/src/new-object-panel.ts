import type { ChartFamily, FabricGlobals } from "@vigilia/renderer-core";
import type { EditorInteraction } from "./editor-interaction.js";
import { createNewTextDefaults } from "./new-object-defaults.js";
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
  const text = document.createElement("button");
  text.type = "button";
  text.textContent = uiCopy.panels.text;
  text.addEventListener("click", () => {
    const content = "New text";
    editor.textManager.addText({
      text: content,
      ...createNewTextDefaults(currentGlobals, content),
    });
  });
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
    button.addEventListener("click", () => actions?.addChart(family));
    return button;
  });
  root.append(heading, text, ...charts);
  host.append(root);
  return {
    root,
    setGlobals(nextGlobals) {
      currentGlobals = nextGlobals;
    },
  };
}
