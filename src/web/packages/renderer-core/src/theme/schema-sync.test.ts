import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { knownKeysFor, type KnownKeyShape } from './validate.js';
import {
  ASSET_PATH_PATTERN,
  CHART_FAMILIES,
  GLOBAL_GROUPS,
  MAX_ARTBOARD_DIMENSION,
  NODE_TYPES,
  STABLE_ID_PATTERN,
} from './document.js';

/**
 * Guards the hand-written validator against the published JSON Schema.
 *
 * `schema/theme-document.schema.json` is the contract; `document.ts` and
 * `validate.ts` are the implementation. Nothing mechanically ties them together,
 * so this reads the schema off disk and asserts the shared constants agree.
 *
 * This is the same class of risk as `Vigilia.Contracts` ↔ `types.ts` — a drift
 * compiles cleanly on both sides and produces wrong behaviour at runtime. The
 * difference is that this one fails a test. The C# mirror has no equivalent
 * guard yet; this file is the pattern to copy for it.
 *
 * Reading the file rather than importing it is deliberate: `renderer-core` sets
 * `rootDir: src`, so an import from outside `src/` would break the build, and
 * the player has no reason to ship the schema.
 */

// fileURLToPath, not URL.pathname: on Windows the latter yields "/D:/..." and
// every fs call then fails to resolve it.
const SCHEMA_PATH = fileURLToPath(
  new URL('../../../../../../schema/theme-document.schema.json', import.meta.url),
);

interface SchemaShape {
  readonly $defs: Record<string, Record<string, unknown>>;
  readonly properties: Record<string, Record<string, unknown>>;
}

function loadSchema(): SchemaShape {
  return JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')) as SchemaShape;
}

/**
 * A regex's source with slash escapes undone.
 *
 * `RegExp.prototype.source` always escapes `/` so the result can be pasted into
 * a literal, while JSON Schema patterns carry a bare slash. The two are the same
 * expression; only the quoting differs.
 */
