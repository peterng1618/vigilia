import { describe, expect, it } from 'vitest';

import {
  ACTIONS,
  type ActionContext,
  actionById,
  actionForShortcut,
  actionsInGroup,
  disabledReason,
  shortcutLabel,
} from './actions.js';

const nothing: ActionContext = {
  selectionCount: 0,
  canUndo: false,
  canRedo: false,
  hasGroupSelected: false,
  allSelectedLocked: false,
};

function context(overrides: Partial<ActionContext>): ActionContext {
  return { ...nothing, ...overrides };
}

describe('the action registry', () => {
  it('declares every id exactly once', () => {
    const ids = ACTIONS.map((action) => action.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('binds no shortcut to two different actions', () => {
    const bound = ACTIONS.filter((action) => action.shortcut !== undefined).map((action) =>
      [
        action.shortcut?.key.toLowerCase(),
        action.shortcut?.meta ?? false,
        action.shortcut?.shift ?? 'any',
      ].join('|'),
    );

    expect(new Set(bound).size).toBe(bound.length);
  });

  it('gives every action a label', () => {
    for (const action of ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
    }
  });
});

describe('actionForShortcut', () => {
  it('separates undo from redo by shift', () => {
    expect(actionForShortcut({ key: 'z', meta: true, shift: false })?.id).toBe('edit.undo');
    expect(actionForShortcut({ key: 'z', meta: true, shift: true })?.id).toBe('edit.redo');
  });

  it('accepts Ctrl+Y as redo, the other binding every tool offers', () => {
    expect(actionForShortcut({ key: 'y', meta: true, shift: false })?.id).toBe('edit.redo');
  });

  it('separates group from ungroup by shift', () => {
    expect(actionForShortcut({ key: 'g', meta: true, shift: false })?.id).toBe('object.group');
    expect(actionForShortcut({ key: 'g', meta: true, shift: true })?.id).toBe('object.ungroup');
  });

  it('is case-insensitive, so caps lock does not unbind everything', () => {
    expect(actionForShortcut({ key: 'S', meta: true, shift: false })?.id).toBe('file.save');
  });

  it('requires the modifier when one is declared', () => {
    expect(actionForShortcut({ key: 's', meta: false, shift: false })).toBeUndefined();
  });

  it('refuses a modifier when none is declared', () => {
    // Otherwise Ctrl+Delete would delete as well as whatever it means natively.
    expect(actionForShortcut({ key: 'Delete', meta: true, shift: false })).toBeUndefined();
  });

  it('ignores shift where shift is not declared', () => {
    expect(actionForShortcut({ key: 'Delete', meta: false, shift: true })?.id).toBe('edit.delete');
  });

  it('separates a small nudge from a large one', () => {
    expect(actionForShortcut({ key: 'ArrowLeft', meta: false, shift: false })?.id).toBe(
      'navigate.nudge-left',
    );
    expect(actionForShortcut({ key: 'ArrowLeft', meta: false, shift: true })?.id).toBe(
      'navigate.nudge-left-large',
    );
  });

  it('binds all four arrows, in the right direction', () => {
    for (const [key, id] of [
      ['ArrowLeft', 'navigate.nudge-left'],
      ['ArrowRight', 'navigate.nudge-right'],
      ['ArrowUp', 'navigate.nudge-up'],
      ['ArrowDown', 'navigate.nudge-down'],
    ] as const) {
      expect(actionForShortcut({ key, meta: false, shift: false })?.id).toBe(id);
    }
  });

  it('returns undefined for an unbound key', () => {
    expect(actionForShortcut({ key: 'q', meta: false, shift: false })).toBeUndefined();
  });

  it('returns a disabled action rather than hiding it', () => {
    // An unbound key and a currently-unusable one are different situations.
    const found = actionForShortcut({ key: 'z', meta: true, shift: false });

    expect(found?.id).toBe('edit.undo');
    expect(found?.enabled(nothing)).toBe(false);
  });
});

describe('enablement', () => {
  it('needs two elements to align and three to distribute', () => {
    const two = context({ selectionCount: 2 });

    expect(actionById('arrange.align-left')?.enabled(two)).toBe(true);
    expect(actionById('arrange.distribute-x')?.enabled(two)).toBe(false);
    expect(actionById('arrange.distribute-x')?.enabled(context({ selectionCount: 3 }))).toBe(true);
  });

  it('never disables Open or Save — the bug that motivated this module', () => {
    // A DOM selector one word too broad disabled these until two nodes were
    // selected, and two browser tests timed out clicking Save.
    for (const id of ['file.open', 'file.save'] as const) {
      expect(actionById(id)?.enabled(nothing)).toBe(true);
      expect(actionById(id)?.enabled(context({ selectionCount: 5 }))).toBe(true);
    }
  });

  it('ties undo and redo to the history, not the selection', () => {
    expect(actionById('edit.undo')?.enabled(context({ canUndo: true }))).toBe(true);
    expect(actionById('edit.undo')?.enabled(context({ selectionCount: 9 }))).toBe(false);
    expect(actionById('edit.redo')?.enabled(context({ canRedo: true }))).toBe(true);
  });

  it('will not delete a selection that is entirely locked (§61)', () => {
    expect(actionById('edit.delete')?.enabled(context({ selectionCount: 1 }))).toBe(true);
    expect(
      actionById('edit.delete')?.enabled(context({ selectionCount: 1, allSelectedLocked: true })),
    ).toBe(false);
  });

  it('needs a group to ungroup', () => {
    expect(actionById('object.ungroup')?.enabled(context({ selectionCount: 1 }))).toBe(false);
    expect(
      actionById('object.ungroup')?.enabled(context({ selectionCount: 1, hasGroupSelected: true })),
    ).toBe(true);
  });
});

describe('shortcutLabel', () => {
  it('writes the shortcut the way a menu shows it', () => {
    expect(shortcutLabel({ key: 's', meta: true })).toBe('Ctrl+S');
    expect(shortcutLabel({ key: 'g', meta: true, shift: true })).toBe('Ctrl+Shift+G');
    expect(shortcutLabel({ key: 'Delete' })).toBe('Delete');
  });

  it('is empty for an action with no shortcut', () => {
    expect(shortcutLabel(undefined)).toBe('');
  });

  it('is the only source of shortcut text, so a tooltip cannot drift', () => {
    // The file buttons used to hard-code "(Ctrl+O)" next to a handler that
    // independently implemented the key.
    expect(shortcutLabel(actionById('file.open')?.shortcut)).toBe('Ctrl+O');
    expect(shortcutLabel(actionById('file.save')?.shortcut)).toBe('Ctrl+S');
  });
});

describe('disabledReason', () => {
  it('explains a greyed-out control instead of leaving an author guessing', () => {
    const distribute = actionById('arrange.distribute-x')!;

    expect(disabledReason(distribute, context({ selectionCount: 2 }))).toBe(
      'Needs three or more elements',
    );
  });

  it('is undefined when the action is available', () => {
    const save = actionById('file.save')!;

    expect(disabledReason(save, nothing)).toBeUndefined();
  });
});

describe('actionsInGroup', () => {
  it('keeps the eight arrange actions together and in order', () => {
    expect(actionsInGroup('arrange').map((action) => action.id)).toEqual([
      'arrange.align-left',
      'arrange.align-centre',
      'arrange.align-right',
      'arrange.align-top',
      'arrange.align-middle',
      'arrange.align-bottom',
      'arrange.distribute-x',
      'arrange.distribute-y',
    ]);
  });

  it('keeps keyboard-only actions out of the menu groups', () => {
    for (const group of ['file', 'edit', 'object', 'arrange'] as const) {
      for (const action of actionsInGroup(group)) {
        expect(action.id.startsWith('navigate.')).toBe(false);
      }
    }
  });
});
