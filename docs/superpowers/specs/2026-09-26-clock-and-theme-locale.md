# Clock, and the theme's language

- **Status:** active — `docs/superpowers/plans/2026-09-26-clock-and-theme-locale.md`.
- **Supersedes:** `2026-09-24-clock-provider.md`, whose "month and weekday names
  are English and the consumer's locale is an unanswered question" is the
  decision this reverses.
- **Requirement:** the clock half of the author journey, plus the theme-language
  fact a theme library and store will need to filter on.

## Why

A dashboard without a clock is not a dashboard. The starter theme's clock was
authored literal text (`"07:24"`), so it looked like a clock and was not one.
That is fixed: time is a reading, the host acquires it, and a display binds it
semantically.

The fix left one question open, and answering it as "English" was wrong. A
clock is text, and text a theme shows is the theme's language. The renderer
spelled month and weekday names from two English tables and shortened them with
`slice(0, 3)` — which is not merely un-localized but *incorrect*: German's short
weekday is `Do`, not `Don`, and Traditional Chinese's is `週四`, not `星期四`.

The theme therefore declares a language, once, as a fact about itself. The
clock is its first consumer; a weather or similar provider added later reads the
same declared fact rather than inventing a second one.

## What exists

- `Sample` already carries `textValue`, and `resolveTextSegments` already renders
  it, so a text-valued sensor needs **no model change**.
- Providers acquire on the host's cadence and are bound by semantic key (§93).
- `longUnits` and the measurement preference already flow into value formatting,
  and are the precedent for how a display-level fact reaches formatting.
- The vocabulary has `time` and `date` families; the provider, the two keys, the
  author's format tokens and the author's per-binding zone are implemented.
- `Intl.DateTimeFormat` supplies every localized name and zone offset this needs,
  so still no date library is added.

## Design

### Keys

Two, because they are read differently and refreshed differently:

- `time.now` — the wall clock, `HH:mm`.
- `date.today` — the calendar date.

They are **string** sensors: a clock is a formatted string, not a number.

### The provider measures; the display formats

Time is trivially derivable in the browser, and deriving it there would be
simpler. It is still the host's job, because §116 puts formatting on the display
but **acquisition on the PC**, and a clock is acquisition: two displays then
agree, and a phone with a wrong clock still shows the right time. The host also
already has the zone and the consumer's preferences, so pushing the clock to the
browser would duplicate them per device.

What the provider sends is an **instant**, never a finished string — written with
the offset it was read in, so it cannot be misread as a local time and a display
never re-converts.

### The author owns format and zone; the consumer owns the default zone

- **How it reads** is design, so the *author* owns it: `HH:mm`, `dddd, DD MMMM`.
- **Which zone each clock shows** is also design, because a world-clocks
  dashboard is a legitimate theme. So the author may pin a zone per binding, and
  a binding that pins none follows the consumer's default.
- **What the default zone is** is a machine fact, so the *consumer* owns it, in
  the global settings section.

The two places a zone is resolved do not overlap: the consumer's default is the
provider's, the author's pin is the binding's and is applied at format time.

### Formatting is a small token set, not a pattern language

```
HH   24-hour padded      H   24-hour
hh   12-hour padded      h   12-hour
mm   minutes             ss   seconds
dddd weekday name        ddd  weekday short
DD   day padded          D    day
MMMM month name          MMM  month short
MM   month padded        M    month
YYYY year                YY   year short
A    day period (PM)     a    day period (pm)
```

Tokens concatenate, and `[bracketed]` text is always literal. Prose is full of
letters, so an unquoted `[Today is ]dddd` must not read `T` `o` `d` `a` `y` as
tokens; an unclosed bracket keeps its text rather than swallowing the string. An
unrecognised token renders literally rather than blanking the value, so a typo is
visible. A binding with no format uses a sensible default per family.

An arbitrary ICU pattern is explicitly **not** supported: it would be a parser, a
second formatting model, and a source of silent mismatch with `Intl`.

The token walker stays even though `Intl` could format a date alone, because
`Intl` cannot honour an author-chosen **field order** — asked for a numeric date,
`en-US` always answers `09/24/2026`, `en-CA` always `2026-09-24`. Field order is
authored design; `Intl` supplies names, the walker decides arrangement.

### The theme declares its language

The envelope's `metadata` gains `locale`, a BCP 47 tag (`en`, `fr`, `ja-JP`),
beside `name`, `author` and `description`. It is a fact about the document, which
is what that bag is for, and it is the value a theme library or store filters on
— `ThemeStoreEntry` already projects `metadata.name` and `metadata.author`, so
this joins an existing projection rather than adding a lookup path.

