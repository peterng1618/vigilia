import { VIGILIA_BLEEDS_PROPERTY } from "@vigilia/renderer-core";
import { describe, expect, it } from "vitest";
import {
  type ArtboardSize,
  type SceneBox,
  countable,
  outsideCount,
  outsideEdges,
  sceneBoxesOf,
} from "./artboard-crop.js";

/**
 * A crop the author meant is not a fault.
 *
 * The counting is a fact about the scene and both surfaces read it — the
 * editor's artboard panel through `outsideCount`, the player's notice through
 * `outsideEdges` — so every case here is one both of them inherit. That is why
 * the exclusions are asserted on the shared predicate rather than once per
 * surface: a per-surface test would still pass if the other surface were
 * reading a different name.
 *
 * The case that matters most is the **unmarked** one. A version where marking
 * silences the diagnostic entirely would be worse than the bug it fixes,
 * because the count would stop being a count.
 */

const ARTBOARD: ArtboardSize = { width: 1000, height: 1000 };

function box(over: Partial<SceneBox> = {}): SceneBox {
  return {
    visible: true,
    bleeds: false,
    left: 0,
    top: 0,
    width: 100,
    height: 100,
    depth: 0,
    ...over,
  };
}

/** A group's box at depth 0 followed by its own children at depth 1, the order
 *  `sceneBoxesOf` emits. */
function group(
  over: Partial<SceneBox> = {},
  children: readonly SceneBox[] = [],
): readonly SceneBox[] {
  return [
    box({ depth: 0, ...over }),
    ...children.map((c) => ({ ...c, depth: 1 })),
  ];
}

/** Straddling the right edge: visible on the artboard, running off it. */
const STRADDLING = { left: 950, top: 100, width: 100, height: 100 };

describe("deliberate bleed is excluded from the count", () => {
  it("excludes a marked object from the outside count", () => {
    expect(
      outsideCount([box({ ...STRADDLING, bleeds: true })], ARTBOARD),
    ).toEqual({ outside: 0, counted: 0 });
  });

  it("still warns about an unmarked object in the same place", () => {
    // The half that matters most. Without this, marking would silence the
    // diagnostic entirely and the figure would stop meaning anything.
    expect(outsideCount([box(STRADDLING)], ARTBOARD)).toEqual({
      outside: 1,
      counted: 1,
    });
  });

  it("excludes a marked object from the edges it ran off", () => {
    expect(
      outsideEdges([box({ ...STRADDLING, bleeds: true })], ARTBOARD),
    ).toEqual([]);
  });

  it("names the edges of an unmarked object beside it", () => {
    expect(outsideEdges([box(STRADDLING)], ARTBOARD)).toEqual(["right"]);
  });

  it("does not count a marked object against the total at all", () => {
    // Same as a hidden object: it is the author's own doing, so it is neither a
    // fault to report nor part of the population the proportion is taken over.
    expect(
      outsideCount([box({ left: 10, top: 10, bleeds: true })], ARTBOARD),
    ).toEqual({ outside: 0, counted: 0 });
  });

  it("counts the unmarked ones beside a marked one", () => {
    // The realistic scene: a deliberate quarter-disc and a panel that genuinely
    // fell off. The mark silences one object, not the diagnostic.
    expect(
      outsideCount(
        [
          box({ left: 10, top: 10 }),
          box({ ...STRADDLING, bleeds: true }),
          box({ ...STRADDLING }),
        ],
        ARTBOARD,
      ),
    ).toEqual({ outside: 1, counted: 2 });
  });

  it("does not count a marked object against the total it is a proportion of", () => {
    // Same rule as a hidden object: it is the author's own doing, so it is not
    // a cause to put next to the real one.
    expect(countable(box({ bleeds: true }))).toBe(false);
    expect(countable(box())).toBe(true);
  });

  it("reads a scene authored before the flag as nothing marked", () => {
    // Absence must mean not bleeding on both surfaces, or every existing theme
    // changes its count on open.
    expect(countable(box())).toBe(true);
  });
});

describe("a marked group and its parts", () => {
  it("does not silence a part that runs off on its own inside a marked group", () => {
    // The marked group is skipped before the depth watermark is set, so the
    // walk still descends and each child is judged for itself. A part that
    // genuinely left the artboard is a real fault, and the flag is about the
    // group — not a blanket amnesty for everything inside it.
    expect(
      outsideCount(
        group({ left: 10, top: 10, width: 200, height: 100, bleeds: true }, [
          box({ left: 10, top: 10, width: 200, height: 100 }),
          box({ left: 990, top: 10, width: 100, height: 40 }),
        ]),
        ARTBOARD,
      ),
    ).toEqual({ outside: 1, counted: 2 });
  });

  it("says nothing for a marked group whose parts are all inside", () => {
    expect(
      outsideCount(
        group({ left: 10, top: 10, width: 200, height: 100, bleeds: true }, [
          box({ left: 10, top: 10, width: 200, height: 100 }),
          box({ left: 40, top: 30, width: 60, height: 40 }),
        ]),
        ARTBOARD,
      ),
    ).toEqual({ outside: 0, counted: 2 });
  });

  it("still reports the parts of a marked group that hangs off the edge", () => {
    // **The inverted case, and the one that distinguishes this behaviour from a
    // depth watermark.** A watermark set on a marked group would skip every
    // child below it, so a panel that genuinely sits outside the artboard would
    // never be reported — which is the plan's own failure mode, "a marked object
    // hiding a *real* problem (it must not suppress warnings about its own
    // internal parts)".
    //
    // So the mark is asked of the group, and the group answers only for itself.
    // Both children here are outside, and both are reported: an author who marks
    // a card and still sees a notice has been told something true.
    //
    // The cost is that a marked card straddling the edge reports once per part.
    // Whether that is noise is a question above this file — see the note in
    // `countable` — and is deliberately not settled by what this test asserts.
    expect(
      outsideCount(
        group({ ...STRADDLING, bleeds: true }, [
          box(STRADDLING),
          box({ left: 960, top: 110, width: 80, height: 80 }),
        ]),
        ARTBOARD,
      ),
    ).toEqual({ outside: 2, counted: 2 });
  });
});

describe("sceneBoxesOf reads the mark off the object", () => {
  /** The smallest thing Fabric-shaped: `getBoundingRect` is what the box is
   *  built from, and `get`/`set` is how the authored properties travel. */
  function fabricish(rect: {
    left: number;
    top: number;
    width: number;
    height: number;
  }): {
    visible: boolean;
    get(name: string): unknown;
    set(name: string, value: unknown): void;
    getBoundingRect(): typeof rect;
  } {
    const values = new Map<string, unknown>();
    return {
      visible: true,
      get: (name) => values.get(name),
      set: (name, value) => values.set(name, value),
      getBoundingRect: () => rect,
    };
  }

  it("carries a marked object's mark onto its box", () => {
    // The reader the two surfaces share. If this read a different property
    // name than the one the editor writes, every test above would still pass
    // on a hand-built box while the real editor stayed silent.
    const marked = fabricish(STRADDLING);
    marked.set(VIGILIA_BLEEDS_PROPERTY, true);

    expect(sceneBoxesOf([marked as never])).toEqual([
      { ...STRADDLING, visible: true, bleeds: true, depth: 0 },
    ]);
  });

  it("leaves an unmarked object's box unbleeding", () => {
    expect(sceneBoxesOf([fabricish(STRADDLING) as never])).toEqual([
      { ...STRADDLING, visible: true, bleeds: false, depth: 0 },
    ]);
  });
});
