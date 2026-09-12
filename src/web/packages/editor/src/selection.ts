/**
 * Selection state.
 *
 * Kept as a pure value with pure transitions, so every modifier combination is
 * testable in Node. The DOM layer turns pointer events into these calls and
 * draws the result; it decides nothing.
 *
 * ## Order is preserved
 *
 * The selection is an ordered list, not a set. Two things depend on it:
 * "align to the first selected" needs to know which one that was, and a status
 * line reading "4 selected" should list them in the order the author picked
 * them, not in whatever order a hash table produced.
 */

export interface SelectionState {
  /** Selected node ids, in the order they were added. */
  readonly ids: readonly string[];
  /**
   * The node a range or align operation treats as the anchor — the last one
   * clicked, not the first. Matches every file manager and drawing tool.
   */
  readonly anchor: string | undefined;
  /** Groups that have been entered, outermost first. */
  readonly enteredGroups: readonly string[];
}

export const emptySelection: SelectionState = {
  ids: [],
  anchor: undefined,
  enteredGroups: [],
};

/** How a click should combine with the existing selection. */
export type SelectionMode =
  /** Plain click: replace. */
  | 'replace'
  /** Ctrl/Cmd: add or remove this one. */
  | 'toggle'
  /** Shift: add without removing. */
  | 'add';

/**
 * Applies a click on `id`, or on empty canvas when `id` is undefined.
 *
 * Clicking empty canvas clears the selection **and leaves entered groups
 * alone**. Those are separate concerns: an author working inside a group who
 * clicks a gap has deselected, not left the group. Leaving is
 * {@link exitGroup}, or a click outside the group's bounds, which the DOM layer
 * decides because it knows where the group is.
 */
export function applyClick(
  state: SelectionState,
  id: string | undefined,
  mode: SelectionMode = 'replace',
): SelectionState {
  if (id === undefined) {
    return mode === 'replace' ? { ...state, ids: [], anchor: undefined } : state;
  }

  if (mode === 'replace') {
    return { ...state, ids: [id], anchor: id };
  }

  if (mode === 'add') {
    return state.ids.includes(id)
      ? { ...state, anchor: id }
      : { ...state, ids: [...state.ids, id], anchor: id };
  }

  if (state.ids.includes(id)) {
    const ids = state.ids.filter((current) => current !== id);

    return {
      ...state,
      ids,
      // Removing the anchor moves it to whatever is still selected, so a
      // following range operation has something to anchor to.
      anchor: state.anchor === id ? ids.at(-1) : state.anchor,
    };
  }

  return { ...state, ids: [...state.ids, id], anchor: id };
}

/** Replaces the selection wholesale — a marquee result, or "select all". */
export function setSelection(
  state: SelectionState,
  ids: readonly string[],
): SelectionState {
  // De-duplicated defensively: a marquee over overlapping nodes in a group can
  // resolve several hits to one ancestor.
  const unique = [...new Set(ids)];

  return { ...state, ids: unique, anchor: unique.at(-1) };
}

/** Adds a marquee result to the existing selection (shift-drag). */
export function addToSelection(
  state: SelectionState,
  ids: readonly string[],
): SelectionState {
  const merged = [...state.ids];

  for (const id of ids) {
    if (!merged.includes(id)) {
      merged.push(id);
    }
  }

  return { ...state, ids: merged, anchor: merged.at(-1) };
}

export function clearSelection(state: SelectionState): SelectionState {
  return { ...state, ids: [], anchor: undefined };
}

/**
 * Enters a group, making its children directly selectable.
 *
 * The selection is cleared: the group that was selected is no longer a sensible
 * selection once the author is working inside it, and keeping it would make the
 * next drag move the whole group by accident.
 */
export function enterGroup(state: SelectionState, groupId: string): SelectionState {
  if (state.enteredGroups.includes(groupId)) {
    return state;
  }

  return {
    ids: [],
    anchor: undefined,
    enteredGroups: [...state.enteredGroups, groupId],
  };
}

/**
 * Leaves the innermost entered group and selects it.
 *
 * Selecting it on the way out is what makes escape feel like "step back up":
 * the author ends up holding the thing they were just inside.
 */
export function exitGroup(state: SelectionState): SelectionState {
  const leaving = state.enteredGroups.at(-1);

  if (leaving === undefined) {
    return clearSelection(state);
  }

  return {
    ids: [leaving],
    anchor: leaving,
    enteredGroups: state.enteredGroups.slice(0, -1),
  };
}

/** Drops all entered groups, e.g. when the document is replaced. */
export function exitAllGroups(state: SelectionState): SelectionState {
  return { ids: [], anchor: undefined, enteredGroups: [] };
}

/**
 * Removes ids that no longer exist.
 *
 * Called after an undo, a delete, or a document replacement. A selection
 * pointing at a deleted node is how an editor ends up applying an inspector
 * change to nothing, or crashing on the next gesture.
 */
export function pruneSelection(
  state: SelectionState,
  existingIds: ReadonlySet<string>,
): SelectionState {
  const ids = state.ids.filter((id) => existingIds.has(id));
  const enteredGroups = state.enteredGroups.filter((id) => existingIds.has(id));

  if (ids.length === state.ids.length && enteredGroups.length === state.enteredGroups.length) {
    return state;
  }

  return {
    ids,
    anchor: state.anchor !== undefined && existingIds.has(state.anchor) ? state.anchor : ids.at(-1),
    enteredGroups,
  };
}

export function isSelected(state: SelectionState, id: string): boolean {
  return state.ids.includes(id);
}
