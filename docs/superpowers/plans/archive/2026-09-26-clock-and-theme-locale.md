# Clock and Theme Language Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A theme declares its language once, and every month, weekday and day-period name a clock renders is spelled in that language by the platform.

**Architecture:** The instant reading, the author's format tokens and the locale's words become three modules under `renderer-core/src/scene/datetime/`, all pure. `metadata.locale` joins the theme envelope and is required on v2 envelopes. The language reaches formatting the way `longUnits` and the measurement preference already do — a runtime input on `PlanContext`, never persisted scene state.

**Tech Stack:** TypeScript, `Intl.DateTimeFormat` and `Intl.DisplayNames` (no new dependency), Vitest, Playwright, Biome.

**Spec:** `docs/superpowers/specs/2026-09-26-clock-and-theme-locale.md`

## Global Constraints

- No new runtime dependency. Names come from `Intl.DateTimeFormat`, labels from `Intl.DisplayNames`.
- Only word-spelling tokens consult the language: `MMMM`, `MMM`, `dddd`, `ddd`, `A`, `a`. Numeric tokens keep `padStart` and stay ASCII in every language.
- The language is never written into the persisted scene; it stays in `metadata` and arrives as a runtime input.
- `metadata.locale` is required on v2 envelopes; the validator refuses a malformed tag and a well-formed tag this runtime cannot use.
- Absent language means `en` everywhere a v1 document or fixture is read.
- Run commands from `src/web/`. Focused test path over a broad command list: `npx vitest run <path>`.
- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are enabled: optional properties are omitted, never set to `undefined`.
- Conventional Commit titles. Stage explicit paths; never `git add -A`.

## Review Focus

These are the inputs the spec implies but no task's tests exercise by default. Each is pinned to a test in the task that owns the code.

1. **An already-saved v2 theme with no `metadata.locale`.** A theme saved before this change opens and is refused as invalid. That is the intended break, but it must be a deliberate, tested refusal with a message naming the field — not a crash or a silent English render.
2. **A theme that declares a language but binds no time or date key.** Must validate and render normally; the language is a fact about the document, not a requirement that it show a clock.
3. **A pinned zone combined with a language.** The names must come from the pinned zone's own date, not from UTC and not from the consumer's zone.
4. **A language the runtime resolves at validation but not at render.** A hand-edited or store-downloaded theme must degrade to the document's own text rather than throwing during a paint.
5. **Midnight and noon under a language with no AM/PM concept.** `ja` must read `午前`/`午後` at hour 0 and hour 12, and a language keeping AM/PM must keep it.

---

## Task 1: Split the datetime module into three

Move-only. No behaviour changes; the existing tests are the proof.

**Files:**
- Create: `src/web/packages/renderer-core/src/scene/datetime/instant.ts`
- Create: `src/web/packages/renderer-core/src/scene/datetime/format.ts`
- Create: `src/web/packages/renderer-core/src/scene/datetime/names.ts`
- Delete: `src/web/packages/renderer-core/src/scene/datetime-format.ts`
- Move: `src/web/packages/renderer-core/src/scene/datetime-format.test.ts` → `src/web/packages/renderer-core/src/scene/datetime/format.test.ts`
- Modify: `src/web/packages/renderer-core/src/index.ts`
- Modify: `src/web/packages/renderer-core/src/scene/plan.ts:27` (import path)
- Modify: `src/web/packages/renderer-core/src/theme/fabric-envelope-validate.ts:1` (import path)
- Modify: `src/web/packages/renderer-core/src/theme/validate.ts:1` (import path)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `instantIn(nowMs: number, timeZone?: string): string`, `parseInstant(value: string): Parts | undefined`, `isTimeZoneName(value: string): boolean`, `knownTimeZones(): readonly string[]` in `scene/datetime/instant.js`; `formatInstant(value: string, format: string, timeZone?: string): string | undefined` in `scene/datetime/format.js`; `Parts` exported from `instant.js`; `scene/datetime/names.js` exists as the home for locale words and is filled in Task 2.

- [ ] **Step 1: Move the file contents into the new modules**

`instant.ts` takes the module docblock's instant half, `Parts`, `instantIn`, `offsetAt`, `parseInstant`, `partsInZone`, `WEEKDAY_INDEX`, `isTimeZoneName`, `knownTimeZones`. `format.ts` takes `formatInstant` and the `TOKENS` table, importing `Parts` and `parseInstant`/`partsInZone` from `./instant.js`. `names.ts` starts as the docblock explaining that locale words live here:

```ts
/**
 * The words a language spells: month, weekday and day-period names.
 *
 * These come from `Intl` rather than a table. A table of English names cannot be
 * localized, and its short forms cannot be truncated from the long ones: German's
 * short weekday is `Do`, not `Don`.
 */
```

Keep `WEEKDAYS`, `MONTHS` and the `weekday: "short"` request in `partsInZone` exactly as they are for this task — Task 2 removes them. A move that also changes behaviour cannot be reviewed as a move.

- [ ] **Step 2: Update the three importers and the barrel**

```ts
// index.ts — split the single export block into two
export {
  instantIn,
  isTimeZoneName,
  knownTimeZones,
  parseInstant,
} from "./scene/datetime/instant.js";
export { formatInstant } from "./scene/datetime/format.js";
```

`plan.ts`, `fabric-envelope-validate.ts` and `validate.ts` import `isTimeZoneName` and `formatInstant` from the new paths.

The three importers above are the ones the module's exports reach; the file itself lists more. Confirm the set rather than trusting this list, because deleting the old path breaks any importer left behind:

```bash
cd src/web && grep -rn "datetime-format" packages/ --include=*.ts --include=*.tsx | grep -v dist
```

Every hit must be either a path in the list above, the deleted file itself, or the moved test — which becomes `scene/datetime/format.test.ts` importing `./format.js` and `./instant.js`.

- [ ] **Step 3: Run the suite to prove the move preserved behaviour**

Run: `npx vitest run packages/renderer-core/src/scene/datetime/format.test.ts`
Expected: PASS — every assertion unchanged, including `hh:mm a` → `02:07 pm` and `DD MMM YYYY` → `24 Sep 2026`. All five of the moved file's `describe` blocks run, not just the format one.

Run: `npm run typecheck`
Expected: PASS, no remaining reference to `datetime-format.js`.

- [ ] **Step 4: Commit**

```bash
git add src/web/packages/renderer-core/src/scene/datetime src/web/packages/renderer-core/src/index.ts src/web/packages/renderer-core/src/scene/plan.ts src/web/packages/renderer-core/src/theme/fabric-envelope-validate.ts src/web/packages/renderer-core/src/theme/validate.ts
git rm src/web/packages/renderer-core/src/scene/datetime-format.ts src/web/packages/renderer-core/src/scene/datetime-format.test.ts
git commit -m "refactor(renderer-core): split the datetime module into instant, format and names"
```

---

## Task 2: Spell names in a language

