import { describe, expect, it } from 'vitest';
import { instantiateWidget } from './widget.js';
import { validateThemeDocument } from './validate.js';
import { walkBindings, walkNodes, type ThemeDocument, type ThemeNode } from './document.js';
import { defaultGaugeSettings } from '../types.js';

/** A widget with the two reference kinds that must be remapped together. */
function widgetNodes(): ThemeNode[] {
  return [
    {
      id: 'card',
      type: 'group',
      transform: { x: 0, y: 0, width: 200, height: 120 },
      children: [
        {
          id: 'card-bg',
          type: 'rectangle',
          transform: { x: 0, y: 0, width: 200, height: 120 },
          style: { fill: { ref: 'palette.accent' } },
        },
        {
          id: 'card-gauge',
          type: 'chart',
          transform: { x: 10, y: 10, width: 80, height: 80 },
          bindings: [{ id: 'card-load', semanticKey: 'cpu.load' }],
          content: { family: 'gauge', settings: defaultGaugeSettings },
        },
        {
          id: 'card-text',
          type: 'text',
          transform: { x: 100, y: 40, width: 90, height: 30 },
          bindings: [{ id: 'card-value', semanticKey: 'cpu.load', precision: 0 }],
          content: {
            runs: [
              { kind: 'literal', text: 'CPU ', style: { color: { ref: 'palette.ink' } } },
              { kind: 'value', bindingId: 'card-value' },
            ],
          },
        },
      ],
    },
  ];
}

const widgetGlobals = {
  palette: {
    accent: { name: 'Accent', value: '#00b8d9' },
    ink: { name: 'Ink', value: '#ffffff' },
  },
};

function instantiate(overrides: Parameters<typeof instantiateWidget>[1]) {
  return instantiateWidget(widgetNodes(), overrides);
}

/** All node and binding ids in an instantiated subtree. */
function allIds(nodes: readonly ThemeNode[]): string[] {
  const ids = [...walkNodes(nodes)].map((entry) => entry.node.id);
  ids.push(...[...walkBindings(nodes)].map((entry) => entry.binding.id));
  return ids;
}

