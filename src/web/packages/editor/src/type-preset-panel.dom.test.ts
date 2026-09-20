// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createTypePresetPanel } from './type-preset-panel.js';
import { fontTrio } from './font-catalog.js';

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

  it('offers a shared curated face picker for the selected preset', async () => {
    const applyFace = vi.fn(async () => {});
    const panel = createTypePresetPanel(document.body, vi.fn(), undefined, { applyFace, applyTrio: vi.fn(async () => {}), preview: vi.fn(async () => {}) });
    panel.render({ body: { name: 'Body', value: { family: 'Inter', size: 16, trioRole: 'body' } } });

    const face = document.querySelector<HTMLSelectElement>('[data-vigilia-font-face]')!;
    face.value = fontTrio('minimal')!.faces[0]!.id;
    document.querySelector<HTMLButtonElement>('[data-vigilia-font-apply]')!.click();
    await Promise.resolve();

    expect(applyFace).toHaveBeenCalledWith('body', fontTrio('minimal')!.faces[0]);
  });
});
