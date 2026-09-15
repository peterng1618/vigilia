import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { SAMPLE_STREAM_PATH, createBatch } from '@vigilia/renderer-core';
import { contentTypeFor, needsTrailingSlash, resolveStaticPath } from './serve/static-path.js';
import { ProviderRegistry, unionOfKeys } from './providers/registry.js';
import { SseConnection } from './transport/sse.js';

/** HTTP routing for bundles, discovery, and sample streaming. */

export interface BundleRoots {
  readonly player: string;
  readonly editor: string;
}

export interface HostServerOptions {
  readonly registry: ProviderRegistry;
  readonly bundles: BundleRoots;
  /** Chosen baseline cadence; not a measured performance budget. */
  readonly sampleIntervalMs?: number;
  readonly now?: () => number;
}

export interface HostServer {
  readonly server: http.Server;
  readonly connectionCount: number;
  close(): Promise<void>;
}

export const DEFAULT_SAMPLE_INTERVAL_MS = 1000;

/** Recognizes loopback forms Node may report. */
function isLoopbackRemote(address: string | undefined): boolean {
  if (address === undefined) {
    return false;
  }

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

/** Serves a bundle file; extension-less routes may fall back to index.html. */
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
        // Entry HTML must not retain references to an old build.
        'cache-control': path.extname(candidate) === '.html' ? 'no-store' : 'no-cache',
      });
      response.end(body);
      return;
    } catch {
      continue;
    }
  }

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
      // Editing remains localhost-only even when the display server binds to the LAN.
      if (!isLoopbackRemote(request.socket.remoteAddress)) {
        sendText(response, 403, 'The editor is available on this PC only.');
        return;
      }

      // Preserve the editor mount as the base for relative assets.
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

    // Host-served player defaults explicitly to real data; standalone preview stays deterministic.
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

  /** Polls the union once, then offers one batch to every display. */
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
      // Provider failures are isolated; keep future cycles running.
    });
  }, intervalMs);

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
