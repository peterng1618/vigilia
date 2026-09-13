import { spawn } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import type { Server } from 'node:http';
import { MAX_PORT_ATTEMPTS } from './args.js';

/**
 * The launcher's I/O: binding, probing, opening a browser.
 *
 * Deliberately thin and decision-free. Everything worth asserting about a
 * flag lives in `args.ts`, which is pure; what is left here is the part that
 * genuinely needs a socket and therefore cannot be unit-tested without one.
 */

/**
 * Listens on `port`, walking upward when a port is taken.
 *
 * Bounded by {@link MAX_PORT_ATTEMPTS}. Only `EADDRINUSE` is retried — a
 * permission error or an unroutable address is a different problem, and
 * retrying it on the next port up would report "port busy" for something that
 * is not.
 *
 * @returns The port actually bound. The caller must print this rather than
 *   what was asked for: someone is about to read the URL aloud to a person
 *   holding a phone.
 */
export function listenWithFallback(
  server: Server,
  port: number,
  host: string,
  maxAttempts = MAX_PORT_ATTEMPTS,
): Promise<number> {
  return new Promise((resolve, reject) => {
    let attempt = 0;

    const tryListen = (candidate: number): void => {
      const onError = (error: NodeJS.ErrnoException): void => {
        server.removeListener('listening', onListening);

        if (error.code !== 'EADDRINUSE') {
          reject(error);
          return;
        }

        attempt += 1;

        if (attempt >= maxAttempts) {
          reject(
            new Error(
              `Ports ${port}–${port + maxAttempts - 1} are all in use. ` +
                'Free one, or pass --port.',
            ),
          );
          return;
        }

        tryListen(candidate + 1);
      };

      const onListening = (): void => {
        server.removeListener('error', onError);
        resolve(candidate);
      };

      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(candidate, host);
    };

    tryListen(port);
  });
}

/**
 * Polls until the port accepts a TCP connection, or the deadline passes.
 *
 * A fixed sleep before opening the browser is a race that usually wins: on a
 * cold start it loses, and the first thing a new user sees is a connection
 * error. Probing costs nothing and removes the guess.
 */
export function waitUntilReachable(
  port: number,
  host: string,
  { timeoutMs = 15_000, intervalMs = 100 } = {},
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  // A wildcard bind is not a connectable address; connect to loopback instead.
  const target = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;

  return new Promise((resolve) => {
    const attempt = (): void => {
      const socket = net.connect({ host: target, port }, () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('error', () => {
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

/**
 * The first non-internal IPv4 address — what a phone on the same Wi-Fi dials.
 *
 * Only meaningful when the host is bound to a wildcard or to this address;
 * printing it for a loopback bind would hand out a URL that refuses
 * connections.
 */
export function lanAddress(): string | undefined {
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const candidate of interfaces ?? []) {
      if (candidate.family === 'IPv4' && !candidate.internal) {
        return candidate.address;
      }
    }
  }

  return undefined;
}

/**
 * Opens the platform browser, detached, and never fails the launcher.
 *
 * A host that started correctly but could not open a browser is working; the
 * URL is on screen. Throwing here would turn a cosmetic failure into a dead
 * start, so the error is swallowed and the URL stands on its own.
 */
export function openBrowser(url: string): void {
  const command =
    process.platform === 'win32'
      ? { file: 'cmd', args: ['/c', 'start', '', url] }
      : process.platform === 'darwin'
        ? { file: 'open', args: [url] }
        : { file: 'xdg-open', args: [url] };

  try {
    const child = spawn(command.file, command.args, { detached: true, stdio: 'ignore' });

    child.on('error', () => {
      /* Reported by the URL already being printed. */
    });
    child.unref();
  } catch {
    /* Same. */
  }
}
