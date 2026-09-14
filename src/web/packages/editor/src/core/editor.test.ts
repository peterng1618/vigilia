import { describe, expect, it, vi } from 'vitest';
import type { ThemeDocument } from '@vigilia/renderer-core';
import { EditorCore } from './editor.js';
import { MANAGER_REGISTRATIONS } from './registrations.js';
import type { EditorManager } from './manager.js';

const document_: ThemeDocument = {
  schemaVersion: 1,
  id: 'doc',
  artboard: { width: 800, height: 600 },
  nodes: [{ id: 'r', type: 'rectangle', transform: { x: 0, y: 0, width: 10, height: 10 } }],
};

const editor = (): EditorCore => new EditorCore({ document: document_ });

describe('the composition root builds every registered manager', () => {
  it('assigns one field per registration, and nothing is missing', () => {
    // The registration table is the only list of managers; this asserts the
    // table and the built object agree at runtime, since the type-level
    // derivation cannot see the dynamic assignment that fills the fields.
    const core = editor();

    for (const registration of MANAGER_REGISTRATIONS) {
      expect(core[registration.key], `manager "${registration.key}" was not built`).toBeDefined();
    }
  });

  it('exposes the managers under the names the table gives them', () => {
    const core = editor();

    expect(core.notice.message).toBeUndefined();
    expect(core.document.current).toBe(document_);
  });
});

describe('teardown', () => {
  it('destroys managers in the reverse of construction order', () => {
    // Reverse because a manager may have used one built before it. Taking the
    // foundation away first produces errors that look like bugs in whatever
    // ran last.
    const core = editor();
    const destroyed: string[] = [];

    for (const registration of MANAGER_REGISTRATIONS) {
      const manager = core[registration.key] as EditorManager;

      vi.spyOn(manager, 'destroy').mockImplementation(() => {
        destroyed.push(registration.key);
      });
    }

    core.destroy();

    expect(destroyed).toEqual([...MANAGER_REGISTRATIONS].map((r) => r.key).reverse());
  });

  it('drops every event subscription', () => {
    const core = editor();
    const handler = vi.fn();

    core.events.on('notice:changed', handler);
    core.destroy();
    core.events.emit('notice:changed', { message: 'x' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('is idempotent', () => {
    const core = editor();

    core.destroy();

    expect(() => {
      core.destroy();
    }).not.toThrow();
    expect(core.destroyed).toBe(true);
  });
});

describe('a manager that fails to start', () => {
  it('unwinds what was already built, and names the one that threw', () => {
    // A half-built editor that keeps its listeners attached is worse than one
    // that failed cleanly — the failure then surfaces somewhere unrelated.
    const failing = MANAGER_REGISTRATIONS[1]!;
    const destroyed: string[] = [];
    const spy = vi.spyOn(failing, 'create').mockImplementation((core) => {
      vi.spyOn(core.notice, 'destroy').mockImplementation(() => {
        destroyed.push('notice');
      });

      throw new Error('no');
    });

    expect(() => editor()).toThrow(`Editor manager "${failing.key}" failed to start.`);
    expect(destroyed).toEqual(['notice']);

    spy.mockRestore();
  });
});
