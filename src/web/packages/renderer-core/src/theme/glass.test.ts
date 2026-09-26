import { describe, expect, it } from "vitest";
import {
  glassTreatment,
  isGlassTreatment,
  MAX_GLASS_BLUR_RADIUS,
  supportsGlass,
  VIGILIA_GLASS_PROPERTY,
} from "./glass.js";

function objectWith(value: unknown): { get(name: string): unknown } {
  return {
    get: (name) => (name === VIGILIA_GLASS_PROPERTY ? value : undefined),
  };
}

describe("the glass treatment contract", () => {
  it("accepts the whole authored range, including the two off spellings", () => {
    // Absence is off; zero is authored-but-no-blur. Both must be expressible
    // without a clamp, and both are legal persisted state.
    expect(isGlassTreatment({ blurRadius: 0 })).toBe(true);
    expect(isGlassTreatment({ blurRadius: 1.5 })).toBe(true);
    expect(isGlassTreatment({ blurRadius: MAX_GLASS_BLUR_RADIUS })).toBe(true);
    expect(glassTreatment(objectWith(undefined))).toBeUndefined();
  });

  it("refuses a non-finite, negative or out-of-range radius", () => {
    expect(isGlassTreatment({ blurRadius: Number.NaN })).toBe(false);
    expect(isGlassTreatment({ blurRadius: Number.POSITIVE_INFINITY })).toBe(
      false,
    );
    expect(isGlassTreatment({ blurRadius: -0.5 })).toBe(false);
    expect(isGlassTreatment({ blurRadius: MAX_GLASS_BLUR_RADIUS + 0.01 })).toBe(
      false,
    );
  });

  it("refuses a wrong type or a missing radius rather than coercing it", () => {
    // A string "12" or an absent radius would both become 0 under coercion,
    // which is indistinguishable from an authored "no blur".
    expect(isGlassTreatment({ blurRadius: "12" })).toBe(false);
    expect(isGlassTreatment({ blurRadius: null })).toBe(false);
    expect(isGlassTreatment({})).toBe(false);
    expect(isGlassTreatment({ radius: 12 })).toBe(false);
    expect(isGlassTreatment(undefined)).toBe(false);
    expect(isGlassTreatment(null)).toBe(false);
    expect(isGlassTreatment(12)).toBe(false);
    expect(isGlassTreatment([{ blurRadius: 12 }])).toBe(false);
  });

  it("refuses a treatment carrying anything beyond the authored radius", () => {
    // Derived state must never ride along in the persisted treatment: a
    // resolved surface or a sampled device pixel would be exactly the leak
    // the persisted document must not carry.
    expect(isGlassTreatment({ blurRadius: 12, tint: "#fff" })).toBe(false);
    expect(isGlassTreatment({ blurRadius: 12, blurRadiusPx: 24 })).toBe(false);
  });

  it("reads a treatment off an object only when the property is valid", () => {
    expect(glassTreatment(objectWith({ blurRadius: 16 }))).toEqual({
      blurRadius: 16,
    });
    expect(glassTreatment(objectWith({ blurRadius: 999 }))).toBeUndefined();
  });

  it("hands back a copy, so a renderer cannot corrupt the revived object", () => {
    // The treatment on a revived object is the object's own state. Returning
    // it by reference would let a renderer that mutates what it read rewrite
    // the scene behind the validator's back; `readonly` is a compile-time
    // promise that a `ScenePlan` update or a `set()` would quietly break.
    const stored = { blurRadius: 16 };
    const read = glassTreatment(objectWith(stored));

    expect(read).toEqual({ blurRadius: 16 });
    expect(read).not.toBe(stored);

    (read as { blurRadius: number }).blurRadius = 999;
    expect(stored).toEqual({ blurRadius: 16 });
  });

  it("allows glass only on the kinds whose backdrop Task 1 measured", () => {
    expect(supportsGlass("Rect")).toBe(true);
    expect(supportsGlass("Group")).toBe(true);
    // A neighbouring shape may behave identically, but nothing has shown it
    // does, so it is refused until Task 4 measures it.
    expect(supportsGlass("Ellipse")).toBe(false);
    expect(supportsGlass("Circle")).toBe(false);
    expect(supportsGlass("Textbox")).toBe(false);
    expect(supportsGlass("VigiliaChart")).toBe(false);
    expect(supportsGlass("FabricImage")).toBe(false);
    expect(supportsGlass("rect")).toBe(false);
  });
});
