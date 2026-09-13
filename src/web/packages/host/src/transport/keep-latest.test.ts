import { describe, expect, it } from 'vitest';
import { KeepLatestSlot } from './keep-latest.js';

describe('KeepLatestSlot', () => {
  it('starts empty', () => {
    const slot = new KeepLatestSlot<number>();

    expect(slot.hasPending).toBe(false);
    expect(slot.take()).toBeUndefined();
  });

  it('holds one offered snapshot', () => {
    const slot = new KeepLatestSlot<number>();

    expect(slot.offer(1)).toBe(false);
    expect(slot.hasPending).toBe(true);
    expect(slot.take()).toBe(1);
    expect(slot.hasPending).toBe(false);
  });

  it('keeps the NEWEST snapshot, not the oldest, and never queues (§111)', () => {
    const slot = new KeepLatestSlot<number>();

    slot.offer(1);
    slot.offer(2);
    slot.offer(3);

    // The core of the rule: a slow client sees current state on its next read,
    // not a replay of the three seconds it missed.
    expect(slot.take()).toBe(3);
    expect(slot.take()).toBeUndefined();
  });

  it('reports displacement so a slow client is measurable, not assumed', () => {
    const slot = new KeepLatestSlot<string>();

    expect(slot.offer('a')).toBe(false);
    expect(slot.offer('b')).toBe(true);
    expect(slot.offer('c')).toBe(true);
    expect(slot.droppedCount).toBe(2);
  });

  it('does not count a drop when the slot was drained between offers', () => {
    const slot = new KeepLatestSlot<string>();

    slot.offer('a');
    slot.take();
    expect(slot.offer('b')).toBe(false);
    expect(slot.droppedCount).toBe(0);
    expect(slot.deliveredCount).toBe(1);
  });

  it('counts deliveries only when something was actually taken', () => {
    const slot = new KeepLatestSlot<number>();

    slot.take();
    slot.take();

    expect(slot.deliveredCount).toBe(0);
  });

  it('holds falsy values, which are legitimate snapshots', () => {
    const slot = new KeepLatestSlot<number>();

    slot.offer(0);

    // `0` is a real batch index and an empty batch is a real batch. Emptiness
    // has to be tracked separately from the value, or a zero reads as "gone".
    expect(slot.hasPending).toBe(true);
    expect(slot.take()).toBe(0);
  });
});
