import { ActiveSelection, Group, type FabricObject } from "fabric/es";
import type { EditorInteraction } from "../editor-interaction.js";

const OFFSET_TOP = 50;

export interface SelectionToolbar {
  readonly root: HTMLElement;
  destroy(): void;
}

interface ToolbarAction {
  readonly id: string;
  readonly label: string;
  readonly run: (editor: EditorInteraction) => void;
  readonly enabled?: (target: FabricObject) => boolean;
}

const UNLOCKED: readonly ToolbarAction[] = [
  {
    id: "duplicate",
    label: "Duplicate",
    run: (editor) => void editor.clipboardManager.duplicate(),
  },
  {
    id: "lock",
    label: "Lock",
    run: (editor) => editor.objectLockManager.lockObject(),
  },
  {
    id: "front",
    label: "Bring to front",
    run: (editor) => editor.layerManager.bringToFront(),
  },
  {
    id: "forward",
    label: "Bring forward",
    run: (editor) => editor.layerManager.bringForward(),
  },
  {
    id: "backward",
    label: "Send backward",
    run: (editor) => editor.layerManager.sendBackwards(),
  },
  {
    id: "back",
    label: "Send to back",
    run: (editor) => editor.layerManager.sendToBack(),
  },
  {
    id: "group",
    label: "Group",
    run: (editor) => editor.groupingManager.group(),
    enabled: (target) =>
      target instanceof ActiveSelection && target.getObjects().length > 1,
  },
  {
    id: "ungroup",
    label: "Ungroup",
    run: (editor) => editor.groupingManager.ungroup(),
    enabled: (target) => target instanceof Group,
  },
  {
    id: "delete",
    label: "Delete",
    run: (editor) => void editor.deletionManager.deleteActive(),
  },
];

const LOCKED: readonly ToolbarAction[] = [
  {
    id: "unlock",
    label: "Unlock",
    run: (editor) => editor.objectLockManager.unlockObject(),
  },
];

export function createSelectionToolbar(
  editor: EditorInteraction,
): SelectionToolbar {
  const { canvas } = editor;
  const root = document.createElement("div");
  root.dataset["vigiliaToolbar"] = "";
  root.style.cssText =
    "position:absolute;display:none;gap:8px;align-items:center;padding:0 8px;" +
    "height:32px;border-radius:8px;background:#2B2D33;z-index:10;";
  (canvas.wrapperEl ?? document.body).append(root);

  let renderedFor: FabricObject | undefined;
  let renderedLocked: boolean | undefined;
  let transforming = false;

  const render = (target: FabricObject, locked: boolean): void => {
    root.replaceChildren();
    for (const action of locked ? LOCKED : UNLOCKED) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset["vigiliaToolbarAction"] = action.id;
      button.textContent = action.label;
      button.disabled = action.enabled !== undefined && !action.enabled(target);
      // The canvas would otherwise start a drag under the pointer.
      button.addEventListener("mousedown", (event) => {
        event.stopPropagation();
        event.preventDefault();
      });
      button.addEventListener("click", () => action.run(editor));
      root.append(button);
    }
  };

  const position = (target: FabricObject): void => {
    target.setCoords();
    const zoom = canvas.getZoom();
    const [, , , , panX, panY] = canvas.viewportTransform;
    // `getCenterPoint` and `getBoundingRect` are both scene-space in Fabric 7.
    const { x: centreX } = target.getCenterPoint();
    const { top, height } = target.getBoundingRect();
    root.style.left = `${centreX * zoom + panX - root.offsetWidth / 2}px`;
    root.style.top = `${(top + height) * zoom + panY + OFFSET_TOP}px`;
    root.style.display = "flex";
  };

  const update = (): void => {
    if (transforming) return;
    const target = canvas.getActiveObject();
    if (target === undefined) {
      root.style.display = "none";
      renderedFor = undefined;
      return;
    }
    const locked = target.get("locked") === true;
    if (target !== renderedFor || locked !== renderedLocked) {
      renderedFor = target;
      renderedLocked = locked;
      render(target, locked);
    }
    position(target);
  };

  const startTransform = (): void => {
    transforming = true;
    root.style.display = "none";
  };
  const endTransform = (): void => {
    transforming = false;
    update();
  };
  const clear = (): void => {
    root.style.display = "none";
    renderedFor = undefined;
  };

  const bindings = [
    ["object:moving", startTransform],
    ["object:scaling", startTransform],
    ["object:rotating", startTransform],
    ["mouse:up", endTransform],
    ["object:modified", endTransform],
    ["selection:created", update],
    ["selection:updated", update],
    ["after:render", update],
    ["selection:cleared", clear],
  ] as const;

  for (const [event, handler] of bindings)
    canvas.on(event as never, handler as never);

  return {
    root,
    destroy() {
      for (const [event, handler] of bindings)
        canvas.off(event as never, handler as never);
      root.remove();
    },
  };
}
