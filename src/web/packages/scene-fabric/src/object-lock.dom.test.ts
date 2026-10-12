// @vitest-environment jsdom
import { Rect } from "fabric/es";
import { describe, expect, it } from "vitest";
import { isLocked } from "./object-lock.js";

describe("isLocked", () => {
  it("locks only on a literal true, so the third state does not split the readers", () => {
    const object = new Rect({ width: 10, height: 10 });

    expect(isLocked(object)).toBe(false);
    object.set("locked", false);
    expect(isLocked(object)).toBe(false);
    object.set("locked", true);
    expect(isLocked(object)).toBe(true);

    // The third state: a flag that is neither `true` nor `false`. Before this
    // helper the `=== true` readers answered "not locked" here and the `!== true`
    // readers answered "locked" — one fact with two answers. The single polarity
    // (a literal `true` locks, anything else does not) is what makes every
    // reader agree, and why this case pins that value and not the two the eleven
    // already agreed on.
    object.set("locked", "true");
    expect(isLocked(object)).toBe(false);
  });
});
