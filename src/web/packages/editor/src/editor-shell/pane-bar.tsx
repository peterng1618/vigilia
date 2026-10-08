import { Plus } from "lucide-react";
import { uiCopy } from "../ui-copy.js";

/** The left column's panes, the theme's own document panels among them.
 *
 *  It lives here rather than in `shell-layout.tsx` because the bar is what
 *  enumerates them — two owners of "which panes there are" would drift. */
export type RailPane = "layers" | "insert" | "assets" | "document";

/** The segments, in bar order. */
const PANES: readonly (readonly [RailPane, string])[] = [
  ["layers", uiCopy.rail.layers],
  ["insert", uiCopy.rail.insert],
  ["assets", uiCopy.rail.assets],
  ["document", uiCopy.rail.document],
];

/** The left column's header: one segment per pane and the insert action.
 *
 *  The segments are labelled rather than icon-only as the rail's were — a
 *  horizontal bar has the room, and the word is what tells an insert pane
 *  from an asset one without an author having to hover each mark to learn
 *  what it does. The bar draws no pane content: React still positions one
 *  persistent host per pane and hides the ones that are not showing.
 */
export function PaneBar({
  pane,
  collapsed,
  onChoose,
  onInsert,
  addRef,
  addExpanded = false,
  addDisabled = false,
}: {
  readonly pane: RailPane;
  readonly collapsed: boolean;
  /** Asking for the pane already showing is a collapse, and the shell decides
   *  that: the bar cannot tell a swap from a close. */
  readonly onChoose: (pane: RailPane) => void;
  readonly onInsert: () => void;
  /** The `+` itself, for the shell to anchor the chooser to. The button stays
   *  the bar's; only what a press opens belongs to the popover. */
  readonly addRef?: React.Ref<HTMLButtonElement>;
  /** Whether that chooser is showing. The `+` carries no pane state, so this is
   *  the only pressed-or-not mark it has. */
  readonly addExpanded?: boolean;
  /** Refused rather than opening rows that could dispatch nothing: before a
   *  document is open there is no façade for an item to reach. */
  readonly addDisabled?: boolean;
}): React.JSX.Element {
  return (
    <nav
      className="editor-shell-pane-bar editor-glass"
      aria-label={uiCopy.rail.label}
    >
      {PANES.map(([id, label]) => (
        <button
          key={id}
          type="button"
          // The label is the content, so it is also the accessible name.
          // Pressed says which pane is chosen and stays true while the panel
          // is closed, so the bar still shows what reopening restores;
          // expanded is how the closed state is announced rather than drawn.
          aria-pressed={pane === id}
          aria-expanded={!collapsed}
          onClick={() => onChoose(id)}
        >
          {label}
        </button>
      ))}
      {/* Icon-only, so its name is `aria-label` and never the content: a `+`
          stored as a translatable string is announced as a word of its own and
          cannot inherit a shell colour the way the icon beside it does. It
          still says it opens a menu, because a mark that quietly produces a
          list of twenty-one rows is one a screen reader user cannot anticipate. */}
      <button
        ref={addRef}
        type="button"
        className="editor-shell-pane-bar-add"
        aria-label={uiCopy.rail.insertObject}
        aria-haspopup="menu"
        aria-expanded={addExpanded}
        disabled={addDisabled}
        onClick={onInsert}
      >
        <Plus aria-hidden size={16} strokeWidth={1.75} />
      </button>
    </nav>
  );
}
