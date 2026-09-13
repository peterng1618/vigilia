/**
 * Every editor action, declared once.
 *
 * ## Why this exists
 *
 * The editor grew four ways to invoke the same work — a keyboard handler, a
 * file toolbar, an arrange toolbar, and soon a menu bar and a layer panel —
 * and each one carried its own copy of an action's label, its shortcut and its
 * enablement rule. That duplication had already produced bugs rather than
 * merely threatening to:
 *
 * - The Open and Save buttons hard-coded "(Ctrl+O)" and "(Ctrl+S)" into their
 *   tooltips while the keyboard handler independently implemented those keys.
 *   Two declarations, no compiler relating them.
 * - Enablement was computed by querying the DOM for buttons and inferring the
 *   rule from the button's own id (`startsWith('distribute')` means it needs
 *   three). A selector that was one word too broad disabled Open and Save
 *   until two nodes were selected, and two browser tests timed out on it. The
 *   fix at the time was to narrow the selector; the cause was that the rule
 *   lived in the view.
 *
 * So: **this module declares what an action is, and nothing about how it is
 * invoked.** Labels, shortcuts and enablement come from here, which is what
 * makes a second surface free rather than another copy. The imperative body
 * stays in `main.ts`, where the mutable editor state lives — one body per id,
 * reached through one dispatch.
 *
 * It follows the same split as the rest: this file decides, the DOM layer
 * draws. {@link actionForShortcut} turns a keystroke into an id by lookup
 * rather than a chain of `if`s, so "which key does what" is a table a test can
 * read.
 */

/** Stable identifiers. Used as dispatch keys, so they are exhaustive by type. */
export type ActionId =
  | 'file.open'
  | 'file.save'
  | 'edit.undo'
  | 'edit.redo'
  | 'edit.delete'
  | 'object.group'
  | 'object.ungroup'
  | 'arrange.align-left'
  | 'arrange.align-centre'
  | 'arrange.align-right'
  | 'arrange.align-top'
  | 'arrange.align-middle'
  | 'arrange.align-bottom'
  | 'arrange.distribute-x'
  | 'arrange.distribute-y'
  | 'navigate.escape'
  | 'navigate.nudge-left'
  | 'navigate.nudge-right'
  | 'navigate.nudge-up'
  | 'navigate.nudge-down'
  | 'navigate.nudge-left-large'
  | 'navigate.nudge-right-large'
  | 'navigate.nudge-up-large'
  | 'navigate.nudge-down-large';

/**
 * Which surface an action belongs to.
 *
 * `navigate` actions are keyboard-only — nudging and Escape are not menu
 * items — and a menu builder shows the groups it wants rather than every
 * action declared here.
 */
export type ActionGroup = 'file' | 'edit' | 'object' | 'arrange' | 'navigate';

export interface ActionShortcut {
  /** As `KeyboardEvent.key`, matched case-insensitively for letters. */
  readonly key: string;
  /** Ctrl on Windows/Linux, Cmd on macOS. Omitted means it must not be held. */
  readonly meta?: boolean;
  /**
   * Omitted means **don't care** — Shift+Delete is still a delete. Specified
   * means it must match exactly, which is what separates Ctrl+Z from
   * Ctrl+Shift+Z and a small nudge from a large one.
   */
  readonly shift?: boolean;
}

/**
 * What enablement is allowed to depend on.
 *
 * A flat snapshot rather than the document, so a rule is a pure function of a
 * few numbers and a test does not need a theme fixture to assert one.
 */
export interface ActionContext {
  readonly selectionCount: number;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Whether any selected node is a group — what ungrouping needs. */
  readonly hasGroupSelected: boolean;
  /** Whether every selected node is locked, which §61 says cannot be edited. */
  readonly allSelectedLocked: boolean;
}

export interface EditorActionSpec {
  readonly id: ActionId;
  /** Menu and tooltip text. Never written twice — see the module note. */
  readonly label: string;
  readonly group: ActionGroup;
  readonly shortcut?: ActionShortcut;
  /** Compact toolbar glyph, where a toolbar shows this action. */
  readonly glyph?: string;
  /** Why it is disabled, shown when it is. */
  readonly requires?: string;
  readonly enabled: (context: ActionContext) => boolean;
}

