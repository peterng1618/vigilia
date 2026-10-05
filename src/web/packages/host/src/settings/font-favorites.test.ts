import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createFontFavoritesStore,
  normalizeFontFavorites,
} from "./font-favorites.js";

describe("font favourites", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "vigilia-favorites-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("keeps ids in the order the author added them", () => {
    // A star list is read as "the ones I reach for", so reordering it is a
    // silent change to the author's own ranking.
    expect(normalizeFontFavorites({ favorites: ["b", "a"] })).toEqual([
      "b",
      "a",
    ]);
    expect(normalizeFontFavorites(["a", "b"])).toEqual(["a", "b"]);
  });

  it("refuses anything that is not a list of ids", () => {
    expect(normalizeFontFavorites(undefined)).toEqual([]);
    expect(normalizeFontFavorites("a")).toEqual([]);
    expect(normalizeFontFavorites(null)).toEqual([]);
    expect(normalizeFontFavorites({ favorites: [1, null] })).toEqual([]);
    // An object whose `favorites` is not a list is not a star list either.
    expect(normalizeFontFavorites({ favorites: "a" })).toEqual([]);
  });

  it("drops a duplicate rather than storing it twice", () => {
    expect(normalizeFontFavorites({ favorites: ["a", "a", "b"] })).toEqual([
      "a",
      "b",
    ]);
  });

  it("keeps every id shape the generated catalogue emits", () => {
    // Measured against `font-trios.generated.ts`: trio ids are lowercase kebab,
    // three of 379 carry a digit and the longest runs to 33 characters. An id
    // shape that refuses any of these drops a real favourite silently, because
    // the star is clicked, the write succeeds, and nothing comes back.
    expect(
      normalizeFontFavorites({
        favorites: [
          "yaldevi-libre-franklin",
          "exo-2-alegreya-sans",
          "open-sans-source-sans-3",
          "libre-baskerville-instrument-sans",
          "saas",
        ],
      }),
    ).toEqual([
      "yaldevi-libre-franklin",
      "exo-2-alegreya-sans",
      "open-sans-source-sans-3",
      "libre-baskerville-instrument-sans",
      "saas",
    ]);

    // What the id shape is for: nothing that could escape the settings folder
    // or grow without bound.
    expect(normalizeFontFavorites({ favorites: ["../../secrets"] })).toEqual(
      [],
    );
    expect(normalizeFontFavorites({ favorites: ["a".repeat(65)] })).toEqual([]);
  });

  it("reads empty when no file exists yet", async () => {
    expect(await createFontFavoritesStore(dir).read()).toEqual([]);
  });

  it("reads empty from a file it cannot parse, never failing a load", async () => {
    await writeFile(
      path.join(dir, "font-favorites.json"),
      "{ not json",
      "utf8",
    );
    expect(await createFontFavoritesStore(dir).read()).toEqual([]);
  });

  it("writes what it read back", async () => {
    const store = createFontFavoritesStore(dir);

    await store.write({ favorites: ["dashboard", "terminal"] });
    expect(await store.read()).toEqual(["dashboard", "terminal"]);
    expect(
      JSON.parse(await readFile(path.join(dir, "font-favorites.json"), "utf8")),
    ).toEqual({ favorites: ["dashboard", "terminal"] });
  });

  it("answers a write with what it stored, not what it was sent", async () => {
    // The editor repaints from this answer, so it must not echo back an entry
    // the store refused.
    expect(
      await createFontFavoritesStore(dir).write({
        favorites: ["a", "a", 1, "b"],
      }),
    ).toEqual(["a", "b"]);
  });

  it("writes into a settings folder that does not exist yet", async () => {
    // The first run of a new machine has no settings directory at all.
    const store = createFontFavoritesStore(
      path.join(dir, "nested", "settings"),
    );

    await store.write({ favorites: ["a"] });
    expect(await store.read()).toEqual(["a"]);
  });
});
