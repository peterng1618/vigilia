import { describe, expect, it } from 'vitest';
import {
  buildScenePlan,
  requiredSemanticKeys,
  serializeThemeDocument,
  validateThemeDocument,
  walkNodes,
  type ThemeDocument,
} from '@vigilia/renderer-core';
import { INVALID_THEMES, VALID_THEMES } from './index.js';
import { FakeSampleSource } from '../index.js';

const T0 = Date.parse('2026-01-01T00:00:00Z');

/**
 * Runs every fixture through the whole pipeline.
 *
 * A single showcase theme only proves the renderer works on the layout it was
 * built against. These cases exist to give a change several different shapes to
 * break — and writing them has already found real defects that the showcase
 * theme could not reach.
 */

function validated(document: unknown, name: string): ThemeDocument {
  const result = validateThemeDocument(document);

  if (!result.ok) {
    throw new Error(
      `Fixture "${name}" should be valid but is not:\n${result.issues
        .map((issue) => `  ${issue.path || '/'} [${issue.code}] ${issue.message}`)
        .join('\n')}`,
    );
  }

  return result.document;
}

describe.each(VALID_THEMES)('valid fixture: $name', ({ name, document, summary }) => {
  it(`validates (${summary})`, () => {
    expect(validated(document, name)).toBeDefined();
  });

  it('round-trips byte-identically through save and load', () => {
    const saved = serializeThemeDocument(validated(document, name));
    const reloaded = validated(JSON.parse(saved), name);

    expect(serializeThemeDocument(reloaded)).toBe(saved);
  });

  it('has unique node ids across the whole tree', () => {
    // The validator enforces this; asserting it here means a fixture cannot be
    // quietly authored with a duplicate that happens to validate because of a
    // future loosening.
    const ids = [...walkNodes(validated(document, name).nodes)].map((entry) => entry.node.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('builds a plan for every node without throwing', () => {
    const theme = validated(document, name);
    const source = new FakeSampleSource(T0);
    const plan = buildScenePlan({ document: theme, source, nowMs: T0, animate: false });

    const planned = [...flatten(plan.nodes)].length;
    const declared = [...walkNodes(theme.nodes)].length;

    expect(planned).toBe(declared);
  });

  it('resolves every global reference it uses', () => {
    // An unresolved global silently drops a colour. A fixture with one would
    // make every screenshot of it misleading.
    const theme = validated(document, name);
    const plan = buildScenePlan({
      document: theme,
      source: new FakeSampleSource(T0),
      nowMs: T0,
      animate: false,
    });

    expect(plan.issues.filter((issue) => issue.code === 'unresolved-global')).toEqual([]);
  });

  it('declares at least one semantic key', () => {
    expect(requiredSemanticKeys(validated(document, name)).length).toBeGreaterThan(0);
  });

  it('stays deterministic at a fixed instant', () => {
    const theme = validated(document, name);
    const planAt = () =>
      JSON.stringify(
        buildScenePlan({
          document: theme,
          source: new FakeSampleSource(T0 + 7000),
          nowMs: T0 + 7000,
          animate: false,
        }),
      );

    expect(planAt()).toBe(planAt());
  });

  it('never renders a fabricated number for a sample it does not have', () => {
    // §97, across every fixture: a text segment carrying a status must show the
    // placeholder, never a value.
    const theme = validated(document, name);
    const plan = buildScenePlan({
      document: theme,
      source: new FakeSampleSource(T0, { forcedStatus: { 'cpu.load': 'error' } }),
      nowMs: T0,
      animate: false,
    });

    for (const node of flatten(plan.nodes)) {
      if (node.content.kind !== 'text') {
        continue;
      }
      for (const segment of node.content.segments) {
        if (segment.status !== undefined) {
          expect(segment.text).toBe('—');
        }
      }
    }
  });
});

describe.each(INVALID_THEMES)('invalid fixture: $name', ({ name, document, expect: expected, only }) => {
  it('fails validation', () => {
    expect(validateThemeDocument(document).ok, `fixture "${name}" unexpectedly validated`).toBe(
      false,
    );
  });

  it(`reports ${expected.join(', ')}`, () => {
    const result = validateThemeDocument(document);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    const codes = new Set(result.issues.map((issue) => issue.code));

    for (const code of expected) {
      expect([...codes], `fixture "${name}" should report ${code}`).toContain(code);
    }

    if (only === true) {
      expect([...codes]).toEqual([...expected]);
    }
  });

  it('gives every issue a JSON pointer', () => {
    const result = validateThemeDocument(document);

    if (!result.ok) {
      for (const issue of result.issues) {
        // The empty string is the document root, which is a valid pointer.
        expect(issue.path === '' || issue.path.startsWith('/')).toBe(true);
        expect(issue.message.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('the fixture set', () => {
  it('covers both fit modes', () => {
    // §53 and §55 are different code paths. A set that only used `contain`
    // would leave cover untested no matter how many themes it had.
    const modes = new Set(
      VALID_THEMES.map((fixture) => validated(fixture.document, fixture.name).artboard.fitMode ?? 'contain'),
    );

    expect([...modes].sort()).toEqual(['contain', 'cover']);
  });

  it('covers portrait and landscape artboards', () => {
    const shapes = new Set(
      VALID_THEMES.map((fixture) => {
        const { width, height } = validated(fixture.document, fixture.name).artboard;
        return width > height ? 'landscape' : 'portrait';
      }),
    );

    expect([...shapes].sort()).toEqual(['landscape', 'portrait']);
  });

  it('covers every chart family and every node type it claims to', () => {
    const families = new Set<string>();
    const types = new Set<string>();

    for (const fixture of VALID_THEMES) {
      for (const { node } of walkNodes(validated(fixture.document, fixture.name).nodes)) {
        types.add(node.type);
        if (node.type === 'chart') {
          families.add(node.content.family);
        }
      }
    }

    expect([...families].sort()).toEqual(['bar', 'gauge', 'line', 'pie']);
    // image and video are absent on purpose: nothing resolves an asset ID to a
    // URL yet, so a fixture using them could not render.
    expect([...types].sort()).toEqual(['chart', 'ellipse', 'group', 'line', 'rectangle', 'text']);
  });

  it('has a distinct id per fixture', () => {
    const ids = VALID_THEMES.map((fixture) => validated(fixture.document, fixture.name).id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

/** Depth-first flatten of planned nodes. */
function* flatten(
  nodes: ReturnType<typeof buildScenePlan>['nodes'],
): Generator<ReturnType<typeof buildScenePlan>['nodes'][number]> {
  for (const node of nodes) {
    yield node;
    yield* flatten(node.children);
  }
}
