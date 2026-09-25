export type ShortcutHandler = () => void;
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
  | "edit.ungroup";

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
  { key: "delete", modifier: false, action: "edit.delete" },
  { key: "backspace", modifier: false, action: "edit.delete" },
];

/** Shift-qualified bindings precede their plain form, so first match wins. */
function bindingFor(event: KeyboardEvent): ShortcutBinding | undefined {
  const key = event.key.toLowerCase();
  const modifier = event.ctrlKey || event.metaKey;
  return PRODUCT_SHORTCUTS.find(
    (binding) =>
      binding.key === key &&
      binding.modifier === modifier &&
      (binding.shift === undefined || binding.shift === event.shiftKey),
  );
}

/** Actions that defer to a focused text field's own key handling (e.g. Fabric's hidden textarea while editing). */
const TEXT_ENTRY_DEFERRED_ACTIONS: ReadonlySet<ProductShortcutId> = new Set([
  "file.new",
  "edit.undo",
  "edit.redo",
]);

/** The sole window-level dispatcher for Vigilia product actions above the canvas's own key handling. */
export class ShortcutManager {
  readonly #handlers = new Map<ProductShortcutId, ShortcutHandler>();
  readonly #onKeyDown = (event: KeyboardEvent): void => {
    const binding = bindingFor(event);
    const handler =
      binding === undefined ? undefined : this.#handlers.get(binding.action);

    const deferred =
      binding !== undefined &&
      (!binding.modifier || TEXT_ENTRY_DEFERRED_ACTIONS.has(binding.action)) &&
      isTextEntryTarget(event.target);

    if (handler === undefined || deferred) {
      return;
    }

    event.preventDefault();
    handler();
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
