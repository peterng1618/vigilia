// @vitest-environment jsdom

import {
  VIGILIA_PAINT_PROPERTY,
  VIGILIA_TEXT_PROPERTY,
} from "@vigilia/scene-fabric";
import { Rect } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { createNewObjectPanel } from "./new-object-panel.js";

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
  };
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
    // its own reference rather than a literal colour.
    expect(
      editor.canvas.add.mock.calls[0]?.[0].get(VIGILIA_PAINT_PROPERTY),
    ).toEqual({ fill: "palette.background" });
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

    [...panel.root.querySelectorAll("button")]
      .find((button) => button.textContent === label)!
      .click();

    expect(addChart).toHaveBeenCalledWith(family);
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
