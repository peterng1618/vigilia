import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import {
  createAssetResolver,
  type FabricThemeEnvelope,
} from "@vigilia/renderer-core";
import { writeThemePackage } from "@vigilia/theme-package";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DeviceAssignment } from "./providers/lhm-mapping.js";
import { ProviderRegistry } from "./providers/registry.js";
import { createHostServer } from "./server.js";
import { createSessionStore } from "./session/pairing.js";
import { createActiveThemeStore } from "./settings/active-theme.js";
import { createDeviceSettingsStore } from "./settings/devices.js";
import { createDisplaySettingsStore } from "./settings/display.js";
import { createThemeSettingsStore } from "./settings/theme-settings.js";
import { createThemeStore, type ThemeContent } from "./themes/store.js";
import { encodeThemeContent } from "./themes/wire.js";

/** The library is a folder, so a save is the document and its bytes (ADR-0017),
 *  plus what the client says the save is based on. */
function themeBody(
  content: ThemeContent,
  save?: { readonly base?: string; readonly overwrite?: boolean },
): string {
  return JSON.stringify({ ...encodeThemeContent(content), ...save });
}

function createValidPackage(
  id = "living-room",
  name = "Living Room",
  semanticKey?: string,
): ThemeContent {
  const envelope: FabricThemeEnvelope = {
    schemaVersion: 2,
    fabricVersion: "7.4.0",
    id,
    artboard: { width: 1920, height: 1080 },
    metadata: { name, locale: "en" },
    ...(semanticKey === undefined
      ? {}
      : {
          globals: {
            palette: {
              none: {
                name: "None",
                value: { kind: "solid" as const, color: "transparent" },
              },
              ink: {
                name: "Ink",
                value: { kind: "solid" as const, color: "#e8ecf3" },
              },
            },
            typePresets: {
              "11-400": {
                name: "Caption",
                value: {
                  family: "system-ui, sans-serif",
                  size: 22,
                  weight: "400",
                },
              },
            },
          },
        }),
    scene: {
      version: "7.4.0",
      objects:
        semanticKey === undefined
          ? []
          : [
              {
                type: "Textbox",
                version: "7.4.0",
                left: 40,
                top: 40,
                width: 200,
                height: 40,
                text: "--",
                id: "readout",
                vigiliaPaint: { fill: "palette.ink" },
                vigiliaText: {
                  runs: [
                    {
                      kind: "value" as const,
                      bindingId: "readout-value",
                      typePreset: "typePresets.11-400" as const,
                      style: { color: { ref: "palette.ink" as const } },
                    },
                  ],
                },
              },
            ],
    },
    // Which device slots a theme needs is derived from what it binds, so a
    // fixture can only ask for a slot by binding a key in that family.
    ...(semanticKey === undefined
      ? {}
      : { bindings: { readout: [{ id: "readout-value", semanticKey }] } }),
  };
  const result = writeThemePackage({ envelope, assets: {} });
  if (!result.ok) throw new Error(result.message);
  return { envelope, assets: {} };
}

function createPackageWithAsset(
  path: string,
  bytes: readonly number[],
): ThemeContent {
  const envelope: FabricThemeEnvelope = {
    schemaVersion: 2,
    fabricVersion: "7.4.0",
    id: "living-room",
    artboard: { width: 1920, height: 1080 },
    metadata: { locale: "en" },
    scene: { version: "7.4.0", objects: [] },
    assets: [
      {
        id: "inter-400",
        kind: "font",
        path,
        family: "Inter",
        weight: 400,
        style: "normal",
        format: "woff2",
        sourceUrl: "https://example.test/inter.woff2",
        license: {
          name: "SIL Open Font License 1.1",
          url: "https://openfontlicense.org/",
        },
      } as never,
    ],
  };
  const assets = { [path]: new Uint8Array(bytes) };
  const result = writeThemePackage({ envelope, assets });
  if (!result.ok) throw new Error(result.message);
  return { envelope, assets };
}

