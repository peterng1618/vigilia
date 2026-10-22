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

/** A package written from one exact envelope, so a case can choose the
 *  version, the change that separates it from the base, and the credit. */
function packageBytesOf(envelope: FabricThemeEnvelope): Uint8Array {
  const written = writeThemePackage({ envelope, assets: {} });
  if (!written.ok) throw new Error(written.message);
  return written.bytes;
}

/** The smallest envelope, with the fields the ladder diffs overridden. */
function envelopeWith(
  id: string,
  options: {
    readonly version?: string;
    readonly name?: string;
    readonly width?: number;
    readonly tags?: readonly string[];
    readonly remixOf?: {
      readonly catalogueId: string;
      readonly name: string;
      readonly version: string;
    };
  } = {},
): FabricThemeEnvelope {
  const theme = themeFor(id);
  return {
    ...theme,
    artboard: {
      ...theme.artboard,
      ...(options.width === undefined ? {} : { width: options.width }),
    },
    metadata: {
      ...theme.metadata,
      ...(options.version === undefined ? {} : { version: options.version }),
      ...(options.name === undefined ? {} : { name: options.name }),
      ...(options.tags === undefined ? {} : { tags: options.tags }),
      ...(options.remixOf === undefined ? {} : { remixOf: options.remixOf }),
    },
  };
}

/** The two files the workflow `git show`s out of the base commit. */
function previousFiles(directory: string): {
  readonly previousItem: string;
  readonly previousPackage: string;
} {
  return {
    previousItem: path.join(directory, "item.json"),
    previousPackage: path.join(directory, `${ID}.zip`),
  };
}

