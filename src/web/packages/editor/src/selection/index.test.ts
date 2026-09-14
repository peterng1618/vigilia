import { describe, expect, it } from 'vitest';
import type { ThemeDocument, ThemeNode } from '@vigilia/renderer-core';
import { EditorCore } from '../core/editor.js';
import { deleteNodes } from '../commands.js';

const box = (id: string, x: number): ThemeNode => ({
  id,
  type: 'rectangle',
  transform: { x, y: 0, width: 20, height: 20 },
});

const document_: ThemeDocument = {
  schemaVersion: 1,
  id: 'doc',
  artboard: { width: 800, height: 600 },
  nodes: [
    box('a', 0),
    box('b', 100),
    {
      id: 'g',
      type: 'group',
      transform: { x: 200, y: 0, width: 100, height: 100 },
      children: [box('child', 0)],
    },
  ],
};

const editor = (): EditorCore => new EditorCore({ document: document_ });

describe('the modifier policy', () => {
  it('treats shift as toggle and a plain click as replace', () => {
    const core = editor();

    expect(core.selection.modeFor({ shiftKey: true })).toBe('toggle');
    expect(core.selection.modeFor({ shiftKey: false })).toBe('replace');
  });

  it('does not let ctrl change what is selected', () => {
    // Ctrl means "disable snapping" during a move. When it also meant
    // "toggle", holding it to avoid a snap silently changed what was being
    // dragged — at worst adding an ancestor of the node under the cursor, so
    // the gesture moved both and sent the child twice as far as the pointer.
    const core = editor();

    expect(core.selection.modeFor({ shiftKey: false })).toBe('replace');
  });
});

describe('clicking', () => {
  it('replaces by default and toggles with shift', () => {
    const core = editor();

    core.selection.applyClick('a');

    expect(core.selection.ids).toEqual(['a']);

    core.selection.applyClick('b', 'toggle');

    expect(core.selection.ids).toEqual(['a', 'b']);

    core.selection.applyClick('a', 'toggle');

    expect(core.selection.ids).toEqual(['b']);
  });

  it('reports the count and the anchor', () => {
    const core = editor();

    core.selection.applyClick('a');
    core.selection.applyClick('b', 'toggle');

    expect(core.selection.count).toBe(2);
    expect(core.selection.anchor).toBe('b');
    expect(core.selection.includes('a')).toBe(true);
  });
});

describe('hit-testing carries the entered groups for you', () => {
  it('resolves a click inside an unentered group to the group', () => {
    const core = editor();

    expect(core.selection.hitTest(document_.nodes, { x: 210, y: 10 })).toBe('g');
  });

  it('resolves to the child once the group has been entered', () => {
    // The parameter that used to be passed by hand at each call site. Three
    // sites remembered; the fourth would eventually not, and the symptom is a
    // click selecting a group the author is standing inside.
    const core = editor();

    core.selection.enterGroup('g');

    expect(core.selection.hitTest(document_.nodes, { x: 210, y: 10 })).toBe('child');
  });

  it('applies the same rule to a marquee', () => {
    const core = editor();

    expect(core.selection.marquee(document_.nodes, { left: -5, top: -5, right: 305, bottom: 105 })).toEqual([
      'a',
      'b',
      'g',
    ]);

    core.selection.enterGroup('g');

    expect(core.selection.marquee(document_.nodes, { left: 195, top: -5, right: 305, bottom: 105 })).toEqual([
      'child',
    ]);
  });
});

describe('entering and leaving groups', () => {
  it('clears the selection on entry and reselects the group on exit', () => {
    const core = editor();

    core.selection.applyClick('g');
    core.selection.enterGroup('g');

    expect(core.selection.ids).toEqual([]);
    expect(core.selection.enteredGroups).toEqual(['g']);

    core.selection.exitGroup();

    expect(core.selection.ids).toEqual(['g']);
    expect(core.selection.enteredGroups).toEqual([]);
  });

  it('drops everything on exitAll, as opening a file does', () => {
    const core = editor();

    core.selection.enterGroup('g');
    core.selection.applyClick('child');
    core.selection.exitAll();

    expect(core.selection.ids).toEqual([]);
    expect(core.selection.enteredGroups).toEqual([]);
  });
});

describe('pruning against the document', () => {
  it('drops ids the document no longer has', () => {
    // A selection pointing at a deleted node is how an editor applies an
    // inspector change to nothing, or crashes on the next gesture.
    const core = editor();

    core.selection.applyClick('a');
    core.selection.applyClick('b', 'toggle');
    core.document.commit('Delete', deleteNodes(document_, new Set(['a'])));
    core.selection.pruneToDocument();

    expect(core.selection.ids).toEqual(['b']);
  });

  it('prunes against the visible document, so it is right mid-gesture too', () => {
    const core = editor();

    core.selection.applyClick('a');
    core.selection.pruneToDocument();

    expect(core.selection.ids).toEqual(['a']);
  });
});