const always = (): boolean => true;
const atLeast =
  (n: number) =>
  (context: ActionContext): boolean =>
    context.selectionCount >= n;

/** Every action, in the order a menu should list it. */
export const ACTIONS: readonly EditorActionSpec[] = [
  {
    id: 'file.open',
    label: 'Open…',
    group: 'file',
    shortcut: { key: 'o', meta: true },
    enabled: always,
  },
  {
    id: 'file.save',
    label: 'Save',
    group: 'file',
    shortcut: { key: 's', meta: true },
    enabled: always,
  },
  {
    id: 'edit.undo',
    label: 'Undo',
    group: 'edit',
    shortcut: { key: 'z', meta: true, shift: false },
    requires: 'something to undo',
    enabled: (context) => context.canUndo,
  },
  {
    id: 'edit.redo',
    label: 'Redo',
    group: 'edit',
    // Both bindings every tool offers. Ctrl+Y is declared as its own entry
    // below rather than as a second shortcut on this one, because one action
    // with two keys would make the menu label ambiguous.
    shortcut: { key: 'z', meta: true, shift: true },
    requires: 'something to redo',
    enabled: (context) => context.canRedo,
  },
  {
    id: 'edit.delete',
    label: 'Delete',
    group: 'edit',
    shortcut: { key: 'Delete' },
    requires: 'a selection',
    enabled: (context) => context.selectionCount > 0 && !context.allSelectedLocked,
  },
  {
    id: 'object.group',
    label: 'Group',
    group: 'object',
    shortcut: { key: 'g', meta: true, shift: false },
    requires: 'two or more elements',
    enabled: atLeast(2),
  },
  {
    id: 'object.ungroup',
    label: 'Ungroup',
    group: 'object',
    shortcut: { key: 'g', meta: true, shift: true },
    requires: 'a selected group',
    enabled: (context) => context.hasGroupSelected,
  },
  // Align needs two nodes, distribute needs three — the rule that used to be
  // inferred from a button's id.
  {
    id: 'arrange.align-left',
    label: 'Align left',
    group: 'arrange',
    glyph: '⇤',
    requires: 'two or more elements',
    enabled: atLeast(2),
  },
  {
    id: 'arrange.align-centre',
    label: 'Align centre',
    group: 'arrange',
    glyph: '⇔',
    requires: 'two or more elements',
    enabled: atLeast(2),
  },
  {
    id: 'arrange.align-right',
    label: 'Align right',
    group: 'arrange',
    glyph: '⇥',
    requires: 'two or more elements',
    enabled: atLeast(2),
  },
  {
    id: 'arrange.align-top',
    label: 'Align top',
    group: 'arrange',
    glyph: '⇡',
    requires: 'two or more elements',
    enabled: atLeast(2),
  },
  {
    id: 'arrange.align-middle',
    label: 'Align middle',
    group: 'arrange',
    glyph: '⇕',
    requires: 'two or more elements',
    enabled: atLeast(2),
  },
  {
    id: 'arrange.align-bottom',
    label: 'Align bottom',
    group: 'arrange',
    glyph: '⇣',
    requires: 'two or more elements',
    enabled: atLeast(2),
  },
  {
    id: 'arrange.distribute-x',
    label: 'Distribute horizontally',
    group: 'arrange',
    glyph: '⋯',
    requires: 'three or more elements',
    enabled: atLeast(3),
  },
  {
    id: 'arrange.distribute-y',
    label: 'Distribute vertically',
    group: 'arrange',
    glyph: '⋮',
    requires: 'three or more elements',
    enabled: atLeast(3),
  },
  {
    id: 'navigate.escape',
    label: 'Cancel or leave group',
    group: 'navigate',
    shortcut: { key: 'Escape' },
    enabled: always,
  },
  ...nudges(),
];

