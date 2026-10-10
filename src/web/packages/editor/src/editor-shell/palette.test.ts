// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  applyShellPalette,
  clearShellChoice,
  DEFAULT_SHELL_PALETTE,
  readShellChoice,
  resolveShellPalette,
  shellPalettes,
  systemShellPalette,
  writeShellChoice,
} from "./palette.js";

describe("shell palette", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  /** The OS is a fallback, and the two conditions are separate cases: a
   *  resolver that lets the OS win passes a light-only check and fails here. */
  it("follows the OS while the author has not chosen", () => {
    expect(resolveShellPalette(undefined, true)).toBe("graphite");
    expect(resolveShellPalette(undefined, false)).toBe("editorial");
  });

  it("lets the author's choice outlast the OS", () => {
    for (const choice of shellPalettes) {
      expect(resolveShellPalette(choice, true)).toBe(choice);
      expect(resolveShellPalette(choice, false)).toBe(choice);
    }
  });

  /** `undefined` and the default are different states — only the first of them
   *  leaves the OS with a vote — so the reader must not collapse them. */
  it("has no choice stored until the picker is used", () => {
    expect(readShellChoice(localStorage)).toBeUndefined();
    writeShellChoice(localStorage, "moss");
    expect(readShellChoice(localStorage)).toBe("moss");
  });

  /** "Follow the system" is a state, and it is reached by removing the key:
   *  a writer that stored the OS's current palette instead would pin it, so the
   *  shell would stop following the moment the OS changed. */
  it("returns to following the OS when the choice is cleared", () => {
    writeShellChoice(localStorage, "ember");
    expect(readShellChoice(localStorage)).toBe("ember");

    clearShellChoice(localStorage);

    expect(readShellChoice(localStorage)).toBeUndefined();
    expect(resolveShellPalette(undefined, true)).toBe("graphite");
  });

  it("ignores a stored value that is not a palette", () => {
    localStorage.setItem("vigilia.editor.shell-palette", "invalid");
    expect(readShellChoice(localStorage)).toBeUndefined();
  });

  it("maps the OS onto the palettes that already exist", () => {
    expect(systemShellPalette(true)).toBe("graphite");
    expect(systemShellPalette(false)).toBe(DEFAULT_SHELL_PALETTE);
    for (const palette of [
      systemShellPalette(true),
      systemShellPalette(false),
    ]) {
      expect(shellPalettes).toContain(palette);
    }
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
    writeShellChoice(localStorage, "moss");
    applyShellPalette("moss");

    expect(localStorage.getItem("vigilia.editor.shell-palette")).toBe("moss");
    // The document element rather than the editor's own root, because Base UI
    // portals every popup to `body` — a sibling of that root, not a descendant —
    // and a palette attribute below it is invisible to all of them.
    expect(document.documentElement.dataset["shellPalette"]).toBe("moss");
    expect(document.documentElement).not.toHaveProperty("envelope");
  });
});
