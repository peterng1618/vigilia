import { VigiliaChart } from "@vigilia/scene-fabric";
import { ActiveSelection, type FabricObject, Group } from "fabric/es";
import { type ArrangeAction, applyArrange, canArrange } from "../arrange.js";
import type { EditorInteraction } from "../editor-interaction.js";
import {
  actionEnabled,
  type ObjectActionId,
  type ObjectTarget,
} from "../object-actions.js";
import type { EditorActionFacade } from "./session-facade.js";

/** Selection-kind routing for menu/tab eligibility. Transient, never persisted. */
export type ActiveKind = "none" | "object" | "group" | "chart";

/** The object actions the shell can run; the registry owns the ids. */
export type ShellAction = ObjectActionId;

export interface EditorShellSnapshot {
  readonly selectedCount: number;
  readonly locked: boolean;
  readonly activeKind: ActiveKind;
}

export interface EditorShellBridge {
  snapshot(): EditorShellSnapshot;
  /** The registry's view of the selection. Serializable; never a FabricObject. */
  target(): ObjectTarget;
  can(action: ShellAction): boolean;
  canArrange(action: ArrangeAction): boolean;
  subscribe(listener: () => void): () => void;
  run(action: ShellAction): void;
  readonly session: EditorActionFacade;
  readonly editor: EditorInteraction;
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
  const target = (): ObjectTarget => {
    const base = snapshot();
    const active = canvas.getActiveObject();
    return {
      kind: base.activeKind,
      locked: base.locked,
      memberCount: base.selectedCount,
      // ActiveSelection extends Group, so the negative case has to be explicit:
      // a bare multi-selection is not a Group for ungroup/group eligibility.
      isGroup: active instanceof Group && !(active instanceof ActiveSelection),
    };
  };
  const canArrangeAction = (action: ArrangeAction): boolean =>
    canArrange(input.editor, action);
  const gate = { target, canArrange: canArrangeAction };
  // Eligibility is owned by the registry; this only adds the selection gate.
  const can = (action: ShellAction): boolean =>
    activeObject() !== undefined && actionEnabled(gate, action);
  return {
    snapshot,
    target,
    can,
    canArrange: canArrangeAction,
    session: input.session,
    editor: input.editor,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    run(action) {
      if (!can(action)) return;
      if (action.startsWith("arrange:")) {
        applyArrange(
          input.editor,
          action.slice("arrange:".length) as ArrangeAction,
        );
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
