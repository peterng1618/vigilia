import { describe, expect, it, vi } from "vitest";
import { createThemeLibraryClient } from "./theme-library-client.js";

describe("ThemeLibraryClient", () => {
  it("saves and opens packages through the host theme routes", async () => {
    const packageBytes = new Uint8Array([1, 2, 3, 4]);
    const mockFetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === "PUT" && url === "/api/themes/living-room") {
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        if (url === "/api/themes/living-room") {
          return new Response(packageBytes, { status: 200 });
        }
        return new Response("Not found", { status: 404 });
      },
    );

    const client = createThemeLibraryClient({
      fetch: mockFetch as unknown as typeof fetch,
    });

    await client.save("living-room", packageBytes);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/themes/living-room",
      expect.objectContaining({ method: "PUT" }),
    );

    await expect(client.open("living-room")).resolves.toEqual(packageBytes);
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
      client.save("living-room", new Uint8Array([1])),
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

    await expect(client.save("../escape", new Uint8Array())).rejects.toThrow(
      "Invalid theme id",
    );
    await expect(client.open("../escape")).rejects.toThrow("Invalid theme id");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
