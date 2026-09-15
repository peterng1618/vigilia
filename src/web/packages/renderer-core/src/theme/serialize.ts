import type { ThemeDocument } from './document.js';

/** Canonical JSON: known keys in schema order, unknown keys alphabetically, arrays untouched. */

/** Shared key names get one position that must read sensibly in every shape. */
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
  // Node
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

/** Serialize canonical JSON with a trailing newline. */
export function serializeThemeDocument(document: ThemeDocument, indent = 2): string {
  return `${JSON.stringify(canonicalize(document), undefined, indent)}\n`;
}

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

    // JSON drops undefined; do so before rebuilding key order as well.
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

  if (indexA !== undefined) {
    return -1;
  }
  if (indexB !== undefined) {
    return 1;
  }

  return a < b ? -1 : a > b ? 1 : 0;
}
