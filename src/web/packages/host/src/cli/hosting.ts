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
   *  interface will not take that port — the old binding is restored. */
  setLan(
    on: boolean,
  ): Promise<
    { readonly ok: true } | { readonly ok: false; readonly reason: string }
  >;
}

export function createHostBinding(
  server: http.Server,
  initial: { readonly port: number; readonly host: string },
): HostBinding {
  const port = initial.port;
  let host = initial.host;

  const state = (): HostingState => ({
    lan: !isLoopbackHost(host),
    address: isLoopbackHost(host) ? null : (lanAddress() ?? null),
    port,
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

  return {
    state,

    async setLan(on) {
      const next = on ? "0.0.0.0" : "127.0.0.1";
      if (next === host) return { ok: true };

      // Displays are holding streams open, and a close waits for them.
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));

      try {
        await bind(next);
        host = next;
        return { ok: true };
      } catch (error) {
        // Put it back where it was, so a refusal is not also an outage.
        await bind(host);
        return {
          ok: false,
          reason: `Port ${port} is not free on ${next}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        };
      }
    },
  };
}