function request(
  server: http.Server,
  method: string,
  urlPath: string,
  body?: Uint8Array | string,
  options?: { remoteAddress?: string; headers?: Record<string, string> },
): Promise<{
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
  json: () => unknown;
  text: () => string;
}> {
  return new Promise((resolve) => {
    const req = new Readable({
      read() {
        if (body !== undefined) {
          this.push(
            typeof body === "string" ? Buffer.from(body) : Buffer.from(body),
          );
        }
        this.push(null);
      },
    }) as unknown as http.IncomingMessage;

    req.method = method;
    req.url = urlPath;
    req.headers = { ...(options?.headers ?? {}) };
    if (body !== undefined) {
      req.headers["content-length"] = String(
        typeof body === "string" ? Buffer.byteLength(body) : body.byteLength,
      );
    }
    (req as { socket: { remoteAddress: string } }).socket = {
      remoteAddress: options?.remoteAddress ?? "127.0.0.1",
    };

    const chunks: Buffer[] = [];
    let statusCode = 200;
    const responseHeaders: Record<string, string | string[] | undefined> = {};

    const res = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      },
    }) as unknown as http.ServerResponse;

    res.writeHead = ((
      status: number,
      headers?: http.OutgoingHttpHeaders | http.OutgoingHttpHeader[],
    ) => {
      statusCode = status;
      if (headers && !Array.isArray(headers)) {
        for (const [k, v] of Object.entries(headers)) {
          if (v !== undefined) responseHeaders[k.toLowerCase()] = v as string;
        }
      }
      return res;
    }) as unknown as typeof res.writeHead;

    res.setHeader = (
      name: string,
      value: number | string | readonly string[],
    ) => {
      responseHeaders[name.toLowerCase()] = value as string;
      return res;
    };

    res.end = ((data?: unknown) => {
      if (data) {
        chunks.push(Buffer.from(data as string | Uint8Array));
      }
      const buffer = Buffer.concat(chunks);
      resolve({
        status: statusCode,
        headers: responseHeaders,
        body: buffer,
        json: () => JSON.parse(buffer.toString("utf8")),
        text: () => buffer.toString("utf8"),
      });
      return res;
    }) as unknown as typeof res.end;

    server.emit("request", req, res);
  });
}

/** Resolves as soon as headers are written, for a stream that stays open. */
function streamStatus(
  server: http.Server,
  urlPath: string,
  remoteAddress = "192.168.1.50",
): Promise<{ status: number; headers: Record<string, unknown> }> {
  return new Promise((resolve) => {
    const req = new Readable({
      read() {
        this.push(null);
      },
    }) as unknown as http.IncomingMessage;
    req.method = "GET";
    req.url = urlPath;
    req.headers = {};
    (req as { socket: { remoteAddress: string } }).socket = { remoteAddress };

    const res = new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    }) as unknown as http.ServerResponse;

    res.writeHead = ((status: number, headers?: http.OutgoingHttpHeaders) => {
      resolve({ status, headers: (headers ?? {}) as Record<string, unknown> });
      return res;
    }) as unknown as typeof res.writeHead;

    server.emit("request", req, res);
  });
}

