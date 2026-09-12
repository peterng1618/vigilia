import { describe, expect, it } from 'vitest';
import { validateThemeDocument, type IssueCode } from './validate.js';
import {
  MAX_NODE_DEPTH,
  SUPPORTED_SCHEMA_VERSION,
  requiredSemanticKeys,
  walkNodes,
} from './document.js';
import { defaultGaugeSettings } from '../types.js';
import { defaultLineSettings } from '../charts/line.js';
import { defaultBarSettings } from '../charts/bar.js';
import { defaultPieSettings } from '../charts/pie.js';

/** A minimal valid document. Tests mutate clones of this. */
function baseDocument(): Record<string, unknown> {
  return {
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    id: 'demo-theme',
    artboard: { width: 1920, height: 1080, fitMode: 'contain' },
    nodes: [],
  };
}

function gaugeNode(): Record<string, unknown> {
  return {
    id: 'cpu-gauge',
    type: 'chart',
    bindings: [{ id: 'b1', semanticKey: 'cpu.load.total' }],
    content: { family: 'gauge', settings: defaultGaugeSettings },
  };
}

/** Collects issue codes so assertions name the rule rather than the message. */
function codes(input: unknown): IssueCode[] {
  const result = validateThemeDocument(input);
  return result.ok ? [] : result.issues.map((i) => i.code);
}

function expectValid(input: unknown): void {
  const result = validateThemeDocument(input);
  if (!result.ok) {
    throw new Error(`Expected a valid document, got: ${JSON.stringify(result.issues, null, 2)}`);
  }
}

describe('schema version', () => {
  it('accepts the supported version', () => {
    expectValid(baseDocument());
  });

  it('rejects a newer version with its own code, and reports nothing else', () => {
    // §141: fail without changing the library. Reporting type errors from a
    // format we admit we do not understand would be misleading.
    const document = { ...baseDocument(), schemaVersion: 99, id: '!!not valid!!', artboard: 'wrong' };
    const result = validateThemeDocument(document);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]!.code).toBe('newer-schema-version');
      // The message has to tell the user what to do about it.
      expect(result.issues[0]!.message).toContain('newer version');
    }
  });

  it('distinguishes an older unsupported version from a newer one', () => {
    expect(codes({ ...baseDocument(), schemaVersion: 0 })).toEqual(['unsupported-schema-version']);
  });

  it('rejects a missing or non-integer version', () => {
    expect(codes({ ...baseDocument(), schemaVersion: undefined })).toEqual(['missing-field']);
    expect(codes({ ...baseDocument(), schemaVersion: 1.5 })).toEqual(['missing-field']);
  });

  it('rejects a non-object document', () => {
    expect(codes(null)).toEqual(['not-an-object']);
    expect(codes([])).toEqual(['not-an-object']);
    expect(codes('{}')).toEqual(['not-an-object']);
  });
});

describe('artboard', () => {
  it('requires positive, bounded dimensions', () => {
    expect(codes({ ...baseDocument(), artboard: { width: 0, height: 1080 } })).toContain('out-of-range');
    expect(codes({ ...baseDocument(), artboard: { width: 100, height: 99999 } })).toContain('out-of-range');
  });

  it('rejects a non-numeric dimension', () => {
    expect(codes({ ...baseDocument(), artboard: { width: '1920', height: 1080 } })).toContain('wrong-type');
  });

  it('rejects an unknown fit mode', () => {
    expect(codes({ ...baseDocument(), artboard: { width: 10, height: 10, fitMode: 'stretch' } })).toContain(
      'invalid-enum',
    );
  });
});

