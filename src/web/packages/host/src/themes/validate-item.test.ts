import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { FabricThemeEnvelope } from "@vigilia/renderer-core";
import { writeThemePackage } from "@vigilia/theme-package";
import { afterEach, describe, expect, it, vi } from "vitest";
import { validateCatalogueItem, validateItemCommand } from "./validate-item.js";

/** The smallest envelope `validateFabricThemeEnvelope` accepts. */
function themeFor(id: string): FabricThemeEnvelope {
  return {
    schemaVersion: 2,
    fabricVersion: "7.4.0",
    id,
    artboard: { width: 1920, height: 1080 },
    metadata: { name: `Theme ${id}`, author: "Ada", themeLanguage: "en" },
    scene: { version: "7.4.0", objects: [] },
  };
}

function itemFor(id: string): Record<string, unknown> {
  return {
    kind: "dashboard-theme",
    name: `Theme ${id}`,
    version: "1.0.0",
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-02T00:00:00Z",
    downloads: 0,
    favorites: 0,
    packageUrl: `https://raw.githubusercontent.com/peterng1618/vigilia-store/main/catalogue/${id}/${id}.zip`,
    thumbnail: `catalogue/${id}/thumbnail.png`,
  };
}

/** PNG magic: enough for the package writer's picture check. */
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4,
]);

/** ZIP magic and nothing else: a package `readThemePackage` refuses. */
const NOT_A_PACKAGE = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

/** The committed 31.5 s fixture, read rather than regenerated. */
const LONG_VIDEO = new Uint8Array(
  readFileSync(
    new URL("../../../theme-package/test-fixtures/long.mp4", import.meta.url),
  ),
);

const DURATION_REFUSAL =
  "assets/clip.mp4: duration 31500 ms exceeds the 30000 ms maximum";

/** The catalogue id every fixture directory carries; the id gate precedes the
 *  checks these cases were written for. */
const ID = "3f2a1c9e-8b7d-4c6a-9e0f-1a2b3c4d5e6f";

const temporary: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporary.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

/** One `catalogue/<id>/` directory, with whichever halves a case needs. */
async function itemDirectory(input: {
  readonly id: string;
  readonly item?: Record<string, unknown> | null;
  readonly packageBytes?: Uint8Array | null;
  readonly thumbnail?: Uint8Array | null;
}): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "vigilia-catalogue-"));
  temporary.push(root);
  const directory = path.join(root, input.id);
  await mkdir(directory, { recursive: true });
  if (input.item !== null) {
    await writeFile(
      path.join(directory, "item.json"),
      JSON.stringify(input.item ?? itemFor(input.id)),
    );
  }
  if (input.thumbnail !== null) {
    await writeFile(
      path.join(directory, "thumbnail.png"),
      input.thumbnail ?? PNG,
    );
  }
  if (input.packageBytes !== null) {
    await writeFile(
      path.join(directory, `${input.id}.zip`),
      input.packageBytes ?? packageBytesFor(input.id),
    );
  }
  return directory;
}

/** A package carrying the theme `id`, written by the app's own writer. */
function packageBytesFor(id: string): Uint8Array {
  const written = writeThemePackage({
    envelope: themeFor(id),
    assets: {},
  });
  if (!written.ok) throw new Error(written.message);
  return written.bytes;
}

/** A package declaring one video asset, carrying the over-cap fixture. */
function packageWithLongVideo(id: string): Uint8Array {
  const written = writeThemePackage({
    envelope: {
      ...themeFor(id),
      assets: [{ id: "clip", kind: "video", path: "assets/clip.mp4" }],
    },
    assets: { "assets/clip.mp4": LONG_VIDEO },
  });
  if (!written.ok) throw new Error(written.message);
  return written.bytes;
}

