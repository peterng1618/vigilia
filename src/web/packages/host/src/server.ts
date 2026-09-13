import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { SAMPLE_STREAM_PATH, createBatch } from '@vigilia/renderer-core';
import { contentTypeFor, needsTrailingSlash, resolveStaticPath } from './serve/static-path.js';
import { ProviderRegistry, unionOfKeys } from './providers/registry.js';
import { SseConnection } from './transport/sse.js';

/**
 * The HTTP surface: bundles, discovery, and the sample stream.
 *
 * Decides as little as possible. Path safety is `serve/static-path.ts`, the
 * wire shape is `renderer-core/data/protocol.ts`, slow-client policy is
 * `transport/sse.ts`, and *what to poll* is the registry. What is left here is
 * routing and a timer — the parts that need a socket to mean anything.
 */

export interface BundleRoots {
  readonly player: string;
  readonly editor: string;
}

export interface HostServerOptions {
  readonly registry: ProviderRegistry;
  readonly bundles: BundleRoots;
  /**
   * The acquisition cadence.
   *
   * 1 s is the baseline `SampleStore` is sized for, and **not a measured
   * budget** — §126 has no named reference hardware yet, so this is a chosen
   * default awaiting a measurement, not the outcome of one.
   */
  readonly sampleIntervalMs?: number;
  readonly now?: () => number;
}

export interface HostServer {
  readonly server: http.Server;
  readonly connectionCount: number;
  close(): Promise<void>;
}

export const DEFAULT_SAMPLE_INTERVAL_MS = 1000;

/** Addresses belonging to this machine, in the forms Node reports them. */
function isLoopbackRemote(address: string | undefined): boolean {
  if (address === undefined) {
    return false;
  }

  // Node reports IPv4-mapped IPv6 for a v4 client on a dual-stack socket.
  const normalized = address.replace(/^::ffff:/, '');

  return normalized === '127.0.0.1' || normalized === '::1';
}

function sendJson(response: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);

  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(payload);
}

function sendText(response: http.ServerResponse, status: number, body: string): void {
  response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  response.end(body);
}

/**
 * Serves one file from a bundle root, falling back to `index.html`.
 *
 * The fallback applies only to extension-less paths. A missing `.js` is a
 * broken build and must 404 loudly; answering it with HTML would surface as an
 * inscrutable syntax error in the console instead.
 */
async function serveStatic(
  response: http.ServerResponse,
  root: string,
  urlPath: string,
  missingBundleHint: string,
): Promise<void> {
  const resolved = resolveStaticPath(root, urlPath);

  if (resolved === undefined) {
    sendText(response, 403, 'Forbidden');
    return;
  }

  const candidates = [resolved];

  if (path.extname(resolved) === '') {
    candidates.push(path.join(resolved, 'index.html'), path.join(root, 'index.html'));
  }

  for (const candidate of candidates) {
    try {
      const body = await fs.readFile(candidate);

      response.writeHead(200, {
        'content-type': contentTypeFor(candidate),
        // Versioned asset filenames come from the build; the entry HTML must
        // not be cached or a rebuild would keep serving the old bundle.
        'cache-control': path.extname(candidate) === '.html' ? 'no-store' : 'no-cache',
      });
      response.end(body);
      return;
    } catch {
      continue;
    }
  }

  // A blank page is indistinguishable from a crash, so say which build is
  // missing and what to run.
  sendText(response, 404, missingBundleHint);
}

