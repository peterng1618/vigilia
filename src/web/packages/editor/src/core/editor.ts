import { EditorEmitter } from './events.js';
import type { EditorManager } from './manager.js';
import type { EditorOptions } from './options.js';
import { MANAGER_REGISTRATIONS, type ManagerKey, type ManagerTypes } from './registrations.js';

/** Composition root. Managers reach peers through `editor`, not direct class imports. */

/** Typed manager fields derived from the registration table. */
export interface EditorCore extends ManagerTypes {}

export class EditorCore {
  /** Shared typed event bus. */
  public readonly events = new EditorEmitter();

  public readonly options: EditorOptions;

  /** Managers constructed so far, in construction order. */
  readonly #built: ManagerKey[] = [];

  #destroyed = false;

  constructor(options: EditorOptions) {
    this.options = options;
    this.#init();
  }

  /** Whether {@link destroy} has run. */
  public get destroyed(): boolean {
    return this.#destroyed;
  }

  /** Destroys managers in reverse construction order. Idempotent. */
  public destroy(): void {
    if (this.#destroyed) {
      return;
    }

    this.#destroyed = true;

    for (const key of [...this.#built].reverse()) {
      this.#managerAt(key).destroy();
    }

    this.#built.length = 0;
    this.events.clear();
  }

  #init(): void {
    for (const registration of MANAGER_REGISTRATIONS) {
      try {
        // ManagerTypes guarantees the key/type pairing; only dynamic assignment needs a cast.
        (this as unknown as Record<string, unknown>)[registration.key] = registration.create(this);
      } catch (cause) {
        // Unwind only what successfully started.
        this.destroy();

        throw new Error(`Editor manager "${registration.key}" failed to start.`, { cause });
      }

      this.#built.push(registration.key);
    }
  }

  #managerAt(key: ManagerKey): EditorManager {
    return (this as unknown as Record<ManagerKey, EditorManager>)[key];
  }
}
