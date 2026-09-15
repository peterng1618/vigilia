/** Ordered pure selection state; the DOM layer only maps events into transitions. */

export interface SelectionState {
  readonly ids: readonly string[];
  /** Last clicked/added id used as the anchor. */
  readonly anchor: string | undefined;
  readonly enteredGroups: readonly string[];
}

export const emptySelection: SelectionState = {
  ids: [],
  anchor: undefined,
  enteredGroups: [],
};

export type SelectionMode =
  /** Replace selection. */
  | 'replace'
  /** Toggle members. */
  | 'toggle'
  /** Add without removing existing members. */
  | 'add';

/** Empty-canvas replace clears selection but does not exit entered groups. */
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
      anchor: state.anchor === id ? ids.at(-1) : state.anchor,
    };
  }

  return { ...state, ids: [...state.ids, id], anchor: id };
}

/** Replace selection and de-duplicate promoted group hits. */
export function setSelection(
  state: SelectionState,
  ids: readonly string[],
): SelectionState {
  const unique = [...new Set(ids)];

  return { ...state, ids: unique, anchor: unique.at(-1) };
}

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

/** Entering a group clears selection so the group and child cannot move together. */
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

/** Exit the innermost group and select it. */
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

export function exitAllGroups(state: SelectionState): SelectionState {
  return { ids: [], anchor: undefined, enteredGroups: [] };
}

/** Remove selections/groups that no longer exist; preserve identity on no-op. */
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
