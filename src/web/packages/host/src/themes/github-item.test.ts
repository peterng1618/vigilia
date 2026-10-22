import { randomFillSync } from "node:crypto";
import { readFileSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  DASHBOARD_THEME_KIND,
  type FabricThemeEnvelope,
  parseCatalogueItemFile,
} from "@vigilia/renderer-core";
import {
  MAX_ARCHIVE_BYTES,
  readThemePackage,
  writeThemePackage,
} from "@vigilia/theme-package";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CATALOGUE_RAW_BASE, cataloguePackageUrl } from "./catalogue-source.js";
import { submissionFiles } from "./github-item.js";
import {
  createThemeStore,
  type ThemeContent,
  type ThemeStore,
} from "./store.js";
import { createThumbnailStore, type ThumbnailStore } from "./thumbnails.js";

const NOW = new Date("2026-10-22T09:30:00.000Z");

/** Fixed UUID theme ids, the shape every new document gets. */
const THEME_ID = "3f2a1c9e-8b7d-4c6a-9e0f-1a2b3c4d5e6f";
const MISSING_ID = "0a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d";

/** PNG magic plus a little payload: enough for the thumbnail store's check. */
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4,
]);

/** `version: undefined` writes a theme that declares none, which the envelope
 *  cannot express as a present key. */
function themeOf(
  id: string,
  name: string,
  version: string | undefined,
): ThemeContent {
  const envelope: FabricThemeEnvelope = {
    schemaVersion: 2,
    fabricVersion: "7.4.0",
    id,
    artboard: { width: 1920, height: 1080 },
    metadata: {
      name,
      ...(version === undefined ? {} : { version }),
      themeLanguage: "en",
    },
    scene: { version: "7.4.0", objects: [] },
  };
  return { envelope, assets: {} };
}

const ITEM_URL = `${CATALOGUE_RAW_BASE}/catalogue/${THEME_ID}/item.json`;
const PACKAGE_URL = cataloguePackageUrl(THEME_ID);
const PUBLISHED_AT = "2026-10-01T00:00:00.000Z";

/** A published `item.json`; every field a catalogue item needs. */
function publishedItemJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    kind: DASHBOARD_THEME_KIND,
    name: "Aurora",
    version: "1.4.0",
    createdAt: PUBLISHED_AT,
    updatedAt: PUBLISHED_AT,
    downloads: 7,
    favorites: 3,
    packageUrl: cataloguePackageUrl(THEME_ID),
    thumbnail: `catalogue/${THEME_ID}/thumbnail.png`,
    ...overrides,
  });
}

type Route = () => Response | Promise<Response>;

/** A `typeof fetch` keyed on the two URLs a submission may ask for. */
function routeFetch(routes: {
  readonly item?: Route;
  readonly package?: Route;
}): typeof globalThis.fetch {
  const fetcher: typeof globalThis.fetch = async (input) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url === ITEM_URL && routes.item !== undefined) return routes.item();
    if (url === PACKAGE_URL && routes.package !== undefined)
      return routes.package();
    throw new Error(`unexpected request: ${url}`);
  };
  return fetcher;
}

/** The store holds nothing under this id yet. */
const noPublishedItem = (): typeof globalThis.fetch =>
  routeFetch({ item: () => new Response(null, { status: 404 }) });

function packageBytesOf(
  envelope: FabricThemeEnvelope,
): Uint8Array<ArrayBuffer> {
  const written = writeThemePackage({ envelope, assets: {} });
  if (!written.ok) throw new Error(written.message);
  return new Uint8Array(written.bytes);
}

/** The store already publishes `envelope` as this item's package. */
function publishedFetch(
  envelope: FabricThemeEnvelope,
  item: Record<string, unknown> = {},
): typeof globalThis.fetch {
  return routeFetch({
    item: () => new Response(publishedItemJson(item)),
    package: () => new Response(packageBytesOf(envelope)),
  });
}

/** One scene object whose `left` is the only thing that moves. */
function sceneAt(left: number): FabricThemeEnvelope["scene"] {
  return { version: "7.4.0", objects: [{ id: "node", type: "rect", left }] };
}

