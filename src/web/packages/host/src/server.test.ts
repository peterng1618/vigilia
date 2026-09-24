import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import type { FabricThemeEnvelope } from "@vigilia/renderer-core";
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
import { createThemeStore } from "./themes/store.js";

function createValidPackage(
  id = "living-room",
  name = "Living Room",
  semanticKey?: string,
): Uint8Array {
  const envelope: FabricThemeEnvelope = {
    schemaVersion: 2,
    fabricVersion: "7.4.0",
    id,
    artboard: { width: 1920, height: 1080 },
    metadata: { name },
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
  return result.bytes;
}

function createPackageWithAsset(
  path: string,
  bytes: readonly number[],
): Uint8Array {
  const envelope: FabricThemeEnvelope = {
    schemaVersion: 2,
    fabricVersion: "7.4.0",
    id: "living-room",
    artboard: { width: 1920, height: 1080 },
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
  const result = writeThemePackage({
    envelope,
    assets: { [path]: new Uint8Array(bytes) },
  });
  if (!result.ok) throw new Error(result.message);
  return result.bytes;
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
  let validEmptyAssetPackage: Uint8Array;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "vigilia-host-theme-test-"),
    );
    validEmptyAssetPackage = createValidPackage("living-room", "Living Room");
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
      validEmptyAssetPackage,
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

    const rawRes = await request(
      hosted.server,
      "GET",
      "/api/themes/living-room",
    );
    expect(rawRes.status).toBe(200);
    expect(new Uint8Array(rawRes.body)).toEqual(validEmptyAssetPackage);
  });

  it("serves only declared package asset bytes", async () => {
    await request(
      hosted.server,
      "PUT",
      "/api/themes/living-room",
      createPackageWithAsset("assets/inter-400.woff2", [1, 2]),
    );

    const asset = await request(
      hosted.server,
      "GET",
      "/api/themes/living-room/assets/assets%2Finter-400.woff2",
    );
    expect(asset.status).toBe(200);
    expect([...asset.body]).toEqual([1, 2]);
    expect(asset.headers["content-type"]).toContain("application/octet-stream");
  });

  it("refuses undeclared and traversal-like asset paths", async () => {
    await request(
      hosted.server,
      "PUT",
      "/api/themes/living-room",
      createPackageWithAsset("assets/inter-400.woff2", [1, 2]),
    );

    expect(
      (
        await request(
          hosted.server,
          "GET",
          "/api/themes/living-room/assets/assets%2Fmissing.woff2",
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await request(
          hosted.server,
          "GET",
          "/api/themes/living-room/assets/%2e%2e%2Fsecret",
        )
      ).status,
    ).toBe(404);
  });

  it("forbids PUT from non-loopback addresses (§7)", async () => {
    const res = await request(
      hosted.server,
      "PUT",
      "/api/themes/living-room",
      validEmptyAssetPackage,
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
        sessions,
      });
      await request(
        paired.server,
        "PUT",
        "/api/themes/living-room",
        validEmptyAssetPackage,
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
      validEmptyAssetPackage,
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
      validEmptyAssetPackage,
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
      validEmptyAssetPackage,
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
      validEmptyAssetPackage,
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

  /** Writes one theme package into the store the host reads. */
  async function seed(id: string, semanticKey?: string): Promise<void> {
    await request(
      hosted.server,
      "PUT",
      `/api/themes/${id}`,
      createValidPackage(id, id, semanticKey),
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
    expect(pushed.at(-1)).toEqual({ systemDisk: "disk-d" });

    // Another theme reads the machine's own answer, not this theme's.
    await request(
      hosted.server,
      "PUT",
      "/api/themes/active",
      json({ id: "disk-spare" }),
    );
    expect(pushed.at(-1)).toEqual({ systemDisk: "disk-c" });
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
    expect(pushed.at(-1)).toEqual({ gpu: "gpu-1", systemDisk: "disk-d" });
  });
});
