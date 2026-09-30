import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { FabricThemeEnvelope } from "@vigilia/renderer-core";
import { writeThemePackage } from "@vigilia/theme-package";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createThemeStore,
  isValidThemeId,
  type ThemeContent,
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

  /**
   * The property a folder has to earn over a file: a save that dies before its
   * rename must cost the draft, not the theme. The staging folder is left here
   * directly rather than by injecting a failure, because that is exactly what a
   * process killed mid-save leaves behind — and it is the state the rename
   * exists to make survivable.
   */
  it("keeps the stored theme when an interrupted save left a staging folder", async () => {
    const store = createThemeStore(tmpDir);
    await store.write("living-room", {
      envelope: envelopeFor("living-room", "First Name"),
      assets: {},
    });

    const leftover = path.join(tmpDir, ".staging-1700000000.abc123");
    await fs.mkdir(path.join(leftover, "assets"), { recursive: true });
    await fs.writeFile(
      path.join(leftover, "theme.json"),
      JSON.stringify(envelopeFor("living-room", "Never Finished")),
    );

    // The half-written folder is not a theme, and it did not displace the one
    // that was already there.
    expect((await store.list()).map((entry) => entry.id)).toEqual([
      "living-room",
    ]);
    expect(await store.read("living-room")).toMatchObject({
      name: "First Name",
    });
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
