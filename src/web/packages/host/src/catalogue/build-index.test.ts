import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  type FabricThemeEnvelope,
  facetRecordOf,
  parseCatalogueIndex,
} from "@vigilia/renderer-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildCatalogueIndexCommand,
  type CatalogueItem,
  catalogueIndexOf,
} from "./build-index.js";

const GENERATED_AT = "2026-10-21T12:00:00Z";

/** The smallest envelope `validateFabricThemeEnvelope` accepts. */
function themeFor(id: string, name: string): FabricThemeEnvelope {
  return {
    schemaVersion: 2,
    fabricVersion: "7.4.0",
    id,
    artboard: { width: 1920, height: 1080 },
    metadata: { name, author: "Ada", themeLanguage: "en" },
    scene: { version: "7.4.0", objects: [] },
  };
}

function itemFor(id: string): unknown {
  return {
    kind: "dashboard-theme",
    name: `Theme ${id}`,
    version: "1.0.0",
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-02T00:00:00Z",
    downloads: 12,
    favorites: 3,
    packageUrl: `https://github.com/x/y/releases/download/${id}/${id}.zip`,
    thumbnail: `catalogue/${id}/thumbnail.png`,
  };
}

function item(id: string, theme: unknown = themeFor(id, `Theme ${id}`)) {
  return { id, item: itemFor(id), theme };
}

const temporary: string[] = [];

async function catalogueOf(
  entries: readonly { readonly id: string; readonly theme: unknown }[],
): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "vigilia-catalogue-"));
  temporary.push(root);
  for (const { id, theme } of entries) {
    const directory = path.join(root, id);
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, "item.json"),
      JSON.stringify(itemFor(id)),
    );
    await writeFile(path.join(directory, "theme.json"), JSON.stringify(theme));
  }
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporary.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

describe("catalogueIndexOf", () => {
  it("publishes the readable items, sorted, with the derived facets", () => {
    const valid = themeFor("aurora", "Aurora");
    const items: CatalogueItem[] = [
      item("beta"),
      item("aurora", valid),
      item("broken", { schemaVersion: 2 }),
    ];

    const index = catalogueIndexOf(items, GENERATED_AT);

    expect(index.generatedAt).toBe(GENERATED_AT);
    expect(index.entries.map((entry) => entry.id)).toEqual(["aurora", "beta"]);
    expect(index.entries[0]?.facets).toEqual(facetRecordOf(valid));
  });

  it("refuses an item whose header an entry cannot be built from", () => {
    const index = catalogueIndexOf(
      [
        item("aurora"),
        {
          id: "headerless",
          item: { kind: "dashboard-theme" },
          theme: themeFor("headerless", "Headerless"),
        },
      ],
      GENERATED_AT,
    );

    expect(index.entries.map((entry) => entry.id)).toEqual(["aurora"]);
  });
});

describe("buildCatalogueIndexCommand", () => {
  it("is absent for every other command line", async () => {
    expect(await buildCatalogueIndexCommand([])).toBeUndefined();
    expect(
      await buildCatalogueIndexCommand(["--port", "1234"]),
    ).toBeUndefined();
  });

  it("writes a deterministic index, refusing the unreadable item", async () => {
    const errors = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const catalogue = await catalogueOf([
      { id: "beta", theme: themeFor("beta", "Beta") },
      { id: "alpha", theme: themeFor("alpha", "Alpha") },
      { id: "broken", theme: { schemaVersion: 2 } },
    ]);
    const out = path.join(catalogue, "index.json");
    const argv = [
      "--build-catalogue-index",
      catalogue,
      "--out",
      out,
      "--generated-at",
      GENERATED_AT,
    ];

    expect(await buildCatalogueIndexCommand(argv)).toBe(0);

    const bytes = await readFile(out, "utf8");
    const output = JSON.parse(bytes) as unknown;
    expect(bytes.endsWith("\n")).toBe(true);
    expect(parseCatalogueIndex(output, ["dashboard-theme"]).refused).toEqual(
      [],
    );

    const parsed = parseCatalogueIndex(output, ["dashboard-theme"]);
    expect(parsed.entries.map((entry) => entry.id)).toEqual(["alpha", "beta"]);
    expect(parsed.entries[0]?.facets).toEqual(
      facetRecordOf(themeFor("alpha", "Alpha")),
    );
    expect(errors.mock.calls.flat().join("\n")).toContain("catalogue/broken");

    expect(await buildCatalogueIndexCommand(argv)).toBe(0);
    expect(await readFile(out, "utf8")).toBe(bytes);
  });

  it("fails on a catalogue directory that does not exist", async () => {
    const errors = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const status = await buildCatalogueIndexCommand([
      "--build-catalogue-index",
      path.join(os.tmpdir(), "vigilia-catalogue-does-not-exist"),
      "--out",
      path.join(os.tmpdir(), "index.json"),
      "--generated-at",
      GENERATED_AT,
    ]);

    expect(status).toBe(1);
    expect(errors.mock.calls.flat().join("\n")).toContain(
      "vigilia-catalogue-does-not-exist",
    );
  });

  it("fails on an unknown option or a missing --generated-at", async () => {
    const errors = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const catalogue = await catalogueOf([
      { id: "alpha", theme: themeFor("alpha", "Alpha") },
    ]);

    expect(
      await buildCatalogueIndexCommand([
        "--build-catalogue-index",
        catalogue,
        "--out",
        path.join(catalogue, "index.json"),
        "--generated-at",
        GENERATED_AT,
        "--unknown",
      ]),
    ).toBe(1);

    expect(
      await buildCatalogueIndexCommand([
        "--build-catalogue-index",
        catalogue,
        "--out",
        path.join(catalogue, "index.json"),
      ]),
    ).toBe(1);

    expect(errors.mock.calls.flat().join("\n")).toContain("--generated-at");
  });
});
