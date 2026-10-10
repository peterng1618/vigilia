import type { FabricGlobals, FabricPalette } from "@vigilia/renderer-core";
import { resolveToken, resolveTypePreset } from "./appearance.js";

/**
 * What the document offers, resolved: the palette tokens and type presets an
 * object can reference, read from the document's own globals rather than through
 * a selection. The rendering is the Document pane's References section
 * (`panes/document/references.tsx`); this file owns the walk, and `appearance.ts`
 * owns the resolvers, so there is one answer to "what does this reference mean".
 *
 * Read-only by design. Every value here is edited in the palette and type-preset
 * panels beside the section; a second editable copy would be a second owner.
 */

/** One reference the document offers: the stored reference, the name the author
 *  reads, and what it answers with. */
export interface DocumentReference {
  /** The stored reference, e.g. `palette.ink`. */
  readonly ref: string;
  /** The authored name where the document declares one, else the reference. */
  readonly label: string;
  /** What it resolves to, or `undefined` when the reference answers nothing. */
  readonly resolved: string | undefined;
}

export function documentReferences(
  globals: FabricGlobals | undefined,
): readonly DocumentReference[] {
  const references: DocumentReference[] = [];

  const palette = globals?.palette as FabricPalette | undefined;
  for (const [id, entry] of Object.entries(palette ?? {})) {
    // `none` is the absence of a reference, not one of them: listing it would
    // offer the author a reference that means "no reference".
    if (id === "none") continue;
    const ref = `palette.${id}`;
    references.push({
      ref,
      // The authored name is what the author sees in the palette panel, so it
      // is what they can match here; the reference is the fallback.
      label: entry?.name ?? ref,
      resolved: resolveToken(globals, ref),
    });
  }

  for (const [id, entry] of Object.entries(globals?.typePresets ?? {})) {
    const ref = `typePresets.${id}`;
    references.push({
      ref,
      label: entry?.name ?? ref,
      resolved: resolveTypePreset(globals, ref),
    });
  }

  return references;
}
