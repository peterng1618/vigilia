import { describe, expect, it, vi } from 'vitest';
import type { ThemeDocument } from '@vigilia/renderer-core';
import { EditorCore } from '../core/editor.js';

const document_: ThemeDocument = {
  schemaVersion: 1,
  id: 'doc',
  artboard: { width: 800, height: 600 },
  nodes: [],
};

const editor = (): EditorCore => new EditorCore({ document: document_ });

describe('saying something', () => {
  it('holds the message and announces it', () => {
    const core = editor();
    const handler = vi.fn();

    core.events.on('notice:changed', handler);
    core.notice.show('two elements are in different groups');

    expect(core.notice.message).toBe('two elements are in different groups');
    expect(handler).toHaveBeenCalledWith({ message: 'two elements are in different groups' });
  });

  it('replaces the previous message', () => {
    const core = editor();

    core.notice.show('first');
    core.notice.show('second');

    expect(core.notice.message).toBe('second');
  });
});

describe('clearing', () => {
  it('drops the message and announces that too', () => {
    const core = editor();
    const handler = vi.fn();

    core.notice.show('something');
    core.events.on('notice:changed', handler);
    core.notice.clear();

    expect(core.notice.message).toBeUndefined();
    expect(handler).toHaveBeenCalledWith({ message: undefined });
  });
});

describe('an unchanged message is not an event', () => {
  it('stays quiet when clearing an already-clear notice', () => {
    // `clear()` runs on every pointerdown. Without this guard the status bar
    // would repaint on every press, and a subscriber could not read the event
    // as meaning "this is different now".
    const core = editor();
    const handler = vi.fn();

    core.events.on('notice:changed', handler);
    core.notice.clear();
    core.notice.clear();

    expect(handler).not.toHaveBeenCalled();
  });

  it('stays quiet when shown the same message twice', () => {
    const core = editor();
    const handler = vi.fn();

    core.notice.show('same');
    core.events.on('notice:changed', handler);
    core.notice.show('same');

    expect(handler).not.toHaveBeenCalled();
  });
});
