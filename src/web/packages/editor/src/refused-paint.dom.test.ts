// @vitest-environment jsdom

/**
 * That a refused paint reaches the author.
 *
 * `object-paint.test.ts` proves the pass reports a refusal; this proves the report
 * is not swallowed on the way out. An author whose document asked for a figure the
 * editor declined to draw has to be told, or they see the shape change and the
 * inspector read "Ink: not set" with no explanation of either.
 *
 * The channel is the shell's own: `errorManager.warn` fires `editor:warning`,
 * which `diagnostic-message.tsx` renders. Read from the canvas here rather than
 * from the return value, so the assertion is on what the author is shown.
 */

import {
  applyObjectPalettePaints,
  Arc,
  VIGILIA_PAINT_PROPERTY,
  Wedge,
} from "@vigilia/scene-fabric";
import { Canvas, StaticCanvas } from "fabric/es";
import { describe, expect, it } from "vitest";
import { createErrorManager } from "./error-manager/index.js";

const globals = {
  palette: {
    none: { name: "None", value: { kind: "solid", color: "transparent" } },
    panel: { name: "Panel", value: { kind: "solid", color: "#1a1f2b" } },
  },
} as never;

/** The warning text an author would see, as the shell's surface assembles it. */
async function toldOnLoad(make: () => unknown): Promise<string[]> {
  const told: string[] = [];
  const element = document.createElement("canvas");
  element.width = 400;
  element.height = 400;
  document.body.append(element);
  const canvas = new Canvas(element);
  const errors = createErrorManager(canvas);
  canvas.on(
    "editor:warning" as never,
    ((event: { message: string }) => {
      told.push(event.message);
    }) as never,
  );

  // A scene already carrying the shape, so this is the load path rather than the
  // authoring one — an author cannot set this fill through the inspector at all.
  // Its own element: Fabric refuses two canvases on one, and a refused fixture
  // fails for a reason that has nothing to do with the paint.
  const scene = document.createElement("canvas");
  const source = new StaticCanvas(scene, { width: 400, height: 400 });
  source.add(make() as never);
  source.renderAll();

  // What `editor-shell.ts` runs on mount: resolve the paints, then say anything
  // that could not be resolved.
  applyObjectPalettePaints(source, globals, {
    onRefusedPaint: (message) => errors.warn("paint", message),
  });
  return told;
}

describe("a document the editor will not draw as written", () => {
  it("tells the author that an arc's fill was not drawn", async () => {
    const told = await toldOnLoad(() => {
      const arc = new Arc({
        left: 20,
        top: 20,
        radius: 100,
        startAngle: 0,
        endAngle: 90,
        fill: "#1a1f2b",
        stroke: "",
      });
      arc.set(VIGILIA_PAINT_PROPERTY, { fill: "palette.panel" });
      return arc;
    });

    expect(told).toHaveLength(1);
    // Names the figure and says what was done instead, so the author can act on
    // it rather than merely being told something happened.
    expect(told[0]).toMatch(/fill/i);
    expect(told[0]).toMatch(/arc/i);
  });

  it("says nothing when the shape's fill was drawn", async () => {
    const told = await toldOnLoad(() => {
      const wedge = new Wedge({
        left: 20,
        top: 20,
        radius: 100,
        startAngle: 0,
        endAngle: 90,
        fill: "#1a1f2b",
      });
      wedge.set(VIGILIA_PAINT_PROPERTY, { fill: "palette.panel" });
      return wedge;
    });

    // A wedge's sector is a region it really has, so a warning here would be
    // crying wolf over the shape the product added the kind to draw.
    expect(told).toEqual([]);
  });
});
