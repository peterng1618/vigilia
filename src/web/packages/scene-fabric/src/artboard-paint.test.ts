import { Gradient } from 'fabric/es';
import { describe, expect, it } from 'vitest';
import { cssArtboardPaint, fabricArtboardPaint } from './artboard-paint.js';

describe('artboard paint', () => {
  const gradient = {
    kind: 'gradient' as const,
    angle: 0,
    stops: [
      { offset: 0, color: '#102030' },
      { offset: 1, color: '#d0e0f0' },
    ],
  };

  it('converts a palette gradient to Fabric pixels across the artboard', () => {
    const paint = fabricArtboardPaint(gradient, 800, 600);

    expect(paint).toBeInstanceOf(Gradient);
    expect(paint).toMatchObject({
      type: 'linear',
      gradientUnits: 'pixels',
      coords: { x1: 0, y1: 300, x2: 800, y2: 300 },
      colorStops: gradient.stops,
    });
  });

  it('converts a structured solid palette token', () => {
    expect(fabricArtboardPaint({ kind: 'solid', color: '#102030' }, 1, 1)).toBe('#102030');
    expect(cssArtboardPaint({ kind: 'solid', color: '#102030' })).toBe('#102030');
  });

  it('uses the corresponding CSS gradient for letterbox bars', () => {
    expect(cssArtboardPaint(gradient)).toBe('linear-gradient(90deg, #102030 0%, #d0e0f0 100%)');
  });

  it('passes Fabric-compatible solid colors through unchanged', () => {
    expect(fabricArtboardPaint('#102030', 1, 1)).toBe('#102030');
    expect(cssArtboardPaint('rgb(16 32 48)')).toBe('rgb(16 32 48)');
  });
});
