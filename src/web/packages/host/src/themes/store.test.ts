import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { FabricThemeEnvelope } from "@vigilia/renderer-core";
import { writeThemePackage } from "@vigilia/theme-package";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createThemeStore,
  isValidThemeId,
  type ThemeContent,
  type ThemeStore,
} from "./store.js";

function envelopeFor(id: string, name: string): FabricThemeEnvelope {
  return {
    schemaVersion: 2,
    fabricVersion: "7.4.0",
    id,
    artboard: { width: 1920, height: 1080 },
    metadata: { name, author: "Ada", locale: "en" },
    scene: { version: "7.4.0", objects: [] },
  };
}

function withAsset(
  id: string,
  name: string,
  assetPath: string,
  bytes: Uint8Array,
): ThemeContent {
  return {
    envelope: {
      ...envelopeFor(id, name),
      assets: [
        {
          id: "badge",
          kind: "image",
          path: assetPath,
        },
      ],
    },
    assets: { [assetPath]: bytes },
  };
}

/**
 * A save that dies, at the point named — the one thing a test cannot get by
 * writing folders by hand, because the state that matters is the one the store
 * itself leaves there.
 *
 * `write` stages the whole folder and swaps it in with two renames. The spy
 * performs the operation that names the crash point for real and then hands
 * back a promise that never settles, so the save stops there exactly as a
 * killed process stops: what it had already written is on disk, the rest of the
 * save never runs, and no `catch` cleans up after it. `crashed` resolves once
 * that point is really on disk, so the caller observes the crash rather than
 * assuming it, and the write is deliberately never awaited.
 */
async function crashSave(
  store: ThemeStore,
  id: string,
  content: ThemeContent,
  at: "mid-write" | "between-renames",
): Promise<void> {
  const crashed = new Promise<void>((resolve) => {
    const realRename = fs.rename;
    const realWriteFile = fs.writeFile;
    const never = (): Promise<never> => new Promise<never>(() => undefined);

    vi.spyOn(fs, "rename").mockImplementation(async (from, to) => {
      if (at !== "between-renames" || !String(to).includes(".retired-")) {
        await realRename(from, to);
        return;
      }
      // The theme is really moved aside first; only the second rename, which
      // would bring the new folder in, is what never arrives.
      await realRename(from, to);
      resolve();
      return never();
    });

    vi.spyOn(fs, "writeFile").mockImplementation(async (file, data) => {
      // `theme.json` is written once into the staging folder, so stopping on
      // it stops the save before it has written anything worth committing.
      if (
        at !== "mid-write" ||
        !String(file).includes(`${path.sep}.staging-`)
      ) {
        await realWriteFile(file, data);
        return;
      }
      resolve();
      return never();
    });
  });

  void store.write(id, content);
  await crashed;
}

/** Scratch folder names for one theme, read back off disk rather than guessed. */
async function scratchNames(library: string, id: string, kind: string) {
  return (await fs.readdir(library)).filter(
    (name) => name.startsWith(`.${kind}-`) && name.endsWith(`.${id}`),
  );
}

