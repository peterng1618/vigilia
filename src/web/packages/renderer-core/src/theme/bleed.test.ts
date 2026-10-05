import { describe, expect, it } from "vitest";
import { isBleedMark, objectBleeds, VIGILIA_BLEEDS_PROPERTY } from "./bleed.js";

/**
 * The flag that says a crop is a decision.
 *
 * The narrowness is the whole point: `isBleedMark` accepts `true` and nothing
 * else, so a document cannot come to carry `vigiliaBleeds: false` on every
 * object in it. Absent and `false` both read as not bleeding, but only `true`
 * is ever written — which is what keeps the persisted set small enough to
 * search for by eye.
 */

function object(): {
  get(name: string): unknown;
  set(name: string, value: unknown): void;
} {
  const values = new Map<string, unknown>();
  return {
    get: (name) => values.get(name),
    set: (name, value) => values.set(name, value),
  };
}

describe("a deliberate bleed", () => {
  it("names its property the way the other authored ones are named", () => {
    expect(VIGILIA_BLEEDS_PROPERTY).toBe("vigiliaBleeds");
  });

  it("reads the mark off a revived object", () => {
    const target = object();
    target.set(VIGILIA_BLEEDS_PROPERTY, true);

    expect(objectBleeds(target)).toBe(true);
  });

  it("reads a scene authored before the flag as not bleeding", () => {
    // Absence is the whole backward-compatibility story: a document saved
    // before this flag existed must open and read exactly as it did.
    expect(objectBleeds(object())).toBe(false);
  });

  it("accepts only the literal true, so false is never persisted", () => {
    expect(isBleedMark(true)).toBe(true);
    expect(isBleedMark(false)).toBe(false);
    expect(isBleedMark(undefined)).toBe(false);
    expect(isBleedMark(null)).toBe(false);
    expect(isBleedMark("true")).toBe(false);
    expect(isBleedMark(1)).toBe(false);
    expect(isBleedMark({})).toBe(false);
  });

  it("treats a malformed value as no mark rather than coercing it", () => {
    // Trust boundary, not a repair path — the same rule `objectName` and
    // `glassTreatment` follow. A value that fails here was already refused at
    // import; reading it as a mark would make a broken file quiet rather than
    // loud.
    const target = object();
    target.set(VIGILIA_BLEEDS_PROPERTY, "yes");

    expect(objectBleeds(target)).toBe(false);
  });
});
