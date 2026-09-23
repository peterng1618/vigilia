// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  applyShellPalette,
  DEFAULT_SHELL_PALETTE,
  readShellPalette,
  shellPalettes,
  writeShellPalette,
} from "./palette.js";

describe("shell palette", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to the editorial palette when nothing is stored", () => {
    expect(DEFAULT_SHELL_PALETTE).toBe("editorial");
    expect(readShellPalette(localStorage)).toBe("editorial");
  });

  it("restores a supported stored palette", () => {
    localStorage.setItem("vigilia.editor.shell-palette", "ember");

    expect(readShellPalette(localStorage)).toBe("ember");
  });

  it("ignores an invalid stored palette", () => {
    localStorage.setItem("vigilia.editor.shell-palette", "invalid");

    expect(readShellPalette(localStorage)).toBe("editorial");
  });

  it("offers editorial first without dropping the base palettes", () => {
    expect(shellPalettes[0]).toBe("editorial");
    for (const base of [
      "graphite",
      "ember",
      "moss",
      "plum",
      "light",
    ] as const) {
      expect(shellPalettes).toContain(base);
    }
  });

  it("writes only the shell palette and marks its shell root", () => {
    const root = document.createElement("main");

    writeShellPalette(localStorage, "moss");
    applyShellPalette(root, "moss");

    expect(localStorage.getItem("vigilia.editor.shell-palette")).toBe("moss");
    expect(root.dataset["shellPalette"]).toBe("moss");
    expect(root).not.toHaveProperty("envelope");
  });
});
