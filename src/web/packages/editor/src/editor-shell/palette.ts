/** Shell chrome palettes. Browser-local only: never serialized into a theme
 * envelope, never authored document state. */
export const shellPalettes = [
  "editorial",
  "graphite",
  "ember",
  "moss",
  "plum",
  "light",
] as const;

export type ShellPalette = (typeof shellPalettes)[number];

/** The editorial dashboard look is the shell's default. */
export const DEFAULT_SHELL_PALETTE: ShellPalette = "editorial";

const storageKey = "vigilia.editor.shell-palette";

function isShellPalette(value: string | null): value is ShellPalette {
  return value !== null && shellPalettes.includes(value as ShellPalette);
}

export function readShellPalette(storage: Storage): ShellPalette {
  const stored = storage.getItem(storageKey);
  return isShellPalette(stored) ? stored : DEFAULT_SHELL_PALETTE;
}

export function writeShellPalette(
  storage: Storage,
  palette: ShellPalette,
): void {
  storage.setItem(storageKey, palette);
}

/** The palette is written to `document.documentElement` and nowhere else.
 *
 * Base UI portals every popup, popover, tooltip and dialog to `document.body`,
 * which is a sibling of the editor's `#app` rather than a descendant, so an
 * attribute on `#app` is invisible to all of them and they repaint with the
 * bare `:root` defaults no matter which palette is in force. The document
 * element is the one node every one of those surfaces descends from, and it is
 * also what `:root` selects, so one attribute reaches the chrome and its
 * portalled surfaces together.
 *
 * There is deliberately no element parameter: every caller passed a subtree,
 * which is the mistake this signature exists to make impossible. */
export function applyShellPalette(palette: ShellPalette): void {
  document.documentElement.dataset["shellPalette"] = palette;
}
