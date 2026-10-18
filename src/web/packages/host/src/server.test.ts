import {
  type ChildProcess,
  type SpawnOptions,
  spawn,
} from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import net, { type AddressInfo, type Socket } from "node:net";
import os from "node:os";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import {
  createAssetResolver,
  type FabricThemeEnvelope,
  SAMPLE_STREAM_PATH,
} from "@vigilia/renderer-core";
import { writeThemePackage } from "@vigilia/theme-package";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHostBinding, type HostBinding } from "./cli/hosting.js";
import { type ListenableServer, listenWithFallback } from "./cli/net.js";
import type { DeviceAssignment } from "./providers/lhm-mapping.js";
import { ProviderRegistry } from "./providers/registry.js";
import { createDisplayLauncher } from "./serve/display-launcher.js";
import {
  CA_CERTIFICATE_PATH,
  createHostServer,
  type HostingState,
  type HostServerOptions,
} from "./server.js";
import { newToken } from "./session/pairing.js";
import { createPairingCodeStore } from "./session/pairing-code.js";
import { createActiveThemeStore } from "./settings/active-theme.js";
import {
  ASSIGNABLE_GROUPS,
  createDeviceSettingsStore,
} from "./settings/devices.js";
import { createDisplaySettingsStore } from "./settings/display.js";
import {
  createDisplayStore,
  hashToken,
  LOCAL_DISPLAY_ID,
} from "./settings/displays.js";
import { createFontFavoritesStore } from "./settings/font-favorites.js";
import type { HostRecord } from "./settings/host-record.js";
import type { Monitor } from "./settings/monitors.js";
import { createThemeSettingsStore } from "./settings/theme-settings.js";
import { createThemeStore, type ThemeContent } from "./themes/store.js";
import { encodeThemeContent } from "./themes/wire.js";
import { createSecureOrigin } from "./tls/authority.js";

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
  server: ListenableServer,
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
  server: ListenableServer,
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

  it("answers a stored theme that does not validate with 422, and an absent one with 404", async () => {
    // vg-110: the store answered the same `undefined` for a theme that is not
    // there and one that is there and does not validate, so both were a 404 and
    // the author was told a theme they can see on disk does not exist. The two
    // facts are different answers now — 422 carrying the validator's issues,
    // 404 for the id that is not there (ADR-0043).
    await fs.mkdir(path.join(tmpDir, "broken"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, "broken", "theme.json"),
      JSON.stringify({ id: "broken" }),
    );

    const broken = await request(hosted.server, "GET", "/api/themes/broken");
    expect(broken.status).toBe(422);
    const body = broken.json() as { issues: readonly { path: string }[] };
    expect(body.issues[0]?.path).toBe("/schemaVersion");

    expect(
      (await request(hosted.server, "GET", "/api/themes/absent")).status,
    ).toBe(404);

    // A display's document route treats it as absent, not as a server fault —
    // a corrupt theme must not turn a page into a 500.
    expect(
      (await request(hosted.server, "GET", "/api/themes/broken/document"))
        .status,
    ).toBe(404);

    // And it is not a library line.
    const list = (
      await request(hosted.server, "GET", "/api/themes")
    ).json() as {
      themes: readonly { id: string }[];
    };
    expect(list.themes.map((entry) => entry.id)).not.toContain("broken");
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

  describe("LAN displays authenticate with their own credential (§145)", () => {
    let displays: ReturnType<typeof createDisplayStore>;
    let paired: ReturnType<typeof createHostServer>;
    let lanDir: string;

    /** Pairs a display and answers the credential it holds, which is the one
     *  thing a paired phone has and the host only ever sees hashed. */
    async function pair(label = "phone"): Promise<string> {
      const token = newToken();
      await displays.create(label, token);
      return token;
    }

    beforeEach(async () => {
      lanDir = await fs.mkdtemp(
        path.join(os.tmpdir(), "vigilia-host-lan-test-"),
      );
      displays = createDisplayStore(lanDir);
      paired = createHostServer({
        registry: new ProviderRegistry([]),
        bundles: { player: lanDir, editor: lanDir },
        themeStore: createThemeStore(lanDir),
        display: createDisplaySettingsStore(lanDir),
        fontFavorites: createFontFavoritesStore(lanDir),
        displays,
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

    it("refuses LAN display reads without a credential", async () => {
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

    it("accepts a LAN display holding a live credential, by header or query", async () => {
      const token = await pair();
      const lan = { remoteAddress: "192.168.1.50" };

      expect(
        (
          await request(paired.server, "GET", "/api/themes", undefined, {
            ...lan,
            headers: { "x-vigilia-session": token },
          })
        ).status,
      ).toBe(200);

      // The stream is gated by the same check, so a query credential is accepted
      // (EventSource cannot set headers) and a missing one is refused. The
      // accepted stream is never awaited: it stays open by design.
      expect(
        (
          await streamStatus(
            paired.server,
            `/ws?keys=cpu.load&session=${encodeURIComponent(token)}`,
          )
        ).status,
      ).toBe(200);
      expect(
        (await streamStatus(paired.server, "/ws?keys=cpu.load")).status,
      ).toBe(403);
    });

    it("lets a paired display read this PC's preferences, not change them", async () => {
      const token = await pair();
      const lan = { remoteAddress: "192.168.1.50" };
      const pairedPhone = {
        ...lan,
        headers: { "x-vigilia-session": token },
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
      const token = await pair();
      const lan = { remoteAddress: "192.168.1.50" };
      const pairedPhone = {
        ...lan,
        headers: { "x-vigilia-session": token },
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

    it("refuses a credential the host has removed", async () => {
      const token = await pair();
      // Ruling 12 collapses revoking into removing, so the act is the display's
      // removal and the credential goes with the record (the case that used to
      // drive `DELETE /api/pairing/sessions/:token`, retired with the session
      // store).
      const held = await displays.authenticate(token);
      const removed = await request(
        paired.server,
        "DELETE",
        `/api/displays/${held?.id ?? ""}`,
      );
      expect(removed.status).toBe(200);

      expect(
        (
          await request(paired.server, "GET", "/api/themes", undefined, {
            remoteAddress: "192.168.1.50",
            headers: { "x-vigilia-session": token },
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
      const body = minted.json() as {
        display: { id: string };
        token: string;
      };
      expect(body.display.id).toBe("display");
      expect(body.token).toBeTruthy();
      // The one moment the credential exists in the clear. The list below never
      // carries it, because the record only ever holds its hash.
      expect((await displays.authenticate(body.token))?.id).toBe(
        body.display.id,
      );
    });

    it("still treats loopback as trusted admin, with no credential", async () => {
      expect((await request(paired.server, "GET", "/api/themes")).status).toBe(
        200,
      );
    });

    it("reports pairing availability through /api/health", async () => {
      const health = await request(paired.server, "GET", "/api/health");
      expect((health.json() as { pairing: boolean }).pairing).toBe(true);
    });
  });

  /**
   * The one route an unpaired client may read, and the reason a display that has
   * lost its host's address can find it again (R23–R25). What these cases hold is
   * the promise that makes the exemption safe: the body is the identity and the
   * port, and nothing else this host holds.
   */
  describe("The host route `/api/host` answers who this host is, and nothing else", () => {
    let hostDir: string;
    let hosted: ReturnType<typeof createHostServer>;
    let displays: ReturnType<typeof createDisplayStore>;
    let occupier: net.Server | undefined;

    /** The identity a display would have stored for this host. */
    const record: HostRecord = { id: "3f9a1c0b7d2e4a68", name: "Study PC" };

    beforeEach(async () => {
      hostDir = await fs.mkdtemp(
        path.join(os.tmpdir(), "vigilia-host-identity-test-"),
      );
      displays = createDisplayStore(hostDir);
    });

    afterEach(async () => {
      if (occupier !== undefined) {
        await new Promise<void>((resolve) => {
          occupier?.close(() => resolve());
        });
        occupier = undefined;
      }
      // `fetch` leaves a keep-alive socket and `close()` waits for connections,
      // so a teardown that only closed the server would hang on its own client.
      hosted.server.closeAllConnections();
      await hosted.close();
      await fs.rm(hostDir, { recursive: true, force: true });
    });

    /** The route reads no theme, so the bundles are only a temp directory. */
    function build(
      options: Omit<
        HostServerOptions,
        "registry" | "bundles" | "themeStore"
      > = {},
    ): void {
      hosted = createHostServer({
        registry: new ProviderRegistry([]),
        bundles: { player: hostDir, editor: hostDir },
        themeStore: createThemeStore(hostDir),
        ...options,
      });
    }

    it("answers an unpaired caller with the identity and nothing else", async () => {
      build({ host: record });

      const answered = await request(
        hosted.server,
        "GET",
        "/api/host",
        undefined,
        { remoteAddress: "192.168.1.50" },
      );

      expect(answered.status).toBe(200);
      expect(answered.json()).toEqual({
        id: record.id,
        name: record.name,
        // Not listening in this harness, which is the honest answer rather than
        // a port invented for the field.
        port: null,
      });
      // Exactly these three, so a field added for another route's sake cannot
      // ride along unseen: the exemption is for this body and no wider.
      expect(
        Object.keys(answered.json() as Record<string, unknown>).sort(),
      ).toEqual(["id", "name", "port"]);
    });

    it("is readable cross-origin, because a re-find sweep is cross-origin", async () => {
      build({ host: record });

      const answered = await request(
        hosted.server,
        "GET",
        "/api/host",
        undefined,
        { remoteAddress: "192.168.1.50" },
      );

      expect(answered.headers["access-control-allow-origin"]).toBe("*");
      // A wildcard origin with credentials is refused by a browser, and a sweep
      // sends none: this header would only invite a later reader to send the
      // token cross-origin.
      expect(answered.headers).not.toHaveProperty(
        "access-control-allow-credentials",
      );
    });

    it("does not leak the credential or the display list", async () => {
      build({ host: record, displays });

      const tokens = [newToken(), newToken()];
      await displays.create("Kitchen phone", tokens[0] ?? "");
      await displays.create("Hallway phone", tokens[1] ?? "");

      const answered = await request(
        hosted.server,
        "GET",
        "/api/host",
        undefined,
        { remoteAddress: "192.168.1.50" },
      );
      const bytes = answered.text();

      expect(
        Object.keys(answered.json() as Record<string, unknown>).sort(),
      ).toEqual(["id", "name", "port"]);

      // Neither the credential nor the hash it is stored as: the route answers
      // about who this host is, not about who is paired with it.
      for (const token of tokens) {
        expect(bytes).not.toContain(token);
        expect(bytes).not.toContain(hashToken(token));
      }
    });

    it("answers the port it is actually listening on, not one it was given", async () => {
      // Two sources could be mistaken for the port — the binding's state and the
      // port the host was asked to take — so both are made to differ from the
      // socket: the binding reports 1, and the port asked for is held by another
      // listener, so the host falls back to the next one.
      build({
        host: record,
        hosting: {
          state: async () => ({
            lan: false,
            address: null,
            port: 1,
            refusal: null,
          }),
          setLan: async () => ({ ok: true }),
          idle: async () => {},
        },
      });

      occupier = net.createServer();
      const held = await new Promise<number>((resolve, reject) => {
        occupier?.once("error", reject);
        occupier?.listen(0, "127.0.0.1", () => {
          const address = occupier?.address();
          resolve(
            typeof address === "object" && address !== null ? address.port : 0,
          );
        });
      });

      const bound = await listenWithFallback(hosted.server, held, "127.0.0.1");
      expect(bound).not.toBe(held);

      const answered = await request(hosted.server, "GET", "/api/host");

      // The port in the answer is the one in the URL a display would dial, which
      // is what a re-find needs: the fallback port, not the one asked for.
      expect(answered.json()).toMatchObject({ port: bound });

      // And over a real socket, where the header's precedence is Node's rather
      // than the harness's: `writeHead` keeps a name it does not set, so what
      // was set before `sendJson` is on the wire.
      const real = await fetch(`http://127.0.0.1:${bound}/api/host`);
      expect(real.headers.get("access-control-allow-origin")).toBe("*");
      await expect(real.json()).resolves.toMatchObject({ port: bound });
    });

    it("answers 404 like any unknown path when this host has no identity", async () => {
      // No `host` option: the route is not registered at all. An id minted to
      // fill the answer would be an identity no display could have stored, and a
      // host with nothing to say should not be found by a sweep.
      build({});

      const answered = await request(hosted.server, "GET", "/api/host");

      expect(answered.status).toBe(404);
    });

    it("is read before the display guard, by a caller refused beside it", async () => {
      build({ host: record, displays });
      const lan = { remoteAddress: "192.168.1.50" };

      // Unpaired and off-loopback, which is exactly the caller a re-find sweep
      // is: the route answers it, while the same caller is refused on the
      // guarded route beside it. A route registered after that guard would
      // answer 403 here rather than the identity.
      expect(
        (await request(hosted.server, "GET", "/api/host", undefined, lan))
          .status,
      ).toBe(200);
      expect(
        (await request(hosted.server, "GET", "/api/themes", undefined, lan))
          .status,
      ).toBe(403);
    });
  });

  it("refuses LAN display reads when the host has no display store", async () => {
    await request(
      hosted.server,
      "PUT",
      "/api/themes/living-room",
      themeBody(validEmptyAssetTheme),
    );

    // Without a display store this host is loopback-only by construction, so a
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

/**
 * Ruling 12: a pairing lasts until the host removes the client, so the credential
 * is the display record's and a restart is not a re-pairing. These cases build a
 * **second** server over the same settings directory, which is the only way to
 * tell a durable credential from a session that happened to still be live.
 */
describe("A display's credential outlives the host that minted it", () => {
  let settingsDir: string;
  let running: ReturnType<typeof createHostServer> | undefined;

  beforeEach(async () => {
    settingsDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "vigilia-display-credential-"),
    );
  });

  afterEach(async () => {
    await running?.close();
    await fs.rm(settingsDir, { recursive: true, force: true });
  });

  /** A launch over `settingsDir`, with one theme to read back. */
  async function launch(): Promise<ReturnType<typeof createHostServer>> {
    const hosted = createHostServer({
      registry: new ProviderRegistry([]),
      bundles: { player: settingsDir, editor: settingsDir },
      themeStore: createThemeStore(settingsDir),
      displays: createDisplayStore(settingsDir),
    });

    await request(
      hosted.server,
      "PUT",
      "/api/themes/living-room",
      themeBody(createValidPackage()),
    );

    running = hosted;
    return hosted;
  }

  const LAN = { remoteAddress: "192.168.1.50" };

  it("keeps a display paired across a restart, with no code retyped", async () => {
    const first = await launch();
    const minted = await request(
      first.server,
      "POST",
      "/api/pairing/sessions?label=Kitchen+tablet",
    );
    expect(minted.status).toBe(201);
    const { display, token } = minted.json() as {
      display: { id: string };
      token: string;
    };
    expect(display.id).toBe("kitchen-tablet");

    await first.close();

    // A second host, over the same settings directory and nothing else: the
    // credential is the whole of what the phone has.
    const second = await launch();
    const withToken = await request(
      second.server,
      "GET",
      "/api/themes",
      undefined,
      { ...LAN, headers: { "x-vigilia-session": token } },
    );
    expect(withToken.status).toBe(200);
    expect(
      (withToken.json() as { themes: readonly { id: string }[] }).themes.map(
        (theme) => theme.id,
      ),
    ).toEqual(["living-room"]);
  });

  it("refuses a token that no display holds", async () => {
    const hosted = await launch();

    // A 403 and not a 200: an unknown credential is the same refusal a missing
    // one gets, so there is no second refusal path to get wrong.
    expect(
      (
        await request(
          hosted.server,
          "GET",
          `/api/themes?session=${"z".repeat(43)}`,
          undefined,
          LAN,
        )
      ).status,
    ).toBe(403);
  });

  it("does not accept an expired-looking or absent credential", async () => {
    const hosted = await launch();

    // Nothing expires on its own any more, so there is no such thing as a stale
    // credential the host still holds: an absent one, an empty one and one that
    // was never issued are all refused off loopback.
    for (const path of ["/api/themes", "/api/themes?session="]) {
      expect(
        (await request(hosted.server, "GET", path, undefined, LAN)).status,
        path,
      ).toBe(403);
    }

    // Loopback is trusted admin and never paired: it needs no credential, and
    // `this-pc` has no record for one to have come from.
    expect((await request(hosted.server, "GET", "/api/themes")).status).toBe(
      200,
    );
  });

  it("answers a label the store would refuse, and keeps serving", async () => {
    const hosted = await launch();

    // Every one of these makes `displays.create` throw, and a thrown handler is
    // an uncaught exception in Node: the host would be gone, not refusing. The
    // route asks the store's own rules first, so each is a 400 with the reason.
    const refused: readonly (readonly [string, RegExp])[] = [
      ["", /label/],
      ["x".repeat(65), /label/],
      ["!!!", /usable id/],
      ["this pc", /reserved/],
      ["default", /reserved/],
    ];

    for (const [label, reason] of refused) {
      const answer = await request(
        hosted.server,
        "POST",
        `/api/pairing/sessions?label=${encodeURIComponent(label)}`,
      );

      expect(answer.status, `label ${JSON.stringify(label)}`).toBe(400);
      expect(answer.text(), `label ${JSON.stringify(label)}`).toMatch(reason);
    }

    // Still serving, and nothing was minted on the way through.
    expect((await request(hosted.server, "GET", "/api/health")).status).toBe(
      200,
    );
    expect(
      (await request(hosted.server, "GET", "/api/pairing/sessions")).json(),
    ).toEqual({ displays: [] });
  });

  it("answers 500 rather than dying when a store refuses mid-request", async () => {
    const store = createDisplayStore(settingsDir);
    const hosted = createHostServer({
      registry: new ProviderRegistry([]),
      bundles: { player: settingsDir, editor: settingsDir },
      themeStore: createThemeStore(settingsDir),
      displays: {
        ...store,
        // A file the store cannot read: every mutator refuses, and `list` is
        // made to refuse here so the rejection lands inside `handle`.
        list: () =>
          Promise.reject(new Error(`${settingsDir} could not be read`)),
      },
    });
    running = hosted;

    const answer = await request(hosted.server, "GET", "/api/pairing/sessions");
    expect(answer.status).toBe(500);
    // The reason names this machine's own file, and this route answers LAN
    // callers too, so it stays out of the body.
    expect(answer.text()).not.toContain(settingsDir);

    // The listener is still there to answer the next request.
    expect((await request(hosted.server, "GET", "/api/health")).status).toBe(
      200,
    );
  });
});

/**
 * Ruling 12: pairing mints a *display*, and the credential is that record's own.
 * These cases drive the routes that manage one — mint, rotate, rename, remove —
 * against a real store on disk, because the id a label mints is the store's rule
 * and a route keeping its own copy of it would be a second thing to keep true.
 */
describe("The pairing routes mint, rotate, rename and remove displays (ruling 12)", () => {
  let dir: string;
  let displays: ReturnType<typeof createDisplayStore>;
  let hosted: ReturnType<typeof createHostServer>;

  const LAN = { remoteAddress: "192.168.1.50" };

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "vigilia-display-routes-"));
    displays = createDisplayStore(dir);
    hosted = createHostServer({
      registry: new ProviderRegistry([]),
      bundles: { player: dir, editor: dir },
      themeStore: createThemeStore(dir),
      displays,
    });
  });

  afterEach(async () => {
    await hosted.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  /** The display list as a surface reads it, which is the redacted shape. */
  async function listed(): Promise<readonly Record<string, unknown>[]> {
    const answer = await request(hosted.server, "GET", "/api/pairing/sessions");
    return (answer.json() as { displays: readonly Record<string, unknown>[] })
      .displays;
  }

  /** Pairs a new display through the route, answering what it minted. */
  async function mint(label: string): Promise<{ id: string; token: string }> {
    const answer = await request(
      hosted.server,
      "POST",
      `/api/pairing/sessions?label=${encodeURIComponent(label)}`,
    );
    const body = answer.json() as {
      display: { id: string };
      token: string;
    };
    return { id: body.display.id, token: body.token };
  }

  it("mints a display and a credential for it", async () => {
    const answer = await request(
      hosted.server,
      "POST",
      "/api/pairing/sessions?label=Kitchen+tablet",
    );
    expect(answer.status).toBe(201);

    const body = answer.json() as {
      display: { id: string };
      token: string;
    };
    expect(body.display.id).toBe("kitchen-tablet");

    // The credential is the record's, so the store is what answers for it.
    expect((await displays.authenticate(body.token))?.id).toBe(
      "kitchen-tablet",
    );
    expect((await listed()).map((row) => row["id"])).toEqual([
      "kitchen-tablet",
    ]);
  });

  it("rotates an existing display's credential rather than minting a second display", async () => {
    const first = await mint("Kitchen tablet");
    const rotated = await request(
      hosted.server,
      "POST",
      "/api/pairing/sessions?displayId=kitchen-tablet",
    );
    expect(rotated.status).toBe(201);

    const body = rotated.json() as {
      display: { id: string };
      token: string;
    };
    expect(body.display.id).toBe("kitchen-tablet");
    expect(body.token).not.toBe(first.token);

    // Rotation replaces what proves the display is itself, not the display: the
    // old credential is refused and the new one is the phone's way in.
    expect(await displays.authenticate(first.token)).toBeUndefined();
    expect((await displays.authenticate(body.token))?.id).toBe(
      "kitchen-tablet",
    );
    expect(
      (
        await request(hosted.server, "GET", "/api/themes", undefined, {
          ...LAN,
          headers: { "x-vigilia-session": first.token },
        })
      ).status,
    ).toBe(403);
    expect(await listed()).toHaveLength(1);
  });

  it("removes a client and its credential", async () => {
    const { id, token } = await mint("Kitchen tablet");

    expect(
      (await request(hosted.server, "DELETE", `/api/displays/${id}`)).status,
    ).toBe(200);

    expect(await displays.authenticate(token)).toBeUndefined();
    expect(await listed()).toEqual([]);
    expect(
      (
        await request(hosted.server, "GET", "/api/themes", undefined, {
          ...LAN,
          headers: { "x-vigilia-session": token },
        })
      ).status,
    ).toBe(403);
  });

  it("renames a display without moving it", async () => {
    const { id } = await mint("Office TV");
    expect(id).toBe("office-tv");
    const before = await displays.find("office-tv");

    const renamed = await request(
      hosted.server,
      "PATCH",
      `/api/displays/${id}`,
      json({ label: "Kitchen" }),
    );
    expect(renamed.status).toBe(200);

    const body = renamed.json() as {
      id: string;
      label: string;
      createdAt: string;
    };
    expect(body.id).toBe("office-tv");
    expect(body.label).toBe("Kitchen");
    // Everything else is keyed by the id, so a rename that moved it would orphan
    // them: the id and the creation time are the identity it does not touch.
    expect(body.createdAt).toBe(before?.createdAt);
    expect(await listed()).toEqual([
      expect.objectContaining({ id: "office-tv", label: "Kitchen" }),
    ]);
  });

  it("refuses a chart rate the player cannot run, and leaves the stored one alone", async () => {
    await mint("Office TV");
    expect(
      (
        await request(
          hosted.server,
          "PATCH",
          "/api/displays/office-tv",
          json({ chartFps: 1 }),
        )
      ).status,
    ).toBe(200);

    const refused = await request(
      hosted.server,
      "PATCH",
      "/api/displays/office-tv",
      json({ chartFps: 5 }),
    );
    // The caller's typo and not a host fault: the wrapper's 500 would tell them
    // "the host could not answer that request", which is not what happened.
    expect(refused.status).toBe(400);
    // The store's own words, so a caller reads their own mistake rather than
    // the wrapper's "the host could not answer that request".
    expect(refused.text()).toBe('A chart rate must be 1 or 30, not "5".');
    expect((await displays.find("office-tv"))?.chartFps).toBe(1);
  });

  it("sets a chart rate the player can run, and answers the redacted record", async () => {
    const { token } = await mint("Office TV");

    const answered = await request(
      hosted.server,
      "PATCH",
      "/api/displays/office-tv",
      json({ chartFps: 30 }),
    );
    expect(answered.status).toBe(200);

    const body = answered.json() as { id: string; chartFps: number };
    expect(body.id).toBe("office-tv");
    expect(body.chartFps).toBe(30);
    expect((await displays.find("office-tv"))?.chartFps).toBe(30);

    // The answer is a record a surface repaints from, so it goes through the
    // same redaction every other route that could echo a record does.
    expect(answered.text()).not.toContain(hashToken(token));
    expect(body).not.toHaveProperty("tokenHash");
  });

  it("refuses an empty label rather than storing it", async () => {
    await mint("Office TV");

    const refused = await request(
      hosted.server,
      "PATCH",
      "/api/displays/office-tv",
      json({ label: "   " }),
    );
    expect(refused.status).toBe(400);
    expect(refused.text()).toMatch(/label/);
    expect(await listed()).toEqual([
      expect.objectContaining({ label: "Office TV" }),
    ]);
  });

  it("refuses a rename from off loopback", async () => {
    await mint("Office TV");

    const refused = await request(
      hosted.server,
      "PATCH",
      "/api/displays/office-tv",
      json({ label: "Kitchen" }),
      LAN,
    );
    expect(refused.status).toBe(403);
    // The displays' own guard, not the generic one every unknown path falls
    // through: a 403 from a route that does not exist is not a refusal.
    expect(refused.text()).toBe("Displays are available on this PC only.");
    expect(await listed()).toEqual([
      expect.objectContaining({ label: "Office TV" }),
    ]);
  });

  it("answers 404 for a displayId it does not know, on both routes", async () => {
    expect(
      (
        await request(
          hosted.server,
          "POST",
          "/api/pairing/sessions?displayId=nobody",
        )
      ).status,
    ).toBe(404);
    expect(
      (await request(hosted.server, "DELETE", "/api/displays/nobody")).status,
    ).toBe(404);
    expect(
      (
        await request(
          hosted.server,
          "PATCH",
          "/api/displays/nobody",
          json({ label: "Kitchen" }),
        )
      ).status,
    ).toBe(404);

    // A refused rotation minted nothing: no display, and no credential.
    expect(await listed()).toEqual([]);
  });

  it("refuses a displayId from off loopback before reading it", async () => {
    await mint("Kitchen tablet");

    // The guard precedes the parameter read, and a store that records its calls
    // is how that is checkable: a route reading the id first leaves a mark.
    const calls: string[] = [];
    const watching = createHostServer({
      registry: new ProviderRegistry([]),
      bundles: { player: dir, editor: dir },
      themeStore: createThemeStore(dir),
      displays: {
        ...displays,
        find: (id) => {
          calls.push(`find:${id}`);
          return Promise.resolve(undefined);
        },
        rotate: (id) => {
          calls.push(`rotate:${id}`);
          return Promise.resolve(undefined);
        },
      },
    });

    try {
      const refused = await request(
        watching.server,
        "POST",
        "/api/pairing/sessions?displayId=kitchen-tablet",
        undefined,
        LAN,
      );
      expect(refused.status).toBe(403);
      expect(refused.text()).toBe("Pairing is available on this PC only.");
      expect(calls).toEqual([]);
    } finally {
      await watching.close();
    }

    expect(await listed()).toEqual([
      expect.objectContaining({ id: "kitchen-tablet" }),
    ]);
  });

  it("refuses to remove the reserved local display", async () => {
    const refused = await request(
      hosted.server,
      "DELETE",
      `/api/displays/${LOCAL_DISPLAY_ID}`,
    );
    expect(refused.status).toBe(409);
    expect(refused.text()).toMatch(/This PC/);
  });

  it("never echoes a stored hash, and carries a token only where it mints one", async () => {
    const { token } = await mint("Kitchen tablet");
    const rotated = await request(
      hosted.server,
      "POST",
      "/api/pairing/sessions?displayId=kitchen-tablet",
    );
    expect(rotated.status).toBe(201);
    const fresh = (rotated.json() as { token: string }).token;
    expect(fresh).not.toBe(token);

    // Rotation is the one moment a credential is in the clear. The list a
    // surface repaints from carries neither the token nor the hash it is stored
    // as: echoing the hash would undo the reason it is hashed.
    const list = await request(hosted.server, "GET", "/api/pairing/sessions");
    expect(list.text()).not.toContain(fresh);
    expect(list.text()).not.toContain(hashToken(fresh));
    expect((await listed())[0]).not.toHaveProperty("tokenHash");
  });
});

/**
 * Spec § "The host's own monitors": a second kind of display, *specified* rather
 * than paired. It is the host's own screen, so it carries no credential, and the
 * list it is chosen from is a probe of this PC rather than anything stored.
 */
describe("A local monitor is specified rather than paired", () => {
  let dir: string;
  let displays: ReturnType<typeof createDisplayStore>;
  let hosted: ReturnType<typeof createHostServer>;

  const LAN = { remoteAddress: "192.168.1.50" };
  const ATTACHED: readonly Monitor[] = [
    {
      deviceName: "\\\\.\\DISPLAY1",
      serial: "4790810010513",
      main: true,
      positionX: 0,
      positionY: 0,
      currentResX: 2560,
      currentResY: 1440,
    },
    {
      deviceName: "\\\\.\\DISPLAY2",
      main: false,
      positionX: 2560,
      positionY: 0,
      currentResX: 1920,
      currentResY: 1080,
    },
  ];

  function host(
    overrides: Partial<HostServerOptions> = {},
  ): ReturnType<typeof createHostServer> {
    return createHostServer({
      registry: new ProviderRegistry([]),
      bundles: { player: dir, editor: dir },
      themeStore: createThemeStore(dir),
      displays,
      monitors: () => Promise.resolve(ATTACHED),
      ...overrides,
    });
  }

  /** A launcher that opens nothing: what these cases need is whether a window
   *  was opened and closed, and the launcher's own suite covers its command
   *  line. */
  function windowsOver(
    opened: { readonly kill: ReturnType<typeof vi.fn> }[],
  ): ReturnType<typeof createDisplayLauncher> {
    return createDisplayLauncher({
      displays,
      port: 5227,
      browser: "/fake/chrome.exe",
      spawn: ((
        _file: string,
        _args: readonly string[],
        _options: SpawnOptions,
      ) => {
        const kill = vi.fn();
        opened.push({ kill });

        return {
          killed: false,
          kill,
          once: (): void => undefined,
        } as unknown as ChildProcess;
      }) as unknown as typeof spawn,
      monitors: () => Promise.resolve(ATTACHED),
    });
  }

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "vigilia-local-monitor-"));
    displays = createDisplayStore(dir);
    hosted = host();
  });

  afterEach(async () => {
    await hosted.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  /** The display list as a surface reads it, which is the redacted shape. */
  async function listed(
    from: ReturnType<typeof createHostServer> = hosted,
  ): Promise<readonly Record<string, unknown>[]> {
    const answer = await request(from.server, "GET", "/api/pairing/sessions");
    return (answer.json() as { displays: readonly Record<string, unknown>[] })
      .displays;
  }

  it("adds a local monitor with no credential", async () => {
    const answer = await request(
      hosted.server,
      "POST",
      "/api/displays",
      json({
        label: "Left screen",
        monitor: { deviceName: "\\\\.\\DISPLAY2" },
      }),
    );
    expect(answer.status).toBe(201);

    const body = answer.json() as {
      display: { id: string; kind: string; monitor: unknown };
    };
    expect(body.display.id).toBe("left-screen");
    expect(body.display.kind).toBe("local");
    expect(body.display.monitor).toEqual({ deviceName: "\\\\.\\DISPLAY2" });
    // Nothing to hand out: this display proves itself by being on this PC.
    expect(Object.keys(body)).toEqual(["display"]);
    expect(body.display).not.toHaveProperty("tokenHash");
    expect(await listed()).toEqual([
      expect.objectContaining({ id: "left-screen", kind: "local" }),
    ]);
  });

  it("refuses a body the file's own reader would drop", async () => {
    const refused = await request(
      hosted.server,
      "POST",
      "/api/displays",
      json({ label: "Left screen", monitor: { serial: "4790810010513" } }),
    );
    expect(refused.status).toBe(400);
    expect(refused.text()).toMatch(/monitor/);
    // Written only if the next read would find it: a record the file drops is a
    // display that disappears, which is `vg-616`'s class of bug.
    expect(await listed()).toEqual([]);
  });

  it("answers what is attached, for the owner to pick from", async () => {
    const answer = await request(
      hosted.server,
      "GET",
      "/api/displays/monitors",
    );
    expect(answer.status).toBe(200);
    expect((answer.json() as { monitors: unknown }).monitors).toEqual(ATTACHED);
  });

  it("refuses a local display from off loopback, on every route", async () => {
    const refused = await request(
      hosted.server,
      "POST",
      "/api/displays",
      json({
        label: "Left screen",
        monitor: { deviceName: "\\\\.\\DISPLAY2" },
      }),
      LAN,
    );
    expect(refused.status).toBe(403);
    expect(refused.text()).toBe("Displays are available on this PC only.");
    expect(
      (
        await request(
          hosted.server,
          "GET",
          "/api/displays/monitors",
          undefined,
          LAN,
        )
      ).status,
    ).toBe(403);
    expect(await listed()).toEqual([]);
  });

  it("refuses an off-loopback request before reading its body", async () => {
    const calls: string[] = [];
    const watching = host({
      displays: {
        ...displays,
        createLocal: (label, monitor) => {
          calls.push(`createLocal:${label}`);
          return displays.createLocal(label, monitor);
        },
      },
      monitors: () => {
        calls.push("monitors");
        return Promise.resolve(ATTACHED);
      },
    });

    try {
      // A body that is not JSON: a guard that ran after the read would answer
      // the parse's 400 rather than its own 403.
      const refused = await request(
        watching.server,
        "POST",
        "/api/displays",
        "{ not json",
        LAN,
      );
      expect(refused.status).toBe(403);
      expect(refused.text()).toBe("Displays are available on this PC only.");
      expect(
        (
          await request(
            watching.server,
            "GET",
            "/api/displays/monitors",
            undefined,
            LAN,
          )
        ).status,
      ).toBe(403);
      expect(calls).toEqual([]);
    } finally {
      await watching.close();
    }
  });

  it("keeps a display whose monitor is no longer attached", async () => {
    await request(
      hosted.server,
      "POST",
      "/api/displays",
      json({
        label: "Left screen",
        monitor: { deviceName: "\\\\.\\DISPLAY2", serial: "4790810010513" },
      }),
    );

    // The cable is out: the probe no longer reports that monitor.
    const unplugged = host({ monitors: () => Promise.resolve([ATTACHED[0]!]) });

    try {
      const answer = await request(
        unplugged.server,
        "GET",
        "/api/displays/monitors",
      );
      expect(
        (answer.json() as { monitors: readonly unknown[] }).monitors,
      ).toEqual([ATTACHED[0]]);

      // The record stays, with its hint: deleting it would throw away the
      // person's configuration to report a fact about the furniture.
      expect(await listed(unplugged)).toEqual([
        expect.objectContaining({
          id: "left-screen",
          monitor: { deviceName: "\\\\.\\DISPLAY2", serial: "4790810010513" },
        }),
      ]);
    } finally {
      await unplugged.close();
    }
  });

  it("answers an empty list for a probe that found nothing, and 500 for one that failed", async () => {
    const empty = host({ monitors: () => Promise.resolve([]) });
    const failed = host({
      monitors: () => Promise.reject(new Error("graphics() failed")),
    });

    try {
      const nothing = await request(
        empty.server,
        "GET",
        "/api/displays/monitors",
      );
      expect(nothing.status).toBe(200);
      expect(nothing.json()).toEqual({ monitors: [] });

      // Not `[]`: an empty list would tell the owner nothing is attached when
      // the truth is that the host could not find out.
      const refused = await request(
        failed.server,
        "GET",
        "/api/displays/monitors",
      );
      expect(refused.status).toBe(500);
      expect(refused.text()).toBe("The host could not answer that request.");
    } finally {
      await empty.close();
      await failed.close();
    }
  });

  it("names the methods the path it answered actually supports", async () => {
    // A caller told GET is supported on the collection path, or PATCH on the
    // monitors path, has been told nothing true.
    const collection = await request(hosted.server, "GET", "/api/displays");
    expect(collection.status).toBe(405);
    expect(collection.text()).toBe("This path supports POST.");

    const monitors = await request(
      hosted.server,
      "POST",
      "/api/displays/monitors",
    );
    expect(monitors.status).toBe(405);
    expect(monitors.text()).toBe("This path supports GET.");

    const record = await request(
      hosted.server,
      "POST",
      "/api/displays/left-screen",
    );
    expect(record.status).toBe(405);
    expect(record.text()).toBe("This path supports PATCH and DELETE.");

    const autostart = await request(
      hosted.server,
      "GET",
      "/api/displays/autostart",
    );
    expect(autostart.status).toBe(405);
    expect(autostart.text()).toBe("This path supports POST.");
  });

  it("refuses a second local display for a monitor one already holds", async () => {
    const first = await request(
      hosted.server,
      "POST",
      "/api/displays",
      json({
        label: "Left screen",
        monitor: { deviceName: "\\\\.\\DISPLAY2" },
      }),
    );
    expect(first.status).toBe(201);

    // A conflict with what this host holds, not a body the store would not
    // read: two records for one screen would put two windows on it.
    const second = await request(
      hosted.server,
      "POST",
      "/api/displays",
      json({
        label: "Left screen again",
        monitor: { deviceName: "\\\\.\\DISPLAY2" },
      }),
    );
    expect(second.status).toBe(409);
    expect(second.text()).toMatch(/already holds/);
    expect(await listed()).toHaveLength(1);
  });

  it("launches a local display when it is added", async () => {
    const opened: { readonly kill: ReturnType<typeof vi.fn> }[] = [];
    const hosting = host({ launcher: windowsOver(opened) });

    try {
      const answer = await request(
        hosting.server,
        "POST",
        "/api/displays",
        json({
          label: "Left screen",
          monitor: { deviceName: "\\\\.\\DISPLAY2" },
        }),
      );
      expect(answer.status).toBe(201);

      // The record the POST wrote has never been seen, so the sighting is not
      // evidence of a window: the host opens one now, on that monitor.
      expect(opened).toHaveLength(1);
    } finally {
      await hosting.close();
    }
  });

  it("closes the window when the display is removed", async () => {
    const opened: { readonly kill: ReturnType<typeof vi.fn> }[] = [];
    const hosting = host({ launcher: windowsOver(opened) });

    try {
      await request(
        hosting.server,
        "POST",
        "/api/displays",
        json({
          label: "Left screen",
          monitor: { deviceName: "\\\\.\\DISPLAY2" },
        }),
      );

      const answer = await request(
        hosting.server,
        "DELETE",
        "/api/displays/left-screen",
      );
      expect(answer.status).toBe(200);
      expect(opened[0]?.kill).toHaveBeenCalled();
      expect(await listed(hosting)).toEqual([]);
    } finally {
      await hosting.close();
    }
  });

  it("registers the host at sign-in, once", async () => {
    const message =
      "Registered. Windows starts Vigilia at sign-in, so every local monitor " +
      "comes back with it.";
    const register = vi.fn(async () => ({ ok: true, message }));
    const hosting = host({ registerAutostart: register });

    try {
      const answer = await request(
        hosting.server,
        "POST",
        "/api/displays/autostart",
      );
      expect(answer.status).toBe(200);
      // The registrar's own message is the answer: it is what the surface shows.
      expect(answer.json()).toEqual({ ok: true, message });
      expect(register).toHaveBeenCalledTimes(1);
    } finally {
      await hosting.close();
    }
  });

  it("says so when this host cannot register itself", async () => {
    const answer = await request(
      hosted.server,
      "POST",
      "/api/displays/autostart",
    );

    expect(answer.status).toBe(404);
    expect(answer.text()).toMatch(/start at sign-in/);
  });

  it("answers a path that is no route the way it answers any unknown path", async () => {
    // Neither path matches a route of its own nor the id path, so a method set
    // would be a claim about a path that needs an id segment it does not carry:
    // the answer is whatever this server answers any path it does not know.
    for (const method of ["POST", "GET"]) {
      const unknown = await request(hosted.server, method, "/no-such-path");
      expect(unknown.status).toBeGreaterThanOrEqual(400);

      for (const pathname of ["/api/displays/", "/api/displays/a/b"]) {
        const answer = await request(hosted.server, method, pathname);
        expect(answer.status).toBe(unknown.status);
        expect(answer.text()).toBe(unknown.text());
      }
    }
  });

  it("answers the monitor list even when a display is named Monitors", async () => {
    // `monitors` is not reserved, so a display may legitimately mint it
    // (`mintedDisplayId`); the route is a path of its own rather than an id.
    await request(
      hosted.server,
      "POST",
      "/api/displays",
      json({ label: "Monitors", monitor: { deviceName: "\\\\.\\DISPLAY2" } }),
    );
    expect((await listed())[0]).toMatchObject({ id: "monitors" });

    const answer = await request(
      hosted.server,
      "GET",
      "/api/displays/monitors",
    );
    expect(answer.status).toBe(200);
    expect((answer.json() as { monitors: unknown }).monitors).toEqual(ATTACHED);
  });
});

/**
 * The other route reachable unpaired (spec § "Pairing a display that has no
 * camera"): a device with no camera types the one-time code the host is showing
 * and gets a durable credential back.
 *
 * The code is the only short-lived secret in the exchange, so what these cases
 * pin is the window — one code at a time, a mismatch that never burns it, a
 * penalty that is a delay rather than a lockout, and one refusal for every way a
 * code can fail.
 */
describe("A display with no camera pairs by typing the one-time code", () => {
  let dir: string;
  let displays: ReturnType<typeof createDisplayStore>;
  let codes: ReturnType<typeof createPairingCodeStore>;
  let hosted: ReturnType<typeof createHostServer>;

  const LAN = { remoteAddress: "192.168.1.50" };

  function host(
    overrides: Partial<HostServerOptions> = {},
  ): ReturnType<typeof createHostServer> {
    return createHostServer({
      registry: new ProviderRegistry([]),
      // The pairing page is served from the admin root, so this is the one
      // describe that needs it: `/pair` is a phone's first request.
      bundles: { player: dir, editor: dir, admin: ADMIN_DIR },
      themeStore: createThemeStore(dir),
      displays,
      pairingCodes: codes,
      ...overrides,
    });
  }

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "vigilia-pairing-code-"));
    displays = createDisplayStore(dir);
    // The penalty is a real delay in production and no wait at all here: the
    // cases assert what it asks for, and waiting it out would only be slower.
    codes = createPairingCodeStore({ wait: async () => {} });
    hosted = host();
  });

  afterEach(async () => {
    await hosted.close();
    await fs.rm(dir, { recursive: true, force: true });
  });

  /** The code the card is showing, read the way the card reads it. */
  async function shown(
    server: ListenableServer = hosted.server,
  ): Promise<string> {
    const answer = await request(server, "GET", "/api/pairing/code");
    expect(answer.status).toBe(200);
    return (answer.json() as { code: string }).code;
  }

  /** A claim from off loopback, which is every display that has not paired. */
  function claim(
    body: unknown,
    server: ListenableServer = hosted.server,
  ): ReturnType<typeof request> {
    return request(
      server,
      "POST",
      "/api/pairing/claim",
      JSON.stringify(body),
      LAN,
    );
  }

  it("pairs a display from the code alone, with no credential and off loopback", async () => {
    const code = await shown();

    const answer = await claim({ code, label: "Kitchen tablet" });
    expect(answer.status).toBe(200);

    const body = answer.json() as { displayId: string; token: string };
    expect(body.displayId).toBe("kitchen-tablet");
    // The credential is the record's and it is durable (ruling 12): the code is
    // spent by the exchange and what it bought outlives it.
    expect((await displays.authenticate(body.token))?.id).toBe(
      "kitchen-tablet",
    );
    expect(codes.current()).toBeUndefined();

    // And the display is a row the owner can see and remove by name.
    const listed = await request(hosted.server, "GET", "/api/pairing/sessions");
    expect(
      (listed.json() as { displays: readonly { id: string }[] }).displays.map(
        (row) => row.id,
      ),
    ).toEqual(["kitchen-tablet"]);
  });

  it("answers one refusal for every way a code can fail", async () => {
    const code = await shown();
    const unknown = await claim({ code: "ZZZZZZ", label: "Kitchen tablet" });
    expect(unknown.status).toBe(404);

    // Spent.
    expect((await claim({ code, label: "Kitchen tablet" })).status).toBe(200);
    const spent = await claim({ code, label: "Office TV" });
    expect(spent.status).toBe(404);
    expect(spent.text()).toBe(unknown.text());

    // Expired, on a host whose window has already closed.
    const expired = host({
      pairingCodes: createPairingCodeStore({ ttlMs: 0, wait: async () => {} }),
    });
    try {
      const stale = await shown(expired.server);
      const answer = await claim(
        { code: stale, label: "Office TV" },
        expired.server,
      );
      expect(answer.status).toBe(404);
      expect(answer.text()).toBe(unknown.text());
    } finally {
      await expired.close();
    }

    // A refusal mints nothing, whatever it was that failed.
    expect((await displays.list()).map((row) => row.id)).toEqual([
      "kitchen-tablet",
    ]);
  });

  it("does not let a wrong guess close the window", async () => {
    const code = await shown();

    for (let guess = 0; guess < 5; guess += 1) {
      expect(
        (await claim({ code: "ZZZZZZ", label: "Kitchen tablet" })).status,
      ).toBe(404);
    }

    // Five wrong guesses, and the person typing the sixth still pairs: one live
    // code has nothing a mismatch could have named, so nothing was spent.
    expect((await claim({ code, label: "Kitchen tablet" })).status).toBe(200);
    expect((await displays.list()).map((row) => row.id)).toEqual([
      "kitchen-tablet",
    ]);
  });

  it("answers a guesser with a growing delay, and never with a lockout", async () => {
    const waited: number[] = [];
    const guarded = host({
      pairingCodes: createPairingCodeStore({
        wait: async (ms) => {
          waited.push(ms);
        },
      }),
    });

    try {
      const code = await shown(guarded.server);

      for (let guess = 0; guess < 5; guess += 1) {
        const refused = await claim(
          { code: "ZZZZZZ", label: "Kitchen tablet" },
          guarded.server,
        );
        // The same answer however long the wait: a distinct one would say
        // whether a code exists, which is the thing this route must not say.
        expect(refused.status).toBe(404);
      }

      expect(waited).toEqual([250, 500, 1000, 2000]);

      // And the right code still succeeds, which is the whole difference
      // between a penalty and a lockout.
      expect(
        (await claim({ code, label: "Kitchen tablet" }, guarded.server)).status,
      ).toBe(200);
    } finally {
      await guarded.close();
    }
  });

  it("refuses a name that would mint a reserved id, and does not spend the code", async () => {
    const code = await shown();

    for (const label of ["this-pc", "default"]) {
      const refused = await claim({ code, label });
      expect(refused.status, label).toBe(400);
      expect(refused.text()).toMatch(/reserved display id/);
    }

    // The window is untouched: a name the store refuses is the caller's to fix,
    // and spending the code would take it from the person typing it.
    expect(codes.current()?.code).toBe(code);
    expect((await claim({ code, label: "Kitchen tablet" })).status).toBe(200);
  });

  it("reads the live code and does not rotate it", async () => {
    const first = await shown();

    // A second read of a live window must not move the code out from under
    // whoever is typing it: the same window answers the same code.
    expect(await shown()).toBe(first);
    expect((await claim({ code: first, label: "Kitchen tablet" })).status).toBe(
      200,
    );

    // And once it is spent, the next read is a new window rather than the spent
    // code again.
    expect(await shown()).not.toBe(first);
  });

  it("keeps the code on this PC, and refuses off loopback before minting one", async () => {
    const minted: string[] = [];
    const watching = host({
      pairingCodes: {
        ...codes,
        mint: () => {
          minted.push("mint");
          return codes.mint();
        },
      },
    });

    try {
      const refused = await request(
        watching.server,
        "GET",
        "/api/pairing/code",
        undefined,
        LAN,
      );
      expect(refused.status).toBe(403);
      expect(refused.text()).toBe("Pairing is available on this PC only.");
      // The guard precedes the mint, and a store that records its calls is how
      // that is checkable: a route that minted first would leave a mark here.
      expect(minted).toEqual([]);
    } finally {
      await watching.close();
    }
  });

  it("serves the page a phone with no credential opens", async () => {
    const answer = await request(
      hosted.server,
      "GET",
      "/pair?code=ABC234",
      undefined,
      LAN,
    );
    expect(answer.status).toBe(200);
    expect(answer.headers["content-type"]).toContain("text/html");
    // The page is the exchange's only client: nothing else it does reads the
    // host, so it is the one document an unpaired device may have.
    expect(answer.text()).toContain("/api/pairing/claim");
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

/** The published key a group's choice rides under — `system-disk` →
 *  `systemDisk`, the `DeviceAssignment` convention the rest of the host reads. */
const assignmentKey = (group: string): string =>
  group.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());

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

  it("publishes every group the settings module declares it can assign", async () => {
    // The host derives its assignable groups from `ASSIGNABLE_GROUPS` rather
    // than re-spelling the union, so a group added to the owner must reach the
    // providers without this server changing. Driving the owner's own list is
    // what catches the drift a second copy of the union could not: a group the
    // host stopped picking leaves its chosen id out of the publish (vg-189).
    //
    // Read at each group's **own key** (`system-disk` → `systemDisk`, the
    // payload's `DeviceAssignment` convention) rather than across every string
    // value, so a payload that later carries another string field cannot fail
    // this spuriously.
    const assigned = Object.fromEntries(
      ASSIGNABLE_GROUPS.map((group) => [group, `id-${group}`]),
    );
    await request(hosted.server, "PUT", "/api/devices", json({ assigned }));

    const published = pushed.at(-1) as Readonly<Record<string, unknown>>;
    // Read each group's **own key** (`system-disk` → `systemDisk`, the payload's
    // `DeviceAssignment` convention), never the whole payload's keys or values: a
    // payload that later carries another field must not fail this spuriously.
    for (const group of ASSIGNABLE_GROUPS) {
      expect(
        published[assignmentKey(group)],
        `${group} reaches its own key`,
      ).toBe(`id-${group}`);
    }
  });
});

it("keeps the assignable-device vocabulary in the one module that owns it", async () => {
  // vg-189: the groups are `ASSIGNABLE_GROUPS`'s (`settings/devices.ts`), so
  // server.ts must not spell the union a second time — a copy is a second owner,
  // and a group added to the real owner would silently never reach it. The
  // runtime is identical whether the union is derived or copied, so the source is
  // the only place this can be seen.
  //
  // Resolving `pick`'s parameter **annotation** to the owner's own type, rather
  // than matching a member list, is what catches a re-spelling of a different
  // member set or order, or a local alias: only `AssignableGroup` passes.
  const source = await fs.readFile(
    new URL("./server.ts", import.meta.url),
    "utf8",
  );
  const annotation = source.match(
    /const pick = \(group\s*:\s*([A-Za-z][\w.]*)\)/,
  )?.[1];
  expect(annotation).toBe("AssignableGroup");
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
      displays: createDisplayStore(themes),
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
    return { state: async () => state, setLan, idle: async () => {} };
  }

  afterEach(async () => {
    await hosted.close();
    await fs.rm(hostingDir, { recursive: true, force: true });
  });

  it("answers where a phone should go, and nothing else", async () => {
    const token = "t".repeat(43);
    const displays = createDisplayStore(hostingDir);
    build({
      hosting: stillBinding({
        lan: true,
        address: "192.168.1.42",
        port: 5227,
        refusal: null,
      }),
      displays,
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

    // A `DisplayRecord` carries `tokenHash`, so a route that forwards `list()`
    // unchanged hands back the one thing the hash exists to keep out of a
    // reader's hands. An assertion over an empty list passes for that
    // implementation and for a redacting one alike, which is why this pairs:
    // without a display present, the test cannot tell them apart.
    await displays.create("Kitchen phone", token);
    const withOne = await request(hosted.server, "GET", "/api/hosting");
    const peers = (
      withOne.json() as { sessions: readonly Record<string, unknown>[] }
    ).sessions;
    expect(peers).toHaveLength(1);
    expect(peers[0]).not.toHaveProperty("tokenHash");
    expect(JSON.stringify(peers)).not.toContain(hashToken(token));
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
        state: async () => ({
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
        state: async () => ({ lan: false, address: null, port: 5227, refusal }),
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
        state: async () => ({
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

  it("does not leave a request parked on a socket it spared (vg-174)", async () => {
    const port = await listeningHost();

    // The row's own mechanism, which has to be constructed because one client
    // cannot reach it. This socket is mid-request when the move starts — its
    // headers are read and the body it promised has not arrived — so the move
    // spares it rather than closing it, and it goes idle-and-alive the moment
    // that body arrives. A **second** request on it then runs its handler after
    // `moving` is assigned, so it parks on `idle()` for a move that is parked
    // on this very connection: a deadlock, not a slow answer.
    //
    // `Expect: 100-continue` is how the test knows the host has the request
    // rather than sleeping and hoping: Node answers it in the same run that
    // emits `request`, so waiting for that line is proof the host has it.
    const held = net.connect(port, "127.0.0.1");
    // The move destroys this socket, so its failure is the point of the case.
    held.on("error", () => {});
    const seen: string[] = [];
    let controlAnswered = false;
    let continueSeen: (() => void) | undefined;
    const arrived = new Promise<void>((resolve) => {
      continueSeen = resolve;
    });

    held.on("data", (chunk: Buffer) => {
      seen.push(chunk.toString("latin1"));
      const text = seen.join("");

      if (text.includes("100 Continue")) continueSeen?.();

      // The continue, the held request's own answer, and anything after them:
      // a third status line is the socket still being dispatched on.
      if (text.split("HTTP/1.1").length > 3) controlAnswered = true;
    });

    const ended = new Promise<boolean>((resolve) => {
      held.once("close", () => resolve(true));
      setTimeout(() => resolve(false), 2_000).unref();
    });

    await new Promise<void>((resolve) => held.once("connect", resolve));
    held.write(
      [
        "PUT /api/hosting HTTP/1.1",
        `Host: 127.0.0.1:${port}`,
        "Content-Type: application/json",
        "Expect: 100-continue",
        // `{"lan":0}` exactly: one byte short and the parser answers the 400
        // itself, with `Connection: close`, and the socket this case is about
        // is gone before the move ever runs.
        "Content-Length: 9",
        "",
        "",
      ].join("\r\n"),
    );
    await arrived;

    // The move runs while that request is still in flight. Its own answer is
    // owed on a connection the move takes with it — that trade is `vg-173`,
    // measured and green.
    //
    // **This 200 is not the discriminating assertion**: the move starts on
    // `finish`, so these bytes are already with the operating system before any
    // socket is destroyed, and it passes with the fix absent too. What tells
    // the two apart is the socket assertion below.
    const answered = await fetch(`http://127.0.0.1:${port}/api/hosting`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lan: true }),
    });
    expect(answered.status).toBe(200);

    // The held body frees the socket, and the two reads that follow are the
    // shape the row describes. Asserted as an object rather than a boolean so a
    // red run says which half it saw: with the fix absent this socket is still
    // alive and still dispatching — the health read beside it answers — while
    // the hosting read never does.
    held.write('{"lan":0}');
    held.write("GET /api/health HTTP/1.1\r\nHost: h\r\n\r\n");
    held.write("GET /api/hosting HTTP/1.1\r\nHost: h\r\n\r\n");

    expect({ ended: await ended, controlAnswered }).toMatchObject({
      ended: true,
    });

    // And the move settled, so the host is listening again and answers where it
    // landed. A GET waits for a move in flight, so a 200 here is the move
    // having finished rather than a reading taken around it.
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
    const displays = createDisplayStore(dir);
    const hosted = createHostServer({
      registry: new ProviderRegistry([]),
      bundles: { player: dir, editor: dir },
      themeStore: createThemeStore(dir),
      displays,
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
      const token = newToken();
      await displays.create("phone", token);
      const fromThePhone = await request(
        hosted.server,
        "PUT",
        "/api/publish?id=living-room",
        themeBody(createValidPackage()),
        {
          remoteAddress: "192.168.1.50",
          headers: { "x-vigilia-session": token },
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

describe("The published overlay", () => {
  it("serves the published document to a display that asks for that theme", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vigilia-published-"));
    const hosted = createHostServer({
      registry: new ProviderRegistry([]),
      bundles: { player: dir, editor: dir },
      themeStore: createThemeStore(dir),
    });

    try {
      // **The library starts empty**, so a document to publish *over* has to
      // exist first: without this the read below is a 404 and the assertion
      // after it compares `undefined` to an artboard.
      await request(
        hosted.server,
        "PUT",
        "/api/themes/living-room",
        themeBody(createValidPackage()),
      );

      const stored = await request(
        hosted.server,
        "GET",
        "/api/themes/living-room/document",
      );
      expect(stored.status).toBe(200);

      const publishedBody = JSON.stringify({
        envelope: {
          ...(stored.json() as object),
          artboard: { width: 320, height: 240 },
        },
        assets: {},
      });

      const published = await request(
        hosted.server,
        "PUT",
        "/api/publish?id=living-room",
        publishedBody,
      );
      expect(published.status).toBe(200);

      const shown = await request(
        hosted.server,
        "GET",
        "/api/themes/living-room/document",
      );
      expect((shown.json() as { artboard: unknown }).artboard).toEqual({
        width: 320,
        height: 240,
      });

      // The stored document is untouched: publishing is not saving.
      await request(hosted.server, "DELETE", "/api/publish");
      const again = await request(
        hosted.server,
        "GET",
        "/api/themes/living-room/document",
      );
      expect((again.json() as { artboard: unknown }).artboard).not.toEqual({
        width: 320,
        height: 240,
      });
    } finally {
      await hosted.close();
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("hides the revision from an unpaired display", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vigilia-published-"));
    const hosted = createHostServer({
      registry: new ProviderRegistry([]),
      bundles: { player: dir, editor: dir },
      themeStore: createThemeStore(dir),
      displays: createDisplayStore(dir),
    });

    try {
      const refused = await request(
        hosted.server,
        "GET",
        "/api/published",
        undefined,
        { remoteAddress: "192.168.1.50" },
      );
      expect(refused.status).toBe(403);

      // Loopback reads the same route, so the 403 above is the guard rather
      // than a route that refuses everybody. Nothing is published on a fresh
      // host, and the revision is still a number a display can poll.
      const here = await request(hosted.server, "GET", "/api/published");
      expect(here.status).toBe(200);
      expect(here.json()).toEqual({ id: null, revision: 0 });
    } finally {
      await hosted.close();
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("resolves the root through the published theme first, then the stored choice", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vigilia-published-"));
    const store = createThemeStore(dir);
    const activeTheme = createActiveThemeStore(dir);
    const hosted = createHostServer({
      registry: new ProviderRegistry([]),
      bundles: { player: dir, editor: dir },
      themeStore: store,
      activeTheme,
    });

    try {
      await store.write("living-room", createValidPackage());
      await store.write("studio", createValidPackage("studio", "Studio"));
      // The consumer chose `studio`, so a `/` with nothing else to go on shows
      // that — and the published document taking precedence over the choice is
      // the whole point of the overlay.
      await activeTheme.write("studio");

      const before = await request(hosted.server, "GET", "/");
      expect(before.headers.location).toBe("/?theme=studio&data=live");

      await request(
        hosted.server,
        "PUT",
        "/api/publish?id=living-room",
        themeBody(createValidPackage()),
      );

      const after = await request(hosted.server, "GET", "/");
      expect(after.headers.location).toBe("/?theme=living-room&data=live");
    } finally {
      await hosted.close();
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});

/**
 * The origin, which is the whole of Task 25.8b: a display that cannot hold a
 * wake lock or register a service worker is a display at a plain-http origin,
 * and no route decides that.
 */
describe("The host's secure origin", () => {
  let tmpDir: string;
  let origin: Awaited<ReturnType<typeof createSecureOrigin>>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vigilia-origin-"));
    origin = await createSecureOrigin(tmpDir, ["localhost", "127.0.0.1"]);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  /** The host as the launcher builds it: a certificate, and the root to hand
   *  out. Both protocols on one port, read over a real socket. */
  function host({ withRoot = true }: { readonly withRoot?: boolean } = {}) {
    return createHostServer({
      registry: new ProviderRegistry([]),
      bundles: { player: tmpDir, editor: tmpDir },
      tls: { key: origin.key, cert: origin.chain },
      ...(withRoot ? { caCertificate: origin.certificate } : {}),
    });
  }

  /**
   * The same host without a certificate, so the in-process `request` helper can
   * reach the router.
   *
   * A route answers identically on both protocols — one handler, two servers —
   * and the helper is the only way to *be* a non-loopback reader, which is the
   * state the root route exists for. The transport is proven over a real socket
   * in the cases above rather than pretended at here.
   */
  function plainHost({
    withRoot = true,
  }: {
    readonly withRoot?: boolean;
  } = {}) {
    return createHostServer({
      registry: new ProviderRegistry([]),
      bundles: { player: tmpDir, editor: tmpDir },
      ...(withRoot ? { caCertificate: origin.certificate } : {}),
    });
  }

  /** A real TLS handshake against a real socket, trusting the root this host
   *  just made — not `rejectUnauthorized: false`, which would accept any
   *  certificate and prove nothing about the one under test. */
  function get(
    port: number,
    urlPath: string,
  ): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const call = https.request(
        // The address rather than a hostname: this is the client a phone is,
        // and an IP has to be covered by a SAN rather than by a CN.
        { host: "127.0.0.1", port, path: urlPath, ca: origin.certificate },
        (answer) => {
          const chunks: Buffer[] = [];
          answer.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
          answer.on("end", () =>
            resolve({
              status: answer.statusCode ?? 0,
              body: Buffer.concat(chunks).toString("utf8"),
            }),
          );
        },
      );
      call.on("error", reject);
      call.end();
    });
  }

  /** An https request answered as far as its headers, so the caller keeps the
   *  connection and can ask afterwards what became of it. */
  function openOverTls(
    port: number,
    urlPath: string,
    agent?: https.Agent,
  ): Promise<{ status: number; socket: Socket; answer: http.IncomingMessage }> {
    return new Promise((resolve, reject) => {
      const call = https.request(
        {
          host: "127.0.0.1",
          port,
          path: urlPath,
          ca: origin.certificate,
          ...(agent === undefined ? {} : { agent }),
        },
        (answer) =>
          resolve({
            status: answer.statusCode ?? 0,
            socket: answer.socket,
            answer,
          }),
      );
      call.on("error", reject);
      call.end();
    });
  }

  /** Whether a client's socket is closed within `ms`. Raced rather than read
   *  once: a destroy on the server takes a round trip to show up on this side,
   *  and reading `destroyed` straight after the call would be reading before
   *  the answer arrived. */
  function closedWithin(socket: Socket, ms: number): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), ms);
      socket.once("close", () => {
        clearTimeout(timer);
        resolve(true);
      });
    });
  }

  it("answers over https, on a chain the client accepts", async () => {
    const hosted = host();
    await new Promise<void>((resolve) =>
      hosted.server.listen(0, "127.0.0.1", resolve),
    );

    try {
      const port = (hosted.server.address() as AddressInfo).port;
      const answer = await get(port, "/api/health");

      expect(answer.status).toBe(200);
      // The route's own body, read off the wire rather than assumed: a client
      // that accepted the chain is a client that reached the router.
      expect(JSON.parse(answer.body)).toMatchObject({ displays: 0 });
    } finally {
      await hosted.close();
    }
  });

  it("still answers plain http on the same port, so the pairing link keeps working", async () => {
    // **The case that fails if the listener is made https-only.** The link the
    // host prints and the QR carries is `http://<lan-ip>:<port>`, and it
    // belongs to the spec that owns pairing — so this task may not leave it
    // pointing at a protocol the port no longer answers. Both protocols on one
    // port is what makes that true, and nothing else does.
    const hosted = host();
    await new Promise<void>((resolve) =>
      hosted.server.listen(0, "127.0.0.1", resolve),
    );

    try {
      const port = (hosted.server.address() as AddressInfo).port;
      const answer = await fetch(`http://127.0.0.1:${port}/api/health`);

      expect(answer.status).toBe(200);
      expect(await answer.json()).toMatchObject({ displays: 0 });
    } finally {
      await hosted.close();
    }
  });

  it("prunes a kept connection the inner servers cannot see, so a move can land", async () => {
    // **The case that fails when this port stops pruning for itself.** The
    // binding closes idle sockets before it rebinds (`vg-173`), and a server
    // handed sockets by `emit("connection")` never builds the connection
    // registry its own `closeIdleConnections()` reads. So a browser's kept
    // connection is invisible to both inner servers, `close()` waits on it for
    // ever, and the editor's host switch stays off — the failure this case was
    // written from, at the LAN address and over the editor.
    const hosted = host();
    await new Promise<void>((resolve) =>
      hosted.server.listen(0, "127.0.0.1", resolve),
    );

    const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });

    try {
      const port = (hosted.server.address() as AddressInfo).port;
      await new Promise<void>((resolve, reject) => {
        const call = http.request(
          { host: "127.0.0.1", port, path: "/api/health", agent },
          (answer) => {
            answer.resume();
            answer.on("end", () => resolve());
          },
        );
        call.on("error", reject);
        call.end();
      });
      // A connection really is being kept, which is what makes the assertion
      // below about the port rather than about a client that hung up.
      expect(Object.values(agent.freeSockets).flat()).toHaveLength(1);

      hosted.server.closeIdleConnections();

      const closed = await Promise.race([
        hosted.close().then(() => "closed" as const),
        new Promise<"timed out">((resolve) => {
          setTimeout(() => resolve("timed out"), 5_000);
        }),
      ]);

      // Only reachable on a failure, and a test that failed has already said so
      // — this is what keeps the open handle from holding the worker up.
      hosted.server.closeAllConnections();
      expect(closed).toBe("closed");
    } finally {
      agent.destroy();
    }
  });

  it("prunes an idle TLS socket and leaves a TLS response in flight alone", async () => {
    // **The TLS half of the pruning case, and the half that was missing.** An
    // https server reports its `request` event's socket as a `tls.TLSSocket`
    // wrapping the one this port accepted, so a guard keyed on object identity
    // never matches over TLS, and this port destroys a response in flight —
    // which is what the LAN toggle would do to a display mid-fetch. The plain
    // http case above cannot see it, because there the two objects are one.
    const hosted = host();
    await new Promise<void>((resolve) =>
      hosted.server.listen(0, "127.0.0.1", resolve),
    );

    const agent = new https.Agent({ keepAlive: true, maxSockets: 1 });

    try {
      const port = (hosted.server.address() as AddressInfo).port;

      // Idle: a response that finished, on a connection the agent keeps.
      const idle = await openOverTls(port, "/api/health", agent);
      await new Promise<void>((resolve) => {
        idle.answer.on("end", () => resolve());
        idle.answer.resume();
      });
      expect(idle.socket.destroyed).toBe(false);

      // Not finished: the sample stream stays open until its client goes away,
      // so it is mid-response while the prune runs.
      const stream = await openOverTls(port, SAMPLE_STREAM_PATH);
      expect(stream.status).toBe(200);
      expect(stream.socket.destroyed).toBe(false);

      // A destroy here can reach the client as a reset, and an unhandled one
      // would take the worker down rather than fail this case.
      for (const socket of [idle.socket, stream.socket]) {
        socket.on("error", () => {});
      }

      const streamClosed = closedWithin(stream.socket, 1_000);
      const idleClosed = closedWithin(idle.socket, 1_000);
      hosted.server.closeIdleConnections();

      expect(await streamClosed).toBe(false);
      expect(await idleClosed).toBe(true);

      stream.answer.destroy();
    } finally {
      agent.destroy();
      hosted.server.closeAllConnections();
      await hosted.close();
    }
  });

  it("is plain http when the caller brings no certificate, which is why the launcher always does", async () => {
    // The case that fails when the change is disabled: the same client, the
    // same route, no certificate — and the handshake does not complete. It is
    // about the transport rather than a number, so it cannot pass on a machine
    // where the answer happens to be different.
    const hosted = createHostServer({
      registry: new ProviderRegistry([]),
      bundles: { player: tmpDir, editor: tmpDir },
    });
    await new Promise<void>((resolve) =>
      hosted.server.listen(0, "127.0.0.1", resolve),
    );

    try {
      const port = (hosted.server.address() as AddressInfo).port;
      await expect(get(port, "/api/health")).rejects.toThrow();
    } finally {
      await hosted.close();
    }
  });

  it("offers the root to a device that has no session and has not paired", async () => {
    const hosted = plainHost();

    try {
      // A non-loopback reader with no token: exactly the state a phone is in
      // while it is looking at the warning this route exists to remove.
      const answer = await request(
        hosted.server,
        "GET",
        CA_CERTIFICATE_PATH,
        undefined,
        { remoteAddress: "192.168.1.50" },
      );

      expect(answer.status).toBe(200);
      expect(answer.headers["content-type"]).toBe("application/x-x509-ca-cert");
      expect(answer.text()).toBe(origin.certificate);
    } finally {
      await hosted.close();
    }
  });

  it("says it has none rather than answering with nothing", async () => {
    const hosted = plainHost({ withRoot: false });

    try {
      const answer = await request(hosted.server, "GET", CA_CERTIFICATE_PATH);
      expect(answer.status).toBe(404);
      expect(answer.text()).toContain("no certificate");
    } finally {
      await hosted.close();
    }
  });
});
