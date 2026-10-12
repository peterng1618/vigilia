// @vitest-environment jsdom
import { ActiveSelection, Canvas, Group, Rect } from "fabric/es";
import { describe, expect, it } from "vitest";
import { holderOf, targetsOf } from "./object-holder.js";

const canvasOf = (): Canvas => new Canvas(document.createElement("canvas"));
const square = (): Rect => new Rect({ width: 10, height: 10 });

describe("holderOf", () => {
  it("hands back the canvas for a top-level object — never undefined", () => {
    const canvas = canvasOf();

    // The contract a caller can no longer get wrong: deletion-manager's
    // `ownerOf(object)` returns `undefined` here today, so its caller has to
    // remember `?? canvas`. A forgotten patch silently removes from nothing.
    const top = square();
    canvas.add(top);
    expect(holderOf(canvas, top)).toBe(canvas);

    // And the group, not the canvas, once the object is a child.
    const child = square();
    const group = new Group([child]);
    canvas.add(group);
    expect(holderOf(canvas, child)).toBe(group);
  });
});

describe("targetsOf", () => {
  it("gives an ActiveSelection's members rather than the selection itself", () => {
    const canvas = canvasOf();
    const a = square();
    const b = square();
    canvas.add(a, b);

    expect(targetsOf(a)).toEqual([a]);

    const selection = new ActiveSelection([a, b], { canvas });
    const targets = targetsOf(selection);
    expect(targets).toHaveLength(2);
    expect(targets[0]).toBe(a);
    expect(targets[1]).toBe(b);
  });
});
