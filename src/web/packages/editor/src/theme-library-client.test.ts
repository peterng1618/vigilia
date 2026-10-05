import type { FabricThemeEnvelope } from "@vigilia/renderer-core";
import { describe, expect, it, vi } from "vitest";
import {
  createThemeLibraryClient,
  ThemeConflictError,
  type ThemeLibraryClient,
} from "./theme-library-client.js";

const envelope: FabricThemeEnvelope = {
  schemaVersion: 2,
  fabricVersion: "7.4.0",
  id: "living-room",
  artboard: { width: 1920, height: 1080 },
  metadata: { name: "Living Room", themeLanguage: "en" },
  scene: { version: "7.4.0", objects: [] },
};

/** What a request body costs on the wire, which is the only size that matters. */
const bytes = (body: string): number => new TextEncoder().encode(body).length;

/** `remove` is optional on the interface, so a test that exercises it says it
 *  is here rather than reaching through `?.` at every call. */
function removing(client: ThemeLibraryClient): (id: string) => Promise<void> {
  const remove = client.remove;
  if (remove === undefined) throw new Error("this client cannot remove");
  return remove.bind(client);
}

describe("ThemeLibraryClient", () => {
  it("saves and opens a theme's content, not an archive", async () => {
    const content = {
      envelope,
      assets: { "assets/badge.svg": new TextEncoder().encode("<svg/>") },
    };
    const mockFetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === "PUT" && url === "/api/themes/living-room") {
          return new Response(
            JSON.stringify({ ok: true, base: "base-after-save" }),
            { status: 200 },
          );
        }
        if (url === "/api/themes/living-room") {
          return new Response(
            JSON.stringify({
              envelope,
              assets: {
                "assets/badge.svg": btoa("<svg/>"),
              },
              base: "base-as-stored",
            }),
            { status: 200 },
          );
        }
        return new Response("Not found", { status: 404 });
      },
    );

    const client = createThemeLibraryClient({
      fetch: mockFetch as unknown as typeof fetch,
    });

    await expect(client.save("living-room", content)).resolves.toBe(
      "base-after-save",
    );
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/themes/living-room",
      expect.objectContaining({ method: "PUT" }),
    );
    // The seam the store depends on: the document rides as JSON and the
    // declared bytes as base64, keyed by the path the document declares.
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      envelope,
      assets: { "assets/badge.svg": btoa("<svg/>") },
      overwrite: false,
    });

    // What an open reports as stored is what the next save is based on, so
    // the two are the same value travelling back the way it came.
    await expect(client.open("living-room")).resolves.toEqual({
      ...content,
      base: "base-as-stored",
    });
  });

  it("puts nothing on the wire for an asset the payload leaves out", async () => {
    // The last link in the chain, and the one that can be measured rather than
    // inferred: a save that carries no bytes for a declared asset produces a
    // body with no base64 in it, however large that asset was in the editor.
    const backdrop = new Uint8Array(448 * 1024).fill(7);
    const mockFetch = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ ok: true, base: "base-after-save" }), {
          status: 200,
        }),
    );
    const client = createThemeLibraryClient({
      fetch: mockFetch as unknown as typeof fetch,
    });

    const full = await (async () => {
      await client.save("living-room", {
        envelope: {
          ...envelope,
          metadata: { ...envelope.metadata, name: "1" },
        },
        assets: { "assets/backdrop.png": backdrop },
        base: "base-as-stored",
      });
      return String(mockFetch.mock.calls.at(-1)?.[1]?.body);
    })();

    const partial = await (async () => {
      await client.save("living-room", {
        envelope: {
          ...envelope,
          metadata: { ...envelope.metadata, name: "2" },
        },
        assets: {},
        base: "base-as-stored",
      });
      return String(mockFetch.mock.calls.at(-1)?.[1]?.body);
    })();

    // The document still declares the backdrop in both, and the base travels
    // in both — so the host is being told what it already has, not asked to
    // forget it. The 438 KB is simply not there the second time.
    const decoded = JSON.parse(partial) as {
      assets: Record<string, string>;
      base: string;
    };
    expect(Object.keys(decoded.assets)).toEqual([]);
    expect(decoded.base).toBe("base-as-stored");
    expect(bytes(partial)).toBeLessThan(bytes(full) / 100);
    expect(bytes(full)).toBeGreaterThan(448 * 1024);
  });

  it("lists themes with metadata", async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          themes: [
            {
              id: "living-room",
              name: "Living Room",
              updatedAt: "2026-09-19T00:00:00.000Z",
            },
          ],
        }),
        { status: 200 },
      );
    });

    const client = createThemeLibraryClient({
      fetch: mockFetch as unknown as typeof fetch,
    });
    const list = await client.list();
    expect(list).toEqual([
      {
        id: "living-room",
        name: "Living Room",
        updatedAt: "2026-09-19T00:00:00.000Z",
      },
    ]);
  });

  it("throws descriptive error on save failure", async () => {
    const mockFetch = vi.fn(
      async () => new Response("Invalid package", { status: 400 }),
    );
    const client = createThemeLibraryClient({
      fetch: mockFetch as unknown as typeof fetch,
    });

    await expect(
      client.save("living-room", { envelope, assets: {} }),
    ).rejects.toThrow('Could not save theme "living-room" (400)');
  });

  it("reports a refused save as a conflict, not a failed one", async () => {
    const mockFetch = vi.fn(
      async () =>
        new Response('"living-room" was changed by someone else.', {
          status: 409,
        }),
    );
    const client = createThemeLibraryClient({
      fetch: mockFetch as unknown as typeof fetch,
    });

    // Its own error, because this is the one save failure the caller can act
    // on rather than retry: it is what lets the session offer reload or
    // overwrite instead of reporting an ordinary failure and giving up.
    const refusal = client.save("living-room", {
      envelope,
      assets: {},
      base: "the-base-it-opened",
    });
    await expect(refusal).rejects.toThrow(ThemeConflictError);
    await expect(refusal).rejects.toThrow("changed by someone else");

    // The base travels out, and an overwrite is an explicit, separate ask.
    const sentBody = (call: unknown): Record<string, unknown> => {
      const [, init] = call as [string, RequestInit];
      return JSON.parse(String(init?.body)) as Record<string, unknown>;
    };
    expect(sentBody(mockFetch.mock.calls[0])).toMatchObject({
      base: "the-base-it-opened",
      overwrite: false,
    });
    await client
      .save("living-room", { envelope, assets: {} }, { overwrite: true })
      .catch(() => undefined);
    expect(sentBody(mockFetch.mock.calls[1]).overwrite).toBe(true);
  });

  it("removes a theme with DELETE, and says why when it cannot", async () => {
    let deletes = 0;
    const mockFetch = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method !== "DELETE") {
          return new Response("Not found", { status: 404 });
        }
        deletes += 1;
        // The first delete lands; the second finds it already gone, which is a
        // different answer from "the host is unreachable" and needs its own word.
        return deletes === 1
          ? new Response(JSON.stringify({ ok: true }), { status: 200 })
          : new Response('No theme "living-room" in this library.', {
              status: 404,
            });
      },
    );
    const client = createThemeLibraryClient({
      fetch: mockFetch as unknown as typeof fetch,
    });

    const remove = removing(client);
    await remove("living-room");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/themes/living-room",
      expect.objectContaining({ method: "DELETE" }),
    );

    await expect(remove("living-room")).rejects.toThrow(
      'No theme "living-room"',
    );

    await expect(remove("../escape")).rejects.toThrow("Invalid theme id");
  });

  it("passes the host's own reason through when the trash refused", async () => {
    // Nothing was removed, so the message must not read like a lost document.
    // The platform's reason is the one the author can act on.
    const mockFetch = vi.fn(
      async () =>
        new Response(
          "This PC has no trash command (gio, trash-put), so the theme was left alone.",
          { status: 500 },
        ),
    );
    const client = createThemeLibraryClient({
      fetch: mockFetch as unknown as typeof fetch,
    });

    await expect(removing(client)("living-room")).rejects.toThrow(
      "no trash command",
    );
  });

  it("throws descriptive error on open failure", async () => {
    const mockFetch = vi.fn(
      async () => new Response("Not Found", { status: 404 }),
    );
    const client = createThemeLibraryClient({
      fetch: mockFetch as unknown as typeof fetch,
    });

    await expect(client.open("not-found")).rejects.toThrow(
      'Could not open theme "not-found" (404)',
    );
  });

  it("refuses invalid theme IDs without fetching", async () => {
    const mockFetch = vi.fn();
    const client = createThemeLibraryClient({
      fetch: mockFetch as unknown as typeof fetch,
    });

    await expect(
      client.save("../escape", { envelope, assets: {} }),
    ).rejects.toThrow("Invalid theme id");
    await expect(client.open("../escape")).rejects.toThrow("Invalid theme id");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
