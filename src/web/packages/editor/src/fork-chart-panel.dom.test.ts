// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createForkChartPanel } from './chart-manager/panel.js';

describe('fork chart property panel', () => {
  it('derives controls from the shared field descriptors and returns authored settings', () => {
    const change = vi.fn();
    const bindingChange = vi.fn();
    const panel = createForkChartPanel(document.body, change, bindingChange);
    const content = {
      family: 'gauge' as const,
      settings: {
        startAngle: 90, endAngle: -270, min: 0, max: 100, thickness: 10,
        track: { kind: 'solid' as const, color: '#000000' }, progress: { kind: 'solid' as const, color: '#ffffff' }, roundCap: true,
      },
    };

    panel.render({ id: 'cpu-gauge', content, bindings: [{ id: 'cpu', semanticKey: 'cpu.load' }] });

    const thickness = panel.root.querySelector<HTMLInputElement>('[data-vigilia-chart-setting="thickness"]')!;
    expect(thickness.value).toBe('10');
    thickness.value = '20';
    thickness.dispatchEvent(new Event('change'));

    expect(change).toHaveBeenCalledWith('cpu-gauge', expect.objectContaining({ thickness: 20 }));
    expect(panel.root.querySelector('[data-vigilia-chart-setting="track"]')).toBeNull();

    const binding = panel.root.querySelector<HTMLSelectElement>('[data-vigilia-binding="cpu"]')!;
    binding.value = 'ram.used';
    binding.dispatchEvent(new Event('change'));
    expect(bindingChange).toHaveBeenCalledWith('cpu-gauge', { id: 'cpu', semanticKey: 'ram.used' });

    const precision = panel.root.querySelector<HTMLInputElement>('[data-vigilia-binding-field="cpu.precision"]')!;
    precision.value = '2';
    precision.dispatchEvent(new Event('change'));
    expect(bindingChange).toHaveBeenLastCalledWith('cpu-gauge', { id: 'cpu', semanticKey: 'cpu.load', precision: 2 });

    const unitDisplay = panel.root.querySelector<HTMLSelectElement>('[data-vigilia-binding-field="cpu.unitDisplay"]')!;
    unitDisplay.value = 'long';
    unitDisplay.dispatchEvent(new Event('change'));
    expect(bindingChange).toHaveBeenLastCalledWith('cpu-gauge', { id: 'cpu', semanticKey: 'cpu.load', unitDisplay: 'long' });

    const scale = panel.root.querySelector<HTMLInputElement>('[data-vigilia-binding-field="cpu.scale"]')!;
    scale.value = '1.5';
    scale.dispatchEvent(new Event('change'));
    expect(bindingChange).toHaveBeenLastCalledWith('cpu-gauge', { id: 'cpu', semanticKey: 'cpu.load', scale: 1.5 });

    const offset = panel.root.querySelector<HTMLInputElement>('[data-vigilia-binding-field="cpu.offset"]')!;
    offset.value = '-4';
    offset.dispatchEvent(new Event('change'));
    expect(bindingChange).toHaveBeenLastCalledWith('cpu-gauge', { id: 'cpu', semanticKey: 'cpu.load', offset: -4 });
  });
});
