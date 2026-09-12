import { describe, expect, it } from 'vitest';
import {
  MIN_SIZE,
  ROTATION_SNAP_DEGREES,
  applyGesture,
  handlePosition,
  normalizeDegrees,
  preserveAnchor,
  toLocalDelta,
  toLocalPoint,
  worldCentre,
  type GestureStart,
  type Handle,
} from './transform-gesture.js';
import { applyMatrix, localMatrix } from './geometry.js';
import type { Transform } from '@vigilia/renderer-core';

const box: Transform = { x: 100, y: 50, width: 200, height: 100 };

function start(handle: Handle, transform: Transform = box, origin = { x: 0, y: 0 }): GestureStart {
  return { nodes: [{ id: 'n', transform }], handle, origin };
}

/** The world position of a unit anchor on a transform. */
function anchorAt(transform: Transform, ax: number, ay: number) {
  return applyMatrix(localMatrix(transform), {
    x: (transform.width ?? 0) * ax,
    y: (transform.height ?? 0) * ay,
  });
}

describe('move', () => {
  it('offsets by the pointer delta', () => {
    const result = applyGesture(start('move'), { x: 30, y: -10 });

    expect(result.get('n')).toMatchObject({ x: 130, y: 40 });
  });

  it('moves every selected node by the same delta', () => {
    const gesture: GestureStart = {
      handle: 'move',
      origin: { x: 0, y: 0 },
      nodes: [
        { id: 'a', transform: { x: 0, y: 0, width: 10, height: 10 } },
        { id: 'b', transform: { x: 100, y: 100, width: 10, height: 10 } },
      ],
    };

    const result = applyGesture(gesture, { x: 5, y: 5 });

    expect(result.get('a')).toMatchObject({ x: 5, y: 5 });
    expect(result.get('b')).toMatchObject({ x: 105, y: 105 });
  });

  it('constrains to the dominant axis with shift', () => {
    expect(applyGesture(start('move'), { x: 40, y: 5 }, { constrain: true })).toMatchObject(
      new Map([['n', { x: 140, y: 50, width: 200, height: 100 }]]),
    );

    expect(applyGesture(start('move'), { x: 5, y: 40 }, { constrain: true }).get('n')).toMatchObject(
      { x: 100, y: 90 },
    );
  });

  it('re-decides the constrained axis as the drag continues', () => {
    // Latching the axis at the start of the gesture would leave a drag that
    // began with a 2 px wobble stuck on the wrong axis for its whole length.
    const gesture = start('move');

    expect(applyGesture(gesture, { x: 3, y: 1 }, { constrain: true }).get('n')?.x).toBe(103);
    expect(applyGesture(gesture, { x: 3, y: 60 }, { constrain: true }).get('n')?.y).toBe(110);
  });

  it('does not move a locked node (§61)', () => {
    const gesture: GestureStart = {
      handle: 'move',
      origin: { x: 0, y: 0 },
      nodes: [{ id: 'n', transform: box, locked: true }],
    };

    expect(applyGesture(gesture, { x: 50, y: 50 }).size).toBe(0);
  });

  it('returns only what changed, so an undo entry is exact', () => {
    const gesture: GestureStart = {
      handle: 'move',
      origin: { x: 0, y: 0 },
      nodes: [
        { id: 'free', transform: box },
        { id: 'pinned', transform: box, locked: true },
      ],
    };

    expect([...applyGesture(gesture, { x: 1, y: 1 }).keys()]).toEqual(['free']);
  });
});

describe('resize, unrotated', () => {
  it('grows east by the delta and keeps the west edge', () => {
    const result = applyGesture(start('e'), { x: 40, y: 0 }).get('n')!;

    expect(result.width).toBe(240);
    expect(result.x).toBe(100);
  });

  it('grows west by moving x and keeping the east edge', () => {
    const result = applyGesture(start('w'), { x: -40, y: 0 }).get('n')!;

    expect(result.width).toBe(240);
    expect(result.x).toBe(60);
    // East edge unchanged: 100 + 200 === 60 + 240.
    expect(result.x! + result.width!).toBe(300);
  });

  it('resizes both axes from a corner', () => {
    const result = applyGesture(start('se'), { x: 10, y: 20 }).get('n')!;

    expect(result.width).toBe(210);
    expect(result.height).toBe(120);
    expect(result).toMatchObject({ x: 100, y: 50 });
  });

  it('keeps the opposite corner fixed when dragging north-west', () => {
    const result = applyGesture(start('nw'), { x: -10, y: -20 }).get('n')!;

    expect(anchorAt(result, 1, 1).x).toBeCloseTo(300, 10);
    expect(anchorAt(result, 1, 1).y).toBeCloseTo(150, 10);
  });

  it('stops at a minimum size rather than flipping through zero', () => {
    // The format has no negative-size representation to flip to, and a handle
    // that inverts the node under the cursor is disorienting.
    const result = applyGesture(start('e'), { x: -1000, y: 0 }).get('n')!;

    expect(result.width).toBe(MIN_SIZE);
  });

  it('preserves aspect ratio with shift', () => {
    // 200×100, so 2:1.
    const result = applyGesture(start('se'), { x: 100, y: 0 }, { constrain: true }).get('n')!;

    expect(result.width).toBe(300);
    expect(result.height).toBeCloseTo(150, 10);
  });

  it('lets the dominant axis lead a constrained corner drag', () => {
    const result = applyGesture(start('se'), { x: 5, y: 200 }, { constrain: true }).get('n')!;

    // The vertical drag is much larger, so height leads and width follows.
    expect(result.height).toBeCloseTo(300, 10);
    expect(result.width).toBeCloseTo(600, 10);
  });

  it('resizes about the centre with alt', () => {
    const before = worldCentre(box);
    const result = applyGesture(start('e'), { x: 25, y: 0 }, { fromCentre: true }).get('n')!;

    // Both edges move outward, so the delta counts twice.
    expect(result.width).toBe(250);
    expect(worldCentre(result).x).toBeCloseTo(before.x, 10);
    expect(worldCentre(result).y).toBeCloseTo(before.y, 10);
  });
});

