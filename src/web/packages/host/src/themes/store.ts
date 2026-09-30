import { createHash } from "node:crypto";
import type { Dirent } from "node:fs";
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
  /** The stored document's identity, which a save made from this read is
   *  based on. See {@link ThemeWriteOptions.base}. */
  readonly base: string;
  readonly envelope: FabricThemeEnvelope;
  readonly assets: Readonly<Record<string, Uint8Array>>;
}

/** What a theme folder holds: the document, and the bytes it declares. */
export interface ThemeContent {
  readonly envelope: FabricThemeEnvelope;
  readonly assets: Readonly<Record<string, Uint8Array>>;
}

/**
 * What a save says about the document it was built from.
 *
 * `base` is the whole concurrency guard, and it is the *document's* content
 * rather than the folder's mtime: an mtime moves when anything touches the
 * folder — the staged rename this store itself performs included — so it
 * reports a change that did not happen and misses one that did. A hash of the
 * bytes answers the only question that matters, which is whether the document
 * the author is editing is still the document that is stored.
 *
 * Absent means the client is not claiming a base, and the save is applied as it
 * always was. That is what a first save is — there is nothing stored to be
 * behind — and what a script or an older client sends.
 */
export interface ThemeWriteOptions {
  readonly base?: string;
  /** Apply the save whatever is stored. The one way past the guard, and only
   *  an author who was told their save was refused should reach for it. */
  readonly overwrite?: boolean;
}

/** A save's outcome: the listing line, and the base the next save is made on. */
export interface ThemeStoreSave extends ThemeStoreEntry {
  readonly base: string;
}

/**
 * A save was refused because the stored theme moved on after the document the
 * save was built from. The previous version is untouched, and the author's
 * document is still theirs to keep, reload past, or replace deliberately.
 */
export class ThemeConflictError extends Error {
  constructor(id: string) {
    super(
      `"${id}" was changed by someone else after this document was opened. ` +
        "Reload it to take the newer version, or save again to replace it.",
    );
    this.name = "ThemeConflictError";
  }
}

export interface ThemeStore {
  list(): Promise<readonly ThemeStoreEntry[]>;
  read(id: string): Promise<ThemeStoreRecord | undefined>;
  write(
    id: string,
    content: ThemeContent,
    options?: ThemeWriteOptions,
  ): Promise<ThemeStoreSave>;
}

const THEME_ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/;
const NONCE_REGEX = /^[0-9a-z]+$/;
const THEME_FILE = "theme.json";
const ASSETS_DIR = "assets";

/** Which half of the save a scratch folder is part of. */
type ScratchKind = "staging" | "retired";

/** Chosen import bounds, not measured disk limits. They match the archive's,
 *  so neither format accepts a theme the other would refuse. */
const MAX_THEME_FILE_BYTES = 32 * 1024 * 1024;
const MAX_ASSET_BYTES = 32 * 1024 * 1024;
const MAX_ASSET_COUNT = 128;
const MAX_TOTAL_ASSET_BYTES = 128 * 1024 * 1024;

export function isValidThemeId(id: string): boolean {
  return THEME_ID_REGEX.test(id);
}

/**
 * A scratch name no theme id can claim, because a listing skips the leading
 * dot, and carrying the id it stands for — so a save that died between its two
 * renames can be put back where the author left it.
 */
function scratchName(kind: ScratchKind, id: string): string {
  const nonce = Date.now().toString(36) + Math.random().toString(36).slice(2);
  return `.${kind}-${nonce}.${id}`;
}

/** The theme a scratch folder stands for, or undefined if it names no theme. */
function scratchTarget(
  name: string,
): { readonly kind: ScratchKind; readonly id: string } | undefined {
  for (const kind of ["staging", "retired"] as const) {
    const prefix = `.${kind}-`;
    if (!name.startsWith(prefix)) {
      continue;
    }
    // The nonce is alphanumeric, so the first dot ends it; an id may hold a
    // hyphen but never a dot, so what follows is the whole id.
    const rest = name.slice(prefix.length);
    const dot = rest.indexOf(".");
    if (dot < 1) {
      return undefined;
    }
    const id = rest.slice(dot + 1);
    return NONCE_REGEX.test(rest.slice(0, dot)) && isValidThemeId(id)
      ? { kind, id }
      : undefined;
  }
  return undefined;
}

