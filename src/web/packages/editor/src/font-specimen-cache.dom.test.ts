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

  it("keeps several faces resident when rows ask one after another", async () => {
    const fonts = fakeFonts();
    const cache = createSpecimenCache({
      fetch: fetchingOk(),
      createFontFace: vi.fn(() => ({
        load: vi.fn().mockResolvedValue(undefined),
      })),
      fonts,
    });

    // How the picker actually arrives: one row at a time as it scrolls into
    // view. Concurrently, every face clears the entry guard before any load
    // settles, so only this order can catch a cache that holds one at a time.
    for (const face of faces) await cache.ensure(face);

    expect(fonts.add).toHaveBeenCalledTimes(faces.length);
    expect(faces.map((face) => cache.resident(face.id))).toEqual(
      faces.map((face) => face.family),
    );
  });

  it("hands each face its own family, descriptors and bytes", async () => {
    const fetched: string[] = [];
    const createFontFace = vi.fn(
      (
        _family: string,
        _source: ArrayBuffer,
        _descriptors: FontFaceDescriptors,
      ) => ({ load: vi.fn().mockResolvedValue(undefined) }),
    );
    const cache = createSpecimenCache({
      // The body echoes the URL it was asked for, so the bytes the cache hands
      // on can only have come from that face's own sourceUrl.
      fetch: vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        fetched.push(url);
        return new Response(new TextEncoder().encode(url));
      }),
      createFontFace,
      fonts: fakeFonts(),
    });

    for (const face of faces) await cache.ensure(face);

    // Guard the guard: with one family for all three rows this test would pass
    // while every specimen rendered identically.
    expect(new Set(faces.map((face) => face.family)).size).toBe(faces.length);
    expect(fetched).toEqual(faces.map((face) => face.sourceUrl));
    expect(createFontFace).toHaveBeenCalledTimes(faces.length);
    for (const [index, face] of faces.entries()) {
      const call = createFontFace.mock.calls[index]!;
      expect(call[0]).toBe(face.family);
      expect(new TextDecoder().decode(call[1])).toBe(face.sourceUrl);
      expect(call[2]).toMatchObject({
        weight: String(face.weight),
        style: face.style,
      });
    }
  });

  it("reports a face as unresident until its load resolves", async () => {
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

    // Bytes still decoding: the row must stay on its fallback face, because
    // rendering in the family now would paint with a face that cannot paint.
    expect(cache.resident(faces[0]!.id)).toBeUndefined();
    expect(fonts.add).not.toHaveBeenCalled();

    finishLoad();
    await pending;
    expect(cache.resident(faces[0]!.id)).toBe(faces[0]!.family);
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

  // A browse-time outage throws; it does not answer 404. These three are the
  // only ways into the cache's catch, so they carry the whole
  // "keeps its fallback face" promise, and each asserts all of it.

  it("resolves and stays unresident when the download throws", async () => {
    const fonts = fakeFonts();
    const createFontFace = vi.fn();
    const cache = createSpecimenCache({
      fetch: vi.fn().mockRejectedValue(new Error("network down")),
      createFontFace,
      fonts,
    });

    await expect(cache.ensure(faces[0]!)).resolves.toBeUndefined();
    expect(createFontFace).not.toHaveBeenCalled();
    expect(fonts.add).not.toHaveBeenCalled();
    expect(cache.resident(faces[0]!.id)).toBeUndefined();
  });

  it("resolves and stays unresident when the body cannot be read", async () => {
    const fonts = fakeFonts();
    const response = new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    vi.spyOn(response, "arrayBuffer").mockRejectedValue(
      new Error("connection reset"),
    );
    const createFontFace = vi.fn();
    const cache = createSpecimenCache({
      fetch: vi.fn().mockResolvedValue(response),
      createFontFace,
      fonts,
    });

    await expect(cache.ensure(faces[0]!)).resolves.toBeUndefined();
    expect(createFontFace).not.toHaveBeenCalled();
    expect(fonts.add).not.toHaveBeenCalled();
    expect(cache.resident(faces[0]!.id)).toBeUndefined();
  });

  it("resolves and stays unresident when the payload is not a font", async () => {
    const fonts = fakeFonts();
    const cache = createSpecimenCache({
      fetch: fetchingOk(),
      createFontFace: vi.fn(() => ({
        load: vi.fn().mockRejectedValue(new Error("invalid font")),
      })),
      fonts,
    });

    await expect(cache.ensure(faces[0]!)).resolves.toBeUndefined();
    expect(fonts.add).not.toHaveBeenCalled();
    expect(cache.resident(faces[0]!.id)).toBeUndefined();
  });

  it("fetches a face again after its load threw", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockImplementation(async () => okResponse());
    const fonts = fakeFonts();
    const cache = createSpecimenCache({
      fetch: fetcher,
      createFontFace: vi.fn(() => ({
        load: vi.fn().mockResolvedValue(undefined),
      })),
      fonts,
    });

    await cache.ensure(faces[0]!);
    expect(cache.resident(faces[0]!.id)).toBeUndefined();

    // A transient outage must not poison the row: the stale in-flight entry
    // has to be cleared, or this second call returns it and does nothing.
    await cache.ensure(faces[0]!);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(cache.resident(faces[0]!.id)).toBe(faces[0]!.family);
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
