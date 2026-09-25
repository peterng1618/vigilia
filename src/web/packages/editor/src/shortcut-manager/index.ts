export type ShortcutHandler = (event: KeyboardEvent) => void;
export type ProductShortcutId =
  | "file.new"
  | "file.open"
  | "file.save"
  | "edit.undo"
  | "edit.redo"
  | "edit.delete"
  | "edit.copy"
  | "edit.cut"
  | "edit.duplicate"
  | "edit.group"
  | "edit.ungroup"
  | "canvas.nudge-left"
  | "canvas.nudge-right"
  | "canvas.nudge-up"
  | "canvas.nudge-down"
  | "canvas.select-all"
  | "canvas.front"
  | "canvas.back"
  | "view.exit-group";

interface ShortcutBinding {
  readonly key: string;
  /** A binding with no modifier always defers to a focused text field. */
  readonly modifier: boolean;
  readonly shift?: boolean;
  readonly action: ProductShortcutId;
}

const PRODUCT_SHORTCUTS: readonly ShortcutBinding[] = [
  { key: "n", modifier: true, action: "file.new" },
  { key: "o", modifier: true, action: "file.open" },
  { key: "s", modifier: true, action: "file.save" },
  { key: "z", modifier: true, action: "edit.undo" },
  { key: "y", modifier: true, action: "edit.redo" },
  { key: "c", modifier: true, action: "edit.copy" },
  { key: "x", modifier: true, action: "edit.cut" },
  { key: "d", modifier: true, action: "edit.duplicate" },
  { key: "g", modifier: true, shift: true, action: "edit.ungroup" },
  { key: "g", modifier: true, action: "edit.group" },
  { key: "a", modifier: true, action: "canvas.select-all" },
  { key: "]", modifier: true, action: "canvas.front" },
  { key: "[", modifier: true, action: "canvas.back" },
  { key: "delete", modifier: false, action: "edit.delete" },
  { key: "backspace", modifier: false, action: "edit.delete" },
  // No `shift` field: `bindingFor` matches when `binding.shift === undefined`, so
  // one binding covers both the plain and the Shift-qualified press. The handler
  // reads `event.shiftKey` and picks the step.
  { key: "arrowleft", modifier: false, action: "canvas.nudge-left" },
  { key: "arrowright", modifier: false, action: "canvas.nudge-right" },
  { key: "arrowup", modifier: false, action: "canvas.nudge-up" },
  { key: "arrowdown", modifier: false, action: "canvas.nudge-down" },
];

/** Context-only bindings: dispatched here but never displayed by a menu or
 * tooltip, so they stay off `PRODUCT_SHORTCUTS`. */
const CONTEXT_SHORTCUTS: readonly ShortcutBinding[] = [
  { key: "escape", modifier: false, action: "view.exit-group" },
];

/** Shift-qualified bindings precede their plain form, so first match wins. */
function bindingFor(event: KeyboardEvent): ShortcutBinding | undefined {
  const key = event.key.toLowerCase();
  const modifier = event.ctrlKey || event.metaKey;
  return [...PRODUCT_SHORTCUTS, ...CONTEXT_SHORTCUTS].find(
    (binding) =>
      binding.key === key &&
      binding.modifier === modifier &&
      (binding.shift === undefined || binding.shift === event.shiftKey),
  );
}

/** The action ids a *modifier* binding must be in to defer to a focused text
 * field's own key handling. Unmodified bindings defer unconditionally, so they
 * need no entry here. `canvas.select-all` is in this set because Ctrl+A inside a
 * rename field is the field's own select-all, not the canvas's. */
const MODIFIED_KEY_DEFERRED_ACTION_IDS: ReadonlySet<ProductShortcutId> =
  new Set(["file.new", "edit.undo", "edit.redo", "canvas.select-all"]);

/** The sole window-level dispatcher for Vigilia product actions above the canvas's own key handling. */
export class ShortcutManager {
  readonly #handlers = new Map<ProductShortcutId, ShortcutHandler>();
  readonly #onKeyDown = (event: KeyboardEvent): void => {
    const binding = bindingFor(event);
    const handler =
      binding === undefined ? undefined : this.#handlers.get(binding.action);

    const deferred =
      binding !== undefined &&
      (!binding.modifier ||
        MODIFIED_KEY_DEFERRED_ACTION_IDS.has(binding.action)) &&
      isTextEntryTarget(event.target);

    if (handler === undefined || deferred) {
      return;
    }

    event.preventDefault();
    handler(event);
  };

  constructor() {
    window.addEventListener("keydown", this.#onKeyDown);
  }

  register(action: ProductShortcutId, handler: ShortcutHandler): void {
    this.#handlers.set(action, handler);
  }

  destroy(): void {
    window.removeEventListener("keydown", this.#onKeyDown);
    this.#handlers.clear();
  }
}

/** Save/Open deliberately override text-entry defaults; New does not.
 * Bare-key canvas listeners (camera keys) defer through this same predicate. */
export function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
    return true;
  return (
    target instanceof HTMLInputElement &&
    !new Set([
      "button",
      "checkbox",
      "color",
      "file",
      "image",
      "radio",
      "reset",
      "submit",
    ]).has(target.type.toLowerCase())
  );
}