**Files:**
- Modify: `src/web/packages/renderer-core/src/scene/datetime/names.ts`
- Modify: `src/web/packages/renderer-core/src/scene/datetime/format.ts`
- Modify: `src/web/packages/renderer-core/src/scene/datetime/instant.ts` (drop the weekday name table)
- Test: `src/web/packages/renderer-core/src/scene/datetime/names.test.ts`
- Test: `src/web/packages/renderer-core/src/scene/datetime/format.test.ts`

**Interfaces:**
- Consumes: `Parts` from `instant.js`.
- Produces: `isLocaleName(value: string): boolean`, `DEFAULT_LOCALE = "en"`, `monthName(parts: Parts, locale: string, width: "long" | "short"): string`, `weekdayName(parts: Parts, locale: string, width: "long" | "short"): string`, `dayPeriod(parts: Parts, locale: string): string`, in `scene/datetime/names.js`; `formatInstant(value: string, format: string, timeZone?: string, locale?: string): string | undefined`.

- [ ] **Step 1: Write the failing tests**

```ts
// names.test.ts
import { describe, expect, it } from "vitest";
import { parseInstant } from "./instant.js";
import {
  dayPeriod,
  isLocaleName,
  monthName,
  weekdayName,
} from "./names.js";

/** A Thursday: 2026-09-24. */
const THURSDAY = parseInstant("2026-09-24T14:07:09+07:00")!;
const NOON_SEPT = parseInstant("2026-09-24T12:00:00Z")!;
const MIDNIGHT = parseInstant("2026-09-24T00:30:00Z")!;

describe("the names a language spells", () => {
  it("resolves long and short forms from the platform, not a truncation", () => {
    // German's short weekday is `Do`; the long form's first three letters are
    // `Don`. A truncating table gets this wrong, so this pins the platform.
    expect(weekdayName(THURSDAY, "de", "long")).toBe("Donnerstag");
    expect(weekdayName(THURSDAY, "de", "short")).toBe("Do");

    // Traditional Chinese shortens the other way: `週四` is not a prefix of
    // `星期四` at all.
    expect(weekdayName(THURSDAY, "zh-Hant", "long")).toBe("星期四");
    expect(weekdayName(THURSDAY, "zh-Hant", "short")).toBe("週四");
  });

  it("spells a month in the chosen language", () => {
    expect(monthName(NOON_SEPT, "en", "long")).toBe("September");
    expect(monthName(NOON_SEPT, "fr", "long")).toBe("septembre");
    expect(monthName(NOON_SEPT, "vi", "long")).toBe("Tháng 9");
    expect(monthName(NOON_SEPT, "pt", "short")).toBe("set.");
  });

  it("reads a day period the language actually has", () => {
    // Japanese has no AM/PM; it has 午前/午後.
    expect(dayPeriod(NOON_SEPT, "ja")).toBe("午後");
    expect(dayPeriod(MIDNIGHT, "ja")).toBe("午前");
    // English keeps AM/PM, and so do French and German, because CLDR does.
    expect(dayPeriod(NOON_SEPT, "en")).toBe("PM");
    expect(dayPeriod(MIDNIGHT, "en")).toBe("AM");
    expect(dayPeriod(NOON_SEPT, "fr")).toBe("PM");
  });

  it("accepts a language it can render and refuses one it cannot", () => {
    for (const tag of ["en", "fr", "ja-JP", "zh-Hant-TW", "vi"]) {
      expect(isLocaleName(tag)).toBe(true);
    }
    // Malformed: `Intl` throws on these.
    for (const tag of ["en_US", "", "en-", "123"]) {
      expect(isLocaleName(tag)).toBe(false);
    }
    // Well formed but unsupported: `Intl` silently resolves these to en-US,
    // which would be a setting that appears to do nothing.
    for (const tag of ["xx-YY", "zz"]) {
      expect(isLocaleName(tag)).toBe(false);
    }
  });

  it("reads as English rather than throwing when a language is unusable", () => {
    // Validation is what refuses a bad tag. A tag that reaches rendering anyway
    // — a hand-edited theme, or a language dropped from this runtime since the
    // theme was saved — must not fail a paint.
    //
    // Two distinct paths, so both are pinned. `en_US` makes `Intl` throw, which
    // is the `catch`; `xx-YY` does not throw at all, because `Intl` silently
    // resolves it to en-US, so nothing but the fallback's own output is tested.
    for (const tag of ["en_US", "xx-YY"]) {
      expect(weekdayName(THURSDAY, tag, "long")).toBe("Thursday");
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run packages/renderer-core/src/scene/datetime/names.test.ts`
Expected: FAIL — `names.js` exports nothing yet.

- [ ] **Step 3: Implement the modules**

```ts
// names.ts
import type { Parts } from "./instant.js";

export const DEFAULT_LOCALE = "en";

/**
 * Whether this runtime can render the tag. `Intl` accepts any well-formed tag
 * and silently falls back to en-US for one it has no data for, so a plain
 * construction check would accept a language that renders as English — the same
 * "setting that appears to do nothing" the zone validator refuses.
 */
export function isLocaleName(value: string): boolean {
  try {
    return Intl.DateTimeFormat.supportedLocalesOf([value]).length > 0;
  } catch {
    return false;
  }
}

type NameKind = "monthLong" | "monthShort" | "weekdayLong" | "weekdayShort";

const OPTIONS: Record<NameKind, Intl.DateTimeFormatOptions> = {
  monthLong: { month: "long" },
  monthShort: { month: "short" },
  weekdayLong: { weekday: "long" },
  weekdayShort: { weekday: "short" },
};

// Built once per language per kind: this runs per text run per refresh, and
// constructing a formatter is expensive.
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(locale: string, kind: NameKind): Intl.DateTimeFormat {
  const key = `${locale}\u0000${kind}`;
  const cached = formatters.get(key);
  if (cached !== undefined) return cached;

  let created: Intl.DateTimeFormat;
  try {
    created = new Intl.DateTimeFormat(locale, {
      ...OPTIONS[kind],
      timeZone: "UTC",
    });
  } catch {
    // A tag the runtime dropped since validation reads as English rather than
    // failing a paint. Validation is what refuses an unusable tag.
    created = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
      ...OPTIONS[kind],
      timeZone: "UTC",
    });
  }

  formatters.set(key, created);
  return created;
}

/** The instant's own calendar date, at UTC so the offset cannot shift it again. */
function dateOf(parts: Parts): Date {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

export function monthName(
  parts: Parts,
  locale: string,
  width: "long" | "short",
): string {
  return formatter(locale, width === "long" ? "monthLong" : "monthShort").format(
    dateOf(parts),
  );
}

export function weekdayName(
  parts: Parts,
  locale: string,
  width: "long" | "short",
): string {
  return formatter(
    locale,
    width === "long" ? "weekdayLong" : "weekdayShort",
  ).format(dateOf(parts));
}

const dayPeriods = new Map<string, Intl.DateTimeFormat>();

/**
 * The language's own day period. `dayPeriod: "short"` returns CLDR's *flexible*
 * periods — "at night", or nothing at all for some languages — so the period is
 * read off a 12-hour clock instead, which is the AM/PM a clock actually shows.
 */
export function dayPeriod(parts: Parts, locale: string): string {
  let at = dayPeriods.get(locale);

  if (at === undefined) {
    try {
      at = new Intl.DateTimeFormat(locale, {
        hour: "numeric",
        hourCycle: "h12",
        timeZone: "UTC",
      });
    } catch {
      at = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
        hour: "numeric",
        hourCycle: "h12",
        timeZone: "UTC",
      });
    }
    dayPeriods.set(locale, at);
  }

  const written = at.formatToParts(
    new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour)),
  );

  return written.find((part) => part.type === "dayPeriod")?.value ?? "";
}
```

