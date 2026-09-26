/**
 * The languages an author may choose. The platform offers no list of locales to
 * choose from the way it offers 419 time zones, so the product owns this one:
 * fifteen languages chosen for coverage of likely authors rather than by a
 * single ranking.
 *
 * Tags only. `Intl.DisplayNames` names them, so there is no label table to age.
 */
export const THEME_LANGUAGES: readonly string[] = [
  "en",
  "zh-Hans",
  "hi",
  "es",
  "fr",
  "ar",
  "pt",
  "vi",
  "ru",
  "ur",
  "id",
  "de",
  "ja",
  "it",
  "ko",
];

/** What a language is called, in the editor's own language. */
export function languageLabel(tag: string): string {
  try {
    return displayNames().of(tag) ?? tag;
  } catch {
    return tag;
  }
}

// Built once: `Intl.DisplayNames` construction is not free and this runs per
// option per render.
let names: Intl.DisplayNames | undefined;

function displayNames(): Intl.DisplayNames {
  names ??= new Intl.DisplayNames(["en"], { type: "language" });
  return names;
}
