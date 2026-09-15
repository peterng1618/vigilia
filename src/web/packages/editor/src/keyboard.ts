/** Focus guard for window-level editor shortcuts. */

export interface KeyboardTarget {
  readonly tagName?: string | undefined;
  readonly type?: string | undefined;
  readonly isContentEditable?: boolean | undefined;
}

/** Input types that do not consume the editor's bound keys. */
const INERT_INPUT_TYPES = new Set([
  'checkbox',
  'radio',
  'button',
  'submit',
  'reset',
  'file',
  'color',
  'image',
]);

export function isKeyboardConsumingTarget(
  target: KeyboardTarget | null | undefined,
): boolean {
  if (target === null || target === undefined) {
    return false;
  }

  if (target.isContentEditable === true) {
    return true;
  }

  switch (target.tagName) {
    case 'TEXTAREA':
    case 'SELECT':
      return true;
    case 'INPUT':
      // Missing type renders as text.
      return !INERT_INPUT_TYPES.has((target.type ?? 'text').toLowerCase());
    default:
      return false;
  }
}

/** File shortcuts override browser defaults even while a text control has focus. */
export function survivesTextEntry(key: string, meta: boolean): boolean {
  if (!meta) {
    return false;
  }

  const lower = key.toLowerCase();

  return lower === 's' || lower === 'o';
}

export function deferToTarget(
  target: KeyboardTarget | null | undefined,
  key: string,
  meta: boolean,
): boolean {
  return isKeyboardConsumingTarget(target) && !survivesTextEntry(key, meta);
}
