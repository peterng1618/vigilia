// @vitest-environment jsdom

import {
  VIGILIA_PAINT_PROPERTY,
  VIGILIA_TEXT_PROPERTY,
} from "@vigilia/scene-fabric";
import {
  Circle,
  Ellipse,
  Line,
  Path,
  Polygon,
  Polyline,
  Rect,
  Triangle,
} from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { SHAPE_KINDS } from "./new-object-defaults.js";
import { createNewObjectPanel } from "./new-object-panel.js";
import { uiCopy } from "./ui-copy.js";

/** The construction surface a panel insertion writes through: the canvas and
    the history, exactly as the editor's own managers use them. */
function editorStub() {
  const canvas = {
    add: vi.fn(),
    setActiveObject: vi.fn(),
    requestRenderAll: vi.fn(),
  };
  const historyManager = { saveState: vi.fn() };
  return {
    canvas,
    historyManager,
    textManager: { addText: vi.fn() },
    errorManager: { warn: vi.fn(), error: vi.fn() },
  };
}

/** The chart buttons sit outside the shape group, so "Line" names two
    different things in this panel and only one of them is a chart. */
function chartButton(root: HTMLElement, label: string): HTMLButtonElement {
  return [...root.querySelectorAll("button")].find(
    (button) =>
      button.textContent === label && button.closest("fieldset") === null,
  )!;
}

const palette = {
  palette: {
    none: {
      name: "None",
      value: { kind: "solid" as const, color: "transparent" },
    },
    background: {
      name: "Background",
      value: { kind: "solid" as const, color: "#0c0e13" },
    },
  },
  typePresets: {
    body: { name: "Body", value: { family: "Inter", size: 16 } },
  },
} as const;

