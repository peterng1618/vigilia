import { describe, expect, it } from 'vitest';
import type { ThemeDocument } from '@vigilia/renderer-core';
import { EditorCore } from '../core/editor.js';

/**
 * A group at x=100 holding one child inset by 30, plus a lone box at x=400.
 *
 * The child's world left edge is 130 — a snap target the group must never see,
 * because the child travels with it.
 */
const base: ThemeDocument = {
  schemaVersion: 1,
  id: 'doc',
  artboard: { width: 1000, height: 600 },
  nodes: [
    {
      id: 'g',
      type: 'group',
      transform: { x: 100, y: 0, width: 200, height: 100 },
      children: [
        { id: 'child', type: 'rectangle', transform: { x: 30, y: 0, width: 50, height: 50 } },
      ],
    },
    { id: 'lone', type: 'rectangle', transform: { x: 400, y: 0, width: 50, height: 50 } },
  ],
};

const editor = (): EditorCore => new EditorCore({ document: base });

describe('a moving group does not snap to its own contents', () => {
  it('ignores a descendant as a target, because it travels with the group', () => {
    // A regression test for a guarantee the resolver already makes — it drops
    // any node whose ancestor is excluded — pinned at the manager level,
    // because the manager is what decides which ids get excluded and that is
    // the easy half to get wrong.
    //
    // Nudging the group from 100 by 29 puts its left edge one unit from its
    // own child's edge at 130. Snapping to that would make the drag catch on
    // something travelling with it.
    const core = editor();

    const delta = core.snapping.resolveMove({
      movingIds: ['g'],
      delta: { x: 29, y: 0 },
      scale: 1,
    });

    // Only the x axis is the subject here: the group's top edge sits on the
    // artboard's, so a y guide is expected and correct.
    expect(delta.x).toBe(29);
    expect(core.snapping.guides.filter((guide) => guide.axis === 'x')).toEqual([]);
  });

  it('still snaps to something outside the moving set', () => {
    // The lone box's left edge is 400. Moving the group's left edge from 100
    // by 298 lands at 398, inside the threshold.
    const core = editor();

    const delta = core.snapping.resolveMove({
      movingIds: ['g'],
      delta: { x: 298, y: 0 },
      scale: 1,
    });

    expect(delta.x).toBe(300);
    expect(core.snapping.guides.length).toBeGreaterThan(0);
  });
});

describe('the guides are transient', () => {
  it('starts empty', () => {
    expect(editor().snapping.guides).toEqual([]);
  });

  it('clears on request, so a gesture does not inherit the last one', () => {
    const core = editor();

    core.snapping.resolveMove({ movingIds: ['g'], delta: { x: 298, y: 0 }, scale: 1 });

    expect(core.snapping.guides.length).toBeGreaterThan(0);

    core.snapping.clear();

    expect(core.snapping.guides).toEqual([]);
  });

  it('clears when the moving set has no bounds to measure', () => {
    const core = editor();

    core.snapping.resolveMove({ movingIds: ['g'], delta: { x: 298, y: 0 }, scale: 1 });

    const delta = core.snapping.resolveMove({
      movingIds: ['nothing-by-this-name'],
      delta: { x: 5, y: 0 },
      scale: 1,
    });

    expect(delta).toEqual({ x: 5, y: 0 });
    expect(core.snapping.guides).toEqual([]);
  });
});

describe('the threshold is in viewport pixels', () => {
  /** One box and nothing else, so the only x target is the artboard's left edge. */
  const alone = (): EditorCore =>
    new EditorCore({
      document: {
        schemaVersion: 1,
        id: 'doc',
        artboard: { width: 1000, height: 600 },
        nodes: [{ id: 'box', type: 'rectangle', transform: { x: 400, y: 200, width: 50, height: 50 } }],
      },
    });

  it('reaches further in document units when zoomed out', () => {
    // Seven pixels should feel like seven pixels at any zoom, so the document
    // distance it covers grows as the scale shrinks. Moving the left edge
    // from 400 to 10 is ten units short of the artboard edge: out of reach at
    // 1×, within it at 0.25×.
    const core = alone();

    expect(core.snapping.resolveMove({ movingIds: ['box'], delta: { x: -390, y: 0 }, scale: 1 }).x).toBe(
      -390,
    );

    core.snapping.clear();

    expect(
      core.snapping.resolveMove({ movingIds: ['box'], delta: { x: -390, y: 0 }, scale: 0.25 }).x,
    ).toBe(-400);
  });
});
