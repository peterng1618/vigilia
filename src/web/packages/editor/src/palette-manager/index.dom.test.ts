// @vitest-environment jsdom
import type { Artboard } from "@vigilia/renderer-core";
import { VIGILIA_PAINT_PROPERTY } from "@vigilia/scene-fabric";
import { Canvas, Rect } from "fabric/es";
import { describe, expect, it } from "vitest";
import { reassignPaletteToken } from "./index.js";

describe("reassignPaletteToken", () => {
  it("rewrites canvas paint refs, artboard refs and drops the palette entry", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const shape = new Rect({ id: "panel" });
    shape.set(VIGILIA_PAINT_PROPERTY, { fill: "palette.old" });
    canvas.add(shape);
    const artboard: Artboard = {
      width: 100,
      height: 100,
      background: { ref: "palette.old" },
    };
    const palette = {
      old: { name: "Old", value: { kind: "solid", color: "#000" } as const },
      new: { name: "New", value: { kind: "solid", color: "#fff" } as const },
    };

    const result = reassignPaletteToken(canvas, artboard, palette, "old", "new");

    expect(shape.get(VIGILIA_PAINT_PROPERTY)).toEqual({ fill: "palette.new" });
    expect(result.artboard.background).toEqual({ ref: "palette.new" });
    expect(result.palette).toEqual({ new: palette.new });
    expect(result.from).toBe("palette.old");
    expect(result.to).toBe("palette.new");
  });

  it("leaves an unrelated artboard reference untouched", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const artboard: Artboard = {
      width: 100,
      height: 100,
      barColor: { ref: "palette.other" },
    };
    const palette = {
      old: { name: "Old", value: { kind: "solid", color: "#000" } as const },
      new: { name: "New", value: { kind: "solid", color: "#fff" } as const },
    };

    const result = reassignPaletteToken(canvas, artboard, palette, "old", "new");

    expect(result.artboard.barColor).toEqual({ ref: "palette.other" });
  });
});
