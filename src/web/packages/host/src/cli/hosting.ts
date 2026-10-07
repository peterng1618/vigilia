import type http from "node:http";
import type { HostingState } from "../server.js";
import { isLoopbackHost } from "./args.js";
import { lanAddress } from "./net.js";

/**
 * The one listener, and the two addresses it can be told to sit on.
 *
 * Moving it is a rebind rather than a second socket, because two servers cannot
 * share a port — `0.0.0.0` already includes `127.0.0.1` — and because §145 wants
 * one exposed thing, not two.
 *
 * **The port never moves.** `listenWithFallback` is right at startup and wrong
 * here: a rebind that landed on the next free port would change the editor's own
 * origin under the page that asked for it, and every display's URL with it. So a
 * refused interface is answered with a reason and the old binding is restored.
 */

export interface HostBinding {
  /** The state the host reports to the editor: what it is bound to now. */
  readonly state: () => HostingState;
  /** Rebinds on the same port. Resolves false, with a reason, when the new
   *  interface will not take that port — the old binding is restored.
   *
   *  **Call it only once the answer that asked for the move is on the wire.**
   *  One server cannot rebind while the response that asked it to rebind is on
   *  its socket: `close()` waits for that connection, and that connection
   *  waits for the response. */
  setLan(
    on: boolean,
  ): Promise<
    { readonly ok: true } | { readonly ok: false; readonly reason: string }
  >;
  /** Resolves when no move is in flight, so a reader that follows a move sees
   *  where it landed rather than where it started. */
  idle(): Promise<void>;
}

export function createHostBinding(
  server: http.Server,
  initial: { readonly port: number; readonly host: string },
): HostBinding {
  const port = initial.port;
  let host = initial.host;
  /** The last move this binding refused, in its own words. A refusal cannot
   *  ride the answer that asked for the move — see `setLan` — so it is state
   *  the next read carries, cleared by the next move that lands. */
  let refusal: string | null = null;
  let moving: Promise<void> = Promise.resolve();

  const state = (): HostingState => ({
    lan: !isLoopbackHost(host),
    address: isLoopbackHost(host) ? null : (lanAddress() ?? null),
    port,
    refusal,
  });

  const bind = (next: string): Promise<void> =>
    new Promise((resolve, reject) => {
      const onError = (error: Error): void => {
        server.removeListener("listening", onListening);
        reject(error);
      };
      const onListening = (): void => {
        server.removeListener("error", onError);
        resolve();
      };

      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(port, next);
    });

  async function move(
    next: string,
  ): Promise<
    { readonly ok: true } | { readonly ok: false; readonly reason: string }
  > {
    // Whatever is left is this server's **idle** keep-alive sockets, and that
    // includes the one the answer that asked for this move went out on.
    // `closeAllConnections()` would destroy that one too and take the answer
    // with it, leaving the asker with an empty reply — `vg-173`. Streams a
    // display is holding are the host's to close, and it closes them before
    // calling in: a stream that is still open is not idle.
    server.closeIdleConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));

    try {
      await bind(next);
      host = next;
      refusal = null;
      return { ok: true };
    } catch (error) {
      // Put it back where it was, so a refusal is not also an outage.
      await bind(host);
      refusal = `Port ${port} is not free on ${next}: ${
        error instanceof Error ? error.message : String(error)
      }`;
      return { ok: false, reason: refusal };
    }
  }

  return {
    state,

    idle: () => moving,

    setLan(on) {
      const next = on ? "0.0.0.0" : "127.0.0.1";
      if (next === host) return Promise.resolve({ ok: true });

      // `moving` is assigned in this tick, before the move's first await, so a
      // reader that arrives while the socket sits between bindings still waits
      // rather than reading the binding that is on its way out.
      const started = move(next);
      moving = started.then(
        () => undefined,
        () => undefined,
      );
      return started;
    },
  };
}
