import { spawn } from "node:child_process";
import net from "node:net";
import os from "node:os";
import { MAX_PORT_ATTEMPTS } from "./args.js";

/** Launch I/O: bind, probe, discover LAN address, and open the browser. */

/**
 * What this module binds. `node:http`'s server and `node:https`'s do not share
 * a type, and both carry the pair the binding needs: `listen`, and
 * `closeIdleConnections` — without which a move cannot drop the sockets that
 * are merely idle without also dropping the answer that asked it to move
 * (`vg-173`). A host serving both protocols on one port presents a `net.Server`
 * wearing the same two methods, so the interface is stated rather than spelled
 * as a union.
 */
export interface ListenableServer extends net.Server {
  closeIdleConnections(): void;
  closeAllConnections(): void;
}

/** Retries only EADDRINUSE, bounded by `maxAttempts`; returns the actual port. */
export function listenWithFallback(
  server: ListenableServer,
  port: number,
  host: string,
  maxAttempts = MAX_PORT_ATTEMPTS,
): Promise<number> {
  return new Promise((resolve, reject) => {
    let attempt = 0;

    const tryListen = (candidate: number): void => {
      const onError = (error: NodeJS.ErrnoException): void => {
        server.removeListener("listening", onListening);

        if (error.code !== "EADDRINUSE") {
          reject(error);
          return;
        }

        attempt += 1;

        if (attempt >= maxAttempts) {
          reject(
            new Error(
              `Ports ${port}–${port + maxAttempts - 1} are all in use. ` +
                "Free one, or pass --port.",
            ),
          );
          return;
        }

        tryListen(candidate + 1);
      };

      const onListening = (): void => {
        server.removeListener("error", onError);
        resolve(candidate);
      };

      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(candidate, host);
    };

    tryListen(port);
  });
}

/** Polls TCP reachability until success or timeout. */
export function waitUntilReachable(
  port: number,
  host: string,
  { timeoutMs = 15_000, intervalMs = 100 } = {},
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  const target = host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;

  return new Promise((resolve) => {
    const attempt = (): void => {
      const socket = net.connect({ host: target, port }, () => {
        socket.destroy();
        resolve(true);
      });

      socket.on("error", () => {
        socket.destroy();

        if (Date.now() >= deadline) {
          resolve(false);
          return;
        }

        setTimeout(attempt, intervalMs);
      });
    };

    attempt();
  });
}

/** First non-internal IPv4 address, suitable for same-LAN clients. */
export function lanAddress(): string | undefined {
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const candidate of interfaces ?? []) {
      if (candidate.family === "IPv4" && !candidate.internal) {
        return candidate.address;
      }
    }
  }

  return undefined;
}

/** Every address and name this machine answers to, for a certificate's SANs.
 *
 *  **All of them, not the one in use**, because the host can be moved onto the
 *  LAN after it has started (`createHostBinding`): a leaf covering only loopback
 *  would present a name mismatch to the first phone that connected, and the
 *  owner would have no way to tell that from a root they had not installed.
 *
 *  Read once, at start. That is the whole of what a changed DHCP lease costs: a
 *  restart re-reads this list and re-issues the leaf, and the root a display
 *  already installed stays valid, so nothing has to be installed again. */
export function localNames(): readonly string[] {
  const names = new Set<string>(["localhost", os.hostname()]);

  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const candidate of interfaces ?? []) {
      // Internal entries are the loopback literals, added below by hand rather
      // than read: a browser at `https://127.0.0.1:5227` is the commonest
      // reader of all, and no interface has to be up for it to exist.
      if (!candidate.internal) names.add(candidate.address);
    }
  }

  names.add("127.0.0.1");
  names.add("::1");

  return [...names];
}

/** Opens the platform browser without turning failure into a host startup failure. */
export function openBrowser(url: string): void {
  const command =
    process.platform === "win32"
      ? { file: "cmd", args: ["/c", "start", "", url] }
      : process.platform === "darwin"
        ? { file: "open", args: [url] }
        : { file: "xdg-open", args: [url] };

  try {
    const child = spawn(command.file, command.args, {
      detached: true,
      stdio: "ignore",
    });

    child.on("error", () => {
      /* The printed URL remains usable. */
    });
    child.unref();
  } catch {
    /* Same. */
  }
}
