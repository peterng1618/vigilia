import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createThumbnailStore } from "./thumbnails.js";

/** A one-pixel PNG: the signature is what the store validates. */
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02,
]);

describe("thumbnails", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "vigilia-thumbs-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("has nothing for a theme that was never captured", async () => {
    expect(await createThumbnailStore(dir).read("living-room")).toBeUndefined();
  });

  it("round-trips a picture", async () => {
    const store = createThumbnailStore(dir);
    await store.write("living-room", PNG);

    expect(await store.read("living-room")).toEqual(PNG);
  });

  it("refuses bytes that are not a PNG", async () => {
    const store = createThumbnailStore(dir);

    await expect(
      store.write("living-room", new TextEncoder().encode("not an image")),
    ).rejects.toThrow("PNG");
  });

  it("refuses an oversized picture", async () => {
    const store = createThumbnailStore(dir);
    const huge = new Uint8Array(3 * 1024 * 1024);
    huge.set(PNG);

    await expect(store.write("living-room", huge)).rejects.toThrow("too large");
  });

  it("ignores a file someone else wrote in its place", async () => {
    const store = createThumbnailStore(dir);
    await store.write("living-room", PNG);

    // A corrupt file must read as absent rather than reaching a browser.
    await writeFile(
      path.join(dir, "thumbnails", "living-room.png"),
      "junk",
      "utf8",
    );

    expect(await store.read("living-room")).toBeUndefined();
  });

  it("removes a picture with its theme", async () => {
    const store = createThumbnailStore(dir);
    await store.write("living-room", PNG);
    await store.remove("living-room");

    expect(await store.read("living-room")).toBeUndefined();
  });
});
