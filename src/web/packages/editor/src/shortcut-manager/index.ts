export type ShortcutHandler = () => void;
export type ProductShortcutId = 'file.new' | 'file.open' | 'file.save';

const FILE_SHORTCUTS: Readonly<Record<string, ProductShortcutId>> = {
  n: 'file.new',
  o: 'file.open',
  s: 'file.save',
};

/** The sole window-level dispatcher for Vigilia product actions above the fork. */
export class ShortcutManager {
  readonly #handlers = new Map<ProductShortcutId, ShortcutHandler>();
  readonly #onKeyDown = (event: KeyboardEvent): void => {
    const action = event.ctrlKey || event.metaKey
      ? FILE_SHORTCUTS[event.key.toLowerCase()]
      : undefined;
    const handler = action === undefined ? undefined : this.#handlers.get(action);

    const target = event.target;
    const deferred = action === 'file.new' && isTextEntryTarget(target);

    if (handler === undefined || deferred) {
      return;
    }

    event.preventDefault();
    handler();
  };

  constructor() {
    window.addEventListener('keydown', this.#onKeyDown);
  }

  register(action: ProductShortcutId, handler: ShortcutHandler): void {
    this.#handlers.set(action, handler);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.#onKeyDown);
    this.#handlers.clear();
  }
}

/** Save/Open deliberately override text-entry defaults; New does not. */
function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  return target instanceof HTMLInputElement && !new Set([
    'button', 'checkbox', 'color', 'file', 'image', 'radio', 'reset', 'submit',
  ]).has(target.type.toLowerCase());
}
