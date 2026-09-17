// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { ShortcutManager } from './index.js';

describe('ShortcutManager', () => {
  it('claims registered Vigilia actions and leaves all other fork keys alone', () => {
    const manager = new ShortcutManager();
    const save = vi.fn();
    manager.register('file.save', save);
    const handled = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true });
    const forkKey = new KeyboardEvent('keydown', { key: 'g', ctrlKey: true, cancelable: true });

    window.dispatchEvent(handled);
    window.dispatchEvent(forkKey);

    expect(save).toHaveBeenCalledOnce();
    expect(handled.defaultPrevented).toBe(true);
    expect(forkKey.defaultPrevented).toBe(false);
    manager.destroy();
  });

  it('does not steal non-file shortcuts from an editable field', () => {
    const manager = new ShortcutManager();
    const undo = vi.fn();
    manager.register('edit.undo', undo);
    const input = document.createElement('input');
    const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true });
    input.dispatchEvent(event);

    expect(undo).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    manager.destroy();
  });
});
