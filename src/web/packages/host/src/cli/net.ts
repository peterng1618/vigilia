import { spawn } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import type { Server } from 'node:http';
import { MAX_PORT_ATTEMPTS } from './args.js';

/** Launch I/O: bind, probe, discover LAN address, and open the browser. */

/** Retries only EADDRINUSE, bounded by `maxAttempts`; returns the actual port. */
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

/** Polls TCP reachability until success or timeout. */
export function waitUntilReachable(
  port: number,
  host: string,
  { timeoutMs = 15_000, intervalMs = 100 } = {},
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
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

/** First non-internal IPv4 address, suitable for same-LAN clients. */
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

/** Opens the platform browser without turning failure into a host startup failure. */
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
      /* The printed URL remains usable. */
    });
    child.unref();
  } catch {
    /* Same. */
  }
}
