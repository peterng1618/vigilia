import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createActiveThemeStore } from "./active-theme.js";

const exists = async (id: string) => id === "living-room";

describe("the active theme", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "vigilia-active-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("chooses nothing before a consumer has chosen", async () => {
    expect(await createActiveThemeStore(dir).read(exists)).toBeUndefined();
  });

  it("remembers a choice", async () => {
    const store = createActiveThemeStore(dir);
    await store.write("living-room");

    expect(await store.read(exists)).toBe("living-room");
  });

  it("ignores a choice whose theme is gone", async () => {
    const store = createActiveThemeStore(dir);
    await store.write("living-room");
    await writeFile(path.join(dir, "active-theme.json"), '{"id":"deleted"}');

    // A stale id must not keep winning, and must not throw.
    expect(await store.read(exists)).toBeUndefined();
  });

  it("refuses to store an id that is not a theme id", async () => {
    const store = createActiveThemeStore(dir);

    await expect(store.write("../../etc/passwd")).rejects.toThrow("Invalid");
  });

  it("treats a corrupt file as nothing chosen", async () => {
    await writeFile(path.join(dir, "active-theme.json"), "{ not json", "utf8");

    expect(await createActiveThemeStore(dir).read(exists)).toBeUndefined();
  });

  it("clears a choice", async () => {
    const store = createActiveThemeStore(dir);
    await store.write("living-room");
    await store.clear();

    expect(await store.read(exists)).toBeUndefined();
  });
});
