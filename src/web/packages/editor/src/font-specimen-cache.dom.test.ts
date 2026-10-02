// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fontTrios } from "./font-catalog.js";
import { createSpecimenCache } from "./font-specimen-cache.js";

const faces = fontTrios()[0]!.faces;

function fakeFonts() {
  return { add: vi.fn(), delete: vi.fn() };
}
// A Response body is readable once, so each call needs its own — which is what
// a real `fetch` returns. `mockResolvedValue` would share one body across the
// three faces below and the second read would throw.
const okResponse = () =>
  new Response(new Uint8Array([1, 2, 3]), { status: 200 });
const fetchingOk = () => vi.fn().mockImplementation(async () => okResponse());

describe("specimen cache", () => {
  it("keeps several faces resident at once", async () => {
    const fonts = fakeFonts();
    const cache = createSpecimenCache({
      fetch: fetchingOk(),
      createFontFace: vi.fn(() => ({
        load: vi.fn().mockResolvedValue(undefined),
      })),
      fonts,
    });

    await Promise.all(faces.map((face) => cache.ensure(face)));

    expect(fonts.add).toHaveBeenCalledTimes(faces.length);
    expect(cache.resident(faces[0]!.id)).toBe(faces[0]!.family);
    cache.release();
    expect(fonts.delete).toHaveBeenCalledTimes(faces.length);
  });

  it("fetches a resident face only once", async () => {
    const fetcher = fetchingOk();
    const cache = createSpecimenCache({
      fetch: fetcher,
      createFontFace: vi.fn(() => ({
        load: vi.fn().mockResolvedValue(undefined),
      })),
      fonts: fakeFonts(),
    });

    await cache.ensure(faces[0]!);
    await cache.ensure(faces[0]!);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("shares one download between rows asking at the same time", async () => {
    const fetcher = fetchingOk();
    const fonts = fakeFonts();
    const cache = createSpecimenCache({
      fetch: fetcher,
      createFontFace: vi.fn(() => ({
        load: vi.fn().mockResolvedValue(undefined),
      })),
      fonts,
    });

    await Promise.all([cache.ensure(faces[0]!), cache.ensure(faces[0]!)]);

    // The second caller arrives while the first is still downloading.
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fonts.add).toHaveBeenCalledTimes(1);
  });

  it("leaves a face unresidents when its download fails, and does not throw", async () => {
    const fonts = fakeFonts();
    const cache = createSpecimenCache({
      fetch: vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
      createFontFace: vi.fn(() => ({
        load: vi.fn().mockResolvedValue(undefined),
      })),
      fonts,
    });

    await expect(cache.ensure(faces[0]!)).resolves.toBeUndefined();
    expect(cache.resident(faces[0]!.id)).toBeUndefined();
    expect(fonts.add).not.toHaveBeenCalled();
  });

  it("does not fetch after release", async () => {
    const fetcher = fetchingOk();
    const cache = createSpecimenCache({
      fetch: fetcher,
      createFontFace: vi.fn(() => ({
        load: vi.fn().mockResolvedValue(undefined),
      })),
      fonts: fakeFonts(),
    });

    cache.release();
    await cache.ensure(faces[0]!);

    // A closed picker must not pull 4 MB behind the author's back.
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not add a face still loading when release lands", async () => {
    const fonts = fakeFonts();
    let startLoad = (): void => undefined;
    const loading = new Promise<void>((resolve) => {
      startLoad = resolve;
    });
    let finishLoad = (): void => undefined;
    const loaded = new Promise<void>((resolve) => {
      finishLoad = resolve;
    });
    const cache = createSpecimenCache({
      fetch: fetchingOk(),
      createFontFace: () => ({
        load: () => {
          startLoad();
          return loaded;
        },
      }),
      fonts,
    });

    const pending = cache.ensure(faces[0]!);
    await loading;
    cache.release();
    finishLoad();
    await pending;

    // The guard on entry is not enough: this face was already downloading.
    expect(fonts.add).not.toHaveBeenCalled();
    expect(cache.resident(faces[0]!.id)).toBeUndefined();
  });

  it("stays inert after release even for a face it held", async () => {
    const fetcher = fetchingOk();
    const fonts = fakeFonts();
    const cache = createSpecimenCache({
      fetch: fetcher,
      createFontFace: vi.fn(() => ({
        load: vi.fn().mockResolvedValue(undefined),
      })),
      fonts,
    });

    await cache.ensure(faces[0]!);
    cache.release();
    await cache.ensure(faces[0]!);

    // Release is permanent, not a reset: the picker builds a new cache.
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cache.resident(faces[0]!.id)).toBeUndefined();
  });
});
