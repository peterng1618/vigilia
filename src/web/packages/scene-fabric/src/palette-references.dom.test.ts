// @vitest-environment jsdom

import { defaultGaugeSettings } from "@vigilia/renderer-core";
import { Group, Rect, type FabricObject, Textbox } from "fabric/es";
import { describe, expect, it } from "vitest";
import { VigiliaChart, type VigiliaChartOptions } from "./chart-object.js";
import { VIGILIA_TEXT_PROPERTY } from "./fabric-text.js";
import { VIGILIA_PAINT_PROPERTY } from "./object-paint.js";
import {
  objectPaletteReferences,
  reassignObjectPaletteReferences,
} from "./palette-references.js";

/**
 * Where a palette token is referenced, and how many objects that is.
 *
 * `reassignObjectPaletteReferences` already walked the whole scene and
 * returned a count nobody read. These assert the same walk answers "which
 * objects", because a panel saying "3 uses" and a delete guard deciding "safe"
 * from two different walks is how a token gets removed from under a live
 * object.
 *
 * jsdom is here for the chart case only: `new VigiliaChart` builds a canvas
 * element, so a node-environment file cannot construct one.
 */

const REF = "palette.accent" as const;

function painted(id: string, ref: string = REF): Rect {
  const shape = new Rect({ id, width: 10, height: 10 });
  shape.set(VIGILIA_PAINT_PROPERTY, { fill: ref });
  return shape;
}

function typed(id: string, ref: string = REF): Textbox {
  const text = new Textbox("label", { id, width: 40, height: 20 });
  text.set(VIGILIA_TEXT_PROPERTY, {
    runs: [{ text: "label", style: { color: { ref } } }],
  });
  return text;
}

function gauged(id: string, ref: string = REF): VigiliaChart {
  return new VigiliaChart({
    id,
    family: "gauge",
    settings: { ...defaultGaugeSettings, progress: { ref } },
    width: 10,
    height: 10,
  } as VigiliaChartOptions);
}

/** The ids the same walk reports, sorted so order is never the assertion. */
function referencedBy(objects: readonly FabricObject[]): readonly string[] {
  return objectPaletteReferences(objects, REF)
    .map((use) => use.objectId)
    .sort();
}

describe("where a palette token is referenced", () => {
  it("reports one object per object, however many references it holds", () => {
    const panel = new Rect({ id: "panel", width: 10, height: 10 });
    panel.set(VIGILIA_PAINT_PROPERTY, {
      fill: REF,
      stroke: REF,
      shadowColor: REF,
    });

    // A panel's fill, border and shadow are three references and one object.
    // The count an author reads is the object, so three must not print as 3.
    expect(objectPaletteReferences([panel], REF)).toHaveLength(1);
  });

  it("reports nothing for a token no object carries", () => {
    expect(referencedBy([painted("a", "palette.other")])).toEqual([]);
    expect(objectPaletteReferences([painted("a")], "palette.unused")).toEqual(
      [],
    );
  });

  it("finds an object inside a group, where a root-only walk finds nothing", () => {
    // The shape the author grouped. `canvas.getObjects()` returns the group,
    // so a walk that stops at the root reports this token as dead and the
    // author deletes it out from under a live object — the same defect the
    // asset "in use" check had.
    const grouped = new Group([painted("inner")]);

    expect(referencedBy([grouped])).toEqual(["inner"]);
  });

  it("finds a group nested two deep", () => {
    const inner = new Group([painted("deep")]);
    const outer = new Group([inner]);

    expect(referencedBy([outer])).toEqual(["deep"]);
  });

  it("names the run a text reference sits in", () => {
    const text = new Textbox("a b", { id: "text", width: 40, height: 20 });
    text.set(VIGILIA_TEXT_PROPERTY, {
      runs: [
        { text: "a", style: { color: { ref: "palette.other" } } },
        { text: " b", style: { color: { ref: REF } } },
      ],
    });

    expect(objectPaletteReferences([text], REF)).toEqual([
      { objectId: "text", name: "text", runs: [1] },
    ]);
  });

  it("finds a chart, whose tokens live in settings rather than paint", () => {
    // A gauge is a canvas object like any other, but it names its tokens in
    // `settings.track`/`progress` and carries no `vigiliaPaint` at all. A walk
    // that only reads paint and runs calls this token dead while a chart is
    // visibly painted with it — the exact false negative this panel exists to
    // prevent.
    expect(referencedBy([gauged("gauge")])).toEqual(["gauge"]);
  });

  it("finds a chart inside a group", () => {
    expect(referencedBy([new Group([gauged("gauge")])])).toEqual(["gauge"]);
  });

  it("reads the name the author gave an object, and falls back to its id", () => {
    const named = painted("panel-1");
    named.set("name", "Card title");

    expect(objectPaletteReferences([named], REF)).toEqual([
      { objectId: "panel-1", name: "Card title", runs: [] },
    ]);
  });

  it("does not count a run that merely has a colour", () => {
    const text = new Textbox("a", { id: "text", width: 40, height: 20 });
    text.set(VIGILIA_TEXT_PROPERTY, {
      runs: [{ text: "a", style: { color: { kind: "solid" } } }],
    });

    expect(objectPaletteReferences([text], REF)).toEqual([]);
  });
});

describe("the delete path and the panel read the same walk", () => {
  it("leaves nothing referencing a token it moved, at any depth or kind", () => {
    const objects = [
      painted("panel"),
      new Group([painted("inner"), gauged("gauge")]),
      typed("text"),
    ];

    expect(referencedBy(objects)).toEqual(["gauge", "inner", "panel", "text"]);

    // The chart's own settings are chart-manager's to rewrite, because it has
    // to re-apply the engine option; the object walk owns the rest. Between
    // them the whole reference set goes, which is what makes the count above a
    // statement about what the delete will actually touch.
    const changed = reassignObjectPaletteReferences(
      { getObjects: () => objects } as never,
      REF,
      "palette.replacement" as const,
    );

    expect(changed).toBe(3); // two paint refs, one of them grouped, and one run
    expect(referencedBy(objects)).toEqual(["gauge"]);
  });
});
