import type { FabricThemeEnvelope } from "@vigilia/renderer-core";
import { describe, expect, it, vi } from "vitest";
import {
  createThemeLibraryClient,
  ThemeConflictError,
} from "./theme-library-client.js";

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
