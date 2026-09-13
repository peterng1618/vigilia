import { describe, expect, it } from 'vitest';
import { describeSelection, globalOptions } from './inspector-model.js';
import { applyFieldChange, labelForField } from './inspector-apply.js';
import { findNode } from './commands.js';
import { validateThemeDocument } from '@vigilia/renderer-core';
import type { ThemeDocument, ThemeNode } from '@vigilia/renderer-core';

const globals = {
  palette: {
    accent: { name: 'Accent', value: '#00b8d9' },
    ink: { name: 'Ink', value: '#ffffff' },
  },
  fontSizes: {
    body: { name: 'Body', value: 14 },
  },
};

function document_(nodes: readonly ThemeNode[]): ThemeDocument {
  return {
    schemaVersion: 1,
    id: 'doc',
    artboard: { width: 800, height: 600 },
    globals,
    nodes,
  };
}

const rect = (id: string, extra: Partial<ThemeNode> = {}): ThemeNode =>
  ({
    id,
    type: 'rectangle',
    transform: { x: 10, y: 20, width: 100, height: 50 },
    ...extra,
  }) as ThemeNode;

const textNode = (id: string, extra: Partial<ThemeNode> = {}): ThemeNode =>
  ({
    id,
    type: 'text',
    transform: { x: 0, y: 0, width: 100, height: 20 },
    content: { runs: [{ kind: 'literal', text: 'hi' }] },
    ...extra,
  }) as ThemeNode;

/** Finds a field by key across all sections. */
function field(sections: ReturnType<typeof describeSelection>, key: string) {
  return sections.flatMap((section) => section.fields).find((entry) => entry.key === key);
}

describe('describeSelection', () => {
  it('returns nothing for an empty selection', () => {
    // A panel full of disabled fields is noise; "nothing selected" is clearer.
    expect(describeSelection(document_([rect('a')]), [])).toEqual([]);
  });

  it('shows the id and type as read-only', () => {
    // §75: links depend on the id, so renaming is what the name field is for.
    const sections = describeSelection(document_([rect('a')]), ['a']);

    expect(field(sections, 'id')).toMatchObject({ value: 'a', readOnly: true });
    expect(field(sections, 'type')).toMatchObject({ value: 'rectangle', readOnly: true });
  });

  it('reads transform values, defaulting absent ones to zero', () => {
    const sections = describeSelection(document_([rect('a')]), ['a']);

    expect(field(sections, 'transform.x')?.value).toBe(10);
    expect(field(sections, 'transform.rotation')?.value).toBe(0);
  });

  it('hides typography fields on a shape', () => {
    const shape = describeSelection(document_([rect('a')]), ['a']);
    expect(field(shape, 'style.fontSize')).toBeUndefined();
    expect(field(shape, 'style.fill')).toBeDefined();
  });

  it('shows typography fields on text', () => {
    const text = describeSelection(document_([textNode('t')]), ['t']);
    expect(field(text, 'style.fontSize')).toBeDefined();
    expect(field(text, 'style.color')).toBeDefined();
  });
});

describe('§75: a style value is a reference OR a literal, and the row says which', () => {
  it('marks an unset property', () => {
    const sections = describeSelection(document_([rect('a')]), ['a']);

    expect(field(sections, 'style.fill')).toMatchObject({ source: 'unset', value: undefined });
  });

  it('marks a literal', () => {
    const node = rect('a', { style: { fill: { value: '#ff0000' } } });
    const sections = describeSelection(document_([node]), ['a']);

    expect(field(sections, 'style.fill')).toMatchObject({ source: 'literal', value: '#ff0000' });
  });

  it('marks a reference and shows its RESOLVED value', () => {
    // The author needs to see the colour they will get. Showing the ref string
    // alone would send them to the globals panel to find out what it is —
    // while `source: 'ref'` is what tells the row to present it as a token
    // rather than an editable literal.
    const node = rect('a', { style: { fill: { ref: 'palette.accent' } } });
    const sections = describeSelection(document_([node]), ['a']);

    expect(field(sections, 'style.fill')).toMatchObject({
      source: 'ref',
      ref: 'palette.accent',
      value: '#00b8d9',
    });
  });

  it('offers the group a property may reference', () => {
    const sections = describeSelection(document_([textNode('t')]), ['t']);

    expect(field(sections, 'style.fill')?.globalGroup).toBe('palette');
    expect(field(sections, 'style.fontSize')?.globalGroup).toBe('fontSizes');
    // Opacity is a plain number with no token group, so no picker.
    expect(field(sections, 'style.opacity')?.globalGroup).toBeUndefined();
  });

  it('resolves a dangling reference to undefined rather than inventing a value', () => {
    const node = rect('a', { style: { fill: { ref: 'palette.gone' } } });
    const sections = describeSelection(document_([node]), ['a']);

    expect(field(sections, 'style.fill')).toMatchObject({ source: 'ref', value: undefined });
  });

  it('lists globals as picker options', () => {
    expect(globalOptions(globals, 'palette')).toEqual([
      { value: 'palette.accent', label: 'Accent' },
      { value: 'palette.ink', label: 'Ink' },
    ]);
  });
});

