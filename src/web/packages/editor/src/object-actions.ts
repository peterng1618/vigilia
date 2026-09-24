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

/** One owner for object actions: what each is, when it applies, how it runs. */
export const OBJECT_ACTIONS: readonly ObjectAction[] = [
  {
    id: "duplicate",
    label: uiCopy.actions.duplicate,
    icon: Copy,
    eligible: hasSelection,
    run: (e) => void e.clipboardManager.duplicate(),
  },
  {
    id: "copy",
    label: uiCopy.actions.copy,
    icon: Copy,
    eligible: hasSelection,
    run: (e) => void e.clipboardManager.copy(),
  },
  {
    id: "cut",
    label: uiCopy.actions.cut,
    icon: Scissors,
    eligible: hasSelection,
    run: (e) => void e.clipboardManager.cut(),
  },
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
  {
    id: "group",
    label: uiCopy.actions.group,
    icon: Lock,
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

/** Arrange is its own group: it needs two or more objects and its own owner. */
export function arrangeActions(): readonly ObjectAction[] {
  return (Object.keys(ARRANGE_ICONS) as ArrangeAction[]).map((action) => ({
    id: `arrange:${action}` as const,
    label: uiCopy.arrangeLabels[action],
    icon: ARRANGE_ICONS[action],
    eligible: (target) => target.memberCount > 1,
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
