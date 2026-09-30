import type { FabricThemeEnvelope } from "@vigilia/renderer-core";
import { describe, expect, it, vi } from "vitest";
import { createThemeLibraryClient } from "./theme-library-client.js";

const envelope: FabricThemeEnvelope = {
  schemaVersion: 2,
  fabricVersion: "7.4.0",
  id: "living-room",
  artboard: { width: 1920, height: 1080 },
  metadata: { name: "Living Room", locale: "en" },
  scene: { version: "7.4.0", objects: [] },
};

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
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        if (url === "/api/themes/living-room") {
          return new Response(
            JSON.stringify({
              envelope,
              assets: {
                "assets/badge.svg": btoa("<svg/>"),
              },
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

    await client.save("living-room", content);
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
    });

    await expect(client.open("living-room")).resolves.toEqual(content);
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
