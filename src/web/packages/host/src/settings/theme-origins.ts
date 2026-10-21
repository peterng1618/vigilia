import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Where each library theme came from, kept beside the themes themselves.
 *
 * "Installed" is a fact about this machine's copy, not about the catalogue item:
 * the item is the same for everyone, while this record exists only where someone
 * installed it. So it is consumer state, like `active-theme.json` and
 * `theme-answers.json`, and the file is
 * `{ "<theme id>": { "catalogueId": …, "version": …, "installedAt": … } }`.
 */

export interface ThemeOrigin {
  /** The catalogue's own id for the item, not the library id. */
  readonly catalogueId: string;
  /** The catalogue version this copy was installed from. */
  readonly version: string;
  /** An ISO instant. */
  readonly installedAt: string;
}

export interface ThemeOriginsStore {
  /** Every entry, keyed by library theme id. */
  read(): Promise<Readonly<Record<string, ThemeOrigin>>>;
  write(themeId: string, origin: ThemeOrigin): Promise<void>;
  /** One theme's entry, for a theme that has been deleted. */
  removeTheme(themeId: string): Promise<void>;
}

const FILE = "theme-origins.json";
const THEME_ID = /^[A-Za-z0-9_-]{1,64}$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * One entry, or nothing when it is not three usable strings.
 *
 * A hand-edited file must not blank the whole map, so a bad entry is dropped
 * rather than failing the read.
 */
function asOrigin(value: unknown): ThemeOrigin | undefined {
  if (!isObject(value)) return undefined;

  const { catalogueId, version, installedAt } = value;

  if (
    typeof catalogueId !== "string" ||
    typeof version !== "string" ||
    typeof installedAt !== "string"
  ) {
    return undefined;
  }

  return { catalogueId, version, installedAt };
}

/** The file's contents, with every key held to `THEME_ID` and every entry validated. */
function normalizeOrigins(input: unknown): Record<string, ThemeOrigin> {
  if (!isObject(input)) return {};

  const origins: Record<string, ThemeOrigin> = {};

  for (const [id, raw] of Object.entries(input)) {
    if (!THEME_ID.test(id)) continue;

    const entry = asOrigin(raw);
    if (entry) origins[id] = entry;
  }

  return origins;
}

async function readOrigins(file: string): Promise<Record<string, ThemeOrigin>> {
  try {
    return normalizeOrigins(JSON.parse(await readFile(file, "utf8")));
  } catch {
    // No file, or an unreadable one: nothing was installed from the catalogue.
    return {};
  }
}

export function createThemeOriginsStore(directory: string): ThemeOriginsStore {
  const file = path.join(directory, FILE);

  const save = async (all: Record<string, ThemeOrigin>): Promise<void> => {
    await mkdir(directory, { recursive: true });
    await writeFile(file, `${JSON.stringify(all, null, 2)}\n`, "utf8");
  };

  return {
    async read() {
      return readOrigins(file);
    },

    async write(themeId, origin) {
      if (!THEME_ID.test(themeId)) {
        throw new Error(`Invalid theme id "${themeId}".`);
      }

      const all = await readOrigins(file);
      // The whole map is normalized on the way out, so a key or an entry the
      // reader dropped does not survive a write beside a good one.
      await save(normalizeOrigins({ ...all, [themeId]: origin }));
    },

    async removeTheme(themeId) {
      if (!THEME_ID.test(themeId)) return;

      const all = await readOrigins(file);
      // Nothing to remove is no write: a file that could not be read reads as
      // `{}`, and saving that would replace the file that is actually there.
      if (!(themeId in all)) return;

      delete all[themeId];
      await save(all);
    },
  };
}