/** The library theme, with a scene the published copy can differ from. */
function themeWithScene(
  left: number,
  version: string | undefined,
): ThemeContent {
  const theme = themeOf(THEME_ID, "Aurora", version);
  return { ...theme, envelope: { ...theme.envelope, scene: sceneAt(left) } };
}

describe("submissionFiles", () => {
  let libraryDir: string;
  let store: ThemeStore;
  let thumbnails: ThumbnailStore;

  beforeEach(async () => {
    libraryDir = await fs.mkdtemp(path.join(os.tmpdir(), "vigilia-item-"));
    store = createThemeStore(libraryDir);
    thumbnails = createThumbnailStore(libraryDir);
  });

  afterEach(async () => {
    await fs.rm(libraryDir, { recursive: true, force: true });
  });

  it("builds the item, the package and the path from one library theme", async () => {
    await store.write(THEME_ID, themeOf(THEME_ID, "Aurora", "1.2.0"), {
      expectFree: true,
    });
    await thumbnails.write(THEME_ID, PNG);

    const result = await submissionFiles(THEME_ID, store, {
      thumbnails,
      now: () => NOW,
      fetch: noPublishedItem(),
    });
    if (!result.ok) throw new Error(result.message);

    const { files } = result;
    expect(files.path).toBe(`catalogue/${THEME_ID}`);
    // The store holds nothing under this id, so the ladder mints 1.0.0 — the
    // document's own 1.2.0 never chooses a published version.
    expect(files.version).toBe("1.0.0");
    expect(files.from).toBeUndefined();
    expect(files.level).toBe("initial");

    const parsed = parseCatalogueItemFile(JSON.parse(files.itemJson));
    if (!parsed.ok) throw new Error(parsed.reason);
    expect(parsed.file).toEqual({
      kind: DASHBOARD_THEME_KIND,
      name: "Aurora",
      version: "1.0.0",
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      // Option B: a repository file has no download counter and no reactions.
      downloads: 0,
      favorites: 0,
      packageUrl: `https://raw.githubusercontent.com/peterng1618/vigilia-store/main/catalogue/${THEME_ID}/${THEME_ID}.zip`,
      thumbnail: `catalogue/${THEME_ID}/thumbnail.png`,
    });

    const read = readThemePackage(files.packageBytes);
    if (!read.ok) throw new Error(read.message);
    expect(read.envelope.id).toBe(THEME_ID);
    expect(read.envelope.metadata?.name).toBe("Aurora");
    expect(read.envelope.metadata?.version).toBe("1.0.0");
    expect(files.thumbnailBytes).toEqual(PNG);
    expect(read.thumbnail).toEqual(PNG);
  });

  it("lets a local metadata.version never choose the published version", async () => {
    await store.write(THEME_ID, themeOf(THEME_ID, "Aurora", "0.9.0"), {
      expectFree: true,
    });
    await thumbnails.write(THEME_ID, PNG);

    const result = await submissionFiles(THEME_ID, store, {
      thumbnails,
      now: () => NOW,
      fetch: noPublishedItem(),
    });
    if (!result.ok) throw new Error(result.message);

    expect(result.files.version).toBe("1.0.0");
    const parsed = parseCatalogueItemFile(JSON.parse(result.files.itemJson));
    if (!parsed.ok) throw new Error(parsed.reason);
    expect(parsed.file.version).toBe("1.0.0");
    // The first release is written back over the local guess.
    const stored = await store.read(THEME_ID);
    expect(stored?.envelope.metadata?.version).toBe("1.0.0");
  });

  it("bumps a changed theme to the next patch above the published version", async () => {
    await store.write(THEME_ID, themeWithScene(10, undefined), {
      expectFree: true,
    });
    await thumbnails.write(THEME_ID, PNG);
    const published = themeWithScene(0, "1.4.0").envelope;

    const result = await submissionFiles(THEME_ID, store, {
      thumbnails,
      now: () => NOW,
      fetch: publishedFetch(published),
    });
    if (!result.ok) throw new Error(result.message);

    expect(result.files.version).toBe("1.4.1");
    expect(result.files.from).toBe("1.4.0");
    expect(result.files.level).toBe("patch");

    const parsed = parseCatalogueItemFile(JSON.parse(result.files.itemJson));
    if (!parsed.ok) throw new Error(parsed.reason);
    // The item keeps the published item's history; only `updatedAt` moves.
    expect(parsed.file.version).toBe("1.4.1");
    expect(parsed.file.createdAt).toBe(PUBLISHED_AT);
    expect(parsed.file.updatedAt).toBe(NOW.toISOString());
    expect(parsed.file.downloads).toBe(7);
    expect(parsed.file.favorites).toBe(3);

    // The version is written to the library document before the package is
    // built, and the package is built from that written document.
    const stored = await store.read(THEME_ID);
    expect(stored?.envelope.metadata?.version).toBe("1.4.1");
    const read = readThemePackage(result.files.packageBytes);
    if (!read.ok) throw new Error(read.message);
    expect(read.envelope.metadata?.version).toBe("1.4.1");
  });

  it("refuses a theme that has not changed since the published version", async () => {
    const unchanged = themeWithScene(10, "1.4.0");
    await store.write(THEME_ID, unchanged, { expectFree: true });
    await thumbnails.write(THEME_ID, PNG);
    const before = await store.read(THEME_ID);

    const result = await submissionFiles(THEME_ID, store, {
      thumbnails,
      now: () => NOW,
      fetch: publishedFetch(unchanged.envelope),
    });

    expect(result).toEqual({
      ok: false,
      message:
        "Version 1.4.0 is published and this theme has not changed since it.",
    });
    // Nothing was written: the stored document is byte-for-byte the one read.
    expect((await store.read(THEME_ID))?.base).toBe(before?.base);
  });

  it("passes a published-item refusal through verbatim", async () => {
    await store.write(THEME_ID, themeOf(THEME_ID, "Aurora", undefined), {
      expectFree: true,
    });
    await thumbnails.write(THEME_ID, PNG);
    const before = await store.read(THEME_ID);

    const result = await submissionFiles(THEME_ID, store, {
      thumbnails,
      fetch: routeFetch({ item: () => new Response(null, { status: 500 }) }),
    });

    expect(result).toEqual({
      ok: false,
      message:
        "The store's copy of this theme could not be read; submit again when it is reachable.",
    });
    expect((await store.read(THEME_ID))?.base).toBe(before?.base);
  });

  it("refuses a published version the ladder cannot bump", async () => {
    await store.write(THEME_ID, themeWithScene(10, undefined), {
      expectFree: true,
    });
    await thumbnails.write(THEME_ID, PNG);
    // Version-shaped, but past the safe-integer range `bumpVersion` refuses.
    const unsafe = "9007199254740993.0.0";

    const result = await submissionFiles(THEME_ID, store, {
      thumbnails,
      fetch: publishedFetch(themeWithScene(0, undefined).envelope, {
        version: unsafe,
      }),
    });

    expect(result).toEqual({
      ok: false,
      message: `The store's copy of this theme records version "${unsafe}", which cannot be bumped.`,
    });
  });

  it("refuses a write that raced a save, keeping the save's version", async () => {
    const real = store;
    let saved = false;
    const racing: ThemeStore = {
      ...real,
      async write(id, content, options) {
        // Another save lands between the submission's read and its write.
        if (!saved && options?.base !== undefined) {
          saved = true;
          const current = await real.read(id);
          if (current !== undefined) {
            await real.write(
              id,
              {
                envelope: {
                  ...current.envelope,
                  metadata: { ...current.envelope.metadata, version: "9.9.9" },
                },
                assets: current.assets,
              },
              { overwrite: true },
            );
          }
        }
        return real.write(id, content, options);
      },
    };
    await store.write(THEME_ID, themeWithScene(10, undefined), {
      expectFree: true,
    });
    await thumbnails.write(THEME_ID, PNG);

    const result = await submissionFiles(THEME_ID, racing, {
      thumbnails,
      now: () => NOW,
      fetch: publishedFetch(themeWithScene(0, "1.4.0").envelope),
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.message).toContain(
      "changed by someone else",
    );
    // The racing save is the stored document; the submission did not replace it.
    expect((await store.read(THEME_ID))?.envelope.metadata?.version).toBe(
      "9.9.9",
    );
  });

  it("publishes a theme that declares no version as its first release", async () => {
    await store.write(THEME_ID, themeOf(THEME_ID, "Quiet", undefined), {
      expectFree: true,
    });
    await thumbnails.write(THEME_ID, PNG);

    const result = await submissionFiles(THEME_ID, store, {
      thumbnails,
      fetch: noPublishedItem(),
    });
    if (!result.ok) throw new Error(result.message);

    const parsed = parseCatalogueItemFile(JSON.parse(result.files.itemJson));
    if (!parsed.ok) throw new Error(parsed.reason);
    expect(parsed.file.version).toBe("1.0.0");
    expect(parsed.file.thumbnail).toBe(`catalogue/${THEME_ID}/thumbnail.png`);
  });

  it("refuses a video past the duration cap before a submission is built", async () => {
    // The committed 31.5 s fixture, read rather than regenerated.
    const long = new Uint8Array(
      readFileSync(
        new URL(
          "../../../theme-package/test-fixtures/long.mp4",
          import.meta.url,
        ),
      ),
    );
    const content = themeOf(THEME_ID, "Aurora", "1.2.0");
    await store.write(
      THEME_ID,
      {
        envelope: {
          ...content.envelope,
          assets: [{ id: "clip", kind: "video", path: "assets/clip.mp4" }],
        },
        assets: { "assets/clip.mp4": long },
      },
      { expectFree: true },
    );
    await thumbnails.write(THEME_ID, PNG);

    const result = await submissionFiles(THEME_ID, store, { thumbnails });

    expect(result).toEqual({
      ok: false,
      message:
        "assets/clip.mp4: duration 31500 ms exceeds the 30000 ms maximum",
    });
  });

  it("refuses a theme with no picture, naming what to do", async () => {
    await store.write(THEME_ID, themeOf(THEME_ID, "Quiet", "1.0.0"), {
      expectFree: true,
    });

    const result = await submissionFiles(THEME_ID, store, { thumbnails });

    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.message).toBe(
      "This theme has no picture yet; set one before submitting.",
    );
  });

  it("refuses an id the store would never hold", async () => {
    const result = await submissionFiles("../aurora", store, { thumbnails });

    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.message).toContain("../aurora");
    expect(result.ok ? "" : result.message).toContain("not a theme id");
  });

  it("refuses a package over the reader's cap before uploading it", async () => {
    // Incompressible, so the zip's own size stays over the cap: the check is on
    // the bytes that would be committed, not on the assets' declared sizes.
    const big = new Uint8Array(MAX_ARCHIVE_BYTES + 1024);
    randomFillSync(big);
    const envelope: FabricThemeEnvelope = {
      ...themeOf(THEME_ID, "Big", "1.0.0").envelope,
      assets: [{ id: "big", kind: "image", path: "assets/big.bin" }],
    };
    const oversized = {
      read: async () => ({ envelope, assets: { "assets/big.bin": big } }),
      // The version write itself succeeds; the package is what is measured.
      write: async () => ({ ok: true }),
    } as unknown as ThemeStore;
    const picture = { read: async () => PNG } as unknown as ThumbnailStore;

    const result = await submissionFiles(THEME_ID, oversized, {
      thumbnails: picture,
      now: () => NOW,
      fetch: noPublishedItem(),
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.message).toContain(
      "That package is too large to open",
    );
    expect(result.ok ? "" : result.message).toContain(
      String(MAX_ARCHIVE_BYTES),
    );
  }, 30_000);

  it("does not put a store failure's path in the refusal", async () => {
    const failing = {
      read: async () => {
        throw new Error(`EPERM: D:\\Users\\peter\\library\\${THEME_ID}.json`);
      },
    } as unknown as ThemeStore;

    const result = await submissionFiles(THEME_ID, failing, { thumbnails });

    expect(result.ok ? "" : result.message).toBe(
      `This PC's library could not read theme "${THEME_ID}".`,
    );
  });

  it("refuses an id the library does not hold", async () => {
    const result = await submissionFiles(MISSING_ID, store, { thumbnails });

    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.message).toContain(MISSING_ID);
    expect(result.ok ? "" : result.message).toContain("holds no theme");
  });
});
