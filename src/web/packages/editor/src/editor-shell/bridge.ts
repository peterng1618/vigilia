import { VigiliaChart } from "@vigilia/scene-fabric";
import { ActiveSelection, type FabricObject, Group } from "fabric/es";
import { type ArrangeAction, applyArrange, canArrange } from "../arrange.js";
import type { EditorInteraction } from "../editor-interaction.js";
import {
  actionEnabled,
  type ObjectActionId,
  type ObjectTarget,
} from "../object-actions.js";
import {
  type LayerRow,
  findById,
  ownerOf,
  pathTo,
  projectLayers,
} from "./layer-tree.js";
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
  /** The layer tree, projected from Fabric on demand (§172). */
  layers(): readonly LayerRow[];
  /** Selects a row's object, resolving a group child through its owning group. */
  selectLayer(id: string): void;
  /** Hiding leaves the selection alone; showing reveals the whole ancestor path. */
  setLayerVisible(id: string, visible: boolean): void;
  setLayerLocked(id: string, locked: boolean): void;
  /** Transient view state: never authored history, never a Fabric write (§67). */
  setCollapsed(id: string, collapsed: boolean): void;
  /** Editor-only display state: never authored history, never a Fabric write. */
  renameLayer(id: string, name: string): void;
  /** Whether both ids share one parent, i.e. whether `reorderLayer` would
   * accept the drop. The panel asks this to mark only reachable slots. */
  sameLayerParent(a: string, b: string): boolean;
  /** Restacks `id` directly above `beforeId`, inside one parent only.
   * `true` when the move happened; a refusal changes nothing. */
  reorderLayer(id: string, beforeId: string): boolean;
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
  const names = (): Readonly<Record<string, string>> =>
    input.session.layerNames();
  // View state lives here, not in the panel: the projection reads it, so a
  // remount keeps the groups the author shut.
  const collapsedGroups = new Set<string>();
  const layers = (): readonly LayerRow[] => {
    const active = canvas.getActiveObject();
    const selected =
      active instanceof ActiveSelection
        ? active.getObjects()
        : active === undefined
          ? []
          : [active];
    return projectLayers({
      root: canvas.getObjects(),
      selected,
      names: names(),
      collapsed: collapsedGroups,
    });
  };
  const selectLayer = (id: string): void => {
    const root = canvas.getObjects();
    const target = findById(root, id);
    if (target === undefined) return;
    // A child of a group is selected through its owning group, as the DOM panel
    // did: selecting the child directly would put a Fabric-only object on the
    // canvas that no transform control can reach.
    canvas.setActiveObject(ownerOf(root, id) ?? target);
    canvas.requestRenderAll();
    notify();
  };
  const setLayerVisible = (id: string, visible: boolean): void => {
    const target = findById(canvas.getObjects(), id);
    if (target === undefined) return;
    // Showing a descendant whose ancestor is hidden would show nothing, so the
    // whole path is revealed; hiding touches only the requested object.
    if (visible)
      for (const entry of pathTo(canvas.getObjects(), id))
        entry.set("visible", true);
    else target.set("visible", false);
    target.setCoords();
    canvas.requestRenderAll();
    input.editor.historyManager.saveState();
    notify();
  };
  const setLayerLocked = (id: string, locked: boolean): void => {
    const root = canvas.getObjects();
    const target = findById(root, id);
    if (target === undefined) return;
    // Locks go through the owning group for the same reason selection does.
    const subject = ownerOf(root, id) ?? target;
    if (locked) input.editor.objectLockManager.lockObject({ object: subject });
    else input.editor.objectLockManager.unlockObject({ object: subject });
    notify();
  };
  const setCollapsed = (id: string, collapsed: boolean): void => {
    if (collapsed) collapsedGroups.add(id);
    else collapsedGroups.delete(id);
    notify();
  };
  const renameLayer = (id: string, name: string): void => {
    const trimmed = name.trim();
    const next = { ...names() };
    // Removing the key, not storing blank: the projection falls back to the id.
    if (trimmed === "") delete next[id];
    else next[id] = trimmed;
    // Display state is editor-only, so this deliberately skips saveState():
    // §67 keeps runtime state out of authored history.
    input.session.setLayerNames(next);
    notify();
  };
  // The owner comparison `reorderLayer` refuses on, exposed so the panel can
  // mark only the drops that would land. Never `object.group`: an active
  // selection temporarily repoints it at the selection itself.
  const sameLayerParent = (a: string, b: string): boolean => {
    const root = canvas.getObjects();
    return (
      findById(root, a) !== undefined &&
      findById(root, b) !== undefined &&
      ownerOf(root, a) === ownerOf(root, b)
    );
  };
  const reorderLayer = (id: string, beforeId: string): boolean => {
    const root = canvas.getObjects();
    const moved = findById(root, id);
    const anchor = findById(root, beforeId);
    if (moved === undefined || anchor === undefined) return false;
    // v1 restacks inside one parent only: crossing a group boundary changes
    // membership, which is a different operation with different semantics.
    if (ownerOf(root, id) !== ownerOf(root, beforeId)) return false;
    const parent = ownerOf(root, id);
    const siblings = parent === undefined ? root : parent.getObjects();
    const from = siblings.indexOf(moved);
    const anchorAt = siblings.indexOf(anchor);
    // Load-bearing, not tidiness: `moveObjectTo` splices at `index` even when the
    // object is absent from the array (`removeFromArray` no-ops, `splice(-1, …)`
    // then inserts at the end), so a mismatch here would reparent the object
    // instead of refusing.
    if (from < 0 || anchorAt < 0) return false;
    // `beforeId` means directly above that row in the panel, and the panel paints
    // topmost-first, so in Fabric's bottom-first paint order the target is one
    // past the anchor. Fabric's `moveObjectTo` removes the object and then
    // splices at `index` in the *post-removal* array, so an upward move in paint
    // order shifts down by one.
    let target = anchorAt + 1;
    if (from < target) target -= 1;
    // Fabric is the sole order owner; moveObjectTo reorders the array Fabric paints.
    // Its boolean return is the move's own verdict — it answers false when the
    // object already sits at `target`, and discarding that would report success
    // for a move that did not happen, so the drop line would lie.
    if (!canvas.moveObjectTo(moved, target)) return false;
    canvas.requestRenderAll();
    input.editor.historyManager.saveState();
    notify();
    return true;
  };
  return {
    snapshot,
    target,
    can,
    canArrange: canArrangeAction,
    layers,
    selectLayer,
    setLayerVisible,
    setLayerLocked,
    setCollapsed,
    renameLayer,
    sameLayerParent,
    reorderLayer,
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
