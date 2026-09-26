// @vitest-environment jsdom
import { type FabricObject, StaticCanvas, Textbox } from "fabric/es";
import { describe, expect, it } from "vitest";
import {
  applyObjectTypePresets,
  reassignObjectTypePresetReferences,
} from "./object-type.js";
import { VIGILIA_TEXT_PROPERTY } from "./fabric-text.js";
import { reviveScene, serialiseScene } from "./persist.js";

/**
 * Object-level type on the v2 path.
 *
 * A text object's own typography is the *first* authored run's preset, resolved
 * onto the Fabric object; the runs keep the reference. `letterSpacing` was the
 * one preset field that never reached Fabric, so a tracked wordmark rendered
 * untracked. Fabric's `charSpacing` is 1/1000 em of the object's own font size,
 * so the conversion needs that size — which is why the assertion is on the
 * ratio, not on a pixel count a different font stack would change.
 */

function canvasOf(objects: readonly FabricObject[]): StaticCanvas {
  const canvas = new StaticCanvas(undefined, { width: 400, height: 300 });
  canvas.add(...objects);
  return canvas;
}

/** A tracked preset, in the shape `applyObjectTypePresets` reads it. */
function globalsWith(
  value: Readonly<Record<string, unknown>>,
  id = "tracked",
): Parameters<typeof applyObjectTypePresets>[1] {
  return { typePresets: { [id]: { name: id, value } } };
}

function textbox(
  id: string,
  runs: readonly Readonly<Record<string, unknown>>[],
): Textbox {
  const object = new Textbox("CPU", { id });
  object.set(VIGILIA_TEXT_PROPERTY, { runs });
  return object;
}

const literal = (typePreset: string) => ({
  kind: "literal",
  text: "CPU",
  typePreset,
});

describe("object-level tracking", () => {
  it("converts a preset's letter spacing into Fabric charSpacing", () => {
    const object = textbox("metric", [literal("typePresets.tracked")]);

    applyObjectTypePresets(
      canvasOf([object]),
      globalsWith({ family: "Inter", size: 32, letterSpacing: 0.8 }),
    );

    // 0.8px at 32px is 25/1000 em, which is what Fabric's charSpacing means.
    expect(object.charSpacing).toBeCloseTo(25, 6);
  });

  it("converts against the size it just applied, not a stale one", () => {
    // The editor's preset panel commits size and spacing together, so an object
    // already sitting at another size must not keep the old ratio.
    const object = textbox("metric", [literal("typePresets.tracked")]);
    object.set({ fontSize: 12, charSpacing: 100 });

    applyObjectTypePresets(
      canvasOf([object]),
      globalsWith({ family: "Inter", size: 32, letterSpacing: 0.8 }),
    );

    expect(object.fontSize).toBe(32);
    expect(object.charSpacing).toBeCloseTo(25, 6);
  });

  it("removes tracking when the preset stops carrying it", () => {
    const object = textbox("metric", [literal("typePresets.tracked")]);
    object.set({ charSpacing: 40 });
    object.initDimensions();

    applyObjectTypePresets(
      canvasOf([object]),
      globalsWith({ family: "Inter", size: 32 }),
    );

    // Clearing the panel field has to clear the screen, or the author edits a
    // number that does nothing.
    expect(object.charSpacing).toBe(0);
  });

  it("refuses a size that cannot convert instead of inventing a ratio", () => {
    const object = textbox("metric", [literal("typePresets.tracked")]);
    applyObjectTypePresets(
      canvasOf([object]),
      globalsWith({ family: "Inter", size: 32, letterSpacing: 0.8 }),
    );

    applyObjectTypePresets(
      canvasOf([object]),
      globalsWith({ family: "Inter", size: 0, letterSpacing: 0.8 }),
    );

    // Fabric's ratio divides by the font size; a zero size is not zero
    // tracking, it is an absent conversion, so the last honest value stands.
    expect(object.charSpacing).toBeCloseTo(25, 6);
  });

  it("refuses a letter spacing that is not a finite number", () => {
    const object = textbox("metric", [literal("typePresets.tracked")]);
    applyObjectTypePresets(
      canvasOf([object]),
      globalsWith({ family: "Inter", size: 32, letterSpacing: 0.8 }),
    );

    applyObjectTypePresets(
      canvasOf([object]),
      globalsWith({ family: "Inter", size: 32, letterSpacing: Number.NaN }),
    );

    expect(object.charSpacing).toBeCloseTo(25, 6);
  });
});

describe("font readiness", () => {
  it("applies tracking from the preset's own size, not a loaded face's metrics", () => {
    // The point is that the conversion is arithmetic on the *preset's* size, so
    // nothing about glyph measurement can enter it. Both objects here are
    // measured in the same fallback face (this environment has no Inter), which
    // is the situation a device hits before its packaged font arrives — so the
    // equal ratios are the claim, not an artefact of the two objects being
    // identical.
    //
    // Note the family is *not* set to a missing face here: `applyObjectTypePresets`
    // overwrites `fontFamily` from the preset, so doing that would test nothing.
    const globals = globalsWith({
      family: "Inter",
      size: 32,
      letterSpacing: 0.8,
    });
    const first = textbox("metric", [literal("typePresets.tracked")]);
    const second = textbox("metric", [literal("typePresets.tracked")]);

    applyObjectTypePresets(canvasOf([first]), globals);
    applyObjectTypePresets(canvasOf([second]), globals);

    expect(first.charSpacing).toBeCloseTo(25, 6);
    expect(second.charSpacing).toBe(first.charSpacing);
    // Reapplying after any font work must not move it: the value is a pure
    // function of the preset, so a late-arriving face cannot rescale it.
    applyObjectTypePresets(canvasOf([second]), globals);
    expect(second.charSpacing).toBeCloseTo(25, 6);
  });
});

describe("preset reassignment", () => {
  it("reapplies tracking from the preset that replaced the deleted one", () => {
    const object = textbox("metric", [literal("typePresets.old")]);
    const canvas = canvasOf([object]);
    applyObjectTypePresets(
      canvas,
      globalsWith({ family: "Inter", size: 32, letterSpacing: 4 }, "old"),
    );
    expect(object.charSpacing).toBeCloseTo(125, 6);

    reassignObjectTypePresetReferences(
      canvas,
      "typePresets.old",
      "typePresets.tracked",
    );
    applyObjectTypePresets(
      canvas,
      globalsWith({ family: "Inter", size: 32, letterSpacing: 0.8 }),
    );

    expect(object.charSpacing).toBeCloseTo(25, 6);
  });
});

describe("persistence", () => {
  it("carries tracking through a scene round trip", async () => {
    // The display reads the persisted Fabric object, so a resolved ratio that
    // never reaches the saved scene is a ratio only the editor can see.
    const object = textbox("metric", [literal("typePresets.tracked")]);
    const globals = globalsWith({
      family: "Inter",
      size: 32,
      letterSpacing: 0.8,
    });
    applyObjectTypePresets(canvasOf([object]), globals);

    const scene = serialiseScene(canvasOf([object]));
    const revived = new StaticCanvas(undefined, { width: 400, height: 300 });
    await reviveScene(revived, scene);

    const restored = revived.getObjects()[0] as Textbox;
    expect(restored.charSpacing).toBeCloseTo(25, 6);
  });
});
