import fs from "node:fs/promises";
import path from "node:path";
import {
  type FabricThemeEnvelope,
  validateFabricThemeEnvelope,
} from "@vigilia/renderer-core";

/**
 * A theme is a directory, read and written in place (ADR-0017). The archive
 * format is only what an author exports, so nothing on this working path
 * compresses and re-expands: `list()` reads one small JSON file per theme
 * instead of inflating a package, and a save writes the bytes the author typed.
 *
 *     <library>/<theme-id>/theme.json
 *     <library>/<theme-id>/assets/<declared path>
 */

export interface ThemeStoreEntry {
  readonly id: string;
  readonly name: string;
  /** The envelope's author, when it declares one; the library shows it. */
  readonly author?: string;
  readonly updatedAt: string;
}

export interface ThemeStoreRecord extends ThemeStoreEntry {
  readonly ok: true;
  readonly envelope: FabricThemeEnvelope;
  readonly assets: Readonly<Record<string, Uint8Array>>;
}

/** What a theme folder holds: the document, and the bytes it declares. */
export interface ThemeContent {
  readonly envelope: FabricThemeEnvelope;
  readonly assets: Readonly<Record<string, Uint8Array>>;
}

export interface ThemeStore {
  list(): Promise<readonly ThemeStoreEntry[]>;
  read(id: string): Promise<ThemeStoreRecord | undefined>;
  write(id: string, content: ThemeContent): Promise<ThemeStoreEntry>;
}

const THEME_ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/;
const THEME_FILE = "theme.json";
const ASSETS_DIR = "assets";

/** Chosen import bounds, not measured disk limits. They match the archive's,
 *  so neither format accepts a theme the other would refuse. */
const MAX_THEME_FILE_BYTES = 32 * 1024 * 1024;
const MAX_ASSET_BYTES = 32 * 1024 * 1024;
const MAX_ASSET_COUNT = 128;
const MAX_TOTAL_ASSET_BYTES = 128 * 1024 * 1024;

export function isValidThemeId(id: string): boolean {
  return THEME_ID_REGEX.test(id);
}

/** A scratch name no theme id can claim, so a listing cannot see it. */
function scratchName(prefix: string): string {
  return `${prefix}${Date.now()}.${Math.random().toString(36).slice(2)}`;
}

/** The declared paths a theme folder must hold, one file each. */
function declaredPaths(envelope: FabricThemeEnvelope): readonly string[] {
  return (envelope.assets ?? []).map((asset) => asset.path);
}

/** Validates both halves of a folder and returns the envelope to persist. */
function checked(id: string, content: ThemeContent): FabricThemeEnvelope {
  if (!isValidThemeId(id)) {
    throw new Error("Invalid theme id.");
  }
  const validation = validateFabricThemeEnvelope(content.envelope);
  if (!validation.ok) {
    throw new Error(validation.issues[0]?.message ?? "Invalid theme.");
  }
  const envelope = validation.envelope;
  if (envelope.id !== id) {
    throw new Error(
      `Theme id "${envelope.id}" does not match target id "${id}".`,
    );
  }
  // The declaration is the whole truth about what a theme carries: a byte on
  // disk that no reference names is unreachable, and a reference with no file
  // is a theme that renders nothing.
  const declared = new Set(declaredPaths(envelope));
  if (
    Object.keys(content.assets).length !== declared.size ||
    [...declared].some((assetPath) => content.assets[assetPath] === undefined)
  ) {
    throw new Error("Assets must exactly match the theme declaration.");
  }
  return envelope;
}

/** The validated `theme.json` in a folder, or undefined if it has none. */
async function readEnvelope(
  library: string,
  id: string,
): Promise<FabricThemeEnvelope | undefined> {
  try {
    const bytes = await fs.readFile(path.join(library, id, THEME_FILE));
    if (bytes.byteLength > MAX_THEME_FILE_BYTES) {
      return undefined;
    }
    const validation = validateFabricThemeEnvelope(
      JSON.parse(bytes.toString("utf8")),
    );
    return validation.ok ? validation.envelope : undefined;
  } catch {
    return undefined;
  }
}