describe('fresh ids', () => {
  it('renames every node and every binding', () => {
    const result = instantiate({ idPrefix: 'w1', widgetGlobals });

    for (const id of allIds(result.nodes)) {
      expect(id.startsWith('w1-')).toBe(true);
    }
  });

  it('keeps the ids readable rather than opaque', () => {
    // An author looking at a tree of inserted copies has to be able to tell
    // them apart.
    const result = instantiate({ idPrefix: 'w1', widgetGlobals });
    expect(result.nodes[0]!.id).toBe('w1-card');
  });

  it('rewrites a text run to the binding it now names', () => {
    // THE defect this module exists to prevent: rename the binding, forget the
    // run, and the run renders a placeholder for a sensor sitting right there.
    const result = instantiate({ idPrefix: 'w1', widgetGlobals });
    const text = [...walkNodes(result.nodes)].find((entry) => entry.node.type === 'text')?.node;

    expect(text?.type).toBe('text');
    if (text?.type !== 'text') {
      return;
    }

    const run = text.content.runs[1];
    expect(run?.kind).toBe('value');
    if (run?.kind === 'value') {
      expect(run.bindingId).toBe('w1-card-value');
      expect(text.bindings?.[0]?.id).toBe('w1-card-value');
      // The rewrite is only correct if the two agree.
      expect(run.bindingId).toBe(text.bindings?.[0]?.id);
    }
  });

  it('never renames a semantic key', () => {
    // §93: a widget bound to cpu.load must still be bound to cpu.load, or it
    // arrives showing nothing.
    const result = instantiate({ idPrefix: 'w1', widgetGlobals });

    expect([...walkBindings(result.nodes)].map((entry) => entry.binding.semanticKey)).toEqual([
      'cpu.load',
      'cpu.load',
    ]);
  });

  it('avoids ids already used in the destination', () => {
    const result = instantiate({
      idPrefix: 'w1',
      existingIds: ['w1-card', 'w1-card-2'],
      widgetGlobals,
    });

    expect(result.nodes[0]!.id).toBe('w1-card-3');
  });

  it('produces ids that pass validation when inserted twice', () => {
    // The real test of uniqueness: two insertions into one document, validated.
    const first = instantiate({ idPrefix: 'a', widgetGlobals });
    const second = instantiateWidget(widgetNodes(), {
      idPrefix: 'b',
      existingIds: allIds(first.nodes),
      widgetGlobals,
    });

    const document: ThemeDocument = {
      schemaVersion: 1,
      id: 'host',
      artboard: { width: 800, height: 600 },
      nodes: [...first.nodes, ...second.nodes],
    };

    const result = validateThemeDocument(document);
    if (!result.ok) {
      throw new Error(result.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
    }
    expect(result.ok).toBe(true);
  });

  it('truncates a long id and still keeps it unique', () => {
    // Truncation to 64 characters is exactly what lets two distinct source ids
    // collide, so the numeric suffix is not theoretical.
    const long = 'x'.repeat(60);
    const nodes: ThemeNode[] = [
      { id: `${long}a`, type: 'rectangle' },
      { id: `${long}b`, type: 'rectangle' },
    ];

    const result = instantiateWidget(nodes, { idPrefix: 'prefix' });
    const ids = result.nodes.map((node) => node.id);

    expect(ids[0]!.length).toBeLessThanOrEqual(64);
    expect(ids[1]!.length).toBeLessThanOrEqual(64);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('sanitises a prefix that is not a valid stable id', () => {
    const result = instantiate({ idPrefix: 'my widget!', widgetGlobals });

    for (const id of allIds(result.nodes)) {
      expect(id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    }
  });

  it('reports a widget that declares one id twice', () => {
    const nodes: ThemeNode[] = [
      { id: 'same', type: 'rectangle' },
      { id: 'same', type: 'ellipse' },
    ];

    const result = instantiateWidget(nodes, { idPrefix: 'w' });
    expect(result.issues.map((issue) => issue.code)).toEqual(['id-collision']);
  });

  it('maps old ids to new ones for the caller', () => {
    const result = instantiate({ idPrefix: 'w1', widgetGlobals });

    expect(result.idMap.get('card')).toBe('w1-card');
    expect(result.idMap.get('card-value')).toBe('w1-card-value');
  });
});

describe('globals (§77)', () => {
  it('follows an explicit mapping', () => {
    const result = instantiate({
      idPrefix: 'w1',
      globalRefMapping: { 'palette.accent': 'palette.brand', 'palette.ink': 'palette.text' },
    });

    const background = [...walkNodes(result.nodes)].find(
      (entry) => entry.node.type === 'rectangle',
    )?.node;

    expect(background?.style?.['fill']).toEqual({ ref: 'palette.brand' });
    expect(result.issues).toEqual([]);
  });

  it('converts an unmapped reference to the widget\'s own literal', () => {
    // The remedy §75 offers when a global is deleted, applied to insertion: the
    // widget looks the way its author intended, at the cost of no longer
    // following the destination's tokens.
    const result = instantiate({ idPrefix: 'w1', widgetGlobals });

    const background = [...walkNodes(result.nodes)].find(
      (entry) => entry.node.type === 'rectangle',
    )?.node;

    expect(background?.style?.['fill']).toEqual({ value: '#00b8d9' });
    expect(result.issues).toEqual([]);
  });

  it('reports an unmapped reference it cannot resolve, rather than adopting a same-named global', () => {
    // §77 forbids silently merging same-name globals: two documents can both
    // define palette.accent and mean different colours.
    const result = instantiate({ idPrefix: 'w1' });

    expect(result.issues.map((issue) => issue.code)).toEqual([
      'unmapped-global',
      'unmapped-global',
    ]);
    expect(result.issues[0]!.detail).toContain('palette.accent');
    expect(result.issues[0]!.detail).toContain('may mean something else');
  });

  it('prefers an explicit mapping over the widget literal', () => {
    const result = instantiate({
      idPrefix: 'w1',
      widgetGlobals,
      globalRefMapping: { 'palette.accent': 'palette.brand' },
    });

    const background = [...walkNodes(result.nodes)].find(
      (entry) => entry.node.type === 'rectangle',
    )?.node;

    expect(background?.style?.['fill']).toEqual({ ref: 'palette.brand' });
  });

  it('remaps a reference inside a styled run', () => {
    // Run styles are a second place references hide; missing them would leave
    // half a widget following the wrong tokens.
    const result = instantiate({ idPrefix: 'w1', widgetGlobals });
    const text = [...walkNodes(result.nodes)].find((entry) => entry.node.type === 'text')?.node;

    if (text?.type === 'text') {
      expect(text.content.runs[0]?.style?.['color']).toEqual({ value: '#ffffff' });
    }
  });

  it('leaves a local literal alone', () => {
    const nodes: ThemeNode[] = [
      { id: 'r', type: 'rectangle', style: { fill: { value: '#123456' } } },
    ];

    const result = instantiateWidget(nodes, { idPrefix: 'w' });
    expect(result.nodes[0]!.style?.['fill']).toEqual({ value: '#123456' });
    expect(result.issues).toEqual([]);
  });
});

describe('placement and provenance (§138)', () => {
  it('offsets the roots only', () => {
    // §57: a child's coordinates are group-local, so offsetting them too would
    // shift every descendant twice.
    const result = instantiate({ idPrefix: 'w1', widgetGlobals, offset: { x: 300, y: 40 } });

    expect(result.nodes[0]!.transform?.x).toBe(300);
    expect(result.nodes[0]!.transform?.y).toBe(40);

    const child = [...walkNodes(result.nodes)].find((entry) => entry.depth === 1)?.node;
    expect(child?.transform?.x).toBe(0);
  });

  it('stamps provenance on the roots only', () => {
    const result = instantiate({
      idPrefix: 'w1',
      widgetGlobals,
      provenance: { widgetId: 'cpu-card', widgetName: 'CPU card', widgetVersion: '1.2.0' },
    });

    expect(result.nodes[0]!.provenance).toEqual({
      widgetId: 'cpu-card',
      widgetName: 'CPU card',
      widgetVersion: '1.2.0',
    });

    // Stamping every descendant would triple a deep widget's size to say the
    // same thing.
    for (const entry of walkNodes(result.nodes)) {
      if (entry.depth > 0) {
        expect(entry.node.provenance).toBeUndefined();
      }
    }
  });

  it('produces provenance the validator accepts', () => {
    const result = instantiate({
      idPrefix: 'w1',
      widgetGlobals,
      provenance: { widgetId: 'cpu-card', insertedAt: '2026-01-01T00:00:00Z' },
    });

    const validation = validateThemeDocument({
      schemaVersion: 1,
      id: 'host',
      artboard: { width: 800, height: 600 },
      nodes: result.nodes,
    });

    expect(validation.ok).toBe(true);
  });

  it('omits provenance when none is supplied', () => {
    expect(instantiate({ idPrefix: 'w1', widgetGlobals }).nodes[0]!.provenance).toBeUndefined();
  });
});

describe('copy semantics', () => {
  it('shares no mutable structure with the source', () => {
    // A shared array or object would make editing an inserted copy change the
    // library widget — the opposite of "embeds a copy" (§138).
    const source = widgetNodes();
    const result = instantiateWidget(source, { idPrefix: 'w1', widgetGlobals });

    const sourceGroup = source[0]!;
    const copyGroup = result.nodes[0]!;

    expect(copyGroup).not.toBe(sourceGroup);
    if (sourceGroup.type === 'group' && copyGroup.type === 'group') {
      expect(copyGroup.children).not.toBe(sourceGroup.children);
      expect(copyGroup.children[0]).not.toBe(sourceGroup.children[0]);
      expect(copyGroup.children[0]!.style).not.toBe(sourceGroup.children[0]!.style);
    }
  });

  it('leaves the source untouched', () => {
    const source = widgetNodes();
    instantiateWidget(source, { idPrefix: 'w1', widgetGlobals, offset: { x: 50, y: 50 } });

    expect(source[0]!.id).toBe('card');
    expect(source[0]!.transform?.x).toBe(0);
  });

  it('preserves chart settings exactly', () => {
    const result = instantiate({ idPrefix: 'w1', widgetGlobals });
    const chart = [...walkNodes(result.nodes)].find((entry) => entry.node.type === 'chart')?.node;

    if (chart?.type === 'chart') {
      expect(chart.content.settings).toEqual(defaultGaugeSettings);
    }
  });

  it('handles an empty widget without throwing', () => {
    const result = instantiateWidget([], { idPrefix: 'w1' });
    expect(result.nodes).toEqual([]);
    expect(result.issues).toEqual([]);
  });
});
