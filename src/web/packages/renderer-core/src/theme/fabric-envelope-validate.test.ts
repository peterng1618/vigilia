import { describe, expect, it } from 'vitest';
import { validateFabricThemeEnvelope } from './fabric-envelope-validate.js';

function envelope(): Record<string, unknown> {
  return {
    schemaVersion: 2,
    fabricVersion: '7.4.0',
    id: 'theme',
    artboard: { width: 400, height: 300 },
    bindings: { chart: [{ id: 'cpu', semanticKey: 'cpu.load', precision: 0 }] },
    scene: {
      version: '7.4.0',
      objects: [{ type: 'VigiliaChart', id: 'chart', objects: [{ type: 'Rect', id: 'child' }] }],
    },
  };
}

describe('Fabric theme envelope validation', () => {
  it('accepts a bounded Fabric scene with identities and semantic bindings', () => {
    expect(validateFabricThemeEnvelope(envelope())).toMatchObject({ ok: true });
  });

  it('reports an unknown version alone before interpreting the envelope', () => {
    const result = validateFabricThemeEnvelope({ ...envelope(), schemaVersion: 3, artboard: 'wrong' });

    expect(result).toMatchObject({ ok: false, issues: [{ code: 'newer-schema-version', path: '/schemaVersion' }] });
    if (!result.ok) expect(result.issues).toHaveLength(1);
  });

  it('rejects unknown envelope fields and malformed Fabric scene state', () => {
    const result = validateFabricThemeEnvelope({
      ...envelope(),
      unexpected: true,
      scene: { version: '7.4.0', objects: [{ type: 'Rect', id: 'x', width: Number.POSITIVE_INFINITY }] },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'unknown-field', path: '/unexpected' }),
        expect.objectContaining({ code: 'invalid-fabric-scene', path: '/scene/objects/0/width' }),
      ]));
    }
  });

  it('rejects anonymous or duplicate Fabric objects and malformed bindings', () => {
    const result = validateFabricThemeEnvelope({
      ...envelope(),
      bindings: { chart: [{ id: 'same', semanticKey: '' }, { id: 'same', semanticKey: 'gpu.load' }] },
      scene: { version: '7.4.0', objects: [{ type: 'Rect', id: 'same' }, { type: 'Rect', id: 'same' }, { type: 'Rect' }] },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'duplicate-id', path: '/bindings/chart/1/id' }),
        expect.objectContaining({ code: 'missing-field', path: '/bindings/chart/0/semanticKey' }),
        expect.objectContaining({ code: 'duplicate-id', path: '/scene/objects/1/id' }),
        expect.objectContaining({ code: 'invalid-id', path: '/scene/objects/2/id' }),
      ]));
    }
  });
});
