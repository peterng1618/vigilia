// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createTypePresetPanel } from './type-preset-panel.js';

describe('type preset panel', () => {
  it('edits a global type token', () => {
    const onChange = vi.fn();
    const panel = createTypePresetPanel(document.body, onChange);
    panel.render({ body: { name: 'Body', value: { family: 'Inter', size: 16 } } });
    const size = document.querySelector<HTMLInputElement>('[data-vigilia-type-size]')!;
    size.value = '18'; size.dispatchEvent(new Event('change'));
    expect(onChange).toHaveBeenLastCalledWith({ body: { name: 'Body', value: { family: 'Inter', size: 18 } } });
  });
});
