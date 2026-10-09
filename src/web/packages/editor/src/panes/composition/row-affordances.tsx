import {
  Eye,
  EyeOff,
  Lock,
  type LucideIcon,
  Pencil,
  Unlock,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { tooltip } from "../../editor-shell/controls/tooltip.js";
import type { LayerRow } from "../../editor-shell/layer-tree.js";
import { uiCopy } from "../../ui-copy.js";

/**
 * The controls the attended row carries: rename, visibility and lock.
 *
 * **The attendance rule is the whole of this component's gate.** A row whose
 * flags are both at their default carries neither state control, because two
 * flags that are both true carry no information — 104 icons reading "visible,
 * unlocked" was the measured defect, and it grows with the row count, which is
 * exactly the case a card-heavy panel hides. The author's attention (a pointer
 * over the row, or the keyboard on it) brings all three; the row's own state
 * brings back the control that names it, and only that one: a hidden row is
 * still unlocked, so an unlocked row's lock icon would be noise even there.
 *
 * Rename is not a state and reads nothing about the eye, so it appears wherever
 * *either* state control does — including on a locked row, which is the one
 * state an author has the least other way out of.
 *
 * The gates live here rather than in the pane because the row's *attention* is
 * the pane's to compute and the row's *answer to it* is this component's. The
 * pane owns hover and focus; the row owns what they show.
 *
 * These are `RowControl`s rather than `ControlIconButton`s, for the reason
 * `rail.tsx` gives for its slots and not for a second one: the pressed state is
 * the whole of a visibility or lock control's state, and the control set's icon
 * button is a plain action with no `aria-pressed` to carry it. They take the
 * control set's one tooltip owner instead, so their name and their tooltip are
 * one string (§6) exactly as an icon button's are.
 *
 * They are also direct children of `.vigilia-layer-state`, never wrapped: the
 * stylesheet asks that slot's own buttons how much room beside the key they
 * need (`:has(... button:nth-child(n))`), and a wrapper would put every button
 * at position one of its own parent and answer the question for one control on
 * a row that draws three.
 */
export function RowAffordances({
  row,
  attended,
  onRename,
  onToggleVisible,
  onToggleLocked,
}: {
  readonly row: LayerRow;
  /** Whether the author is on this row — a pointer over it, or the keyboard
   *  on it. The pane's own two facts, folded into the one the row acts on. */
  readonly attended: boolean;
  readonly onRename: () => void;
  readonly onToggleVisible: () => void;
  readonly onToggleLocked: () => void;
}): React.JSX.Element {
  const showRename = attended || row.selected || !row.visible || row.locked;
  const showVisibility = attended || row.selected || !row.visible;
  const showLock = attended || row.selected || row.locked;
  return (
    <>
      {showRename ? (
        <RowControl label={uiCopy.panels.rename} onClick={onRename}>
          <Pencil aria-hidden size={15} strokeWidth={1.75} />
        </RowControl>
      ) : null}
      {showVisibility ? (
        <RowControl
          label={row.visible ? uiCopy.panels.hide : uiCopy.panels.show}
          pressed={row.visible}
          onClick={onToggleVisible}
        >
          {row.visible ? (
            <Eye aria-hidden size={15} strokeWidth={1.75} />
          ) : (
            <EyeOff aria-hidden size={15} strokeWidth={1.75} />
          )}
        </RowControl>
      ) : null}
      {showLock ? (
        <RowControl
          label={row.locked ? uiCopy.actions.unlock : uiCopy.actions.lock}
          pressed={row.locked}
          onClick={onToggleLocked}
        >
          <LockStateIcon locked={row.locked} />
        </RowControl>
      ) : null}
    </>
  );
}

/**
 * One of the row's controls: a 26px square at the control set's box (§5), whose
 * one word is both its accessible name and its tooltip, armed from the shell's
 * one tooltip owner so the two cannot disagree.
 *
 * `pressed` is omitted rather than passed `undefined` on the rename control —
 * `exactOptionalPropertyTypes` is on, and the absence of the attribute is the
 * fact that rename carries no state, not a pressed-but-false one.
 */
function RowControl({
  label,
  pressed,
  onClick,
  children,
}: {
  readonly label: string;
  readonly pressed?: boolean;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const button = ref.current;
    if (button === null) return;
    return tooltip({ trigger: button, text: label }).destroy;
  }, [label]);
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={(event) => {
        // The control sits inside the row, and the row's own click selects the
        // layer. Pressing a control is not pressing the row under it.
        event.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

/** Locked is a filled lock, unlocked an outline one: at this size the outlines
 *  differ only by a gap in the shackle. `fill` is part of `LucideProps` and
 *  overrides Lucide's own `fill="none"`, so the weight changes without a
 *  second glyph. */
const LOCK_STATES: Readonly<
  Record<
    "locked" | "unlocked",
    { readonly icon: LucideIcon; readonly fill?: string }
  >
> = {
  locked: { icon: Lock, fill: "currentColor" },
  unlocked: { icon: Unlock },
};

/** `exactOptionalPropertyTypes` is on, so the absent fill is spread in rather
 *  than passed as `undefined` — that would type-check but defeat the default. */
function LockStateIcon({
  locked,
}: {
  readonly locked: boolean;
}): React.JSX.Element {
  const state = LOCK_STATES[locked ? "locked" : "unlocked"];
  const Icon = state.icon;
  return (
    <Icon
      aria-hidden
      size={15}
      strokeWidth={1.75}
      {...(state.fill === undefined ? {} : { fill: state.fill })}
    />
  );
}
