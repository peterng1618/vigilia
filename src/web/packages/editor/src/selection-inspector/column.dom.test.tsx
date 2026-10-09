// @vitest-environment jsdom
import { SETTINGS_SECTIONS } from "@vigilia/renderer-core";
import { type FabricObject, Rect } from "fabric/es";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SelectionColumn } from "./column.js";
import { idleCrop } from "./idle-crop.test-stage.js";
import { type ColumnContext, perKindColumn } from "./per-kind-column.js";
import {
  measuredEdgeOf,
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

function ports(): ProjectionPorts {
  return {
    globals: undefined,
    locale: undefined,
    nodeBindings: undefined,
    sampleSource: undefined,
    geometry: { read: readField, measuredEdge: measuredEdgeOf },
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
      measuredEdge: measuredEdgeOf,
    },
    stillTarget: () => true,
    commit: () => {},
    rerender: () => {},
    revealTypePresets: undefined,
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
    root.render(<SelectionColumn view={view} edits={edits} runs={runs} />);
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
  it("renders the five questions in the order SETTINGS_SECTIONS decides", () => {
    const ids = renderedSections(
      viewOf(new Rect({ width: 40, height: 20 })),
    ).map((element) => element.dataset["vigiliaSection"]);

    expect(ids).toEqual(SETTINGS_SECTIONS.map((section) => section.id));
  });

  it("renders no header at all for a section with nothing in it", () => {
    // Every field that writes is withheld from a locked object, so the projection
    // drops Content rather than emitting an empty one; React must render exactly
    // the sections it is given and stand no header over nothing.
    const view = viewOf(
      new Rect({ left: 0, top: 0, width: 40, height: 20, locked: true }),
    );
    const ids = renderedSections(view).map(
      (element) => element.dataset["vigiliaSection"],
    );

    expect(ids).not.toContain("content");
    expect(ids).toContain("spends");
    expect(ids).toEqual(view.sections.map((section) => section.id));
  });

  it("starts Position closed and every other section open", () => {
    renderedSections(viewOf(new Rect({ width: 40, height: 20 })));

    // Geometry is adjusted once and the binding chosen constantly, so the one
    // question that is not asked repeatedly is the one put away.
    expect(isOpen("position")).toBe(false);
    for (const id of ["content", "layer", "paint", "spends"]) {
      expect(isOpen(id), id).toBe(true);
    }
  });

  it("keeps the section the author opened across a re-publish", () => {
    const view = viewOf(new Rect({ width: 40, height: 20 }));
    renderedSections(view);

    act(() => headerOf("position").click());
    act(() => headerOf("paint").click());
    expect(isOpen("position")).toBe(true);
    expect(isOpen("paint")).toBe(false);

    // A re-publish is a new view on the same tree, the way a selection change
    // reaches the column. Rebuilding the sections would collapse Position again
    // and reopen Paint under the author's hands.
    renderedSections({ ...view, targetRevision: 2 });

    expect(isOpen("position")).toBe(true);
    expect(isOpen("paint")).toBe(false);
  });
});
