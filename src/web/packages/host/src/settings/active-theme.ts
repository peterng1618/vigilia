import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Which saved theme this host displays. Consumer state, like the device
 * assignments beside it: a consumer picks a theme once and the dashboard keeps
 * showing it, without a URL parameter to remember.
 */

export interface ActiveThemeStore {
  /** The chosen theme id, or undefined when none is set or the choice is stale. */
  read(exists: (id: string) => Promise<boolean>): Promise<string | undefined>;
  write(id: string): Promise<void>;
  clear(): Promise<void>;
}

const FILE = "active-theme.json";
const THEME_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function createActiveThemeStore(directory: string): ActiveThemeStore {
  const file = path.join(directory, FILE);

  return {
    async read(exists) {
      let id: unknown;

      try {
        id = (JSON.parse(await readFile(file, "utf8")) as { id?: unknown }).id;
      } catch {
        // No file yet, or an unreadable one: nothing is chosen.
        return undefined;
      }

      if (typeof id !== "string" || !THEME_ID.test(id)) {
        return undefined;
      }

      // A theme deleted since it was chosen must not keep winning; the caller
      // decides what to show instead.
      return (await exists(id)) ? id : undefined;
    },

    async write(id) {
      if (!THEME_ID.test(id)) {
        throw new Error(`Invalid theme id "${id}".`);
      }

      await mkdir(directory, { recursive: true });
      await writeFile(file, `${JSON.stringify({ id }, null, 2)}\n`, "utf8");
    },

    async clear() {
      await mkdir(directory, { recursive: true });
      await writeFile(file, `${JSON.stringify({}, null, 2)}\n`, "utf8");
    },
  };
}
