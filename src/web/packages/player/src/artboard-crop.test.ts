import { describe, expect, it } from "vitest";
import {
  type ArtboardSize,
  cropNoticeText,
  type SceneBox,
} from "./artboard-crop.js";

/** The failing case from the proof pass: a 1672 × 941 landscape composition
 *  re-shaped to 1080 × 2340 portrait, with the Storage and Network panels
 *  authored at x = 1138. */
const PORTRAIT: ArtboardSize = { width: 1080, height: 2340 };

function box(over: Partial<SceneBox> = {}): SceneBox {
  return {
    visible: true,
    left: 0,
    top: 0,
    width: 100,
    height: 100,
    ...over,
  };
}

describe("the artboard crop notice", () => {
  it("says nothing when the artboard contains everything", () => {
    expect(
      cropNoticeText(
        [
          box({ left: 0, top: 0, width: 1080, height: 100 }),
          box({ left: 1000, top: 2300, width: 80, height: 40 }),
        ],
        PORTRAIT,
      ),
    ).toBeUndefined();
  });

  it("names the proportion a narrower artboard strands, and which way", () => {
    const text = cropNoticeText(
      [
        box({ left: 40, top: 40 }),
        box({ left: 1138, top: 100 }),
        box({ left: 1138, top: 300 }),
      ],
      PORTRAIT,
    );

    expect(text).toBe(
      "2 of 3 objects are outside this artboard and are not shown — past the right edge",
    );
  });

  it("counts an object hanging off the edge as not shown", () => {
    // Cropped, not gone — but the reader is not seeing the whole panel, and a
    // half-drawn card is the harder case to diagnose, not the easier one.
    expect(
      cropNoticeText([box({ left: 1030, width: 100 })], PORTRAIT),
    ).toContain("1 of 1 objects");
  });

  it("names every side the composition ran off", () => {
    expect(
      cropNoticeText(
        [
          box({ left: 1000, width: 200 }),
          box({ top: 2300, height: 200 }),
          box({ left: -100, width: 50 }),
          box({ top: -50, height: 50 }),
        ],
        PORTRAIT,
      ),
    ).toBe(
      "4 of 4 objects are outside this artboard and are not shown — past the right edge and past the bottom edge and past the left edge and past the top edge",
    );
  });

  it("does not report an object the author hid as cropped", () => {
    expect(
      cropNoticeText([box({ left: 5000, visible: false })], PORTRAIT),
    ).toBeUndefined();
  });

  it("does not report an object with no area", () => {
    expect(
      cropNoticeText([box({ left: 5000, width: 0, height: 0 })], PORTRAIT),
    ).toBeUndefined();
  });

  /**
   * The measure is the **box**, never the anchor `left`/`top` a caller might
   * read off the object instead.
   *
   * A theme that omits `originX`/`originY` revives with Fabric's default
   * `center`, so `left: 40` on a 200-wide box is its *centre* and the box runs
   * from −60.5 to 140.5 — 60.5 units past the left edge, with the anchor
   * looking comfortably inside. This is the measured shape of a real display
   * that showed "1 of 1 objects … past the left edge" over visibly cropped
   * text, and it is the case a reader cannot argue with: the notice was right
   * and the earlier reading of `left: 40` was not.
   */
  it("measures the box, so a centred anchor inside the artboard is still cropped", () => {
    // A 1920×1080 artboard; a 200-wide box centred on x=40.
    expect(
      cropNoticeText([box({ left: -60.5, top: 27, width: 201, height: 26 })], {
        width: 1920,
        height: 1080,
      }),
    ).toBe(
      "1 of 1 objects are outside this artboard and are not shown — past the left edge",
    );
  });

  it("names only the side a box actually crosses", () => {
    // Centred on the right edge: past the right, and nowhere else. A notice that
    // also named the left would send an author to fix the wrong side.
    expect(
      cropNoticeText([box({ left: 1900, top: 500, width: 100, height: 40 })], {
        width: 1920,
        height: 1080,
      }),
    ).toBe(
      "1 of 1 objects are outside this artboard and are not shown — past the right edge",
    );
  });

  it("does not count a hidden object against the total it is a proportion of", () => {
    expect(
      cropNoticeText(
        [
          box({ left: 40 }),
          box({ left: 5000, visible: false }),
          box({ left: 1138 }),
        ],
        PORTRAIT,
      ),
    ).toContain("1 of 2 objects");
  });

  it("forgives a panel placed flush against the edge", () => {
    expect(
      cropNoticeText([box({ left: 980, width: 100, height: 40 })], PORTRAIT),
    ).toBeUndefined();
  });

  it("says nothing for an empty scene", () => {
    expect(cropNoticeText([], PORTRAIT)).toBeUndefined();
  });
});
