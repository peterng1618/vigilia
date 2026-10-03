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

  it("writes only the shell palette and marks the document element", () => {
    writeShellPalette(localStorage, "moss");
    applyShellPalette("moss");

    expect(localStorage.getItem("vigilia.editor.shell-palette")).toBe("moss");
    // The document element rather than the editor's own root, because Base UI
    // portals every popup to `body` — a sibling of that root, not a descendant —
    // and a palette attribute below it is invisible to all of them.
    expect(document.documentElement.dataset["shellPalette"]).toBe("moss");
    expect(document.documentElement).not.toHaveProperty("envelope");
  });
});
