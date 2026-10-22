import type { FabricThemeEnvelope } from "@vigilia/renderer-core";
import { writeThemePackage } from "@vigilia/theme-package";
import { describe, expect, it } from "vitest";
import { CATALOGUE_RAW_BASE, cataloguePackageUrl } from "./catalogue-source.js";
import { readPublishedItem } from "./published-item.js";

const ID = "3f2a1c9e-8b7d-4c6a-9e0f-1a2b3c4d5e6f";
const ITEM_URL = `${CATALOGUE_RAW_BASE}/catalogue/${ID}/item.json`;

const UNREADABLE =
  "The store's copy of this theme could not be read; submit again when it is reachable.";
const UNOPENABLE =
  "The store's copy of this theme cannot be opened, so its version cannot be computed.";

const envelopeFor = (id: string): FabricThemeEnvelope => ({
  schemaVersion: 2,
  fabricVersion: "7.4.0",
  id,
  metadata: { name: "Living Room", themeLanguage: "en" },
  artboard: { width: 1920, height: 1080 },
  scene: { version: "7.4.0", objects: [] },
});

function packageBytes(envelope = envelopeFor(ID)): Uint8Array<ArrayBuffer> {
  const written = writeThemePackage({ envelope, assets: {} });
  if (!written.ok) throw new Error(written.message);
  // A copy, because `zipSync` hands back a buffer the DOM typings do not
  // accept as a response body.
  return new Uint8Array(written.bytes);
}

function itemJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    kind: "dashboard-theme",
    name: "Living Room",
    version: "1.2.3",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    downloads: 7,
    favorites: 3,
    packageUrl: cataloguePackageUrl(ID),
    thumbnail: `catalogue/${ID}/thumbnail.png`,
    ...overrides,
  });
}

type Route = () => Response | Promise<Response>;

/**
 * A `typeof fetch` keyed on the two URLs this reader may ask for, recording
 * each one so a test proves which calls happened rather than only the answer.
 */
function routeFetch(routes: {
  readonly item?: Route;
  readonly package?: Route;
}): { readonly fetch: typeof globalThis.fetch; readonly seen: string[] } {
  const seen: string[] = [];
  const fetcher: typeof globalThis.fetch = async (input) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    seen.push(url);
    if (url === ITEM_URL && routes.item !== undefined) return routes.item();
    if (url === cataloguePackageUrl(ID) && routes.package !== undefined)
      return routes.package();
    throw new Error(`unexpected request: ${url}`);
  };
  return { fetch: fetcher, seen };
}

describe("readPublishedItem", () => {
  it("reports no published item when item.json is missing", async () => {
    const { fetch, seen } = routeFetch({
      item: () => new Response(null, { status: 404 }),
    });

    const result = await readPublishedItem(ID, { fetch });

    expect(result).toEqual({ ok: true });
    expect(result).not.toHaveProperty("item");
    // A missing item is ordinary, so the package is never asked for.
    expect(seen).toEqual([ITEM_URL]);
  });

  it("refuses a store that answers 500", async () => {
    const { fetch } = routeFetch({
      item: () => new Response(null, { status: 500 }),
    });

    expect(await readPublishedItem(ID, { fetch })).toEqual({
      ok: false,
      message: UNREADABLE,
    });
  });

  it("refuses a fetch that throws", async () => {
    const { fetch } = routeFetch({
      item: () => {
        throw new Error("network down");
      },
    });

    expect(await readPublishedItem(ID, { fetch })).toEqual({
      ok: false,
      message: UNREADABLE,
    });
  });

  it("refuses a body that is not JSON", async () => {
    const { fetch } = routeFetch({
      item: () => new Response("<html>not a store</html>"),
    });

    expect(await readPublishedItem(ID, { fetch })).toEqual({
      ok: false,
      message: UNREADABLE,
    });
  });

  it("refuses an answer that is not 200", async () => {
    const { fetch } = routeFetch({
      item: () => new Response(null, { status: 204 }),
    });

    expect(await readPublishedItem(ID, { fetch })).toEqual({
      ok: false,
      message: UNREADABLE,
    });
  });

  it("refuses a parseable item.json that is not a catalogue item", async () => {
    const { fetch, seen } = routeFetch({
      item: () => new Response(JSON.stringify({ kind: "dashboard-theme" })),
    });

    expect(await readPublishedItem(ID, { fetch })).toEqual({
      ok: false,
      message: UNREADABLE,
    });
    expect(seen).toEqual([ITEM_URL]);
  });

  it("refuses a recorded version that cannot be bumped", async () => {
    const { fetch, seen } = routeFetch({
      item: () => new Response(itemJson({ version: "v1" })),
    });

    expect(await readPublishedItem(ID, { fetch })).toEqual({
      ok: false,
      message:
        'The store\'s copy of this theme records version "v1", which cannot be bumped.',
    });
    expect(seen).toEqual([ITEM_URL]);
  });

  it("refuses a package the store does not answer for", async () => {
    const { fetch } = routeFetch({
      item: () => new Response(itemJson()),
      package: () => new Response(null, { status: 404 }),
    });

    expect(await readPublishedItem(ID, { fetch })).toEqual({
      ok: false,
      message: UNOPENABLE,
    });
  });

  it("refuses bytes the package reader will not open", async () => {
    const { fetch } = routeFetch({
      item: () => new Response(itemJson()),
      package: () => new Response(new Uint8Array([1, 2, 3])),
    });

    expect(await readPublishedItem(ID, { fetch })).toEqual({
      ok: false,
      message: UNOPENABLE,
    });
  });

  it("refuses a package belonging to another item", async () => {
    const { fetch } = routeFetch({
      item: () => new Response(itemJson()),
      package: () => new Response(packageBytes(envelopeFor("another-id"))),
    });

    expect(await readPublishedItem(ID, { fetch })).toEqual({
      ok: false,
      message: UNOPENABLE,
    });
  });

  it("returns the published fields and the opened envelope", async () => {
    const envelope = envelopeFor(ID);
    const { fetch, seen } = routeFetch({
      item: () => new Response(itemJson()),
      package: () => new Response(packageBytes(envelope)),
    });

    expect(await readPublishedItem(ID, { fetch })).toEqual({
      ok: true,
      item: {
        version: "1.2.3",
        createdAt: "2026-10-01T00:00:00.000Z",
        downloads: 7,
        favorites: 3,
        envelope,
      },
    });
    expect(seen).toEqual([ITEM_URL, cataloguePackageUrl(ID)]);
  });
});
