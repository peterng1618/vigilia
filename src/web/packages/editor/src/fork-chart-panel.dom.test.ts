// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createForkChartPanel } from './chart-manager/panel.js';

describe('fork chart property panel', () => {
  it('derives controls from the shared field descriptors and returns authored settings', () => {
    const change = vi.fn();
    const panel = createForkChartPanel(document.body, change, vi.fn());
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
  });
});
