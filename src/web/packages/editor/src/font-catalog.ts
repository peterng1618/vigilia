export type FontTrioRole = 'heading' | 'body' | 'mono';

export interface CuratedFontFace {
  readonly id: string;
  readonly role: FontTrioRole;
  readonly family: string;
  readonly weight: number;
  readonly style: 'normal' | 'italic';
  readonly format: 'woff2';
  readonly subset: string;
  readonly sourceUrl: string;
  readonly license: { readonly name: string; readonly url: string };
}

export interface FontTrio {
  readonly id: string;
  readonly name: string;
  readonly faces: readonly CuratedFontFace[];
}

const FONTSOURCE_LICENSE = { name: 'SIL Open Font License 1.1', url: 'https://openfontlicense.org/' } as const;

const TRIOS: readonly FontTrio[] = [{
  id: 'minimal',
  name: 'Minimal',
  faces: [
    face('inter-700', 'heading', 'Inter', 700, 'inter@5.1.1/latin-700-normal.woff2'),
    face('inter-400', 'body', 'Inter', 400, 'inter@5.1.1/latin-400-normal.woff2'),
    face('jetbrains-mono-400', 'mono', 'JetBrains Mono', 400, 'jetbrains-mono@5.1.1/latin-400-normal.woff2'),
  ],
}];

export function fontTrio(id: string): FontTrio | undefined {
  return TRIOS.find((trio) => trio.id === id);
}

export function fontTrios(): readonly FontTrio[] {
  return TRIOS;
}

export function faceForRole(trio: FontTrio, role: FontTrioRole, weight: number): CuratedFontFace | undefined {
  return trio.faces
    .filter((face) => face.role === role)
    .sort((left, right) => Math.abs(left.weight - weight) - Math.abs(right.weight - weight))[0];
}

/** Replaces only the face treatment of presets assigned to a trio role. */
export function applyFontTrio<T extends Readonly<Record<string, { readonly name: string; readonly value: TypePreset }>>>(
  presets: T,
  trio: FontTrio,
): T {
  return Object.fromEntries(Object.entries(presets).map(([id, preset]) => {
    const role = preset.value.trioRole;
    if (role === undefined) return [id, preset];
    const face = faceForRole(trio, role, Number(preset.value.weight ?? 400));
    if (face === undefined) return [id, preset];
    return [id, {
      ...preset,
      value: { ...preset.value, family: face.family, weight: face.weight, face: { assetId: face.id } },
    }];
  })) as T;
}

function face(id: string, role: FontTrioRole, family: string, weight: number, artifact: string): CuratedFontFace {
  return {
    id, role, family, weight, style: 'normal', format: 'woff2', subset: 'latin',
    sourceUrl: `https://cdn.jsdelivr.net/fontsource/fonts/${artifact}`,
    license: FONTSOURCE_LICENSE,
  };
}
import type { TypePreset } from '@vigilia/renderer-core';
