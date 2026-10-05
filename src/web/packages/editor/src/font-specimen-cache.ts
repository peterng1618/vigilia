import type { CuratedFontFace } from "./font-catalog.js";

interface LoadedFace {
  readonly fontFace: unknown;
  readonly family: string;
}

export interface SpecimenCache {
  /** Requests a face for display. Resolves once the load settles — and it
   *  always resolves: a fetch that throws, a body that will not read and a
   *  payload the FontFace rejects all resolve here, because a row effect
   *  awaiting a rejected ensure is how a picker fails to open. Read
   *  `resident()` to find out whether the face arrived; an id it does not
   *  answer for stays on its fallback face. Calling again for a resident
   *  face is a no-op, and a face whose load threw is fetched again. */
  ensure(face: CuratedFontFace): Promise<void>;
  /** The family name to render with, or undefined while the face is still
   *  loading, so a row can show a fallback face in the meantime. */
  resident(faceId: string): string | undefined;
  /** Frees every face this cache added. Called when the picker closes. */
  release(): void;
}

export interface SpecimenCacheOptions {
  readonly fetch?: typeof fetch;
  readonly createFontFace?: (
    family: string,
    source: ArrayBuffer,
    descriptors: FontFaceDescriptors,
  ) => { load: () => Promise<unknown> };
  readonly fonts?: {
    add(face: unknown): void;
    delete(face: unknown): boolean;
  };
}

/**
 * Holds many curated faces resident so a list can render every family name in
 * its own type. Distinct from `previewFontFace`, which holds exactly one face
 * and releases the previous on entry — one owner per shape, not a duplicate:
 * a list where many rows are visible at once cannot be served by a slot that
 * frees itself when the next row asks.
 *
 * Browsing is transient: nothing here writes an asset, a history entry or
 * dirty state, and `release` frees everything the cache added.
 *
 * `release` is permanent, not a reset. A released cache stays inert forever —
 * the picker that owns it builds a new one when it reopens, so a caller that
 * tries to reuse a released cache gets nothing back.
 */
export function createSpecimenCache(
  options: SpecimenCacheOptions = {},
): SpecimenCache {
  const resident = new Map<string, LoadedFace>();
  const inFlight = new Map<string, Promise<void>>();
  let released = false;

  return {
    async ensure(face: CuratedFontFace): Promise<void> {
      // A closed cache is inert. The picker is gone; a late row must not fetch.
      if (released || resident.has(face.id)) return;
      const pending = inFlight.get(face.id);
      if (pending !== undefined) return pending;

      const load = (async () => {
        try {
          const response = await (options.fetch ?? fetch)(face.sourceUrl);
          if (!response.ok) return;
          const fonts =
            options.fonts ??
            (typeof document === "undefined" ? undefined : document.fonts);
          if (fonts === undefined) return;
          const fontFace = (
            options.createFontFace ??
            ((family, source, descriptors) =>
              new FontFace(family, source, descriptors))
          )(face.family, await response.arrayBuffer(), {
            weight: String(face.weight),
            style: face.style,
          });
          await fontFace.load();
          // A release that lands mid-flight must not resurrect the face.
          if (released) return;
          fonts.add(fontFace);
          resident.set(face.id, { fontFace, family: face.family });
        } catch {
          // A specimen that will not load keeps its fallback face. Browsing
          // must never fail the picker it is decorating.
        }
      })();
      inFlight.set(face.id, load);
      await load;
      inFlight.delete(face.id);
    },

    resident(faceId: string): string | undefined {
      return resident.get(faceId)?.family;
    },

    release(): void {
      released = true;
      const fonts =
        options.fonts ??
        (typeof document === "undefined" ? undefined : document.fonts);
      for (const { fontFace } of resident.values()) fonts?.delete(fontFace);
      resident.clear();
    },
  };
}
