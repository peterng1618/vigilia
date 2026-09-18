import { Group, type StaticCanvas } from 'fabric/es';
import type { Globals } from '@vigilia/renderer-core';
import { VIGILIA_TEXT_PROPERTY } from './fabric-text.js';

/** Reapply the first authored run's type preset to its Fabric text-object cache. */
export function applyObjectTypePresets(canvas: StaticCanvas, globals: Globals | undefined): void {
  if (typeof (canvas as unknown as { getObjects?: unknown }).getObjects !== 'function') return;
  applyTypes(canvas.getObjects(), globals);
  canvas.requestRenderAll();
}

function applyTypes(objects: readonly PaintableObject[], globals: Globals | undefined): void {
  for (const object of objects) {
    const run = firstRun(object.get(VIGILIA_TEXT_PROPERTY));
    const ref = run?.['typePreset'];
    const value = typeof ref === 'string' && ref.startsWith('typePresets.')
      ? globals?.typePresets?.[ref.slice('typePresets.'.length)]?.value
      : undefined;
    if (isPreset(value)) {
      object.set({ fontFamily: value.family, fontSize: value.size, ...(value.weight === undefined ? {} : { fontWeight: value.weight }), ...(value.lineHeight === undefined ? {} : { lineHeight: value.lineHeight }) });
    }
    if (object instanceof Group) applyTypes(object.getObjects(), globals);
  }
}

type PaintableObject = { get(name: string): unknown; set(value: Record<string, unknown>): unknown };

function firstRun(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || !Array.isArray((value as Record<string, unknown>)['runs'])) return undefined;
  const run = (value as { runs: unknown[] }).runs[0];
  return typeof run === 'object' && run !== null ? run as Record<string, unknown> : undefined;
}

function isPreset(value: unknown): value is { family: string; size: number; weight?: string | number; letterSpacing?: number; lineHeight?: number } {
  return typeof value === 'object' && value !== null && typeof (value as Record<string, unknown>)['family'] === 'string' && typeof (value as Record<string, unknown>)['size'] === 'number';
}
