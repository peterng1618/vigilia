export interface ThemeLibraryEntry {
  readonly id: string;
  readonly name: string;
  readonly updatedAt: string;
}

export interface ThemeLibraryClient {
  list(): Promise<readonly ThemeLibraryEntry[]>;
  open(id: string): Promise<Uint8Array>;
  save(id: string, bytes: Uint8Array): Promise<void>;
}

const THEME_ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/;

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

    async open(id: string): Promise<Uint8Array> {
      if (!THEME_ID_REGEX.test(id)) {
        throw new Error("Invalid theme id.");
      }
      const response = await fetcher(
        `${baseUrl}/api/themes/${encodeURIComponent(id)}`,
      );
      if (!response.ok) {
        throw new Error(`Could not open theme "${id}" (${response.status}).`);
      }
      const buffer = await response.arrayBuffer();
      return new Uint8Array(buffer);
    },

    async save(id: string, bytes: Uint8Array): Promise<void> {
      if (!THEME_ID_REGEX.test(id)) {
        throw new Error("Invalid theme id.");
      }
      const response = await fetcher(
        `${baseUrl}/api/themes/${encodeURIComponent(id)}`,
        {
          method: "PUT",
          headers: {
            "content-type": "application/octet-stream",
          },
          body: bytes as unknown as BodyInit,
        },
      );
      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
          `Could not save theme "${id}" (${response.status}): ${errorText}`,
        );
      }
    },
  };
}
