import { describe, expect, it, vi } from "vitest";
import { createFavoritesClient } from "./favorites-client.js";

describe("the favourites client", () => {
  it("reads the host's list", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ favorites: ["dashboard"] }), {
        status: 200,
      }),
    );

    expect(await createFavoritesClient({ fetch: fetcher }).list()).toEqual([
      "dashboard",
    ]);
    expect(fetcher).toHaveBeenCalledWith("/api/font-favorites");
  });

  it("reads empty when the host keeps no favourites", async () => {
    // The host answers 404 for a build without the store; that is "none", not a
    // failure, or a standalone editor would report a broken host on every open.
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response("", { status: 404 }));

    expect(await createFavoritesClient({ fetch: fetcher }).list()).toEqual([]);
  });

  it("writes the list back and answers what the host stored", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ favorites: ["terminal"] }), {
        status: 200,
      }),
    );

    expect(
      await createFavoritesClient({ fetch: fetcher }).save(["terminal"]),
    ).toEqual(["terminal"]);
    expect(fetcher).toHaveBeenCalledWith("/api/font-favorites", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ favorites: ["terminal"] }),
    });
  });

  it("refuses rather than reporting a save the host did not make", async () => {
    // A 403 is a host this PC is not paired with. Answering the list as though
    // it were stored would leave the author's star on with nothing behind it.
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response("", { status: 403 }));

    await expect(
      createFavoritesClient({ fetch: fetcher }).save(["dashboard"]),
    ).rejects.toThrow("403");
  });
});
