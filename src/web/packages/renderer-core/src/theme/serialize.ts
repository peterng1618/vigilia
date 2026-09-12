import type { ThemeDocument } from './document.js';

/**
 * Canonical serialisation of a theme document (§139).
 *
 * ## Why canonical, and not just `JSON.stringify`
 *
 * `JSON.stringify` preserves whatever key order the object happened to have, so
 * the same document saved twice — once loaded from disk, once built by the
 * editor — produces different bytes. Three things depend on that not happening:
 *
 * - **"Save marks history clean without clearing it"** (§139) needs a stable
 *   representation to compare against. Comparing objects by identity would mark
 *   a document dirty after a no-op edit.
 * - A theme in version control should diff by what changed, not by key order.
 * - The round-trip test can assert bytes rather than deep equality, which is a
 *   stricter and much simpler check.
 *
 * ## Ordering rule
 *
 * Known keys first, in the order the schema declares them — so a saved file
 * reads top-down like the format is documented — then everything else
 * alphabetically. Unknown keys are kept rather than dropped: this function is
 * not a filter, and silently discarding a field a newer build wrote would turn
 * a forward-compatible document into a lossy one.
 */

/**
 * Key order for the shapes the format declares.
 *
 * One flat list rather than per-shape lists, which is simpler to keep aligned
 * with the schema — but it comes with a constraint worth knowing before adding
 * to it. Several names appear in more than one shape (`name`, `id`, `type`,
 * `value`, `color`), so each gets **one** position that must read correctly
 * everywhere it occurs. `name` was originally placed with the metadata keys,
 * which put it before `type` on every node; a test caught it. When adding a
 * shared key, check each shape that uses it.
 */
const KEY_ORDER: readonly string[] = [
  // Document
  'schemaVersion',
  'id',
  'metadata',
  'artboard',
  'globals',
  'nodes',
  'assets',
  'editorMetadata',
  // Metadata
  'author',
  'description',
  'createdAt',
  'updatedAt',
  // Node. `name` lives here rather than with the metadata keys below, because
  // this position also has to read correctly on a node: id, type, name.
  'type',
  'name',
  'transform',
  'visible',
  'locked',
  'provenance',
  'style',
  'bindings',
  'content',
  'children',
  // Transform
  'x',
  'y',
  'width',
  'height',
  'rotation',
  'scaleX',
  'scaleY',
  // Binding
  'semanticKey',
  'precision',
  'unitDisplay',
  'scale',
  'offset',
  // Content
  'family',
  'settings',
  'runs',
  'kind',
  'text',
  'bindingId',
  'wrap',
  'overflow',
  'align',
  'verticalAlign',
  'assetId',
  'fit',
  'cornerRadius',
  // Style value
  'ref',
  'value',
  // Fill
  'color',
  'bands',
  'stops',
  // Asset
  'path',
  'sha256',
  'sourceUrl',
  'license',
];

const ORDER_INDEX = new Map(KEY_ORDER.map((key, index) => [key, index]));

/**
 * Serialises a document to canonical JSON with a trailing newline.
 *
 * @param indent Spaces per level. Two by default — the format is meant to be
 *   read and diffed by people. Pass 0 for a compact form.
 */
export function serializeThemeDocument(document: ThemeDocument, indent = 2): string {
  return `${JSON.stringify(canonicalize(document), undefined, indent)}\n`;
}

/**
 * Rebuilds a value with keys in canonical order.
 *
 * Arrays keep their order — in this format array order *is* meaning: node order
 * is paint order (§137), run order is reading order, and slice order is the
 * composition's reading order. Sorting one would change the document.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (typeof value !== 'object' || value === null) {
    return value;
  }

  const source = value as Record<string, unknown>;
  const keys = Object.keys(source).sort(compareKeys);
  const result: Record<string, unknown> = {};

  for (const key of keys) {
    const entry = source[key];

    // An absent key and a key set to undefined are different types under
    // `exactOptionalPropertyTypes` but identical in JSON — JSON.stringify drops
    // the latter. Dropping it here too keeps the output stable regardless of
    // which one the caller built.
    if (entry === undefined) {
      continue;
    }

    result[key] = canonicalize(entry);
  }

  return result;
}

function compareKeys(a: string, b: string): number {
  const indexA = ORDER_INDEX.get(a);
  const indexB = ORDER_INDEX.get(b);

  if (indexA !== undefined && indexB !== undefined) {
    return indexA - indexB;
  }

  // Known keys before unknown ones, so a field from a newer build appends
  // rather than interleaving with the documented shape.
  if (indexA !== undefined) {
    return -1;
  }
  if (indexB !== undefined) {
    return 1;
  }

  return a < b ? -1 : a > b ? 1 : 0;
}