/** A package carrying the theme `id` with a remix credit of its own. */
function packageBytesWithRemix(
  id: string,
  remix: {
    readonly catalogueId: string;
    readonly name: string;
    readonly version: string;
  },
): Uint8Array {
  const theme = themeFor(id);
  const written = writeThemePackage({
    envelope: {
      ...theme,
      metadata: { ...theme.metadata, remixOf: remix },
    },
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

  it("refuses a remixOf catalogueId that is not a UUID", async () => {
    // The header's own parser owns the credit's shape, and this is the same
    // refusal the host's install boundary answers with.
    const directory = await itemDirectory({
      id: ID,
      item: {
        ...itemFor(ID),
        remixOf: { catalogueId: "aurora", name: "Aurora", version: "1.0.0" },
      },
    });

    expect(await validateCatalogueItem(directory)).toEqual({
      ok: false,
      id: ID,
      reason:
        'item.json\'s "remixOf" must be { catalogueId, name, version } with a UUID id and a version.',
    });
  });

  it("refuses a remixOf that names the item's own id", async () => {
    const self = { catalogueId: ID, name: `Theme ${ID}`, version: "1.0.0" };
    const directory = await itemDirectory({
      id: ID,
      item: { ...itemFor(ID), remixOf: self },
      packageBytes: packageBytesWithRemix(ID, self),
    });

    expect(await validateCatalogueItem(directory)).toEqual({
      ok: false,
      id: ID,
      reason: `remixOf.catalogueId names this item's own id "${ID}"; a theme cannot be remixed from itself.`,
    });
  });

  it("refuses a remixOf the package's metadata does not carry", async () => {
    const parent = "0a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d";
    const directory = await itemDirectory({
      id: ID,
      item: {
        ...itemFor(ID),
        remixOf: {
          catalogueId: parent,
          name: "System dashboard",
          version: "1.2.0",
        },
      },
      packageBytes: packageBytesWithRemix(ID, {
        catalogueId: parent,
        name: "System dashboard",
        version: "1.3.0",
      }),
    });

    expect(await validateCatalogueItem(directory)).toEqual({
      ok: false,
      id: ID,
      reason:
        "item.json's remixOf and the package's metadata.remixOf must name the same parent and version.",
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

describe("validateCatalogueItem — the version the ladder computes", () => {
  it("accepts a first submission at 1.0.0", async () => {
    const directory = await itemDirectory({ id: ID });

    expect(await validateCatalogueItem(directory)).toEqual({
      ok: true,
      id: ID,
    });
  });

  it("refuses a first submission at another version", async () => {
    const directory = await itemDirectory({
      id: ID,
      item: { ...itemFor(ID), version: "1.4.0" },
      packageBytes: packageBytesOf(envelopeWith(ID, { version: "1.4.0" })),
    });

    expect(await validateCatalogueItem(directory)).toEqual({
      ok: false,
      id: ID,
      reason: 'a first submission must be version 1.0.0, not "1.4.0".',
    });
  });

  it("accepts a patch bump against the published item", async () => {
    const before = await itemDirectory({
      id: ID,
      item: { ...itemFor(ID), version: "1.4.0" },
      packageBytes: packageBytesOf(envelopeWith(ID, { version: "1.4.0" })),
    });
    const directory = await itemDirectory({
      id: ID,
      item: { ...itemFor(ID), version: "1.4.1" },
      packageBytes: packageBytesOf(
        envelopeWith(ID, { version: "1.4.1", name: "Renamed" }),
      ),
    });

    expect(
      await validateCatalogueItem(directory, previousFiles(before)),
    ).toEqual({ ok: true, id: ID });
  });

  it("refuses a major change declared at a lower level, naming both", async () => {
    const before = await itemDirectory({
      id: ID,
      item: { ...itemFor(ID), version: "1.4.0" },
      packageBytes: packageBytesOf(envelopeWith(ID, { version: "1.4.0" })),
    });
    const directory = await itemDirectory({
      id: ID,
      item: { ...itemFor(ID), version: "1.4.1" },
      packageBytes: packageBytesOf(
        envelopeWith(ID, { version: "1.4.1", width: 2560 }),
      ),
    });

    expect(
      await validateCatalogueItem(directory, previousFiles(before)),
    ).toEqual({
      ok: false,
      id: ID,
      reason:
        "the package changes major but item.json says 1.4.1; the ladder computes 2.0.0.",
    });
  });

  it("refuses an unchanged repackage", async () => {
    const bytes = packageBytesOf(envelopeWith(ID, { version: "1.4.0" }));
    const before = await itemDirectory({
      id: ID,
      item: { ...itemFor(ID), version: "1.4.0" },
      packageBytes: bytes,
    });
    const directory = await itemDirectory({
      id: ID,
      item: { ...itemFor(ID), version: "1.4.0" },
      packageBytes: bytes,
    });

    expect(
      await validateCatalogueItem(directory, previousFiles(before)),
    ).toEqual({
      ok: false,
      id: ID,
      reason:
        "Version 1.4.0 is published and this package has not changed since it.",
    });
  });

  it("refuses a package version the header disagrees with", async () => {
    const before = await itemDirectory({
      id: ID,
      item: { ...itemFor(ID), version: "1.4.0" },
      packageBytes: packageBytesOf(envelopeWith(ID, { version: "1.4.0" })),
    });
    const directory = await itemDirectory({
      id: ID,
      item: { ...itemFor(ID), version: "1.4.1" },
      packageBytes: packageBytesOf(
        envelopeWith(ID, { version: "1.4.2", name: "Renamed" }),
      ),
    });

    expect(
      await validateCatalogueItem(directory, previousFiles(before)),
    ).toEqual({
      ok: false,
      id: ID,
      reason: 'item.json says 1.4.1 but the package records version "1.4.2".',
    });
  });

  it("refuses a package that records no metadata.version", async () => {
    const before = await itemDirectory({
      id: ID,
      item: { ...itemFor(ID), version: "1.4.0" },
      packageBytes: packageBytesOf(envelopeWith(ID, { version: "1.4.0" })),
    });
    const directory = await itemDirectory({
      id: ID,
      item: { ...itemFor(ID), version: "1.4.1" },
      packageBytes: packageBytesOf(envelopeWith(ID, { name: "Renamed" })),
    });

    expect(
      await validateCatalogueItem(directory, previousFiles(before)),
    ).toEqual({
      ok: false,
      id: ID,
      reason: "the package records no metadata.version; item.json says 1.4.1.",
    });
  });

  it("refuses a remixOf that changed from the previous item", async () => {
    const parent = "0a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d";
    const otherParent = "1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e";
    const before = await itemDirectory({
      id: ID,
      item: {
        ...itemFor(ID),
        version: "1.4.0",
        remixOf: { catalogueId: parent, name: "Parent", version: "1.0.0" },
      },
      packageBytes: packageBytesOf(
        envelopeWith(ID, {
          version: "1.4.0",
          remixOf: { catalogueId: parent, name: "Parent", version: "1.0.0" },
        }),
      ),
    });
    const directory = await itemDirectory({
      id: ID,
      item: {
        ...itemFor(ID),
        version: "1.4.1",
        remixOf: {
          catalogueId: otherParent,
          name: "Other parent",
          version: "2.0.0",
        },
      },
      packageBytes: packageBytesOf(
        envelopeWith(ID, {
          version: "1.4.1",
          remixOf: {
            catalogueId: otherParent,
            name: "Other parent",
            version: "2.0.0",
          },
        }),
      ),
    });

    expect(
      await validateCatalogueItem(directory, previousFiles(before)),
    ).toEqual({
      ok: false,
      id: ID,
      reason:
        "remixOf must not change from the previous item; provenance is recorded once and never rewritten.",
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

  it("passes both previous files through and exits zero", async () => {
    const before = await itemDirectory({
      id: ID,
      item: { ...itemFor(ID), version: "1.4.0" },
      packageBytes: packageBytesOf(envelopeWith(ID, { version: "1.4.0" })),
    });
    const directory = await itemDirectory({
      id: ID,
      item: { ...itemFor(ID), version: "1.4.1" },
      packageBytes: packageBytesOf(
        envelopeWith(ID, { version: "1.4.1", name: "Renamed" }),
      ),
    });
    const files = previousFiles(before);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    expect(
      await validateItemCommand([
        "validate-item",
        directory,
        "--previous-item",
        files.previousItem,
        "--previous-package",
        files.previousPackage,
      ]),
    ).toBe(0);
    expect(log.mock.calls).toEqual([[`catalogue/${ID} is valid`]]);
  });

  it("refuses one previous flag without the other", async () => {
    const directory = await itemDirectory({ id: ID });
    const errors = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    expect(
      await validateItemCommand([
        "validate-item",
        directory,
        "--previous-item",
        "item.json",
      ]),
    ).toBe(1);
    expect(
      await validateItemCommand([
        "validate-item",
        directory,
        "--previous-package",
        "package.zip",
      ]),
    ).toBe(1);
    expect(errors.mock.calls.flat().join("\n")).toContain(
      "validate-item <catalogueDir> [--previous-item <file> --previous-package <file>]",
    );
  });

  it("refuses an unknown argument or a flag with no value", async () => {
    const directory = await itemDirectory({ id: ID });
    const errors = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    expect(
      await validateItemCommand(["validate-item", directory, "--other", "x"]),
    ).toBe(1);
    expect(
      await validateItemCommand([
        "validate-item",
        directory,
        "--previous-item",
        "item.json",
        "--previous-package",
      ]),
    ).toBe(1);
    expect(errors.mock.calls.flat().join("\n")).toContain(
      "validate-item <catalogueDir> [--previous-item <file> --previous-package <file>]",
    );
  });
});