/**
 * The eight nudges.
 *
 * Generated rather than written out: they differ only by axis and step, and
 * eight hand-written entries is eight chances to bind the wrong arrow.
 */
function nudges(): readonly EditorActionSpec[] {
  const directions = [
    ['left', 'ArrowLeft'],
    ['right', 'ArrowRight'],
    ['up', 'ArrowUp'],
    ['down', 'ArrowDown'],
  ] as const;

  return directions.flatMap(([name, key]) => [
    {
      id: `navigate.nudge-${name}` as ActionId,
      label: `Nudge ${name}`,
      group: 'navigate' as const,
      shortcut: { key, shift: false },
      requires: 'a selection',
      enabled: (context: ActionContext) => context.selectionCount > 0,
    },
    {
      id: `navigate.nudge-${name}-large` as ActionId,
      label: `Nudge ${name} (large step)`,
      group: 'navigate' as const,
      shortcut: { key, shift: true },
      requires: 'a selection',
      enabled: (context: ActionContext) => context.selectionCount > 0,
    },
  ]);
}

const BY_ID = new Map(ACTIONS.map((action) => [action.id, action]));

export function actionById(id: ActionId): EditorActionSpec | undefined {
  return BY_ID.get(id);
}

/** The actions in one group, in declaration order. */
export function actionsInGroup(group: ActionGroup): readonly EditorActionSpec[] {
  return ACTIONS.filter((action) => action.group === group);
}

/** A keystroke, reduced to what matching needs. */
export interface KeyStroke {
  readonly key: string;
  readonly meta: boolean;
  readonly shift: boolean;
}

function matches(shortcut: ActionShortcut, stroke: KeyStroke): boolean {
  if (shortcut.key.toLowerCase() !== stroke.key.toLowerCase()) {
    return false;
  }

  // Omitted meta means the modifier must not be held, so a bare Delete does
  // not also fire on Ctrl+Delete.
  if ((shortcut.meta ?? false) !== stroke.meta) {
    return false;
  }

  // Omitted shift means don't care.
  return shortcut.shift === undefined || shortcut.shift === stroke.shift;
}

/**
 * The action a keystroke invokes, or `undefined` for an unbound key.
 *
 * Returns the action even when it is disabled — the caller decides whether a
 * disabled action beeps, does nothing, or explains itself. Hiding it here
 * would make an unbound key and a currently-unusable one indistinguishable.
 *
 * Ctrl+Y is accepted as a second binding for redo. It is handled here rather
 * than as a declared shortcut so that the menu shows one canonical key per
 * action.
 */
export function actionForShortcut(stroke: KeyStroke): EditorActionSpec | undefined {
  if (stroke.meta && stroke.key.toLowerCase() === 'y') {
    return BY_ID.get('edit.redo');
  }

  return ACTIONS.find(
    (action) => action.shortcut !== undefined && matches(action.shortcut, stroke),
  );
}

/**
 * A shortcut as a human reads it: `Ctrl+Shift+G`.
 *
 * The only place shortcut text is produced, so a menu item and a tooltip can
 * never disagree with the key that is actually bound.
 */
export function shortcutLabel(shortcut: ActionShortcut | undefined): string {
  if (shortcut === undefined) {
    return '';
  }

  const parts: string[] = [];

  if (shortcut.meta === true) {
    parts.push('Ctrl');
  }

  if (shortcut.shift === true) {
    parts.push('Shift');
  }

  // Single letters read as capitals in a menu; named keys keep their own case.
  parts.push(shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key);

  return parts.join('+');
}

/**
 * Why an action is unavailable, or `undefined` when it is available.
 *
 * Lets a surface explain a greyed-out control instead of leaving an author to
 * guess which of selection, lock or history is in the way.
 */
export function disabledReason(
  action: EditorActionSpec,
  context: ActionContext,
): string | undefined {
  if (action.enabled(context)) {
    return undefined;
  }

  return action.requires === undefined ? 'Unavailable' : `Needs ${action.requires}`;
}
