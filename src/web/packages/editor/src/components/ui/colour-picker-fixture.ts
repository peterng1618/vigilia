/**
 * The colours `colour-picker.dom.test.tsx` opens the picker with.
 *
 * They are the values an author typed into a document, not styling the shell
 * paints, so they live beside the test rather than inside it — the shape
 * `tests/e2e/glass-fixture.ts` and `host-theme.ts` give a suite's own data. Each
 * is chosen for the track it starts: neither has anywhere to go but up.
 */

/** A grey: zero saturation, so the saturation track starts at the bottom of its
 *  range and an arrow has somewhere to go. */
export const GREY = "#808080";

/** A pure red: hue 0, so the hue track starts at the bottom of its range too. */
export const PURE_RED = "#ff0000";
