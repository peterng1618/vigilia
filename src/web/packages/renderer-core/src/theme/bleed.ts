/**
 * A crop the author meant: one optional object property saying this object may
 * run off the artboard on purpose.
 *
 * `outsideCount` measures a straddling object's whole bounding rect, which is
 * right as a measurement and wrong as a verdict — a quarter-disc bled past the
 * edge is a composition, and telling the author "1 object outside" reports a
 * decision as a mistake. This is the mark that makes the two different.
 *
 * It is a Fabric custom property rather than a field on the v1 `ThemeDocument`
 * node tree because the v2 document persists Fabric JSON: a field there would
 * reach the card-library widget path and never a saved theme, so the notice
 * would keep firing for every marked object. See
 * `docs/decisions/0027-a-deliberate-bleed-is-marked-not-warned-about.md`.
 */

/** Persisted property; Fabric JSON is the only place it is written. */
export const VIGILIA_BLEEDS_PROPERTY = "vigiliaBleeds";

/**
 * Read a validated mark from a revived object. Absence and any malformed value
 * both read as not bleeding, so a scene authored before the flag — and a file
 * too broken to trust — open exactly as they do today.
 *
 * Trust boundary, not a repair path: a value that fails here was already
 * refused at import.
 */
export function objectBleeds(object: { get(name: string): unknown }): boolean {
  return isBleedMark(object.get(VIGILIA_BLEEDS_PROPERTY));
}

/**
 * Accepts only the literal `true`, and that narrowness is the design rather
 * than a strictness detail. `false` is the value a document would carry on
 * every object in it if this were a plain boolean — a file of `vigiliaBleeds:
 * false` nobody can read by eye and an author has to diff to find the one that
 * matters. Only the deviation from "ordinary" is ever written.
 */
export function isBleedMark(value: unknown): value is true {
  return value === true;
}