describe("ThemeStore", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "vigilia-theme-store-test-"),
    );
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("writes and reads a valid theme as a folder", async () => {
    const store = createThemeStore(tmpDir);

    const entry = await store.write("living-room", {
      envelope: envelopeFor("living-room", "Living Room"),
      assets: {},
    });
    expect(entry.id).toBe("living-room");
    expect(entry.name).toBe("Living Room");
    expect(entry.author).toBe("Ada");
    expect(typeof entry.updatedAt).toBe("string");

    const read = await store.read("living-room");
    expect(read?.envelope.id).toBe("living-room");
    expect(read?.envelope.metadata?.name).toBe("Living Room");
    expect(read?.assets).toEqual({});
  });

  it("round-trips a theme's assets through the folder", async () => {
    const store = createThemeStore(tmpDir);
    const content = withAsset(
      "living-room",
      "Living Room",
      "assets/badge.svg",
      new TextEncoder().encode("<svg/>"),
    );

    await store.write("living-room", content);

    // The shape on disk is the claim, so it is read from the filesystem rather
    // than inferred from what the store returned.
    expect((await fs.readdir(path.join(tmpDir, "living-room"))).sort()).toEqual(
      ["assets", "theme.json"],
    );
    expect(
      await fs.readFile(
        path.join(tmpDir, "living-room", "assets", "badge.svg"),
        "utf8",
      ),
    ).toBe("<svg/>");

    const read = await store.read("living-room");
    const stored = read?.assets["assets/badge.svg"];
    expect(stored).toBeDefined();
    expect([...(stored ?? [])]).toEqual([
      ...content.assets["assets/badge.svg"]!,
    ]);
  });

  /**
   * The regression that motivated ADR-0017: `list()` used to inflate every
   * package in the library to print one line each. It now reads only
   * `theme.json`, so an asset it cannot read costs the theme nothing in the
   * list — under the archive this theme would simply have vanished from it.
   */
  it("lists name, author and modified time without reading the assets", async () => {
    const store = createThemeStore(tmpDir);
    await store.write("theme-a", {
      envelope: envelopeFor("theme-a", "Theme Alpha"),
      assets: {},
    });
    await store.write("theme-b", {
      envelope: envelopeFor("theme-b", "Theme Beta"),
      assets: {},
    });
    await store.write(
      "theme-c",
      withAsset(
        "theme-c",
        "Theme Gamma",
        "assets/badge.svg",
        new Uint8Array([1]),
      ),
    );
    // A directory where the asset file belongs: unreadable, but the document
    // beside it is intact.
    await fs.rm(path.join(tmpDir, "theme-c", "assets", "badge.svg"));
    await fs.mkdir(path.join(tmpDir, "theme-c", "assets", "badge.svg"));

    const list = await store.list();
    expect(
      list.map((item) => ({
        id: item.id,
        name: item.name,
        author: item.author,
      })),
    ).toEqual([
      { id: "theme-a", name: "Theme Alpha", author: "Ada" },
      { id: "theme-b", name: "Theme Beta", author: "Ada" },
      { id: "theme-c", name: "Theme Gamma", author: "Ada" },
    ]);
    for (const item of list) {
      expect(typeof item.updatedAt).toBe("string");
    }

    // Reading it properly still refuses, so the list is not hiding a fault.
    expect(await store.read("theme-c")).toBeUndefined();
  });

  it("ignores an archive left in the library, as ruled: there is no migration", async () => {
    const store = createThemeStore(tmpDir);
    const written = writeThemePackage({
      envelope: envelopeFor("old-archive", "Old Archive"),
      assets: {},
    });
    if (!written.ok) throw new Error(written.message);
    await fs.writeFile(
      path.join(tmpDir, "old-archive.vigilia-theme"),
      written.bytes,
    );

    expect(await store.list()).toEqual([]);
    expect(await store.read("old-archive")).toBeUndefined();
  });

  it("leaves the previous theme intact when a save is refused", async () => {
    const store = createThemeStore(tmpDir);
    await store.write("living-room", {
      envelope: envelopeFor("living-room", "First Name"),
      assets: {},
    });
    const first = await fs.readFile(
      path.join(tmpDir, "living-room", "theme.json"),
      "utf8",
    );

    // An asset the document does not declare is refused before the folder is
    // staged, so the stored theme is never touched.
    await expect(
      store.write("living-room", {
        envelope: envelopeFor("living-room", "Second Name"),
        assets: { "assets/ghost.svg": new Uint8Array([1]) },
      }),
    ).rejects.toThrow("Assets must exactly match the theme declaration.");

    expect(await store.read("living-room")).toMatchObject({
      name: "First Name",
    });
    expect(
      await fs.readFile(path.join(tmpDir, "living-room", "theme.json"), "utf8"),
    ).toBe(first);
    // Nothing half-written is left where a listing would see it.
    expect(await fs.readdir(tmpDir)).toEqual(["living-room"]);
  });

  it("lists themes with metadata only", async () => {
    const store = createThemeStore(tmpDir);
    await store.write("theme-a", {
      envelope: envelopeFor("theme-a", "Theme Alpha"),
      assets: {},
    });

    const list = await store.list();
    expect(list).toHaveLength(1);
    expect(
      (list[0] as unknown as { envelope?: unknown }).envelope,
    ).toBeUndefined();
  });

  it("refuses invalid or path traversal theme IDs", async () => {
    const store = createThemeStore(tmpDir);
    const content: ThemeContent = {
      envelope: envelopeFor("living-room", "Living Room"),
      assets: {},
    };

    for (const id of ["../escape", "/etc/passwd", "", "bad id with spaces"]) {
      await expect(store.write(id, content)).rejects.toThrow(
        "Invalid theme id",
      );
    }

    expect(await store.read("../escape")).toBeUndefined();
  });

  it("refuses a document that is not a theme and keeps the stored one", async () => {
    const store = createThemeStore(tmpDir);
    await store.write("living-room", {
      envelope: envelopeFor("living-room", "Initial Name"),
      assets: {},
    });

    await expect(
      store.write("living-room", {
        envelope: { nonsense: true } as unknown as FabricThemeEnvelope,
        assets: {},
      }),
    ).rejects.toThrow();
    await expect(
      store.write("other-room", {
        envelope: envelopeFor("living-room", "Mismatched"),
        assets: {},
      }),
    ).rejects.toThrow('does not match target id "other-room"');

    expect(await store.read("living-room")).toMatchObject({
      name: "Initial Name",
    });
  });

  it("returns undefined when theme is not found", async () => {
    const store = createThemeStore(tmpDir);
    expect(await store.read("non-existent")).toBeUndefined();
  });
});