describe('multi-selection', () => {
  it('marks a field mixed when the nodes disagree', () => {
    const sections = describeSelection(
      document_([rect('a'), rect('b', { transform: { x: 99, y: 20, width: 100, height: 50 } })]),
      ['a', 'b'],
    );

    expect(field(sections, 'transform.x')).toMatchObject({ mixed: true, value: undefined });
    // y agrees, so it shows a value.
    expect(field(sections, 'transform.y')).toMatchObject({ value: 20 });
  });

  it('distinguishes mixed from unset', () => {
    // Unset means "no value, the default applies"; mixed means "several values,
    // and typing here replaces all of them". Collapsing them would make an edit
    // silently overwrite values the author never saw.
    const mixedDoc = document_([
      rect('a', { style: { fill: { value: '#111' } } }),
      rect('b', { style: { fill: { value: '#222' } } }),
    ]);

    expect(field(describeSelection(mixedDoc, ['a', 'b']), 'style.fill')?.mixed).toBe(true);
    expect(field(describeSelection(document_([rect('a')]), ['a']), 'style.fill')?.mixed).toBeUndefined();
  });

  it('treats a ref and an identical literal as different', () => {
    // They resolve to the same colour and are NOT the same thing: editing one
    // changes a token, the other changes an element.
    const mixedDoc = document_([
      rect('a', { style: { fill: { ref: 'palette.accent' } } }),
      rect('b', { style: { fill: { value: '#00b8d9' } } }),
    ]);

    expect(field(describeSelection(mixedDoc, ['a', 'b']), 'style.fill')?.mixed).toBe(true);
  });

  it('titles the section with the count', () => {
    expect(describeSelection(document_([rect('a'), rect('b')]), ['a', 'b'])[0]?.title).toBe(
      '2 elements',
    );
  });

  it('omits binding sections for a multi-selection', () => {
    // Bindings are identified by document-unique ids, so "the second binding"
    // means nothing across a selection — editing by position would write one
    // node's sensor into another's.
    const withBinding = textNode('t', {
      bindings: [{ id: 'b1', semanticKey: 'cpu.load' }],
    });

    const single = describeSelection(document_([withBinding, rect('r')]), ['t']);
    const multi = describeSelection(document_([withBinding, rect('r')]), ['t', 'r']);

    expect(single.some((section) => section.title === 'Binding 1')).toBe(true);
    expect(multi.some((section) => section.title.startsWith('Binding'))).toBe(false);
  });
});

describe('locked nodes (§61)', () => {
  it('marks fields read-only but keeps visibility and lock editable', () => {
    // §61 locks *transforms*. Being unable to hide or unlock a locked element
    // would be a trap.
    const sections = describeSelection(document_([rect('a', { locked: true })]), ['a']);

    expect(field(sections, 'transform.x')?.readOnly).toBe(true);
    expect(field(sections, 'name')?.readOnly).toBe(true);
    expect(field(sections, 'locked')?.readOnly).toBeUndefined();
    expect(field(sections, 'visible')?.readOnly).toBeUndefined();
  });
});

