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
import { MAX_ARCHIVE_BYTES, readThemePackage } from "@vigilia/theme-package";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
    });
    if (!result.ok) throw new Error(result.message);

    const { files } = result;
    expect(files.path).toBe(`catalogue/${THEME_ID}`);

    const parsed = parseCatalogueItemFile(JSON.parse(files.itemJson));
    if (!parsed.ok) throw new Error(parsed.reason);
    expect(parsed.file).toEqual({
      kind: DASHBOARD_THEME_KIND,
      name: "Aurora",
      version: "1.2.0",
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
    expect(files.thumbnailBytes).toEqual(PNG);
    expect(read.thumbnail).toEqual(PNG);
  });

  it("publishes a theme that declares no version as its first release", async () => {
    await store.write(THEME_ID, themeOf(THEME_ID, "Quiet", undefined), {
      expectFree: true,
    });
    await thumbnails.write(THEME_ID, PNG);

    const result = await submissionFiles(THEME_ID, store, { thumbnails });
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
    } as unknown as ThemeStore;
    const picture = { read: async () => PNG } as unknown as ThumbnailStore;

    const result = await submissionFiles(THEME_ID, oversized, {
      thumbnails: picture,
      now: () => NOW,
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
