import type { FabricGlobals } from "@vigilia/renderer-core";
import type { ImageEditor } from "@anu3ev/fabric-image-editor";
import { createNewTextDefaults } from "./new-object-defaults.js";

export interface NewObjectPanel {
  readonly root: HTMLElement;
  setGlobals(globals: FabricGlobals | undefined): void;
}

/** Vigilia creates semantic text while the fork retains generic construction and history. */
export function createNewObjectPanel(
  host: HTMLElement,
  editor: ImageEditor,
  globals: FabricGlobals | undefined,
): NewObjectPanel {
  let currentGlobals = globals;
  const root = document.createElement("section");
  root.dataset["vigiliaPanel"] = "add";
  const heading = document.createElement("h2");
  heading.textContent = "Add";
  const text = document.createElement("button");
  text.type = "button";
  text.textContent = "Text";
  text.addEventListener("click", () => {
    const content = "New text";
    editor.textManager.addText({
      text: content,
      ...createNewTextDefaults(currentGlobals, content),
    });
  });
  root.append(heading, text);
  host.append(root);
  return {
    root,
    setGlobals(nextGlobals) {
      currentGlobals = nextGlobals;
    },
  };
}
