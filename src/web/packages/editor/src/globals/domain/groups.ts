import type { GlobalGroupName } from '@vigilia/renderer-core';

/**
 * What each group of theme tokens is called, how it is edited, and what a new
 * one starts as.
 *
 * `GLOBAL_GROUPS` — which groups exist — is owned by
 * `renderer-core/src/theme/document.ts`, because the persisted format defines
 * it. This is the editor's view of those groups, keyed by that union so adding
 * a group upstream is a compile error here rather than a section that silently
 * fails to appear.
 *
 * The seed is the interesting half: it is the only statement of what an author
 * gets when they add a token, and it belongs with the rule rather than in the
 * panel that happens to draw the button. (The equivalent answer for *nodes* —
 * what a new rectangle starts as — still has no owner; see
 * `architecture.md`'s gap list.)
 */
export const GLOBAL_GROUP_META: Record<
  GlobalGroupName,
  { readonly label: string; readonly kind: 'colour' | 'number' | 'text'; readonly seed: unknown }
> = {
  palette: { label: 'Palette', kind: 'colour', seed: '#8a97ab' },
  fonts: { label: 'Fonts', kind: 'text', seed: 'system-ui, sans-serif' },
  fontSizes: { label: 'Font sizes', kind: 'number', seed: 16 },
  spacing: { label: 'Spacing', kind: 'number', seed: 8 },
  assets: { label: 'Assets', kind: 'text', seed: '' },
};

/**
 * The display name and value a newly added token starts with.
 *
 * The name is the group's label made singular, so adding to Font sizes gives
 * "Font size" rather than the group's own plural.
 */
export function seedForGroup(group: GlobalGroupName): { name: string; value: unknown } {
  const meta = GLOBAL_GROUP_META[group];

  return { name: meta.label.replace(/s$/, ''), value: meta.seed };
}
