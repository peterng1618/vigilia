import type { FacetRecord } from "./facet-record.js";

/**
 * The catalogue listing's wire shape, owned once.
 *
 * One static `index.json` is the whole listing. The GitHub Action that writes it
 * and the editor that reads it are two producers of one fact, so the shape lives
 * in the layer both can import and stays free of Fabric and the DOM. Nothing here
 * fetches: the reader hands in a parsed document.
 */

/** The one kind v1 exchanges, and the value it is identified by on the wire
 *  (spec, "The three kinds"). What it is *called* is `uiCopy.store.cell.kinds`. */
export const DASHBOARD_THEME_KIND = "dashboard-theme";

export interface CatalogueEntry {
  /** The catalogue's own id for the item, not a library id. */
  readonly id: string;
  /** The wire identifier, e.g. `"dashboard-theme"`. */
  readonly kind: string;
  readonly name: string;
  readonly version: string;
  /** An ISO instant. */
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly downloads: number;
  readonly favorites: number;
  /** The browser download URL, as `item.json` records it. Not parsed here. */
  readonly packageUrl: string;
  /** A path inside the repo, joined with the CDN base by the reader. */
  readonly thumbnail: string;
  /** Derived by the producer from the envelope. Checked as a record and never
   *  re-derived: deriving it again would be a second owner of one fact. */
  readonly facets: FacetRecord;
}

export interface CatalogueIndex {
  readonly generatedAt: string;
  readonly entries: readonly CatalogueEntry[];
}

/**
 * The authored header of one `catalogue/<id>/item.json`.
 *
 * It has no `author` — that is a facet the producer derives from `theme.json`'s
 * metadata — and no `id`, which is the catalogue directory's name. The generator
 * reads these fields to build an entry, so a misspelt one is a named refusal
 * rather than an item silently dropped from the listing.
 */
export type CatalogueItemFile = Omit<CatalogueEntry, "id" | "facets">;

export type CatalogueItemFileResult =
  | { readonly ok: true; readonly file: CatalogueItemFile }
  | { readonly ok: false; readonly reason: string };

/**
 * The header, or the first field that is not what it declares.
 *
 * This is the input half of the generator's contract: the names here are the
 * ones the uploader must write, and a typo names itself instead of publishing an
 * index with the item quietly missing.
 */
export function parseCatalogueItemFile(
  value: unknown,
): CatalogueItemFileResult {
  if (!isObject(value)) {
    return { ok: false, reason: "item.json must be a JSON object." };
  }

  const kind = stringField(value, "kind");
  if (kind === undefined) return refusedText("kind");
  const name = stringField(value, "name");
  if (name === undefined) return refusedText("name");
  const version = stringField(value, "version");
  if (version === undefined) return refusedText("version");
  const createdAt = stringField(value, "createdAt");
  if (createdAt === undefined) return refusedText("createdAt");
  const updatedAt = stringField(value, "updatedAt");
  if (updatedAt === undefined) return refusedText("updatedAt");
  const downloads = countField(value, "downloads");
  if (downloads === undefined) return refusedCount("downloads");
  const favorites = countField(value, "favorites");
  if (favorites === undefined) return refusedCount("favorites");
  const packageUrl = stringField(value, "packageUrl");
  if (packageUrl === undefined) return refusedText("packageUrl");
  const thumbnail = stringField(value, "thumbnail");
  if (thumbnail === undefined) return refusedText("thumbnail");

  return {
    ok: true,
    file: {
      kind,
      name,
      version,
      createdAt,
      updatedAt,
      downloads,
      favorites,
      packageUrl,
      thumbnail,
    },
  };
}

function refusedText(field: string): CatalogueItemFileResult {
  return {
    ok: false,
    reason: `item.json's "${field}" must be a non-empty string.`,
  };
}

function refusedCount(field: string): CatalogueItemFileResult {
  return {
    ok: false,
    reason: `item.json's "${field}" must be a count of zero or more.`,
  };
}

export interface CatalogueRefusal {
  /** The identifier the entry declared, or `undefined` for an entry that is not
   *  the shape at all and therefore declares nothing readable. Required and
   *  possibly absent, as `StoreItem.origin` is. */
  readonly kind: string | undefined;
  readonly reason: "unknown-kind" | "malformed";
  readonly count: number;
}

type Reason = CatalogueRefusal["reason"];

/**
 * The readable entries and one row per refusal, in order of first appearance.
 *
 * The listing is one document about many items, so a client that cannot read an
 * item skips it and says so rather than failing the listing — but the two
 * refusals are different facts: an entry of a kind this build does not ship is
 * named by its identifier, while an entry that is not the shape has none to name.
 * A document that is not the shape is one row, counted in the entries it dropped
 * rather than per entry it claimed: the sentence the surface prints is about
 * items.
 */
