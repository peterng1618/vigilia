import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { createBatch, SAMPLE_STREAM_PATH } from "@vigilia/renderer-core";
import { DEFAULT_THEMES_DIR } from "./cli/args.js";
import type { DeviceAssignment } from "./providers/lhm-mapping.js";
import { ProviderRegistry, unionOfKeys } from "./providers/registry.js";
import {
  contentTypeFor,
  needsTrailingSlash,
  resolveStaticPath,
} from "./serve/static-path.js";
import type { SessionStore } from "./session/pairing.js";
import {
  type DeviceSettingsStore,
  EMPTY_DEVICE_SETTINGS,
} from "./settings/devices.js";
import {
  createThemeStore,
  isValidThemeId,
  type ThemeStore,
} from "./themes/store.js";
import { SseConnection } from "./transport/sse.js";

/** HTTP routing for bundles, discovery, sample streaming, and theme packages. */

/** Non-loopback displays present this header; loopback never needs to. */
const SESSION_HEADER = "x-vigilia-session";

export interface BundleRoots {
  readonly player: string;
  readonly editor: string;
  /** Admin pages served from source (no build step), e.g. the settings page. */
  readonly admin?: string;
}

export interface HostServerOptions {
  readonly registry: ProviderRegistry;
  readonly bundles: BundleRoots;
  readonly themeStore?: ThemeStore;
  /** Chosen baseline cadence; not a measured performance budget. */
  readonly sampleIntervalMs?: number;
  readonly now?: () => number;
  /** LAN display sessions (§145). Omit to disable pairing entirely — a
   * loopback-only server needs none, and a non-loopback display is then
   * refused rather than trusted. */
  readonly sessions?: SessionStore;
  /** Device assignments (§145). Omit to keep defaults with no configuration. */
  readonly devices?: DeviceSettingsStore;
  /** Called after an assignment change so providers re-read it. */
  readonly onDeviceAssignment?: (assignment: DeviceAssignment) => void;
  /** Devices a consumer may choose between. Omitted when none are known. */
  readonly describeDevices?: () => Promise<{
    readonly gpus: readonly { readonly id: string; readonly name: string }[];
    readonly disks: readonly { readonly id: string; readonly name: string }[];
  }>;
}

export interface HostServer {
  readonly server: http.Server;
  readonly connectionCount: number;
  close(): Promise<void>;
}

export const DEFAULT_SAMPLE_INTERVAL_MS = 1000;
const MAX_THEME_UPLOAD_BYTES = 64 * 1024 * 1024;

/** Recognizes loopback forms Node may report. */
function isLoopbackRemote(address: string | undefined): boolean {
  if (address === undefined) {
    return false;
  }

  const normalized = address.replace(/^::ffff:/, "");

  return normalized === "127.0.0.1" || normalized === "::1";
}

