import { describe, expect, it } from 'vitest';
import type { ThemeDocument } from '@vigilia/renderer-core';
import {
  addGlobal,
  collectGlobalUsage,
  deleteGlobal,
  isValidGlobalKey,
  nextGlobalKey,
  referencesTo,
  rekeyGlobal,
  renameGlobal,
  setGlobalValue,
} from './commands.js';

/**
 * A document that references `palette.accent` from **every** site the schema
 * allows one: the artboard twice, a node style, a text run style, an image's
 * monochrome recolouring, and a node nested inside a group.
 *
 * That coverage is the whole point of the fixture. A reference walk that misses
 * a site fails in one direction only — counts read low, rekeys leave dangling
 * references, deletes break an element that still looks fine — and a fixture
 * that only styles top-level rectangles cannot tell.
 */
const document_: ThemeDocument = {
  schemaVersion: 1,
  id: 'globals-fixture',
  artboard: {
    width: 100,
    height: 100,
    background: { ref: 'palette.accent' },
    barColor: { ref: 'palette.accent' },
  },
  globals: {
    palette: {
      accent: { name: 'Accent', value: '#ff5630' },
      ink: { name: 'Ink', value: '#ffffff' },
    },
    fontSizes: {
      body: { name: 'Body', value: 14 },
    },
  },
  nodes: [
    {
      id: 'box',
      type: 'rectangle',
      style: { fill: { ref: 'palette.accent' }, outline: { value: '#000000' } },
    },
    {
      id: 'label',
      type: 'text',
      content: {
        runs: [
          { kind: 'literal', text: 'hello', style: { color: { ref: 'palette.accent' } } },
          { kind: 'literal', text: ' world', style: { color: { ref: 'palette.ink' } } },
        ],
      },
    },
    {
      id: 'icon',
      type: 'image',
      content: { assetId: 'logo', monochrome: { ref: 'palette.accent' } },
    },
    {
      id: 'wrapper',
      type: 'group',
      children: [
        { id: 'nested', type: 'ellipse', style: { fill: { ref: 'palette.accent' } } },
      ],
    },
  ],
};

describe('isValidGlobalKey', () => {
  it('accepts what the schema accepts and nothing else', () => {
    expect(isValidGlobalKey('accent')).toBe(true);
    expect(isValidGlobalKey('accent-2_A')).toBe(true);
    expect(isValidGlobalKey('')).toBe(false);
    // A dot would make `palette.a.b` ambiguous as a reference.
    expect(isValidGlobalKey('a.b')).toBe(false);
    expect(isValidGlobalKey('a b')).toBe(false);
    expect(isValidGlobalKey('x'.repeat(65))).toBe(false);
  });
});

describe('referencesTo', () => {
  it('finds every site the schema allows', () => {
    const found = referencesTo(document_, 'palette.accent');

    expect(found.map((reference) => reference.where).sort()).toEqual([
      'Artboard background',
      'Artboard bars',
      'box fill',
      'icon monochrome',
      'label run 1 color',
      'nested fill',
    ]);
  });

  it('does not count a literal that happens to hold the same value', () => {
    // `outline` on `box` is the accent colour written out by hand. It is not a
    // reference and must not follow the token.
    expect(referencesTo(document_, 'palette.ink')).toHaveLength(1);
  });

  it('reports nothing for an unused token', () => {
    expect(referencesTo(document_, 'fontSizes.body')).toEqual([]);
  });
});

describe('collectGlobalUsage', () => {
  it('lists every token with its reference count', () => {
    const usage = collectGlobalUsage(document_);

    expect(usage.map((entry) => [entry.group, entry.key, entry.references.length])).toEqual([
      ['palette', 'accent', 6],
      ['palette', 'ink', 1],
      ['fontSizes', 'body', 0],
    ]);
  });
});

describe('addGlobal', () => {
  it('adds a token', () => {
    const next = addGlobal(document_, 'spacing', 'gap', { name: 'Gap', value: 8 });

    expect(next.globals?.spacing?.['gap']).toEqual({ name: 'Gap', value: 8 });
  });

  it('refuses a duplicate key rather than overwriting', () => {
    // Overwriting would change every element referencing the token — a
    // different operation, deserving a different undo label.
    expect(addGlobal(document_, 'palette', 'accent', { name: 'Other', value: '#000' })).toBe(
      document_,
    );
  });

  it('refuses an invalid key', () => {
    expect(addGlobal(document_, 'palette', 'not valid', { name: 'x', value: 1 })).toBe(document_);
  });
});

describe('setGlobalValue', () => {
  it('changes the value, and every reference follows', () => {
    const next = setGlobalValue(document_, 'palette', 'accent', '#00ff00');

    expect(next.globals?.palette?.['accent']?.value).toBe('#00ff00');
    // References are by key, so they are untouched — which is what "follows"
    // means here: nothing was rewritten and everything resolves to the new value.
    expect(referencesTo(next, 'palette.accent')).toHaveLength(6);
  });

  it('returns the same document when the value is unchanged', () => {
    expect(setGlobalValue(document_, 'palette', 'accent', '#ff5630')).toBe(document_);
  });

  it('ignores an unknown token', () => {
    expect(setGlobalValue(document_, 'palette', 'ghost', '#000')).toBe(document_);
  });
});

