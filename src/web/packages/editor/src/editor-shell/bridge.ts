import { ActiveSelection, type FabricObject, Group } from "fabric/es";
import { VigiliaChart } from "@vigilia/scene-fabric";
import { applyArrange, canArrange, type ArrangeAction } from "../arrange.js";
import type { EditorInteraction } from "../editor-interaction.js";
import type { EditorActionFacade } from "./session-facade.js";

/** Selection-kind routing for menu/tab eligibility. Transient, never persisted. */
export type ActiveKind = "none" | "object" | "group" | "chart";

export type ShellAction =
  | "duplicate"
  | "copy"
  | "cut"
  | "delete"
  | "front"
  | "bring-forward"
  | "send-backward"
  | "back"
  | "lock"
  | "unlock"
  | "group"
  | "ungroup"
  | { readonly type: "arrange"; readonly action: ArrangeAction };

export interface EditorShellSnapshot {
  readonly selectedCount: number;
  readonly locked: boolean;
  readonly activeKind: ActiveKind;
}

export interface EditorShellBridge {
  snapshot(): EditorShellSnapshot;
  can(action: ShellAction): boolean;
  subscribe(listener: () => void): () => void;
  run(action: ShellAction): void;
  readonly session: EditorActionFacade;
  destroy(): void;
}

/** Fabric's runtime `type` getter lowercases the class tag, so identity is the
 * reliable chart discriminator; the persisted envelope keeps "VigiliaChart". */
function activeKindOf(active: FabricObject | undefined): ActiveKind {
  if (active === undefined) return "none";
  if (active instanceof ActiveSelection || active instanceof Group)
    return "group";
  return active instanceof VigiliaChart ? "chart" : "object";
}

/** Product panels depend only on the editor mechanics they exercise. */
export function createEditorShellBridge(input: {
  readonly editor: EditorInteraction;
  readonly session: EditorActionFacade;
}): EditorShellBridge {
  const { canvas } = input.editor;
  const listeners = new Set<() => void>();
  const notify = (): void => {
    for (const listener of listeners) listener();
  };
  const events = [
    "selection:created",
    "selection:updated",
    "selection:cleared",
  ] as const;
  for (const event of events) canvas.on(event, notify);
  const activeObject = ():
    | (FabricObject & { readonly locked?: boolean })
    | undefined =>
    canvas.getActiveObject() as
      | (FabricObject & { readonly locked?: boolean })
      | undefined;
  const snapshot = (): EditorShellSnapshot => {
    const active = activeObject();
    return {
      selectedCount:
        active instanceof ActiveSelection
          ? active.getObjects().length
          : active === undefined
            ? 0
            : 1,
      locked: active?.get("locked") === true,
      activeKind: activeKindOf(active),
    };
  };
  const can = (action: ShellAction): boolean => {
    const active = activeObject();
    if (active === undefined) return false;
    const locked = active.get("locked") === true;
    if (typeof action === "object")
      return canArrange(input.editor, action.action);
    if (action === "unlock") return locked;
    if (action === "group")
      return (
        active instanceof ActiveSelection && active.getObjects().length > 1
      );
    if (action === "ungroup") return active instanceof Group;
    return !locked;
  };
  return {
    snapshot,
    can,
    session: input.session,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    run(action) {
      if (!can(action)) return;
      const active = canvas.getActiveObject() as FabricObject | undefined;
      if (active === undefined) return;
      if (typeof action === "object") {
        applyArrange(input.editor, action.action);
        notify();
        return;
      }
      if (action === "duplicate")
        void input.editor.clipboardManager.duplicate();
      else if (action === "copy") void input.editor.clipboardManager.copy();
      else if (action === "cut") void input.editor.clipboardManager.cut();
      else if (action === "delete") input.editor.deletionManager.deleteActive();
      else if (action === "front") input.editor.layerManager.bringToFront();
      else if (action === "bring-forward")
        input.editor.layerManager.bringForward();
      else if (action === "send-backward")
        input.editor.layerManager.sendBackwards();
      else if (action === "back") input.editor.layerManager.sendToBack();
      else if (action === "lock") input.editor.objectLockManager.lockObject();
      else if (action === "unlock")
        input.editor.objectLockManager.unlockObject();
      else if (action === "group") input.editor.groupingManager.group();
      else if (action === "ungroup") input.editor.groupingManager.ungroup();
      notify();
    },
    destroy() {
      for (const event of events) canvas.off(event, notify);
      listeners.clear();
    },
  };
}