describe("validateCatalogueItem", () => {
  it("refuses a directory whose name is not a catalogue id", async () => {
    const directory = await itemDirectory({ id: "aurora" });

    expect(await validateCatalogueItem(directory)).toEqual({
      ok: false,
      id: "aurora",
      reason:
        'the directory name "aurora" is not a catalogue id; a catalogue id is a lowercase UUID.',
    });
  });

  it("refuses a non-UUID name before reading anything", async () => {
    // The directory does not exist: without the id gate the refusal would be
    // the missing `item.json`, so this pins the gate above every read.
    const root = await mkdtemp(path.join(os.tmpdir(), "vigilia-catalogue-"));
    temporary.push(root);

    expect(await validateCatalogueItem(path.join(root, "aurora"))).toEqual({
      ok: false,
      id: "aurora",
      reason:
        'the directory name "aurora" is not a catalogue id; a catalogue id is a lowercase UUID.',
    });
  });

  it("accepts a directory whose header, path and package agree", async () => {
    const directory = await itemDirectory({ id: ID });

    expect(await validateCatalogueItem(directory)).toEqual({
      ok: true,
      id: ID,
    });
  });

  it("refuses a directory with no item.json", async () => {
    const directory = await itemDirectory({ id: ID, item: null });

    expect(await validateCatalogueItem(directory)).toEqual({
      ok: false,
      id: ID,
      reason: "item.json is missing.",
    });
  });

  it("refuses a kind this build does not ship", async () => {
    const directory = await itemDirectory({
      id: ID,
      item: { ...itemFor(ID), kind: "dashboard-theme " },
    });

    const checked = await validateCatalogueItem(directory);

    expect(checked).toMatchObject({
      ok: false,
      reason: 'kind "dashboard-theme " is not a kind this build ships.',
    });
  });

  it("refuses a package that does not parse", async () => {
    const directory = await itemDirectory({
      id: ID,
      packageBytes: NOT_A_PACKAGE,
    });

    const checked = await validateCatalogueItem(directory);

    expect(checked).toMatchObject({
      ok: false,
      reason: "That file is not a readable theme package.",
    });
  });

  it("refuses a packageUrl naming a file the PR does not carry", async () => {
    const directory = await itemDirectory({
      id: ID,
      item: {
        ...itemFor(ID),
        packageUrl: "https://example.test/aurora.zip",
      },
    });

    const checked = await validateCatalogueItem(directory);

    expect(checked).toMatchObject({
      ok: false,
      reason: `packageUrl must be https://raw.githubusercontent.com/peterng1618/vigilia-store/main/catalogue/${ID}/${ID}.zip, not "https://example.test/aurora.zip".`,
    });
  });

  it("refuses a packageUrl whose path is right but whose host is not the store's", async () => {
    const directory = await itemDirectory({
      id: ID,
      item: {
        ...itemFor(ID),
        packageUrl: "https://attacker.example/catalogue/aurora/aurora.zip",
      },
    });

    const checked = await validateCatalogueItem(directory);

    expect(checked).toMatchObject({
      ok: false,
      reason: expect.stringContaining(
        `packageUrl must be https://raw.githubusercontent.com/peterng1618/vigilia-store/main/catalogue/${ID}/${ID}.zip`,
      ),
    });
  });

  it("refuses a directory with no thumbnail beside item.json", async () => {
    const directory = await itemDirectory({ id: ID, thumbnail: null });

    const checked = await validateCatalogueItem(directory);

    expect(checked).toMatchObject({
      ok: false,
      reason: "thumbnail.png is missing.",
    });
  });

  it("refuses a thumbnail header that names another directory", async () => {
    const directory = await itemDirectory({
      id: ID,
      item: {
        ...itemFor(ID),
        thumbnail: "catalogue/elsewhere/thumbnail.png",
      },
    });

    const checked = await validateCatalogueItem(directory);

    expect(checked).toMatchObject({
      ok: false,
      reason: `thumbnail must be catalogue/${ID}/thumbnail.png, not "catalogue/elsewhere/thumbnail.png".`,
    });
  });

  it("refuses a package whose own id is another item's", async () => {
    const directory = await itemDirectory({
      id: ID,
      packageBytes: packageBytesFor("elsewhere"),
    });

    const checked = await validateCatalogueItem(directory);

    expect(checked).toMatchObject({
      ok: false,
      reason: expect.stringContaining('holds theme "elsewhere"'),
    });
  });

  it("refuses a directory with no package beside item.json", async () => {
    const directory = await itemDirectory({
      id: ID,
      packageBytes: null,
    });

    const checked = await validateCatalogueItem(directory);

    expect(checked).toMatchObject({
      ok: false,
      reason: `${ID}.zip is missing.`,
    });
  });
});

describe("validateItemCommand", () => {
  it("is absent for every other command line", async () => {
    expect(await validateItemCommand([])).toBeUndefined();
    expect(
      await validateItemCommand(["--build-catalogue-index", "somewhere"]),
    ).toBeUndefined();
  });

  it("prints one line and exits zero for a valid directory", async () => {
    const directory = await itemDirectory({ id: ID });
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    expect(await validateItemCommand(["validate-item", directory])).toBe(0);
    expect(log.mock.calls).toEqual([[`catalogue/${ID} is valid`]]);
  });

  it("names the first refusal and exits one", async () => {
    const directory = await itemDirectory({
      id: ID,
      packageBytes: NOT_A_PACKAGE,
    });
    const errors = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    expect(await validateItemCommand(["validate-item", directory])).toBe(1);
    expect(errors.mock.calls).toEqual([
      [`Refused catalogue/${ID}: That file is not a readable theme package.`],
    ]);
  });

  it("refuses a package carrying a video past the duration cap", async () => {
    const directory = await itemDirectory({
      id: ID,
      packageBytes: packageWithLongVideo(ID),
    });
    const errors = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    expect(await validateItemCommand(["validate-item", directory])).toBe(1);
    expect(errors.mock.calls).toEqual([
      [`Refused catalogue/${ID}: ${DURATION_REFUSAL}`],
    ]);
  });

  it("refuses a command line without exactly one directory", async () => {
    const errors = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    expect(await validateItemCommand(["validate-item"])).toBe(1);
    expect(await validateItemCommand(["validate-item", "a", "b"])).toBe(1);
    expect(errors.mock.calls.flat().join("\n")).toContain(
      "validate-item needs one <catalogueDir>.",
    );
  });
});
