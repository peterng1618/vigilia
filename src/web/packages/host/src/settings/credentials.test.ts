import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCredentialStore, hintOf } from "./credentials.js";

/** The file as a hand-edited one would be, for the reader to read. */
const credentialsFile = (dir: string) => path.join(dir, "credentials.json");

const savedAt = new Date("2026-10-21T09:00:00.000Z");
const stored = { value: "sk-live-9f2c", savedAt: "2026-10-21T09:00:00.000Z" };

describe("credentials", () => {
  let dir: string;
  let store: ReturnType<typeof createCredentialStore>;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "yunari-credentials-"));
    store = createCredentialStore(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function seed(contents: string): Promise<void> {
    await writeFile(credentialsFile(dir), contents, "utf8");
  }

  it("reads an absent file as no credentials", async () => {
    expect(await store.read()).toEqual({});
  });

  it("writes one credential and reads it back with its ISO instant", async () => {
    await store.write("fontawesome", "sk-live-9f2c", savedAt);

    expect(await store.read()).toEqual({ fontawesome: stored });
    expect(await store.valueOf("fontawesome")).toBe("sk-live-9f2c");
  });

  it("answers undefined for a credential it has not stored", async () => {
    expect(await store.valueOf("fontawesome")).toBeUndefined();
  });

  it("clears one credential and leaves the others", async () => {
    await store.write("one", "value-one", savedAt);
    await store.write("two", "value-two", savedAt);

    await store.clear("one");

    expect(await store.read()).toEqual({
      two: { value: "value-two", savedAt: "2026-10-21T09:00:00.000Z" },
    });
  });

  it("serializes overlapping writes so neither credential is lost", async () => {
    await Promise.all([
      store.write("left", "value-left", savedAt),
      store.write("right", "value-right", savedAt),
    ]);

    expect(Object.keys(await store.read()).sort()).toEqual(["left", "right"]);
  });

  it("drops bad entries and keeps a __proto__ key as an entry", async () => {
    await seed(
      JSON.stringify(
        Object.fromEntries([
          ["good", stored],
          ["__proto__", stored],
          ["numbered", { value: 7, savedAt: "2026-10-21T09:00:00.000Z" }],
          ["empty", { value: "", savedAt: "2026-10-21T09:00:00.000Z" }],
          ["undated", { value: "value", savedAt: "not a date" }],
          ["nulled", null],
        ]),
      ),
    );

    const read = await store.read();

    expect(read.good).toEqual(stored);
    expect(Object.hasOwn(read, "__proto__")).toBe(true);
    expect(read["__proto__"]).toEqual(stored);
    expect(Object.getPrototypeOf(read)).toBe(Object.prototype);
    expect(Object.keys(read).sort()).toEqual(["__proto__", "good"]);
  });

  it("treats a non-object file as no credentials", async () => {
    await seed("[]");

    expect(await store.read()).toEqual({});
  });

  it("refuses an id that is not a credential id, on write", async () => {
    await expect(store.write("../escape", "value", savedAt)).rejects.toThrow(
      "Invalid",
    );

    // A refused write is no write at all, so there is nothing on disk to read
    // back — the assertion that can go red, where `read()` answering `{}` on a
    // directory that was never written to cannot.
    await expect(readFile(credentialsFile(dir), "utf8")).rejects.toThrow();
  });
});

describe("hintOf", () => {
  it("answers the last four characters", () => {
    expect(hintOf("sk-live-9f2c")).toBe("9f2c");
  });

  it("answers a shorter value whole rather than padded", () => {
    expect(hintOf("ab")).toBe("ab");
    expect(hintOf("")).toBe("");
  });
});
