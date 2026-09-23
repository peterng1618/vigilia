import { ActiveSelection, InteractiveFabricObject, Textbox } from "fabric/es";
import { describe, expect, it } from "vitest";
import { applyEditorControls } from "./index.js";

describe("applyEditorControls", () => {
  it("snaps rotation to whole degrees", () => {
    applyEditorControls();
    expect(InteractiveFabricObject.ownDefaults.snapAngle).toBe(1);
  });

  it("sizes corner handles square and edge handles as rects", () => {
    applyEditorControls();
    const controls = InteractiveFabricObject.ownDefaults.controls;

    expect(controls?.["tl"]).toMatchObject({ sizeX: 12, sizeY: 12 });
    expect(controls?.["br"]).toMatchObject({ sizeX: 12, sizeY: 12 });
    expect(controls?.["ml"]).toMatchObject({ sizeX: 8, sizeY: 20 });
    expect(controls?.["mt"]).toMatchObject({ sizeX: 20, sizeY: 8 });
  });

  it("gives the rotation handle a grab cursor and an offset", () => {
    applyEditorControls();
    const rotate = InteractiveFabricObject.ownDefaults.controls?.["mtr"];

    expect(rotate?.cursorStyle).toBe("grab");
    expect(rotate).toMatchObject({ sizeX: 32, sizeY: 32, offsetY: -32 });
  });

  it("hides the textbox vertical-resize handles", () => {
    applyEditorControls();
    const controls = Textbox.ownDefaults.controls;

    expect(controls?.["mt"]?.visible).toBe(false);
    expect(controls?.["mb"]?.visible).toBe(false);
    expect(controls?.["ml"]?.visible).not.toBe(false);
  });

  it("leaves Fabric's ActiveSelection internals unpatched", () => {
    const before = ActiveSelection.prototype.onDeselect;
    applyEditorControls();

    // The fork patched private layout internals for its shape-composite types.
    expect(ActiveSelection.prototype.onDeselect).toBe(before);
  });

  it("is idempotent", () => {
    applyEditorControls();
    const first = InteractiveFabricObject.ownDefaults.controls;
    applyEditorControls();

    expect(InteractiveFabricObject.ownDefaults.controls).toBe(first);
  });
});
