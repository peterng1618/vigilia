import { describe, expect, it } from 'vitest';
import type { ThemeDocument, ThemeNode, Transform } from '@vigilia/renderer-core';

import { withScaledDescendants } from './resize-children.js';

function rect(id: string, transform: Transform): ThemeNode {
  return { id, type: 'rectangle', transform };
}

function group(id: string, transform: Transform, children: readonly ThemeNode[]): ThemeNode {
  return { id, type: 'group', transform, children };
}

function doc(nodes: readonly ThemeNode[]): ThemeDocument {
  return {
    schemaVersion: 1,
    id: 'resize-children-fixture',
    artboard: { width: 1000, height: 1000 },
    nodes,
  };
}

/** A panel like the demo theme's: a background, a title and a chart. */
const panel = doc([
  group('panel', { x: 0, y: 0, width: 400, height: 200 }, [
    rect('bg', { x: 0, y: 0, width: 400, height: 200 }),
    rect('title', { x: 20, y: 10, width: 300, height: 24 }),
    group('inner', { x: 20, y: 50, width: 200, height: 100 }, [
      rect('deep', { x: 5, y: 5, width: 100, height: 50 }),
    ]),
  ]),
]);

describe('withScaledDescendants', () => {
  it('is the reported bug: a resized group takes its children with it', () => {
    // Dragging the east handle widened the group's own box and left every
    // child at its old width, so the panel outline grew around unchanged
    // contents.
    const resized = withScaledDescendants(
      panel,
      new Map([['panel', { x: 0, y: 0, width: 800, height: 200 }]]),
      'e',
    );

    expect(resized.get('bg')?.width).toBe(800);
    expect(resized.get('title')?.width).toBe(600);
    expect(resized.get('title')?.x).toBe(40);
  });

  it('leaves the cross axis alone when only one axis changed', () => {
    const resized = withScaledDescendants(
      panel,
      new Map([['panel', { x: 0, y: 0, width: 800, height: 200 }]]),
      'e',
    );

    expect(resized.get('bg')?.height).toBe(200);
    expect(resized.get('title')?.y).toBe(10);
  });

  it('scales both axes independently', () => {
    const resized = withScaledDescendants(
      panel,
      new Map([['panel', { x: 0, y: 0, width: 200, height: 400 }]]),
      'se',
    );

    // Half the width, double the height.
    expect(resized.get('title')?.width).toBe(150);
    expect(resized.get('title')?.x).toBe(10);
    expect(resized.get('title')?.height).toBe(48);
    expect(resized.get('title')?.y).toBe(20);
  });

  it('recurses, applying the same factors at every depth', () => {
    const resized = withScaledDescendants(
      panel,
      new Map([['panel', { x: 0, y: 0, width: 800, height: 200 }]]),
      'e',
    );

    expect(resized.get('inner')?.width).toBe(400);
    expect(resized.get('deep')?.width).toBe(200);
    expect(resized.get('deep')?.x).toBe(10);
  });

  it('does not overwrite the dragged group, which the gesture already placed', () => {
    const gesture = new Map([['panel', { x: 7, y: 9, width: 800, height: 200 }]]);
    const resized = withScaledDescendants(panel, gesture, 'e');

    expect(resized.get('panel')).toEqual({ x: 7, y: 9, width: 800, height: 200 });
  });

  it('leaves a move alone — children already travel with the parent', () => {
    const gesture = new Map([['panel', { x: 50, y: 50, width: 400, height: 200 }]]);

    expect(withScaledDescendants(panel, gesture, 'move')).toBe(gesture);
  });

  it('leaves a rotation alone — it is about the group centre', () => {
    const gesture = new Map([['panel', { x: 0, y: 0, width: 400, height: 200, rotation: 30 }]]);

    expect(withScaledDescendants(panel, gesture, 'rotate')).toBe(gesture);
  });

  it('does not touch a resized non-group', () => {
    const flat = doc([rect('lonely', { x: 0, y: 0, width: 100, height: 100 })]);
    const resized = withScaledDescendants(
      flat,
      new Map([['lonely', { x: 0, y: 0, width: 200, height: 100 }]]),
      'e',
    );

    expect([...resized.keys()]).toEqual(['lonely']);
  });

  it('preserves a child rotation rather than trying to shear it', () => {
    const rotated = doc([
      group('g', { x: 0, y: 0, width: 100, height: 100 }, [
        rect('tilted', { x: 10, y: 10, width: 50, height: 50, rotation: 45 }),
      ]),
    ]);

    const resized = withScaledDescendants(
      rotated,
      new Map([['g', { x: 0, y: 0, width: 200, height: 100 }]]),
      'e',
    );

    expect(resized.get('tilted')?.rotation).toBe(45);
    expect(resized.get('tilted')?.width).toBe(100);
    expect(resized.get('tilted')?.height).toBe(50);
  });

  it('refuses to scale from a zero size instead of producing NaN', () => {
    const degenerate = doc([
      group('g', { x: 0, y: 0, width: 0, height: 100 }, [
        rect('child', { x: 0, y: 0, width: 40, height: 40 }),
      ]),
    ]);

    const resized = withScaledDescendants(
      degenerate,
      new Map([['g', { x: 0, y: 0, width: 200, height: 100 }]]),
      'e',
    );

    // Untouched, not Infinity and not NaN.
    expect(resized.get('child')).toBeUndefined();
  });

  it('scales a locked descendant, because a half-scaled panel is worse', () => {
    const locked = doc([
      group('g', { x: 0, y: 0, width: 100, height: 100 }, [
        { id: 'pinned', type: 'rectangle', transform: { width: 50, height: 50 }, locked: true },
      ]),
    ]);

    const resized = withScaledDescendants(
      locked,
      new Map([['g', { x: 0, y: 0, width: 200, height: 100 }]]),
      'e',
    );

    expect(resized.get('pinned')?.width).toBe(100);
  });
});