describe("Host theme routes", () => {
  let tmpDir: string;
  let hosted: ReturnType<typeof createHostServer>;
  let validEmptyAssetTheme: ThemeContent;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "vigilia-host-theme-test-"),
    );
    validEmptyAssetTheme = createValidPackage("living-room", "Living Room");
    const store = createThemeStore(tmpDir);
    hosted = createHostServer({
      registry: new ProviderRegistry([]),
      bundles: { player: tmpDir, editor: tmpDir },
      themeStore: store,
    });
  });

  afterEach(async () => {
    await hosted.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("handles theme save, list, document fetch, and package fetch", async () => {
    const putRes = await request(
      hosted.server,
      "PUT",
      "/api/themes/living-room",
      themeBody(validEmptyAssetTheme),
    );
    expect(putRes.status).toBe(200);

    const listRes = await request(hosted.server, "GET", "/api/themes");
    expect(listRes.status).toBe(200);
    const listData = listRes.json() as {
      themes: readonly { id: string; name: string }[];
    };
    expect(listData.themes).toEqual([
      { id: "living-room", name: "Living Room", updatedAt: expect.any(String) },
    ]);

    const docRes = await request(
      hosted.server,
      "GET",
      "/api/themes/living-room/document",
    );
    expect(docRes.status).toBe(200);
    expect(docRes.headers["content-type"]).toContain("application/json");
    const docData = docRes.json() as FabricThemeEnvelope;
    expect(docData.id).toBe("living-room");
    expect(docData.schemaVersion).toBe(2);

    // What a save put in the folder, an open takes out again.
    const openRes = await request(
      hosted.server,
      "GET",
      "/api/themes/living-room",
    );
    expect(openRes.status).toBe(200);
    // An open answers with what is stored plus the base that names it, so the
    // next save can say which version it was built from.
    const { base, ...content } = openRes.json() as { base: string };
    expect(base).toMatch(/^[0-9a-f]{64}$/);
    expect(content).toEqual(encodeThemeContent(validEmptyAssetTheme));
  });

  it("refuses a save built from a document the stored theme has moved past", async () => {
    // Two tabs open the same theme; the first one saves an edit.
    const opened = await request(
      hosted.server,
      "PUT",
      "/api/themes/living-room",
      themeBody(validEmptyAssetTheme),
    );
    const { base } = opened.json() as { base: string };
    const edited = createValidPackage("living-room", "Living Room, edited");
    expect(
      (
        await request(
          hosted.server,
          "PUT",
          "/api/themes/living-room",
          themeBody(edited, { base }),
        )
      ).status,
    ).toBe(200);

    // The second tab saves the document it opened. 409, not 400: nothing was
    // wrong with the theme, the author is just behind, and the answer has to
    // say which it was.
    const stale = await request(
      hosted.server,
      "PUT",
      "/api/themes/living-room",
      themeBody(validEmptyAssetTheme, { base }),
    );
    expect(stale.status).toBe(409);
    expect(stale.text()).toContain("changed by someone else");

    const stored = (
      await request(hosted.server, "GET", "/api/themes/living-room")
    ).json() as {
      envelope: { metadata?: { name?: string } };
    };
    expect(stored.envelope.metadata?.name).toBe("Living Room, edited");

    // Overwriting is the author's decision, and it is a second, separate save.
    const forced = await request(
      hosted.server,
      "PUT",
      "/api/themes/living-room",
      themeBody(validEmptyAssetTheme, { base, overwrite: true }),
    );
    expect(forced.status).toBe(200);
    expect(
      (await request(hosted.server, "GET", "/api/themes/living-room")).json(),
    ).toMatchObject({ envelope: { metadata: { name: "Living Room" } } });
  });

  it("refuses a malformed base rather than saving without one", async () => {
    await request(
      hosted.server,
      "PUT",
      "/api/themes/living-room",
      themeBody(validEmptyAssetTheme),
    );
    // Dropping a base that is not a string would turn the client's bug into
    // exactly the ungated write the base is here to prevent.
    const res = await request(
      hosted.server,
      "PUT",
      "/api/themes/living-room",
      JSON.stringify({
        ...encodeThemeContent(validEmptyAssetTheme),
        base: 42,
      }),
    );
    expect(res.status).toBe(400);
    expect(res.text()).toContain("base is not a string");
  });

  it("serves the URL a display's asset resolver builds for a declared path", async () => {
    await request(
      hosted.server,
      "PUT",
      "/api/themes/living-room",
      themeBody(createPackageWithAsset("assets/inter-400.woff2", [1, 2])),
    );

    // The seam, exercised from both ends: the declarations the host publishes
    // go through the resolver the player uses, and the URL it produces is the
    // one the host has to answer. A route and a resolver that spell the
    // request differently cannot both satisfy this.
    const doc = (
      await request(hosted.server, "GET", "/api/themes/living-room/document")
    ).json() as FabricThemeEnvelope;
    const resolve = createAssetResolver(doc.assets, {
      baseUrl: "/api/themes/living-room/",
    });
    const url = resolve("inter-400");
    expect(url).toBe("/api/themes/living-room/assets/inter-400.woff2");

    const asset = await request(hosted.server, "GET", url ?? "");
    expect(asset.status).toBe(200);
    expect([...asset.body]).toEqual([1, 2]);
    // A browser decodes an image only if the response says it is one.
    expect(asset.headers["content-type"]).toBe("font/woff2");
  });

  it("refuses undeclared and traversal-like asset paths", async () => {
    await request(
      hosted.server,
      "PUT",
      "/api/themes/living-room",
      themeBody(createPackageWithAsset("assets/inter-400.woff2", [1, 2])),
    );

    const status = (path: string): Promise<number> =>
      request(hosted.server, "GET", path).then((res) => res.status);

    // A well-formed package path the theme never declared.
    await expect(
      status("/api/themes/living-room/assets/assets/missing.woff2"),
    ).resolves.toBe(404);
    // `..` cannot walk out of the package: the lookup is by declared path, so a
    // traversal decodes to something the theme does not declare.
    await expect(
      status("/api/themes/living-room/assets/assets/..%2F..%2Fsecret"),
    ).resolves.toBe(404);
    await expect(
      status("/api/themes/living-room/assets/assets/..%2Fsecret"),
    ).resolves.toBe(404);
    // A `.` segment is refused the same way.
    await expect(
      status("/api/themes/living-room/assets/assets/.%2Fsecret"),
    ).resolves.toBe(404);
  });

  it("forbids PUT from non-loopback addresses (§7)", async () => {
    const res = await request(
      hosted.server,
      "PUT",
      "/api/themes/living-room",
      themeBody(validEmptyAssetTheme),
      {
        remoteAddress: "10.0.0.2",
      },
    );
    expect(res.status).toBe(403);
  });

  it("reports requested keys no provider answered through /api/health", async () => {
    const health = await request(hosted.server, "GET", "/api/health");
    const body = health.json() as { unmapped: readonly string[] };

    // Nothing has polled yet, so nothing is unmapped; the field exists so a
    // display can tell "no data yet" from "this sensor has no provider".
    expect(body.unmapped).toEqual([]);
  });

  describe("LAN display sessions (§145)", () => {
    let sessions: ReturnType<typeof createSessionStore>;
    let paired: ReturnType<typeof createHostServer>;
    let lanDir: string;

    beforeEach(async () => {
      lanDir = await fs.mkdtemp(
        path.join(os.tmpdir(), "vigilia-host-lan-test-"),
      );
      sessions = createSessionStore();
      paired = createHostServer({
        registry: new ProviderRegistry([]),
        bundles: { player: lanDir, editor: lanDir },
        themeStore: createThemeStore(lanDir),
        display: createDisplaySettingsStore(lanDir),
        sessions,
      });
      await request(
        paired.server,
        "PUT",
        "/api/themes/living-room",
        themeBody(validEmptyAssetTheme),
      );
    });

    afterEach(async () => {
      await paired.close();
      await fs.rm(lanDir, { recursive: true, force: true });
    });

    it("refuses LAN display reads without a session", async () => {
      const lan = { remoteAddress: "192.168.1.50" };

      expect(
        (await request(paired.server, "GET", "/api/themes", undefined, lan))
          .status,
      ).toBe(403);
      expect(
        (
          await request(
            paired.server,
            "GET",
            "/api/themes/living-room/document",
            undefined,
            lan,
          )
        ).status,
      ).toBe(403);
    });

    it("accepts a LAN display holding a live session, by header or query", async () => {
      const issued = sessions.create("phone");
      const lan = { remoteAddress: "192.168.1.50" };

      expect(
        (
          await request(paired.server, "GET", "/api/themes", undefined, {
            ...lan,
            headers: { "x-vigilia-session": issued.token },
          })
        ).status,
      ).toBe(200);

      // The stream is gated by the same check, so a query token is accepted
      // (EventSource cannot set headers) and a missing one is refused. The
      // accepted stream is never awaited: it stays open by design.
      expect(
        (
          await streamStatus(
            paired.server,
            `/ws?keys=cpu.load&session=${encodeURIComponent(issued.token)}`,
          )
        ).status,
      ).toBe(200);
      expect(
        (await streamStatus(paired.server, "/ws?keys=cpu.load")).status,
      ).toBe(403);
    });

    it("lets a paired display read this PC's preferences, not change them", async () => {
      const issued = sessions.create("phone");
      const lan = { remoteAddress: "192.168.1.50" };
      const pairedPhone = {
        ...lan,
        headers: { "x-vigilia-session": issued.token },
      };

      // A display obeys the units and the zone, so it must be able to read
      // them: a phone that cannot learn the preference cannot honour it.
      expect(
        (
          await request(
            paired.server,
            "GET",
            "/api/display",
            undefined,
            pairedPhone,
          )
        ).status,
      ).toBe(200);
      expect(
        (await request(paired.server, "GET", "/api/display", undefined, lan))
          .status,
      ).toBe(403);

      // Changing one stays this PC's business.
      expect(
        (
          await request(
            paired.server,
            "PUT",
            "/api/display",
            json({ timeZone: "Asia/Tokyo" }),
            pairedPhone,
          )
        ).status,
      ).toBe(403);
    });

    it("refuses a revoked session", async () => {
      const issued = sessions.create("phone");
      sessions.revoke(issued.token);

      expect(
        (
          await request(paired.server, "GET", "/api/themes", undefined, {
            remoteAddress: "192.168.1.50",
            headers: { "x-vigilia-session": issued.token },
          })
        ).status,
      ).toBe(403);
    });

    it("keeps pairing itself loopback-only", async () => {
      expect(
        (
          await request(
            paired.server,
            "POST",
            "/api/pairing/sessions",
            undefined,
            {
              remoteAddress: "192.168.1.50",
            },
          )
        ).status,
      ).toBe(403);

      const minted = await request(
        paired.server,
        "POST",
        "/api/pairing/sessions",
      );
      expect(minted.status).toBe(201);
      expect(
        (minted.json() as { session: { token: string } }).session.token,
      ).toBeTruthy();
    });

    it("still treats loopback as trusted admin, with no session", async () => {
      expect((await request(paired.server, "GET", "/api/themes")).status).toBe(
        200,
      );
    });

    it("reports pairing availability through /api/health", async () => {
      const health = await request(paired.server, "GET", "/api/health");
      expect((health.json() as { pairing: boolean }).pairing).toBe(true);
    });
  });

  it("refuses LAN display reads when the host has no session store", async () => {
    await request(
      hosted.server,
      "PUT",
      "/api/themes/living-room",
      themeBody(validEmptyAssetTheme),
    );

    // Without a session store this host is loopback-only by construction, so a
    // LAN caller is refused rather than trusted. Loopback still reads freely.
    expect(
      (
        await request(
          hosted.server,
          "GET",
          "/api/themes/living-room/document",
          undefined,
          { remoteAddress: "192.168.1.50" },
        )
      ).status,
    ).toBe(403);

    expect(
      (await request(hosted.server, "GET", "/api/themes/living-room/document"))
        .status,
    ).toBe(200);
  });

  it("rejects malformed PUT packages and preserves existing package", async () => {
    await request(
      hosted.server,
      "PUT",
      "/api/themes/living-room",
      themeBody(validEmptyAssetTheme),
    );

    const badRes = await request(
      hosted.server,
      "PUT",
      "/api/themes/living-room",
      new Uint8Array([0, 1, 2, 3]),
    );
    expect(badRes.status).toBe(400);

    const docRes = await request(
      hosted.server,
      "GET",
      "/api/themes/living-room/document",
    );
    expect(docRes.status).toBe(200);
    expect((docRes.json() as FabricThemeEnvelope).metadata?.name).toBe(
      "Living Room",
    );
  });

  it("rejects invalid or traversal theme IDs", async () => {
    const putRes = await request(
      hosted.server,
      "PUT",
      "/api/themes/..%2Fescape",
      themeBody(validEmptyAssetTheme),
    );
    expect(putRes.status).toBe(400);

    const getRes = await request(
      hosted.server,
      "GET",
      "/api/themes/..%2Fescape/document",
    );
    expect(getRes.status).toBe(400);
  });

  it("returns 404 for missing themes", async () => {
    const res = await request(
      hosted.server,
      "GET",
      "/api/themes/not-found/document",
    );
    expect(res.status).toBe(404);
  });

  it("redirects the root to the first stored theme with live data", async () => {
    await request(
      hosted.server,
      "PUT",
      "/api/themes/living-room",
      themeBody(validEmptyAssetTheme),
    );

    const res = await request(hosted.server, "GET", "/");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/?theme=living-room&data=live");
  });

  it("leads a first-run consumer to the editor instead of dead-ending", async () => {
    const res = await request(hosted.server, "GET", "/");

    // An empty library is a first run, not an error: the page must offer the
    // way forward rather than a sentence the consumer cannot act on.
    expect(res.status).toBe(200);
    expect(res.text()).toContain("Open the editor");
    expect(res.text()).toContain('href="/editor/"');
  });

  it("names the template on the first-run page, which is where it matters most", async () => {
    const text = (await request(hosted.server, "GET", "/")).text();

    // With nothing saved, the chooser never renders — this page is what a new
    // PC sees, and "build one" is the wrong instruction for a product that
    // ships a finished dashboard. The name comes from the same catalogue the
    // chooser reads, so the two cannot disagree about what it is called.
    expect(text).toContain("Starter — System dashboard");
    expect(text).not.toContain("Open the editor to build one");
  });
});