describe('applyFieldChange', () => {
  const base = document_([rect('a'), rect('b')]);

  it('renames', () => {
    const next = applyFieldChange(base, ['a'], 'name', { kind: 'literal', value: 'Panel' });

    expect(findNode(next.nodes, 'a')?.name).toBe('Panel');
  });

  it('sets a transform value on every selected node', () => {
    const next = applyFieldChange(base, ['a', 'b'], 'transform.x', { kind: 'literal', value: 42 });

    expect(findNode(next.nodes, 'a')?.transform?.x).toBe(42);
    expect(findNode(next.nodes, 'b')?.transform?.x).toBe(42);
  });

  it('accepts a numeric string, because an input yields one', () => {
    const next = applyFieldChange(base, ['a'], 'transform.y', { kind: 'literal', value: '35' });

    expect(findNode(next.nodes, 'a')?.transform?.y).toBe(35);
  });

  it('refuses the empty string instead of committing a zero', () => {
    // A number input reports '' for ANY content it cannot parse, including a
    // half-typed `1e`. `Number('')` is 0, so the obvious reading turned a
    // clumsy keystroke into width 0 and the element vanished.
    for (const value of ['', '   ', '1e', '-', 'abc']) {
      expect(applyFieldChange(base, ['a'], 'transform.width', { kind: 'literal', value })).toBe(
        base,
      );
    }
  });

  it('stores a numeric STYLE property as a number, not a string', () => {
    // The renderer's `asNumber` requires `typeof === 'number'`, so storing the
    // control's string made opacity, outline width, shadow blur, font size,
    // letter spacing and line height all silently do nothing.
    const next = applyFieldChange(base, ['a'], 'style.opacity', {
      kind: 'literal',
      value: '0.25',
    });

    expect(findNode(next.nodes, 'a')?.style?.['opacity']).toEqual({ value: 0.25 });
  });

  it('clamps a numeric style property to its declared range', () => {
    const low = applyFieldChange(base, ['a'], 'style.opacity', { kind: 'literal', value: '-5' });
    const high = applyFieldChange(base, ['a'], 'style.opacity', { kind: 'literal', value: '9' });

    expect(findNode(low.nodes, 'a')?.style?.['opacity']).toEqual({ value: 0 });
    expect(findNode(high.nodes, 'a')?.style?.['opacity']).toEqual({ value: 1 });
  });

  it('refuses an unparseable numeric style value rather than deleting the property', () => {
    const styled = document_([rect('a', { style: { strokeWidth: { value: 4 } } })]);

    expect(
      applyFieldChange(styled, ['a'], 'style.strokeWidth', { kind: 'literal', value: '1e' }),
    ).toBe(styled);
  });

  it('still stores a non-numeric style property as the string it is', () => {
    const next = applyFieldChange(base, ['a'], 'style.fill', {
      kind: 'literal',
      value: '#0cf',
    });

    expect(findNode(next.nodes, 'a')?.style?.['fill']).toEqual({ value: '#0cf' });
  });

  it('ignores an unparseable number rather than writing NaN', () => {
    // NaN in a transform would render nothing and fail validation on save.
    expect(applyFieldChange(base, ['a'], 'transform.x', { kind: 'literal', value: 'abc' })).toBe(base);
  });

  it('wraps rotation into the schema range', () => {
    // Typing 400 must not produce a document that cannot be saved.
    const next = applyFieldChange(base, ['a'], 'transform.rotation', {
      kind: 'literal',
      value: 400,
    });

    expect(findNode(next.nodes, 'a')?.transform?.rotation).toBeCloseTo(40, 10);
    expect(validateThemeDocument(next).ok).toBe(true);
  });

  it('clamps a negative size at zero', () => {
    const next = applyFieldChange(base, ['a'], 'transform.width', { kind: 'literal', value: -20 });

    expect(findNode(next.nodes, 'a')?.transform?.width).toBe(0);
    expect(validateThemeDocument(next).ok).toBe(true);
  });

  it('sets a style literal', () => {
    const next = applyFieldChange(base, ['a'], 'style.fill', { kind: 'literal', value: '#abcdef' });

    expect(findNode(next.nodes, 'a')?.style?.['fill']).toEqual({ value: '#abcdef' });
  });

  it('replaces a literal with a reference, never both (§75)', () => {
    const withLiteral = applyFieldChange(base, ['a'], 'style.fill', {
      kind: 'literal',
      value: '#abcdef',
    });
    const withRef = applyFieldChange(withLiteral, ['a'], 'style.fill', {
      kind: 'ref',
      ref: 'palette.accent',
    });

    expect(findNode(withRef.nodes, 'a')?.style?.['fill']).toEqual({ ref: 'palette.accent' });
    expect(validateThemeDocument(withRef).ok).toBe(true);
  });

  it('replaces a reference with a literal', () => {
    const withRef = applyFieldChange(base, ['a'], 'style.fill', {
      kind: 'ref',
      ref: 'palette.accent',
    });
    const withLiteral = applyFieldChange(withRef, ['a'], 'style.fill', {
      kind: 'literal',
      value: '#111111',
    });

    expect(findNode(withLiteral.nodes, 'a')?.style?.['fill']).toEqual({ value: '#111111' });
  });

  it('clears a property back to the default', () => {
    const withFill = applyFieldChange(base, ['a'], 'style.fill', {
      kind: 'literal',
      value: '#abcdef',
    });
    const cleared = applyFieldChange(withFill, ['a'], 'style.fill', { kind: 'unset' });

    expect(findNode(cleared.nodes, 'a')?.style).toBeUndefined();
  });

  it('treats an emptied text field as cleared, not as an empty string', () => {
    // Storing `fill: ""` would emit a value the renderer ignores anyway, so the
    // document may as well say the property is absent.
    const withFill = applyFieldChange(base, ['a'], 'style.fill', {
      kind: 'literal',
      value: '#abcdef',
    });
    const emptied = applyFieldChange(withFill, ['a'], 'style.fill', { kind: 'literal', value: '' });

    expect(findNode(emptied.nodes, 'a')?.style).toBeUndefined();
  });

  it('leaves the document alone for an unknown key', () => {
    // A typo in a field key should not take down the editor mid-edit.
    expect(applyFieldChange(base, ['a'], 'nonsense.field', { kind: 'literal', value: 1 })).toBe(base);
    // id and type are read-only and must not be writable through this path.
    expect(applyFieldChange(base, ['a'], 'id', { kind: 'literal', value: 'hacked' })).toBe(base);
  });

  it('leaves the document alone for an empty selection', () => {
    expect(applyFieldChange(base, [], 'transform.x', { kind: 'literal', value: 1 })).toBe(base);
  });
});

