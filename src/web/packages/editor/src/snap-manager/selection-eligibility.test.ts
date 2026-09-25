// @vitest-environment jsdom
import { ActiveSelection, Group, Rect, Textbox } from "fabric/es";
import { describe, expect, it } from "vitest";
import { isSupportedActiveSelection } from "./selection-eligibility.js";

describe("active selection eligibility", () => {
  it("accepts two plain objects", () => {
    const selection = new ActiveSelection([
      new Rect({ width: 10, height: 10 }),
      new Rect({ width: 10, height: 10 }),
    ]);
    expect(isSupportedActiveSelection({ selection })).toBe(true);
  });

  it("refuses a single-object selection", () => {
    const selection = new ActiveSelection([
      new Rect({ width: 10, height: 10 }),
    ]);
    expect(isSupportedActiveSelection({ selection })).toBe(false);
  });

  it("refuses a selection containing a parented object", () => {
    const group = new Group([new Rect({ width: 10, height: 10 })]);
    const selection = new ActiveSelection([
      group.getObjects()[0]!,
      new Rect({ width: 10, height: 10 }),
    ]);
    expect(isSupportedActiveSelection({ selection })).toBe(false);
  });

  it("refuses a scaled selection containing text", () => {
    // The fork's comment: otherwise the text finalization path could
    // reinterpret movement as unfinished scaling.
    const selection = new ActiveSelection([
      new Textbox("hi", { width: 40, height: 20 }),
      new Rect({ width: 10, height: 10 }),
    ]);
    selection.set({ scaleX: 1.5, scaleY: 1.5 });
    expect(isSupportedActiveSelection({ selection })).toBe(false);
  });

  it("accepts a unit-scale selection containing text", () => {
    const selection = new ActiveSelection([
      new Textbox("hi", { width: 40, height: 20 }),
      new Rect({ width: 10, height: 10 }),
    ]);
    expect(isSupportedActiveSelection({ selection })).toBe(true);
  });
});
