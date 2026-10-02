import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Which curated font trios this author reaches for.
 *
 * A favourite is a statement about this PC, not authored theme content, so it
 * lives in the settings folder beside the display preferences and never enters a
 * theme package or the player. The catalogue is not consulted here: a favourite
 * is a list of ids, and the client is what decides whether an id still names a
 * trio.
 */

export interface FontFavoritesStore {
  read(): Promise<readonly string[]>;
  write(input: unknown): Promise<readonly string[]>;
}

const FILE = "font-favorites.json";

/**
 * Mirrors the id shape `themes/store.ts` already accepts. Measured against
 * `font-trios.generated.ts`, every emitted trio id is lowercase kebab, three of
 * 379 carry a digit and the longest is 33 characters, so this accepts all of
 * them while still refusing anything that could escape the settings folder.
 */
const TRIO_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Keeps a list of well-shaped ids, in the order they were added, and nothing
 * else.
 *
 * A bad entry is dropped rather than refused, where `display.ts` throws on a
 * zone it cannot resolve. That asymmetry is deliberate: a display that fell
 * back silently would leave a consumer obeying a setting that does nothing,
 * while a favourite that cannot be stored is a preference the author can
 * re-click, and refusing the whole list over one bad entry would throw away
 * every other star with it.
 */
export function normalizeFontFavorites(input: unknown): readonly string[] {
  const list = Array.isArray(input)
    ? input
    : typeof input === "object" && input !== null && "favorites" in input
      ? (input as { favorites: unknown }).favorites
      : [];
  if (!Array.isArray(list)) {
    return [];
  }

  const seen = new Set<string>();
  const favorites: string[] = [];

  for (const entry of list) {
    if (typeof entry !== "string" || !TRIO_ID.test(entry) || seen.has(entry)) {
      continue;
    }
    seen.add(entry);
    favorites.push(entry);
  }

  return favorites;
}

export function createFontFavoritesStore(
  directory: string,
): FontFavoritesStore {
  const file = path.join(directory, FILE);

  return {
    async read(): Promise<readonly string[]> {
      try {
        return normalizeFontFavorites(JSON.parse(await readFile(file, "utf8")));
      } catch {
        // No file, an unreadable one, or one this build cannot parse: no
        // favourites. Never fail an editor load over a stored preference.
        return [];
      }
    },

    async write(input: unknown): Promise<readonly string[]> {
      const normalized = normalizeFontFavorites(input);
      await mkdir(directory, { recursive: true });
      await writeFile(
        file,
        `${JSON.stringify({ favorites: normalized }, null, 2)}\n`,
        "utf8",
      );
      return normalized;
    },
  };
}