It is named for the theme's **language**, not the clock's locale, because it is
deliberately general: a weather or similar locale-aware provider added later
reads the same declared fact. The clock is only its first consumer.

**Required on v2 envelopes.** `validateFabricThemeEnvelope` refuses a theme that
declares none. Every saved theme is v2, so the future filter is total by
construction and never guesses. This makes `metadata` effectively required; that
is part of the same break and is accepted. The rule lives in the v2 validator
directly, not behind the `requireTrioRoles` option — which exists but has no
production caller, and is not being relied on here.

**A tag this runtime cannot use is refused, not downgraded.** `en_US` is
malformed and throws; `xx-YY` is well-formed and `Intl` silently resolves it to
`en-US`, which is a setting that appears to do nothing. Both are rejected at
validation, exactly as an unknown zone name is refused today, so a theme never
saves a language it cannot render.

**Only word-spelling tokens consult the language.** `MMMM`, `MMM`, `dddd`,
`ddd`, `A` and `a` take their text from `Intl`; `a` is `A` lowercased. Every
numeric token keeps its current padding and stays ASCII, so under `ar` a date
reads with Latin digits and `precision` and digit semantics are untouched.
Digits, unit names and the renderer's `on`/`off` are out of scope.

**New themes default to `en`**, matching the editor's own copy, and the author
changes it in Theme settings. Seeding from `navigator.language` is rejected: it
guesses the author's intent from their browser.

**The author picks from a curated list, not a free-text tag.** The platform
offers no list of locales to choose from the way it offers 419 zones, so the
product owns this one: fifteen languages, chosen for coverage of the product's
likely authors rather than by a single ranking. The table is the list, read down
each column.

| Tag | Language | Tag | Language |
|---|---|---|---|
| `en` | English | `ru` | Russian |
| `zh-Hans` | Mandarin (Simplified) | `ur` | Urdu |
| `hi` | Hindi | `id` | Indonesian |
| `es` | Spanish | `de` | German |
| `fr` | French | `ja` | Japanese |
| `ar` | Arabic | `it` | Italian |
| `pt` | Portuguese | `ko` | Korean |
| `vi` | Vietnamese | | |

No label table is authored: `Intl.DisplayNames` already names every one of these,
so the list is tags only and the control reads its labels from the platform.

The list lives in the editor beside the font catalog — both are curated authoring
metadata rather than platform-derived facts — and a unit test asserts every tag
in it resolves, so the control can never offer a language the validator then
refuses.

This is a deliberate ceiling: a language outside the list is not authorable from
the editor today. The *format* stays general, though — the validator accepts any
well-formed, supported tag, so a hand-edited or store-downloaded theme declaring
another language still opens and renders.

**The language is never written into the persisted scene.** It stays in
`metadata` and reaches formatting as a runtime input, like `longUnits` and the
measurement preference.

### The language reaches the formatter the way the other display facts do

`PlanContext` gains `locale`, and `plan.ts` passes `document.metadata?.locale`;
`resolveTextSegments` and `formatValueSegment` add it to the `Pick<...>` context
they already thread, the same shape `longUnits` uses. The `scene-fabric` text
entry points take it as a further parameter, mirroring `measurement`.

The editor session already broadcasts envelope-level state to its consumers when
it changes; the language joins that broadcast, so the run preview and the paint
read one value from one place and cannot disagree. The authoring control is a
select over the curated list, labelled with `Intl.DisplayNames`, with the resolved
month and weekday names shown live beside it, so the author sees the actual words
rather than a tag.

### Module shape

`renderer-core/src/scene/datetime-format.ts` today owns three things — the
instant reading, the author's format tokens, and the zone list. They are split:

- `scene/datetime/instant.ts` — what time it is: the instant, offset resolution,
  `isTimeZoneName`, `knownTimeZones`.
- `scene/datetime/format.ts` — how it reads: the token walker.
- `scene/datetime/names.ts` — the words: locale-resolved weekday, month and day
  period text, cached per language.

They fail differently — an unknown zone falls back, an unknown language is
refused — and the names are a plain data lookup that tests standalone, so the
split follows real seams rather than size. No stateful manager is introduced:
these are pure functions, callable from a pure plan, which is what
`renderer-core` is.

Name spelling comes from `Intl.DateTimeFormat` built over the date at UTC, so
already-offset components never shift again. Caching one formatter per language
per kind is **required, not an optimisation**: this runs per text run per
refresh, and constructing `Intl` formatters is expensive.

