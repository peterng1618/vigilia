import { describe, expect, it } from "vitest";
import { createAssetResolver, isSafeAssetPath } from "./assets.js";
import type { AssetReference } from "./document.js";

/** The declared path is a package path, not a route suffix, so the URL keeps
 *  its `assets/` segment. The host's route is written to read that form; these
 *  are the half of the round trip `host/src/server.test.ts` cannot check. */

const font = {
  id: "inter-400",
  kind: "font",
  path: "assets/inter-400.woff2",
} as unknown as AssetReference;

describe("createAssetResolver", () => {
  it("appends the declared path whole, prefix included", () => {
    const resolve = createAssetResolver([font], {
      baseUrl: "/api/themes/living-room/",
    });

    expect(resolve("inter-400")).toBe(
      "/api/themes/living-room/assets/inter-400.woff2",
    );
  });

  it("spells a hosted asset the way the host route reads it", () => {
    // A base that ends inside the declared path would double the `assets/`
    // segment; the theme root is where the path begins.
    const resolve = createAssetResolver([font], {
      baseUrl: "https://display.test/api/themes/living-room",
    });

    expect(new URL(resolve("inter-400") ?? "").pathname).toBe(
      "/api/themes/living-room/assets/inter-400.woff2",
    );
  });

  it("keeps a fixture's own assets under the page root", () => {
    const resolve = createAssetResolver([font], { baseUrl: "/" });

    expect(resolve("inter-400")).toBe("/assets/inter-400.woff2");
  });

  it("leaves a safe path's characters exactly as declared", () => {
    // The declared charset is already URL-safe, so per-segment encoding is a
    // no-op and the host can read the capture back verbatim.
    const resolve = createAssetResolver(
      [{ id: "logo", kind: "image", path: "assets/brand/logo-2.png" } as never],
      { baseUrl: "/api/themes/x/" },
    );

    expect(resolve("logo")).toBe("/api/themes/x/assets/brand/logo-2.png");
  });

  it("leaves an unknown or unsafe declaration unresolved", () => {
    const resolve = createAssetResolver(
      [
        { id: "escape", kind: "image", path: "assets/../../secret" } as never,
        { id: "bare", kind: "image", path: "logo.png" } as never,
      ],
      { baseUrl: "/api/themes/x/" },
    );

    expect(resolve("escape")).toBeUndefined();
    expect(resolve("bare")).toBeUndefined();
    expect(resolve("absent")).toBeUndefined();
  });
});

describe("isSafeAssetPath", () => {
  it("refuses an escape, a dot segment and a path with no assets prefix", () => {
    expect(isSafeAssetPath("assets/badge.svg")).toBe(true);
    expect(isSafeAssetPath("assets/brand/badge.svg")).toBe(true);
    expect(isSafeAssetPath("assets/../secret")).toBe(false);
    expect(isSafeAssetPath("assets/./badge.svg")).toBe(false);
    expect(isSafeAssetPath("assets")).toBe(false);
    expect(isSafeAssetPath("badge.svg")).toBe(false);
  });
});
