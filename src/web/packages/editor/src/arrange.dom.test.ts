// @vitest-environment jsdom
import { ActiveSelection, Rect } from 'fabric/es';
import type { ImageEditor } from '@anu3ev/fabric-image-editor';
import { describe, expect, it, vi } from 'vitest';
import { applyArrange, canArrange } from './arrange.js';

describe('selection-relative arrange actions', () => {
  it('aligns rendered left edges and preserves the active selection', () => {
    const first = rectangle(10, 20, 20, 10);
    const rotated = rectangle(80, 30, 20, 10, 45);
    const last = rectangle(140, 40, 10, 20);
    const { editor, selection, historyManager } = editorFor(first, rotated, last);

    expect(applyArrange(editor, 'align-left')).toBe(true);
    expect([first, rotated, last].map((object) => object.getBoundingRect().left)).toEqual([
      first.getBoundingRect().left, first.getBoundingRect().left, first.getBoundingRect().left,
    ]);
    expect(editor.canvas.getActiveObject()).toBe(selection);
    expect(historyManager.saveState).toHaveBeenCalledTimes(1);
  });

  it('requires three unlocked objects for distribution without creating history for rejection', () => {
    const two = editorFor(rectangle(0, 0, 10, 10), rectangle(50, 0, 10, 10));
    expect(canArrange(two.editor, 'align-left')).toBe(true);
    expect(canArrange(two.editor, 'distribute-x')).toBe(false);
    expect(applyArrange(two.editor, 'distribute-x')).toBe(false);
    expect(two.historyManager.saveState).not.toHaveBeenCalled();

    const locked = rectangle(0, 0, 10, 10);
    Object.assign(locked, { locked: true });
    const lockedSelection = editorFor(locked, rectangle(50, 0, 10, 10));
    expect(canArrange(lockedSelection.editor, 'align-top')).toBe(false);
    expect(applyArrange(lockedSelection.editor, 'align-top')).toBe(false);
    expect(lockedSelection.historyManager.saveState).not.toHaveBeenCalled();
  });

  it('keeps distribution endpoints fixed and equalizes intermediate gaps', () => {
    const first = rectangle(0, 0, 10, 10);
    const middle = rectangle(50, 0, 20, 10);
    const last = rectangle(100, 0, 30, 10);
    const { editor, historyManager } = editorFor(first, middle, last);
    const firstLeft = first.getBoundingRect().left;
    const lastRight = last.getBoundingRect().left + last.getBoundingRect().width;

    expect(applyArrange(editor, 'distribute-x')).toBe(true);

    const firstRight = first.getBoundingRect().left + first.getBoundingRect().width;
    const middleLeft = middle.getBoundingRect().left;
    const middleRight = middleLeft + middle.getBoundingRect().width;
    expect(first.getBoundingRect().left).toBe(firstLeft);
    expect(last.getBoundingRect().left + last.getBoundingRect().width).toBe(lastRight);
    expect(middleLeft - firstRight).toBe(middleRight <= last.getBoundingRect().left ? last.getBoundingRect().left - middleRight : NaN);
    expect(historyManager.saveState).toHaveBeenCalledTimes(1);
  });
});

function rectangle(left: number, top: number, width: number, height: number, angle = 0): Rect {
  return new Rect({ left, top, width, height, angle, originX: 'left', originY: 'top' });
}

function editorFor(...objects: readonly Rect[]) {
  const selection = new ActiveSelection([...objects]);
  const historyManager = { saveState: vi.fn() };
  const canvas = {
    getActiveObject: vi.fn(() => selection),
    setActiveObject: vi.fn((next) => { canvas.getActiveObject.mockReturnValue(next); }),
    requestRenderAll: vi.fn(),
  };
  const editor = { canvas, historyManager } as unknown as ImageEditor;
  return { editor, selection, historyManager };
}
