import { readThemePackage } from "@vigilia/theme-package";
import { describe, expect, it } from "vitest";
import { PersistenceManager } from "./index.js";

const baseline = {
  schemaVersion: 2,
  fabricVersion: "7.4.0",
  id: "theme",
  artboard: { width: 1, height: 1 },
  metadata: { locale: "en" },
  scene: { version: "7.4.0", objects: [] },
} as const;

describe("PersistenceManager", () => {
  it("detects authored scene, envelope, and asset-byte changes", () => {
    const persistence = new PersistenceManager(baseline, {});

    expect(persistence.isDirty(baseline, {})).toBe(false);
    expect(
      persistence.isDirty(
        {
          ...baseline,
          scene: {
            ...baseline.scene,
            objects: [{ type: "Rect", id: "panel" }],
          },
        },
        {},
      ),
    ).toBe(true);
    expect(
      persistence.isDirty(
        {
          ...baseline,
          metadata: { name: "Renamed theme" },
        },
        {},
      ),
    ).toBe(true);
    expect(
      persistence.isDirty(baseline, { "assets/logo.png": new Uint8Array([1]) }),
    ).toBe(true);
  });

  it("saves empty-asset themes as valid .vigilia-theme packages", async () => {
    let downloaded: { name: string; bytes: Uint8Array } | undefined;
    const manager = new PersistenceManager(
      baseline,
      {},
      {
        downloader: (name, bytes) => {
          downloaded = { name, bytes };
        },
      },
    );

    const changedEnvelope = {
      ...baseline,
      id: "living-room",
      metadata: { name: "Living Room", locale: "en" },
    };

    await manager.save(changedEnvelope, {});
    expect(downloaded?.name).toBe("living-room.vigilia-theme");
    expect(readThemePackage(downloaded!.bytes)).toMatchObject({
      ok: true,
      envelope: changedEnvelope,
    });
    expect(manager.isDirty(changedEnvelope, {})).toBe(false);
  });

  it("ships the picture in the downloaded package, and does not track it", async () => {
    let downloaded: { name: string; bytes: Uint8Array } | undefined;
    const manager = new PersistenceManager(
      baseline,
      {},
      {
        downloader: (name, bytes) => {
          downloaded = { name, bytes };
        },
      },
    );
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1,
    ]);

    await manager.save(baseline, {}, png);
    const read = readThemePackage(downloaded!.bytes);
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.thumbnail).toEqual(png);

    // A picture is a rendering of one machine, not authored state.
    expect(manager.isDirty(baseline, {})).toBe(false);
  });

  it("marks theme as clean after remote save", () => {
    const manager = new PersistenceManager(baseline, {});
    const changed = { ...baseline, id: "changed" };
    expect(manager.isDirty(changed, {})).toBe(true);
    manager.markSaved(changed, {});
    expect(manager.isDirty(changed, {})).toBe(false);
  });
});