/**
 * What a killed save left in the library. Renaming onto an existing directory
 * is not portable — POSIX allows it only for an empty one and Windows refuses
 * it — so the swap is two renames and a crash between them cannot be made
 * impossible; it can only be undone. A `.staging-` folder is the debris of a
 * write that never committed, so it goes. A `.retired-` folder is the last good
 * copy of a theme that has no name of its own any more, so it comes back:
 * without this, the failure a crash actually produces is a theme that looks
 * deleted rather than one that is broken.
 */
async function repairScratch(
  library: string,
  entries: readonly Dirent[],
  saving: ReadonlySet<string>,
): Promise<boolean> {
  let repaired = false;
  await Promise.all(
    entries.map(async (entry) => {
      try {
        if (!entry.isDirectory()) {
          return;
        }
        const target = scratchTarget(entry.name);
        // A save in flight owns its scratch folders; repairing here would
        // delete a staging folder it is about to rename in.
        if (target === undefined || saving.has(target.id)) {
          return;
        }
        const scratch = path.join(library, entry.name);
        if (target.kind === "staging") {
          await fs.rm(scratch, { recursive: true, force: true });
          repaired = true;
          return;
        }
        // A live theme wins. Restoring an older copy over a newer one would
        // trade a crash for silent data loss, so an occupied name is left alone
        // and the retired copy stays where it is until nothing stands there.
        const occupied = await fs
          .stat(path.join(library, target.id))
          .then(() => true)
          .catch(() => false);
        if (!occupied) {
          await fs.rename(scratch, path.join(library, target.id));
          repaired = true;
        }
      } catch {
        // A repair that cannot finish must not cost the listing.
      }
    }),
  );
  // Whether anything moved, so the caller knows if it must look again.
  return repaired;
}

/** The declared paths a theme folder must hold, one file each. */
function declaredPaths(envelope: FabricThemeEnvelope): readonly string[] {
  return (envelope.assets ?? []).map((asset) => asset.path);
}

/** What the document says each path holds, for the assets it says it hashes. */
function declaredHashes(
  envelope: FabricThemeEnvelope,
): ReadonlyMap<string, string> {
  const hashes = new Map<string, string>();
  for (const asset of envelope.assets ?? []) {
    // An unhashed declaration is a path with no content to compare, so it never
    // joins the map rather than joining it as `undefined`.
    if (asset.sha256 !== undefined) {
      hashes.set(asset.path, asset.sha256);
    }
  }
  return hashes;
}

/**
 * The declared paths the previous folder already holds correctly, so a save can
 * copy them across instead of rewriting them.
 *
 * The declared `sha256` is the authority and nothing is re-hashed here: it was
 * computed at import from the exact bytes, and a matching declaration on both
 * sides means the same content. What a hash cannot say is whether the file is
 * *there* — a folder an author emptied, or a path that is not a regular file,
 * still has to be written, or the save would commit a theme missing it.
 */
