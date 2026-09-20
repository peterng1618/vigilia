// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fontTrio } from "./font-catalog.js";
import { previewFontFace, releaseFontPreview } from "./font-preview.js";

const trio = fontTrio("minimal")!;
const face = trio.faces[0]!;

afterEach(() => releaseFontPreview());

describe("font preview", () => {
  it("loads a transient face and releases only that face", async () => {
    const fontFace = { load: vi.fn().mockResolvedValue(undefined) };
    const fonts = { add: vi.fn(), delete: vi.fn() };

    const handle = await previewFontFace(face, {
      fetch: vi
        .fn()
        .mockResolvedValue(
          new Response(new Uint8Array([1, 2, 3]), { status: 200 }),
        ),
      createFontFace: vi.fn(() => fontFace),
      fonts,
    });

    expect(fonts.add).toHaveBeenCalledWith(fontFace);
    handle.release();
    expect(fonts.delete).toHaveBeenCalledWith(fontFace);
  });

  it("replaces an in-flight preview without retaining the old face", async () => {
    let rejectFirst: (error: Error) => void = () => undefined;
    const firstFetch = new Promise<Response>((_resolve, reject) => {
      rejectFirst = reject;
    });
    const fonts = { add: vi.fn(), delete: vi.fn() };
    const createFontFace = vi.fn(() => ({
      load: vi.fn().mockResolvedValue(undefined),
    }));
    const first = previewFontFace(face, {
      fetch: vi.fn(() => firstFetch),
      createFontFace,
      fonts,
    });
    const second = await previewFontFace(trio.faces[1]!, {
      fetch: vi
        .fn()
        .mockResolvedValue(new Response(new Uint8Array([4]), { status: 200 })),
      createFontFace,
      fonts,
    });

    rejectFirst(new DOMException("Aborted", "AbortError"));
    await expect(first).rejects.toThrow("Aborted");
    second.release();
    expect(fonts.add).toHaveBeenCalledTimes(1);
  });

  it("does not retain a failed fetch or FontFace load", async () => {
    const fonts = { add: vi.fn(), delete: vi.fn() };

    await expect(
      previewFontFace(face, {
        fetch: vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
        createFontFace: vi.fn(),
        fonts,
      }),
    ).rejects.toThrow("Font preview download failed");
    expect(fonts.add).not.toHaveBeenCalled();

    await expect(
      previewFontFace(face, {
        fetch: vi
          .fn()
          .mockResolvedValue(
            new Response(new Uint8Array([1]), { status: 200 }),
          ),
        createFontFace: vi.fn(() => ({
          load: vi.fn().mockRejectedValue(new Error("invalid font")),
        })),
        fonts,
      }),
    ).rejects.toThrow("invalid font");
    expect(fonts.add).not.toHaveBeenCalled();
  });
});
