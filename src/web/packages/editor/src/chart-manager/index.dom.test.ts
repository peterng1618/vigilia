// @vitest-environment jsdom
import { createDemoSource, loadDemoTheme } from '@vigilia/fake-source';
import type { ImageEditor } from '@anu3ev/fabric-image-editor';
import type { SceneAdapter } from '@vigilia/scene-fabric';
import { describe, expect, it, vi } from 'vitest';
import { findNode } from '../commands.js';
import { ChartManager } from './index.js';

describe('ChartManager', () => {
  it('reapplies the shared scene after a selected chart setting changes', () => {
    const listeners = new Map<string, () => void>();
    let selectedId: string | undefined;
    const canvas = {
      on: vi.fn((event: string, listener: () => void) => listeners.set(event, listener)),
      off: vi.fn(),
      getActiveObject: vi.fn(() => selectedId === undefined ? undefined : { get: () => selectedId }),
    };
    const scene = { apply: vi.fn() } as unknown as SceneAdapter;
    const manager = new ChartManager({
      editor: { canvas } as unknown as ImageEditor,
      scene,
      source: createDemoSource(0),
      document: loadDemoTheme('demo'),
      panelHost: document.body,
    });

    expect(document.body.textContent).toContain('Select a chart');
    selectedId = 'cpu-gauge';
    listeners.get('selection:created')!();
    const thickness = document.querySelector<HTMLInputElement>('[data-vigilia-chart-setting="thickness"]')!;
    thickness.value = '24';
    thickness.dispatchEvent(new Event('change'));

    expect(scene.apply).toHaveBeenCalledTimes(1);
    expect(findNode(manager.document.nodes, 'cpu-gauge')).toMatchObject({
      content: { settings: { thickness: 24 } },
    });
    expect(document.querySelector<HTMLInputElement>('[data-vigilia-chart-setting="thickness"]')!.value).toBe('24');

    manager.destroy();
    expect(canvas.off).toHaveBeenCalledTimes(3);
  });
});