async function reusableAssets(
  library: string,
  id: string,
  envelope: FabricThemeEnvelope,
): Promise<ReadonlySet<string>> {
  // No readable previous document means nothing to compare against, so the
  // save writes everything rather than trusting a hash it cannot corroborate.
  const previous = await readEnvelope(library, id);
  if (previous === undefined) {
    return new Set();
  }
  const before = declaredHashes(previous);
  const reusable = new Set<string>();
  await Promise.all(
    (envelope.assets ?? []).map(async (asset) => {
      const sha256 = asset.sha256;
      if (sha256 === undefined || before.get(asset.path) !== sha256) {
        return;
      }
      // `lstat`, not `stat`: a symlink is not the file it points at, and
      // copying one would carry its target into the new folder.
      const isFile = await fs
        .lstat(path.join(library, id, ...asset.path.split("/")))
        .then((stat) => stat.isFile())
        .catch(() => false);
      if (isFile) {
        reusable.add(asset.path);
      }
    }),
  );
  return reusable;
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

/** The identity of a stored document: the hash of the bytes that are on disk. */
function contentId(document: string | Uint8Array): string {
  return createHash("sha256").update(document).digest("hex");
}

/** The validated `theme.json` in a folder, and what those bytes identify. */
interface StoredTheme {
  readonly envelope: FabricThemeEnvelope;
  readonly contentId: string;
}

async function readStored(
  library: string,
  id: string,
): Promise<StoredTheme | undefined> {
  try {
    const bytes = await fs.readFile(path.join(library, id, THEME_FILE));
    if (bytes.byteLength > MAX_THEME_FILE_BYTES) {
      return undefined;
    }
    const validation = validateFabricThemeEnvelope(
      JSON.parse(bytes.toString("utf8")),
    );
    return validation.ok
      ? { envelope: validation.envelope, contentId: contentId(bytes) }
      : undefined;
  } catch {
    return undefined;
  }
}

/** The validated `theme.json` in a folder, or undefined if it has none. */
async function readEnvelope(
  library: string,
  id: string,
): Promise<FabricThemeEnvelope | undefined> {
  return (await readStored(library, id))?.envelope;
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
  // The ids with a save in flight, so a listing landing inside one does not
  // mistake that save's scratch folders for the debris of a dead one.
  const saving = new Set<string>();

  return {
    /**
     * Names, authors and modified times, from `theme.json` alone. The archive
     * this replaced inflated every package in the library to print one line
     * each, which is the cost that made listing worth removing.
     *
     * Repair runs here rather than on start: the store has no lifecycle of its
     * own, and this is the one call through which a theme becomes visible at
     * all — so a crash is undone exactly where it would otherwise be seen, and
     * the repaired theme appears in the listing that repaired it.
     */
    async list(): Promise<readonly ThemeStoreEntry[]> {
      try {
        await fs.mkdir(directory, { recursive: true });
        const seen = await fs.readdir(directory, { withFileTypes: true });
        const entries = (await repairScratch(directory, seen, saving))
          ? await fs.readdir(directory, { withFileTypes: true })
          : seen;
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
      const stored = await readStored(directory, id);
      if (stored === undefined) {
        return undefined;
      }
      const { envelope } = stored;
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

        return { ok: true, ...entry, base: stored.contentId, envelope, assets };
      } catch {
        return undefined;
      }
    },

    /**
     * Stages the whole folder beside its target and renames it into place, so
     * an interrupted save can never leave a half-written theme where a working
     * one used to be — the property the single archive file had, kept now that
     * a theme is a directory.
     *
     * An asset the previous theme already holds unchanged is copied across
     * instead of rewritten, with its own timestamps kept: the folder is still
     * staged whole and renamed in, so a file this save did not write is still
     * the same file to everything that watches one.
     *
     * A save that declares a `base` is checked against the stored document
     * first, and the check runs before anything is created on disk: a refusal
     * leaves the theme byte-for-byte as it was, which is the same promise the
     * staged rename makes about an interrupted save.
     */
    async write(
      id: string,
      content: ThemeContent,
      options?: ThemeWriteOptions,
    ): Promise<ThemeStoreSave> {
      if (options?.overwrite !== true && options?.base !== undefined) {
        // A theme that is not stored cannot have been moved on, so a base
        // against nothing is a first save rather than a stale one.
        const stored = await readStored(directory, id);
        if (stored !== undefined && stored.contentId !== options.base) {
          throw new ThemeConflictError(id);
        }
      }
      const envelope = checked(id, content);
      const serialized = JSON.stringify(envelope);
      await fs.mkdir(directory, { recursive: true });
      const target = path.join(directory, id);
      const staging = path.join(directory, scratchName("staging", id));
      const retired = path.join(directory, scratchName("retired", id));
      // `rename` onto an existing directory succeeds on POSIX and fails on
      // Windows, so an old folder is moved aside first and removed after — and
      // a crash between the two leaves the theme recoverable under its
      // `.retired-` name rather than gone.
      let hadPrevious = false;
      saving.add(id);

      try {
        const reusable = await reusableAssets(directory, id, envelope);
        await fs.mkdir(path.join(staging, ASSETS_DIR), { recursive: true });
        await fs.writeFile(path.join(staging, THEME_FILE), serialized);
        for (const [assetPath, bytes] of Object.entries(content.assets)) {
          // The declaration is validated above, so a path cannot escape; this
          // is the belt to that suspenders, because the write is a filesystem
          // call and the check is not.
          const file = path.join(staging, ...assetPath.split("/"));
          await fs.mkdir(path.dirname(file), { recursive: true });
          if (reusable.has(assetPath)) {
            await fs.cp(path.join(target, ...assetPath.split("/")), file, {
              preserveTimestamps: true,
            });
          } else {
            await fs.writeFile(file, bytes);
          }
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
      } finally {
        saving.delete(id);
      }

      if (hadPrevious) {
        await fs.rm(retired, { recursive: true, force: true });
      }

      const entry = await entryFor(directory, id, envelope);
      if (entry === undefined) {
        throw new Error("The theme could not be read back after saving.");
      }
      // The bytes just written are what the next save is based on, so the base
      // is computed here rather than read back — a re-read would also be a
      // second chance for something else to have moved underneath.
      return { ...entry, base: contentId(serialized) };
    },
  };
}
