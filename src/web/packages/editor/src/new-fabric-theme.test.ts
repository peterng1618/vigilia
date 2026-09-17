// @vitest-environment jsdom
import { StaticCanvas } from 'fabric/es';
import { reviveThemeEnvelope, VigiliaChart } from '@vigilia/scene-fabric';
import { describe, expect, it } from 'vitest';
import { validateFabricThemeEnvelope } from '@vigilia/renderer-core';
import { createNewFabricTheme } from './new-fabric-theme.js';

describe('the new Fabric document', () => {
  it('starts with a validated v2 dashboard that includes the supported showcase surface', () => {
    const document_ = createNewFabricTheme();

    expect(validateFabricThemeEnvelope(document_)).toEqual({ ok: true, envelope: document_ });
    expect(document_.scene.objects).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'background' }),
      expect.objectContaining({ id: 'weather-cloud-svg-path', type: 'Path' }),
      expect.objectContaining({ id: 'time', type: 'Textbox' }),
      expect.objectContaining({ id: 'load-gauge', type: 'VigiliaChart', family: 'gauge' }),
      expect.objectContaining({ id: 'trend-line', type: 'VigiliaChart', family: 'line' }),
      expect.objectContaining({ id: 'thermal-bars', type: 'VigiliaChart', family: 'bar' }),
      expect.objectContaining({ id: 'resource-pie', type: 'VigiliaChart', family: 'pie' }),
    ]));
    expect(document_.scene.objects).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'background', originX: 'left', originY: 'top' }),
      expect.objectContaining({ id: 'trend-line', originX: 'center', originY: 'center' }),
    ]));
    const objects = document_.scene.objects as readonly Readonly<Record<string, unknown>>[];
    expect(objects.find((object) => object['id'] === 'background')).toMatchObject({ selectable: false, evented: false });
    expect(objects.find((object) => object['id'] === 'load-gauge')).not.toMatchObject({ selectable: false });
  });

  it('revives the gradient, SVG-derived paths, and all four chart families', async () => {
    const theme = createNewFabricTheme();
    const canvas = new StaticCanvas(undefined, { width: theme.artboard.width, height: theme.artboard.height });
    await reviveThemeEnvelope(canvas, theme);

    expect(canvas.getObjects().find((object) => object.get('id') === 'background')?.fill).toMatchObject({ type: 'linear' });
    expect(canvas.getObjects().filter((object) => object instanceof VigiliaChart)).toHaveLength(4);
    canvas.dispose();
  });
});
