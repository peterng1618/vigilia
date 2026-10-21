import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  DASHBOARD_THEME_KIND,
  type FabricThemeEnvelope,
  parseCatalogueItemFile,
} from "@vigilia/renderer-core";
import { readThemePackage } from "@vigilia/theme-package";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { submissionFiles } from "./github-item.js";
import {
  createThemeStore,
  type ThemeContent,
  type ThemeStore,
} from "./store.js";
import { createThumbnailStore, type ThumbnailStore } from "./thumbnails.js";

const NOW = new Date("2026-10-22T09:30:00.000Z");

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
    await store.write("aurora", themeOf("aurora", "Aurora", "1.2.0"), {
      expectFree: true,
    });
    await thumbnails.write("aurora", PNG);

    const result = await submissionFiles("aurora", store, {
      thumbnails,
      now: () => NOW,
    });
    if (!result.ok) throw new Error(result.message);

    const { files } = result;
    expect(files.path).toBe("catalogue/aurora");

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
      packageUrl:
        "https://raw.githubusercontent.com/peterng1618/vigilia-store/main/catalogue/aurora/aurora.zip",
      thumbnail: "catalogue/aurora/thumbnail.png",
    });

    const read = readThemePackage(files.packageBytes);
    if (!read.ok) throw new Error(read.message);
    expect(read.envelope.id).toBe("aurora");
    expect(read.envelope.metadata?.name).toBe("Aurora");
    expect(files.thumbnail).toEqual(PNG);
    expect(read.thumbnail).toEqual(PNG);
  });

  it("still submits a theme whose thumbnail was never captured", async () => {
    await store.write("quiet", themeOf("quiet", "Quiet", undefined), {
      expectFree: true,
    });

    const result = await submissionFiles("quiet", store, { thumbnails });
    if (!result.ok) throw new Error(result.message);

    expect(result.files.thumbnail).toBeUndefined();
    const parsed = parseCatalogueItemFile(JSON.parse(result.files.itemJson));
    if (!parsed.ok) throw new Error(parsed.reason);
    // The wire requires a path even though there is no file to put there; the
    // first release is the version a theme that declares none is published as.
    expect(parsed.file.thumbnail).toBe("catalogue/quiet/thumbnail.png");
    expect(parsed.file.version).toBe("1.0.0");

    const read = readThemePackage(result.files.packageBytes);
    if (!read.ok) throw new Error(read.message);
    expect(read.thumbnail).toBeUndefined();
  });

  it("refuses an id the store would never hold", async () => {
    const result = await submissionFiles("../aurora", store, { thumbnails });

    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.message).toContain("../aurora");
    expect(result.ok ? "" : result.message).toContain("not a theme id");
  });

  it("refuses an id the library does not hold", async () => {
    const result = await submissionFiles("missing", store, { thumbnails });

    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.message).toContain("missing");
    expect(result.ok ? "" : result.message).toContain("holds no theme");
  });
});
