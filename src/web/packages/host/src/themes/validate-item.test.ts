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
    packageUrl: `https://raw.githubusercontent.com/x/y/main/catalogue/${id}/${id}.zip`,
    thumbnail: `catalogue/${id}/thumbnail.png`,
  };
}

/** ZIP magic and nothing else: a package `readThemePackage` refuses. */
const NOT_A_PACKAGE = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

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
  if (input.packageBytes !== null) {
    const written = writeThemePackage({
      envelope: themeFor(input.id),
      assets: {},
    });
    if (!written.ok) throw new Error(written.message);
    await writeFile(
      path.join(directory, `${input.id}.zip`),
      input.packageBytes ?? written.bytes,
    );
  }
  return directory;
}

describe("validateCatalogueItem", () => {
  it("accepts a directory whose header, path and package agree", async () => {
    const directory = await itemDirectory({ id: "aurora" });

    expect(await validateCatalogueItem(directory)).toEqual({
      ok: true,
      id: "aurora",
    });
  });

  it("refuses a directory with no item.json", async () => {
    const directory = await itemDirectory({ id: "aurora", item: null });

    expect(await validateCatalogueItem(directory)).toEqual({
      ok: false,
      id: "aurora",
      reason: "item.json is missing.",
    });
  });

  it("refuses a kind this build does not ship", async () => {
    const directory = await itemDirectory({
      id: "aurora",
      item: { ...itemFor("aurora"), kind: "dashboard-theme " },
    });

    const checked = await validateCatalogueItem(directory);

    expect(checked).toMatchObject({
      ok: false,
      reason: 'kind "dashboard-theme " is not a kind this build ships.',
    });
  });

  it("refuses a package that does not parse", async () => {
    const directory = await itemDirectory({
      id: "aurora",
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
      id: "aurora",
      item: {
        ...itemFor("aurora"),
        packageUrl: "https://example.test/aurora.zip",
      },
    });

    const checked = await validateCatalogueItem(directory);

    expect(checked).toMatchObject({
      ok: false,
      reason:
        'packageUrl must end with catalogue/aurora/aurora.zip, not "https://example.test/aurora.zip".',
    });
  });

  it("refuses a directory with no package beside item.json", async () => {
    const directory = await itemDirectory({
      id: "aurora",
      packageBytes: null,
    });

    const checked = await validateCatalogueItem(directory);

    expect(checked).toMatchObject({
      ok: false,
      reason: "aurora.zip is missing.",
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
    const directory = await itemDirectory({ id: "aurora" });
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    expect(await validateItemCommand(["validate-item", directory])).toBe(0);
    expect(log.mock.calls).toEqual([["catalogue/aurora is valid"]]);
  });

  it("names the first refusal and exits one", async () => {
    const directory = await itemDirectory({
      id: "aurora",
      packageBytes: NOT_A_PACKAGE,
    });
    const errors = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    expect(await validateItemCommand(["validate-item", directory])).toBe(1);
    expect(errors.mock.calls).toEqual([
      ["Refused catalogue/aurora: That file is not a readable theme package."],
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