/** A template the product ships, and the list the host's pages read it from. */
describe("The templates the host serves", () => {
  let tmpDir: string;
  let hosted: ReturnType<typeof createHostServer>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vigilia-templates-"));
    const store = createThemeStore(tmpDir);
    await store.write(
      "living-room",
      createValidPackage("living-room", "Living Room"),
    );
    await store.write("studio", createValidPackage("studio", "Studio"));
    hosted = createHostServer({
      registry: new ProviderRegistry([]),
      bundles: { player: tmpDir, editor: tmpDir, admin: ADMIN_DIR },
      themeStore: store,
      activeTheme: createActiveThemeStore(tmpDir),
    });
  });

  afterEach(async () => {
    await hosted.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("names the template beside the saved themes, from the chooser's own route", async () => {
    const res = await request(hosted.server, "GET", "/api/themes/active");
    const body = res.json() as {
      templates: readonly { id: string; name: string }[];
      themes: readonly { id: string }[];
    };

    // The chooser draws both kinds of row from this one response, so a host
    // that serves templates nowhere but the editor's own library shows an
    // empty list of what the product offers.
    expect(body.templates).toEqual([
      { id: "vigilia-starter-template", name: "Starter — System dashboard" },
    ]);
    // A template is not a stored theme, so it stays out of the author's own.
    expect(body.themes.map((theme) => theme.id)).toEqual([
      "living-room",
      "studio",
    ]);
  });

  it("serves the same list to the library route, so the editor could read it", async () => {
    const res = await request(hosted.server, "GET", "/api/themes");
    const body = res.json() as { templates: readonly { id: string }[] };

    expect(body.templates.map((template) => template.id)).toEqual([
      "vigilia-starter-template",
    ]);
  });

  it("cannot be chosen as the active theme, because it is not stored", async () => {
    const res = await request(
      hosted.server,
      "PUT",
      "/api/themes/active",
      json({ id: "vigilia-starter-template" }),
    );

    // Only a theme with a file can be displayed. Accepting the id here would
    // point every display at a package that does not exist.
    expect(res.status).toBe(404);
  });
});