/** One library line: what the document says, and when the folder changed. */
async function entryFor(
  library: string,
  id: string,
  envelope: FabricThemeEnvelope,
): Promise<ThemeStoreEntry | undefined> {
  try {
    const stat = await fs.stat(path.join(library, id));
    const author = envelope.metadata?.author;
    return {
      id,
      name: envelope.metadata?.name ?? id,
      ...(author === undefined ? {} : { author }),
      updatedAt: stat.mtime.toISOString(),
    };
  } catch {
    return undefined;
  }
}

export function createThemeStore(directory: string): ThemeStore {
  return {
    /**
     * Names, authors and modified times, from `theme.json` alone. The archive
     * this replaced inflated every package in the library to print one line
     * each, which is the cost that made listing worth removing.
     */
    async list(): Promise<readonly ThemeStoreEntry[]> {
      try {
        await fs.mkdir(directory, { recursive: true });
        const entries = await fs.readdir(directory, { withFileTypes: true });
        const themes = await Promise.all(
          entries
            .filter((entry) => entry.isDirectory())
            .map(async (entry) => {
              if (!isValidThemeId(entry.name)) {
                return undefined;
              }
              const envelope = await readEnvelope(directory, entry.name);
              return envelope === undefined
                ? undefined
                : entryFor(directory, entry.name, envelope);
            }),
        );
        return themes
          .filter((entry): entry is ThemeStoreEntry => entry !== undefined)
          .sort((a, b) => a.id.localeCompare(b.id));
      } catch {
        return [];
      }
    },

    async read(id: string): Promise<ThemeStoreRecord | undefined> {
      if (!isValidThemeId(id)) {
        return undefined;
      }
      const envelope = await readEnvelope(directory, id);
      if (envelope === undefined) {
        return undefined;
      }
      const entry = await entryFor(directory, id, envelope);
      if (entry === undefined) {
        return undefined;
      }

      try {
        const declared = declaredPaths(envelope);
        if (declared.length > MAX_ASSET_COUNT) {
          return undefined;
        }
        const assets: Record<string, Uint8Array> = {};
        let total = 0;

        for (const assetPath of declared) {
          const bytes = await fs.readFile(
            path.join(directory, id, ...assetPath.split("/")),
          );
          if (bytes.byteLength > MAX_ASSET_BYTES) {
            return undefined;
          }
          total += bytes.byteLength;
          if (total > MAX_TOTAL_ASSET_BYTES) {
            return undefined;
          }
          assets[assetPath] = new Uint8Array(bytes);
        }

        return { ok: true, ...entry, envelope, assets };
      } catch {
        return undefined;
      }
    },

    /**
     * Stages the whole folder beside its target and renames it into place, so
     * an interrupted save can never leave a half-written theme where a working
     * one used to be — the property the single archive file had, kept now that
     * a theme is a directory.
     */
    async write(id: string, content: ThemeContent): Promise<ThemeStoreEntry> {
      const envelope = checked(id, content);
      await fs.mkdir(directory, { recursive: true });
      const target = path.join(directory, id);
      const staging = path.join(directory, scratchName(".staging-"));
      const retired = path.join(directory, scratchName(".retired-"));
      // `rename` onto an existing directory succeeds on POSIX and fails on
      // Windows, so an old folder is moved aside first and removed after — and
      // a crash between the two leaves the theme recoverable under its
      // `.retired-` name rather than gone.
      let hadPrevious = false;

      try {
        await fs.mkdir(path.join(staging, ASSETS_DIR), { recursive: true });
        await fs.writeFile(
          path.join(staging, THEME_FILE),
          JSON.stringify(envelope),
        );
        for (const [assetPath, bytes] of Object.entries(content.assets)) {
          // The declaration is validated above, so a path cannot escape; this
          // is the belt to that suspenders, because the write is a filesystem
          // call and the check is not.
          const file = path.join(staging, ...assetPath.split("/"));
          await fs.mkdir(path.dirname(file), { recursive: true });
          await fs.writeFile(file, bytes);
        }

        hadPrevious = await fs
          .stat(target)
          .then(() => true)
          .catch(() => false);
        if (hadPrevious) {
          await fs.rename(target, retired);
        }
        await fs.rename(staging, target);
      } catch (error) {
        await fs.rm(staging, { recursive: true, force: true });
        throw error;
      }

      if (hadPrevious) {
        await fs.rm(retired, { recursive: true, force: true });
      }

      const entry = await entryFor(directory, id, envelope);
      if (entry === undefined) {
        throw new Error("The theme could not be read back after saving.");
      }
      return entry;
    },
  };
}
