import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Copy,
  CopyPlus,
  Group,
  Lock,
  type LucideIcon,
  Scissors,
  Trash2,
  Ungroup,
  Unlock,
} from "lucide-react";
import { type ArrangeAction, applyArrange } from "./arrange.js";
import type { EditorInteraction } from "./editor-interaction.js";
import { uiCopy } from "./ui-copy.js";

/** What a surface may render an action against. Serializable, Fabric-free. */
export interface ObjectTarget {
  readonly kind: "none" | "object" | "group" | "chart";
  readonly locked: boolean;
  readonly memberCount: number;
  /** True when the active object is a Group (ungroup), false for a bare selection. */
  readonly isGroup: boolean;
}

export type ObjectActionId =
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
  | `arrange:${ArrangeAction}`;

export interface ObjectAction {
  readonly id: ObjectActionId;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly eligible: (target: ObjectTarget) => boolean;
  readonly run: (editor: EditorInteraction) => void;
}

const hasSelection = (target: ObjectTarget): boolean => target.kind !== "none";

/**
 * What an action surface needs to know about itself to gate a control.
 * Deliberately no per-id `can`: eligibility carries the whole rule, so a `can`
 * here would only ever re-enter `actionEnabled`.
 */
export interface ActionGate {
  readonly target: () => ObjectTarget;
  readonly canArrange: (action: ArrangeAction) => boolean;
}

/** The one predicate both action surfaces use, so they cannot drift. */
export function actionEnabled(gate: ActionGate, id: ObjectActionId): boolean {
  if (!objectAction(id).eligible(gate.target())) return false;
  return (
    !id.startsWith("arrange:") ||
    gate.canArrange(id.slice("arrange:".length) as ArrangeAction)
  );
}

/** One owner for object actions: what each is, when it applies, how it runs. */
export const OBJECT_ACTIONS: readonly ObjectAction[] = [
  {
    id: "duplicate",
    label: uiCopy.actions.duplicate,
    icon: CopyPlus,
    // ClipboardManager.duplicate refuses a locked object; eligibility has to agree.
    eligible: (t) => hasSelection(t) && !t.locked,
    run: (e) => void e.clipboardManager.duplicate(),
  },
  {
    id: "copy",
    label: uiCopy.actions.copy,
    icon: Copy,
    // ClipboardManager.copy refuses a locked object; eligibility has to agree.
    eligible: (t) => hasSelection(t) && !t.locked,
    run: (e) => void e.clipboardManager.copy(),
  },
  {
    id: "cut",
    label: uiCopy.actions.cut,
    icon: Scissors,
    // Cut refuses through copy(), which refuses a locked object.
    eligible: (t) => hasSelection(t) && !t.locked,
    run: (e) => void e.clipboardManager.cut(),
  },
  // No manager refuses on lock for the ordering actions, so they stay on bare
  // hasSelection: narrowing further would advertise a refusal that never happens.
  {
    id: "front",
    label: uiCopy.actions.front,
    icon: ArrowUpToLine,
    eligible: hasSelection,
    run: (e) => e.layerManager.bringToFront(),
  },
  {
    id: "bring-forward",
    label: uiCopy.actions.bringForward,
    icon: ArrowUp,
    eligible: hasSelection,
    run: (e) => e.layerManager.bringForward(),
  },
  {
    id: "send-backward",
    label: uiCopy.actions.sendBackward,
    icon: ArrowDown,
    eligible: hasSelection,
    run: (e) => e.layerManager.sendBackwards(),
  },
  {
    id: "back",
    label: uiCopy.actions.back,
    icon: ArrowDownToLine,
    eligible: hasSelection,
    run: (e) => e.layerManager.sendToBack(),
  },
  {
    id: "lock",
    label: uiCopy.actions.lock,
    icon: Lock,
    eligible: (t) => hasSelection(t) && !t.locked,
    run: (e) => e.objectLockManager.lockObject(),
  },
  {
    id: "unlock",
    label: uiCopy.actions.unlock,
    icon: Unlock,
    eligible: (t) => hasSelection(t) && t.locked,
    run: (e) => e.objectLockManager.unlockObject(),
  },
  // GroupingManager reads no lock, so grouping stays on bare selection too.
  {
    id: "group",
    label: uiCopy.actions.group,
    icon: Group,
    eligible: (t) => t.kind === "group" && t.memberCount > 1 && !t.isGroup,
    run: (e) => e.groupingManager.group(),
  },
  {
    id: "ungroup",
    label: uiCopy.actions.ungroup,
    icon: Ungroup,
    eligible: (t) => t.isGroup,
    run: (e) => e.groupingManager.ungroup(),
  },
  {
    id: "delete",
    label: uiCopy.actions.delete,
    icon: Trash2,
    // DeletionManager refuses locked objects; eligibility has to agree.
    eligible: (t) => hasSelection(t) && !t.locked,
    run: (e) => e.deletionManager.deleteActive(),
  },
];

const ARRANGE_ICONS: Readonly<Record<ArrangeAction, LucideIcon>> = {
  "align-left": AlignStartVertical,
  "align-center-x": AlignCenterVertical,
  "align-right": AlignEndVertical,
  "align-top": AlignStartHorizontal,
  "align-center-y": AlignCenterHorizontal,
  "align-bottom": AlignEndHorizontal,
  "distribute-x": AlignHorizontalDistributeCenter,
  "distribute-y": AlignVerticalDistributeCenter,
};

/**
 * Arrange's eligibility, as two numbers rather than a target: the toolbar
 * reads it from the shell snapshot's `selectedCount`, not from `target()`,
 * which is undefined until a bridge is set.
 */
export function arrangeEligible(count: number, locked: boolean): boolean {
  return count > 1 && !locked;
}

/** Arrange is its own group: it needs two or more objects and its own owner. */
export function arrangeActions(): readonly ObjectAction[] {
  return (Object.keys(ARRANGE_ICONS) as ArrangeAction[]).map((action) => ({
    id: `arrange:${action}` as const,
    label: uiCopy.arrangeLabels[action],
    icon: ARRANGE_ICONS[action],
    // canArrange also refuses a locked member, so eligibility has to agree.
    eligible: (target) => arrangeEligible(target.memberCount, target.locked),
    run: (editor) => void applyArrange(editor, action),
  }));
}

export function objectAction(id: ObjectActionId): ObjectAction {
  const found =
    OBJECT_ACTIONS.find((action) => action.id === id) ??
    arrangeActions().find((action) => action.id === id);
  if (found === undefined) throw new Error(`Unknown object action: ${id}`);
  return found;
}