```ts
// format.ts — the word-spelling tokens, and only those, consult the language
export function formatInstant(
  value: string,
  format: string,
  timeZone?: string,
  locale: string = DEFAULT_LOCALE,
): string | undefined {
```

In `TOKENS`, replace the five word tokens and leave every numeric one untouched:

```ts
  ["MMMM", (p) => monthName(p, locale, "long")],
  ["MMM", (p) => monthName(p, locale, "short")],
  ["dddd", (p) => weekdayName(p, locale, "long")],
  ["ddd", (p) => weekdayName(p, locale, "short")],
  // `a` is `A` lowered, so the two agree in every language.
  ["A", (p) => dayPeriod(p, locale)],
  ["a", (p) => dayPeriod(p, locale).toLowerCase()],
```

`TOKENS` becomes a function of `locale` (`const tokensFor = (locale: string) => [...]`) so the table is built per call rather than capturing a stale language.

In `instant.ts`, delete the `WEEKDAYS` table, the `WEEKDAY_INDEX` map and the `weekday: "short"` request from `partsInZone`, and compute the index the way `parseInstant` already does:

```ts
      weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run packages/renderer-core/src/scene/datetime/`
Expected: PASS. The pre-existing assertions must be unchanged — `en` is the default, and English's `ddd` is `Thu`, `MMM` is `Sep`, `a` is `pm`.

- [ ] **Step 5: Prove the tests fail when language handling is disabled**

Temporarily change the `a` token back to `(p) => (p.hour < 12 ? "am" : "pm")` and the `dddd` token to a hardcoded `"Thursday"`.
Run: `npx vitest run packages/renderer-core/src/scene/datetime/names.test.ts`
Expected: FAIL on the German, Chinese and Japanese assertions. Revert the change.

- [ ] **Step 6: Commit**

```bash
git add src/web/packages/renderer-core/src/scene/datetime
git commit -m "feat(renderer-core): spell month, weekday and day-period names in a language"
```

---

## Task 3: The theme declares its language

**Files:**
- Modify: `src/web/packages/renderer-core/src/theme/document.ts:268-275` (`ThemeMetadata`)
- Modify: `src/web/packages/renderer-core/src/theme/validate.ts:87-94` (`KNOWN_KEYS.metadata`)
- Modify: `src/web/packages/renderer-core/src/theme/fabric-envelope-validate.ts` (require it on v2)
- Modify: `schema/theme-document.schema.json` (`$defs.metadata`)
- Test: `src/web/packages/renderer-core/src/theme/fabric-envelope-validate.test.ts`

**Interfaces:**
- Consumes: `isLocaleName` from Task 2.
- Produces: `ThemeMetadata.locale?: string`; a v2 envelope without a valid `metadata.locale` fails `validateFabricThemeEnvelope`.

- [ ] **Step 1: Write the failing tests**

```ts
// fabric-envelope-validate.test.ts — add to the existing describe
it("requires the theme to declare the language its text is written in", () => {
  // The realistic case: every v2 theme already has a metadata bag with a name
  // and author, so the refusal that matters is a bag without `locale` in it —
  // not a document missing metadata entirely. Both paths are pinned, since the
  // validator handles them separately.
  const withoutLocale = withMetadata(fixture(), {
    name: "Fixture",
    author: "Vigilia",
  });

  const missing = validateFabricThemeEnvelope(withoutLocale);
  expect(missing.ok).toBe(false);
  // A refusal that names the field, not a crash: a theme saved before this
  // change must fail legibly.
  expect(issuesOf(missing)).toContainEqual(
    expect.objectContaining({ path: "/metadata/locale" }),
  );

  const withoutMetadata = withoutKey(fixture(), "metadata");
  expect(issuesOf(validateFabricThemeEnvelope(withoutMetadata))).toContainEqual(
    expect.objectContaining({ path: "/metadata/locale" }),
  );
});

it("refuses a language this runtime cannot render", () => {
  for (const locale of ["en_US", "xx-YY"]) {
    const result = validateFabricThemeEnvelope(
      withMetadata(fixture(), { name: "Fixture", locale }),
    );

    expect(result.ok).toBe(false);
    expect(issuesOf(result)).toContainEqual(
      expect.objectContaining({ path: "/metadata/locale" }),
    );
  }
});

it("accepts a theme that declares a language but binds no clock", () => {
  // The language is a fact about the document, not a demand that it show a clock.
  const result = validateFabricThemeEnvelope(
    withMetadata(fixture(), { name: "Fixture", locale: "ja" }),
  );

  expect(result.ok).toBe(true);
});
```

`fixture()`, `withoutKey`, `withMetadata` and `issuesOf` follow the helpers already in that test file; if a helper is missing, write it as a local function beside the test.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run packages/renderer-core/src/theme/fabric-envelope-validate.test.ts`
Expected: FAIL — a theme with no `locale` currently validates.

- [ ] **Step 3: Implement**

```ts
// document.ts
export interface ThemeMetadata {
  readonly name?: string;
  readonly author?: string;
  readonly description?: string;
  readonly version?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  /**
   * The language this theme's text is written in, as a BCP 47 tag. Required on
   * v2 envelopes: text a theme shows belongs to the theme's language, and a
   * theme library filters on it. Absent means English when a v1 document is read.
   */
  readonly locale?: string;
}
```

```ts
// validate.ts — KNOWN_KEYS.metadata gains "locale"
// Without this the shared semantic pass reports /metadata/locale as an unknown
// field on every v2 theme, since the envelope validator delegates metadata here.
  metadata: [
    "name",
    "author",
    "description",
    "version",
    "createdAt",
    "updatedAt",
    "locale",
  ],
```

```ts
// fabric-envelope-validate.ts — beside the other top-level checks
  themeLanguage(input["metadata"], issues);
```

```ts
/**
 * A v2 theme states the language its text is written in, so its clock reads in
 * the language its author wrote it in and a library can filter on the fact. A
 * tag that is malformed, or well formed and unsupported, is refused here rather
 * than rendered as English behind the author's back.
 */
