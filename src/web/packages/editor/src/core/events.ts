/** Typed editor events. Add events only when a subscriber exists. */

export interface EditorEventMap {
  /** Status-bar notice changed. */
  'notice:changed': { readonly message: string | undefined };
}

export type EditorEventName = keyof EditorEventMap;

export type EditorEventHandler<K extends EditorEventName> = (
  payload: EditorEventMap[K],
) => void;

/** Removes its subscription. Idempotent. */
export type Unsubscribe = () => void;

/** Minimal synchronous typed event bus. */
export class EditorEmitter {
  // Public methods preserve payload types; storage erases them behind this boundary.
  readonly #handlers = new Map<EditorEventName, Set<(payload: never) => void>>();

  public on<K extends EditorEventName>(name: K, handler: EditorEventHandler<K>): Unsubscribe {
    let handlers = this.#handlers.get(name);

    if (handlers === undefined) {
      handlers = new Set();
      this.#handlers.set(name, handlers);
    }

    handlers.add(handler as (payload: never) => void);

    return () => {
      this.off(name, handler);
    };
  }

  public off<K extends EditorEventName>(name: K, handler: EditorEventHandler<K>): void {
    const handlers = this.#handlers.get(name);

    if (handlers === undefined) {
      return;
    }

    handlers.delete(handler as (payload: never) => void);

    if (handlers.size === 0) {
      this.#handlers.delete(name);
    }
  }

  /** Iterates a copy so handlers may safely subscribe/unsubscribe during emit. */
  public emit<K extends EditorEventName>(name: K, payload: EditorEventMap[K]): void {
    const handlers = this.#handlers.get(name);

    if (handlers === undefined) {
      return;
    }

    for (const handler of [...handlers]) {
      (handler as EditorEventHandler<K>)(payload);
    }
  }

  public clear(): void {
    this.#handlers.clear();
  }

  /** For tests and leak checks. */
  public listenerCount(name: EditorEventName): number {
    return this.#handlers.get(name)?.size ?? 0;
  }
}
