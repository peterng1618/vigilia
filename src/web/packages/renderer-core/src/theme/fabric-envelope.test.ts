import { describe, expect, it } from 'vitest';
import { defaultGaugeSettings } from '../types.js';
import { fabricEnvelopeInputFor } from './fabric-envelope.js';
import type { ThemeDocument } from './document.js';

describe('fabricEnvelopeInputFor', () => {
  it('keeps semantic metadata and indexes bindings by Fabric object id', () => {
    const document: ThemeDocument = {
      schemaVersion: 1,
      id: 'theme',
      artboard: { width: 400, height: 300 },
      metadata: { name: 'Theme' },
      nodes: [{
        id: 'chart', type: 'chart',
        bindings: [{ id: 'cpu', semanticKey: 'cpu.load' }],
        content: { family: 'gauge', settings: defaultGaugeSettings },
      }],
    };

    expect(fabricEnvelopeInputFor(document)).toEqual({
      id: 'theme', artboard: { width: 400, height: 300 }, metadata: { name: 'Theme' },
      bindings: { chart: [{ id: 'cpu', semanticKey: 'cpu.load' }] },
    });
  });

  it('carries only v2 paint and type globals forward', () => {
    const document: ThemeDocument = {
      schemaVersion: 1,
      id: 'theme',
      artboard: { width: 400, height: 300 },
      globals: {
        palette: { accent: { name: 'Accent', value: '#00b8d9' } },
        typePresets: { body: { name: 'Body', value: { family: 'Inter', size: 16 } } },
        fontSizes: { body: { name: 'Body', value: 16 } },
      },
      nodes: [],
    };

    expect(fabricEnvelopeInputFor(document).globals).toEqual({
      palette: { accent: { name: 'Accent', value: { kind: 'solid', color: '#00b8d9' } } },
      typePresets: { body: { name: 'Body', value: { family: 'Inter', size: 16 } } },
    });
  });
});
