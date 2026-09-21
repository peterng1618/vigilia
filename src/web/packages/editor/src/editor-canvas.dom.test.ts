// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { mountEditorCanvas } from "./editor-canvas.js";

describe("mountEditorCanvas", () => {
  it("rejects an invalid envelope before mounting a canvas", async () => {
    const host = document.createElement("div");
    const envelope = {
      schemaVersion: 2,
      fabricVersion: "invalid",
      id: "theme",
      artboard: { width: 100, height: 100 },
      scene: { version: "7.4.0", objects: [] },
    };

    await expect(
      mountEditorCanvas({ host, artboard: envelope.artboard, envelope: envelope as never }),
    ).rejects.toThrow("Invalid Fabric theme");
    expect(host.querySelector("canvas")).toBeNull();
  });
});