export function createHostServer(options: HostServerOptions): HostServer {
  const { registry, bundles } = options;
  const intervalMs = options.sampleIntervalMs ?? DEFAULT_SAMPLE_INTERVAL_MS;
  const now = options.now ?? (() => Date.now());
  const connections = new Set<SseConnection>();

  const server = http.createServer((request, response) => {
    void handle(request, response);
  });

  async function handle(
    request: http.IncomingMessage,
    response: http.ServerResponse,
  ): Promise<void> {
    const url = new URL(request.url ?? '/', 'http://host.invalid');

    if (request.method !== 'GET') {
      sendText(response, 405, 'Only GET is supported.');
      return;
    }

    if (url.pathname === SAMPLE_STREAM_PATH) {
      openStream(request, response, url);
      return;
    }

    if (url.pathname === '/api/sensors') {
      sendJson(response, 200, { sensors: await registry.describe() });
      return;
    }

    if (url.pathname === '/api/health') {
      sendJson(response, 200, {
        displays: connections.size,
        polling: unionOfKeys([...connections].map((connection) => connection.semanticKeys)),
      });
      return;
    }

    if (url.pathname === '/editor' || url.pathname.startsWith('/editor/')) {
      // §7: full editing is localhost-only by default. Binding to a wildcard
      // is an explicit decision to let phones *display*; it is not consent to
      // let the network author themes. The bind address and the peer address
      // are different questions, and only the peer answers this one.
      if (!isLoopbackRemote(request.socket.remoteAddress)) {
        sendText(response, 403, 'The editor is available on this PC only.');
        return;
      }

      // The editor's assets are relative, so they only resolve inside this
      // mount when the document has a trailing slash. Without it the browser
      // asks the *player's* dist for the editor's bundle and gets a 404, and
      // the editor hangs on "starting…" with nothing in the stage.
      if (needsTrailingSlash(url.pathname, '/editor')) {
        const query = url.search;
        response.writeHead(302, {
          location: `/editor/${query}`,
          'cache-control': 'no-store',
        });
        response.end();
        return;
      }

      await serveStatic(
        response,
        bundles.editor,
        url.pathname.slice('/editor'.length) || '/',
        'The editor bundle is not built. Run: npx vite build packages/editor',
      );
      return;
    }

    // The host's own default is REAL data. The player defaults to its fake
    // source so that `vite preview` and the browser tests keep working against
    // deterministic synthetic samples — but a phone pointed at this PC must get
    // hardware, so the entry point says so explicitly rather than relying on
    // the bundle to guess. §97: the choice is never inferred from whether a
    // host happens to answer.
    if (url.pathname === '/' && !url.searchParams.has('data')) {
      url.searchParams.set('data', 'live');
      response.writeHead(302, {
        location: `${url.pathname}?${url.searchParams.toString()}`,
        'cache-control': 'no-store',
      });
      response.end();
      return;
    }

    await serveStatic(
      response,
      bundles.player,
      url.pathname,
      'The player bundle is not built. Run: npx vite build packages/player',
    );
  }

  function openStream(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    url: URL,
  ): void {
    const keys = (url.searchParams.get('keys') ?? '')
      .split(',')
      .map((key) => key.trim())
      .filter((key) => key.length > 0);

    const connection = new SseConnection(response, keys);

    connections.add(connection);

    const drop = (): void => {
      connections.delete(connection);
      connection.close();
    };

    request.on('close', drop);
    request.on('error', drop);
  }

  /**
   * One cycle: one poll of the union, one batch, offered to every display.
   *
   * The union is computed here rather than per connection precisely so that
   * two phones showing the same dashboard cost one poll (§111).
   */
  async function tick(): Promise<void> {
    if (connections.size === 0) {
      return;
    }

    const keys = unionOfKeys([...connections].map((connection) => connection.semanticKeys));
    const cycle = await registry.sample(keys, now());
    const payload = JSON.stringify(createBatch(cycle.entries, now()));

    for (const connection of connections) {
      connection.offer(payload);
    }
  }

  const timer = setInterval(() => {
    void tick().catch(() => {
      // A cycle that throws must not stop the timer — the next one may
      // succeed, and a provider's failure is already isolated by the registry.
    });
  }, intervalMs);

  // Never hold the process open on the timer alone.
  timer.unref();

  return {
    server,
    get connectionCount() {
      return connections.size;
    },
    close(): Promise<void> {
      clearInterval(timer);

      for (const connection of connections) {
        connection.close();
      }

      connections.clear();

      return new Promise((resolve) => {
        server.close(() => resolve());
      });
    },
  };
}
