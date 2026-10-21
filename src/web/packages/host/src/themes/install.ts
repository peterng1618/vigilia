import { DASHBOARD_THEME_KIND } from "@vigilia/renderer-core";
import { readThemePackage } from "@vigilia/theme-package";
import type { ThemeOriginsStore } from "../settings/theme-origins.js";
import { downloadPackage } from "./download.js";
import { importThemePackage, type ThemeImportResult } from "./import.js";
import type { ThemeStore } from "./store.js";
import type { ThumbnailStore } from "./thumbnails.js";

/**
 * One catalogue item's Install action, end to end: fetch the package, write it
 * into the library, then record where this copy came from.
 *
 * The owners stay separate — `downloadPackage` holds the trust boundary for a
 * remote address, `importThemePackage` owns the id rule and the write, and
 * `ThemeOriginsStore` owns the provenance file. This module only orders them,
 * and its one rule is that the origin is written **after** the theme landed:
 * a refused download or a refused write leaves `theme-origins.json` untouched.
 *
 * An item this machine already installed is an **update**: the bytes land on
 * that copy, in place, rather than beside it.
 */

export interface InstallRequest {
  readonly packageUrl: string;
  /** The catalogue's id for the item, never the library id. */
  readonly catalogueId: string;
  readonly version: string;
  readonly kind: string;
}

export interface InstallOptions {
  readonly store: ThemeStore;
  readonly origins: ThemeOriginsStore;
  /** The picture's owner; omitted costs the package's picture and nothing else. */
  readonly thumbnails?: ThumbnailStore;
  /** Injected so a test drives the download without a network. */
  readonly fetch?: typeof fetch;
}

/** `stage` is which owner refused, so a route can answer 502 for the remote end
 *  and 400 for an address, a package or a kind this build will not take. */
export type InstallResult =
  | { readonly ok: true; readonly id: string }
  | {
      readonly ok: false;
      readonly message: string;
      readonly stage: "address" | "download" | "package";
    };

/**
 * The catalogue's `kind` names a shape this build runs; the library has no such
 * field. An item of another kind is refused by its identifier — a display word
 * is not what a catalogue author has to match against.
 */
export async function installCatalogueItem(
  request: InstallRequest,
  options: InstallOptions,
): Promise<InstallResult> {
  if (request.kind !== DASHBOARD_THEME_KIND) {
    return {
      ok: false,
      stage: "package",
      message: `This build installs "${DASHBOARD_THEME_KIND}" items, not "${request.kind}".`,
    };
  }

  const downloaded = await downloadPackage(request.packageUrl, {
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
  });
  if (!downloaded.ok) {
    return {
      ok: false,
      stage: downloaded.stage,
      message: downloaded.message,
    };
  }

  const replaceId = await catalogueCopyId(request.catalogueId, options);
  const imported =
    replaceId === undefined
      ? await importThemePackage(downloaded.bytes, {
          store: options.store,
          ...(options.thumbnails === undefined
            ? {}
            : { thumbnails: options.thumbnails }),
        })
      : await replaceCatalogueCopy(downloaded.bytes, replaceId, options);
  if (!imported.ok) {
    return { ok: false, stage: "package", message: imported.message };
  }

  // After the write, never before, and not caught: a store that cannot record
  // provenance must fail the request rather than report an install whose origin
  // a reinstall could not find (Task 4).
  await options.origins.write(imported.id, {
    catalogueId: request.catalogueId,
    version: request.version,
    installedAt: new Date().toISOString(),
  });
  return { ok: true, id: imported.id };
}

/**
 * The library id this catalogue item already occupies, or nothing.
 *
 * Both halves are needed. The origins map says which item a library copy came
 * from; the listing says the copy is still there. An origin whose theme was
 * deleted — or whose origin write failed after a refused install — names an id
 * with nothing to replace, so trusting the map alone would mint a theme under a
 * dead key instead of updating one.
 */
async function catalogueCopyId(
  catalogueId: string,
  options: InstallOptions,
): Promise<string | undefined> {
  const origins = await options.origins.read();
  if (Object.keys(origins).length === 0) return undefined;

  const listed = await options.store.list();
  return listed.find((entry) => origins[entry.id]?.catalogueId === catalogueId)
    ?.id;
}

/**
 * The update path: the package lands on the copy the origin names, in place.
 *
 * Not `importThemePackage`, whose whole rule is that it never replaces — it
 * mints a free id. The document's id is stamped to the library id as the import
 * path stamps it, and the write is the store's `overwrite` rather than a base,
 * because the document being replaced is the catalogue's, not one this process
 * read.
 */
async function replaceCatalogueCopy(
  bytes: Uint8Array,
  id: string,
  options: InstallOptions,
): Promise<ThemeImportResult> {
  const parsed = readThemePackage(bytes);
  if (!parsed.ok) return { ok: false, message: parsed.message };

  try {
    await options.store.write(
      id,
      { envelope: { ...parsed.envelope, id }, assets: parsed.assets },
      { overwrite: true },
    );
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  const { thumbnail } = parsed;
  if (thumbnail !== undefined && options.thumbnails !== undefined) {
    // After the theme and never a refusal, exactly as the import path does.
    await options.thumbnails.write(id, thumbnail).catch(() => undefined);
  }
  return { ok: true, id };
}

/**
 * The route's body as a request, or nothing when it is not the four strings the
 * install needs. Lives beside the request it builds so the wire shape has one
 * owner rather than a copy in the router.
 */
export function parseInstallRequest(
  value: unknown,
): InstallRequest | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const { packageUrl, catalogueId, version, kind } = value as Record<
    string,
    unknown
  >;

  if (
    typeof packageUrl !== "string" ||
    packageUrl === "" ||
    typeof catalogueId !== "string" ||
    catalogueId === "" ||
    typeof version !== "string" ||
    version === "" ||
    typeof kind !== "string" ||
    kind === ""
  ) {
    return undefined;
  }

  return { packageUrl, catalogueId, version, kind };
}