describe('style values (§75)', () => {
  const withStyle = (style: unknown): Record<string, unknown> => ({
    ...baseDocument(),
    globals: { palette: { accent: { name: 'Accent', value: '#00b8d9' } } },
    nodes: [{ id: 'r1', type: 'rectangle', style }],
  });

  it('accepts a resolvable global reference', () => {
    expectValid(withStyle({ fill: { ref: 'palette.accent' } }));
  });

  it('accepts a local literal', () => {
    expectValid(withStyle({ fill: { value: '#ff0000' } }));
  });

  it('rejects a reference and a literal together', () => {
    // Resolving by precedence is how a theme ends up showing a colour nobody
    // can find in the inspector.
    expect(codes(withStyle({ fill: { ref: 'palette.accent', value: '#ff0000' } }))).toEqual([
      'style-value-ambiguous',
    ]);
  });

  it('rejects a style value that declares neither', () => {
    expect(codes(withStyle({ fill: {} }))).toEqual(['style-value-ambiguous']);
  });

  it('rejects a reference to a global that does not exist', () => {
    expect(codes(withStyle({ fill: { ref: 'palette.missing' } }))).toEqual(['unresolved-global-ref']);
  });

  it('rejects a reference into an unknown group', () => {
    expect(codes(withStyle({ fill: { ref: 'colours.accent' } }))).toEqual(['unresolved-global-ref']);
  });

  it('rejects a reference with no entry id', () => {
    expect(codes(withStyle({ fill: { ref: 'palette' } }))).toEqual(['unresolved-global-ref']);
  });

  it('validates the artboard background as a style value too', () => {
    expect(
      codes({
        ...baseDocument(),
        artboard: { width: 10, height: 10, background: { ref: 'palette.nope' } },
      }),
    ).toContain('unresolved-global-ref');
  });
});

describe('globals', () => {
  it('rejects an unknown group', () => {
    expect(codes({ ...baseDocument(), globals: { shadows: {} } })).toEqual(['invalid-enum']);
  });

  it('requires a display name and a value on every entry', () => {
    const result = codes({
      ...baseDocument(),
      globals: { palette: { accent: { name: '' } } },
    });
    expect(result).toContain('missing-field');
  });

  it('rejects an entry id that is not a stable id', () => {
    expect(codes({ ...baseDocument(), globals: { palette: { 'not valid': { name: 'x', value: 1 } } } })).toContain(
      'invalid-id',
    );
  });
});

describe('nodes', () => {
  it('rejects a duplicate node id', () => {
    // §75: links are by stable id, so a duplicate makes every link ambiguous.
    expect(
      codes({
        ...baseDocument(),
        nodes: [
          { id: 'same', type: 'rectangle' },
          { id: 'same', type: 'ellipse' },
        ],
      }),
    ).toEqual(['duplicate-id']);
  });

  it('detects a duplicate across nesting levels', () => {
    expect(
      codes({
        ...baseDocument(),
        nodes: [
          {
            id: 'g',
            type: 'group',
            children: [{ id: 'g', type: 'rectangle' }],
          },
        ],
      }),
    ).toEqual(['duplicate-id']);
  });

  it('rejects an unknown node type', () => {
    expect(codes({ ...baseDocument(), nodes: [{ id: 'x', type: 'polygon' }] })).toEqual(['invalid-enum']);
  });

  it('requires children on a group', () => {
    expect(codes({ ...baseDocument(), nodes: [{ id: 'g', type: 'group' }] })).toEqual(['missing-field']);
  });

  it('validates transform bounds', () => {
    expect(
      codes({
        ...baseDocument(),
        nodes: [{ id: 'r', type: 'rectangle', transform: { width: -5, rotation: 900 } }],
      }),
    ).toEqual(['out-of-range', 'out-of-range']);
  });

  it('rejects a non-boolean visible or locked', () => {
    expect(
      codes({ ...baseDocument(), nodes: [{ id: 'r', type: 'rectangle', visible: 'yes' }] }),
    ).toEqual(['wrong-type']);
  });

  it('rejects nesting deeper than the bound', () => {
    // An unbounded tree is a stack-overflow vector in an importer that accepts
    // third-party ZIPs (§141).
    let node: Record<string, unknown> = { id: 'leaf', type: 'rectangle' };
    for (let i = 0; i <= MAX_NODE_DEPTH; i++) {
      node = { id: `g${i}`, type: 'group', children: [node] };
    }

    expect(codes({ ...baseDocument(), nodes: [node] })).toContain('too-deep');
  });

  it('accepts nesting at exactly the bound', () => {
    let node: Record<string, unknown> = { id: 'leaf', type: 'rectangle' };
    for (let i = 0; i < MAX_NODE_DEPTH; i++) {
      node = { id: `g${i}`, type: 'group', children: [node] };
    }

    expectValid({ ...baseDocument(), nodes: [node] });
  });

  it('accepts an optional rectangle corner radius but not a negative one', () => {
    expectValid({ ...baseDocument(), nodes: [{ id: 'r', type: 'rectangle', content: { cornerRadius: 8 } }] });
    expect(
      codes({ ...baseDocument(), nodes: [{ id: 'r', type: 'rectangle', content: { cornerRadius: -1 } }] }),
    ).toEqual(['out-of-range']);
  });
});

