import {
  DASHBOARD_THEME_KIND,
  parseCatalogueItemFile,
} from "@vigilia/renderer-core";
import { writeThemePackage } from "@vigilia/theme-package";
import { isValidThemeId, type ThemeStore } from "./store.js";
import type { ThumbnailStore } from "./thumbnails.js";

/**
 * One library theme as the files a catalogue submission commits.
 *
 * The catalogue repo is the only reader of what this writes, so the item file is
 * run back through `parseCatalogueItemFile` before it is returned: the file the
 * host writes is the file the catalogue accepts, checked by the one parser that
 * decides that.
 */

/** Option B: the package rides beside `item.json` in the catalogue repo. */
const CATALOGUE_RAW_BASE =
  "https://raw.githubusercontent.com/peterng1618/vigilia-store/main";

/** The picture's name inside a catalogue item's directory, as in the library. */
const THUMBNAIL_FILE = "thumbnail.png";

/** A theme that declares no version is published as its first release: the
 *  catalogue's header requires one and refusing would block every theme whose
 *  author never filled the field in. */
const FIRST_VERSION = "1.0.0";

export interface SubmissionFiles {
  readonly itemJson: string;
  readonly packageBytes: Uint8Array;
  readonly thumbnail: Uint8Array | undefined;
  /** The catalogue directory the files belong in: `catalogue/<themeId>`. */
  readonly path: string;
}

export async function submissionFiles(
  themeId: string,
  store: ThemeStore,
  options?: {
    readonly thumbnails?: ThumbnailStore;
    readonly now?: () => Date;
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
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
  if (theme === undefined) {
    return {
      ok: false,
      message: `This PC's library holds no theme with id "${themeId}".`,
    };
  }

  const thumbnail =
    options?.thumbnails === undefined
      ? undefined
      : await options.thumbnails.read(themeId);

  // The same writer the export path uses, so the package a reviewer downloads
  // is the package the Install action can open.
  const written = writeThemePackage({
    envelope: theme.envelope,
    assets: theme.assets,
    ...(thumbnail === undefined ? {} : { thumbnail }),
  });
  if (!written.ok) return { ok: false, message: written.message };

  // The submission instant, not the document's: the catalogue derives an item's
  // real history from git, and these fields must be the instants this file
  // claims.
  const at = (options?.now?.() ?? new Date()).toISOString();
  const version =
    theme.version === undefined || theme.version === ""
      ? FIRST_VERSION
      : theme.version;

  const parsed = parseCatalogueItemFile({
    kind: DASHBOARD_THEME_KIND,
    name: theme.name,
    version,
    createdAt: at,
    updatedAt: at,
    // Option B has no download counter and no reactions for repository files.
    downloads: 0,
    favorites: 0,
    packageUrl: `${CATALOGUE_RAW_BASE}/catalogue/${themeId}/${themeId}.zip`,
    // The wire requires this path even when there is no picture to commit; the
    // submission then carries no thumbnail and the storefront falls back to text.
    thumbnail: `catalogue/${themeId}/${THUMBNAIL_FILE}`,
  });
  if (!parsed.ok) return { ok: false, message: parsed.reason };

  return {
    ok: true,
    files: {
      itemJson: `${JSON.stringify(parsed.file, null, 2)}\n`,
      packageBytes: written.bytes,
      thumbnail,
      path: `catalogue/${themeId}`,
    },
  };
}
