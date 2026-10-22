// @vitest-environment jsdom
import { YUNARI_TEXT_PROPERTY } from "@yunari/scene-fabric";
import { Canvas, IText } from "fabric/es";
import { describe, expect, it } from "vitest";
import { reassignTypePresetToken } from "./index.js";

describe("reassignTypePresetToken", () => {
  it("rewrites canvas type-preset refs and drops the preset entry", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const text = new IText("Hi");
    text.set(YUNARI_TEXT_PROPERTY, {
      runs: [{ kind: "literal", text: "Hi", typePreset: "typePresets.old" }],
    });
    canvas.add(text);
    const typePresets = {
      old: { name: "Old", value: { family: "Inter", size: 16 } },
      new: { name: "New", value: { family: "Inter", size: 20 } },
    };

    const next = reassignTypePresetToken(canvas, typePresets, "old", "new");

    expect(text.get(YUNARI_TEXT_PROPERTY)).toMatchObject({
      runs: [{ typePreset: "typePresets.new" }],
    });
    expect(next).toEqual({ new: typePresets.new });
  });
});