describe('bindings (§93)', () => {
  it('accepts a gauge with exactly one binding', () => {
    expectValid({ ...baseDocument(), nodes: [gaugeNode()] });
  });

  it('rejects a gauge with two bindings', () => {
    // A gauge reads one value against a range; a second has no meaning.
    const node = { ...gaugeNode(), bindings: [
      { id: 'b1', semanticKey: 'cpu.load.total' },
      { id: 'b2', semanticKey: 'gpu.load.total' },
    ] };

    expect(codes({ ...baseDocument(), nodes: [node] })).toEqual(['binding-count']);
  });

  it('rejects a chart with no bindings', () => {
    const node = { ...gaugeNode(), bindings: [] };
    expect(codes({ ...baseDocument(), nodes: [node] })).toContain('binding-count');
  });

  it('rejects bindings on a node type that reads no data', () => {
    // A binding nothing reads would silently do nothing, and the author would
    // be left wondering why the value never appears.
    expect(
      codes({
        ...baseDocument(),
        nodes: [{ id: 'r', type: 'rectangle', bindings: [{ id: 'b', semanticKey: 'cpu.load.total' }] }],
      }),
    ).toEqual(['binding-count']);
  });

  it('requires a semantic key', () => {
    const node = { ...gaugeNode(), bindings: [{ id: 'b1' }] };
    expect(codes({ ...baseDocument(), nodes: [node] })).toContain('missing-field');
  });

  it('rejects a duplicate binding id across nodes', () => {
    const documentWithTwo = {
      ...baseDocument(),
      nodes: [gaugeNode(), { ...gaugeNode(), id: 'gpu-gauge' }],
    };
    expect(codes(documentWithTwo)).toEqual(['duplicate-id']);
  });

  it('bounds precision', () => {
    const node = { ...gaugeNode(), bindings: [{ id: 'b1', semanticKey: 'k', precision: 9 }] };
    expect(codes({ ...baseDocument(), nodes: [node] })).toEqual(['out-of-range']);
  });

  it('rejects a non-finite scale', () => {
    const node = { ...gaugeNode(), bindings: [{ id: 'b1', semanticKey: 'k', scale: 'x2' }] };
    expect(codes({ ...baseDocument(), nodes: [node] })).toEqual(['wrong-type']);
  });
});

