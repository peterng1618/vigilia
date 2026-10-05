import { describe, expect, it } from "vitest";
import { formatInstant } from "./format.js";
import {
  instantIn,
  isTimeZoneName,
  knownTimeZones,
  parseInstant,
} from "./instant.js";

/** A Thursday: 2026-09-24, 14:07:09 at +07:00. */
const INSTANT = "2026-09-24T14:07:09+07:00";

describe("author-chosen date and time format", () => {
  it("renders the tokens an author writes", () => {
    expect(formatInstant(INSTANT, "HH:mm")).toBe("14:07");
    expect(formatInstant(INSTANT, "H:mm:ss")).toBe("14:07:09");
    expect(formatInstant(INSTANT, "DD MMM YYYY")).toBe("24 Sep 2026");
    expect(formatInstant(INSTANT, "MMMM D, YYYY")).toBe("September 24, 2026");
  });

  it("renders the day of week, which a wall clock needs", () => {
    // 2026-09-24 is a Thursday.
    expect(formatInstant(INSTANT, "dddd")).toBe("Thursday");
    expect(formatInstant(INSTANT, "ddd")).toBe("Thu");
    expect(formatInstant(INSTANT, "dddd, DD MMMM YYYY")).toBe(
      "Thursday, 24 September 2026",
    );
  });

  it("renders 12-hour form with a day period", () => {
    expect(formatInstant(INSTANT, "hh:mm a")).toBe("02:07 pm");
    expect(formatInstant(INSTANT, "h:mm A")).toBe("2:07 PM");
    // Midnight and noon are the two cases a naive modulo gets wrong.
    expect(formatInstant("2026-09-24T00:30:00Z", "h A")).toBe("12 AM");
    expect(formatInstant("2026-09-24T12:30:00Z", "h A")).toBe("12 PM");
  });

  it("keeps literals as written, so an author can punctuate freely", () => {
    // Literal text is bracketed, because tokens are letters and prose is full
    // of them: an unquoted "Today" would render as day-of-month + a stray year.
    expect(formatInstant(INSTANT, "[Today is ]dddd[, the ]DD[th]")).toBe(
      "Today is Thursday, the 24th",
    );
    expect(formatInstant(INSTANT, "HH:mm")).not.toContain(",");
  });

  it("keeps an unclosed bracket's text rather than dropping it", () => {
    // A half-typed format must not swallow the rest of the string.
    expect(formatInstant(INSTANT, "[Today")).toBe("Today");
    expect(formatInstant(INSTANT, "HH:mm [o")).toBe("14:07 o");
  });

  it("shows an unknown token literally rather than blanking the value", () => {
    // A typo must be visible, not silently swallowed.
    expect(formatInstant(INSTANT, "QQQ")).toBe("QQQ");
    expect(formatInstant(INSTANT, "HH:qq")).toBe("14:qq");
  });

  it("reads the components the instant's own offset describes", () => {
    const parts = parseInstant(INSTANT);

    expect(parts).toMatchObject({
      year: 2026,
      month: 9,
      day: 24,
      hour: 14,
      minute: 7,
      second: 9,
    });
  });

  it("refuses a value that is not an instant, rather than inventing a date", () => {
    for (const value of ["", "not a date", "17:04", "2026-13-45T00:00:00Z"]) {
      expect(parseInstant(value)).toBeUndefined();
      expect(formatInstant(value, "HH:mm")).toBeUndefined();
    }
  });
});

describe("the instant a provider reports", () => {
  /** 2026-09-24 07:07:09 UTC, a Thursday. */
  const NOW_MS = Date.UTC(2026, 8, 24, 7, 7, 9);

  it("reads as the chosen zone's wall clock, offset and all", () => {
    // 07:07 UTC is 16:07 in Tokyo, and the offset travels with the reading so a
    // display that never re-converts still shows the right time.
    expect(instantIn(NOW_MS, "Asia/Tokyo")).toBe("2026-09-24T16:07:09+09:00");
    expect(instantIn(NOW_MS, "America/Los_Angeles")).toBe(
      "2026-09-24T00:07:09-07:00",
    );
  });

  it("reads as this machine's clock when no zone is chosen", () => {
    const value = instantIn(NOW_MS);
    const local = new Date(NOW_MS);

    expect(parseInstant(value)).toMatchObject({
      year: local.getFullYear(),
      month: local.getMonth() + 1,
      day: local.getDate(),
      hour: local.getHours(),
    });
  });

  it("falls back to this machine rather than losing the clock", () => {
    expect(instantIn(NOW_MS, "Mars/Olympus")).toBe(instantIn(NOW_MS));
  });
});

describe("the zones an author may pin", () => {
  it("offers UTC, and only names this runtime resolves", () => {
    const zones = knownTimeZones();

    expect(zones[0]).toBe("UTC");
    expect(zones.every(isTimeZoneName)).toBe(true);
  });
});
