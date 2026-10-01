// @vitest-environment jsdom

import { Textbox } from "fabric/es";
import { describe, expect, it } from "vitest";
import { applyEditorControls } from "./index.js";

/**
 * A textbox's vertical edge, dragged.
 *
 * vg-089: an author applied a type preset taller than the box they wrote, and
 * the text was clipped with no way to move the box by hand — the two vertical
 * handles were hidden. What the handle writes is the part that decides whether
 * it works: Fabric's `height` is re-derived from the wrapped text on every
 * `initDimensions` (`fabric/dist/index.mjs:18452`), so a handle that stopped
 * there would be undone by the next text pass. The authored box is what
 * persists, and the object reads it back.
 */

/** A `Textbox` in the vg-089 state: authored 27 tall, a 90px run in it. */
function dragged(height: number, draggedHeight: number): Textbox {
  const textbox = new Textbox("CPU", { width: 140, height, fontSize: 90 });
  textbox.set("vigiliaText", {
    runs: [{ kind: "literal", text: "CPU" }],
    box: { width: 140, height },
  });
  // What Fabric's `changeHeight` leaves behind: its own height, unscaled.
  textbox.set("height", draggedHeight);
  return textbox;
}

/** Releases a control the way a completed drag does. */
function release(textbox: Textbox, key: string): void {
  applyEditorControls();
  Textbox.ownDefaults.controls?.[key]?.mouseUpHandler?.(
    {} as never,
    { target: textbox } as never,
    0,
    0,
  );
}

function boxOf(textbox: Textbox): unknown {
  return (textbox.get("vigiliaText") as { box?: unknown }).box;
}

describe("a textbox's vertical edge writes the authored box", () => {
  it("records the dragged height in the box, not in Fabric's own height", () => {
    const textbox = dragged(27, 130);

    release(textbox, "mb");

    expect(boxOf(textbox)).toMatchObject({ width: 140, height: 130 });
  });

  it("leaves Fabric's derived height to the pass that owns it", () => {
    const textbox = dragged(27, 130);

    release(textbox, "mb");

    // The height itself is not what persists. Asserting it would pin Fabric's
    // derivation, which the next text pass overwrites on purpose.
    expect(textbox.height).toBe(130);
  });

  it("authors a whole box from an object that had none", () => {
    // A text object the editor inserted carries runs but no box: its height is
    // whatever Fabric measured, which is the case the handle is for. Writing the
    // height alone would leave `{ height }` with no width, and `authoredBox`
    // would multiply an `undefined` width by the scale on the next pass.
    const textbox = new Textbox("CPU", { width: 140, fontSize: 90 });
    textbox.set("vigiliaText", { runs: [{ kind: "literal", text: "CPU" }] });
    textbox.set("height", 130);

    release(textbox, "mb");

    // Its own measured width, not the 140 it was built at: without a box the
    // object has widened to its longest run, and the seeded box has to say what
    // is on the canvas rather than what was asked for.
    expect(boxOf(textbox)).toMatchObject({
      width: textbox.width,
      height: 130,
    });
    expect(textbox.width).toBeGreaterThan(140);
  });

  it("refuses a height that is not a usable number rather than coercing it", () => {
    const textbox = dragged(27, 130);
    textbox.set("height", Number.NaN);

    release(textbox, "mb");

    // The box the author already had is left alone: a non-number is not a
    // height, and zero would be a box nothing can paint in.
    expect(boxOf(textbox)).toMatchObject({ width: 140, height: 27 });
  });

  it("records the dragged height unscaled, on a scaled object", () => {
    // `vigiliaText.box` is the number the object measures against and
    // `boxFrom` puts the scale back on for the clip. Multiplying here would
    // grow the box by the scale on every drag.
    const textbox = dragged(27, 87);
    textbox.set("scaleY", 1.5);

    release(textbox, "mb");

    expect(boxOf(textbox)).toMatchObject({ width: 140, height: 87 });
  });
});