describe('chart content (§87)', () => {
  it('accepts every family with its own default settings', () => {
    const cases = [
      { family: 'gauge', settings: defaultGaugeSettings, bindings: 1 },
      { family: 'line', settings: defaultLineSettings, bindings: 1 },
      { family: 'bar', settings: defaultBarSettings, bindings: 1 },
      { family: 'pie', settings: defaultPieSettings, bindings: 2 },
    ] as const;

    for (const testCase of cases) {
      expectValid({
        ...baseDocument(),
        nodes: [
          {
            id: 'c',
            type: 'chart',
            bindings: Array.from({ length: testCase.bindings }, (_, i) => ({
              id: `b${i}`,
              semanticKey: `key.${i}`,
            })),
            content: { family: testCase.family, settings: testCase.settings },
          },
        ],
      });
    }
  });

  it('rejects an unknown family', () => {
    const node = { ...gaugeNode(), content: { family: 'radar', settings: {} } };
    expect(codes({ ...baseDocument(), nodes: [node] })).toEqual(['invalid-enum']);
  });

  it('rejects a gauge range that cannot be drawn', () => {
    const node = {
      ...gaugeNode(),
      content: { family: 'gauge', settings: { ...defaultGaugeSettings, min: 100, max: 100 } },
    };
    expect(codes({ ...baseDocument(), nodes: [node] })).toEqual(['out-of-range']);
  });

  it('rejects a line window or point cap of zero', () => {
    const node = {
      id: 'c',
      type: 'chart',
      bindings: [{ id: 'b', semanticKey: 'k' }],
      content: { family: 'line', settings: { ...defaultLineSettings, windowSeconds: 0, maxPoints: 0 } },
    };
    expect(codes({ ...baseDocument(), nodes: [node] })).toEqual(['out-of-range', 'out-of-range']);
  });

  it('rejects a zero-width donut ring', () => {
    const node = {
      id: 'c',
      type: 'chart',
      bindings: [{ id: 'b', semanticKey: 'k' }],
      content: {
        family: 'pie',
        settings: { ...defaultPieSettings, innerRadiusPercent: 80, outerRadiusPercent: 80 },
      },
    };
    expect(codes({ ...baseDocument(), nodes: [node] })).toEqual(['out-of-range']);
  });

  it('requires a finite value on a fixed pie total', () => {
    const node = {
      id: 'c',
      type: 'chart',
      bindings: [{ id: 'b', semanticKey: 'k' }],
      content: {
        family: 'pie',
        settings: { ...defaultPieSettings, total: { kind: 'fixed', value: null } },
      },
    };
    expect(codes({ ...baseDocument(), nodes: [node] })).toEqual(['wrong-type']);
  });
});

describe('text content (§89)', () => {
  const textNode = (content: unknown, bindings: unknown[] = []): Record<string, unknown> => ({
    ...baseDocument(),
    nodes: [{ id: 't', type: 'text', bindings, content }],
  });

  it('accepts literal and value runs together', () => {
    expectValid(
      textNode(
        {
          runs: [
            { kind: 'literal', text: 'CPU ' },
            { kind: 'value', bindingId: 'b1', precision: 0 },
            { kind: 'literal', text: ' °C' },
          ],
        },
        [{ id: 'b1', semanticKey: 'cpu.temp' }],
      ),
    );
  });

  it('requires a runs array', () => {
    expect(codes(textNode({}))).toEqual(['missing-field']);
  });

  it('rejects a value run naming a binding on another node', () => {
    // Node-local on purpose: a cross-node reference would break invisibly when
    // either node moved.
    expect(codes(textNode({ runs: [{ kind: 'value', bindingId: 'elsewhere' }] }))).toEqual([
      'unresolved-binding-ref',
    ]);
  });

  it('rejects an unknown run kind', () => {
    expect(codes(textNode({ runs: [{ kind: 'icon' }] }))).toEqual(['invalid-enum']);
  });

  it('requires text on a literal run', () => {
    expect(codes(textNode({ runs: [{ kind: 'literal' }] }))).toEqual(['missing-field']);
  });

  it('validates a run style like any other style map', () => {
    expect(
      codes(textNode({ runs: [{ kind: 'literal', text: 'x', style: { color: { ref: 'palette.nope' } } }] })),
    ).toEqual(['unresolved-global-ref']);
  });
});

