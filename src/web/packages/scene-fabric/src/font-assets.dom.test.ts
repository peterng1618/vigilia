// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { loadFontAssets } from "./font-assets.js";

const asset = {
  id: "inter-400",
  kind: "font" as const,
  path: "assets/inter-400.woff2",
  family: "Inter",
  weight: 400,
  style: "normal" as const,
  format: "woff2" as const,
  sourceUrl:
    "https://cdn.jsdelivr.net/fontsource/fonts/inter@5.1.1/latin-400-normal.woff2",
  license: {
    name: "SIL Open Font License 1.1",
    url: "https://openfontlicense.org/",
  },
};

describe("packaged font assets", () => {
  it("loads declared font bytes before rendering and releases only loaded faces", async () => {
    const face = { load: vi.fn().mockResolvedValue(undefined) };
    const fonts = { add: vi.fn(), delete: vi.fn() };

    const release = await loadFontAssets({
      assets: [asset],
      bytes: { [asset.path]: new Uint8Array([1, 2]) },
      fonts,
      createFontFace: vi.fn(() => face),
      onError: vi.fn(),
    });

    expect(fonts.add).toHaveBeenCalledWith(face);
    release();
    expect(fonts.delete).toHaveBeenCalledWith(face);
  });

  it("reports a failed face without releasing unrelated loaded faces", async () => {
    const first = { load: vi.fn().mockResolvedValue(undefined) };
    const failed = {
      load: vi.fn().mockRejectedValue(new Error("invalid font")),
    };
    const fonts = { add: vi.fn(), delete: vi.fn() };
    const onError = vi.fn();

    const release = await loadFontAssets({
      assets: [
        asset,
        { ...asset, id: "inter-700", path: "assets/inter-700.woff2" },
      ],
      bytes: {
        [asset.path]: new Uint8Array([1]),
        "assets/inter-700.woff2": new Uint8Array([2]),
      },
      fonts,
      createFontFace: vi
        .fn()
        .mockReturnValueOnce(first)
        .mockReturnValueOnce(failed),
      onError,
    });

    expect(onError).toHaveBeenCalledWith(
      'Could not load packaged font "inter-700": invalid font',
    );
    release();
    expect(fonts.delete).toHaveBeenCalledWith(first);
    expect(fonts.delete).not.toHaveBeenCalledWith(failed);
  });

  it("loads identical bytes once across concurrent mounts", async () => {
    const face = { load: vi.fn().mockResolvedValue(undefined) };
    const fonts = { add: vi.fn(), delete: vi.fn() };
    const createFontFace = vi.fn(() => face);
    const load = {
      assets: [asset],
      bytes: { [asset.path]: new Uint8Array([1, 2]) },
      fonts,
      createFontFace,
      onError: vi.fn(),
    };

    const [releaseA, releaseB] = await Promise.all([
      loadFontAssets(load),
      loadFontAssets(load),
    ]);

    expect(createFontFace).toHaveBeenCalledTimes(1);
    expect(fonts.add).toHaveBeenCalledTimes(1);

    // The face outlives the first release because the second mount still holds it.
    releaseA();
    await Promise.resolve();
    expect(fonts.delete).not.toHaveBeenCalled();

    releaseB();
    await Promise.resolve();
    await Promise.resolve();
    expect(fonts.delete).toHaveBeenCalledWith(face);
  });
});
