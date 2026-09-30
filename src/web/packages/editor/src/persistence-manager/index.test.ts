import { readThemePackage } from "@vigilia/theme-package";
import { describe, expect, it } from "vitest";
import { documentKey, PersistenceManager } from "./index.js";

const baseline = {
  schemaVersion: 2,
  fabricVersion: "7.4.0",
  id: "theme",
  artboard: { width: 1, height: 1 },
  metadata: { locale: "en" },
  scene: { version: "7.4.0", objects: [] },
} as const;

/** A document that declares one asset, as `AssetManager` writes it. */
const withAsset = (sha256: string, path = "assets/logo.png") => ({
  ...baseline,
  assets: [declared(path, sha256)],
});
const declared = (path: string, sha256: string) => ({
  id: path.replace("assets/", "").replace(".png", ""),
  kind: "image" as const,
  path,
  sha256,
});
const logo = new Uint8Array([1, 2, 3, 4]);

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

  it("detects a one-byte change in an asset's content", () => {
    const manager = new PersistenceManager(withAsset("a".repeat(64)), {
      "assets/logo.png": logo,
    });

    expect(
      manager.isDirty(withAsset("b".repeat(64)), {
        "assets/logo.png": new Uint8Array([1, 2, 3, 5]),
      }),
    ).toBe(true);
  });

  it("detects a rename, an added asset and a removed one", () => {
    const manager = new PersistenceManager(withAsset("a".repeat(64)), {
      "assets/logo.png": logo,
    });
    const renamed = "assets/mark.png";

    expect(
      manager.isDirty(withAsset("a".repeat(64), renamed), {
        [renamed]: logo,
      }),
    ).toBe(true);
    expect(
      manager.isDirty(
        {
          ...withAsset("a".repeat(64)),
          assets: [
            ...withAsset("a".repeat(64)).assets,
            declared(renamed, "c".repeat(64)),
          ],
        },
        { "assets/logo.png": logo, [renamed]: new Uint8Array([9]) },
      ),
    ).toBe(true);
    expect(manager.isDirty(withAsset("a".repeat(64)), {})).toBe(true);
  });

  /**
   * The complaint the cost fix could have caused: a key that is too eager fires
   * the guard on a document nobody touched. Two assets and the same map built in
   * a different key order is the case that catches it — the author did nothing,
   * and a key walking `Object.entries` without sorting would call that a change.
   */
  it("does not fire on an unchanged document, whatever order the map is in", () => {
    const first = declared("assets/logo.png", "a".repeat(64));
    const second = declared("assets/mark.png", "c".repeat(64));
    const document = { ...withAsset("a".repeat(64)), assets: [first, second] };
    const logoBytes = logo;
    const markBytes = new Uint8Array([7, 7]);

    const manager = new PersistenceManager(document, {
      "assets/logo.png": logoBytes,
      "assets/mark.png": markBytes,
    });

    expect(
      manager.isDirty(document, {
        "assets/mark.png": markBytes,
        "assets/logo.png": logoBytes,
      }),
    ).toBe(false);
  });

  /**
   * The cost, asserted rather than measured: a 24 MB asset's key was an 86 MB
   * string, retained until the next collection. A key that answers "is this the
   * same document" cannot be larger than the document's own declarations.
   */
  it("keeps the key proportional to the declarations, not the bytes", () => {
    const document = withAsset("a".repeat(64));
    const megabytes = 24;
    const big = new Uint8Array(megabytes * 1024 * 1024).fill(7);

    expect(
      documentKey(document, { "assets/logo.png": big }).length,
    ).toBeLessThan(1024);
    expect(
      documentKey(document, { "assets/logo.png": big }).length -
        documentKey(document, { "assets/logo.png": logo }).length,
    ).toBeLessThan(64);
  });
});
