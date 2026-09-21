// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { mountForkShell } from "./fork-shell.js";

describe("native editor shell", () => {
  it("mounts direct Fabric text mechanics", async () => {
    const host = document.createElement("div");
    Object.defineProperties(host, {
      clientWidth: { value: 400 },
      clientHeight: { value: 300 },
    });

    const shell = await mountForkShell({
      host,
      artboard: { width: 100, height: 100 },
    });
    const text = shell.editor.textManager.addText({ text: "Native" });

    expect(host.querySelector("canvas")).not.toBeNull();
    expect(shell.editor.canvas.getActiveObject()).toBe(text);
    shell.destroy();
  });
});