describe('resize, rotated — the hard case', () => {
  const rotated: Transform = { x: 100, y: 50, width: 200, height: 100, rotation: 90 };

  it('widens along the node\'s own axis, not the screen\'s', () => {
    // At 90°, the node's local +x points down the screen. So a downward drag
    // should make it wider, and a rightward drag should not.
    const down = applyGesture(start('e', rotated), { x: 0, y: 40 }).get('n')!;
    expect(down.width).toBeCloseTo(240, 6);

    const right = applyGesture(start('e', rotated), { x: 40, y: 0 }).get('n')!;
    expect(right.width).toBeCloseTo(200, 6);
  });

  it('keeps the anchored edge exactly in place', () => {
    // The bug this exists to prevent: because the node rotates about its
    // centre, changing the width swings the anchor around — so a rotated node
    // appears to slide away while being resized unless x/y are corrected.
    const before = anchorAt(rotated, 0, 0.5);
    const result = applyGesture(start('e', rotated), { x: 0, y: 40 }).get('n')!;
    const after = anchorAt(result, 0, 0.5);

    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it('keeps the opposite corner fixed for every corner handle', () => {
    const anchors = {
      nw: [1, 1],
      ne: [0, 1],
      se: [0, 0],
      sw: [1, 0],
    } as const;

    for (const [handle, [ax, ay]] of Object.entries(anchors)) {
      const before = anchorAt(rotated, ax, ay);
      const result = applyGesture(start(handle as Handle, rotated), { x: 17, y: -23 }).get('n')!;
      const after = anchorAt(result, ax, ay);

      expect(after.x, `${handle} anchor x moved`).toBeCloseTo(before.x, 6);
      expect(after.y, `${handle} anchor y moved`).toBeCloseTo(before.y, 6);
    }
  });

  it('works at an awkward angle, not just right angles', () => {
    const skew: Transform = { x: 10, y: 20, width: 150, height: 60, rotation: 37.5 };
    const before = anchorAt(skew, 1, 1);
    const result = applyGesture(start('nw', skew), { x: -12, y: 8 }).get('n')!;

    expect(anchorAt(result, 1, 1).x).toBeCloseTo(before.x, 6);
    expect(anchorAt(result, 1, 1).y).toBeCloseTo(before.y, 6);
  });

  it('leaves the rotation itself untouched', () => {
    const result = applyGesture(start('se', rotated), { x: 10, y: 10 }).get('n')!;
    expect(result.rotation).toBe(90);
  });
});

describe('rotate', () => {
  it('follows the pointer around the centre', () => {
    // Centre of the default box is (200, 100). Starting due east and dragging
    // to due south is a quarter turn.
    const result = applyGesture(
      start('rotate', box, { x: 300, y: 100 }),
      { x: 200, y: 200 },
    ).get('n')!;

    expect(result.rotation).toBeCloseTo(90, 6);
  });

  it('adds to an existing rotation', () => {
    const already: Transform = { ...box, rotation: 30 };
    const result = applyGesture(
      start('rotate', already, { x: 300, y: 100 }),
      { x: 200, y: 200 },
    ).get('n')!;

    expect(result.rotation).toBeCloseTo(120, 6);
  });

  it('snaps to 15° steps with shift', () => {
    const result = applyGesture(
      start('rotate', box, { x: 300, y: 100 }),
      { x: 260, y: 180 },
      { constrain: true },
    ).get('n')!;

    expect(result.rotation! % ROTATION_SNAP_DEGREES).toBeCloseTo(0, 6);
  });

  it('rotates a multi-selection', () => {
    const gesture: GestureStart = {
      handle: 'rotate',
      origin: { x: 300, y: 100 },
      nodes: [
        { id: 'a', transform: box },
        { id: 'b', transform: { ...box, x: 400 } },
      ],
    };

    const result = applyGesture(gesture, { x: 200, y: 200 });
    expect(result.size).toBe(2);
  });
});

describe('multi-node resize is refused rather than approximated', () => {
  it('returns nothing for a resize handle with several nodes', () => {
    // Mapping each box proportionally into scaled group bounds is not
    // expressible as a per-node width/height change once a child is rotated, so
    // attempting it would silently distort. Refusing is the honest behaviour
    // until group resize is implemented properly.
    const gesture: GestureStart = {
      handle: 'se',
      origin: { x: 0, y: 0 },
      nodes: [
        { id: 'a', transform: box },
        { id: 'b', transform: box },
      ],
    };

    expect(applyGesture(gesture, { x: 10, y: 10 }).size).toBe(0);
  });
});

describe('toLocalDelta', () => {
  it('is a no-op without rotation', () => {
    expect(toLocalDelta({ x: 3, y: 4 }, 0)).toEqual({ x: 3, y: 4 });
  });

  it('undoes the rotation', () => {
    const local = toLocalDelta({ x: 0, y: 10 }, 90);

    expect(local.x).toBeCloseTo(10, 6);
    expect(local.y).toBeCloseTo(0, 6);
  });

  it('ignores scale deliberately', () => {
    // scaleX/scaleY are a separate authored property; folding them in would
    // make a 10 px drag change the width by 5 or 20 depending on a value the
    // author set for an unrelated reason.
    expect(toLocalDelta({ x: 10, y: 0 }, 0)).toEqual({ x: 10, y: 0 });
  });
});

describe('normalizeDegrees', () => {
  it('wraps rather than clamping', () => {
    // Clamping would make a node stop rotating after a few full turns.
    expect(normalizeDegrees(370)).toBeCloseTo(10, 10);
    expect(normalizeDegrees(-370)).toBeCloseTo(-10, 10);
    expect(normalizeDegrees(720)).toBeCloseTo(0, 10);
  });

  it('stays inside the schema range', () => {
    for (const degrees of [-1000, -359, 0, 359, 1000, 1e6]) {
      const result = normalizeDegrees(degrees);
      expect(result).toBeGreaterThanOrEqual(-360);
      expect(result).toBeLessThanOrEqual(360);
    }
  });

  it('prefers the positive form of a half turn', () => {
    expect(normalizeDegrees(180)).toBe(180);
    expect(normalizeDegrees(-180)).toBe(180);
  });

  it('survives a non-finite input', () => {
    expect(normalizeDegrees(Number.NaN)).toBe(0);
  });
});

describe('preserveAnchor', () => {
  it('puts a chosen unit point back where it was', () => {
    const before: Transform = { x: 0, y: 0, width: 100, height: 100, rotation: 45 };
    const after: Transform = { ...before, width: 200 };

    const corrected = preserveAnchor(before, after, { x: 0, y: 0 });

    expect(anchorAt(corrected, 0, 0).x).toBeCloseTo(anchorAt(before, 0, 0).x, 10);
    expect(anchorAt(corrected, 0, 0).y).toBeCloseTo(anchorAt(before, 0, 0).y, 10);
  });
});

describe('handlePosition', () => {
  it('places the eight handles on the box', () => {
    expect(handlePosition(box, 'nw')).toEqual({ x: 100, y: 50 });
    expect(handlePosition(box, 'se')).toEqual({ x: 300, y: 150 });
    expect(handlePosition(box, 'n')).toEqual({ x: 200, y: 50 });
    expect(handlePosition(box, 'move')).toEqual({ x: 200, y: 100 });
  });

  it('puts the rotate handle outside the top edge, along the node\'s own up', () => {
    // Above the shape, not above the screen: at 180° it must appear below.
    const upright = handlePosition(box, 'rotate', 20);
    expect(upright.y).toBeCloseTo(30, 6);

    const upsideDown = handlePosition({ ...box, rotation: 180 }, 'rotate', 20);
    expect(upsideDown.y).toBeCloseTo(170, 6);
  });

  it('degrades to the edge when the node has no height', () => {
    expect(() => handlePosition({ x: 0, y: 0, width: 10, height: 0 }, 'rotate')).not.toThrow();
  });
});

describe('toLocalPoint', () => {
  it('brings a world point into node space', () => {
    const local = toLocalPoint(box, { x: 100, y: 50 })!;

    expect(local.x).toBeCloseTo(0, 10);
    expect(local.y).toBeCloseTo(0, 10);
  });

  it('returns undefined for a collapsed transform', () => {
    expect(toLocalPoint({ x: 0, y: 0, width: 10, height: 10, scaleX: 0 }, { x: 0, y: 0 })).toBeUndefined();
  });
});
