import { describe, expect, it } from "vitest";
import {
  hsvaToRgba,
  parseColour,
  parseHex,
  rgbaToHsva,
  toHex,
} from "./colour-maths.js";

describe("colour maths", () => {
  it("reads every hex length the editor can hold", () => {
    // 3, 4, 6 and 8 digits all reach this field: the reference theme ships
    // `#081523d9` and opaque six-digit values alike.
    expect(parseHex("#f00")).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parseHex("#f008")?.a).toBeCloseTo(136 / 255, 5);
    expect(parseHex("#102030")).toEqual({ r: 16, g: 32, b: 48, a: 1 });
    expect(parseHex("#081523d9")).toEqual({ r: 8, g: 21, b: 35, a: 217 / 255 });
    expect(parseHex("nope")).toBeUndefined();
    expect(parseHex("#12345")).toBeUndefined();
  });

  it("keeps alpha, which is the whole reason this is not a native input", () => {
    // `panel` is 85% and `frost` is 30% in the reference theme.
    const panel = parseHex("#081523d9");
    expect(panel?.a).toBeCloseTo(217 / 255, 5);
    expect(toHex(panel!)).toBe("#081523d9");
    expect(toHex(parseHex("#ff000000")!)).toBe("#ff000000");
    // Fully opaque loses the fourth pair, so an opaque colour reads clean.
    expect(toHex(parseHex("#102030ff")!)).toBe("#102030");
  });

  it("round-trips through HSV without drifting", () => {
    for (const hex of [
      "#102030",
      "#d97316",
      "#3ba55c",
      "#c026d3",
      "#ffffff",
      "#000000",
    ]) {
      const rgba = parseHex(hex)!;
      const back = hsvaToRgba(rgbaToHsva(rgba));
      expect(toHex(back)).toBe(hex);
    }
  });

  it("reads the hsl() the theme already carries, alpha included", () => {
    expect(parseColour("hsl(210, 40%, 30%)")).toBeDefined();
    expect(parseColour("hsla(210, 40%, 30%, 0.5)")).toBeDefined();
    expect(parseColour("not-a-colour")).toBeUndefined();
    expect(parseColour("#GGG")).toBeUndefined();
  });

  it("reads the two token forms the Starter actually ships", () => {
    expect(parseColour("#081523d9")?.a).toBeCloseTo(217 / 255, 5);
    expect(parseColour("transparent")?.a).toBe(0);
  });
});
