import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  type CatalogueEntry,
  type CatalogueIndex,
  facetRecordOf,
  parseCatalogueIndex,
  validateFabricThemeEnvelope,
} from "@vigilia/renderer-core";

/**
 * The catalogue listing's generator, run as a host command.
 *
 * It lives here rather than in `scripts/` because the reader's parser and the
 * facet record are `renderer-core` source, which only the built host can import
 * (`bin/vigilia.js`). The output is the one file the editor fetches.
 */

/** One item's two documents, as the walk read them — not yet validated. */
export interface CatalogueItem {
  readonly id: string;
  readonly item: unknown;
  readonly theme: unknown;
}

const USAGE =
  "usage: vigilia-dashboard --build-catalogue-index <catalogueDir> --out <file> --generated-at <ISO>";

/**
 * The pure half: both documents validated, unreadable items excluded, entries
 * sorted by id so a regeneration that changed nothing writes identical bytes.
 * The command reports which items this dropped and why.
 */
export function catalogueIndexOf(
  items: readonly CatalogueItem[],
  generatedAt: string,
): CatalogueIndex {
  const entries: CatalogueEntry[] = [];
  for (const item of items) {
    const entry = entryOf(item);
    if (entry !== undefined) entries.push(entry);
  }
  entries.sort((left, right) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
  );
  return { generatedAt, entries };
}

/** One entry, or nothing when the theme or the header cannot make one. */
function entryOf({
  id,
  item,
  theme,
}: CatalogueItem): CatalogueEntry | undefined {
  const validated = validateFabricThemeEnvelope(theme);
  if (!validated.ok || !isObject(item)) return undefined;

  const kind = text(item, "kind");
  const name = text(item, "name");
  const version = text(item, "version");
  const createdAt = text(item, "createdAt");
  const updatedAt = text(item, "updatedAt");
  const downloads = count(item, "downloads");
  const favorites = count(item, "favorites");
  const packageUrl = text(item, "packageUrl");
  const thumbnail = text(item, "thumbnail");

  if (
    kind === undefined ||
    name === undefined ||
    version === undefined ||
    createdAt === undefined ||
    updatedAt === undefined ||
    downloads === undefined ||
    favorites === undefined ||
    packageUrl === undefined ||
    thumbnail === undefined
  ) {
    return undefined;
  }

  return {
    id,
    kind,
    name,
    version,
    createdAt,
    updatedAt,
    downloads,
    favorites,
    packageUrl,
    thumbnail,
    facets: facetRecordOf(validated.envelope),
  };
}

/**
 * `undefined` for every command line that is not this one, so `run` falls
 * through to its own parser untouched.
 */
export async function buildCatalogueIndexCommand(
  argv: readonly string[],
): Promise<number | undefined> {
  if (argv[0] !== "--build-catalogue-index") return undefined;

  let directory: string | undefined;
  let out: string | undefined;
  let generatedAt: string | undefined;

  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--out" || argument === "--generated-at") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        console.error(`${argument} needs a value.\n${USAGE}`);
        return 1;
      }
      if (argument === "--out") out = value;
      else generatedAt = value;
      index += 1;
    } else if (argument?.startsWith("--") === true) {
      console.error(`Unknown option ${argument}.\n${USAGE}`);
      return 1;
    } else if (argument !== undefined && directory === undefined) {
      directory = argument;
    } else {
      console.error(`Unexpected argument ${argument ?? ""}.\n${USAGE}`);
      return 1;
    }
  }

  if (
    directory === undefined ||
    out === undefined ||
    generatedAt === undefined
  ) {
    console.error(
      `--build-catalogue-index needs <catalogueDir>, --out and --generated-at.\n${USAGE}`,
    );
    return 1;
  }

  const names = await itemDirectories(directory);
  if (names === undefined) return 1;

  const items: CatalogueItem[] = [];
  for (const name of names) {
    try {
      const [item, theme] = await Promise.all([
        readJson(path.join(directory, name, "item.json")),
        readJson(path.join(directory, name, "theme.json")),
      ]);
      items.push({ id: name, item, theme });
    } catch (error) {
      console.error(`Refused catalogue/${name}: ${messageOf(error)}`);
    }
  }

  const index = catalogueIndexOf(items, generatedAt);
  const published = new Set(index.entries.map((entry) => entry.id));
  for (const item of items) {
    if (published.has(item.id)) continue;
    console.error(
      `Refused catalogue/${item.id}: ${refusalOf(item.theme, item.item)}`,
    );
  }

  // The reader's own parser checks the generator's output: two producers of one
  // shape agree here or the run fails rather than publishing what the store skips.
  const kinds = [...new Set(index.entries.map((entry) => entry.kind))];
  const checked = parseCatalogueIndex(index, kinds);
  if (
    checked.refused.length > 0 ||
    checked.entries.length !== index.entries.length
  ) {
    console.error(
      "Refused the generated index: the store cannot read it back.",
    );
    return 1;
  }

  await writeFile(out, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  return 0;
}

/** A missing or mistyped directory exits non-zero: writing an empty index over a
 *  typo would publish an empty catalogue. An existing empty one is honest. */
async function itemDirectories(
  directory: string,
): Promise<string[] | undefined> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    console.error(
      `Cannot read the catalogue directory ${directory}: ${messageOf(error)}`,
    );
    return undefined;
  }
}

async function readJson(file: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    throw new Error(`${path.basename(file)}: ${messageOf(error)}`);
  }
}

/** Why the pure half dropped this item, resolved only for the items it dropped. */
function refusalOf(theme: unknown, item: unknown): string {
  const validated = validateFabricThemeEnvelope(theme);
  if (validated.ok) {
    return isObject(item)
      ? "item.json does not declare the fields an entry needs."
      : "item.json is not an object.";
  }
  const issue = validated.issues[0];
  return issue === undefined
    ? "theme.json is not a theme this build can read."
    : `${issue.path === "" ? "/" : issue.path} ${issue.message}`;
}

function text(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = field(record, key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** A count; `-1` and `NaN` are not counts and must not become zero. */
function count(
  record: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = field(record, key);
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

/** A field's own value, never an inherited one. */
function field(record: Record<string, unknown>, key: string): unknown {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
