import { describe, expect, it } from "vitest";
import {
  VIGILIA_PAINT_PROPERTY,
  VIGILIA_TEXT_PROPERTY,
} from "@vigilia/scene-fabric";
import {
  createNewChartDefaults,
  createNewPaintDefaults,
  createNewTextDefaults,
} from "./new-object-defaults.js";

const globals = {
  palette: {
    none: {
      name: "None",
      value: { kind: "solid" as const, color: "transparent" },
    },
    ink: { name: "Ink", value: { kind: "solid" as const, color: "#102030" } },
  },
  typePresets: {
    body: {
      name: "Body",
      value: { family: "Inter", size: 16, weight: 500, lineHeight: 1.2 },
    },
  },
};

describe("new object defaults", () => {
  it("derives a non-transparent palette reference for a new paintable object", () => {
    const defaults = createNewPaintDefaults(globals);

    expect(defaults.fill).toBe("#102030");
    expect(defaults[VIGILIA_PAINT_PROPERTY]).toEqual({ fill: "palette.ink" });
  });

  it("derives per-run palette and type-preset references for new text", () => {
    const defaults = createNewTextDefaults(globals, "New text");

    expect(defaults).toMatchObject({
      fill: "#102030",
      fontFamily: "Inter",
      fontSize: 16,
      fontWeight: 500,
      lineHeight: 1.2,
      [VIGILIA_PAINT_PROPERTY]: { fill: "palette.ink" },
      [VIGILIA_TEXT_PROPERTY]: {
        runs: [
          {
            text: "New text",
            typePreset: "typePresets.body",
            style: { color: { ref: "palette.ink" } },
          },
        ],
      },
    });
  });

  it("refuses to invent local paint or type values when references are unavailable", () => {
    expect(() => createNewPaintDefaults(undefined)).toThrow("palette token");
    expect(() =>
      createNewTextDefaults({ palette: globals.palette }, "New text"),
    ).toThrow("type preset");
  });

  it.each(["gauge", "line", "bar", "pie"] as const)(
    "derives %s settings using only existing palette references",
    (family) => {
      const settings = createNewChartDefaults(globals, family);

      expect(JSON.stringify(settings)).toContain("palette.ink");
      expect(JSON.stringify(settings)).not.toContain('"color"');
    },
  );

  it("refuses chart creation without a non-transparent palette token", () => {
    expect(() => createNewChartDefaults(undefined, "gauge")).toThrow(
      "palette token",
    );
  });
});
