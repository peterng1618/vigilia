/** Canonical action ids, labels, shortcuts and enablement for every editor surface. */

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
  | 'layer.reorder-front'
  | 'layer.reorder-back'
  | 'layer.reorder-forward'
  | 'layer.reorder-backward'
  | 'layer.toggle-visibility'
  | 'layer.toggle-lock'
  | 'navigate.escape'
  | 'navigate.nudge-left'
  | 'navigate.nudge-right'
  | 'navigate.nudge-up'
  | 'navigate.nudge-down'
  | 'navigate.nudge-left-large'
  | 'navigate.nudge-right-large'
  | 'navigate.nudge-up-large'
  | 'navigate.nudge-down-large';

/** `navigate` actions are keyboard-only; surfaces choose which groups they render. */
export type ActionGroup = 'file' | 'edit' | 'object' | 'arrange' | 'layer' | 'navigate';

export interface ActionShortcut {
  readonly key: string;
  /** Ctrl on Windows/Linux, Cmd on macOS. Omitted means not held. */
  readonly meta?: boolean;
  /** Omitted means don't care; specified means exact match. */
  readonly shift?: boolean;
}

/** Minimal pure state needed to compute enablement. */
export interface ActionContext {
  readonly selectionCount: number;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly hasGroupSelected: boolean;
  readonly allSelectedLocked: boolean;
}

export interface EditorActionSpec {
  readonly id: ActionId;
  readonly label: string;
  readonly group: ActionGroup;
  readonly shortcut?: ActionShortcut;
  readonly glyph?: string;
  readonly requires?: string;
  readonly enabled: (context: ActionContext) => boolean;
}

const always = (): boolean => true;
const atLeast =
  (n: number) =>
  (context: ActionContext): boolean =>
    context.selectionCount >= n;

/** Menu declaration order. */
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
    id: 'layer.reorder-front',
    label: 'Bring to front',
    group: 'layer',
    shortcut: { key: ']', meta: true, shift: true },
    requires: 'one selected element',
    enabled: (context) => context.selectionCount === 1,
  },
  {
    id: 'layer.reorder-forward',
    label: 'Bring forward',
    group: 'layer',
    shortcut: { key: ']', meta: true, shift: false },
    requires: 'one selected element',
    enabled: (context) => context.selectionCount === 1,
  },
  {
    id: 'layer.reorder-backward',
    label: 'Send backward',
    group: 'layer',
    shortcut: { key: '[', meta: true, shift: false },
    requires: 'one selected element',
    enabled: (context) => context.selectionCount === 1,
  },
  {
    id: 'layer.reorder-back',
    label: 'Send to back',
    group: 'layer',
    shortcut: { key: '[', meta: true, shift: true },
    requires: 'one selected element',
    enabled: (context) => context.selectionCount === 1,
  },
  {
    id: 'layer.toggle-visibility',
    label: 'Toggle visibility',
    group: 'layer',
    requires: 'one selected element',
    enabled: (context) => context.selectionCount === 1,
  },
  {
    id: 'layer.toggle-lock',
    label: 'Toggle lock',
    group: 'layer',
    requires: 'one selected element',
    enabled: (context) => context.selectionCount === 1,
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

/** Generate the eight arrow-key nudge actions from direction + step. */
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

export function actionsInGroup(group: ActionGroup): readonly EditorActionSpec[] {
  return ACTIONS.filter((action) => action.group === group);
}

export interface KeyStroke {
  readonly key: string;
  readonly meta: boolean;
  readonly shift: boolean;
}

function matches(shortcut: ActionShortcut, stroke: KeyStroke): boolean {
  if (shortcut.key.toLowerCase() !== stroke.key.toLowerCase()) {
    return false;
  }

  if ((shortcut.meta ?? false) !== stroke.meta) {
    return false;
  }

  return shortcut.shift === undefined || shortcut.shift === stroke.shift;
}

/** Return the bound action even when disabled; caller owns disabled behavior. */
export function actionForShortcut(stroke: KeyStroke): EditorActionSpec | undefined {
  // Ctrl+Y is the alternate redo binding; the declaration keeps one canonical label.
  if (stroke.meta && stroke.key.toLowerCase() === 'y') {
    return BY_ID.get('edit.redo');
  }

  return ACTIONS.find(
    (action) => action.shortcut !== undefined && matches(action.shortcut, stroke),
  );
}

/** Canonical human-readable shortcut label. */
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

  parts.push(shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key);

  return parts.join('+');
}

export function disabledReason(
  action: EditorActionSpec,
  context: ActionContext,
): string | undefined {
  if (action.enabled(context)) {
    return undefined;
  }

  return action.requires === undefined ? 'Unavailable' : `Needs ${action.requires}`;
}
