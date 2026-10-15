// @vitest-environment jsdom
import { SETTINGS_SECTIONS } from "@vigilia/renderer-core";
import { type FabricObject, IText, Rect } from "fabric/es";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ChartEdits } from "../chart-manager/chart-fields.js";
import { SelectionColumn } from "./column.js";
import { idleCrop, idleCropEdits } from "./idle-crop.test-stage.js";
import { type ColumnContext, perKindColumn } from "./per-kind-column.js";
import {
  type ProjectionPorts,
  projectSelection,
  type RunEdits,
  readField,
  type SelectionEdits,
  type SelectionView,
} from "./view.js";

/**
 * The section chrome the column owns now that it is React: the order the
 * questions are asked in, the header a section with nothing in it does not get,
 * which sections start closed, and the open state surviving a re-publish.
 *
 * The order assertion is written against `SETTINGS_SECTIONS` rather than a
 * literal list on purpose: Review Focus 2's failure is a React tree that renders
 * Layer above Content while the data plan's own order test still passes, so this
 * is the instrument that has to read the owner's order, not a copy of it.
 */

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const edits: SelectionEdits = { commit: () => false };

/** A run-editor port that records nothing: this file reads the chrome, not writes. */
const runs: RunEdits = {
  setRunText: () => false,
  setRunPreset: () => false,
  setRunColour: () => false,
  setUnitDisplay: () => false,
  setSource: () => false,
  setFormat: () => false,
  setZone: () => false,
  writeLayout: () => false,
  addRun: () => false,
  removeRun: () => false,
};

/** A chart port that records nothing, for the same reason. */
const chart: ChartEdits = {
  onSettings: () => {},
  onBinding: () => {},
  onAspect: () => {},
  onAddBinding: () => {},
  onRemoveBinding: () => {},
};

/** A crop port that records nothing: this file reads the chrome, not writes. */
const crop = idleCropEdits();

function ports(): ProjectionPorts {
  return {
    globals: undefined,
    locale: undefined,
    nodeBindings: undefined,
    sampleSource: undefined,
    geometry: { read: readField },
  };
}

/** Enough of an editor for the per-kind builders: they read the canvas and warn
    through the error manager, and this file is about none of those. */
function context(): ColumnContext {
  return {
    editor: {
      canvas: {
        getActiveObject: () => undefined,
        getObjects: () => [],
        requestRenderAll: () => {},
      },
      historyManager: { saveState: () => {} },
      errorManager: { warn: () => {}, error: () => {} },
      cropManager: idleCrop(),
    } as never,
    globals: undefined,
    locale: undefined,
    geometry: {
      read: readField,
      write: () => {},
    },
    stillTarget: () => true,
    commit: () => {},
    rerender: () => {},
    refreshGlass: () => {},
    nodeBindings: undefined,
    onNodeBindingsChange: undefined,
    sampleSource: undefined,
  };
}

/** The view the column would be handed for an object, projected for real: the
    order under test is the one `perKindColumn` decides, so a hard-coded order
    there has to reach this. */
function viewOf(object: FabricObject): SelectionView {
  return projectSelection(object, 1, ports(), perKindColumn(object, context()));
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
});

/** Renders a view and returns the section elements in document order. */
function renderedSections(view: SelectionView): HTMLElement[] {
  act(() => {
    root.render(
      <SelectionColumn
        view={view}
        edits={edits}
        runs={runs}
        chart={chart}
        crop={crop}
      />,
    );
  });
  return [...host.querySelectorAll<HTMLElement>("[data-vigilia-section]")];
}

const headerOf = (id: string): HTMLButtonElement =>
  host.querySelector<HTMLButtonElement>(
    `[data-vigilia-section="${id}"] > h2 > button`,
  )!;

const isOpen = (id: string): boolean =>
  headerOf(id).getAttribute("aria-expanded") === "true";

describe("SelectionColumn", () => {
  it("renders the questions in the order SETTINGS_SECTIONS decides", () => {
    const ids = renderedSections(
      viewOf(new Rect({ width: 40, height: 20 })),
    ).map((element) => element.dataset["vigiliaSection"]);

    expect(ids).toEqual(SETTINGS_SECTIONS.map((section) => section.id));
  });

  it("renders no header at all for a section with nothing in it", () => {
    // A text object has no Paint row of its own: `vg-465` moved the glass
    // refusal into the lead block above the sections, and this rule takes the
    // whole section away rather than standing a header over one sentence. A
    // locked object drops every section at once, which is the case asserted
    // beside this one (`index.dom.test.ts`).
    const text = new IText("", { left: 0, top: 0 });
    text.set({
      vigiliaText: {
        runs: [{ kind: "literal", text: "Hi", typePreset: "typePresets.body" }],
      },
    });
    const view = viewOf(text);
    const ids = renderedSections(view).map(
      (element) => element.dataset["vigiliaSection"],
    );

    expect(ids).not.toContain("paint");
    expect(ids).toContain("content");
    expect(ids).toEqual(view.sections.map((section) => section.id));
  });

  it("starts every section open, Position included", () => {
    renderedSections(viewOf(new Rect({ width: 40, height: 20 })));

    // Position was the one section put away, on the reasoning that geometry is
    // set once. It is what an object is usually selected *for*, so it is open —
    // and so is every other question: the column stops deciding that for the
    // author (item 13, DESIGN.md §7.4).
    for (const id of ["content", "position", "layer", "paint"]) {
      expect(isOpen(id), id).toBe(true);
    }
  });

  /** `vg-466`: the subject block's `border-b` is the boundary between the
   *  header and the first section, so a `border-t` here drew one hairline twice.
   *  Every later section keeps its own top rule — that boundary is between two
   *  sections, and nothing above draws it. */
  it("draws the hairline into the first section once, not twice", () => {
    const sections = renderedSections(
      viewOf(new Rect({ width: 40, height: 20 })),
    );

    expect(
      sections[0]?.className,
      "the section's own shape was lost",
    ).toContain("py-[var(--space-12)]");
    expect(
      sections[0]?.className,
      "the first section draws a second rule under the subject block's own",
    ).not.toContain("border-t");
    for (const element of sections.slice(1)) {
      expect(
        element.className,
        `${element.dataset["vigiliaSection"]} lost its top rule, so two sections ` +
          "now run together",
      ).toContain("border-t");
    }
  });

  it("keeps the disclosure the author chose across a re-publish", () => {
    const view = viewOf(new Rect({ width: 40, height: 20 }));
    renderedSections(view);

    act(() => headerOf("position").click());
    expect(isOpen("position")).toBe(false);
    expect(isOpen("paint")).toBe(true);

    // A re-publish is a new view on the same tree, the way a selection change
    // reaches the column. Rebuilding the sections would return Position to its
    // default and collapse Paint under the author's hands.
    renderedSections({ ...view, targetRevision: 2 });

    expect(isOpen("position")).toBe(false);
    expect(isOpen("paint")).toBe(true);
  });
});
