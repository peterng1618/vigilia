import { describe, expect, it } from "vitest";
import { parseInstant } from "./instant.js";
import { dayPeriod, isLocaleName, monthName, weekdayName } from "./names.js";

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
