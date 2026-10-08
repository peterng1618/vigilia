import { FileText, Layers, type LucideIcon, Palette, Plus } from "lucide-react";
import { useEffect, useRef } from "react";
import { uiCopy } from "../ui-copy.js";
import { tooltip } from "./controls/tooltip.js";

/** The rail's four slots (bible §7.2). Named here rather than in
 *  `shell-layout.tsx` because the rail is what enumerates them — two owners of
 *  "which slots there are" would drift. */
export type RailSlot = "composition" | "add" | "tokens" | "document";

/** The slots, in rail order. This is the one place that says how many there
 *  are; `shell-layout` and the tests read it rather than restating the set. */
export const RAIL_SLOTS: readonly RailSlot[] = [
  "composition",
  "add",
  "tokens",
  "document",
];

/** Each slot's glyph, from bible §7.2's table: the scene tree's stack, the add
 *  plus, the tokens palette, the document page. The kind glyph set is closed
 *  by plan 6; these are the marks that table names, drawn from the one icon
 *  family already installed. */
const GLYPHS: Readonly<Record<RailSlot, LucideIcon>> = {
  composition: Layers,
  add: Plus,
  tokens: Palette,
  document: FileText,
};

/** One slot: a 34px icon-only control whose one word is both its tooltip and
 *  its accessible name, so the two cannot disagree.
 *
 *  The tooltip is the shell's one DOM control rather than a React popup: the
 *  selection inspector is not React and has to use the same one, and a second
 *  owner for "what a tooltip is" is the drift this avoids. The rail renders
 *  its own button rather than `ControlIconButton` because a slot carries
 *  `aria-pressed` — which one is chosen — and the control set's icon button,
 *  a plain 26px action, has no such state.
 *
 *  **`aria-pressed` is the whole of a slot's own state, and there is no
 *  `aria-expanded` beside it.** Whether the pane column is out is a fact about
 *  the shell, not about a slot: put on all four it read `true` on a slot whose
 *  pane was `hidden` behind another's, and put on each slot it would be a
 *  second attribute restating what `aria-pressed` already decides. The shell
 *  publishes that one fact once, on the rail.
 */
function RailSlotButton({
  slot,
  label,
  pressed,
  disabled,
  onChoose,
}: {
  readonly slot: RailSlot;
  readonly label: string;
  readonly pressed: boolean;
  readonly disabled: boolean;
  readonly onChoose: (slot: RailSlot) => void;
}): React.JSX.Element {
  const Glyph = GLYPHS[slot];
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
      className="editor-shell-rail-slot"
      data-rail-slot={slot}
      aria-label={label}
      // Pressed says which slot is chosen and stays true while the pane is
      // closed, so the rail still shows what reopening restores.
      aria-pressed={pressed}
      disabled={disabled}
      onClick={() => onChoose(slot)}
    >
      <Glyph aria-hidden size={17} strokeWidth={1.7} />
    </button>
  );
}

/** The left edge's vertical glyph strip: one slot per pane, and nothing else.
 *
 *  It draws no pane content — React positions one persistent host per pane and
 *  hides the ones that are not showing — and it decides nothing: asking for
 *  the slot already open is a collapse, and the shell is what turns the
 *  gesture into a close (its `choosePane`), because the rail cannot tell a
 *  swap from a close. */
export function Rail(props: {
  readonly slot: RailSlot;
  readonly collapsed: boolean;
  readonly onChoose: (slot: RailSlot) => void;
  readonly disabled?: boolean;
}): React.JSX.Element {
  return (
    <nav
      className="editor-shell-rail editor-glass"
      aria-label={uiCopy.rail.label}
      // The column's state, said once for the rail rather than four times for
      // the slots: which pane is shown is the slots' `aria-pressed`, and
      // whether any is out at all is the rail's own.
      data-collapsed={props.collapsed}
    >
      {RAIL_SLOTS.map((id) => (
        <RailSlotButton
          key={id}
          slot={id}
          label={uiCopy.rail.slots[id]}
          pressed={props.slot === id}
          disabled={props.disabled ?? false}
          onChoose={props.onChoose}
        />
      ))}
    </nav>
  );
}
