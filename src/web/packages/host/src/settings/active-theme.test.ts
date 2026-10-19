import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createActiveThemeStore } from "./active-theme.js";
import { DEFAULT_DISPLAY } from "./displays.js";

/** Every theme exists, so a case about the store is not a case about its caller. */
const yes = async () => true;

const settingsFile = (dir: string) => path.join(dir, "active-theme.json");

describe("the active theme", () => {
  let dir: string;
  let store: ReturnType<typeof createActiveThemeStore>;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "vigilia-active-"));
    store = createActiveThemeStore(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("chooses nothing before a consumer has chosen", async () => {
    expect(await store.read(DEFAULT_DISPLAY, yes)).toBeUndefined();
  });

  it("remembers a choice", async () => {
    await store.write(DEFAULT_DISPLAY, "living-room");

    expect(await store.read(DEFAULT_DISPLAY, yes)).toBe("living-room");
  });

  it("reads back what one display was given, and nothing for another", async () => {
    await store.write("this-pc", "attic-wall");

    expect(await store.read("this-pc", yes)).toBe("attic-wall");
    expect(await store.read("kitchen-tablet", yes)).toBeUndefined();
  });

  it("keeps one display's choice when another is written", async () => {
    await store.write("this-pc", "attic-wall");
    await store.write("kitchen-tablet", "living-room");

    expect(await store.read("this-pc", yes)).toBe("attic-wall");
    expect(await store.read("kitchen-tablet", yes)).toBe("living-room");
  });

  it("treats a theme that is gone as no choice", async () => {
    await store.write("this-pc", "deleted-theme");

    expect(await store.read("this-pc", async () => false)).toBeUndefined();
  });

  it("reads the old single-theme file as the default", async () => {
    await writeFile(settingsFile(dir), '{"id":"living-room"}', "utf8");

    expect(await store.read(DEFAULT_DISPLAY, yes)).toBe("living-room");
  });

  it("writes the map once it writes, so the old key is not written again", async () => {
    await writeFile(settingsFile(dir), '{"id":"living-room"}', "utf8");
    await store.write("this-pc", "attic-wall");

    // The default's own choice survives the migration and is spelled the way
    // the map spells it.
    expect(JSON.parse(await readFile(settingsFile(dir), "utf8"))).toEqual({
      [DEFAULT_DISPLAY]: "living-room",
      "this-pc": "attic-wall",
    });
  });

  it("refuses an id that is not a theme id, on write", async () => {
    await expect(store.write("this-pc", "../etc")).rejects.toThrow();
  });

  it("treats a corrupt file as nothing chosen", async () => {
    await writeFile(settingsFile(dir), "{ not json", "utf8");

    expect(await store.read(DEFAULT_DISPLAY, yes)).toBeUndefined();
  });

  it("refuses to write over a file it could not read", async () => {
    await writeFile(settingsFile(dir), "{ not json", "utf8");

    // Every mutator rewrites the whole map, so a write that started from a file
    // it could not read would take the other displays' choices with it.
    await expect(store.write("this-pc", "attic-wall")).rejects.toThrow(
      "could not be read",
    );
    expect(await readFile(settingsFile(dir), "utf8")).toBe("{ not json");
  });

  it("clears one display without touching another", async () => {
    await store.write("this-pc", "attic-wall");
    await store.write("kitchen-tablet", "living-room");

    await store.clear("this-pc");

    expect(await store.read("this-pc", yes)).toBeUndefined();
    expect(await store.read("kitchen-tablet", yes)).toBe("living-room");
  });
});
