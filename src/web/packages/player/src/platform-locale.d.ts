/**
 * Typings for the one `Intl.Locale` member this package uses that TypeScript's
 * bundled libs do not declare.
 *
 * `getTextInfo()` ships in the browsers this product runs in — the player's RTL
 * path was measured live, serving `lang="ar" dir="rtl"` for an Arabic theme —
 * and it is the platform's own answer to "which direction does this language
 * read". The alternative is hand-maintaining a list of RTL language tags, which
 * is worse on every count the reuse gate asks about.
 *
 * It is absent from every lib TypeScript ships, `lib: ES2022` included, so
 * bumping `lib` cannot reach it.
 *
 * **ponytail:** declared here rather than cast at the call site because the API
 * is real and the cast would be a lie about the type. Delete this file when
 * TypeScript declares `getTextInfo` itself and the call still type-checks.
 *
 * Declared **narrowly** — only `direction`, the one field the player reads — so
 * widening it is a visible act rather than an accident.
 */

interface LocaleTextInfo {
  readonly direction: "ltr" | "rtl";
}

export {};

declare global {
  namespace Intl {
    interface Locale {
      getTextInfo?: () => LocaleTextInfo;
    }
  }
}