/** The host's own pages, served from source with no build step. */
const ADMIN_DIR = fileURLToPath(new URL("../public", import.meta.url));

/** The text of every link to the editor, which is also its accessible name. */
function editorLinkText(html: string): string[] {
  return [
    ...html.matchAll(/<a\b[^>]*href="\/editor\/"[^>]*>([^<]*)<\/a>/g),
  ].map((match) => match[1] ?? "");
}

describe("The pages a consumer lands on", () => {
  let tmpDir: string;
  let hosted: ReturnType<typeof createHostServer>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vigilia-chooser-test-"));
    const store = createThemeStore(tmpDir);
    await store.write(
      "living-room",
      createValidPackage("living-room", "Living Room"),
    );
    await store.write("studio", createValidPackage("studio", "Studio"));
    hosted = createHostServer({
      registry: new ProviderRegistry([]),
      bundles: { player: tmpDir, editor: tmpDir, admin: ADMIN_DIR },
      themeStore: store,
    });
  });

  afterEach(async () => {
    await hosted.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("lists the chooser's themes through the owner that already draws them", async () => {
    const res = await request(hosted.server, "GET", "/");
    const html = res.text();

    expect(res.status).toBe(200);
    // `/settings` renders a theme with its thumbnail and a hatched stand-in;
    // a chooser that draws its own rows ships the same list twice, and the
    // copy that arrives second is the one without the picture.
    expect(html).toContain("theme-list.js");
    expect(html).not.toContain("data-theme=");
  });

  it("reaches the editor from the chooser, in a name a screen reader reads", async () => {
    const html = (await request(hosted.server, "GET", "/")).text();
    const labels = editorLinkText(html);

    expect(labels.length).toBeGreaterThan(0);
    // An anchor is focusable and follows, so the link needs no extra wiring;
    // an icon-only one would be reachable and still nameless.
    expect(labels.every((label) => label.trim().length > 0)).toBe(true);
  });

  it("reaches the editor from the settings page too", async () => {
    const html = (await request(hosted.server, "GET", "/settings")).text();
    const labels = editorLinkText(html);

    expect(html).not.toBe("Settings are available on this PC only.");
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.every((label) => label.trim().length > 0)).toBe(true);
  });

  it("names the automatic device choice as a rule, not as a graphics card", async () => {
    const html = (await request(hosted.server, "GET", "/settings")).text();

    // The empty answer is "nothing was chosen", and what the host then does is
    // take the first card the machine names. A control showing that as a
    // product name beside real model numbers misreports what is in use.
    expect(html).not.toContain("First card found (default)");
    expect(html).toContain("Automatic (the first card this PC reports)");
  });
});