Day period needs care: `dayPeriod: 'short'` returns CLDR *flexible* periods
("at night", or empty for some languages). The reliable extraction is
`hourCycle: 'h12'` plus the `dayPeriod` part, which yields `午前`/`午後` for
Japanese, `ص`/`م` for Arabic, and correctly leaves French, German and Polish on
AM/PM because their CLDR data does.

### Refresh cadence

A clock changes every minute and nothing else does. The host's cadence is 1 s, so
the provider re-reads cheaply and the *display* decides granularity. Shipping the
already-rounded string and refreshing on the normal cadence is accepted: the
protocol has no change-detection, the payload is a few bytes, and "only send when
changed" would be a protocol feature for one provider's benefit.

### One key each, not one per format

`time.now` and `date.today` stay single keys: format multiplies what an author
can *say* about one reading, and a key per format would put presentation in the
vocabulary.

## Non-goals

- Localizing digits, unit names or the renderer's `on`/`off`. A language changes
  the words a clock spells, not the arithmetic it shows.
- Authoring copy for a theme's own labels. A theme's literal text is its text.
- A per-binding language. A world clock whose Tokyo row reads `木` rather than
  `Thu` is the only case it would serve; the library filter needs a document-level
  value regardless, and the key is cheap to add later if that case turns real.
- A live-updating seconds clock; timers, stopwatches, uptime or duration sensors;
  calendar/agenda data.
- Removing the v1 document format and the fixture node-tree render path, which no
  hosted theme uses. That is a separate spec; this one leaves it working.
- Authoring a language outside the curated list, since the control offers a fixed
  set. The format stays general, so such a theme still opens and renders.

## Boundaries

- Acquisition of the instant belongs to the host, beside the other providers; the
  display treats it as any other text sensor.
- The theme's language belongs to `metadata`. It is not a top-level key, not a
  `globals` group — every group there is a map of token-referenceable entries,
  and a language is one scalar nothing references.
- The zone list and instant reading stay `renderer-core`'s; the default zone stays
  the consumer's, in the host's display settings.
- The published `schema/theme-document.schema.json` gains `locale` in its
  `metadata` definition; it sets `additionalProperties: false` and would
  otherwise refuse documents this build accepts.
- The ownership map's single row for this area ("Instant reading, author format
  tokens and the zone list") becomes three, one per split module, in the same
  change that splits them.
- The language list belongs to the editor, beside the font catalog. No new
  dependency: the platform supplies both the names (`Intl.DateTimeFormat`) and
  the labels (`Intl.DisplayNames`), so the list is tags and a test, not a data
  package.
- A theme binding no time or date key is unaffected except for declaring a
  language, as every v2 theme now must.
- The fixture themes that render through the v1 node-tree path keep working and
  keep rendering in English, since absent means `en` there. Removing that path is
  the separate spec's work, and this one must not break it on the way.

## Acceptance

- A v2 theme without `metadata.locale` is refused, and one with a malformed or
  unsupported tag is refused, each naming the offending value.
- An author sets the language in Theme settings from the curated list; a new theme
  starts at `en`, and every tag the control offers is one the validator accepts.
- A theme declaring a language renders month and weekday names in it, long and
  short forms both from the platform rather than truncated from the long form.
- A language whose CLDR data has no AM/PM renders its own day period; one that
  keeps AM/PM keeps it.
- Numeric tokens render identically in every language.
- `time.now` and `date.today` still appear in the authoring picker, an author can
  still format each including day of week, and an unknown token still renders
  literally rather than throwing or blanking.
- A text run bound to `time.now` still shows the host's current time and updates
  as the cadence advances, and a pinned zone still overrides the consumer's.
- Changing a theme's language changes what the dashboard shows without editing a
  binding.

## Verification

Focused proof during implementation; the broad gate at the milestone boundary.

Unit: name spelling for languages the current tables get wrong — German short
weekday is `Do`, Traditional Chinese short weekday is not its long form;
day-period extraction for Japanese and Arabic; numeric tokens unchanged under
Arabic; malformed and unsupported tags both refused; a formatter is built once
per language per kind; brackets and unknown tokens still literal. The name tests
must fail when language handling is disabled, before they are trusted.

Browser, against the real host: a theme declaring Japanese paints `木曜日`;
changing only the language changes the rendered text; the editor's preview equals
what the run paints. Visible behaviour needs rendered inspection, not object
counts.
