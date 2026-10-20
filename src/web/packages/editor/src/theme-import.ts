import type { FabricThemeEnvelope } from "@vigilia/renderer-core";
import { parseThemePackage } from "./persist.js";
import {
  THEME_ID_REGEX,
  type ThemeLibraryClient,
} from "./theme-library-client.js";

/** What an import needs of the library: the one write. A surface with `open`
 *  or `list` on it could mount a document, which is the behaviour this path
 *  deliberately does not have. */
export type ThemeImportLibrary = Pick<ThemeLibraryClient, "save">;

export type ThemeImportResult =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly message: string };

/**
 * The id an import writes under: the package's own, and never a slug of its
 * name. Two packages named alike would collide under one slug, and the author
 * would never learn that the second landed on the first.
 *
 * The regex is `theme-library-client.ts`'s, not a copy: it is the owner of the
 * shape a library id has.
 */
export function themeImportId(
  envelope: FabricThemeEnvelope,
): ThemeImportResult {
  return THEME_ID_REGEX.test(envelope.id)
    ? { ok: true, id: envelope.id }
    : {
        ok: false,
        message: `"${envelope.id}" is not an id the library can hold.`,
      };
}

/**
 * Writes a `.vigilia-theme` package into the library, so an imported theme
 * survives the editor closing and appears in the local list. The open document
 * is not this path's business: the answer is the id the library now holds and
 * nothing to mount.
 *
 * Every refusal is its owner's — the reader's for a package it will not read,
 * `save`'s for a write the host would not take — because the reason is what the
 * author has to act on, and a sentence composed here would hide it.
 */
export async function importThemePackage(
  bytes: Uint8Array,
  library: ThemeImportLibrary,
): Promise<ThemeImportResult> {
  const parsed = parseThemePackage(bytes);
  if (!parsed.ok) return { ok: false, message: parsed.message };

  const named = themeImportId(parsed.envelope);
  if (!named.ok) return named;

  try {
    // No `overwrite`: replacing a theme the author already holds is data loss,
    // and this path has no affordance for asking. No `base` either, because an
    // import descends from no stored document.
    await library.save(named.id, {
      envelope: parsed.envelope,
      assets: parsed.assets,
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
  // ponytail: the package's own picture is not stored, so a theme imported
  // from a package shows no thumbnail in the list until a save writes one. Add
  // when that picture should reach the list; `parsed.thumbnail` is in hand.
  return { ok: true, id: named.id };
}
