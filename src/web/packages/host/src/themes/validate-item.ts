import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  type CatalogueItemFile,
  DASHBOARD_THEME_KIND,
  type FabricThemeEnvelope,
  isCatalogueId,
  parseCatalogueItemFile,
  type ThemeRemix,
} from "@vigilia/renderer-core";
import {
  classifyThemeChange,
  MAX_ARCHIVE_BYTES,
  readThemePackage,
  themeVideoRefusals,
  versionFor,
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

const USAGE =
  "usage: vigilia validate-item <catalogueDir> " +
  "[--previous-item <file> --previous-package <file>]";

/** The two files the workflow `git show`s out of the base commit. */
interface PreviousFiles {
  readonly item: string;
  readonly package: string;
}

export type CatalogueItemCheck =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly id: string; readonly reason: string };

/** The first thing wrong with one item directory, or that it is valid. The id
 *  is the directory's own name, which is also the package's file name. */
export async function validateCatalogueItem(
  directory: string,
  options?: {
    readonly previousItem?: string;
    readonly previousPackage?: string;
  },
): Promise<CatalogueItemCheck> {
  const id = path.basename(path.resolve(directory));
  const reason = await firstRefusal(directory, id, previousFiles(options));
  return reason === undefined ? { ok: true, id } : { ok: false, id, reason };
}

/**
 * Both flags or neither: the version ruling needs the base header *and* the
 * base package, and half a baseline is no baseline.
 */
function previousFiles(options?: {
  readonly previousItem?: string;
  readonly previousPackage?: string;
}): PreviousFiles | "incomplete" | undefined {
  if (
    options?.previousItem === undefined &&
    options?.previousPackage === undefined
  )
    return undefined;
  if (
    options.previousItem === undefined ||
    options.previousPackage === undefined
  )
    return "incomplete";
  return { item: options.previousItem, package: options.previousPackage };
}

