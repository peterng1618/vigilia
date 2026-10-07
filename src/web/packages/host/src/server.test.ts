import { createHash } from "node:crypto";
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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type HostBinding, createHostBinding } from "./cli/hosting.js";
import type { DeviceAssignment } from "./providers/lhm-mapping.js";
import { ProviderRegistry } from "./providers/registry.js";
import {
  createHostServer,
  type HostServerOptions,
  type HostingState,
} from "./server.js";
import { createSessionStore } from "./session/pairing.js";
import { createActiveThemeStore } from "./settings/active-theme.js";
import { createDeviceSettingsStore } from "./settings/devices.js";
import { createDisplaySettingsStore } from "./settings/display.js";
import { createFontFavoritesStore } from "./settings/font-favorites.js";
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
    metadata: { name, themeLanguage: "en" },
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
    metadata: { themeLanguage: "en" },
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
      // A real response emits `finish` once its bytes are with the OS, and the
      // hosting route starts a binding move only then (vg-173). Without this
      // the fake response is one the route never moves after.
      res.emit("finish");
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

  it("refuses a stale partial save, and a partial save that stands the guard down", async () => {
    // A save may leave an asset out and name only the base it was built from —
    // so the pair is the whole claim, and both halves of it are what has to be
    // checked over the wire, not only in the store.
    const bytes = new TextEncoder().encode("<svg/>");
    const content: ThemeContent = {
      envelope: {
        ...validEmptyAssetTheme.envelope,
        assets: [
          {
            id: "badge",
            kind: "image",
            path: "assets/badge.svg",
            sha256: createHash("sha256").update(bytes).digest("hex"),
          } as never,
        ],
      },
      assets: { "assets/badge.svg": bytes },
    };
    const opened = await request(
      hosted.server,
      "PUT",
      "/api/themes/living-room",
      themeBody(content),
    );
    const { base } = opened.json() as { base: string };

    // A second tab saves over it, and the badge with it.
    const theirs = await request(
      hosted.server,
      "PUT",
      "/api/themes/living-room",
      themeBody(
        {
          ...content,
          envelope: {
            ...content.envelope,
            metadata: { name: "Edited elsewhere", themeLanguage: "en" },
          },
        },
        { base },
      ),
    );
    expect(theirs.status).toBe(200);

    // The stale tab sends no bytes at all for the badge it believes the folder
    // holds. 409, exactly as it would have been with them: a short payload is
    // not a way past the guard, it is only a way to have said less.
    const stale = await request(
      hosted.server,
      "PUT",
      "/api/themes/living-room",
      themeBody({ envelope: content.envelope, assets: {} }, { base }),
    );
    expect(stale.status).toBe(409);
    expect(stale.text()).toContain("changed by someone else");
    // Nothing was written, so the other author's theme is still the one stored.
    expect(
      (
        (
          await request(hosted.server, "GET", "/api/themes/living-room")
        ).json() as { envelope: { metadata?: { name?: string } } }
      ).envelope.metadata?.name,
    ).toBe("Edited elsewhere");

    // The other road past the guard is not a road a short payload may take:
    // what is on disk is no longer the document that save came from.
    const forced = await request(
      hosted.server,
      "PUT",
      "/api/themes/living-room",
      themeBody(
        { envelope: content.envelope, assets: {} },
        {
          base,
          overwrite: true,
        },
      ),
    );
    expect(forced.status).toBe(400);
    expect(forced.text()).toContain("exactly match");

    // And on the base the save *is* built from, that same empty payload is a
    // whole theme: the asset comes from the folder, not from the wire.
    const fresh = await request(
      hosted.server,
      "PUT",
      "/api/themes/living-room",
      themeBody(
        { envelope: content.envelope, assets: {} },
        { base: (theirs.json() as { base: string }).base },
      ),
    );
    expect(fresh.status).toBe(200);
    expect(
      (await request(hosted.server, "GET", "/api/themes/living-room")).json(),
    ).toMatchObject({ assets: { "assets/badge.svg": btoa("<svg/>") } });
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

  it("answers a theme it will not store with the same 413 it already used, and the reason", async () => {
    await request(
      hosted.server,
      "PUT",
      "/api/themes/living-room",
      themeBody(validEmptyAssetTheme),
    );
    const document = validEmptyAssetTheme.envelope;

    // 413 is what this route already answers an oversized body with, so the
    // refusal is a shape the client has seen: a well-formed theme the store
    // will not hold, not a malformed request and not a conflict.
    const tooMany = await request(
      hosted.server,
      "PUT",
      "/api/themes/living-room",
      themeBody({
        envelope: {
          ...document,
          assets: Array.from({ length: 129 }, (_unused, index) => ({
            id: `asset-${index}`,
            kind: "image",
            path: `assets/a${index}.png`,
          })),
        },
        assets: Object.fromEntries(
          Array.from({ length: 129 }, (_unused, index) => [
            `assets/a${index}.png`,
            new Uint8Array(1),
          ]),
        ),
      }),
    );
    expect(tooMany.status).toBe(413);
    expect(tooMany.text()).toContain("at most 128");

    // Nothing was stored, so the theme that was there is still openable.
    expect(
      (await request(hosted.server, "GET", "/api/themes/living-room")).status,
    ).toBe(200);
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

  it("moves a theme to the trash on DELETE, and takes it out of the listing", async () => {
    const trashed: string[] = [];
    const dir = await fs.mkdtemp(
      path.join(os.tmpdir(), "vigilia-host-delete-test-"),
    );
    // The real trash is a child process and a real recycle bin; what is under
    // test here is the route and the store's decision, so the platform is
    // replaced with a rename into a scratch folder beside the library.
    const store = createThemeStore(dir, {
      trash: async (folder: string) => {
        trashed.push(folder);
        await fs.mkdir(path.join(dir, ".trashed"), { recursive: true });
        await fs.rename(
          folder,
          path.join(dir, ".trashed", path.basename(folder)),
        );
      },
    });
    const deleting = createHostServer({
      registry: new ProviderRegistry([]),
      bundles: { player: dir, editor: dir },
      themeStore: store,
    });

    try {
      await request(
        deleting.server,
        "PUT",
        "/api/themes/living-room",
        themeBody(validEmptyAssetTheme),
      );
      const res = await request(
        deleting.server,
        "DELETE",
        "/api/themes/living-room",
      );

      expect(res.status).toBe(200);
      // The route hands the folder to the trash and does nothing else itself,
      // which is the whole recovery claim (docs/decisions/0021).
      expect(trashed).toEqual([path.join(dir, "living-room")]);
      const list = await request(deleting.server, "GET", "/api/themes");
      expect(
        (list.json() as { themes: readonly { id: string }[] }).themes,
      ).toEqual([]);
    } finally {
      await deleting.close();
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("forbids DELETE from non-loopback, and 404s a theme it will not remove", async () => {
    await request(
      hosted.server,
      "PUT",
      "/api/themes/living-room",
      themeBody(validEmptyAssetTheme),
    );

    // Removing authored work is this PC's business, like saving it.
    expect(
      (
        await request(
          hosted.server,
          "DELETE",
          "/api/themes/living-room",
          undefined,
          {
            remoteAddress: "10.0.0.2",
          },
        )
      ).status,
    ).toBe(403);
    // A folder the listing would never have shown is a 404, not a removal.
    expect(
      (await request(hosted.server, "DELETE", "/api/themes/never-existed"))
        .status,
    ).toBe(404);
    expect(
      (await request(hosted.server, "DELETE", "/api/themes/..%2Fescape"))
        .status,
    ).toBe(400);
    // Still there: the refusals above cost nothing.
    expect(
      (await request(hosted.server, "GET", "/api/themes/living-room")).status,
    ).toBe(200);
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
        fontFavorites: createFontFavoritesStore(lanDir),
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

    it("lets a paired display read this PC's favourites, not change them", async () => {
      const issued = sessions.create("phone");
      const lan = { remoteAddress: "192.168.1.50" };
      const pairedPhone = {
        ...lan,
        headers: { "x-vigilia-session": issued.token },
      };

      // Same asymmetry as `/api/display`, for the same reason: a paired reader
      // is this PC's own reader and may see what it holds.
      expect(
        (
          await request(
            paired.server,
            "GET",
            "/api/font-favorites",
            undefined,
            pairedPhone,
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await request(
            paired.server,
            "GET",
            "/api/font-favorites",
            undefined,
            lan,
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await request(
            paired.server,
            "PUT",
            "/api/font-favorites",
            json({ favorites: ["saas"] }),
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

describe("Font favourite routes", () => {
  let tmpDir: string;
  let hosted: ReturnType<typeof createHostServer>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vigilia-favorites-"));
    hosted = createHostServer({
      registry: new ProviderRegistry([]),
      bundles: { player: tmpDir, editor: tmpDir },
      fontFavorites: createFontFavoritesStore(tmpDir),
    });
  });

  afterEach(async () => {
    await hosted.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("starts with no favourites", async () => {
    expect(
      (await request(hosted.server, "GET", "/api/font-favorites")).json(),
    ).toEqual({ favorites: [] });
  });

  it("stores the ids and reads them back", async () => {
    const res = await request(
      hosted.server,
      "PUT",
      "/api/font-favorites",
      json({ favorites: ["exo-2-alegreya-sans", "saas"] }),
    );

    expect(res.status).toBe(200);
    // The answer is what the editor repaints from, so it must be the stored
    // list rather than an echo of the request.
    expect(res.json()).toEqual({
      favorites: ["exo-2-alegreya-sans", "saas"],
    });
    expect(
      (await request(hosted.server, "GET", "/api/font-favorites")).json(),
    ).toEqual({ favorites: ["exo-2-alegreya-sans", "saas"] });
  });

  it("answers with what it stored, not what it was sent", async () => {
    // A dropped entry must not come back as though the star was kept.
    const res = await request(
      hosted.server,
      "PUT",
      "/api/font-favorites",
      json({ favorites: ["a", "a", "../../escape", 1, "b"] }),
    );

    expect(res.json()).toEqual({ favorites: ["a", "b"] });
    expect(
      (await request(hosted.server, "GET", "/api/font-favorites")).json(),
    ).toEqual({ favorites: ["a", "b"] });
  });

  it("refuses a body that is not JSON", async () => {
    const res = await request(
      hosted.server,
      "PUT",
      "/api/font-favorites",
      "{ not json",
    );

    expect(res.status).toBe(400);
    expect(
      (await request(hosted.server, "GET", "/api/font-favorites")).json(),
    ).toEqual({ favorites: [] });
  });

  it("keeps a favourite on this PC", async () => {
    const lan = { remoteAddress: "192.168.1.50" };

    expect(
      (
        await request(
          hosted.server,
          "GET",
          "/api/font-favorites",
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
          "/api/font-favorites",
          json({ favorites: ["saas"] }),
          lan,
        )
      ).status,
    ).toBe(403);
    // Refused, not stored: a 403 that still wrote would be a silent success.
    expect(
      (await request(hosted.server, "GET", "/api/font-favorites")).json(),
    ).toEqual({ favorites: [] });
  });

  it("supports only GET and PUT", async () => {
    // A DELETE that fell through to the static fallback would also answer 405,
    // so the store is what is asked: a second star in the list proves the route
    // answered rather than some later handler.
    await request(
      hosted.server,
      "PUT",
      "/api/font-favorites",
      json({ favorites: ["saas"] }),
    );
    const res = await request(hosted.server, "DELETE", "/api/font-favorites");

    expect(res.status).toBe(405);
    // Refused, not acted on: a 405 that still cleared the list would be a lie.
    expect(
      (await request(hosted.server, "GET", "/api/font-favorites")).json(),
    ).toEqual({ favorites: ["saas"] });
  });

  it("reports a host that keeps no favourites", async () => {
    const bare = createHostServer({
      registry: new ProviderRegistry([]),
      bundles: { player: tmpDir, editor: tmpDir },
    });
    try {
      const res = await request(bare.server, "GET", "/api/font-favorites");

      expect(res.status).toBe(404);
      // An unknown path also 404s here, from the static fallback, so the status
      // alone cannot tell this route's own "not enabled" from "no such route".
      expect(res.text()).toContain("not enabled");
    } finally {
      await bare.close();
    }
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

describe("A bundle 404 names the cause it can prove", () => {
  const dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
    );
  });

  async function server(
    built: boolean,
  ): Promise<ReturnType<typeof createHostServer>> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vigilia-404-"));
    dirs.push(dir);
    if (built) {
      await fs.writeFile(path.join(dir, "index.html"), "<!doctype html>");
    }
    return createHostServer({
      registry: new ProviderRegistry([]),
      bundles: { player: dir, editor: dir },
    });
  }

  it("does not tell a reader to rebuild a bundle that is built", async () => {
    const hosted = await server(true);
    try {
      const res = await request(hosted.server, "GET", "/assets/missing.js");
      expect(res.status).toBe(404);
      // The build hint is right exactly when there is no build. Sending it here
      // is the loop ADR-0018 describes: rebuild, ask again, same answer.
      expect(res.text()).not.toContain("is not built");
    } finally {
      await hosted.close();
    }
  });

  it("still says which build to run when the bundle really is unbuilt", async () => {
    const hosted = await server(false);
    try {
      const res = await request(
        hosted.server,
        "GET",
        "/editor/assets/missing.js",
      );
      expect(res.status).toBe(404);
      expect(res.text()).toContain("packages/editor");
    } finally {
      await hosted.close();
    }
  });
});

describe("A path the player does not declare is not the player", () => {
  const dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
    );
  });

  it("404s a mistyped display URL instead of serving a working dashboard", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vigilia-player-"));
    dirs.push(dir);
    await fs.writeFile(
      path.join(dir, "index.html"),
      "<!doctype html><title>player</title>",
    );
    await fs.writeFile(
      path.join(dir, "favicon.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg" />',
    );
    const hosted = createHostServer({
      registry: new ProviderRegistry([]),
      bundles: { player: dir, editor: dir },
    });
    try {
      const status = (path: string): Promise<number> =>
        request(hosted.server, "GET", path).then((res) => res.status);

      // `?data=live` skips the theme resolution above and goes straight to the
      // bundle, which is the path under test. A bare `/` would answer with
      // whatever the theme store holds, which is not what this is about.
      await expect(status("/?data=live")).resolves.toBe(200);
      await expect(status("/favicon.svg")).resolves.toBe(200);
      // The two names an operator plausibly mistypes for a display URL.
      await expect(status("/play")).resolves.toBe(404);
      await expect(status("/display")).resolves.toBe(404);
      // Both answers are the honest 404, not a build hint that is not true.
      const miss = await request(hosted.server, "GET", "/play");
      expect(miss.text()).toBe("Not found.");
    } finally {
      await hosted.close();
    }
  });
});

describe("a pairing guard protects dashboard content, not the bundle", () => {
  /** A bundle file is served to anything that asks; content is not. */
  it("serves the bundle to an unpaired device and refuses everything else", async () => {
    const bundle = await fs.mkdtemp(path.join(os.tmpdir(), "vigilia-bundle-"));
    const themes = await fs.mkdtemp(path.join(os.tmpdir(), "vigilia-themes-"));
    // Where a bundle actually keeps them: under its own `assets/`.
    await fs.mkdir(path.join(bundle, "assets"), { recursive: true });
    await fs.writeFile(
      path.join(bundle, "assets", "index-abc123.js"),
      "export const x = 1;",
    );
    await fs.writeFile(path.join(bundle, "favicon.svg"), "<svg/>");
    const hosted = createHostServer({
      registry: new ProviderRegistry([]),
      bundles: { player: bundle, editor: bundle },
      themeStore: createThemeStore(themes),
      sessions: createSessionStore(),
    });
    const lan = { remoteAddress: "192.168.2.56" };
    try {
      // A session token rides in the query string, because `fetch` and
      // `EventSource` carry one and `<script src>` cannot — so a paired phone
      // was served the document and then refused its own scripts.
      expect(
        (
          await request(
            hosted.server,
            "GET",
            "/assets/index-abc123.js",
            undefined,
            lan,
          )
        ).status,
      ).toBe(200);
      expect(
        (await request(hosted.server, "GET", "/favicon.svg", undefined, lan))
          .status,
      ).toBe(200);
      // Everything the guard exists for stays behind it.
      // `/api/display` is absent here — this server has no display store — and
      // a 404 for a route that does not exist is not the guard refusing, so the
      // paths below are the ones this harness can actually ask about.
      for (const path of ["/api/themes", "/editor/"]) {
        expect(
          (await request(hosted.server, "GET", path, undefined, lan)).status,
          path,
        ).toBe(403);
      }
    } finally {
      await hosted.close();
      await fs.rm(bundle, { recursive: true, force: true });
      await fs.rm(themes, { recursive: true, force: true });
    }
  });
});

describe("The hosting route answers where a phone should point (§145)", () => {
  let hostingDir: string;
  let hosted: ReturnType<typeof createHostServer>;

  beforeEach(async () => {
    hostingDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "vigilia-host-hosting-test-"),
    );
  });

  /** `/api/hosting` reads no theme, so the bundles are only a temp directory. */
  function build(
    options: Omit<HostServerOptions, "registry" | "bundles" | "themeStore">,
  ): void {
    hosted = createHostServer({
      registry: new ProviderRegistry([]),
      bundles: { player: hostingDir, editor: hostingDir },
      themeStore: createThemeStore(hostingDir),
      ...options,
    });
  }

  /** A binding that reports one state and moves nothing. The route's own shape
   *  is what these cases are about; the socket that actually moves is
   *  `cli/hosting.test.ts`'s and the real-socket case below. */
  function stillBinding(
    state: HostingState,
    setLan: HostBinding["setLan"] = async () => ({ ok: true }),
  ): HostBinding {
    return { state: () => state, setLan, idle: async () => {} };
  }

  afterEach(async () => {
    await hosted.close();
    await fs.rm(hostingDir, { recursive: true, force: true });
  });

  it("answers where a phone should go, and nothing else", async () => {
    const store = createSessionStore({ randomToken: () => "t".repeat(43) });
    build({
      hosting: stillBinding({
        lan: true,
        address: "192.168.1.42",
        port: 5227,
        refusal: null,
      }),
      sessions: store,
    });

    const answered = await request(hosted.server, "GET", "/api/hosting");
    expect(answered.status).toBe(200);
    expect(answered.json()).toEqual({
      lan: true,
      address: "192.168.1.42",
      port: 5227,
      refusal: null,
      sessions: [],
    });

    // A token is a credential, and `DisplaySession` carries one — so a route
    // that forwards `list()` unchanged hands it back. An assertion over an
    // empty list passes for that implementation and for a redacting one alike,
    // which is why this mints: without a session present, the test cannot tell
    // them apart.
    store.create("Kitchen phone");
    const withOne = await request(hosted.server, "GET", "/api/hosting");
    const peers = (
      withOne.json() as { sessions: readonly Record<string, unknown>[] }
    ).sessions;
    expect(peers).toHaveLength(1);
    expect(peers[0]).not.toHaveProperty("token");
    expect(JSON.stringify(peers)).not.toContain("t".repeat(43));
  });

  it("keeps hosting settings on this PC", async () => {
    build({
      hosting: stillBinding({
        lan: true,
        address: "192.168.1.42",
        port: 5227,
        refusal: null,
      }),
    });

    const answered = await request(
      hosted.server,
      "GET",
      "/api/hosting",
      undefined,
      { remoteAddress: "192.168.1.50" },
    );
    expect(answered.status).toBe(403);
  });

  it("answers loopback with nothing hosted when it was told nothing", async () => {
    build({});

    const answered = await request(hosted.server, "GET", "/api/hosting");
    expect(answered.json()).toEqual({
      lan: false,
      address: null,
      port: null,
      refusal: null,
      sessions: [],
    });
  });

  it("answers with the state it has now, and moves the binding only after", async () => {
    let lan = false;
    let remembered: boolean | undefined;
    build({
      hosting: {
        state: () => ({
          lan,
          address: lan ? "192.168.1.42" : null,
          port: 5227,
          refusal: null,
        }),
        setLan: async (on) => {
          lan = on;
          return { ok: true };
        },
        idle: async () => {},
      },
      rememberLan: async (on) => {
        remembered = on;
      },
    });

    const answered = await request(
      hosted.server,
      "PUT",
      "/api/hosting",
      JSON.stringify({ lan: true }),
    );

    // The answer is where the host is *now*, because it cannot be rebound while
    // this response is still on its socket — so it carries no verdict on the
    // move. The client reads where it landed from the GET that follows.
    expect(answered.status).toBe(200);
    expect(answered.json()).toEqual({
      lan: false,
      address: null,
      port: 5227,
      refusal: null,
      sessions: [],
    });

    // And the move does happen, once that answer has finished.
    await vi.waitFor(() => expect(remembered).toBe(true));
    expect(lan).toBe(true);
  });

  it("refuses to move the binding for anything but this PC", async () => {
    let moved = false;
    build({
      hosting: stillBinding(
        { lan: false, address: null, port: 5227, refusal: null },
        async () => {
          moved = true;
          return { ok: true };
        },
      ),
    });

    const answered = await request(
      hosted.server,
      "PUT",
      "/api/hosting",
      JSON.stringify({ lan: true }),
      { remoteAddress: "10.0.0.2" },
    );

    expect(answered.status).toBe(403);
    expect(moved).toBe(false);
  });

  it("reports a refused move through the read that follows it, and remembers nothing", async () => {
    let refusal: string | null = null;
    let remembered = false;
    build({
      hosting: {
        state: () => ({ lan: false, address: null, port: 5227, refusal }),
        setLan: async () => {
          refusal = "Port 5227 is not free on 0.0.0.0: EADDRINUSE";
          return { ok: false, reason: refusal };
        },
        idle: async () => {},
      },
      rememberLan: async () => {
        remembered = true;
      },
    });

    const answered = await request(
      hosted.server,
      "PUT",
      "/api/hosting",
      JSON.stringify({ lan: true }),
    );

    // The answer predates the move and carries no verdict on it, which is the
    // whole of vg-173: the host's own words about a socket it would not take
    // cannot be in the response that asked it to take one.
    expect(answered.status).toBe(200);
    expect(answered.json()).toMatchObject({ lan: false, refusal: null });

    await vi.waitFor(() => expect(refusal).not.toBeNull());
    const after = await request(hosted.server, "GET", "/api/hosting");

    // Read from the route that follows, which is where the editor shows it.
    expect(after.json()).toMatchObject({
      lan: false,
      refusal: "Port 5227 is not free on 0.0.0.0: EADDRINUSE",
    });
    expect(remembered).toBe(false);
  });

  it("waits for a move in flight before it says where the host is", async () => {
    let answered = false;
    let settle: (() => void) | undefined;
    const inFlight = new Promise<void>((resolve) => {
      settle = resolve;
    });
    build({
      hosting: {
        state: () => ({
          lan: true,
          address: "192.168.1.42",
          port: 5227,
          refusal: null,
        }),
        setLan: async () => ({ ok: true }),
        idle: async () => inFlight,
      },
    });

    const reading = request(hosted.server, "GET", "/api/hosting").then(() => {
      answered = true;
    });

    // A reader that follows a move must see where the host landed, not where it
    // started — and mid-move it is not bound at all, so answering here would
    // report the binding that is on its way out.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(answered).toBe(false);

    settle?.();
    await reading;
    expect(answered).toBe(true);
  });
});

/**
 * `vg-173`. The defect is a real socket: the response is owed on the connection
 * the move destroys, and none of that reproduces against the fake
 * request/response the rest of this file drives the handler with — an emitted
 * `request` event has no connection to lose. So this is a listening server and
 * a real `createHostBinding`, reached with `fetch`.
 */
describe("A LAN move answers before the socket it moves (vg-173)", () => {
  let moveDir: string;
  let hosted: ReturnType<typeof createHostServer>;

  beforeEach(async () => {
    moveDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "vigilia-host-move-test-"),
    );
  });

  afterEach(async () => {
    // `fetch` leaves a keep-alive socket, and `close()` waits for connections,
    // so a teardown that only closed the server would hang on its own client.
    hosted.server.closeAllConnections();
    await hosted.close();
    await fs.rm(moveDir, { recursive: true, force: true });
  });

  /** A host on a real port, with a binding that can actually move it. The
   *  binding needs the port, and the port needs the server, so the binding is
   *  handed over once both exist. */
  async function listeningHost(): Promise<number> {
    const held: { binding?: HostBinding } = {};
    hosted = createHostServer({
      registry: new ProviderRegistry([]),
      bundles: { player: moveDir, editor: moveDir },
      themeStore: createThemeStore(moveDir),
      get hosting() {
        return held.binding;
      },
    });

    const port = await new Promise<number>((resolve, reject) => {
      hosted.server.once("error", reject);
      hosted.server.listen(0, "127.0.0.1", () => {
        const address = hosted.server.address();
        resolve(
          typeof address === "object" && address !== null ? address.port : 0,
        );
      });
    });

    held.binding = createHostBinding(hosted.server, {
      port,
      host: "127.0.0.1",
    });
    return port;
  }

  it("answers a PUT that moves the binding", async () => {
    const port = await listeningHost();

    // The response is owed on the connection the move destroys, so a host that
    // tears down first answers nothing at all: `fetch` rejects with an empty
    // reply rather than returning a status. This is vg-173.
    const answered = await fetch(`http://127.0.0.1:${port}/api/hosting`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lan: true }),
    });

    expect(answered.status).toBe(200);
    await expect(answered.json()).resolves.toMatchObject({
      lan: expect.any(Boolean),
    });

    // And the move itself still happened, read back through the route that
    // waits for it: a 200 that moved nothing would pass the assertion above.
    const after = await (
      await fetch(`http://127.0.0.1:${port}/api/hosting`)
    ).json();
    expect(after).toMatchObject({ lan: true, refusal: null });
  });
});

describe("The publish route", () => {
  it("publishes a theme this library has, and says no to everything else", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vigilia-publish-"));
    const hosted = createHostServer({
      registry: new ProviderRegistry([]),
      bundles: { player: dir, editor: dir },
      themeStore: createThemeStore(dir),
    });

    try {
      // The assets a display fetches come from the theme's own folder, so there
      // has to be a folder before anything can be published against it.
      await request(
        hosted.server,
        "PUT",
        "/api/themes/living-room",
        themeBody(createValidPackage()),
      );
      const body = themeBody(createValidPackage());

      // No id at all is the caller's mistake, and it says so.
      const missing = await request(hosted.server, "PUT", "/api/publish", body);
      expect(missing.status).toBe(400);

      // A well-formed id this library does not have is a different answer.
      const unknown = await request(
        hosted.server,
        "PUT",
        "/api/publish?id=kitchen",
        body,
      );
      expect(unknown.status).toBe(404);

      // A document whose own id disagrees with the id it would be served under
      // is refused, exactly as a save refuses it — publishing bypasses `write`,
      // so this is the only place that check can live.
      const mismatched = await request(
        hosted.server,
        "PUT",
        "/api/publish?id=living-room",
        themeBody(createValidPackage("kitchen")),
      );
      expect(mismatched.status).toBe(400);

      const published = await request(
        hosted.server,
        "PUT",
        "/api/publish?id=living-room",
        body,
      );
      expect(published.status).toBe(200);
      expect(published.json()).toMatchObject({ ok: true, id: "living-room" });

      // The LAN is refused the whole surface, not just the body.
      const fromTheLan = await request(
        hosted.server,
        "PUT",
        "/api/publish?id=living-room",
        body,
        { remoteAddress: "10.0.0.2" },
      );
      expect(fromTheLan.status).toBe(403);

      const stop = await request(hosted.server, "DELETE", "/api/publish");
      expect(stop.json()).toMatchObject({ ok: true, id: null });
      expect(
        (await request(hosted.server, "GET", "/api/publish")).json(),
      ).toMatchObject({ id: null });
    } finally {
      await hosted.close();
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("refuses a document it cannot validate", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vigilia-publish-"));
    const hosted = createHostServer({
      registry: new ProviderRegistry([]),
      bundles: { player: dir, editor: dir },
      themeStore: createThemeStore(dir),
    });

    try {
      await request(
        hosted.server,
        "PUT",
        "/api/themes/living-room",
        themeBody(createValidPackage()),
      );

      // `decodeThemeSave` accepts this — it checks that the envelope is an
      // object and nothing more — so it is the overlay's own validator that
      // must refuse it. That is the point of the case.
      //
      // **The envelope keeps the id it is published under, and that is
      // load-bearing.** The body here used to be `{ schemaVersion: 99 }`, with
      // no id at all, and that is refused by the id-agreement check a few lines
      // above — so the case proved the *id* guard worked and said nothing about
      // the validator. Deleting the validator branch outright still left it
      // green. Matching ids leave the validator as the only thing that can
      // refuse this, and the message is asserted for the same reason: the two
      // guards answer 400 with different words.
      const wire = JSON.parse(themeBody(createValidPackage())) as {
        envelope: Record<string, unknown>;
        assets: unknown;
      };
      wire.envelope["schemaVersion"] = 99;

      const bad = await request(
        hosted.server,
        "PUT",
        "/api/publish?id=living-room",
        JSON.stringify(wire),
      );
      expect(bad.status).toBe(400);
      expect(bad.text()).toContain("schema 99");
    } finally {
      await hosted.close();
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("refuses a paired display, so a phone cannot cause a publish", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vigilia-publish-"));
    const sessions = createSessionStore();
    const hosted = createHostServer({
      registry: new ProviderRegistry([]),
      bundles: { player: dir, editor: dir },
      themeStore: createThemeStore(dir),
      sessions,
    });

    try {
      // A paired display is the caller that matters here: it is the one the
      // display guard *lets through*, so this route's own loopback check is the
      // only thing left between a phone and the publish surface. An unpaired
      // LAN request never reaches it — that one is refused a few hundred lines
      // earlier by `This display is not paired with the host.`, which is why a
      // test using a bare remoteAddress cannot tell the two guards apart.
      //
      // No theme is seeded on purpose: the refusal comes before the body is
      // decoded, so a 404 here would mean the guard had been passed.
      const issued = sessions.create("phone");
      const fromThePhone = await request(
        hosted.server,
        "PUT",
        "/api/publish?id=living-room",
        themeBody(createValidPackage()),
        {
          remoteAddress: "192.168.1.50",
          headers: { "x-vigilia-session": issued.token },
        },
      );

      expect(fromThePhone.status).toBe(403);
      expect(fromThePhone.text()).toContain("this PC only");
    } finally {
      await hosted.close();
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
