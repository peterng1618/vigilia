import { Shadow } from "fabric/es";
import { describe, expect, it } from "vitest";
import { paintFor, unsupportedPaint } from "./paint.js";

/**
 * Resolved style → Fabric properties.
 *
 * Two of these assertions exist because Fabric's defaults are not the DOM's,
 * and both would be visible on every screen: an unfilled box painted black,
 * and every box a stroke-width too big.
 */

describe("a box", () => {
  it("is transparent when the author gave it no fill", () => {
    // Fabric's default `fill` is opaque black, so an absent fill has to be
    // *written*. CSS left the background alone and got transparency for free;
    // here the same document would render a black slab.
    expect(paintFor({}, "box")).toMatchObject({ fill: "" });
  });

  it("has no stroke width when it has no stroke", () => {
    // Fabric folds `strokeWidth` into `_getTransformedDimensions` whether or
    // not a stroke is painted, so the default of 1 inflates the bounding box
    // and every geometry that depends on it. Same reason `VigiliaChart` pins it.
    expect(paintFor({}, "box")).toMatchObject({ stroke: null, strokeWidth: 0 });
    expect(paintFor({ strokeWidth: 4 }, "box")).toMatchObject({
      stroke: null,
      strokeWidth: 0,
    });
    expect(paintFor({ strokeColor: "#f00" }, "box")).toMatchObject({
      strokeWidth: 0,
    });
  });

  it("paints a stroke only when it has both a colour and a width", () => {
    expect(
      paintFor({ strokeColor: "#f00", strokeWidth: 2 }, "box"),
    ).toMatchObject({
      stroke: "#f00",
      strokeWidth: 2,
    });
  });

  it("turns an authored dash into a pattern scaled by the stroke", () => {
    const dashed = paintFor(
      { strokeColor: "#f00", strokeWidth: 2, strokeDash: "dashed" },
      "box",
    );
    const dotted = paintFor(
      { strokeColor: "#f00", strokeWidth: 2, strokeDash: "dotted" },
      "box",
    );

    expect(dashed["strokeDashArray"]).toEqual([6, 4]);
    expect(dotted["strokeDashArray"]).toEqual([2, 4]);
    // Cleared rather than absent: an update may be removing a dash an earlier
    // frame set.
    expect(
      paintFor({ strokeColor: "#f00", strokeWidth: 2 }, "box")[
        "strokeDashArray"
      ],
    ).toBeNull();
  });

  it("builds a real Shadow, and clears it when there is none", () => {
    const shadow = paintFor(
      {
        shadowColor: "#000",
        shadowBlur: 8,
        shadowOffsetX: 2,
        shadowOffsetY: 3,
      },
      "box",
    )["shadow"];

    expect(shadow).toBeInstanceOf(Shadow);
    expect(shadow).toMatchObject({
      color: "#000",
      blur: 8,
      offsetX: 2,
      offsetY: 3,
    });
    expect(paintFor({}, "box")["shadow"]).toBeNull();
  });

  it("refuses a negative blur rather than passing it on", () => {
    expect(
      paintFor({ shadowColor: "#000", shadowBlur: -4 }, "box")["shadow"],
    ).toMatchObject({
      blur: 0,
    });
  });
});

describe("text", () => {
  it("takes its colour from `color` first, then `fill`", () => {
    expect(paintFor({ fill: "#111" }, "text")).toMatchObject({ fill: "#111" });
    expect(paintFor({ fill: "#111", color: "#222" }, "text")).toMatchObject({
      fill: "#222",
    });
  });

  it("paints an outline behind the glyph, as CSS did", () => {
    // `-webkit-text-stroke` plus `paint-order: stroke fill`. Without
    // `paintFirst` the stroke eats into the letterform instead of outlining it.
    expect(
      paintFor({ strokeColor: "#000", strokeWidth: 1 }, "text"),
    ).toMatchObject({
      stroke: "#000",
      paintFirst: "stroke",
    });
    expect(paintFor({}, "text")).not.toHaveProperty("paintFirst");
  });

  it("converts letter spacing from pixels into Fabric’s 1/1000 em", () => {
    expect(paintFor({ letterSpacing: 2, fontSize: 40 }, "text")).toMatchObject({
      charSpacing: 50,
    });
  });

  it("drops letter spacing rather than guessing without a font size", () => {
    // Refuse rather than coerce: there is no correct conversion without the
    // size, and a guessed one is wrong at every other type scale.
    expect(paintFor({ letterSpacing: 2 }, "text")).not.toHaveProperty(
      "charSpacing",
    );
    expect(unsupportedPaint({ letterSpacing: 2 }, "text")).toContain(
      "letterSpacing",
    );
  });

  it("omits a font property the document did not set", () => {
    // `exactOptionalPropertyTypes` aside, writing `fontFamily: undefined` onto
    // a Fabric object replaces its default with nothing.
    const paint = paintFor({}, "text");

    expect(paint).not.toHaveProperty("fontFamily");
    expect(paint).not.toHaveProperty("fontSize");
    expect(paint).not.toHaveProperty("fontWeight");
    expect(paint).not.toHaveProperty("lineHeight");
  });
});

describe("what canvas cannot do", () => {
  it("reports tabular numerals, which have no canvas equivalent", () => {
    // `font-variant-numeric` is not expressible through a 2D context's font
    // string. §85: mark the gap rather than approximate it.
    expect(unsupportedPaint({ tabularNumerals: true }, "text")).toContain(
      "tabularNumerals",
    );
    expect(unsupportedPaint({ tabularNumerals: false }, "text")).toEqual([]);
  });

  it("reports a dashed text stroke, which CSS could not do either", () => {
    expect(unsupportedPaint({ strokeDash: "dashed" }, "text")).toContain(
      "strokeDash",
    );
    expect(unsupportedPaint({ strokeDash: "dashed" }, "box")).toEqual([]);
  });
});