describe('assets (§141)', () => {
  const withAssets = (assets: unknown[], nodes: unknown[] = []): Record<string, unknown> => ({
    ...baseDocument(),
    assets,
    nodes,
  });

  it('accepts a package-relative path', () => {
    expectValid(withAssets([{ id: 'logo', kind: 'image', path: 'assets/logo.png' }]));
  });

  it('rejects a traversal segment', () => {
    // The schema's own path pattern permits dots, so it does NOT reject this on
    // its own. This check is the one that actually holds.
    expect(codes(withAssets([{ id: 'bad', kind: 'image', path: 'assets/../../secrets.env' }]))).toEqual([
      'invalid-asset-path',
    ]);
  });

  it('rejects an absolute path and one outside assets/', () => {
    expect(codes(withAssets([{ id: 'a', kind: 'image', path: '/etc/passwd' }]))).toEqual([
      'invalid-asset-path',
    ]);
    expect(codes(withAssets([{ id: 'a', kind: 'image', path: 'elsewhere/logo.png' }]))).toEqual([
      'invalid-asset-path',
    ]);
  });

  it('rejects an unknown asset kind', () => {
    expect(codes(withAssets([{ id: 'a', kind: 'executable', path: 'assets/a.exe' }]))).toEqual([
      'invalid-enum',
    ]);
  });

  it('rejects a malformed sha256', () => {
    expect(
      codes(withAssets([{ id: 'a', kind: 'image', path: 'assets/a.png', sha256: 'ABC' }])),
    ).toEqual(['wrong-type']);
  });

  it('rejects a duplicate asset id', () => {
    expect(
      codes(
        withAssets([
          { id: 'a', kind: 'image', path: 'assets/a.png' },
          { id: 'a', kind: 'image', path: 'assets/b.png' },
        ]),
      ),
    ).toEqual(['duplicate-id']);
  });

  it('resolves an image node against the declared assets', () => {
    expectValid(
      withAssets(
        [{ id: 'logo', kind: 'image', path: 'assets/logo.png' }],
        [{ id: 'i', type: 'image', content: { assetId: 'logo' } }],
      ),
    );

    expect(
      codes(withAssets([], [{ id: 'i', type: 'image', content: { assetId: 'logo' } }])),
    ).toEqual(['unresolved-asset-ref']);
  });
});

