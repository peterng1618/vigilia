// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  VIGILIA_PAINT_PROPERTY,
  VIGILIA_TEXT_PROPERTY,
} from "@vigilia/scene-fabric";
import { createNewObjectPanel } from "./new-object-panel.js";

describe("new object panel", () => {
  it("delegates text construction to the fork with derived v2 defaults", () => {
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
