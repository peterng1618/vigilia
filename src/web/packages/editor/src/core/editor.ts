import { EditorEmitter } from './events.js';
import type { EditorManager } from './manager.js';
import type { EditorOptions } from './options.js';
import { MANAGER_REGISTRATIONS, type ManagerKey, type ManagerTypes } from './registrations.js';

/**
 * The composition root.
 *
 * ## What it is
 *
 * One object holding every manager as a typed field, plus the event emitter
 * they publish through. It is also the service locator: a manager reaches a
 * peer as `this.editor.document`, never by importing the peer's class. That
 * single indirection is what keeps the manager graph acyclic at runtime while
 * still letting any manager use any other.
 *
 * The rule that makes it work: **peers at runtime, types at compile time.** A
 * manager imports `EditorCore` with `import type` and reads peers off it. A
 * manager that imports another manager's class has created a cycle that the
 * next refactor pays for.
 *
 * ## What it is not
 *
 * Not a place to put behaviour. Every method here is about building and
 * unbuilding; if logic starts accumulating on the root, it belongs in whatever
 * manager the logic is about, or in a new one.
 */

/**
 * Typed manager fields, merged in from the registration table.
 *
 * Declaration merging rather than written-out fields, so the list of managers
 * exists in exactly one place. See `registrations.ts`.
 */
export interface EditorCore extends ManagerTypes {}

export class EditorCore {
  /** What managers publish through, and what surfaces subscribe to. */
  public readonly events = new EditorEmitter();

  public readonly options: EditorOptions;

  /**
   * Managers actually constructed, in construction order.
   *
   * Tracked rather than assumed, because teardown after a failed `init()` must
   * only take apart what was built — calling `destroy()` on a field that was
   * never assigned is how a real failure gets replaced by a confusing one.
   */
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

  /**
   * Takes the editor apart, in the reverse of construction order.
   *
   * Reverse because a manager may have used one built before it, and taking
   * the foundation away first is how teardown produces errors that look like
   * bugs in whatever ran last. Idempotent: calling it twice is not an error.
   */
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
        // The one cast in this file, and the reason it is contained here: a
        // table keyed by string has to meet fields the compiler knows by name.
        // `ManagerTypes` guarantees the pairing is right; only the assignment
        // itself is unprovable to TypeScript.
        (this as unknown as Record<string, unknown>)[registration.key] = registration.create(this);
      } catch (cause) {
        // Unwind what exists before rethrowing. A half-built editor that keeps
        // its listeners attached is worse than one that failed cleanly.
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
