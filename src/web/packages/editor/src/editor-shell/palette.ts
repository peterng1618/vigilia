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

/** The palette an OS reporting `prefersDark` gets when the author has not chosen.
 *
 *  `graphite` is the shell's one dark palette and `editorial` its default, so
 *  these are the same two names `DEFAULT_SHELL_PALETTE` and the picker already
 *  use — no new vocabulary, and no seventh entry in the picker. */
export function systemShellPalette(prefersDark: boolean): ShellPalette {
  return prefersDark ? "graphite" : DEFAULT_SHELL_PALETTE;
}

/** The palette in force: the author's choice, or what the OS asks for.
 *
 *  One rule, and it is the whole of §9's "the palette picker as an explicit
 *  override": a choice is never overridden by the OS. */
export function resolveShellPalette(
  choice: ShellPalette | undefined,
  prefersDark: boolean,
): ShellPalette {
  return choice ?? systemShellPalette(prefersDark);
}

/** What the author chose, or `undefined` while the shell is following the OS.
 *
 *  `undefined` rather than the default, because the two are different states:
 *  the shell re-resolves on an OS change only while this is `undefined`. */
export function readShellChoice(storage: Storage): ShellPalette | undefined {
  const stored = storage.getItem(storageKey);
  return isShellPalette(stored) ? stored : undefined;
}

export function writeShellChoice(
  storage: Storage,
  palette: ShellPalette,
): void {
  storage.setItem(storageKey, palette);
}

/** The OS preference, as a boolean. `matchMedia` is absent in jsdom and in any
 *  non-browser host, and an absent API is not a preference for dark. */
export function prefersDarkAppearance(): boolean {
  return (
    globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches === true
  );
}

/** Calls back when the OS appearance changes, until the returned function is
 *  called. `change` rather than the deprecated `addListener`. */
export function watchSystemAppearance(
  onChange: (prefersDark: boolean) => void,
): () => void {
  const query = globalThis.matchMedia?.("(prefers-color-scheme: dark)");
  if (query === undefined) return () => {};
  const listener = (event: MediaQueryListEvent): void =>
    onChange(event.matches);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
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
