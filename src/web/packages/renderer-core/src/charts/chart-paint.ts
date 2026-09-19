import type { FabricPalette } from '../theme/fabric-envelope.js';
import type { Fill, GradientStop } from '../types.js';

/** Persisted chart paint: a palette token, or threshold bands of solid tokens. */
export type ChartPaint = Fill | { readonly ref: string } | {
  readonly kind: 'thresholds';
  readonly bands: readonly { readonly offset: number; readonly ref: string }[];
};

/** Resolve token references at the renderer boundary; persisted settings retain refs. */
export function resolveChartPaint(paint: ChartPaint, palette: FabricPalette | undefined): Fill {
  if ('ref' in paint) return paletteFill(paint.ref, palette);
  if (paint.kind !== 'thresholds' || paint.bands.length === 0 || !('ref' in paint.bands[0]!)) return paint as Fill;
  return {
    kind: 'thresholds',
    bands: paint.bands.map((band) => ({ offset: band.offset, color: solidColor('ref' in band ? band.ref : '', palette) })),
  };
}

/** Reassign token references without touching engine-only resolved fills. */
export function reassignChartPaintReferences<T>(value: T, from: string, to: string): T {
  if (Array.isArray(value)) {
    const next = value.map((entry) => reassignChartPaintReferences(entry, from, to));
    return next.some((entry, index) => entry !== value[index]) ? next as T : value;
  }
  if (typeof value !== 'object' || value === null) return value;
  const record = value as Record<string, unknown>;
  if (record['ref'] === from) return { ...record, ref: to } as T;
  const entries = Object.entries(record).map(([key, entry]) => [key, reassignChartPaintReferences(entry, from, to)] as const);
  return entries.some(([key, entry]) => entry !== record[key]) ? Object.fromEntries(entries) as T : value;
}

function paletteFill(ref: string, palette: FabricPalette | undefined): Fill {
  const value = token(ref, palette)?.value;
  if (value?.kind === 'solid') return { kind: 'solid', color: value.color };
  if (value?.kind === 'gradient') return { kind: 'gradient', stops: value.stops };
  return { kind: 'solid', color: 'transparent' };
}

function solidColor(ref: string, palette: FabricPalette | undefined): string {
  const value = token(ref, palette)?.value;
  return value?.kind === 'solid' ? value.color : 'transparent';
}

function token(ref: string, palette: FabricPalette | undefined): { readonly value: { readonly kind: 'solid'; readonly color: string } | { readonly kind: 'gradient'; readonly stops: readonly GradientStop[] } } | undefined {
  if (!ref.startsWith('palette.')) return undefined;
  const entry = palette?.[ref.slice('palette.'.length)];
  if (entry === undefined) return undefined;
  return entry as never;
}
