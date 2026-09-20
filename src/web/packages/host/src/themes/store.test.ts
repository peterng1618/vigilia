import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FabricThemeEnvelope } from "@vigilia/renderer-core";
import { writeThemePackage } from "@vigilia/theme-package";
import { createThemeStore, isValidThemeId } from "./store.js";

function createValidEmptyPackage(
  id = "living-room",
  name = "Living Room",
): Uint8Array {
  const envelope: FabricThemeEnvelope = {
    schemaVersion: 2,
    fabricVersion: "7.4.0",
    id,
    artboard: { width: 1920, height: 1080 },
    metadata: { name },
    scene: { version: "7.4.0", objects: [] },
  };
  const result = writeThemePackage({ envelope, assets: {} });
  if (!result.ok) throw new Error(result.message);
  return result.bytes;
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

  it("writes and reads a valid theme package", async () => {
    const store = createThemeStore(tmpDir);
    const validBytes = createValidEmptyPackage("living-room", "Living Room");

    const entry = await store.write("living-room", validBytes);
    expect(entry.id).toBe("living-room");
    expect(entry.name).toBe("Living Room");
    expect(typeof entry.updatedAt).toBe("string");

    const read = await store.read("living-room");
    expect(read).toBeDefined();
    expect(read?.envelope.id).toBe("living-room");
    expect(read?.envelope.metadata?.name).toBe("Living Room");
    expect(read?.bytes).toEqual(validBytes);
    expect(read?.assets).toEqual({});
  });

  it("lists themes with metadata only", async () => {
    const store = createThemeStore(tmpDir);
    await store.write(
      "theme-a",
      createValidEmptyPackage("theme-a", "Theme Alpha"),
    );
    await store.write(
      "theme-b",
      createValidEmptyPackage("theme-b", "Theme Beta"),
    );

    const list = await store.list();
    expect(list).toHaveLength(2);
    expect(list.map((item) => ({ id: item.id, name: item.name }))).toEqual([
      { id: "theme-a", name: "Theme Alpha" },
      { id: "theme-b", name: "Theme Beta" },
    ]);
    expect(
      (list[0] as unknown as { envelope?: unknown }).envelope,
    ).toBeUndefined();
  });

  it("refuses invalid or path traversal theme IDs", async () => {
    const store = createThemeStore(tmpDir);
    const validBytes = createValidEmptyPackage("living-room");

    await expect(store.write("../escape", validBytes)).rejects.toThrow(
      "Invalid theme id",
    );
    await expect(store.write("/etc/passwd", validBytes)).rejects.toThrow(
      "Invalid theme id",
    );
    await expect(store.write("", validBytes)).rejects.toThrow(
      "Invalid theme id",
    );
    await expect(store.write("bad id with spaces", validBytes)).rejects.toThrow(
      "Invalid theme id",
    );

    expect(await store.read("../escape")).toBeUndefined();
  });

  it("refuses malformed packages and preserves prior stored content", async () => {
    const store = createThemeStore(tmpDir);
    const validBytes = createValidEmptyPackage("living-room", "Initial Name");
    await store.write("living-room", validBytes);

    const garbage = new Uint8Array([1, 2, 3, 4, 5]);
    await expect(store.write("living-room", garbage)).rejects.toThrow();

    const current = await store.read("living-room");
    expect(current?.envelope.metadata?.name).toBe("Initial Name");
    expect(current?.bytes).toEqual(validBytes);
  });

  it("refuses oversized packages and preserves prior content", async () => {
    const store = createThemeStore(tmpDir);
    const validBytes = createValidEmptyPackage("living-room", "Good Package");
    await store.write("living-room", validBytes);

    // 65 MiB exceeds the 64 MiB maximum
    const oversized = new Uint8Array(65 * 1024 * 1024);
    await expect(store.write("living-room", oversized)).rejects.toThrow();

    const current = await store.read("living-room");
    expect(current?.envelope.metadata?.name).toBe("Good Package");
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
