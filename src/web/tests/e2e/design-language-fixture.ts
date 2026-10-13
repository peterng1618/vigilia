/**
 * The values the design-language drawing instrument *samples*, and the two
 * degenerate marks it names.
 *
 * Everything here is the instrument's own data rather than a product value or a
 * drawing's: the off-scale samples are deliberately wrong values it proves its
 * arms refuse, and the degenerate marks are the thickness/full marks §3's closed
 * radius scale has no entry for. They live beside the spec so the class of
 * value is legible — a sample that is *supposed* to be off the scale is not a
 * surface that went around the scale.
 *
 * The values that *are* owned elsewhere are not here: §3's radius steps and
 * elevation table are read from `editor-shell.css`'s `@theme` block through
 * `./shell-tokens.js`, and the drawings' own values through `./mockup-values.js`.
 */

/**
 * §3's radius table's `full` row — `| full | 999px | Pills and toggles only |`.
 * DESIGN.md states it as prose rather than as a front-matter token, so there is
 * no machine-readable owner to read it from; this is the one radius value the
 * instrument still transcribes, and the row it is transcribed from is named.
 */
export const FULL_RADIUS = "999px";

/** §3's other degenerate radius mark: a thickness rather than a corner — §7.2's
 *  rail accent bar, the slider track ends. §3 lists no `2px` entry, so the mark
 *  is named here rather than read from the scale. */
export const THICKNESS_MARK = "2px";

/** DESIGN.md §5's focus boundary width, which the rendered focus row is held to
 *  (`>= 2`). A bare number: the message that names it fails the source ratchet
 *  if it spells the `px` twice, so the width is stated once, here. */
export const BOUNDARY_PX = 2;

/** A mark's anchor: a fractional or negative px in `top`/`right`/`bottom`/
 *  `left`/`inset`. Not product values — deliberately off §3's steps, read to
 *  prove the spacing arm exempts them while refusing the same px as a gutter. */
export const ANCHOR_FRACTIONAL = "1.5px";
export const ANCHOR_NEGATIVE = "-3.5px";

/** The same px on a *gutter* property, which the anchor exemption must not
 *  reach: if it did, `padding: -3.5px` would pass as a mark. */
export const GUTTER_NEGATIVE = "-3.5px";

/** One off-scale value per arm, each read to prove the arm still refuses it. */
export const OFF_SCALE_RADIUS = "7px";
export const OFF_SCALE_GUTTER = "5px";
export const OFF_SCALE_TYPE = "11.5px";
export const OFF_TABLE_SHADOW = "0 18px 50px #0009";
export const OFF_TABLE_SHADOW_LIST = "0 0 0 3px #72e0c02e, 0 10px 26px #0007";
export const OFF_SCALE_BOUNDARY = "2px solid var(--edge)";

/** §5 rule 4's two shadow *marks* — decoration and a mark on the element, the
 *  two families the elevation arm exempts by shape. Read back so a mark the arm
 *  refused would fail at the naming rather than at a drawing. */
export const HALO_INSET = "inset 2px 0 0 var(--accent)";
export const HALO_RING = "0 0 0 3px #72e0c02e";
