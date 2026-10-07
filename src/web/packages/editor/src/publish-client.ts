import type { FabricThemeEnvelopeInput } from "@vigilia/renderer-core";

/**
 * Pushes the document being edited to the host, at most once per burst.
 *
 * One owner for the rate limit and one for the transport, because a save is
 * explicit and a publish is continuous: the editor must not write a theme
 * folder every time a shape moves, and it must not send a document the author
 * has already moved past. The debounce *is* the rate limit — there is no second
 * timer, and no queue: a publish that is superseded is dropped, not replayed.
 */
const DEFAULT_DEBOUNCE_MS = 400;

export interface Publisher {
  offer(document: {
    readonly id: string;
    readonly envelope: FabricThemeEnvelopeInput;
  }): void;
  stop(): Promise<void>;
}

/**
 * The transport as the publish surface's switch sees it: the surface decides
 * whether publishing is on, and `editor-main` decides what that means, so the
 * switch never has to hold a document to turn publishing off.
 */
export interface PublishSwitch {
  /** Follows the document from here, starting with the one open now. */
  start(): void;
  /** Stops, and tells the host to go back to the stored theme. */
  stop(): Promise<void>;
}

export function createPublisher(
  options: {
    readonly debounceMs?: number;
    readonly onError?: (message: string) => void;
  } = {},
): Publisher {
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending:
    | { readonly id: string; readonly envelope: FabricThemeEnvelopeInput }
    | undefined;
  let live = false;

  const send = async (): Promise<void> => {
    timer = undefined;
    const next = pending;
    pending = undefined;
    if (next === undefined) return;

    try {
      const response = await fetch(
        `/api/publish?id=${encodeURIComponent(next.id)}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ envelope: next.envelope, assets: {} }),
        },
      );
      if (!response.ok) {
        live = false;
        options.onError?.((await response.text()).trim());
        return;
      }
      live = true;
    } catch (error) {
      live = false;
      options.onError?.(error instanceof Error ? error.message : String(error));
    }
  };

  return {
    offer(document) {
      pending = document;
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => void send(), debounceMs);
    },

    async stop() {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      pending = undefined;
      // A stop with nothing published is nothing to tell the host about, which
      // is what keeps a document the library does not hold from sending a
      // DELETE on every edit.
      if (!live) return;
      live = false;

      try {
        // `keepalive`, because the caller that matters is `pagehide`: an editor
        // being closed has to get this out over a document that is going away.
        await fetch("/api/publish", { method: "DELETE", keepalive: true });
      } catch {
        // The host holds it in memory and its own lifetime ends with the
        // process; a stop that cannot be delivered is not work lost.
      }
    },
  };
}
