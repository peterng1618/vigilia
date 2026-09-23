import { type FabricObject, Group } from "fabric/es";
import { type ArrangeAction, applyArrange, canArrange } from "./arrange.js";
import type { EditorInteraction } from "./editor-interaction.js";

export interface LayerPanel {
  readonly root: HTMLElement;
  destroy(): void;
}

interface LayerObject extends FabricObject {
  readonly id?: string;
  readonly locked?: boolean;
}

interface LayerEntry {
  readonly object: LayerObject;
  readonly select: LayerObject;
  readonly ancestors: readonly LayerObject[];
}

/** Projects Fabric's current hierarchy without maintaining a second scene tree. */
export function createLayerPanel(
  host: HTMLElement,
  editor: EditorInteraction,
): LayerPanel {
  const root = document.createElement("section");
  let currentEntries = new Map<string, LayerEntry>();
  let selectionTimer: number | undefined;
  const redraw = (): void => {
    const entries = entriesFor(editor.canvas.getObjects() as LayerObject[]);
    currentEntries = new Map(
      entries.map((entry) => [objectId(entry.object), entry]),
    );
    render(root, editor, entries, redraw);
  };
  const events = [
    "selection:created",
    "selection:updated",
    "selection:cleared",
    "object:added",
    "object:removed",
    "object:modified",
  ] as const;

  root.dataset["vigiliaPanel"] = "layers";
  host.append(root);
  root.addEventListener(
    "pointerdown",
    (event) => {
      const target = event.target as Element;
      const row = target.closest<HTMLElement>("[data-vigilia-layer]");
      const entry =
        row === null
          ? undefined
          : currentEntries.get(row.dataset["vigiliaLayer"] ?? "");
      if (entry === undefined) return;
      if (selectionTimer !== undefined) window.clearTimeout(selectionTimer);
      selectionTimer = window.setTimeout(() => {
        selectionTimer = undefined;
        select(entry, editor);
        redraw();
      });
    },
    true,
  );
  for (const event of events) editor.canvas.on(event, redraw);
  redraw();

  return {
    root,
    destroy() {
      if (selectionTimer !== undefined) window.clearTimeout(selectionTimer);
      for (const event of events) editor.canvas.off(event, redraw);
      root.remove();
    },
  };
}

function render(
  root: HTMLElement,
  editor: EditorInteraction,
  entries: readonly LayerEntry[],
  refresh: () => void,
): void {
  root.replaceChildren();
  const heading = document.createElement("h2");
  heading.textContent = "Layers";
  root.append(heading);
  for (const entry of entries) {
    root.append(row(entry, editor, refresh));
  }
  root.append(arrangeControls(editor, refresh));
}

function entriesFor(
  objects: readonly LayerObject[],
  ancestors: readonly LayerObject[] = [],
  select?: LayerObject,
): readonly LayerEntry[] {
  return objects
    .slice()
    .reverse()
    .flatMap((object) => {
      const entry: LayerEntry = { object, select: select ?? object, ancestors };
      const children =
        object instanceof Group
          ? entriesFor(
              object.getObjects() as LayerObject[],
              [...ancestors, object],
              object,
            )
          : [];
      return [entry, ...children];
    });
}

function row(
  entry: LayerEntry,
  editor: EditorInteraction,
  refresh: () => void,
): HTMLElement {
  const root = document.createElement("div");
  const id = objectId(entry.object);
  const { visible, locked } = effectiveState(entry);
  root.dataset["vigiliaLayer"] = id;
  root.textContent = `${entry.object.type} ${id}`;
  root.setAttribute(
    "aria-pressed",
    String(editor.canvas.getActiveObject() === entry.select),
  );
  root.append(
    control(visible ? "hide" : "show", visible ? "Hide" : "Show", () => {
      if (visible) entry.object.set("visible", false);
      else reveal(entry);
      entry.object.setCoords();
      select(entry, editor);
      editor.historyManager.saveState();
      refresh();
    }),
    control(locked ? "unlock" : "lock", locked ? "Unlock" : "Lock", () => {
      if (locked)
        editor.objectLockManager.unlockObject({ object: entry.select });
      else editor.objectLockManager.lockObject({ object: entry.select });
      refresh();
    }),
    control("front", "Front", () => {
      editor.layerManager.bringToFront(entry.select);
      refresh();
    }),
    control("forward", "Forward", () => {
      editor.layerManager.bringForward(entry.select);
      refresh();
    }),
    control("backward", "Backward", () => {
      editor.layerManager.sendBackwards(entry.select);
      refresh();
    }),
    control("back", "Back", () => {
      editor.layerManager.sendToBack(entry.select);
      refresh();
    }),
  );
  return root;
}

function control(
  action: string,
  label: string,
  handler: () => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset["vigiliaLayerAction"] = action;
  button.textContent = label;
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    handler();
  });
  return button;
}

function arrangeControls(
  editor: EditorInteraction,
  refresh: () => void,
): HTMLElement {
  const section = document.createElement("section");
  const heading = document.createElement("h2");
  heading.textContent = "Arrange";
  section.append(heading);
  for (const [action, label] of [
    ["align-left", "Align left"],
    ["align-center-x", "Centre horizontally"],
    ["align-right", "Align right"],
    ["align-top", "Align top"],
    ["align-center-y", "Centre vertically"],
    ["align-bottom", "Align bottom"],
    ["distribute-x", "Distribute horizontally"],
    ["distribute-y", "Distribute vertically"],
  ] as const satisfies readonly (readonly [ArrangeAction, string])[]) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset["vigiliaArrange"] = action;
    button.textContent = label;
    button.disabled = !canArrange(editor, action);
    button.addEventListener("click", () => {
      if (applyArrange(editor, action)) refresh();
    });
    section.append(button);
  }
  return section;
}

function select(entry: LayerEntry, editor: EditorInteraction): void {
  editor.canvas.setActiveObject(entry.select);
  editor.canvas.requestRenderAll();
}

function reveal(entry: LayerEntry): void {
  for (const object of [...entry.ancestors, entry.object]) {
    if (!object.visible) object.set("visible", true);
  }
}

function effectiveState(entry: LayerEntry): {
  readonly visible: boolean;
  readonly locked: boolean;
} {
  const path = [...entry.ancestors, entry.object];
  return {
    visible: path.every((object) => object.visible),
    locked: path.some((object) => object.locked),
  };
}

function objectId(object: LayerObject): string {
  return object.id ?? "unidentified";
}