describe('issue reporting', () => {
  it('accumulates every issue rather than stopping at the first', () => {
    // Import UX needs the whole list; fixing one problem at a time through
    // repeated imports is the experience this avoids.
    const result = validateThemeDocument({
      ...baseDocument(),
      artboard: { width: -1, height: -1 },
      nodes: [{ id: 'bad id', type: 'nope' }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('points at the fault with a JSON pointer', () => {
    const result = validateThemeDocument({
      ...baseDocument(),
      nodes: [{ id: 'g', type: 'group', children: [{ id: 'r', type: 'rectangle', transform: { rotation: 400 } }] }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]!.path).toBe('/nodes/0/children/0/transform/rotation');
    }
  });
});

describe('document walking', () => {
  const document = {
    ...baseDocument(),
    nodes: [
      gaugeNode(),
      {
        id: 'g',
        type: 'group',
        children: [
          {
            id: 'line',
            type: 'chart',
            bindings: [
              { id: 'b2', semanticKey: 'gpu.temp' },
              { id: 'b3', semanticKey: 'cpu.load.total' },
            ],
            content: { family: 'line', settings: defaultLineSettings },
          },
        ],
      },
    ],
  };

  it('walks parents before children, in paint order', () => {
    const result = validateThemeDocument(document);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect([...walkNodes(result.document.nodes)].map((entry) => entry.node.id)).toEqual([
      'cpu-gauge',
      'g',
      'line',
    ]);
  });

  it('reports depth for each node', () => {
    const result = validateThemeDocument(document);
    if (!result.ok) {
      throw new Error('expected valid');
    }

    expect([...walkNodes(result.document.nodes)].map((entry) => entry.depth)).toEqual([0, 0, 1]);
  });

  it('collects the sorted, de-duplicated set of semantic keys the host must supply', () => {
    // §122: the host subscribes to the union of what active clients need. Two
    // bindings on the same key must not ask for it twice.
    const result = validateThemeDocument(document);
    if (!result.ok) {
      throw new Error('expected valid');
    }

    expect(requiredSemanticKeys(result.document)).toEqual([
      'cpu.load.total',
      'gpu.temp',
    ]);
  });
});

describe('unknown fields', () => {
  /**
   * The schema says `additionalProperties: false` everywhere; the validator used
   * to ignore unknown keys entirely. That divergence meant a typo was valid: a
   * node with `"visable": false` passed every check and rendered, and the author
   * had nothing to look at.
   */
  it('rejects an unknown document property', () => {
    expect(codes({ ...baseDocument(), nodez: [] })).toEqual(['unknown-field']);
  });

  it('rejects an unknown node property and suggests the intended one', () => {
    const result = validateThemeDocument({
      ...baseDocument(),
      nodes: [{ id: 'r', type: 'rectangle', visable: false }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]!.code).toBe('unknown-field');
      expect(result.issues[0]!.message).toContain('Did you mean "visible"');
      expect(result.issues[0]!.path).toBe('/nodes/0/visable');
    }
  });

  it('suggests nothing for a key that was never part of the format', () => {
    const result = validateThemeDocument({
      ...baseDocument(),
      nodes: [{ id: 'r', type: 'rectangle', quantumFlux: 1 }],
    });

    if (!result.ok) {
      expect(result.issues[0]!.message).not.toContain('Did you mean');
    }
  });

  it('rejects unknown properties on a transform, a binding and a run', () => {
    expect(
      codes({ ...baseDocument(), nodes: [{ id: 'r', type: 'rectangle', transform: { z: 3 } }] }),
    ).toEqual(['unknown-field']);

    expect(
      codes({
        ...baseDocument(),
        nodes: [{ ...gaugeNode(), bindings: [{ id: 'b', semanticKey: 'k', prescision: 2 }] }],
      }),
    ).toEqual(['unknown-field']);

    expect(
      codes({
        ...baseDocument(),
        nodes: [
          { id: 't', type: 'text', content: { runs: [{ kind: 'literal', text: 'x', colour: 'red' }] } },
        ],
      }),
    ).toEqual(['unknown-field']);
  });

  it('rejects an unknown chart setting, per family', () => {
    // The settings shapes are where a typo is most expensive: `roundcap` reads
    // as a styling choice that simply never applied.
    const node = {
      ...gaugeNode(),
      content: { family: 'gauge', settings: { ...defaultGaugeSettings, roundcap: true } },
    };

    const result = validateThemeDocument({ ...baseDocument(), nodes: [node] });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]!.code).toBe('unknown-field');
      expect(result.issues[0]!.message).toContain('roundCap');
    }
  });

  it('still allows editorMetadata to carry anything', () => {
    // §64/§67: rulers, grid and guides are persisted but never rendered, and the
    // schema leaves that object open on purpose.
    expectValid({ ...baseDocument(), editorMetadata: { zoom: 2, guides: [1, 2], whatever: {} } });
  });

  it('accepts a document that uses every declared field', () => {
    expectValid({
      schemaVersion: SUPPORTED_SCHEMA_VERSION,
      id: 'full',
      metadata: {
        name: 'Full',
        author: 'A',
        description: 'D',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      artboard: {
        width: 100,
        height: 100,
        fitMode: 'cover',
        background: { value: '#000' },
        barColor: { value: '#111' },
      },
      globals: { palette: { a: { name: 'A', value: '#fff' } } },
      assets: [
        {
          id: 'asset1',
          kind: 'image',
          path: 'assets/a.png',
          sha256: 'a'.repeat(64),
          sourceUrl: 'https://example.test/a.png',
          license: { name: 'CC0', url: 'https://example.test/l', attribution: 'x' },
        },
      ],
      editorMetadata: {},
      nodes: [
        {
          id: 'n1',
          type: 'text',
          name: 'Named',
          transform: { x: 1, y: 2, width: 3, height: 4, rotation: 5, scaleX: 1, scaleY: 1 },
          visible: true,
          locked: false,
          style: { fill: { ref: 'palette.a' } },
          bindings: [
            {
              id: 'bind1',
              semanticKey: 'cpu.load',
              precision: 2,
              unitDisplay: 'long',
              scale: 2,
              offset: 1,
            },
          ],
          content: {
            runs: [
              { kind: 'literal', text: 'x', style: { color: { value: '#fff' } } },
              { kind: 'value', bindingId: 'bind1', precision: 1, unitDisplay: 'none', style: {} },
            ],
            wrap: true,
            overflow: 'ellipsis',
            align: 'center',
            verticalAlign: 'bottom',
          },
        },
        { id: 'n2', type: 'image', content: { assetId: 'asset1', fit: 'cover', monochrome: { value: '#f00' } } },
        { id: 'n3', type: 'video', content: { assetId: 'asset1', loop: false, muted: true } },
      ],
    });
  });
});
