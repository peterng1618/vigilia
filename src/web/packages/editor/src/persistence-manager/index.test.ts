import { describe, expect, it } from 'vitest';
import { PersistenceManager } from './index.js';

const baseline = {
  schemaVersion: 2,
  fabricVersion: '7.4.0',
  id: 'theme',
  artboard: { width: 1, height: 1 },
  scene: { version: '7.4.0', objects: [] },
} as const;

describe('PersistenceManager', () => {
  it('detects changes from the saved Fabric scene rather than fork events', () => {
    const persistence = new PersistenceManager(baseline);

    expect(persistence.isDirty(baseline)).toBe(false);
    expect(persistence.isDirty({
      ...baseline,
      scene: { ...baseline.scene, objects: [{ type: 'Rect', id: 'panel' }] },
    })).toBe(true);
  });
});
