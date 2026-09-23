/** Typed package-local visible player copy (§35). Authored theme text, telemetry
 * values and developer errors stay outside this module. */
export const uiCopy = {
  /** A theme that fails to load is the one user-visible failure the player owns. */
  loadFailure: (message: string): string =>
    `Vigilia could not load this theme.\n\n${message}`,
  connection: {
    connecting: (keyCount: number): string =>
      `Connecting to the host — ${keyCount} sensors requested`,
    reconnecting:
      "Lost the host. Values shown are the last received, not current.",
    refused: (detail: string | undefined): string =>
      `The host is not compatible with this display${detail === undefined ? "" : `: ${detail}`}`,
  },
  /** Disclosure that displayed values are synthetic, never measured (§97). */
  syntheticData: (themeName: string, keyCount: number): string =>
    `SYNTHETIC DATA — "${themeName}", ${keyCount} semantic keys served by ` +
    "@vigilia/fake-source, not by hardware",
} as const;
