/**
 * Author-chosen formatting for a time or date reading.
 *
 * How a clock *reads* is a design decision, so the author picks the tokens.
 *
 * A small token set, not a pattern language: an arbitrary ICU pattern would be a
 * parser and a second formatting model that could silently disagree with the
 * first.
 *
 * **Literal text is quoted in brackets.** Tokens are letters, and prose is full
 * of letters: an unquoted `Today` would render as `Tod` + day-of-month + a
 * stray year token. Brackets make the author's intent explicit and keep every
 * token unambiguous — `[Today is ]dddd`. An unrecognised token renders
 * literally rather than blanking the value, so a typo is visible.
 *
 * Only the tokens that spell a word — `MMMM`, `MMM`, `dddd`, `ddd`, `A`, `a` —
 * consult the language. Every numeric token is ASCII in every language.
 */

import { type Parts, parseInstant, partsInZone } from "./instant.js";
import { DEFAULT_LOCALE, dayPeriod, monthName, weekdayName } from "./names.js";

/**
 * Longest first so `HH` is read before `H` and `MMMM` before `MMM`. Built per
 * call so the table cannot capture a stale language.
 */
const tokensFor = (
  locale: string,
): readonly (readonly [string, (parts: Parts) => string])[] => [
  ["YYYY", (p) => String(p.year).padStart(4, "0")],
  ["YY", (p) => String(p.year % 100).padStart(2, "0")],
  ["MMMM", (p) => monthName(p, locale, "long")],
  ["MMM", (p) => monthName(p, locale, "short")],
  ["MM", (p) => String(p.month).padStart(2, "0")],
  ["M", (p) => String(p.month)],
  ["dddd", (p) => weekdayName(p, locale, "long")],
  ["ddd", (p) => weekdayName(p, locale, "short")],
  ["DD", (p) => String(p.day).padStart(2, "0")],
  ["D", (p) => String(p.day)],
  ["HH", (p) => String(p.hour).padStart(2, "0")],
  ["H", (p) => String(p.hour)],
  [
    "hh",
    (p) => {
      const hour = p.hour % 12 === 0 ? 12 : p.hour % 12;
      return String(hour).padStart(2, "0");
    },
  ],
  ["h", (p) => String(p.hour % 12 === 0 ? 12 : p.hour % 12)],
  ["mm", (p) => String(p.minute).padStart(2, "0")],
  ["ss", (p) => String(p.second).padStart(2, "0")],
  ["A", (p) => dayPeriod(p, locale)],
  // `a` is `A` lowered, so the two agree in every language.
  ["a", (p) => dayPeriod(p, locale).toLowerCase()],
];

/** Renders an instant with the author's tokens; literals pass through. */
export function formatInstant(
  value: string,
  format: string,
  timeZone?: string,
  locale: string = DEFAULT_LOCALE,
): string | undefined {
  const parts =
    timeZone === undefined
      ? parseInstant(value)
      : partsInZone(Date.parse(value), timeZone);
  if (parts === undefined) return undefined;

  let out = "";
  let index = 0;
  const tokens = tokensFor(locale);

  while (index < format.length) {
    // Bracketed text is the author's literal, verbatim.
    if (format[index] === "[") {
      const close = format.indexOf("]", index + 1);
      const end = close === -1 ? format.length : close;
      out += format.slice(index + 1, end);
      index = close === -1 ? end : close + 1;
      continue;
    }

    const token = tokens.find(([name]) => format.startsWith(name, index));

    if (token === undefined) {
      out += format[index];
      index += 1;
      continue;
    }

    out += token[1](parts);
    index += token[0].length;
  }

  return out;
}