function themeLanguage(metadata: unknown, issues: ValidationIssue[]): void {
  if (!isRecord(metadata)) {
    issues.push(
      issue(
        "missing-field",
        "/metadata/locale",
        "A theme must declare its language, so its text reads in the language it was written in.",
      ),
    );
    return;
  }

  const locale = metadata["locale"];

  if (locale === undefined) {
    issues.push(
      issue(
        "missing-field",
        "/metadata/locale",
        "A theme must declare its language, so its text reads in the language it was written in.",
      ),
    );
    return;
  }

  if (typeof locale !== "string" || !isLocaleName(locale)) {
    issues.push(
      issue(
        "invalid-enum",
        "/metadata/locale",
        `locale "${String(locale)}" is not a language this runtime can render.`,
      ),
    );
  }
}
```

```json
// schema/theme-document.schema.json — $defs.metadata.properties
        "locale": { "type": "string", "maxLength": 64 },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run packages/renderer-core/src/theme/`
Expected: FAIL in the other envelope tests — every existing fixture now lacks a language. That is the intended break; Task 4 sweeps them.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/renderer-core/src/theme/document.ts src/web/packages/renderer-core/src/theme/validate.ts src/web/packages/renderer-core/src/theme/fabric-envelope-validate.ts schema/theme-document.schema.json src/web/packages/renderer-core/src/theme/fabric-envelope-validate.test.ts
git commit -m "feat(renderer-core): require a theme to declare its language"
```

---

## Task 4: Every theme and fixture declares a language

The break from Task 3 made concrete: the starter theme, the fixture envelopes, the e2e seeds and the published schema test all gain a language.

**Files:**
- Modify: `src/web/packages/editor/src/new-fabric-theme.ts:274`
- Modify: `src/web/tests/e2e/host-theme.ts` (`envelopeFor`)
- Modify: every inline `schemaVersion: 2` fixture in the files listed by `grep -rln "schemaVersion: 2" src/web/packages src/web/tests`
- Test: `src/web/packages/editor/src/new-fabric-theme.test.ts`

**Interfaces:**
- Consumes: the required `metadata.locale` from Task 3.
- Produces: `createNewFabricTheme()` returns an envelope that validates, with `metadata.locale === "en"`.

- [ ] **Step 1: Write the failing test**

```ts
// new-fabric-theme.test.ts
it("starts a new theme in English, so it validates", () => {
  const theme = createNewFabricTheme();

  expect(theme.metadata?.locale).toBe("en");
  expect(validateFabricThemeEnvelope(theme).ok).toBe(true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run packages/editor/src/new-fabric-theme.test.ts`
Expected: FAIL — `locale` is `undefined`.

- [ ] **Step 3: Add the language to every fixture**

```ts
// new-fabric-theme.ts
    metadata: {
      name: "Twilight system dashboard",
      author: "Vigilia",
      description:
        "A v2 scene exercising supported Fabric primitives and every chart family.",
      // The editor's own copy is English, so a new theme starts where its
      // author does rather than guessing from the browser.
      locale: "en",
    },
```

```ts
// src/web/tests/e2e/host-theme.ts — envelopeFor
  metadata: { name, locale: "en" },
```

Then sweep the inline fixtures. Run `npx vitest run` and add `locale: "en"` to each fixture the failures name — a fixture with `metadata` gains a key, a fixture without one gains `metadata: { locale: "en" }`. Do not weaken a fixture that is deliberately testing a malformed document.

- [ ] **Step 4: Run the whole suite**

Run: `npm test`
Expected: PASS, including `fabric-envelope-schema-sync.test.ts` after the schema gained `locale`.

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages src/web/tests schema
git commit -m "feat(themes): declare a language on the starter theme, fixtures and e2e seeds"
```

---

## Task 5: The language reaches the formatter

**Files:**
- Modify: `src/web/packages/renderer-core/src/scene/plan.ts` (`PlanContext`, `resolveTextSegments`, `formatValueSegment`, `formatTextReading`)
- Test: `src/web/packages/renderer-core/src/scene/plan.test.ts`

**Interfaces:**
- Consumes: `formatInstant(value, format, timeZone?, locale?)` from Task 2; `ThemeMetadata.locale` from Task 3.
- Produces: `PlanContext.locale?: string`.

- [ ] **Step 1: Write the failing tests**

Add them inside the existing `describe("text (§89)")` block, whose `segments(source, bindings, runs, overrides)` helper and `instant(textValue, sensorId)` helper already exist. The third test needs a `documentWith` that carries metadata, so extend that helper first:

```ts
// plan.test.ts — extend the existing documentWith
function documentWith(
  nodes: readonly ThemeNode[],
  globals?: ThemeDocument["globals"],
  metadata?: ThemeDocument["metadata"],
): ThemeDocument {
  return {
    schemaVersion: 1,
    id: "demo",
    artboard: { width: 800, height: 480, fitMode: "contain" },
    ...(metadata === undefined ? {} : { metadata }),
    ...(globals === undefined ? {} : { globals }),
    nodes,
  };
}
```

```ts
// plan.test.ts — inside describe("text (§89)")
it("takes a theme's language from the document when the context sets none", () => {
  const source = storeWith({
    "date.today": instant("2026-09-24T14:07:09+07:00", "clock:date.today"),
  });
  const result = plan(
    documentWith(
      [
        {
          id: "t",
          type: "text",
          bindings: [{ id: "b", semanticKey: "date.today", format: "dddd" }],
          content: { runs: [{ kind: "value", bindingId: "b" }] },
        } as unknown as ThemeNode,
      ],
      undefined,
      { locale: "ja" },
    ),
    { source },
  );
  const content = result.nodes[0]!.content;
  if (content.kind !== "text") throw new Error("expected a text node");

  // 2026-09-24 is a Thursday, however the language spells it.
  expect(content.segments[0]!.text).toBe("木曜日");
});

it("takes names from the pinned zone's own date, not from UTC", () => {
  const source = storeWith({
    "date.today": instant("2026-09-24T20:00:00Z", "clock:date.today"),
  });
  const result = segments(
    source,
    [
      {
        id: "b",
        semanticKey: "date.today",
        format: "dddd",
        timeZone: "Asia/Tokyo",
      },
    ],
    [{ kind: "value", bindingId: "b" }],
    { locale: "en" },
  );

  // 20:00 UTC is already Friday the 25th in Tokyo, so a formatter that read the
  // instant's UTC day would answer Thursday.
  expect(result.segments[0]!.text).toBe("Friday");
});

