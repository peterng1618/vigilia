import {
  VIGILIA_PAINT_PROPERTY,
  VIGILIA_TEXT_PROPERTY,
} from "@vigilia/scene-fabric";
import { describe, expect, it } from "vitest";
import {
  createNewChartDefaults,
  createNewPaintDefaults,
  createNewPanelDefaults,
  createNewTextDefaults,
  NEW_OBJECT_INSET,
} from "./new-object-defaults.js";

const globals = {
  palette: {
    none: {
      name: "None",
      value: { kind: "solid" as const, color: "transparent" },
    },
    background: {
      name: "Background",
      value: { kind: "solid" as const, color: "#0c0e13" },
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

  it("derives a new panel from a surface token, not a content one", () => {
    const defaults = createNewPanelDefaults(globals);

    // A panel is a surface. `ink` is the token a new *text* object takes, and
    // painting a whole card in it would hide every label the author puts on it.
    expect(defaults.fill).toBe("#0c0e13");
    expect(defaults[VIGILIA_PAINT_PROPERTY]).toEqual({
      fill: "palette.background",
    });
  });

  it("places a new panel inset, at artboard coordinates, sized and rounded", () => {
    const defaults = createNewPanelDefaults(globals);

    expect(defaults.left).toBe(NEW_OBJECT_INSET);
    expect(defaults.top).toBe(NEW_OBJECT_INSET);
    // Fabric's own origin is the centre, which would put a new panel half off
    // the corner the author cannot easily click.
    expect(defaults.originX).toBe("left");
    expect(defaults.originY).toBe("top");
    expect(defaults.width).toBeGreaterThan(0);
    expect(defaults.height).toBeGreaterThan(0);
    expect(defaults.rx).toBe(defaults.ry);
    expect(defaults.rx).toBeGreaterThan(0);
  });

  it("refuses a new panel without a palette token", () => {
    expect(() => createNewPanelDefaults(undefined)).toThrow("palette token");
  });
});
