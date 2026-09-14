/**
 * The editor's event contract.
 *
 * ## Why a map rather than callbacks
 *
 * Before this, every state change in the editor was followed by a hand-placed
 * `render()` — around twenty-five call sites, each one a chance to forget.
 * Correctness depended on every future mutation remembering to redraw, which is
 * the kind of rule that holds until someone adds the twenty-sixth.
 *
 * A manager emits what changed; a surface subscribes to what it draws. The
 * redraw then happens because something it depends on moved, not because a
 * caller remembered.
 *
 * ## This map only grows when a subscriber exists
 *
 * An event nobody listens to is the same defect as an owner nobody imports —
 * it reads as wiring while doing nothing, and drifts from what actually
 * happens. So events are added here **in the commit that adds their first
 * subscriber**, not in advance of one. That is why this map is currently short
 * while the editor is plainly doing more than one thing: the rest of the
 * redraws are still explicit, and become events as their panels move behind
 * managers.
 */

/** Every event the editor emits, and what it carries. */
export interface EditorEventMap {
  /**
   * The status bar's one-off message changed — set, replaced or cleared.
   *
   * Carries the message so a subscriber does not have to reach back into the
   * manager to find out what it now is.
   */
  'notice:changed': { readonly message: string | undefined };
}

export type EditorEventName = keyof EditorEventMap;

export type EditorEventHandler<K extends EditorEventName> = (
  payload: EditorEventMap[K],
) => void;

/** Removes the subscription it came from. Calling it twice is harmless. */
export type Unsubscribe = () => void;

/**
 * A typed publish/subscribe point, owned by {@link EditorCore}.
 *
 * Small on purpose: no wildcards, no priorities, no async. Every one of those
 * makes "what happens when I emit this" impossible to answer by reading, and
 * none of them has a use here.
 */
export class EditorEmitter {
  /**
   * Handlers per event name.
   *
   * The value type is erased because a `Map` cannot express "the handlers under
   * key K take `EditorEventMap[K]`". The two casts below are the price, and
   * they are contained here: every public method is typed, so no caller can
   * subscribe a handler to the wrong payload.
   */
  readonly #handlers = new Map<EditorEventName, Set<(payload: never) => void>>();

  /** Subscribes, and returns the matching unsubscribe. */
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

  /**
   * Notifies every subscriber, in subscription order.
   *
   * Iterates a copy, so a handler that unsubscribes itself — or subscribes
   * something new — does not mutate the set being walked. Without this, the
   * common "listen once" idiom skips whichever handler happened to follow it.
   */
  public emit<K extends EditorEventName>(name: K, payload: EditorEventMap[K]): void {
    const handlers = this.#handlers.get(name);

    if (handlers === undefined) {
      return;
    }

    for (const handler of [...handlers]) {
      (handler as EditorEventHandler<K>)(payload);
    }
  }

  /** Drops every subscription. Called when the editor is torn down. */
  public clear(): void {
    this.#handlers.clear();
  }

  /** How many handlers are listening for `name`. For tests and leak checks. */
  public listenerCount(name: EditorEventName): number {
    return this.#handlers.get(name)?.size ?? 0;
  }
}
