// @vitest-environment jsdom
import { createDemoSource } from '@vigilia/fake-source';
import type { ImageEditor } from '@anu3ev/fabric-image-editor';
import { VigiliaChart, type SceneAdapter } from '@vigilia/scene-fabric';
import { describe, expect, it, vi } from 'vitest';
import { defaultGaugeSettings } from '@vigilia/renderer-core';
import { ChartManager } from './index.js';

describe('ChartManager', () => {
  it('updates the selected Fabric chart from envelope bindings', () => {
    const listeners = new Map<string, () => void>();
    const chart = Object.assign(Object.create(VigiliaChart.prototype), {
      id: 'cpu-gauge', family: 'gauge', settings: { ...defaultGaugeSettings, track: { ref: 'palette.track' }, progress: { ref: 'palette.accent' } },
    }) as VigiliaChart;
    let revivedChart = chart;
    const canvas = {
      on: vi.fn((event: string, listener: () => void) => listeners.set(event, listener)),
      off: vi.fn(),
      getActiveObject: vi.fn(() => chart),
      getObjects: vi.fn(() => [revivedChart]),
      requestRenderAll: vi.fn(),
    };
    const scene = { objectFor: vi.fn(() => chart) } as unknown as SceneAdapter;
    const manager = new ChartManager({
      editor: { canvas } as unknown as ImageEditor,
      scene,
      source: createDemoSource(0),
      bindings: { 'cpu-gauge': [{ id: 'cpu', semanticKey: 'cpu.load' }] },
      globals: { palette: {
        none: { name: 'None', value: { kind: 'solid', color: 'transparent' } },
        track: { name: 'Track', value: { kind: 'solid', color: '#223344' } },
        accent: { name: 'Accent', value: { kind: 'solid', color: '#00b8d9' } },
      } },
      panelHost: document.body,
    });

    expect(chart.option).toMatchObject({ series: expect.any(Array) });

    listeners.get('selection:created')!();
    const binding = document.querySelector<HTMLSelectElement>('[data-vigilia-binding="cpu"]')!;
    binding.value = 'ram.used';
    binding.dispatchEvent(new Event('change'));
    expect(chart.option).toMatchObject({ series: expect.any(Array) });

    const thickness = document.querySelector<HTMLInputElement>('[data-vigilia-chart-setting="thickness"]')!;
    thickness.value = '24';
    thickness.dispatchEvent(new Event('change'));

    expect(chart.settings).toMatchObject({ thickness: 24 });
    expect(document.querySelector<HTMLInputElement>('[data-vigilia-chart-setting="thickness"]')!.value).toBe('24');

    const progress = document.querySelector<HTMLSelectElement>('[data-vigilia-chart-paint="progress"]')!;
    progress.value = 'palette.track';
    progress.dispatchEvent(new Event('change'));
    expect(chart.settings).toMatchObject({ progress: { ref: 'palette.track' } });

    revivedChart = Object.assign(Object.create(VigiliaChart.prototype), {
      id: 'cpu-gauge', family: 'gauge', settings: chart.settings,
    }) as VigiliaChart;
    listeners.get('editor:history-state-loaded')!();
    expect(revivedChart.option).toMatchObject({ series: expect.any(Array) });

    manager.destroy();
    expect(canvas.off).toHaveBeenCalledTimes(4);
  });
});
