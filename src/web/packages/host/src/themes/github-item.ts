import {
  DASHBOARD_THEME_KIND,
  type FabricThemeEnvelope,
  parseCatalogueItemFile,
} from "@vigilia/renderer-core";
import {
  classifyThemeChange,
  isSemanticVersion,
  MAX_ARCHIVE_BYTES,
  themeVideoRefusals,
  type VersionLevel,
  versionFor,
  writeThemePackage,
} from "@vigilia/theme-package";
import { cataloguePackageUrl } from "./catalogue-source.js";
import { readPublishedItem } from "./published-item.js";
import {
  isValidThemeId,
  ThemeConflictError,
  type ThemeStore,
} from "./store.js";
import type { ThumbnailStore } from "./thumbnails.js";

/**
 * One library theme as the files a catalogue submission commits.
 *
 * The catalogue repo is the only reader of what this writes, so the item file is
 * run back through `parseCatalogueItemFile` before it is returned: the file the
 * host writes is the file the catalogue accepts, checked by the one parser that
 * decides that.
 *
 * The version is the ladder's, never the document's: the published package is
 * the only prior release, and this is the one place both are in hand.
 */

/** The picture's name inside a catalogue item's directory, as in the library. */
const THUMBNAIL_FILE = "thumbnail.png";

export interface SubmissionFiles {
  readonly itemJson: string;
  readonly packageBytes: Uint8Array;
  readonly thumbnailBytes: Uint8Array;
  /** The version this submission publishes; written into the library document. */
  readonly version: string;
  /** The version it bumps from, absent on a first publication. */
  readonly from: string | undefined;
  /** What the ladder decided, which the store surface shows after the PR opens. */
  readonly level: VersionLevel;
  /** The catalogue directory the files belong in: `catalogue/<themeId>`. */
  readonly path: string;
}

export async function submissionFiles(
  themeId: string,
  store: ThemeStore,
  options?: {
    readonly thumbnails?: ThumbnailStore;
    readonly now?: () => Date;
    readonly fetch?: typeof globalThis.fetch;
  },
): Promise<
  { ok: true; files: SubmissionFiles } | { ok: false; message: string }
> {
  if (!isValidThemeId(themeId)) {
    return {
      ok: false,
      message: `"${themeId}" is not a theme id this library can hold.`,
    };
  }

  let theme: Awaited<ReturnType<ThemeStore["read"]>>;
  try {
    theme = await store.read(themeId);
  } catch {
    // A store failure can name an absolute path from this PC; the browser is
    // told what happened to the theme, not where the library lives.
    return {
      ok: false,
      message: `This PC's library could not read theme "${themeId}".`,
    };
  }
  if (theme === undefined) {
    return {
      ok: false,
      message: `This PC's library holds no theme with id "${themeId}".`,
    };
  }

  // The catalogue's CI refuses this package, so the author is told here, before
  // a submission exists to upload.
  const videoRefusal = themeVideoRefusals(theme.envelope, theme.assets)[0];
  if (videoRefusal !== undefined) return { ok: false, message: videoRefusal };

  const thumbnail =
    options?.thumbnails === undefined
      ? undefined
      : await options.thumbnails.read(themeId);
  // Every item commits a picture beside its header, so a theme without one
  // cannot be submitted: the storefront would hold a path to no file.
  if (thumbnail === undefined) {
    return {
      ok: false,
      message: "This theme has no picture yet; set one before submitting.",
    };
  }

  // The store's copy of this id is the only prior release a submission may
  // descend from. Its refusal is the author's answer, unchanged.
  const published = await readPublishedItem(
    themeId,
    options?.fetch === undefined ? undefined : { fetch: options.fetch },
  );
  if (!published.ok) return { ok: false, message: published.message };
  const item = published.item;

  if (item !== undefined && !isSemanticVersion(item.version)) {
    return { ok: false, message: unbumpableVersion(item.version) };
  }

  // The published package is the baseline, and the library document the
  // candidate — the order the ladder expects.
  const change = classifyThemeChange(item?.envelope, theme.envelope);
  if (item !== undefined && change.level === "none") {
    return {
      ok: false,
      message: `Version ${item.version} is published and this theme has not changed since it.`,
    };
  }
  const version = versionFor(item?.version, change);
  if (version === undefined) {
    // `initial` (no published item) always mints a version, so only a published
    // one the ladder refuses can land here.
    return {
      ok: false,
      message:
        item === undefined
          ? "This theme could not be given a version."
          : unbumpableVersion(item.version),
    };
  }

  // Written before the package is built, so the package and the library agree
  // on the version and the next submission diffs against the same baseline.
  // `metadata` is created only when the document has none, and every other
  // field is carried across untouched.
  const withVersion: FabricThemeEnvelope = {
    ...theme.envelope,
    metadata: { ...theme.envelope.metadata, version },
  };
  try {
    await store.write(
      themeId,
      { envelope: withVersion, assets: theme.assets },
      { base: theme.base },
    );
  } catch (error) {
    // A stale base is the store's own sentence: another save moved the
    // document on, and the author has to choose what happens next. Any other
    // refusal could name an absolute path, so it is reported without one.
    return {
      ok: false,
      message:
        error instanceof ThemeConflictError
          ? error.message
          : "This theme's new version could not be saved in this PC's library.",
    };
  }

  // The same writer the export path uses, so the package a reviewer downloads
  // is the package the Install action can open.
  const written = writeThemePackage({
    envelope: withVersion,
    assets: theme.assets,
    thumbnail,
  });
  if (!written.ok) return { ok: false, message: written.message };

  // The reader refuses a package this large, and the catalogue's CI reads it
  // with that reader: saying so here is the last chance to spare the author a
  // failed upload.
  if (written.bytes.byteLength > MAX_ARCHIVE_BYTES) {
    return {
      ok: false,
      message:
        `That package is too large to open: ${written.bytes.byteLength} bytes, ` +
        `and a package may be at most ${MAX_ARCHIVE_BYTES} bytes.`,
    };
  }

  // The submission instant, not the document's: the catalogue derives an item's
  // real history from git, and these fields must be the instants this file
  // claims. Everything a published item owns is carried forward.
  const at = (options?.now?.() ?? new Date()).toISOString();
  const parsed = parseCatalogueItemFile({
    kind: DASHBOARD_THEME_KIND,
    name: theme.name,
    version,
    createdAt: item?.createdAt ?? at,
    updatedAt: at,
    // Option B has no download counter and no reactions for repository files.
    downloads: item?.downloads ?? 0,
    favorites: item?.favorites ?? 0,
    packageUrl: cataloguePackageUrl(themeId),
    // The picture this submission commits, beside `item.json`.
    thumbnail: `catalogue/${themeId}/${THUMBNAIL_FILE}`,
  });
  if (!parsed.ok) return { ok: false, message: parsed.reason };

  return {
    ok: true,
    files: {
      itemJson: `${JSON.stringify(parsed.file, null, 2)}\n`,
      packageBytes: written.bytes,
      thumbnailBytes: thumbnail,
      version,
      from: item?.version,
      level: change.level,
      path: `catalogue/${themeId}`,
    },
  };
}

/** The one sentence a version-shaped value the ladder cannot bump gets. */
function unbumpableVersion(version: string): string {
  return `The store's copy of this theme records version "${version}", which cannot be bumped.`;
}
