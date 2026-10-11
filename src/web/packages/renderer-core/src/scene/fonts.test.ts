import { describe, expect, it } from "vitest";
import { isGenericFamily, parseFontStack } from "./fonts.js";

/** Only the pure half is tested here: the metric probe needs a canvas. */

describe("parseFontStack", () => {
  it("splits a stack and strips quotes", () => {
    expect(
      parseFontStack(
        "'Segoe UI Variable Display', \"Segoe UI\", system-ui, sans-serif",
      ),
    ).toEqual([
      "Segoe UI Variable Display",
      "Segoe UI",
      "system-ui",
      "sans-serif",
    ]);
  });

  it("handles a single family", () => {
    expect(parseFontStack("Inter")).toEqual(["Inter"]);
  });

  it("drops empty entries from a trailing or doubled comma", () => {
    expect(parseFontStack("Inter,, ,sans-serif,")).toEqual([
      "Inter",
      "sans-serif",
    ]);
  });

  it("returns nothing for a non-string", () => {
    expect(parseFontStack(undefined)).toEqual([]);
    expect(parseFontStack(42)).toEqual([]);
    expect(parseFontStack("")).toEqual([]);
  });
});

describe("isGenericFamily", () => {
  it("recognises the CSS generics, case- and space-insensitively", () => {
    expect(isGenericFamily("sans-serif")).toBe(true);
    expect(isGenericFamily("  MONOSPACE ")).toBe(true);
    expect(isGenericFamily("system-ui")).toBe(true);
  });

  it("treats a real font name as specific", () => {
    expect(isGenericFamily("Segoe UI")).toBe(false);
    expect(isGenericFamily("Inter")).toBe(false);
  });
});