/**
 * A crash cannot be made impossible here — renaming onto an existing directory
 * is not portable — so it has to be undone. These kill a real save with
 * `crashSave`, at both points a kill can reach, and then start again.
 */
describe("ThemeStore crash recovery", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "vigilia-theme-recovery-test-"),
    );
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const save = (id: string, name: string): ThemeContent => ({
    envelope: envelopeFor(id, name),
    assets: {},
  });

  it("puts back a theme a kill between the two renames left behind", async () => {
    const store = createThemeStore(tmpDir);
    await store.write("living-room", save("living-room", "First Name"));
    await crashSave(
      store,
      "living-room",
      save("living-room", "Second Name"),
      "between-renames",
    );

    // What the kill left: the previous theme under a name no listing can see,
    // the new folder still waiting, and nothing at the theme's own name. The
    // old one is what it was and not what it was becoming, because the save
    // that would have moved it in never reached its second rename.
    expect((await fs.readdir(tmpDir)).sort()).toEqual(
      [
        ...(await scratchNames(tmpDir, "living-room", "retired")),
        ...(await scratchNames(tmpDir, "living-room", "staging")),
      ].sort(),
    );
    expect(await fs.readdir(tmpDir)).not.toContain("living-room");
    expect(await scratchNames(tmpDir, "living-room", "retired")).toHaveLength(
      1,
    );

    // The next start is a new store over the same library, which is all a
    // restart is.
    const next = createThemeStore(tmpDir);
    expect(await next.list()).toMatchObject([
      { id: "living-room", name: "First Name" },
    ]);
    expect(await next.read("living-room")).toMatchObject({
      name: "First Name",
    });
    // The staging folder was a write that never happened; the retired one is
    // the last good copy, now living under its own name again.
    expect(await fs.readdir(tmpDir)).toEqual(["living-room"]);
  });

  it("reaps the staging folder a kill mid-write left behind", async () => {
    const store = createThemeStore(tmpDir);
    await store.write("living-room", save("living-room", "First Name"));
    await crashSave(
      store,
      "living-room",
      save("living-room", "Never Finished"),
      "mid-write",
    );

    // The theme was never touched, and the draft beside it is a folder with
    // nothing in it.
    expect(await scratchNames(tmpDir, "living-room", "staging")).toHaveLength(
      1,
    );
    expect(await scratchNames(tmpDir, "living-room", "retired")).toHaveLength(
      0,
    );

    const next = createThemeStore(tmpDir);
    expect(await next.list()).toMatchObject([
      { id: "living-room", name: "First Name" },
    ]);
    expect(await fs.readdir(tmpDir)).toEqual(["living-room"]);
  });

  it("leaves a retired copy alone when a live theme already holds the name", async () => {
    const crashed = createThemeStore(tmpDir);
    await crashed.write("living-room", save("living-room", "First Name"));
    await crashSave(
      crashed,
      "living-room",
      save("living-room", "Second Name"),
      "between-renames",
    );

    // The author saves again, which succeeds because the name is free — and
    // leaves the older copy retired beside a newer live theme.
    const store = createThemeStore(tmpDir);
    await store.write("living-room", save("living-room", "Third Name"));
    expect(await store.list()).toMatchObject([
      { id: "living-room", name: "Third Name" },
    ]);

    // Restoring the retired copy would trade a crash for silent data loss, so
    // it stays where it is, holding the version it always held.
    const retired = await scratchNames(tmpDir, "living-room", "retired");
    expect(retired).toHaveLength(1);
    expect(
      await fs.readFile(
        path.join(tmpDir, retired[0] as string, "theme.json"),
        "utf8",
      ),
    ).toContain("First Name");
    expect(await fs.readdir(tmpDir)).toContain("living-room");
  });

  it("recovers the same way on every later start", async () => {
    const store = createThemeStore(tmpDir);
    await store.write("living-room", save("living-room", "First Name"));
    await crashSave(
      store,
      "living-room",
      save("living-room", "Second Name"),
      "between-renames",
    );

    const first = await createThemeStore(tmpDir).list();
    const second = await createThemeStore(tmpDir).list();
    expect(second).toEqual(first);
    expect(await fs.readdir(tmpDir)).toEqual(["living-room"]);

    // And it does not loop: what it restored is already a theme, so there is
    // nothing left for a third start to do.
    expect(await createThemeStore(tmpDir).list()).toEqual(first);
    expect(await fs.readdir(tmpDir)).toEqual(["living-room"]);
  });

  it("leaves a scratch folder it cannot read a theme id out of alone", async () => {
    await fs.mkdir(path.join(tmpDir, ".staging-1700000000"));
    await fs.mkdir(path.join(tmpDir, ".retired-1700000000.not a theme id"));
    await fs.mkdir(path.join(tmpDir, ".notes"));

    const store = createThemeStore(tmpDir);
    expect(await store.list()).toEqual([]);
    // Nothing here names a theme, so there is nothing to put back and nothing
    // that may be deleted on a guess.
    expect((await fs.readdir(tmpDir)).sort()).toEqual([
      ".notes",
      ".retired-1700000000.not a theme id",
      ".staging-1700000000",
    ]);
  });

  it("leaves no scratch folder behind after a save that finished", async () => {
    const store = createThemeStore(tmpDir);
    await store.write("living-room", save("living-room", "First Name"));
    // A second save is the one that stages a folder, retires the old theme and
    // cleans both up — the path a crash would interrupt.
    await store.write("living-room", save("living-room", "Second Name"));
    await store.write("theme-a", save("theme-a", "Theme Alpha"));

    expect((await store.list()).map((entry) => entry.id)).toEqual([
      "living-room",
      "theme-a",
    ]);
    expect((await fs.readdir(tmpDir)).sort()).toEqual([
      "living-room",
      "theme-a",
    ]);
  });
});

describe("isValidThemeId", () => {
  it("accepts alphanumeric, hyphens, and underscores up to 64 chars", () => {
    expect(isValidThemeId("living-room")).toBe(true);
    expect(isValidThemeId("living_room_123")).toBe(true);
    expect(isValidThemeId("a")).toBe(true);
  });

  it("rejects traversal, slashes, spaces, and empty strings", () => {
    expect(isValidThemeId("")).toBe(false);
    expect(isValidThemeId("../escape")).toBe(false);
    expect(isValidThemeId("a/b")).toBe(false);
    expect(isValidThemeId("a b")).toBe(false);
    expect(isValidThemeId("a".repeat(65))).toBe(false);
  });
});