export function parseCatalogueIndex(
  value: unknown,
  knownKinds: readonly string[],
): {
  readonly entries: readonly CatalogueEntry[];
  readonly refused: readonly CatalogueRefusal[];
} {
  if (!isObject(value)) return refusedDocument(1);

  const generatedAt = stringField(value, "generatedAt");
  const raw = field(value, "entries");
  if (generatedAt === undefined || !Array.isArray(raw)) {
    return refusedDocument(Array.isArray(raw) ? raw.length : 1);
  }

  const entries: CatalogueEntry[] = [];
  // A Map, so a repeat lands on the row it made: insertion order is the order of
  // first appearance, which is the answer the caller prints.
  const rows = new Map<
    string,
    { kind: string | undefined; reason: Reason; count: number }
  >();

  const refuse = (kind: string | undefined, reason: Reason): void => {
    const key = JSON.stringify([reason, kind ?? null]);
    const row = rows.get(key);
    if (row === undefined) rows.set(key, { kind, reason, count: 1 });
    else row.count += 1;
  };

  for (const item of raw) {
    // The declared identifier is read before the shape is judged, because a
    // malformed entry is still named by its kind: a kind is not what makes an
    // entry unreadable.
    const declared = isObject(item) ? stringField(item, "kind") : undefined;
    const entry = asEntry(item);

    if (entry === undefined) refuse(declared, "malformed");
    else if (!knownKinds.includes(entry.kind))
      refuse(entry.kind, "unknown-kind");
    else entries.push(entry);
  }

  return { entries, refused: [...rows.values()] };
}

/** A document nothing can be read from, counted in the entries it dropped: a bad
 *  `generatedAt` over three items is three unreadable items, not one. A document
 *  with no list to count counts one, and an empty list counts zero because it
 *  dropped nothing. */
function refusedDocument(count: number): {
  readonly entries: readonly CatalogueEntry[];
  readonly refused: readonly CatalogueRefusal[];
} {
  return {
    entries: [],
    refused: [{ kind: undefined, reason: "malformed", count }],
  };
}

/** One entry, or nothing when any field is not what it declares. */
function asEntry(value: unknown): CatalogueEntry | undefined {
  if (!isObject(value)) return undefined;

  const id = stringField(value, "id");
  const kind = stringField(value, "kind");
  const name = stringField(value, "name");
  const version = stringField(value, "version");
  const createdAt = stringField(value, "createdAt");
  const updatedAt = stringField(value, "updatedAt");
  const downloads = countField(value, "downloads");
  const favorites = countField(value, "favorites");
  const packageUrl = stringField(value, "packageUrl");
  const thumbnail = stringField(value, "thumbnail");
  const facets = facetsOf(value);

  if (
    id === undefined ||
    kind === undefined ||
    name === undefined ||
    version === undefined ||
    createdAt === undefined ||
    updatedAt === undefined ||
    downloads === undefined ||
    favorites === undefined ||
    packageUrl === undefined ||
    thumbnail === undefined ||
    facets === undefined
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
    facets,
  };
}

/**
 * The producer's derived record, handed on as it was written.
 *
 * Shallow is the *check*, not the depth of the record: `FacetRecord` has eight
 * required fields, and a gallery that reads `tags` off a record missing it dies
 * outside this refusal mechanism, so the fields every reader touches are held
 * for presence and kind. Nothing is derived or recomputed — `facetRecordOf` here
 * would be a second owner of one fact — and the values stay the producer's.
 */
function facetsOf(entry: Record<string, unknown>): FacetRecord | undefined {
  const value = field(entry, "facets");
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const facets = value as Record<string, unknown>;
  const author = field(facets, "author");
  const sensors = field(facets, "sensors");
  const tags = field(facets, "tags");
  const complete =
    (author === undefined || typeof author === "string") &&
    typeof field(facets, "colourMode") === "string" &&
    typeof field(facets, "orientation") === "string" &&
    typeof field(facets, "aspect") === "string" &&
    Array.isArray(sensors) &&
    sensors.every(isSensor) &&
    Array.isArray(tags) &&
    tags.every((tag) => typeof tag === "string") &&
    isDimension(field(facets, "width")) &&
    isDimension(field(facets, "height"));

  return complete ? (value as FacetRecord) : undefined;
}

/** One sensor a reader iterates for its `family`, `key` and `label`: an object
    holding the two strings, with a `family` that is absent or a string. */
function isSensor(value: unknown): boolean {
  if (!isObject(value)) return false;
  const family = field(value, "family");
  return (
    typeof field(value, "key") === "string" &&
    typeof field(value, "label") === "string" &&
    (family === undefined || typeof family === "string")
  );
}

/** An artboard size: zero and `NaN` are not dimensions. */
function isDimension(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** A field's own value, never an inherited one: a `__proto__` key in the document
    is data, the habit `theme-origins.ts` follows. */
function field(record: Record<string, unknown>, key: string): unknown {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

/** A required, non-empty string, or nothing. `packageUrl` and `thumbnail` are
    type-checked only: neither is parsed or resolved here. */
function stringField(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = field(record, key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** A count, or nothing. `-1` and `NaN` are not counts, and coercing either to
    zero would report a count the document never declared. */
function countField(
  record: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = field(record, key);
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
