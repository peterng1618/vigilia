import { describe, expect, it } from "vitest";
import {
  isGenericFamily,
  parseFontStack,
  requestedFontFamilies,
} from "./fonts.js";
import { buildScenePlan } from "./plan.js";
import { emptySampleSource } from "../data/source.js";
import type { ThemeDocument, ThemeNode } from "../theme/document.js";

/**
 * Only the pure half is tested here. The metric probe needs a canvas and is
 * covered by `tests/e2e/display-fabric.spec.ts`, which is also where the discovery
 * that `document.fonts.check` cannot answer this question is pinned.
 */

function planOf(
  nodes: readonly ThemeNode[],
): ReturnType<typeof buildScenePlan> {
  const document: ThemeDocument = {
    schemaVersion: 1,
    id: "d",
    artboard: { width: 100, height: 100 },
    nodes,
  };

  return buildScenePlan({
    document,
    source: emptySampleSource,
    nowMs: 0,
    animate: false,
  });
}

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

describe("requestedFontFamilies", () => {
  it("collects specific families and ignores generics", () => {
    // A stack ending in sans-serif always resolves, so reporting that as
    // missing would be noise — the interesting diagnostic is the specific
    // family in front of it.
    const plan = planOf([
      {
        id: "t",
        type: "text",
        style: { fontFamily: { value: "Inter, system-ui, sans-serif" } },
        content: { runs: [{ kind: "literal", text: "x" }] },
      },
    ]);

    expect(requestedFontFamilies(plan)).toEqual(["Inter"]);
  });

  it("collects from per-run styles as well as node styles", () => {
    const plan = planOf([
      {
        id: "t",
        type: "text",
        style: { fontFamily: { value: "Inter" } },
        content: {
          runs: [
            {
              kind: "literal",
              text: "a",
              style: { fontFamily: { value: "Iosevka" } },
            },
            { kind: "literal", text: "b" },
          ],
        },
      },
    ]);

    expect(requestedFontFamilies(plan)).toEqual(["Inter", "Iosevka"]);
  });

  it("descends into groups", () => {
    const plan = planOf([
      {
        id: "g",
        type: "group",
        children: [
          {
            id: "t",
            type: "text",
            style: { fontFamily: { value: "Nested Family" } },
            content: { runs: [] },
          },
        ],
      },
    ]);

    expect(requestedFontFamilies(plan)).toEqual(["Nested Family"]);
  });

  it("de-duplicates, preserving first-seen order", () => {
    const plan = planOf([
      {
        id: "a",
        type: "text",
        style: { fontFamily: { value: "B" } },
        content: { runs: [] },
      },
      {
        id: "b",
        type: "text",
        style: { fontFamily: { value: "A" } },
        content: { runs: [] },
      },
      {
        id: "c",
        type: "text",
        style: { fontFamily: { value: "B" } },
        content: { runs: [] },
      },
    ]);

    expect(requestedFontFamilies(plan)).toEqual(["B", "A"]);
  });

  it("returns nothing when no font is named", () => {
    expect(
      requestedFontFamilies(planOf([{ id: "r", type: "rectangle" }])),
    ).toEqual([]);
  });
});