it("leaves every numeric token in ASCII digits in every language", () => {
  const source = storeWith({
    "date.today": instant("2026-09-24T14:07:09+07:00", "clock:date.today"),
  });
  const result = segments(
    source,
    [
      {
        id: "b",
        semanticKey: "date.today",
        format: "DD/MM/YYYY HH:mm",
      },
    ],
    [{ kind: "value", bindingId: "b" }],
    { locale: "ar" },
  );

  // `ar` is the sharpest case: its own calendar and digits are not Latin, and
  // the tokens deliberately keep both the padding and the ASCII forms.
  expect(result.segments[0]!.text).toBe("24/09/2026 14:07");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run packages/renderer-core/src/scene/plan.test.ts`
Expected: FAIL — `locale` is not read from the document.

- [ ] **Step 3: Thread it the way `longUnits` is threaded**

```ts
export interface PlanContext {
  readonly document: ThemeDocument;
  readonly source: SampleSource;
  readonly nowMs: number;
  readonly animate?: boolean;
  readonly resolveAsset?: (assetId: string) => string | undefined;
  readonly longUnits?: Readonly<Record<string, string>>;
  readonly measurement?: MeasurementSystem;
  /**
   * The language the document's text is written in. A runtime input like
   * `longUnits`, never persisted scene state: the theme's own `metadata` owns it.
   */
  readonly locale?: string;
}
```

Add `locale` to the two existing `Pick<PlanContext, ...>` sites — `resolveTextSegments` (plan.ts:399) and `formatValueSegment` (plan.ts:446) — and pass it through `formatTextReading(binding, sample.textValue, locale)`:

```ts
function formatTextReading(
  binding: Binding,
  value: string,
  locale: string | undefined,
): string {
  const instant = describeSemanticKey(binding.semanticKey)?.instant;

  if (instant === undefined) {
    return value;
  }

  return (
    formatInstant(
      value,
      binding.format ?? instant.defaultFormat,
      binding.timeZone,
      locale,
    ) ?? value
  );
}
```

`buildScenePlan` needs no edit at its segment call site: plan.ts:256 already passes the whole `context`, so widening the `Pick` is enough for it to carry the language.

The document fallback goes at plan.ts:158, `buildScenePlan`'s entry, so every consumer — including the player, whose context comes from the envelope — reads the document when it sets no language of its own. Normalize once at the top rather than at each call site:

```ts
export function buildScenePlan(context: PlanContext): ScenePlan {
  // The document's own `metadata.locale` is the theme's language; a caller
  // that sets `context.locale` overrides it for one plan. Normalized once, so
  // the two `Pick` sites downstream only ever see a string or nothing.
  const plan: PlanContext =
    context.locale === undefined && context.document.metadata?.locale !== undefined
      ? { ...context, locale: context.document.metadata.locale }
      : context;
```

and use `plan` in place of `context` for the rest of the function body.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run packages/renderer-core/src/scene/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/renderer-core/src/scene/plan.ts src/web/packages/renderer-core/src/scene/plan.test.ts
git commit -m "feat(renderer-core): render a plan's text in the document's language"
```

---

## Task 6: The display and the editor pass the language through

**Files:**
- Modify: `src/web/packages/scene-fabric/src/fabric-text.ts` (`applyAuthoredText`, `refreshBoundText`)
- Modify: `src/web/packages/player/src/main.ts:276-282`
- Modify: `src/web/packages/editor/src/live-runtime.ts`
- Modify: `src/web/packages/editor/src/editor-session.ts` (`#setMetadata`)
- Modify: `src/web/packages/editor/src/selection-inspector/index.ts` (`setLocale`)
- Modify: `src/web/packages/editor/src/selection-inspector/runs.ts:327` (the preview)
- Test: `src/web/packages/editor/src/selection-inspector/runs.dom.test.ts`

**Interfaces:**
- Consumes: `PlanContext.locale` from Task 5.
- Produces: `applyAuthoredText(canvas, globals, options)` where `options.locale?: string`; `refreshBoundText(canvas, bindings, source, globals, measurement?, locale?)`; `LiveRuntime.setLocale(locale: string | undefined): void`; `SelectionInspector.setLocale(locale: string | undefined): void`.

- [ ] **Step 1: Widen the DOM test harness and write the failing test**

`runs.dom.test.ts` already has a `harness(runs)` helper that builds the canvas, the object and the binding port, and a `choose(select, value)` helper. The harness passes five positional arguments to `createRunEditor` and no locale, so give it an optional second parameter and thread it through:

```ts
// runs.dom.test.ts
function harness(runs: readonly TextRun[], locale?: string) {
  // ...unchanged, except the createRunEditor call gains the argument:
      createRunEditor(
        { canvas, historyManager: { saveState: vi.fn() } } as never,
        undefined,
        object as never,
        render,
        {
          bindings: () => bindings,
          setBindings: (next) => {
            bindings = next;
          },
        },
        locale,
      ).root,
```

Then the test, inside the existing `describe("binding a text run to a sensor")`:

```ts
// runs.dom.test.ts
it("previews a format in the document's own language", () => {
  const editor = harness([{ kind: "value", bindingId: "clock-date" }], "ja");
  choose(editor.pick<HTMLSelectElement>("[data-vigilia-run-source]"), "date.today");

  const format = editor.pick<HTMLInputElement>("[data-vigilia-run-format]");
  format.value = "dddd";
  format.dispatchEvent(new Event("input"));

  const preview = editor.pick<HTMLElement>(
    "[data-vigilia-run-format-preview]",
  ).textContent;

  // The preview must read the language the paint will, or an author chooses a
  // format against words that never appear on the dashboard. The weekday varies
  // with the day the suite runs, so the week's shape is asserted rather than a
  // fixed string: `ja` and `en` for the same instant must differ, which a
  // preview ignoring the language cannot achieve.
  expect(preview).toBe(
    formatInstant(instantIn(Date.now()), "dddd", undefined, "ja"),
  );
  expect(preview).not.toBe(
    formatInstant(instantIn(Date.now()), "dddd", undefined, "en"),
  );

  editor.dispose();
});
```

The fixed Japanese string is pinned in `names.test.ts` against a constant instant, where it cannot drift with the calendar; this test's job is only that the language reaches the preview.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run packages/editor/src/selection-inspector/runs.dom.test.ts`
Expected: FAIL — `createRunEditor` takes no language yet, so the preview reads English.

- [ ] **Step 3: Thread it, mirroring how `measurement` already travels**

```ts
// fabric-text.ts
export interface ApplyAuthoredTextOptions {
  readonly transform?: (/* unchanged */) => readonly PlanTextSegment[];
  readonly bindings?: Readonly<Record<string, readonly Binding[]>>;
  /** The document's language; absent reads as English. */
  readonly locale?: string;
}

export function refreshBoundText(
  canvas: StaticCanvas,
  bindings: Readonly<Record<string, readonly Binding[]>>,
  source: SampleSource,
  globals: FabricGlobals | undefined,
  measurement?: MeasurementSystem,
  locale?: string,
): void {
```

Both call sites pass it in the context object they already build. The `undefined`
spread matters: `exactOptionalPropertyTypes` rejects a key present-and-undefined,
which `{ source, locale }` produces whenever a caller omits the language.

```ts
// fabric-text.ts — inside refreshBoundText
          const segments = resolveTextSegments(
            id,
            authored.runs,
            bindings[id],
            {
              source,
              ...(measurement === undefined ? {} : { measurement }),
              ...(locale === undefined ? {} : { locale }),
            },
            globals ?? {},
            [],
          );
```

```ts
// fabric-text.ts — inside applyAuthoredText
          const segments = resolveTextSegments(
            id,
            authored.runs,
            options.bindings?.[id] ?? [],
            {
              source: emptySampleSource,
              ...(options.locale === undefined
                ? {}
                : { locale: options.locale }),
            },
            globals ?? {},
            [],
          );
```

```ts
// live-runtime.ts
  #locale: string | undefined;

  setLocale(locale: string | undefined): void {
    if (locale === this.#locale) return;
    this.#locale = locale;
    // The language decides the words a clock paints, so changing it must repaint
    // rather than wait for the next sample. `setGlobals` above deliberately does
    // not refresh; this one must, because nothing else is scheduled to.
    this.refresh();
  }
```

Its constructor takes and stores it the way it already takes `bindings` and `globals`:

```ts
  constructor(options: {
    readonly canvas: StaticCanvas;
    readonly bindings?: Readonly<Record<string, readonly Binding[]>>;
    readonly source: SampleSource;
    readonly globals?: FabricGlobals;
    readonly locale?: string;
  }) {
    // ...unchanged
    this.#locale = options.locale;
  }
```

Then pass `locale: this.#locale` in both `applyAuthoredText` calls and as the sixth argument to `refreshBoundText`. Both `applyAuthoredText` sites have the same `exactOptionalPropertyTypes` wrinkle as `fabric-text.ts`, so spread it: `...(this.#locale === undefined ? {} : { locale: this.#locale })`.

```ts
// player/main.ts — the display reads the theme's own language
    refreshBoundText(
      handle.canvas,
      theme.bindings ?? {},
      liveHandle.source,
      theme.globals,
      measurement,
      theme.metadata?.locale,
    );
```

`#setMetadata` currently only stores the envelope — it broadcasts nothing. The language is the first metadata field that changes what is painted, so it gains a push, at the one place it can change:

```ts
  #setMetadata(metadata: FabricThemeEnvelopeInput["metadata"]): void {
    if (metadata === undefined || Object.keys(metadata).length === 0) {
      const { metadata: _metadata, ...withoutMetadata } = this.#envelope;
      this.#envelope = withoutMetadata;
    } else {
      this.#envelope = { ...this.#envelope, metadata };
    }
    // The language is the one metadata field that changes what is painted, and
    // `metadata` is the only way to set it, so this is the only push site needed
    // — unlike the globals fan-out above, which four separate setters repeat.
    this.#pushLocale();
  }

  #pushLocale(): void {
    const locale = this.#envelope.metadata?.locale;
    // Two receivers, not four: the editor paints bound text only through the
    // live runtime, and the inspector's run preview is the other place a
    // formatted reading is written. `runs.ts`'s own `applyAuthoredText` calls
    // pass no bindings, so they resolve no reading and need no language.
    this.#runtime.setLocale(locale);
    this.#selection.setLocale(locale);
  }
```

Call `#pushLocale()` from `#setMetadata` only. The initial value arrives at construction instead, at the two sites already building these objects, so the first paint reads the opened theme's language rather than waiting for a metadata edit:

```ts
// editor-session.ts — beside the existing #selection assignment
    this.#selection = createSelectionInspector(options.panelHosts.selection, {
      // ...unchanged
    });
    this.#selection.setLocale(options.envelope.metadata?.locale);
```

```ts
// editor-session.ts — the LiveRuntime construction, beside bindings and globals
    this.#runtime = new LiveRuntime({
      canvas: options.shell.editor.canvas,
      source: options.source,
      ...(options.envelope.bindings === undefined
        ? {}
        : { bindings: options.envelope.bindings }),
      ...(options.envelope.globals === undefined
        ? {}
        : { globals: options.envelope.globals }),
      ...(options.envelope.metadata?.locale === undefined
        ? {}
        : { locale: options.envelope.metadata.locale }),
    });
```

`SelectionInspector` gains `setLocale` beside `setGlobals` and hands it to `createRunEditor`, whose preview becomes:

```ts
    const show = (pattern: string): void => {
      preview.textContent =
        formatInstant(instantIn(Date.now()), pattern, binding.timeZone, locale) ??
        uiCopy.inspectorFields.unresolved;
    };
```

`createRunEditor` takes it as a further optional parameter — `createRunEditor(editor, globals, object, onChange, bindingPort?, locale?)` — since it already takes five. `SelectionInspector` reads its own `locale` in the run-editor builder at index.ts:338-342 and passes it there, and `setLocale` stores and re-renders exactly as `setGlobals` does:

```ts
    setLocale(next) {
      locale = next;
      render();
    },
```

Note the two receivers above already exist in `runs.ts`: the `locale` the preview uses is the one captured at render, so a `setLocale` that re-renders is enough — no separate push into the run editor.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run packages/editor/src packages/scene-fabric/src`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/scene-fabric/src/fabric-text.ts src/web/packages/player/src/main.ts src/web/packages/editor/src/live-runtime.ts src/web/packages/editor/src/editor-session.ts src/web/packages/editor/src/selection-inspector
git commit -m "feat(scene-fabric): paint bound text in the document's language"
```

---

## Task 7: The author picks the language

**Files:**
- Create: `src/web/packages/editor/src/theme-languages.ts`
- Create: `src/web/packages/editor/src/theme-languages.test.ts`
- Modify: `src/web/packages/editor/src/artboard-panel.ts`
- Modify: `src/web/packages/editor/src/ui-copy.ts` (`panels.language`)
- Test: `src/web/packages/editor/src/artboard-panel.dom.test.ts`

**Interfaces:**
- Consumes: `isLocaleName`, `monthName`, `weekdayName` from Task 2; `ThemeSettingsOptions.onMetadataChange` which already exists.
- Produces: `THEME_LANGUAGES: readonly string[]`, `languageLabel(tag: string): string`.

- [ ] **Step 1: Write the failing tests**

```ts
// theme-languages.test.ts
import { describe, expect, it } from "vitest";
import { isLocaleName } from "@vigilia/renderer-core";
import { languageLabel, THEME_LANGUAGES } from "./theme-languages.js";

describe("the languages an author may pick", () => {
  it("offers only languages this runtime can render", () => {
    // The control can never hand the validator a tag it then refuses.
    expect(THEME_LANGUAGES.every(isLocaleName)).toBe(true);
  });

  it("leads with English and includes Vietnamese", () => {
    expect(THEME_LANGUAGES[0]).toBe("en");
    expect(THEME_LANGUAGES).toContain("vi");
    expect(THEME_LANGUAGES).toHaveLength(15);
  });

  it("labels a language from the platform rather than a table", () => {
    expect(languageLabel("zh-Hans")).toBe("Simplified Chinese");
    expect(languageLabel("ko")).toBe("Korean");
    expect(languageLabel("vi")).toBe("Vietnamese");
  });
});
```

```ts
// artboard-panel.dom.test.ts — follow the file's existing style: build the panel
// directly, query by data attribute, assert on the callback.
it("writes the chosen language into the theme's metadata", () => {
  const metadataChange = vi.fn();
  const panel = createArtboardPanel(document.body, undefined, vi.fn(), {
    onMetadataChange: metadataChange,
  });
  panel.render({ width: 1280, height: 720 }, { name: "Before", locale: "en" });

  const language = panel.root.querySelector<HTMLSelectElement>(
    "[data-vigilia-theme-language]",
  )!;
  expect(language.value).toBe("en");

  const vi = Array.from(language.options).find(
    (option) => option.value === "vi",
  );
  // The list must actually offer it; a `select.value = "vi"` with no matching
  // option silently reads back as "" and the test would pass vacuously.
  expect(vi).toBeDefined();
  language.value = "vi";
  language.dispatchEvent(new Event("change"));

  expect(metadataChange).toHaveBeenLastCalledWith({
    name: "Before",
    locale: "vi",
  });

  // The spec's "resolved names shown live": the author sees the words the
  // language actually spells, not only its English label. Cross-checked against
  // the name functions rather than `formatInstant`, so a broken formatter cannot
  // make both sides of the assertion wrong together.
  const sample = panel.root.querySelector<HTMLOutputElement>(
    "[data-vigilia-theme-language-sample]",
  )!.textContent!;
  const parts = parseInstant(instantIn(Date.now()))!;
  expect(sample).toContain(monthName(parts, "vi", "long"));
  expect(sample).toContain(weekdayName(parts, "vi", "long"));
  expect(sample).not.toContain(monthName(parts, "en", "long"));
});

it("keeps a declared language that is outside the list", () => {
  const panel = createArtboardPanel(document.body, undefined, vi.fn());
  panel.render(
    { width: 1280, height: 720 },
    { name: "Hand-edited", locale: "cy" },
  );

  const language = panel.root.querySelector<HTMLSelectElement>(
    "[data-vigilia-theme-language]",
  )!;

  // Welsh is not one of the fifteen, but a document declaring it must not be
  // silently rewritten to English by the panel that displays it.
  expect(language.value).toBe("cy");
});
```

Two existing assertions in this file compare the whole metadata object with `toEqual` (`{ name: "Living Room" }` and `{ name: "After", version: "1.2.3" }`). Adding `locale` to `submitMetadata`'s output breaks both. Update them in this task to include the language the panel now always submits — and since `compactMetadata` only drops empty strings, a rendered theme with no declared language submits `locale: "en"` from the select's default.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run packages/editor/src/theme-languages.test.ts packages/editor/src/artboard-panel.dom.test.ts`
Expected: FAIL — `theme-languages.ts` does not exist, and the panel has no `[data-vigilia-theme-language]`.

- [ ] **Step 3: Implement the list and the control**

```ts
// theme-languages.ts
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
  // Built once: `Intl.DisplayNames` construction is not free and this runs per
  // option per render.
  return displayNames().of(tag) ?? tag;
}

let names: Intl.DisplayNames | undefined;

function displayNames(): Intl.DisplayNames {
  names ??= new Intl.DisplayNames(["en"], { type: "language" });
  return names;
}
```

Typing it `readonly string[]` rather than `as const` is deliberate: the panel calls `.includes(declared)` with a value read from a document, which a literal tuple type rejects.

```ts
// artboard-panel.ts — beside the name/author/description inputs
  const language = selectInput(uiCopy.panels.language, "vigiliaThemeLanguage");
  refreshLanguageOptions(language.select);
```

```ts
// artboard-panel.ts — beside refreshPaletteOptions, which is the same shape
/**
 * The fifteen curated languages, plus the document's own when it declares one
 * outside them: a hand-edited or store-downloaded theme must not be silently
 * rewritten to English by the panel that displays it.
 */
function refreshLanguageOptions(
  select: HTMLSelectElement,
  declared?: string,
): void {
  select.replaceChildren();
  const tags =
    declared === undefined || THEME_LANGUAGES.includes(declared)
      ? THEME_LANGUAGES
      : [...THEME_LANGUAGES, declared];

  for (const tag of tags) {
    select.append(new Option(languageLabel(tag), tag));
  }
}
```

Then three edits inside the panel:

- `render` calls `refreshLanguageOptions(language.select, metadata?.locale)` beside the other `render` assignments, and sets `language.select.value = metadata?.locale ?? "en";` after the name/author/description assignments.
- `submitMetadata` adds `locale: language.select.value` to the object it compacts.
- `language.select.addEventListener("change", submitMetadata);` joins the other listeners, and `fieldRow(language)` joins the `root.append(...)` list after `fieldRow(description)`.

The spec asks that the author see the actual words rather than only a language's name, so the row carries a live sample. It reuses the same formatter the dashboard will, rather than assembling names a second way:

```ts
// artboard-panel.ts — beside the version output, which is the same element shape
  const languageSample = document.createElement("output");
  languageSample.dataset["vigiliaThemeLanguageSample"] = "";

/** The words this language actually spells, for the instant a clock would read. */
function refreshLanguageSample(locale: string): void {
  languageSample.textContent =
    formatInstant(instantIn(Date.now()), "MMMM dddd", undefined, locale) ?? "";
}
```

Call `refreshLanguageSample(language.select.value)` from `render` and from a `change` listener that runs before `submitMetadata`, so picking a language shows its words immediately.

`uiCopy.panels` gains `language: "Language"`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run packages/editor/src/theme-languages.test.ts packages/editor/src/artboard-panel.dom.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/packages/editor/src/theme-languages.ts src/web/packages/editor/src/theme-languages.test.ts src/web/packages/editor/src/artboard-panel.ts src/web/packages/editor/src/artboard-panel.dom.test.ts src/web/packages/editor/src/ui-copy.ts
git commit -m "feat(editor): let an author choose the theme's language"
```

---

## Task 8: Browser proof against the real host

**Files:**
- Modify: `src/web/tests/e2e/host-theme.ts` (a Japanese seed)
- Modify: `src/web/tests/e2e/host-player.spec.ts`

**Interfaces:**
- Consumes: `HOST_THEMES_DIR`, `HOST_PORT`, the seeding helpers already in `host-theme.ts`.
- Produces: nothing later tasks consume.

- [ ] **Step 1: Write the failing test**

The player paints into a canvas, so there is no element to assert text on. The file already reads painted text with `canvasProp(page, nodeId, "text")` and drives the host through the `HOST` constant; follow that rather than inventing a selector.

**A weekday name cannot be asserted as a fixed string here**, because the fixture's binding resolves against the host's *current* instant — `dddd` alone returns whatever today is. Seed the theme with a literal-prefixed format instead, so the assertion has a fixed part and a language-dependent part:

```ts
// host-theme.ts — two seeds differing only in the document's language
const languageThemes = [
  ["e2e-lang-ja", "ja"],
  ["e2e-lang-en", "en"],
] as const;

// for each: envelopeFor(id, `E2E ${locale}`, CLOCK_NODE_ID, {
//   semanticKey: "date.today",
//   // The bracketed text is literal in every language, so the part that varies
//   // is the month and weekday name beside it and nothing else.
//   format: "[日付 ]MMM ddd",
// }, locale)
```

```ts
// host-player.spec.ts
test("a theme's language decides the words its clock shows", async ({
  page,
}, testInfo) => {
  test.skip(
    !isDesktopSurface(testInfo),
    "one desktop pass is enough for the host path",
  );

  await page.goto(`${HOST}/?theme=${HOST_JAPANESE_THEME_ID}`);
  const japanese = String(await canvasProp(page, CLOCK_NODE_ID, "text"));

  await page.goto(`${HOST}/?theme=${HOST_ENGLISH_THEME_ID}`);
  const english = String(await canvasProp(page, CLOCK_NODE_ID, "text"));

  // Same theme shape, same binding, same instant, same literal — only the
  // declared language differs, so anything that differs in the painted text is
  // the language and nothing else.
  expect(japanese).toMatch(/^日付 .*月 /);
  expect(english).toMatch(/^日付 [A-Z][a-z]{2} /);
  expect(japanese).not.toBe(english);
});
```

Comparing two seeds that differ only in `locale` is what makes this a language test; asserting a Japanese string against a literal would only prove the fixture spells it.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run build && npx playwright test host-player --grep "language decides"`
Expected: FAIL — `host-theme.ts` exports neither id.

- [ ] **Step 3: Seed both and widen `envelopeFor`**

Add `HOST_JAPANESE_THEME_ID` and `HOST_ENGLISH_THEME_ID` beside the existing theme ids, and both themes to the `themes` array in `seedHostTheme`, so `writeThemePackage` validates them like the others. `envelopeFor` must take the language:

```ts
const envelopeFor = (
  id: string,
  name: string,
  nodeId: string,
  binding: { semanticKey: string; format?: string; precision?: number },
  // English is every other fixture's language; only the language test varies it.
  locale = "en",
) => ({
  // ...unchanged
  metadata: { name, locale },
```

Every existing call site keeps its behaviour by taking the default.

- [ ] **Step 4: Rebuild and run the test to verify it passes**

Run: `npm run build && npx playwright test host-player --grep "language decides"`
Expected: PASS — the `ja` seed paints a `月` month name and the `en` seed a Latin one, read from the rendered canvas text rather than an object count. Playwright previews built bundles, so the rebuild is required, not optional.

- [ ] **Step 5: Run the project's gates**

Run: `npm run lint && npm run format:check && npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/web/tests/e2e/host-theme.ts src/web/tests/e2e/host-player.spec.ts
git commit -m "test(e2e): prove a theme's language decides what its clock paints"
```

---

## Task 9: Docs take the new truth

**Files:**
- Modify: `src/web/packages/renderer-core/src/scene/datetime/names.ts` (the header comment already written in Task 2)
- Modify: `src/web/packages/renderer-core/src/scene/datetime/format.ts` (drop the "Month and weekday names are English" paragraph the move carried over)
- Modify: `README.md` (metadata's "descriptive, not render-affecting" claim)
- Modify: `docs/architecture/ownership.md` (one row becomes three)
- Modify: `docs/product/requirements.md:58` (one clause)
- Modify: `docs/superpowers/specs/2026-09-26-clock-and-theme-locale.md` (Status)
- Modify: `STATUS.md`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing.

- [ ] **Step 1: Correct the comments the code now contradicts**

In `format.ts`, delete the carried-over paragraph claiming month and weekday names are English and the locale question is unanswered — that is the decision this work reverses. In `names.ts`, the header already explains why names come from `Intl`.

- [ ] **Step 2: Split the ownership row**

`docs/architecture/ownership.md` replaces:

```
| Instant reading, author format tokens and the zone list | `renderer-core/src/scene/datetime-format.ts` |
```

with three rows:

```
| Instant reading, offsets and the zone list | `renderer-core/src/scene/datetime/instant.ts` |
| The author's date/time format tokens | `renderer-core/src/scene/datetime/format.ts` |
| Locale-spelled month, weekday and day-period names | `renderer-core/src/scene/datetime/names.ts` |
```

and adds the language list beside the curated font catalog row:

```
| The languages an author may pick | `editor/src/theme-languages.ts` |
```

- [ ] **Step 3: Correct the two claims that are now false**

`README.md`: metadata is no longer purely descriptive — `locale` is render-affecting. State what it now is: descriptive fields plus the language the theme's text is written in.

`docs/product/requirements.md:58`: "Multiple locales are not in scope" is true of the product's own UI copy; add the clause that a theme declares the language its own text is written in.

- [ ] **Step 4: Update the spec's status and STATUS.md**

Set the spec's `- **Status:**` to implemented-with-the-landed-notes, and replace `STATUS.md`'s "Last completed change" with a 1–5 bullet summary of this work per the repository rule — never append older summaries.

- [ ] **Step 5: Run the gates**

Run: `npm run format:check && npm run lint && npm run status:check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add README.md docs/architecture/ownership.md docs/product/requirements.md docs/superpowers/specs/2026-09-26-clock-and-theme-locale.md STATUS.md src/web/packages/renderer-core/src/scene/datetime
git commit -m "docs: record the theme language and the split datetime modules"
```

---

## Self-Review

**Spec coverage.** Provider measures / display formats — already true, unchanged by this plan and pinned by the existing `clock.test.ts`. Author owns format and zone — unchanged, existing tests. Theme declares its language — Tasks 3, 4. Only word tokens consult it, numerics ASCII — Tasks 2, 5. Required and refused-when-unusable — Task 3. Reaches the formatter as a runtime input — Tasks 5, 6. Authoring control from a curated list with platform labels — Task 7. Module split into three — Task 1. Docs and ownership rows — Task 9. Browser proof — Task 8. Every spec section has an owning task.

**Placeholder scan.** No "TBD", no "add appropriate error handling", no "similar to Task N". Two steps deliberately delegate a mechanical sweep to a failing test run rather than guessing: Task 4 Step 3 (fixture locales), and Task 1 Step 2's importer list is confirmed by a `grep` the step states. Both name what to do and what to expect.

**Type consistency.** `locale` is `string | undefined` at every boundary: `ThemeMetadata.locale?: string`, `PlanContext.locale?: string`, `LiveRuntime.setLocale(locale: string | undefined)`, `SelectionInspector.setLocale(locale: string | undefined)`, `formatInstant(..., locale: string = DEFAULT_LOCALE)`. `isLocaleName` and `DEFAULT_LOCALE` are produced once in Task 2 and consumed in Tasks 3 and 7 with those names. `monthName`/`weekdayName`/`dayPeriod` take `(parts, locale, width?)` consistently in Task 2 and the TOKENS table in the same task. `THEME_LANGUAGES` is `readonly string[]`, not an `as const` tuple, so the panel's `.includes(declared)` accepts a tag read from a document.

**Verified against the platform, not recalled.** Every name, label and period the plan asserts was probed in this repository's Node before being written: `de` short weekday `Do`, `zh-Hant` short weekday `週四`, `vi` month `Tháng 9`, `pt` short month `set.`, `ja` periods `午前`/`午後`, `fr` period `PM`, and `Intl.DisplayNames` labels `Simplified Chinese` / `Korean` / `Vietnamese`. `ar`'s short weekday is identical to its long form, which is a further case the old `slice(0, 3)` table got wrong. `supportedLocalesOf` throws for malformed tags and returns empty for well-formed-unsupported ones, which is why `isLocaleName` has both a `catch` and a length check.

**Review Focus.** Item 1 is tested in Task 3 Step 1 (a metadata bag without `locale` refuses, naming `/metadata/locale`, as does a document with no metadata at all). Item 2 in Task 3 Step 1 (declares `ja`, binds nothing, validates). Item 3 in Task 5 Step 1 (Tokyo's own date wins, so the UTC day cannot answer `Thursday`). Item 4 in Task 2 Step 1, which pins both a throwing tag and a silently-resolved one against the fallback. Item 5 in Task 2 Step 1 (`ja` at noon and midnight).
