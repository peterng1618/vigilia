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

export function applyShellPalette(
  root: HTMLElement,
  palette: ShellPalette,
): void {
  root.dataset["shellPalette"] = palette;
}
