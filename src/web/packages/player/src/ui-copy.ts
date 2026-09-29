/** Typed package-local visible player copy (§35). Authored theme text, telemetry
 * values and developer errors stay outside this module. */
export const uiCopy = {
  /** A theme that fails to load is the one user-visible failure the player
   *  owns, and it is the only one that replaces the whole display. It is
   *  written as a page rather than as a line, because the reader here is
   *  looking at a wall or a phone and not at a log: two ways on from here, and
   *  the host's own reason kept beside them.
   *
   *  It must not read like `connection` or `cropped` below, which describe a
   *  *part* of a display that is otherwise working. A gap says "3 of 40
   *  sensors have no reading" and leaves a chart on screen; this says the
   *  screen is empty, because it is (§97's instinct, same shape). */
  loadFailure: {
    title: "This display has nothing to show",
    lede: "Vigilia could not load the theme this display was pointed at.",
    /** Labels the host's own words as the diagnostic they are, so the sentence
     *  above is what a reader takes and this is what an owner is given. */
    reasonLabel: "Reason",
    retry: "Try again",
    /** `/` on a host is its theme chooser, or whichever theme it holds — either
     *  way the one place a reader can change what this display shows. */
    host: "Go to the host",
    /** A tab is how a reader with several displays open tells which one broke. */
    documentTitle: "Vigilia — nothing to display",
  },
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
  /** Why sensors on this display have no reading. `groups` is already ordered
   *  and bounded by the caller: one entry per distinct cause, carrying how
   *  many sensors share it, so a cause said four times is said once. */
  availability: {
    notice: (
      unread: number,
      total: number,
      groups: readonly { readonly count: number; readonly reason: string }[],
      hiddenReasons: number,
    ): string =>
      `${unread} of ${total} sensors have no reading — ` +
      [
        ...groups.map((group) => `${group.count}× ${group.reason}`),
        ...(hiddenReasons > 0 ? [`+${hiddenReasons} more reasons`] : []),
      ].join(", "),
    /** Stands in for the transport address a provider named in its reason. */
    address: "its configured address",
  },
  /** Objects the artboard does not contain, so the display never painted
   *  them. Distinct from `availability` on purpose (§97): a missing sensor is
   *  a gap in the *data*, a crop is a gap in the *composition*, and a reader
   *  who cannot tell them apart is told neither.
   *
   *  `edges` names the sides the content ran off, not the objects. Whoever
   *  reads a display is not the author, and "past the right edge" says what is
   *  wrong and what to do about it; a list of object ids says neither, and the
   *  layer list is where an author looks those up. */
  cropped: (outside: number, total: number, edges: readonly string[]): string =>
    `${outside} of ${total} objects are outside this artboard and are not shown` +
    (edges.length === 0 ? "" : ` — ${edges.join(" and ")}`),
  croppedEdges: {
    right: "past the right edge",
    bottom: "past the bottom edge",
    left: "past the left edge",
    top: "past the top edge",
  },
} as const;
