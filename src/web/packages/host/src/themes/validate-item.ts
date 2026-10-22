import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  DASHBOARD_THEME_KIND,
  parseCatalogueItemFile,
} from "@vigilia/renderer-core";
import {
  MAX_ARCHIVE_BYTES,
  readThemePackage,
  themeVideoRefusals,
} from "@vigilia/theme-package";
import { cataloguePackageUrl } from "./catalogue-source.js";

/**
 * One `catalogue/<id>/` directory, checked the way the catalogue's CI checks
 * it: no editor, no network, the same parsers the host installs with.
 *
 * The header is `renderer-core`'s own parser and the package is
 * `theme-package`'s own reader, so a PR this command accepts is a PR the host
 * can install. What is checked here and nowhere else are the facts a PR can get
 * wrong while both documents are individually valid: `packageUrl` naming
 * somewhere other than this directory's file, a picture the directory does not
 * carry, and a package whose own id is another item's.
 */

const USAGE = "usage: vigilia validate-item <catalogueDir>";

export type CatalogueItemCheck =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly id: string; readonly reason: string };

/** The first thing wrong with one item directory, or that it is valid. The id
 *  is the directory's own name, which is also the package's file name. */
export async function validateCatalogueItem(
  directory: string,
): Promise<CatalogueItemCheck> {
  const id = path.basename(path.resolve(directory));
  const reason = await firstRefusal(directory, id);
  return reason === undefined ? { ok: true, id } : { ok: false, id, reason };
}

async function firstRefusal(
  directory: string,
  id: string,
): Promise<string | undefined> {
  const itemFile = path.join(directory, "item.json");
  let item: unknown;
  try {
    item = JSON.parse(await readFile(itemFile, "utf8"));
  } catch (error) {
    if (isMissing(error)) return "item.json is missing.";
    return `item.json cannot be read: ${messageOf(error)}`;
  }

  const parsed = parseCatalogueItemFile(item);
  if (!parsed.ok) return parsed.reason;
  if (parsed.file.kind !== DASHBOARD_THEME_KIND) {
    return `kind "${parsed.file.kind}" is not a kind this build ships.`;
  }

  // Option B: the package rides beside the header, and the raw URL is where the
  // host will download it from. The whole URL is required, not a suffix: a URL
  // ending with this path on another host would make the host fetch bytes this
  // PR does not carry.
  const expected = cataloguePackageUrl(id);
  if (parsed.file.packageUrl !== expected) {
    return `packageUrl must be ${expected}, not "${parsed.file.packageUrl}".`;
  }

  // The layout the catalogue's listing points at: header, package, and one
  // picture beside them.
  const expectedThumbnail = `catalogue/${id}/thumbnail.png`;
  if (parsed.file.thumbnail !== expectedThumbnail) {
    return `thumbnail must be ${expectedThumbnail}, not "${parsed.file.thumbnail}".`;
  }
  try {
    await stat(path.join(directory, "thumbnail.png"));
  } catch (error) {
    if (isMissing(error)) return "thumbnail.png is missing.";
    // The error's text can carry the absolute fixture path, and the sentence
    // says all a submitter can act on.
    return "thumbnail.png cannot be read.";
  }

  const packageFile = path.join(directory, `${id}.zip`);
  let size: number;
  try {
    size = (await stat(packageFile)).size;
  } catch (error) {
    if (isMissing(error)) return `${id}.zip is missing.`;
    return `${id}.zip cannot be read: ${messageOf(error)}`;
  }
  if (size > MAX_ARCHIVE_BYTES) {
    return (
      `${id}.zip is ${size} bytes; a package may be at most ` +
      `${MAX_ARCHIVE_BYTES} bytes.`
    );
  }

  let bytes: Uint8Array;
  try {
    bytes = await readFile(packageFile);
  } catch (error) {
    return `${id}.zip cannot be read: ${messageOf(error)}`;
  }
  const read = readThemePackage(bytes);
  if (!read.ok) return read.message;
  // The directory's name is the item's id, and the package cannot mean another.
  if (read.envelope.id !== id) {
    return (
      `${id}.zip holds theme "${read.envelope.id}"; ` +
      `the directory is the item's id, so the package must be "${id}".`
    );
  }
  // A video outside the publish envelope is refused here, in the same words the
  // host's own doors use, rather than discovered at play time.
  return themeVideoRefusals(read.envelope, read.assets)[0];
}

/**
 * `undefined` for every command line that is not this one, so `run` falls
 * through to its own parser untouched.
 */
export async function validateItemCommand(
  argv: readonly string[],
): Promise<number | undefined> {
  if (argv[0] !== "validate-item") return undefined;

  const directory = argv[1];
  if (directory === undefined || argv.length > 2) {
    console.error(`validate-item needs one <catalogueDir>.\n${USAGE}`);
    return 1;
  }

  const checked = await validateCatalogueItem(directory);
  if (checked.ok) {
    console.log(`catalogue/${checked.id} is valid`);
    return 0;
  }
  console.error(`Refused catalogue/${checked.id}: ${checked.reason}`);
  return 1;
}

/** A file that is not there, told apart from one that is there and unreadable. */
function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
