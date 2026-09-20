import { describe, expect, it } from 'vitest';
import { faceForRole, fontTrio } from './font-catalog.js';

describe('curated font trios', () => {
  it('provides three distinct pinned Fontsource WOFF2 faces', () => {
    const trio = fontTrio('minimal');

    expect(trio?.faces).toHaveLength(3);
    expect(new Set(trio?.faces.map((face) => face.id)).size).toBe(3);
    for (const face of trio?.faces ?? []) {
      expect(face.sourceUrl).toMatch(/^https:\/\/cdn\.jsdelivr\.net\/fontsource\/fonts\/.+@\d+\.\d+\.\d+\/.+\.woff2$/);
      expect(face.sourceUrl).not.toContain('latest');
      expect(face.format).toBe('woff2');
    }
  });

  it('selects the nearest available role face weight', () => {
    const trio = fontTrio('minimal')!;

    expect(faceForRole(trio, 'heading', 300)?.weight).toBe(700);
    expect(faceForRole(trio, 'body', 600)?.weight).toBe(400);
  });
});
