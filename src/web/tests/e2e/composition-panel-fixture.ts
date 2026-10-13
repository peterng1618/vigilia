/**
 * The paints the composition panel's fixture documents are authored with.
 *
 * A document's colours are its author's, not the shell's — the same reason
 * `glass-fixture.ts` holds its own — so they belong to a fixture rather than to
 * a surface. One home for the accent both the loose rects' resolved `fill` and
 * the package's `palette.accent` name, so the two cannot drift apart while the
 * panel's colour assertions keep passing.
 */

export const COMPOSITION_ACCENT = "#00b8d9";
export const COMPOSITION_WARN = "#e8b04b";