async function firstRefusal(
  directory: string,
  id: string,
  previous: PreviousFiles | "incomplete" | undefined,
): Promise<string | undefined> {
  if (previous === "incomplete") {
    return "the previous item and the previous package must be given together.";
  }

  // The catalogue boundary: the directory name is the item's id, so a name that
  // is not a UUID is refused before any document is read.
  if (!isCatalogueId(id)) {
    return `the directory name "${id}" is not a catalogue id; a catalogue id is a lowercase UUID.`;
  }

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
  // The credit names a catalogue item; a UUID's own item is the one thing it
  // cannot name, because a theme cannot be descended from itself.
  const remixOf = parsed.file.remixOf;
  if (remixOf !== undefined && remixOf.catalogueId === id) {
    return `remixOf.catalogueId names this item's own id "${id}"; a theme cannot be remixed from itself.`;
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
  // The credit is authored once, on the package; the header copies it so the
  // index can carry it without downloading. Two documents that disagree make
  // the storefront credit one parent and install another, so neither wins.
  if (!sameRemix(parsed.file.remixOf, read.envelope.metadata?.remixOf)) {
    return "item.json's remixOf and the package's metadata.remixOf must name the same parent and version.";
  }
  // The version is the ladder's, re-derived from the base commit's own bytes:
  // the same ruling the host made, applied to a package the host did not write.
  const versionRefusal = await versionCheck(
    parsed.file,
    read.envelope,
    previous,
  );
  if (versionRefusal !== undefined) return versionRefusal;
  // A video outside the publish envelope is refused here, in the same words the
  // host's own doors use, rather than discovered at play time.
  return themeVideoRefusals(read.envelope, read.assets)[0];
}

/**
 * The version a submission may publish, from the base header and package. The
 * ladder owns the arithmetic; this owns only the comparisons a PR can fail.
 */
async function versionCheck(
  file: CatalogueItemFile,
  next: FabricThemeEnvelope,
  previous: PreviousFiles | undefined,
): Promise<string | undefined> {
  if (previous === undefined) {
    if (file.version !== "1.0.0") {
      return `a first submission must be version 1.0.0, not "${file.version}".`;
    }
    // The header's first version and the package's must agree here too: a
    // package recording nothing would otherwise publish under a version its
    // own document does not carry.
    const packageVersion = next.metadata?.version;
    if (packageVersion === undefined) {
      return "a first submission's package must record metadata.version 1.0.0; it records none.";
    }
    if (packageVersion !== "1.0.0") {
      return `a first submission's package must record metadata.version 1.0.0, not "${packageVersion}".`;
    }
    return undefined;
  }

  let previousItemValue: unknown;
  try {
    previousItemValue = JSON.parse(await readFile(previous.item, "utf8"));
  } catch (error) {
    return isMissing(error)
      ? "the previous item is missing."
      : "the previous item cannot be read.";
  }
  const previousItem = parseCatalogueItemFile(previousItemValue);
  if (!previousItem.ok)
    return `the previous item is not a catalogue item: ${previousItem.reason}`;

  let previousPackageBytes: Uint8Array;
  try {
    previousPackageBytes = await readFile(previous.package);
  } catch (error) {
    return isMissing(error)
      ? "the previous package is missing."
      : "the previous package cannot be read.";
  }
  const previousPackage = readThemePackage(previousPackageBytes);
  if (!previousPackage.ok) {
    return "the previous package is not a readable theme package.";
  }

  const change = classifyThemeChange(previousPackage.envelope, next);
  if (change.level === "none") {
    return `Version ${previousItem.file.version} is published and this package has not changed since it.`;
  }
  const computed = versionFor(previousItem.file.version, change);
  if (computed === undefined) {
    return `the previous item's version "${previousItem.file.version}" cannot be bumped.`;
  }
  if (file.version !== computed) {
    return `the package changes ${change.level} but item.json says ${file.version}; the ladder computes ${computed}.`;
  }
  const packageVersion = next.metadata?.version;
  if (packageVersion === undefined) {
    return `the package records no metadata.version; item.json says ${file.version}.`;
  }
  if (packageVersion !== file.version) {
    return `item.json says ${file.version} but the package records version "${packageVersion}".`;
  }
  // Provenance is recorded once. A PR that rewrites the credit would launder a
  // fork's history, so the base header's answer stands.
  if (!sameRemix(previousItem.file.remixOf, file.remixOf)) {
    return "remixOf must not change from the previous item; provenance is recorded once and never rewritten.";
  }
  return undefined;
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
  if (directory === undefined || directory.startsWith("--")) {
    console.error(`validate-item needs one <catalogueDir>.\n${USAGE}`);
    return 1;
  }

  const rest = argv.slice(2);
  const options = previousOptions(rest);
  if (options === undefined) {
    console.error(
      rest[0]?.startsWith("--") === true
        ? USAGE
        : `validate-item needs one <catalogueDir>.\n${USAGE}`,
    );
    return 1;
  }

  const checked = await validateCatalogueItem(directory, options);
  if (checked.ok) {
    console.log(`catalogue/${checked.id} is valid`);
    return 0;
  }
  console.error(`Refused catalogue/${checked.id}: ${checked.reason}`);
  return 1;
}

/** The two previous-file flags, in pairs, or `undefined` for any other line.
 *  Either flag without the other is a line this command does not accept. */
function previousOptions(args: readonly string[]):
  | {
      readonly previousItem?: string;
      readonly previousPackage?: string;
    }
  | undefined {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (
      (flag !== "--previous-item" && flag !== "--previous-package") ||
      value === undefined ||
      value.startsWith("--") ||
      values.has(flag)
    ) {
      return undefined;
    }
    values.set(flag, value);
  }
  const previousItem = values.get("--previous-item");
  const previousPackage = values.get("--previous-package");
  if (previousItem === undefined && previousPackage === undefined) return {};
  if (previousItem === undefined || previousPackage === undefined) {
    return undefined;
  }
  return { previousItem, previousPackage };
}

/** Whether two documents name the same parent: absent on both, or the same
 *  three fields. The shape itself is each parser's, not this comparison's. */
function sameRemix(
  one: ThemeRemix | undefined,
  other: ThemeRemix | undefined,
): boolean {
  if (one === undefined || other === undefined) return one === other;
  return (
    one.catalogueId === other.catalogueId &&
    one.name === other.name &&
    one.version === other.version
  );
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
