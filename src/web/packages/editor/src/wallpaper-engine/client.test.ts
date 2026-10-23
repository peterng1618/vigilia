import { describe, expect, it } from "vitest";
import {
  creditsEntryOf,
  fetchItemAsset,
  fetchWallpaperEngine,
  type WallpaperEngineItem,
} from "./client.js";

const item = {
  workshopId: "201",
  title: "Rain on glass",
  kind: "video",
  previewUrl: "/api/wallpaper-engine/item/201/preview",
  filesize: 4_194_304,
  tags: ["Rain"],
  stillAtRest: undefined,
  hasText: undefined,
  attribution: {
    steamId: "76561198000000000",
    workshopUrl: "https://steamcommunity.com/sharedfiles/filedetails/?id=201",
  },
} satisfies WallpaperEngineItem;

function stub(
  responder: (url: string, init: RequestInit | undefined) => Response,
) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];

  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    return responder(url, init);
  }) as typeof fetch;

  return { fetcher, calls };
}

describe("fetchWallpaperEngine", () => {
  it("reads the listing route", async () => {
    const { fetcher, calls } = stub(
      () =>
        new Response(
          JSON.stringify({
            available: true,
            install: "D:/Steam/steamapps/common/wallpaper_engine",
            items: [item],
            skipped: 2,
          }),
          { status: 200 },
        ),
    );

    expect(await fetchWallpaperEngine({ fetch: fetcher })).toEqual({
      available: true,
      items: [item],
      skipped: 2,
    });
    expect(calls[0]?.url).toBe("/api/wallpaper-engine");
  });

  it("answers not-installed for a body that is not the listing", async () => {
    const { fetcher } = stub(
      () => new Response(JSON.stringify({ items: "nope" }), { status: 200 }),
    );

    expect(await fetchWallpaperEngine({ fetch: fetcher })).toEqual({
      available: false,
      reason: "not-installed",
    });
  });

  it("answers not-installed rather than throwing when the host is unreachable", async () => {
    const fetcher = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;

    expect(await fetchWallpaperEngine({ fetch: fetcher })).toEqual({
      available: false,
      reason: "not-installed",
    });
  });

  it("skips a malformed item rather than fabricating one", async () => {
    const { fetcher } = stub(
      () =>
        new Response(
          JSON.stringify({
            available: true,
            items: [item, { workshopId: 7 }, { ...item, kind: "gif" }],
            skipped: 0,
          }),
          { status: 200 },
        ),
    );

    expect(await fetchWallpaperEngine({ fetch: fetcher })).toEqual({
      available: true,
      items: [item],
      skipped: 0,
    });
  });
});

describe("fetchItemAsset", () => {
  it("names the file by the item's title plus the payload extension", async () => {
    const { fetcher, calls } = stub(
      () =>
        new Response("mp4-bytes", {
          status: 200,
          headers: { "content-type": "video/mp4" },
        }),
    );

    const file = await fetchItemAsset(item, { fetch: fetcher });

    expect(calls[0]?.url).toBe("/api/wallpaper-engine/item/201/asset");
    expect(file?.name).toBe("Rain on glass.mp4");
    expect(file?.type).toBe("video/mp4");
    expect(new TextDecoder().decode(await file?.arrayBuffer())).toBe(
      "mp4-bytes",
    );
  });

  it("prefers the filename the host served", async () => {
    const { fetcher } = stub(
      () =>
        new Response("png-bytes", {
          status: 200,
          headers: {
            "content-type": "image/png",
            "x-yunari-filename": "glass.png",
          },
        }),
    );

    expect((await fetchItemAsset(item, { fetch: fetcher }))?.name).toBe(
      "glass.png",
    );
  });

  it("answers undefined for an item the host cannot serve", async () => {
    const { fetcher } = stub(() => new Response("", { status: 404 }));

    expect(await fetchItemAsset(item, { fetch: fetcher })).toBeUndefined();
  });
});

describe("creditsEntryOf", () => {
  it("carries the workshop entry, the author and no licence claim", () => {
    expect(creditsEntryOf(item)).toEqual({
      kind: "wallpaper",
      title: "Rain on glass",
      author: { steamId: "76561198000000000" },
      source: {
        workshopId: "201",
        url: "https://steamcommunity.com/sharedfiles/filedetails/?id=201",
      },
      license: "unknown",
      changes: "Copied unchanged",
    });
  });

  it("omits attribution the listing did not carry", () => {
    expect(creditsEntryOf({ ...item, attribution: undefined })).toEqual({
      kind: "wallpaper",
      title: "Rain on glass",
      license: "unknown",
      changes: "Copied unchanged",
    });
  });
});