function patternSource(pattern: RegExp): string {
  return pattern.source.replace(/\\\//g, '/');
}

function definition(name: string): Record<string, unknown> {
  const schema = loadSchema();
  const found = schema.$defs[name];

  if (found === undefined) {
    throw new Error(`The schema has no $defs/${name}. It was renamed or removed.`);
  }

  return found;
}

describe('theme schema is in sync with the validator', () => {
  it('resolves the schema file at all', () => {
    // A silently unresolvable path would make every assertion below vacuous.
    expect(loadSchema().$defs).toBeTypeOf('object');
  });

  it('agrees on the stable-id pattern', () => {
    expect(definition('stableId')['pattern']).toBe(patternSource(STABLE_ID_PATTERN));
  });

  it('agrees on the asset-path pattern', () => {
    const path = definition('assetReference')['properties'] as Record<string, Record<string, unknown>>;
    expect(path['path']!['pattern']).toBe(patternSource(ASSET_PATH_PATTERN));
  });

  it('has an asset-path pattern that does NOT block traversal on its own', () => {
    // Pinning the weakness so nobody "simplifies" the validator's `..` check
    // away on the belief that the pattern already covers it. If this ever
    // starts failing, the pattern got stricter and that check may be redundant.
    const source = String(
      (definition('assetReference')['properties'] as Record<string, Record<string, unknown>>)['path']![
        'pattern'
      ],
    );

    expect(new RegExp(source).test('assets/../../secrets.env')).toBe(true);
  });

  it('agrees on the maximum artboard dimension', () => {
    const properties = definition('artboard')['properties'] as Record<string, Record<string, unknown>>;
    expect(properties['width']!['maximum']).toBe(MAX_ARTBOARD_DIMENSION);
    expect(properties['height']!['maximum']).toBe(MAX_ARTBOARD_DIMENSION);
  });

  it('agrees on the node types', () => {
    const properties = definition('node')['properties'] as Record<string, Record<string, unknown>>;
    expect(properties['type']!['enum']).toEqual([...NODE_TYPES]);
  });

  it('agrees on the chart families', () => {
    const properties = definition('chartContent')['properties'] as Record<string, Record<string, unknown>>;
    expect(properties['family']!['enum']).toEqual([...CHART_FAMILIES]);
  });

  it('agrees on the global groups', () => {
    const globals = loadSchema().properties['globals'] as Record<string, unknown>;
    const properties = globals['properties'] as Record<string, unknown>;
    expect(Object.keys(properties)).toEqual([...GLOBAL_GROUPS]);
  });

  it('agrees that a global reference names one of those groups', () => {
    // The pattern embeds the group list a second time, so it drifts
    // independently of the `globals` properties above.
    const oneOf = definition('styleValue')['oneOf'] as Record<string, unknown>[];
    const refBranch = oneOf[0]!['properties'] as Record<string, Record<string, unknown>>;
    const pattern = String(refBranch['ref']!['pattern']);

    for (const group of GLOBAL_GROUPS) {
      expect(pattern).toContain(group);
    }
  });

  it('agrees on the binding precision bounds', () => {
    const properties = definition('binding')['properties'] as Record<string, Record<string, unknown>>;
    expect(properties['precision']!['minimum']).toBe(0);
    expect(properties['precision']!['maximum']).toBe(6);
  });

  it('still requires a binding to carry a stable id', () => {
    // Text runs reference bindings by id, so dropping it from the required list
    // would make those references unresolvable.
    expect(definition('binding')['required']).toContain('id');
  });

  it('declares a settings definition for every chart family', () => {
    for (const family of CHART_FAMILIES) {
      expect(() => definition(`${family}Settings`)).not.toThrow();
    }
  });
});

describe('the validator knows exactly the keys the schema declares', () => {
  /**
   * The unknown-field check is only as good as its key lists. A field added to
   * the schema but not to `KNOWN_KEYS` would be rejected as a typo — the worst
   * possible failure, because the document is correct and the error blames the
   * author. These assertions make that impossible to ship.
   */
  function schemaKeys(definition: string): string[] {
    const properties = definition === 'document'
      ? loadSchema().properties
      : (definitionOf(definition)['properties'] as Record<string, unknown>);

    return Object.keys(properties).sort();
  }

  function definitionOf(name: string): Record<string, unknown> {
    return definition(name);
  }

  const shapes: [KnownKeyShape, string][] = [
    ['document', 'document'],
    ['artboard', 'artboard'],
    ['transform', 'transform'],
    ['node', 'node'],
    ['binding', 'binding'],
    ['textContent', 'textContent'],
    ['chartContent', 'chartContent'],
    ['rectangleContent', 'rectangleContent'],
    ['imageContent', 'imageContent'],
    ['videoContent', 'videoContent'],
    ['assetReference', 'assetReference'],
    ['widgetProvenance', 'widgetProvenance'],
    ['gaugeSettings', 'gaugeSettings'],
    ['lineSettings', 'lineSettings'],
    ['barSettings', 'barSettings'],
    ['pieSettings', 'pieSettings'],
  ];

  it.each(shapes)('%s', (shape, definitionName) => {
    expect([...knownKeysFor(shape)].sort()).toEqual(schemaKeys(definitionName));
  });

  it('covers the document metadata shape', () => {
    const metadata = loadSchema().properties['metadata'] as Record<string, unknown>;
    const properties = metadata['properties'] as Record<string, unknown>;

    expect([...knownKeysFor('metadata')].sort()).toEqual(Object.keys(properties).sort());
  });

  it('covers both text run variants', () => {
    const branches = definition('textRun')['oneOf'] as Record<string, unknown>[];
    const literal = Object.keys(branches[0]!['properties'] as Record<string, unknown>).sort();
    const value = Object.keys(branches[1]!['properties'] as Record<string, unknown>).sort();

    expect([...knownKeysFor('literalRun')].sort()).toEqual(literal);
    expect([...knownKeysFor('valueRun')].sort()).toEqual(value);
  });

  it('covers a global entry', () => {
    const entry = definition('globalGroup')['additionalProperties'] as Record<string, unknown>;
    const properties = entry['properties'] as Record<string, unknown>;

    expect([...knownKeysFor('globalEntry')].sort()).toEqual(Object.keys(properties).sort());
  });
});
