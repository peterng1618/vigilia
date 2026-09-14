import { describe, expect, it, vi } from 'vitest';
import { EditorEmitter } from './events.js';

describe('the emitter delivers to subscribers', () => {
  it('calls every handler with the payload, in subscription order', () => {
    const emitter = new EditorEmitter();
    const order: string[] = [];

    emitter.on('notice:changed', (payload) => {
      order.push(`first:${payload.message ?? 'cleared'}`);
    });
    emitter.on('notice:changed', (payload) => {
      order.push(`second:${payload.message ?? 'cleared'}`);
    });

    emitter.emit('notice:changed', { message: 'hello' });

    expect(order).toEqual(['first:hello', 'second:hello']);
  });

  it('is silent when nothing is listening', () => {
    const emitter = new EditorEmitter();

    expect(() => {
      emitter.emit('notice:changed', { message: undefined });
    }).not.toThrow();
  });

  it('does not deliver the same handler twice when subscribed twice', () => {
    // A Set, not an array: double-subscribing is a mistake, and delivering
    // twice turns it into a double redraw that is hard to attribute.
    const emitter = new EditorEmitter();
    const handler = vi.fn();

    emitter.on('notice:changed', handler);
    emitter.on('notice:changed', handler);
    emitter.emit('notice:changed', { message: 'x' });

    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('unsubscribing', () => {
  it('stops delivery through the returned function', () => {
    const emitter = new EditorEmitter();
    const handler = vi.fn();
    const unsubscribe = emitter.on('notice:changed', handler);

    unsubscribe();
    emitter.emit('notice:changed', { message: 'x' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('is harmless to unsubscribe twice, or to remove an unknown handler', () => {
    const emitter = new EditorEmitter();
    const unsubscribe = emitter.on('notice:changed', vi.fn());

    unsubscribe();

    expect(() => {
      unsubscribe();
      emitter.off('notice:changed', vi.fn());
    }).not.toThrow();
    expect(emitter.listenerCount('notice:changed')).toBe(0);
  });

  it('still delivers to the remaining handlers when one unsubscribes mid-emit', () => {
    // The "listen once" idiom. Iterating the live set skips whichever handler
    // follows the one that removed itself, which is the sort of bug that shows
    // up as a panel that redraws only sometimes.
    const emitter = new EditorEmitter();
    const second = vi.fn();

    const unsubscribeFirst = emitter.on('notice:changed', () => {
      unsubscribeFirst();
    });
    emitter.on('notice:changed', second);

    emitter.emit('notice:changed', { message: 'x' });

    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe('clear', () => {
  it('drops every subscription', () => {
    const emitter = new EditorEmitter();
    const handler = vi.fn();

    emitter.on('notice:changed', handler);
    emitter.clear();
    emitter.emit('notice:changed', { message: 'x' });

    expect(handler).not.toHaveBeenCalled();
    expect(emitter.listenerCount('notice:changed')).toBe(0);
  });
});
