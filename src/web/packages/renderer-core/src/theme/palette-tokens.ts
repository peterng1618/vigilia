import type { FabricPalette, FabricPaletteEntry } from "./fabric-envelope.js";

/** One entry a reference picker offers: the stored reference, and the name the
 *  author reads. */
export interface PaletteTokenOption {
  /** The stored reference, `palette.<id>` — what a control's value carries. */
  readonly id: `palette.${string}`;
  /** The authored name, or the reference when the document declares none. */
  readonly name: string;
}

/**
 * The document's tokens, each under the name its author gave it.
 *
 * **One function**, because the artboard's paint controls, the chart paint rows
 * and the inspector's material fields each offered the same document tokens and
 * each was its own place a label could print as an id (vg-104, RULED
 * 2026-10-12). `keep` is the caller's own: what the surfaces differ in is which
 * tokens they offer — the artboard offers every token, the inspector hides
 * `none` and, on a solid-only field, the gradients — never in how a token is
 * named.
 *
 * A token the document no longer declares a name for has nothing left to label
 * it, so **the reference is the label**: the one case a picker is handed a
 * reference where it offered a name, and `palette-tokens.test.ts` pins it.
 */
export function paletteTokenOptions(
  palette: FabricPalette | undefined,
  keep?: (id: string, entry: FabricPaletteEntry) => boolean,
): readonly PaletteTokenOption[] {
  const options: PaletteTokenOption[] = [];
  for (const id of Object.keys(palette ?? {})) {
    const entry = palette?.[id];
    if (entry !== undefined && keep !== undefined && !keep(id, entry)) continue;
    const ref = `palette.${id}` as const;
    options.push({ id: ref, name: entry?.name ?? ref });
  }
  return options;
}