describe('binding edits', () => {
  const withBinding = document_([
    textNode('t', {
      bindings: [
        { id: 'b1', semanticKey: 'cpu.load', precision: 0 },
        { id: 'b2', semanticKey: 'gpu.load' },
      ],
    }),
  ]);

  const bindingsOf = (document__: ThemeDocument) => findNode(document__.nodes, 't')?.bindings ?? [];

  it('edits by id, not by position', () => {
    const next = applyFieldChange(withBinding, ['t'], 'binding.b2.semanticKey', {
      kind: 'literal',
      value: 'gpu.temp',
    });

    expect(bindingsOf(next)[0]?.semanticKey).toBe('cpu.load');
    expect(bindingsOf(next)[1]?.semanticKey).toBe('gpu.temp');
  });

  it('refuses an empty semantic key (§93)', () => {
    // A binding with no key can never resolve; it is the whole point of one.
    const next = applyFieldChange(withBinding, ['t'], 'binding.b1.semanticKey', {
      kind: 'literal',
      value: '',
    });

    expect(bindingsOf(next)[0]?.semanticKey).toBe('cpu.load');
  });

  it('sets and clears precision', () => {
    const set = applyFieldChange(withBinding, ['t'], 'binding.b1.precision', {
      kind: 'literal',
      value: 3,
    });
    expect(bindingsOf(set)[0]?.precision).toBe(3);

    const cleared = applyFieldChange(set, ['t'], 'binding.b1.precision', {
      kind: 'literal',
      value: '',
    });
    expect(bindingsOf(cleared)[0]?.precision).toBeUndefined();
  });

  it('rejects a precision outside the schema range', () => {
    for (const value of [-1, 7, 1.5]) {
      const next = applyFieldChange(withBinding, ['t'], 'binding.b1.precision', {
        kind: 'literal',
        value,
      });

      expect(bindingsOf(next)[0]?.precision).toBe(0);
    }
  });

  it('sets unitDisplay only to a valid option', () => {
    const valid = applyFieldChange(withBinding, ['t'], 'binding.b1.unitDisplay', {
      kind: 'literal',
      value: 'long',
    });
    expect(bindingsOf(valid)[0]?.unitDisplay).toBe('long');

    const invalid = applyFieldChange(withBinding, ['t'], 'binding.b1.unitDisplay', {
      kind: 'literal',
      value: 'huge',
    });
    expect(bindingsOf(invalid)[0]?.unitDisplay).toBeUndefined();
  });

  it('produces a document that still validates', () => {
    const next = applyFieldChange(withBinding, ['t'], 'binding.b1.precision', {
      kind: 'literal',
      value: 4,
    });

    expect(validateThemeDocument(next).ok).toBe(true);
  });
});

describe('labelForField', () => {
  it('names the edit for the undo menu', () => {
    expect(labelForField('style.fill')).toBe('Set fill');
    expect(labelForField('transform.rotation')).toBe('Set rotation');
    expect(labelForField('binding.b1.precision')).toBe('Edit binding');
    expect(labelForField('name')).toBe('Set name');
  });
});