/** A JSON request body, which the routes parse the same way a browser sends one. */
function json(value: unknown): string {
  return JSON.stringify(value);
}

describe("Display settings routes", () => {
  let tmpDir: string;
  let hosted: ReturnType<typeof createHostServer>;
  const changes: ({ readonly timeZone?: string } | undefined)[] = [];

  beforeEach(async () => {
    changes.length = 0;
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vigilia-display-"));
    hosted = createHostServer({
      registry: new ProviderRegistry([]),
      bundles: { player: tmpDir, editor: tmpDir },
      display: createDisplaySettingsStore(tmpDir),
      onDisplayChange: (settings) => changes.push(settings),
    });
  });

  afterEach(async () => {
    await hosted.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("offers the zones a consumer may choose, and this PC as the default", async () => {
    const res = await request(hosted.server, "GET", "/api/display");
    const body = res.json() as {
      settings: { timeZone?: string };
      zones: readonly string[];
    };

    // The page is dependency-free source, so the zone names travel with it.
    expect(body.settings).toEqual({});
    expect(body.zones).toContain("Asia/Tokyo");
    expect(body.zones).toContain("Europe/Lisbon");
  });

  it("stores a zone and tells the providers to read it", async () => {
    const res = await request(
      hosted.server,
      "PUT",
      "/api/display",
      json({
        timeZone: "Asia/Tokyo",
      }),
    );

    expect(res.status).toBe(200);
    expect(changes).toEqual([{ timeZone: "Asia/Tokyo" }]);
    expect(
      (await request(hosted.server, "GET", "/api/display")).json(),
    ).toMatchObject({ settings: { timeZone: "Asia/Tokyo" } });
  });

  it("refuses a zone no display could read", async () => {
    const res = await request(
      hosted.server,
      "PUT",
      "/api/display",
      json({
        timeZone: "Mars/Olympus",
      }),
    );

    expect(res.status).toBe(400);
    // Refused, not stored-but-ignored: a setting that does nothing is worse
    // than one that says why.
    expect(changes).toEqual([]);
    expect(
      (await request(hosted.server, "GET", "/api/display")).json(),
    ).toMatchObject({ settings: {} });
  });

  it("keeps a machine setting on this PC", async () => {
    const lan = { remoteAddress: "192.168.1.50" };

    expect(
      (await request(hosted.server, "GET", "/api/display", undefined, lan))
        .status,
    ).toBe(403);
    expect(
      (
        await request(
          hosted.server,
          "PUT",
          "/api/display",
          json({ timeZone: "Asia/Tokyo" }),
          lan,
        )
      ).status,
    ).toBe(403);
  });
});

describe("A theme's own device answers", () => {
  let tmpDir: string;
  let hosted: ReturnType<typeof createHostServer>;
  const pushed: DeviceAssignment[] = [];

  /** Writes one theme into the store the host reads. */
  async function seed(id: string, semanticKey?: string): Promise<void> {
    await request(
      hosted.server,
      "PUT",
      `/api/themes/${id}`,
      themeBody(createValidPackage(id, id, semanticKey)),
    );
  }

  beforeEach(async () => {
    pushed.length = 0;
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vigilia-answers-"));
    hosted = createHostServer({
      registry: new ProviderRegistry([]),
      bundles: { player: tmpDir, editor: tmpDir },
      devices: createDeviceSettingsStore(tmpDir),
      activeTheme: createActiveThemeStore(tmpDir),
      themeSettings: createThemeSettingsStore(tmpDir),
      onDeviceAssignment: (assignment) => pushed.push(assignment),
    });

    await seed("disk-only", "disk.total");
    await seed("disk-spare", "disk.total");
    await seed("cpu-only", "cpu.load");
  });

  afterEach(async () => {
    await hosted.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("asks only for the slots a theme reads", async () => {
    const disk = (
      await request(hosted.server, "GET", "/api/themes/disk-only/answers")
    ).json() as { answers: unknown; required: readonly string[] };
    const cpu = (
      await request(hosted.server, "GET", "/api/themes/cpu-only/answers")
    ).json() as { answers: unknown; required: readonly string[] };

    expect(disk.required).toEqual(["system-disk"]);
    expect(disk.answers).toEqual({});
    // A theme that reads no assignable hardware asks nothing at all.
    expect(cpu.required).toEqual([]);
  });

  it("keeps a theme's answer to this PC", async () => {
    const lan = { remoteAddress: "192.168.1.50" };

    expect(
      (
        await request(
          hosted.server,
          "GET",
          "/api/themes/disk-only/answers",
          undefined,
          lan,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await request(
          hosted.server,
          "PUT",
          "/api/themes/disk-only/answers",
          json({ "system-disk": "disk-c" }),
          lan,
        )
      ).status,
    ).toBe(403);
  });

  it("stores an answer, and drops a group no device can fill", async () => {
    const res = await request(
      hosted.server,
      "PUT",
      "/api/themes/disk-only/answers",
      json({ "system-disk": "disk-d", nonsense: "disk-c" }),
    );

    expect(res.status).toBe(200);
    expect((res.json() as { answers: unknown }).answers).toEqual({
      "system-disk": "disk-d",
    });
  });

  it("overrides the global choice for its theme, and tells the providers", async () => {
    await request(
      hosted.server,
      "PUT",
      "/api/devices",
      json({ assigned: { "system-disk": "disk-c" } }),
    );
    await request(
      hosted.server,
      "PUT",
      "/api/themes/active",
      json({ id: "disk-only" }),
    );
    await request(
      hosted.server,
      "PUT",
      "/api/themes/disk-only/answers",
      json({ "system-disk": "disk-d" }),
    );

    // The answer is the difference, so the providers must be told about it:
    // without this the dashboard keeps showing the disk the consumer replaced.
    expect(pushed.at(-1)).toEqual({ systemDisk: "disk-d", names: {} });

    // Another theme reads the machine's own answer, not this theme's.
    await request(
      hosted.server,
      "PUT",
      "/api/themes/active",
      json({ id: "disk-spare" }),
    );
    expect(pushed.at(-1)).toEqual({ systemDisk: "disk-c", names: {} });
  });

  it("publishes the assignment a chosen theme implies", async () => {
    await request(
      hosted.server,
      "PUT",
      "/api/devices",
      json({ assigned: { gpu: "gpu-1" } }),
    );
    await request(
      hosted.server,
      "PUT",
      "/api/themes/disk-only/answers",
      json({ "system-disk": "disk-d" }),
    );

    // Choosing the theme is what makes its answer apply, so the choice itself
    // has to reach the providers.
    await request(
      hosted.server,
      "PUT",
      "/api/themes/active",
      json({ id: "disk-only" }),
    );
    expect(pushed.at(-1)).toEqual({
      gpu: "gpu-1",
      systemDisk: "disk-d",
      names: {},
    });
  });

  it("publishes the consumer's chosen name, so a caption reaches the display", async () => {
    // The other half of the choice: which device answers, and what it is
    // called. A name the settings page accepted has to arrive with the
    // assignment, or a caption can only ever print the machine's own string.
    await request(
      hosted.server,
      "PUT",
      "/api/devices",
      json({
        assigned: { "system-disk": "lexar-500gb-ssd" },
        names: { "lexar-500gb-ssd": "System drive" },
      }),
    );

    expect(pushed.at(-1)).toEqual({
      systemDisk: "lexar-500gb-ssd",
      names: { "lexar-500gb-ssd": "System drive" },
    });
  });
});