describe("new object panel", () => {
  it("inserts a rectangle through the canvas, selected, as one history entry", () => {
    const editor = editorStub();
    const panel = createNewObjectPanel(
      document.body,
      editor as never,
      palette as never,
    );

    panel.root
      .querySelector<HTMLButtonElement>("[data-vigilia-panel-add]")!
      .click();

    const inserted = editor.canvas.add.mock.calls[0]?.[0];
    expect(inserted).toBeInstanceOf(Rect);
    // Insertion is a construction, not a shape factory call: one object, one
    // activation, one history entry.
    expect(editor.canvas.add).toHaveBeenCalledTimes(1);
    expect(editor.canvas.setActiveObject).toHaveBeenCalledWith(inserted);
    expect(editor.historyManager.saveState).toHaveBeenCalledTimes(1);
  });

  it("gives the inserted panel a palette-backed surface fill", () => {
    const editor = editorStub();
    const panel = createNewObjectPanel(
      document.body,
      editor as never,
      palette as never,
    );

    panel.root
      .querySelector<HTMLButtonElement>("[data-vigilia-panel-add]")!
      .click();

    // The saved document is only palette-reassignable if the new panel carries
    // its own reference rather than a literal colour. This palette has no card
    // token, so it takes the surface it does have.
    expect(
      editor.canvas.add.mock.calls[0]?.[0].get(VIGILIA_PAINT_PROPERTY),
    ).toEqual({ fill: "palette.background" });
  });

  it("fills an inserted shape with the card token when the palette has one", () => {
    const editor = editorStub();
    const panel = createNewObjectPanel(
      document.body,
      editor as never,
      {
        ...palette,
        palette: {
          ...palette.palette,
          panel: {
            name: "Panel",
            value: { kind: "solid" as const, color: "#081523d9" },
          },
        },
      } as never,
    );

    panel.root
      .querySelector<HTMLButtonElement>('[data-vigilia-panel-add="ellipse"]')!
      .click();

    // A shape the author draws is a card they will put something on. Filled with
    // the scene's own backdrop it is not a shape at all, and nothing an author
    // cannot see can be selected or edited.
    expect(
      editor.canvas.add.mock.calls[0]?.[0].get(VIGILIA_PAINT_PROPERTY),
    ).toEqual({ fill: "palette.panel" });
  });

  it("labels the panel button for an author and a screen reader", () => {
    const panel = createNewObjectPanel(
      document.body,
      editorStub() as never,
      palette as never,
    );
    const button = panel.root.querySelector<HTMLButtonElement>(
      "[data-vigilia-panel-add]",
    )!;

    expect(button.type).toBe("button");
    expect(button.textContent?.trim().length).toBeGreaterThan(0);
  });

  it("reports a construction the theme cannot supply a reference for", () => {
    const editor = editorStub();
    const panel = createNewObjectPanel(
      document.body,
      editor as never,
      // No palette token at all, so the defaults factory refuses.
      undefined,
    );

    panel.root
      .querySelector<HTMLButtonElement>("[data-vigilia-panel-add]")!
      .click();

    // Reported through the editor's own diagnostics: a throw out of a click
    // handler would leave the author with a button that silently does nothing.
    expect(editor.errorManager.warn).toHaveBeenCalledWith(
      "controls",
      expect.stringContaining("palette token"),
    );
    expect(editor.canvas.add).not.toHaveBeenCalled();
  });

  it.each([
    ["Gauge", "gauge"],
    ["Line", "line"],
    ["Bar", "bar"],
    ["Pie", "pie"],
  ] as const)("delegates %s to ChartManager", (label, family) => {
    const addChart = vi.fn();
    const panel = createNewObjectPanel(
      document.body,
      { textManager: { addText: vi.fn() } } as never,
      undefined,
      { addChart },
    );

    chartButton(panel.root, label).click();

    expect(addChart).toHaveBeenCalledWith(family);
  });

  it("reports a chart construction the theme cannot reference, like every sibling", () => {
    // `ChartManager.addChart` calls `newChart` into `createNewChartDefaults`
    // with no handler of its own, so an unwrapped chart button is the only one
    // in this panel that fails silently.
    const addChart = vi.fn(() => {
      throw new Error("A new chart requires a palette token.");
    });
    const editor = editorStub();
    const panel = createNewObjectPanel(
      document.body,
      editor as never,
      undefined,
      {
        addChart,
      },
    );

    for (const label of ["Gauge", "Line", "Bar", "Pie"]) {
      chartButton(panel.root, label).click();
    }

    // All four, not one: the wrapper is the module's, so a button that opted
    // out would be a silent failure the author cannot see.
    expect(addChart).toHaveBeenCalledTimes(4);
    expect(editor.errorManager.warn).toHaveBeenCalledTimes(4);
    for (const call of editor.errorManager.warn.mock.calls) {
      expect(call[0]).toBe("controls");
      expect(call[1]).toContain("palette token");
    }
  });

  it("offers every primitive Fabric ships as a named shape, not one panel", () => {
    const { root } = createNewObjectPanel(
      document.body,
      editorStub() as never,
      palette as never,
    );

    // One list, read by the panel: a shape the author cannot insert is the same
    // gap as a shape with no properties.
    const group = root.querySelector("fieldset")!;
    expect(group.querySelector("legend")?.textContent).toBe(
      uiCopy.panels.shapes,
    );
    expect(
      [...group.querySelectorAll("button")].map((button) =>
        button.getAttribute("data-vigilia-panel-add"),
      ),
    ).toEqual([...SHAPE_KINDS]);
  });

  it("groups the shapes so the shape Line is not the chart Line", () => {
    const { root } = createNewObjectPanel(
      document.body,
      editorStub() as never,
      palette as never,
    );

    // "Line" is both a chart family and a primitive. A flat chip list would put
    // the same word on two buttons and leave the author to guess which is which.
    expect(
      chartButton(root, uiCopy.chartFamilies.line).closest("fieldset"),
    ).toBeNull();
    expect(
      root.querySelector('[data-vigilia-panel-add="line"]')?.textContent,
    ).toBe(uiCopy.shapeKinds.line);
  });

  it.each([
    ["rect", Rect],
    ["circle", Circle],
    ["ellipse", Ellipse],
    ["triangle", Triangle],
    ["polygon", Polygon],
    ["polyline", Polyline],
    ["line", Line],
    ["path", Path],
  ] as const)("inserts a %s as its own Fabric class", (kind, Class) => {
    const editor = editorStub();
    const { root } = createNewObjectPanel(
      document.body,
      editor as never,
      palette as never,
    );

    root
      .querySelector<HTMLButtonElement>(`[data-vigilia-panel-add="${kind}"]`)!
      .click();

    const inserted = editor.canvas.add.mock.calls[0]?.[0];
    expect(inserted).toBeInstanceOf(Class);
    // One construction, not a factory call per shape: one object, one
    // activation, one history entry.
    expect(editor.canvas.setActiveObject).toHaveBeenCalledWith(inserted);
    expect(editor.historyManager.saveState).toHaveBeenCalledTimes(1);
  });

  it.each([...SHAPE_KINDS])(
    "names the %s button for a screen reader",
    (kind) => {
      const { root } = createNewObjectPanel(
        document.body,
        editorStub() as never,
        palette as never,
      );
      const button = root.querySelector<HTMLButtonElement>(
        `[data-vigilia-panel-add="${kind}"]`,
      )!;

      expect(button.type).toBe("button");
      expect(button.textContent?.trim()).toBe(uiCopy.shapeKinds[kind]);
    },
  );

  it("reports a shape the theme cannot supply a reference for", () => {
    const editor = editorStub();
    const { root } = createNewObjectPanel(
      document.body,
      editor as never,
      undefined,
    );

    for (const kind of SHAPE_KINDS) {
      root
        .querySelector<HTMLButtonElement>(`[data-vigilia-panel-add="${kind}"]`)!
        .click();
    }

    // All eight, not one: the wrapper is the module's, so a shape button that
    // opted out would be a silent failure the author cannot see.
    expect(editor.errorManager.warn).toHaveBeenCalledTimes(SHAPE_KINDS.length);
    for (const call of editor.errorManager.warn.mock.calls) {
      expect(call[0]).toBe("controls");
      expect(call[1]).toContain("palette token");
    }
    expect(editor.canvas.add).not.toHaveBeenCalled();
  });

  it("delegates text construction to the editor with derived v2 defaults", () => {
    const addText = vi.fn();
    const root = createNewObjectPanel(
      document.body,
      { textManager: { addText } } as never,
      {
        palette: {
          none: {
            name: "None",
            value: { kind: "solid", color: "transparent" },
          },
          ink: { name: "Ink", value: { kind: "solid", color: "#102030" } },
        },
        typePresets: {
          body: { name: "Body", value: { family: "Inter", size: 16 } },
        },
      },
    );

    root.root.querySelector("button")!.click();

    expect(addText).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "New text",
        fill: "#102030",
        [VIGILIA_PAINT_PROPERTY]: { fill: "palette.ink" },
        [VIGILIA_TEXT_PROPERTY]: expect.objectContaining({
          runs: [
            expect.objectContaining({
              text: "New text",
              typePreset: "typePresets.body",
              style: { color: { ref: "palette.ink" } },
            }),
          ],
        }),
      }),
    );
  });
});