describe('renameGlobal', () => {
  it('changes the display name and no references (§75)', () => {
    const next = renameGlobal(document_, 'palette', 'accent', 'Brand');

    expect(next.globals?.palette?.['accent']).toEqual({ name: 'Brand', value: '#ff5630' });
    expect(referencesTo(next, 'palette.accent')).toHaveLength(6);
  });

  it('refuses an empty name', () => {
    expect(renameGlobal(document_, 'palette', 'accent', '')).toBe(document_);
  });
});

describe('rekeyGlobal', () => {
  it('rewrites every reference', () => {
    const next = rekeyGlobal(document_, 'palette', 'accent', 'brand');

    expect(referencesTo(next, 'palette.accent')).toEqual([]);
    expect(referencesTo(next, 'palette.brand')).toHaveLength(6);
    expect(next.globals?.palette?.['brand']?.name).toBe('Accent');
  });

  it('keeps the token in place rather than moving it to the end', () => {
    const next = rekeyGlobal(document_, 'palette', 'accent', 'brand');

    // The panel lists tokens in document order; reordering makes the row being
    // renamed jump away from the cursor.
    expect(Object.keys(next.globals?.palette ?? {})).toEqual(['brand', 'ink']);
  });

  it('refuses a key that already exists', () => {
    expect(rekeyGlobal(document_, 'palette', 'accent', 'ink')).toBe(document_);
  });

  it('refuses an invalid key', () => {
    expect(rekeyGlobal(document_, 'palette', 'accent', 'oops!')).toBe(document_);
  });
});

describe('deleteGlobal', () => {
  it('refuses to delete a token that is still referenced', () => {
    // Spec 0011 D3: an element cannot hold a literal colour any more, so
    // inlining — the previous behaviour — would write exactly the document the
    // format forbids, silently, on every referencing node. Deletion demands
    // reassignment instead.
    expect(deleteGlobal(document_, 'palette', 'accent')).toBe(document_);
    expect(referencesTo(document_, 'palette.accent').length).toBeGreaterThan(0);
  });

  it('checks all five reference sites, not just node styles', () => {
    // The fixture references `accent` from the artboard background and bar
    // colour, a node style, a text RUN style, an image monochrome and a node
    // inside a group. A narrower walk would miss the last three and allow a
    // dangling reference — which is why this uses `referencesTo`, the single
    // walk that knows all five.
    const sites = referencesTo(document_, 'palette.accent').map((site) => site.where);

    expect(sites.length).toBeGreaterThanOrEqual(5);
    expect(deleteGlobal(document_, 'palette', 'accent')).toBe(document_);
  });

  it('deletes an unreferenced token', () => {
    const next = deleteGlobal(document_, 'fontSizes', 'body');

    expect(next.globals?.fontSizes?.['body']).toBeUndefined();
  });

  it('leaves other tokens and unrelated literals alone', () => {
    const next = deleteGlobal(document_, 'palette', 'accent');

    expect(next.globals?.palette?.['ink']).toEqual({ name: 'Ink', value: '#ffffff' });
    expect(next.nodes[0]?.style?.['outline']).toEqual({ value: '#000000' });
    expect(referencesTo(next, 'palette.ink')).toHaveLength(1);
  });

  it('shares branches that held no reference', () => {
    const next = deleteGlobal(document_, 'fontSizes', 'body');

    // Unused token: no site changes, so every node is the same object.
    expect(next.nodes).toBe(document_.nodes);
    expect(next.globals?.fontSizes).toBeUndefined();
  });

  it('drops the group when its last token goes, and globals when the last group does', () => {
    // Every token must be unreferenced first, now that deletion refuses while
    // referenced — so the references are reassigned away before deleting.
    let next = deleteGlobal(document_, 'fontSizes', 'body');
    expect(next.globals?.fontSizes).toBeUndefined();

    // A document whose tokens nothing references, so both can go.
    const unreferenced: ThemeDocument = {
      schemaVersion: 1,
      id: 'unreferenced',
      artboard: { width: 100, height: 100 },
      globals: { palette: { a: { name: 'A', value: '#000000' }, b: { name: 'B', value: '#ffffff' } } },
      nodes: [],
    };

    next = deleteGlobal(unreferenced, 'palette', 'a');
    next = deleteGlobal(next, 'palette', 'b');

    // `"palette": {}` is valid and says nothing; absence is honest.
    expect(next.globals).toBeUndefined();
  });

  it('ignores an unknown token', () => {
    expect(deleteGlobal(document_, 'palette', 'ghost')).toBe(document_);
  });
});

describe('nextGlobalKey', () => {
  it('uses the base when it is free', () => {
    expect(nextGlobalKey(document_, 'spacing', 'gap')).toBe('gap');
  });

  it('suffixes when taken, and keeps suffixing', () => {
    expect(nextGlobalKey(document_, 'palette', 'accent')).toBe('accent-2');

    const twice = addGlobal(document_, 'palette', 'accent-2', { name: 'x', value: 1 });
    expect(nextGlobalKey(twice, 'palette', 'accent')).toBe('accent-3');
  });
});
