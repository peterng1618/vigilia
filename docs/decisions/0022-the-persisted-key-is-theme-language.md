# 0022 — The persisted key is `themeLanguage`, because the field is a language and not a locale

- **Date:** 2026-10-01
- **Status:** accepted
- **Paths:** `src/web/packages/renderer-core/src/theme/`
  `src/web/packages/renderer-core/src/scene/plan.ts`
  `src/web/packages/renderer-core/src/scene/datetime/format.ts`
  `src/web/packages/scene-fabric/src/fabric-text.ts`
  `src/web/schema/theme-document.schema.json`

## The problem

A theme's `metadata` carried the BCP 47 tag naming the language its text is
written in, under the key `locale`. The spec that introduced it says so in one
sentence and then does not use that sentence as the name:

> It is named for the theme's **language**, not the clock's locale, because it is
> deliberately general: a weather or similar locale-aware provider added later
> reads the same declared fact.

So the field's stated purpose is the theme's language, its name is a runtime
locale, and a reader arriving at either the spec or the type had to decide which
of the two the other was. `Intl` reinforces the wrong reading: a locale is what
you pass to `Intl.DateTimeFormat`, and the value *is* passed to one — so the
name looks correct and is not.

The shape of the problem is therefore narrow and worth stating plainly: **what a
persisted field is called, when the name and the value's type disagree.** That
shape has a hazard the codebase already knows about, in
`theme/fabric-envelope-validate.ts`: an absent language is not an error, it is
English. A missed reader is therefore silent. `metadata?.locale` after a rename
is `undefined`, which the renderer reads as `en`, and every theme quietly
renders in English — precisely the failure the validator exists to prevent,
arrived at by the rename that was meant to prevent it.

## Rung 1 — Vigilia

Searched: `ThemeMetadata`, `themeLanguage`, `PlanContext.locale`,
`DEFAULT_LOCALE`, `isLocaleName`, `setLocale`, the `metadata` bag in
`theme/document.ts`, `fabric-envelope-validate.ts`, `theme/validate.ts`
(`KNOWN_KEYS.metadata`), `schema/theme-document.schema.json`.

Found: the validator was already right and named the concept
`themeLanguage(metadata, issues)` while reading the key `metadata["locale"]`.
The author journey brief records the same fact. So the decision was already
taken in the one file whose job is deciding; only the key and its call sites
drifted. No second language concept exists — `longUnits`, `measurement` and
`locale` are three fields of one `PlanContext`, and only the third is a
language.

## Rung 2 — dependencies

Searched: the workspace manifests for any i18n, locale or language-tag package.
Found: none. Formatting and validation are `Intl`, and the curated list of
languages is the product's own (`editor/src/theme-languages.ts`, which explains
why: the platform offers no list of locales to choose from the way it offers
419 zones). A rename adds nothing here and no dependency is warranted.

## Rung 3 — platform

Searched: `Intl.Locale`, `Intl.getCanonicalLocales`, `Intl.DateTimeFormat.supportedLocalesOf`.
Found: the platform validates and canonicalizes tags, and ECMA-402 §6.2.1
(`IsStructurallyValidLanguageTag`) is well specified — but it is *structural*
only. `isLocaleName` deliberately does not use it, and the reason is recorded
in `names.ts`: `Intl` accepts any well-formed tag and silently falls back to
en-US for one it has no data for, so a construction check would accept a
language that renders as English. The validator instead asks
`Intl.DateTimeFormat.supportedLocalesOf`, which refuses a tag this runtime
cannot actually spell. **That check is unchanged by this decision.** What
changes is the name the product calls the thing, and `Intl` is indifferent to
names.

## Rung 4 — ecosystem

Searched: ECMA-402 13th ed. (`IsStructurallyValidLanguageTag`,
`CanonicalizeUnicodeLocaleId`, `getCanonicalLocales`); MDN `Intl.Locale` /
`getCanonicalLocales`; the wider pattern of what i18n libraries call the
declared-language field on a persisted document.

Found: **the ecosystem's field names are the opposite of this ruling, and that
is evidence rather than counter-evidence.** Every mature convention found —
`Intl.Locale`, `getCanonicalLocales`, `supportedLocalesOf`, ECMA-402's own
`locale` parameter throughout — uses *locale*, because those APIs genuinely take
a locale: region, calendar, numbering system and collation are all in scope for
them. Vigilia's field is not that. It is a bare language subtag drawn from a
fifteen-language list, deliberately excluding region, and the spec says a future
provider reads it as the document's language. Naming it `locale` borrowed a name
whose ordinary meaning is *wider* than the value's, so a future reader who
trusts the name and passes region-bearing tags to a clock would be outside what
validation accepted.

So the search found no pattern to copy; it found the reason the copy is wrong
here. Nothing in the ecosystem is displaced — no caller in this repo constructs
an `Intl` API positionally from the field name, and every one of those call
sites takes the value as an argument, not a name.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| `metadata.locale` (today) | name contradicts the spec's stated purpose; reads as an `Intl` locale | none | silent-en-`en` on any missed reader; invites region-bearing tags validation refuses | rejected |
| `metadata.language` | accurate for a bare language subtag | none | collides with BCP 47's own grammar, where `language` is a *component* of a tag, not a tag; implies the value is a subtag, not a tag | rejected |
| `metadata.themeLanguage` | names the owner and the fact; matches the spec and the validator's own function name | one clean break | longest of the three | **chosen** |

`themeLanguage` wins on the specific reason that it names the *owner*: the
ambiguity was never "which language", it was "this field, or the runtime's".
`language` alone still leaves that open, and `themeLanguage` is what
`fabric-envelope-validate.ts` already called the concept.

## Rung 6 — probe

`Intl.getCanonicalLocales("EN_US")` throws `RangeError: invalid language tag`,
while `new Intl.Locale("EN_US")` does not throw and `Intl.DateTimeFormat`
accepts it by falling back. This is the gap `isLocaleName` exists to close, and
it is why the validator does not use a construction check. The rename touches
none of it — it is a change of name over an unchanged mechanism.

## Decision

`ThemeMetadata.themeLanguage`, the JSON pointer `/metadata/themeLanguage`, the
schema key, and `PlanContext.themeLanguage` as the runtime carrier. The
validator function keeps the name it already had.

**Clean break, no migration.** A theme on disk carrying `metadata.locale` is
refused after this change, and `AGENTS.md` is explicit that pre-release internal
architecture may break cleanly and that compatibility glue exists solely to
preserve superseded internal designs. A read-of-the-old-key fallback is exactly
that glue, and it would also defeat the rename's purpose: the ambiguity the
author ruled on would survive in the one place a stale document could reach.
Themes re-save from the editor.