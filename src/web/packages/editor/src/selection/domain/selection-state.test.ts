import { describe, expect, it } from 'vitest';
import {
  addToSelection,
  applyClick,
  clearSelection,
  emptySelection,
  enterGroup,
  exitAllGroups,
  exitGroup,
  isSelected,
  pruneSelection,
  setSelection,
} from './selection-state.js';

describe('applyClick', () => {
  it('replaces the selection on a plain click', () => {
    const state = applyClick(applyClick(emptySelection, 'a'), 'b');

    expect(state.ids).toEqual(['b']);
    expect(state.anchor).toBe('b');
  });

  it('clears the selection when empty canvas is clicked', () => {
    expect(applyClick(applyClick(emptySelection, 'a'), undefined).ids).toEqual([]);
  });

  it('leaves entered groups alone when empty canvas is clicked', () => {
    // Deselecting is not leaving: an author working inside a group who clicks a
    // gap has deselected, not stepped out.
    const inside = enterGroup(emptySelection, 'card');
    const after = applyClick(inside, undefined);

    expect(after.enteredGroups).toEqual(['card']);
  });

  it('does not clear on a modified click over empty canvas', () => {
    // Ctrl-clicking a gap by accident should not throw away a careful
    // multi-selection.
    const state = setSelection(emptySelection, ['a', 'b']);

    expect(applyClick(state, undefined, 'toggle').ids).toEqual(['a', 'b']);
    expect(applyClick(state, undefined, 'add').ids).toEqual(['a', 'b']);
  });

  it('toggles a node in and out', () => {
    const withTwo = applyClick(applyClick(emptySelection, 'a'), 'b', 'toggle');
    expect(withTwo.ids).toEqual(['a', 'b']);

    const removed = applyClick(withTwo, 'a', 'toggle');
    expect(removed.ids).toEqual(['b']);
  });

  it('moves the anchor when the anchor is toggled off', () => {
    // A range operation immediately afterwards needs something to anchor to.
    const state = applyClick(applyClick(emptySelection, 'a'), 'b', 'toggle');
    expect(state.anchor).toBe('b');

    const removed = applyClick(state, 'b', 'toggle');
    expect(removed.anchor).toBe('a');
  });

  it('adds without removing, and re-anchors on a repeat', () => {
    const state = applyClick(applyClick(emptySelection, 'a'), 'b', 'add');
    expect(state.ids).toEqual(['a', 'b']);

    const again = applyClick(state, 'a', 'add');
    expect(again.ids).toEqual(['a', 'b']);
    expect(again.anchor).toBe('a');
  });

  it('preserves the order nodes were picked in', () => {
    // "Align to the first selected" needs to know which that was, and a status
    // line should list them the way the author chose them.
    const state = ['c', 'a', 'b'].reduce(
      (current, id) => applyClick(current, id, 'add'),
      emptySelection,
    );

    expect(state.ids).toEqual(['c', 'a', 'b']);
  });
});

describe('bulk selection', () => {
  it('replaces with a marquee result', () => {
    const state = setSelection(applyClick(emptySelection, 'old'), ['a', 'b']);

    expect(state.ids).toEqual(['a', 'b']);
    expect(state.anchor).toBe('b');
  });

  it('de-duplicates defensively', () => {
    // A marquee over overlapping nodes inside a group resolves several hits to
    // one ancestor.
    expect(setSelection(emptySelection, ['a', 'a', 'b']).ids).toEqual(['a', 'b']);
  });

  it('merges a shift-drag into the existing selection', () => {
    const state = addToSelection(setSelection(emptySelection, ['a']), ['b', 'a', 'c']);

    expect(state.ids).toEqual(['a', 'b', 'c']);
  });

  it('clears', () => {
    expect(clearSelection(setSelection(emptySelection, ['a'])).ids).toEqual([]);
  });
});

describe('groups', () => {
  it('clears the selection on entering', () => {
    // The group that was selected is no longer a sensible selection once the
    // author is inside it, and keeping it would make the next drag move the
    // whole group by accident.
    const state = enterGroup(applyClick(emptySelection, 'card'), 'card');

    expect(state.enteredGroups).toEqual(['card']);
    expect(state.ids).toEqual([]);
  });

  it('nests', () => {
    const state = enterGroup(enterGroup(emptySelection, 'outer'), 'inner');
    expect(state.enteredGroups).toEqual(['outer', 'inner']);
  });

  it('is idempotent for a group already entered', () => {
    const once = enterGroup(emptySelection, 'card');
    expect(enterGroup(once, 'card')).toBe(once);
  });

  it('selects the group it leaves', () => {
    // What makes escape feel like stepping back up: the author ends up holding
    // the thing they were inside.
    const state = exitGroup(enterGroup(enterGroup(emptySelection, 'outer'), 'inner'));

    expect(state.enteredGroups).toEqual(['outer']);
    expect(state.ids).toEqual(['inner']);
  });

  it('clears the selection when there is nothing to leave', () => {
    expect(exitGroup(setSelection(emptySelection, ['a'])).ids).toEqual([]);
  });

  it('drops everything on exitAllGroups', () => {
    const deep = enterGroup(enterGroup(emptySelection, 'a'), 'b');
    expect(exitAllGroups(deep)).toEqual(emptySelection);
  });
});

describe('pruneSelection', () => {
  it('drops ids that no longer exist', () => {
    // After an undo or a delete. A selection pointing at a deleted node is how
    // an inspector change gets applied to nothing.
    const state = setSelection(emptySelection, ['a', 'b', 'c']);
    const pruned = pruneSelection(state, new Set(['a', 'c']));

    expect(pruned.ids).toEqual(['a', 'c']);
  });

  it('drops entered groups that no longer exist', () => {
    const state = enterGroup(emptySelection, 'card');
    expect(pruneSelection(state, new Set()).enteredGroups).toEqual([]);
  });

  it('re-anchors when the anchor is gone', () => {
    const state = setSelection(emptySelection, ['a', 'b']);
    expect(pruneSelection(state, new Set(['a'])).anchor).toBe('a');
  });

  it('returns the same object when nothing changed', () => {
    // Referential stability matters for change detection in a UI that
    // re-renders on state identity.
    const state = setSelection(emptySelection, ['a']);
    expect(pruneSelection(state, new Set(['a']))).toBe(state);
  });
});

describe('isSelected', () => {
  it('answers for both cases', () => {
    const state = setSelection(emptySelection, ['a']);

    expect(isSelected(state, 'a')).toBe(true);
    expect(isSelected(state, 'b')).toBe(false);
  });
});
