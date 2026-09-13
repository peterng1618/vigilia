/**
 * What a keystroke is allowed to mean, given what has focus.
 *
 * The editor binds its shortcuts on `window`, because an author expects
 * Backspace to delete the selection wherever the canvas has focus — not only
 * when some particular element does. The cost is that the handler also sees
 * every keystroke typed into an inspector field, and without a guard Backspace
 * deletes the *selected element* instead of a character, arrows nudge it
 * instead of moving the caret, and Ctrl+Z undoes the document instead of the
 * edit in progress.
 *
 * Kept pure and structural — a probe of three fields rather than an
 * `HTMLElement` — so every control type is testable in Node. The DOM layer
 * reads the three fields off the event target and decides nothing.
 *
 * ## Why file shortcuts survive typing
 *
 * Ctrl+S and Ctrl+O are document-level intents that mean the same thing
 * wherever focus sits, and the browser's defaults for them ("save this page",
 * "open a file into this tab") are actively wrong in an editor. Standing down
 * for those would not restore a useful behaviour, it would surface a confusing
 * one. Everything that manipulates the selection or the elements does stand
 * down, because there the focused control's own behaviour is what the author
 * meant.
 */

/**
 * The fields of an event target that decide whether it consumes keystrokes.
 *
 * `tagName` is upper-case as the DOM reports it. `type` is the *attribute*
 * rather than the property, so an `<input>` with no `type` arrives as
 * `undefined` and is treated as the text field it renders as.
 */
export interface KeyboardTarget {
  readonly tagName?: string | undefined;
  readonly type?: string | undefined;
  readonly isContentEditable?: boolean | undefined;
}

/**
 * `<input type>` values that do not consume the keys this editor binds.
 *
 * These react to Space and to clicks, neither of which is bound here, so an
 * author who has just ticked a checkbox in the inspector can still press
 * Delete and have it mean "delete the selection". Every other type — the text
 * family, `number`, `range`, and the date/time family — either accepts typing
 * or changes value on the arrow keys, so it keeps them.
 */
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

/**
 * Whether this target handles keystrokes itself.
 *
 * True for `<textarea>`, anything `contenteditable`, `<select>` (the arrow keys
 * change its value) and every `<input>` outside {@link INERT_INPUT_TYPES}.
 */
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
      // An absent type attribute renders as a text field, so absent must not
      // fall through to "inert".
      return !INERT_INPUT_TYPES.has((target.type ?? 'text').toLowerCase());
    default:
      return false;
  }
}

/**
 * Whether a shortcut still applies while a keyboard-consuming control has
 * focus. See the module note: the file shortcuts do, nothing else does.
 */
export function survivesTextEntry(key: string, meta: boolean): boolean {
  if (!meta) {
    return false;
  }

  const lower = key.toLowerCase();

  return lower === 's' || lower === 'o';
}

/**
 * The single question the DOM handler asks: should this keystroke be left to
 * whatever has focus?
 */
export function deferToTarget(
  target: KeyboardTarget | null | undefined,
  key: string,
  meta: boolean,
): boolean {
  return isKeyboardConsumingTarget(target) && !survivesTextEntry(key, meta);
}
