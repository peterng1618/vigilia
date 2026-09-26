/**
 * The words a language spells: month, weekday and day-period names.
 *
 * These come from `Intl` rather than a table. A table of English names cannot be
 * localized, and its short forms cannot be truncated from the long ones: German's
 * short weekday is `Do`, not `Don`.
 */

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
  return formatter(
    locale,
    width === "long" ? "monthLong" : "monthShort",
  ).format(dateOf(parts));
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
