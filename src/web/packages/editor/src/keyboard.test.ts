import { describe, expect, it } from 'vitest';

import { deferToTarget, isKeyboardConsumingTarget, survivesTextEntry } from './keyboard.js';

describe('isKeyboardConsumingTarget', () => {
  it('treats no target as the canvas', () => {
    expect(isKeyboardConsumingTarget(undefined)).toBe(false);
    expect(isKeyboardConsumingTarget(null)).toBe(false);
  });

  it('claims textareas and contenteditable hosts', () => {
    expect(isKeyboardConsumingTarget({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isKeyboardConsumingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });

  it('claims a select, whose value the arrow keys change', () => {
    expect(isKeyboardConsumingTarget({ tagName: 'SELECT' })).toBe(true);
  });

  it('claims text-accepting inputs', () => {
    for (const type of ['text', 'search', 'email', 'url', 'tel', 'password', 'number']) {
      expect(isKeyboardConsumingTarget({ tagName: 'INPUT', type })).toBe(true);
    }
  });

  it('claims inputs the arrow keys drive', () => {
    expect(isKeyboardConsumingTarget({ tagName: 'INPUT', type: 'range' })).toBe(true);
    expect(isKeyboardConsumingTarget({ tagName: 'INPUT', type: 'date' })).toBe(true);
  });

  it('treats an input with no type as the text field it renders as', () => {
    expect(isKeyboardConsumingTarget({ tagName: 'INPUT' })).toBe(true);
  });

  it('is case-insensitive about the type attribute', () => {
    expect(isKeyboardConsumingTarget({ tagName: 'INPUT', type: 'CHECKBOX' })).toBe(false);
  });

  it('leaves inputs that ignore these keys alone, so Delete still deletes', () => {
    for (const type of ['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'color']) {
      expect(isKeyboardConsumingTarget({ tagName: 'INPUT', type })).toBe(false);
    }
  });

  it('does not claim ordinary elements', () => {
    expect(isKeyboardConsumingTarget({ tagName: 'DIV' })).toBe(false);
    expect(isKeyboardConsumingTarget({ tagName: 'BUTTON' })).toBe(false);
    expect(isKeyboardConsumingTarget({ tagName: 'DIV', isContentEditable: false })).toBe(false);
  });
});

describe('survivesTextEntry', () => {
  it('keeps the file shortcuts, whose browser defaults are wrong here', () => {
    expect(survivesTextEntry('s', true)).toBe(true);
    expect(survivesTextEntry('S', true)).toBe(true);
    expect(survivesTextEntry('o', true)).toBe(true);
  });

  it('stands down for undo, so the field undoes its own edit', () => {
    expect(survivesTextEntry('z', true)).toBe(false);
    expect(survivesTextEntry('y', true)).toBe(false);
  });

  it('stands down for the document shortcuts', () => {
    expect(survivesTextEntry('g', true)).toBe(false);
  });

  it('never keeps an unmodified key', () => {
    for (const key of ['s', 'o', 'Backspace', 'Delete', 'ArrowLeft', 'Escape']) {
      expect(survivesTextEntry(key, false)).toBe(false);
    }
  });
});

describe('deferToTarget', () => {
  const field: { tagName: string; type: string } = { tagName: 'INPUT', type: 'text' };

  it('is the reported bug: editing keys must not reach the document', () => {
    // §Task 2 of the fifth handoff: Backspace deleted the selected element
    // while the author was typing a label.
    expect(deferToTarget(field, 'Backspace', false)).toBe(true);
    expect(deferToTarget(field, 'Delete', false)).toBe(true);
    expect(deferToTarget(field, 'ArrowLeft', false)).toBe(true);
    expect(deferToTarget(field, 'ArrowUp', false)).toBe(true);
    expect(deferToTarget(field, 'Escape', false)).toBe(true);
    expect(deferToTarget(field, 'z', true)).toBe(true);
    expect(deferToTarget(field, 'g', true)).toBe(true);
  });

  it('still saves and opens from inside a field', () => {
    expect(deferToTarget(field, 's', true)).toBe(false);
    expect(deferToTarget(field, 'o', true)).toBe(false);
  });

  it('leaves every shortcut alone when the canvas has focus', () => {
    expect(deferToTarget(undefined, 'Backspace', false)).toBe(false);
    expect(deferToTarget({ tagName: 'DIV' }, 'ArrowUp', false)).toBe(false);
    expect(deferToTarget({ tagName: 'INPUT', type: 'checkbox' }, 'Delete', false)).toBe(false);
  });
});
