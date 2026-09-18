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

  it('requires a replacement before deleting a type token', () => {
    const remove = vi.fn();
    const panel = createTypePresetPanel(document.body, vi.fn(), remove);
    panel.render({
      body: { name: 'Body', value: { family: 'Inter', size: 16 } },
      caption: { name: 'Caption', value: { family: 'Inter', size: 12 } },
    });
    const preset = document.querySelector<HTMLSelectElement>('[data-vigilia-type-preset]')!;
    preset.value = 'body';
    preset.dispatchEvent(new Event('change'));

    const replacement = document.querySelector<HTMLSelectElement>('[data-vigilia-type-replacement]')!;
    replacement.value = 'caption';
    document.querySelector<HTMLButtonElement>('[data-vigilia-type-delete]')!.click();

    expect(remove).toHaveBeenCalledWith('body', 'caption');
  });
});
