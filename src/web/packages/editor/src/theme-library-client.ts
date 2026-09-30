import type { FabricThemeEnvelope } from "@vigilia/renderer-core";

/**
 * The host's library is a folder (ADR-0017), so a save carries the document
 * and its declared bytes rather than an archive the host would only unpack
 * again. The archive is still the export; this is the working path.
 */

export interface ThemeLibraryEntry {
  readonly id: string;
  readonly name: string;
  /** The host store's own mtime. A template is not a stored file and has none,
   *  which is what keeps it out of a count of the author's saved themes. */
  readonly updatedAt?: string;
}

export interface ThemeLibraryContent {
  readonly envelope: FabricThemeEnvelope;
  readonly assets: Readonly<Record<string, Uint8Array>>;
}

export interface ThemeLibraryClient {
  list(): Promise<readonly ThemeLibraryEntry[]>;
  open(id: string): Promise<ThemeLibraryContent>;
  save(id: string, content: ThemeLibraryContent): Promise<void>;
  /** Stores the theme's picture, so the library can show one. Optional: a
   * failure here must not fail the save. */
  saveThumbnail?(id: string, png: Uint8Array): Promise<void>;
}

const THEME_ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/;

/** Chunked because `String.fromCharCode` is applied to an argument list. */
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function readContent(json: unknown): ThemeLibraryContent {
  const body = json as {
    readonly envelope?: unknown;
    readonly assets?: unknown;
  };
  return {
    envelope: body?.envelope as FabricThemeEnvelope,
    assets: Object.fromEntries(
      Object.entries((body?.assets ?? {}) as Record<string, string>).map(
        ([assetPath, encoded]) => [assetPath, fromBase64(encoded)],
      ),
    ),
  };
}

export function createThemeLibraryClient(options?: {
  readonly baseUrl?: string;
  readonly fetch?: typeof fetch;
}): ThemeLibraryClient {
  const fetcher = options?.fetch ?? globalThis.fetch.bind(globalThis);
  const baseUrl = options?.baseUrl ?? "";

  return {
    async list(): Promise<readonly ThemeLibraryEntry[]> {
      const response = await fetcher(`${baseUrl}/api/themes`);
      if (!response.ok) {
        throw new Error(`Could not list themes (${response.status}).`);
      }
      const data = (await response.json()) as
        | { themes?: readonly ThemeLibraryEntry[] }
        | readonly ThemeLibraryEntry[];
      if (Array.isArray(data)) {
        return data;
      }
      if (
        typeof data === "object" &&
        data !== null &&
        "themes" in data &&
        Array.isArray(data.themes)
      ) {
        return data.themes;
      }
      return [];
    },

    async open(id: string): Promise<ThemeLibraryContent> {
      if (!THEME_ID_REGEX.test(id)) {
        throw new Error("Invalid theme id.");
      }
      const response = await fetcher(
        `${baseUrl}/api/themes/${encodeURIComponent(id)}`,
      );
      if (!response.ok) {
        throw new Error(`Could not open theme "${id}" (${response.status}).`);
      }
      return readContent(await response.json());
    },

    async save(id: string, content: ThemeLibraryContent): Promise<void> {
      if (!THEME_ID_REGEX.test(id)) {
        throw new Error("Invalid theme id.");
      }
      const response = await fetcher(
        `${baseUrl}/api/themes/${encodeURIComponent(id)}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            envelope: content.envelope,
            assets: Object.fromEntries(
              Object.entries(content.assets).map(([assetPath, bytes]) => [
                assetPath,
                toBase64(bytes),
              ]),
            ),
          }),
        },
      );
      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
          `Could not save theme "${id}" (${response.status}): ${errorText}`,
        );
      }
    },

    async saveThumbnail(id: string, png: Uint8Array): Promise<void> {
      if (!THEME_ID_REGEX.test(id)) {
        throw new Error("Invalid theme id.");
      }
      const response = await fetcher(
        `${baseUrl}/api/themes/${encodeURIComponent(id)}/thumbnail`,
        {
          method: "PUT",
          headers: { "content-type": "image/png" },
          body: png as unknown as BodyInit,
        },
      );
      if (!response.ok) {
        throw new Error(`Could not save the thumbnail (${response.status}).`);
      }
    },
  };
}
