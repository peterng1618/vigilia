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
 * Month and weekday names are English, like the rest of the product's copy; the
 * consumer's locale is a separate question the settings page has not answered.
 */

import { type Parts, parseInstant, partsInZone } from "./instant.js";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Longest first so `HH` is read before `H` and `MMMM` before `MMM`. */
const TOKENS: readonly (readonly [string, (parts: Parts) => string])[] = [
  ["YYYY", (p) => String(p.year).padStart(4, "0")],
  ["YY", (p) => String(p.year % 100).padStart(2, "0")],
  ["MMMM", (p) => MONTHS[p.month - 1] ?? ""],
  ["MMM", (p) => (MONTHS[p.month - 1] ?? "").slice(0, 3)],
  ["MM", (p) => String(p.month).padStart(2, "0")],
  ["M", (p) => String(p.month)],
  ["dddd", (p) => WEEKDAYS[p.weekday] ?? ""],
  ["ddd", (p) => (WEEKDAYS[p.weekday] ?? "").slice(0, 3)],
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
  ["A", (p) => (p.hour < 12 ? "AM" : "PM")],
  ["a", (p) => (p.hour < 12 ? "am" : "pm")],
];

/** Renders an instant with the author's tokens; literals pass through. */
export function formatInstant(
  value: string,
  format: string,
  timeZone?: string,
): string | undefined {
  const parts =
    timeZone === undefined
      ? parseInstant(value)
      : partsInZone(Date.parse(value), timeZone);
  if (parts === undefined) return undefined;

  let out = "";
  let index = 0;

  while (index < format.length) {
    // Bracketed text is the author's literal, verbatim.
    if (format[index] === "[") {
      const close = format.indexOf("]", index + 1);
      const end = close === -1 ? format.length : close;
      out += format.slice(index + 1, end);
      index = close === -1 ? end : close + 1;
      continue;
    }

    const token = TOKENS.find(([name]) => format.startsWith(name, index));

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
