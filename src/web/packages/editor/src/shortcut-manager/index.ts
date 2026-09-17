import { actionForShortcut, type ActionId } from '../actions.js';
import { deferToTarget } from '../keyboard.js';

export type ShortcutHandler = () => void;

/** The sole window-level dispatcher for Vigilia product actions above the fork. */
export class ShortcutManager {
  readonly #handlers = new Map<ActionId, ShortcutHandler>();
  readonly #onKeyDown = (event: KeyboardEvent): void => {
    const action = actionForShortcut({
      key: event.key,
      meta: event.ctrlKey || event.metaKey,
      shift: event.shiftKey,
    });
    const handler = action === undefined ? undefined : this.#handlers.get(action.id);

    const target = event.target;
    const deferred = target instanceof HTMLElement && deferToTarget(
      { tagName: target.tagName, type: target.getAttribute('type') ?? undefined, isContentEditable: target.isContentEditable },
      event.key,
      event.ctrlKey || event.metaKey,
    );

    if (handler === undefined || deferred) {
      return;
    }

    event.preventDefault();
    handler();
  };

  constructor() {
    window.addEventListener('keydown', this.#onKeyDown);
  }

  register(action: ActionId, handler: ShortcutHandler): void {
    this.#handlers.set(action, handler);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.#onKeyDown);
    this.#handlers.clear();
  }
}