/** Bounded JSON body for admin writes; a runaway body must not be buffered. */
async function readBody(
  request: http.IncomingMessage,
  limit = 64 * 1024,
): Promise<string> {
  const chunks: Buffer[] = [];
  let received = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk as string);
    received += buffer.byteLength;

    if (received > limit) {
      throw new Error("That request body is too large.");
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function sendJson(
  response: http.ServerResponse,
  status: number,
  body: unknown,
): void {
  const payload = JSON.stringify(body);

  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(payload);
}

/**
 * The dashboard's first-run state. Plain HTML with no build step and no
 * dependency, matching the settings page.
 */
function firstRunPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <title>Vigilia</title>
    <style>
      html, body { margin: 0; height: 100%; }
      body {
        display: grid;
        place-items: center;
        background: #14161c;
        color: #e8ecf3;
        font: 15px/1.6 system-ui, sans-serif;
        text-align: center;
        padding: 24px;
      }
      h1 { font-size: 22px; letter-spacing: 0.02em; margin: 0 0 8px; }
      p { color: #8a97ab; margin: 0 0 24px; max-width: 34em; }
      a {
        display: inline-block;
        padding: 10px 18px;
        border-radius: 8px;
        background: #e8ecf3;
        color: #14161c;
        font-weight: 600;
        text-decoration: none;
      }
      code { color: #b5c6c0; }
    </style>
  </head>
  <body>
    <main>
      <h1>No dashboard yet</h1>
      <p>
        This PC has no saved theme, so there is nothing to display. Open the
        editor to build one, then save it to this PC's library.
      </p>
      <a href="/editor/">Open the editor</a>
    </main>
  </body>
</html>`;
}

function sendHtml(
  response: http.ServerResponse,
  status: number,
  body: string,
): void {
  response.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(body);
}

function sendText(
  response: http.ServerResponse,
  status: number,
  body: string,
): void {
  response.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
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
    sendText(response, 403, "Forbidden");
    return;
  }

  const candidates = [resolved];

  if (path.extname(resolved) === "") {
    candidates.push(
      path.join(resolved, "index.html"),
      path.join(root, "index.html"),
    );
  }

  for (const candidate of candidates) {
    try {
      const body = await fs.readFile(candidate);

      response.writeHead(200, {
        "content-type": contentTypeFor(candidate),
        // Entry HTML must not retain references to an old build.
        "cache-control":
          path.extname(candidate) === ".html" ? "no-store" : "no-cache",
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
  const themeStore = options.themeStore ?? createThemeStore(DEFAULT_THEMES_DIR);
  const intervalMs = options.sampleIntervalMs ?? DEFAULT_SAMPLE_INTERVAL_MS;
  const now = options.now ?? (() => Date.now());
  const connections = new Set<SseConnection>();
  /** Keys no provider answered in the last poll; surfaced through `/api/health`. */
  let lastUnmapped: readonly string[] = [];
  const sessions = options.sessions;
  const devices = options.devices;

  /** Assignments in the shape providers consume; unset groups mean defaults. */
  async function currentAssignment(): Promise<DeviceAssignment> {
    const stored =
      devices === undefined ? EMPTY_DEVICE_SETTINGS : await devices.read();

    return {
      ...(stored.assigned.gpu === undefined
        ? {}
        : { gpu: stored.assigned.gpu }),
      ...(stored.assigned["system-disk"] === undefined
        ? {}
        : { systemDisk: stored.assigned["system-disk"] }),
      ...(stored.assigned["data-disk"] === undefined
        ? {}
        : { dataDisk: stored.assigned["data-disk"] }),
    };
  }

  /**
   * The devices a consumer can choose between, discovered from the providers
   * rather than guessed at. An unconfigured machine returns empty groups, which
   * the settings UI reports as "only one device found" rather than as an error.
   */
  async function availableDevices(): Promise<{
    readonly gpus: readonly { readonly id: string; readonly name: string }[];
    readonly disks: readonly { readonly id: string; readonly name: string }[];
  }> {
    const describe_devices = options.describeDevices;

    if (describe_devices === undefined) {
      return { gpus: [], disks: [] };
    }

    try {
      return await describe_devices();
    } catch {
      // A provider that cannot answer leaves the lists empty, never fails the page.
      return { gpus: [], disks: [] };
    }
  }

  /** A request's token, from a header (fetch) or query (EventSource cannot set
   * request headers, so the stream carries it in the URL). */
  function tokenFor(
    request: http.IncomingMessage,
    url: URL,
  ): string | undefined {
    const header = request.headers[SESSION_HEADER];
    const fromHeader = Array.isArray(header) ? header[0] : header;
    return fromHeader ?? url.searchParams.get("session") ?? undefined;
  }

  /** Loopback is trusted admin; anything else must present a live session. */
  function allowed(request: http.IncomingMessage, url: URL): boolean {
    if (isLoopbackRemote(request.socket.remoteAddress)) {
      return true;
    }

    return sessions?.verify(tokenFor(request, url)) === true;
  }

  const server = http.createServer((request, response) => {
    void handle(request, response);
  });

  async function handle(
    request: http.IncomingMessage,
    response: http.ServerResponse,
  ): Promise<void> {
    const url = new URL(request.url ?? "/", "http://host.invalid");

    // Pairing is an admin action: it mints display credentials, so it stays
    // loopback-only even when the server is LAN-reachable.
    if (url.pathname.startsWith("/api/pairing")) {
      if (!isLoopbackRemote(request.socket.remoteAddress)) {
        sendText(response, 403, "Pairing is available on this PC only.");
        return;
      }

      if (sessions === undefined) {
        sendText(response, 404, "Pairing is not enabled on this host.");
        return;
      }

      if (
        url.pathname === "/api/pairing/sessions" &&
        request.method === "GET"
      ) {
        sendJson(response, 200, { sessions: sessions.list() });
        return;
      }

      if (
        url.pathname === "/api/pairing/sessions" &&
        request.method === "POST"
      ) {
        const label = url.searchParams.get("label") ?? "display";
        sendJson(response, 201, { session: sessions.create(label) });
        return;
      }

      const revokeMatch = url.pathname.match(
        /^\/api\/pairing\/sessions\/([^/]+)$/,
      );
      if (revokeMatch && request.method === "DELETE") {
        const token = decodeURIComponent(revokeMatch[1] ?? "");
        if (!sessions.revoke(token)) {
          sendText(response, 404, "No such session.");
          return;
        }
        sendJson(response, 200, { ok: true });
        return;
      }

      sendText(response, 405, "Only GET, POST and DELETE are supported.");
      return;
    }

    if (url.pathname === SAMPLE_STREAM_PATH) {
      if (!allowed(request, url)) {
        sendText(response, 403, "This display is not paired with the host.");
        return;
      }
      openStream(request, response, url);
      return;
    }

    // Device assignments are an admin action, like pairing: they change what
    // every display shows, so they stay loopback-only.
    if (url.pathname.startsWith("/api/devices")) {
      if (!isLoopbackRemote(request.socket.remoteAddress)) {
        sendText(
          response,
          403,
          "Device settings are available on this PC only.",
        );
        return;
      }

      if (devices === undefined) {
        sendText(
          response,
          404,
          "Device settings are not enabled on this host.",
        );
        return;
      }

      if (url.pathname === "/api/devices" && request.method === "GET") {
        sendJson(response, 200, {
          available: await availableDevices(),
          assigned: await devices.read(),
        });
        return;
      }

      if (url.pathname === "/api/devices" && request.method === "PUT") {
        try {
          const body = JSON.parse(await readBody(request)) as unknown;
          const saved = await devices.write(body);
          options.onDeviceAssignment?.(await currentAssignment());
          sendJson(response, 200, { ok: true, assigned: saved });
        } catch (error) {
          sendText(
            response,
            400,
            error instanceof Error ? error.message : String(error),
          );
        }
        return;
      }

      sendText(response, 405, "Only GET and PUT are supported.");
      return;
    }

    if (url.pathname === "/api/health") {
      sendJson(response, 200, {
        displays: connections.size,
        polling: unionOfKeys(
          [...connections].map((connection) => connection.semanticKeys),
        ),
        unmapped: lastUnmapped,
        pairing: sessions !== undefined,
      });
      return;
    }

    // Display reads stay open on loopback; from the LAN they need a session so
    // dashboard content is not served to every device on the network.
    if (
      !isLoopbackRemote(request.socket.remoteAddress) &&
      !allowed(request, url)
    ) {
      sendText(response, 403, "This display is not paired with the host.");
      return;
    }

    if (url.pathname === "/api/themes") {
      if (request.method !== "GET") {
        sendText(response, 405, "Only GET is supported.");
        return;
      }
      sendJson(response, 200, { themes: await themeStore.list() });
      return;
    }

    const assetMatch = url.pathname.match(
      /^\/api\/themes\/([^/]+)\/assets\/(.+)$/,
    );
    if (assetMatch) {
      if (request.method !== "GET") {
        sendText(response, 405, "Only GET is supported.");
        return;
      }
      let id: string;
      let assetPath: string;
      try {
        id = decodeURIComponent(assetMatch[1] ?? "");
        assetPath = decodeURIComponent(assetMatch[2] ?? "");
      } catch {
        sendText(response, 400, "Invalid theme asset path.");
        return;
      }
      const record = isValidThemeId(id) ? await themeStore.read(id) : undefined;
      const declared = record?.envelope.assets?.find(
        (asset) => asset.path === assetPath,
      );
      const bytes =
        declared === undefined ? undefined : record?.assets[declared.path];
      if (bytes === undefined) {
        sendText(response, 404, "Theme asset not found.");
        return;
      }
      response.writeHead(200, {
        "content-type": "application/octet-stream",
        "cache-control": "no-store",
      });
      response.end(Buffer.from(bytes));
      return;
    }

    const docMatch = url.pathname.match(/^\/api\/themes\/([^/]+)\/document$/);
    if (docMatch) {
      if (request.method !== "GET") {
        sendText(response, 405, "Only GET is supported.");
        return;
      }
      const rawId = decodeURIComponent(docMatch[1] ?? "");
      if (!isValidThemeId(rawId)) {
        sendText(response, 400, "Invalid theme id.");
        return;
      }
      const record = await themeStore.read(rawId);
      if (record === undefined) {
        sendText(response, 404, "Theme not found.");
        return;
      }
      sendJson(response, 200, record.envelope);
      return;
    }

    const themeMatch = url.pathname.match(/^\/api\/themes\/([^/]+)$/);
    if (themeMatch) {
      const rawId = decodeURIComponent(themeMatch[1] ?? "");
      if (request.method === "GET") {
        if (!isValidThemeId(rawId)) {
          sendText(response, 400, "Invalid theme id.");
          return;
        }
        const record = await themeStore.read(rawId);
        if (record === undefined) {
          sendText(response, 404, "Theme not found.");
          return;
        }
        response.writeHead(200, {
          "content-type": "application/octet-stream",
          "cache-control": "no-store",
        });
        response.end(Buffer.from(record.bytes));
        return;
      }

      if (request.method === "PUT") {
        if (!isLoopbackRemote(request.socket.remoteAddress)) {
          sendText(response, 403, "Theme modification is loopback only.");
          return;
        }
        if (!isValidThemeId(rawId)) {
          sendText(response, 400, "Invalid theme id.");
          return;
        }

        let receivedBytes = 0;
        const chunks: Buffer[] = [];
        let aborted = false;

        for await (const chunk of request) {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          receivedBytes += buf.byteLength;
          if (receivedBytes > MAX_THEME_UPLOAD_BYTES) {
            aborted = true;
            break;
          }
          chunks.push(buf);
        }

        if (aborted) {
          sendText(
            response,
            413,
            "Theme package exceeds maximum size of 64 MiB.",
          );
          return;
        }

        const body = new Uint8Array(Buffer.concat(chunks));
        try {
          const entry = await themeStore.write(rawId, body);
          sendJson(response, 200, { ok: true, ...entry });
        } catch (error) {
          sendText(
            response,
            400,
            error instanceof Error ? error.message : String(error),
          );
        }
        return;
      }

      sendText(response, 405, "Only GET and PUT are supported.");
      return;
    }

    if (request.method !== "GET") {
      sendText(response, 405, "Only GET is supported.");
      return;
    }

    if (url.pathname === "/api/sensors") {
      sendJson(response, 200, { sensors: await registry.describe() });
      return;
    }

    // The settings page is an admin surface: it changes what every display
    // shows, so it stays on this PC like the editor and pairing.
    if (url.pathname === "/settings" || url.pathname.startsWith("/settings/")) {
      if (!isLoopbackRemote(request.socket.remoteAddress)) {
        sendText(response, 403, "Settings are available on this PC only.");
        return;
      }

      if (bundles.admin === undefined) {
        sendText(response, 404, "No settings page is installed.");
        return;
      }

      await serveStatic(
        response,
        bundles.admin,
        url.pathname === "/settings"
          ? "/settings.html"
          : url.pathname.slice("/settings".length),
        "The settings page is missing from this installation.",
      );
      return;
    }

    if (url.pathname === "/editor" || url.pathname.startsWith("/editor/")) {
      // Editing remains localhost-only even when the display server binds to the LAN.
      if (!isLoopbackRemote(request.socket.remoteAddress)) {
        sendText(response, 403, "The editor is available on this PC only.");
        return;
      }

      // Preserve the editor mount as the base for relative assets.
      if (needsTrailingSlash(url.pathname, "/editor")) {
        const query = url.search;
        response.writeHead(302, {
          location: `/editor/${query}`,
          "cache-control": "no-store",
        });
        response.end();
        return;
      }

      await serveStatic(
        response,
        bundles.editor,
        url.pathname.slice("/editor".length) || "/",
        "The editor bundle is not built. Run: npx vite build packages/editor",
      );
      return;
    }

    // Host-served player uses a stored theme and live data; standalone preview stays deterministic.
    if (url.pathname === "/" && !url.searchParams.has("data")) {
      const theme =
        url.searchParams.get("theme") ?? (await themeStore.list()).at(0)?.id;
      if (theme === undefined) {
        // First run: the dashboard has nothing to show, so it must lead the
        // consumer to the editor rather than dead-end on an error sentence.
        sendHtml(response, 200, firstRunPage());
        return;
      }
      url.searchParams.set("theme", theme);
      url.searchParams.set("data", "live");
      response.writeHead(302, {
        location: `${url.pathname}?${url.searchParams.toString()}`,
        "cache-control": "no-store",
      });
      response.end();
      return;
    }

    await serveStatic(
      response,
      bundles.player,
      url.pathname,
      "The player bundle is not built. Run: npx vite build packages/player",
    );
  }

  function openStream(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    url: URL,
  ): void {
    const keys = (url.searchParams.get("keys") ?? "")
      .split(",")
      .map((key) => key.trim())
      .filter((key) => key.length > 0);

    const connection = new SseConnection(response, keys);

    connections.add(connection);

    const drop = (): void => {
      connections.delete(connection);
      connection.close();
    };

    request.on("close", drop);
    request.on("error", drop);
  }

  /** Polls the union once, then offers one batch to every display. */
  async function tick(): Promise<void> {
    if (connections.size === 0) {
      return;
    }

    const keys = unionOfKeys(
      [...connections].map((connection) => connection.semanticKeys),
    );
    const cycle = await registry.sample(keys, now());

    // A key no provider even considers would otherwise be absent from the frame
    // entirely, so a display cannot tell "nothing reports this" from "no data
    // yet" (§97). An explicit gap carries the reason to the display.
    const answered = new Set(cycle.entries.map((entry) => entry.semanticKey));
    const timestamp = new Date(now()).toISOString();
    const gaps = cycle.unmapped
      .filter((key) => !answered.has(key))
      .map((key) => ({
        semanticKey: key,
        sample: {
          sensorId: "host:" + key,
          timestamp,
          status: "missing" as const,
          message:
            "no provider on this PC reports that sensor; check the device " +
            "assignment or that its source is running",
        },
      }));

    const payload = JSON.stringify(
      createBatch([...cycle.entries, ...gaps], now()),
    );

    // Recorded for `/api/health` so an unsupported sensor explains itself.
    lastUnmapped = cycle.unmapped;

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
