/**
 * §7's `?` reference, as rows rather than as a surface.
 *
 * The sheet and the tooltip read one projection of one table, so a chord cannot
 * be right in one and wrong in the other. Nothing here decides *which* actions
 * exist — `index.ts` owns that — and nothing here owns a chord.
 */
import { uiCopy } from "../ui-copy.js";
import { shortcutLabel, type ShortcutPrefix } from "./display.js";
import { type ProductShortcutId, productShortcutIds } from "./index.js";

export interface ShortcutReferenceRow {
  readonly label: string;
  readonly chord: string;
}

export interface ShortcutReferenceGroup {
  readonly label: string;
  readonly rows: readonly ShortcutReferenceRow[];
}

/**
 * One word per action, reusing `uiCopy`'s existing names rather than writing a
 * second vocabulary for the same things: `Redo` is `uiCopy.actions.redo` in the
 * Edit menu, in the context menu and here. The `satisfies` is load-bearing — a
 * `ProductShortcutId` added to the table with no word fails to compile, which is
 * the only thing standing between a new binding and a silently shorter sheet.
 */
const SHORTCUT_LABELS = {
  "file.new": uiCopy.file.newDocument,
  "file.open": uiCopy.file.openPackage,
  "file.save": uiCopy.file.savePackage,
  "edit.undo": uiCopy.actions.undo,
  "edit.redo": uiCopy.actions.redo,
  "edit.delete": uiCopy.actions.delete,
  "edit.copy": uiCopy.actions.copy,
  "edit.cut": uiCopy.actions.cut,
  "edit.duplicate": uiCopy.actions.duplicate,
  "edit.group": uiCopy.actions.group,
  "edit.ungroup": uiCopy.actions.ungroup,
  // `canvas.select-all` and the four nudges have no label anywhere else, because
  // no menu offers them and no control draws them. These are the only words for
  // them and they live here rather than being invented per surface.
  "canvas.select-all": "Select all",
  "canvas.nudge-left": "Nudge left",
  "canvas.nudge-right": "Nudge right",
  "canvas.nudge-up": "Nudge up",
  "canvas.nudge-down": "Nudge down",
  "canvas.front": uiCopy.actions.front,
  "canvas.back": uiCopy.actions.back,
  // `view.exit-group` is a `ProductShortcutId` with **no product binding** — it is
  // bound on `Escape` in `CONTEXT_SHORTCUTS` and the file's own comment says it is
  // never displayed. It needs a word all the same, because `satisfies` below is
  // total over the *union* and the compiler refuses a member with no entry; the word
  // is one `uiCopy` already has for this exact act (`layer-panel.tsx:718` pairs
  // `panels.leave`/`panels.enter` with `bridge.exitGroup()`/`enterGroup()`).
  // It never reaches the sheet: `shortcutReferenceGroups()` iterates
  // `productShortcutIds()`, which is a projection of the table and so excludes it.
  "view.exit-group": uiCopy.panels.leave,
  // The sheet's own name, which is `uiCopy.shortcuts.reference` — the same word
  // the sheet's heading prints and the `aria-label` on its Dialog carries, so the
  // row and the surface cannot disagree.
  "help.shortcuts": uiCopy.shortcuts.reference,
} as const satisfies Record<ProductShortcutId, string>;

/** The group an id belongs to: the part of its name before its first dot. */
function prefixOf(action: ProductShortcutId): ShortcutPrefix {
  return action.slice(0, action.indexOf(".")) as ShortcutPrefix;
}

/**
 * The table as directions an author reads, grouped by where the action lives,
 * in the table's own order — the same order `shortcutLabel` renders chords in,
 * so the sheet and a tooltip can never disagree about what a key is.
 */
export function shortcutReferenceGroups(): readonly ShortcutReferenceGroup[] {
  const groups = new Map<string, ShortcutReferenceRow[]>();
  for (const action of productShortcutIds()) {
    const prefix = prefixOf(action);
    const rows = groups.get(prefix) ?? [];
    rows.push({ label: SHORTCUT_LABELS[action], chord: shortcutLabel(action) });
    groups.set(prefix, rows);
  }
  return [...groups].map(([prefix, rows]) => ({
    label: uiCopy.shortcuts.groups[prefix as ShortcutPrefix],
    rows,
  }));
}
