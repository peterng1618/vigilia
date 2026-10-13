/**
 * The paints the layer surfaces' tests dress a shape mark in.
 *
 * A shape's paint is a document's own value — what an author typed — so it is
 * fixture data rather than styling, and these tests share one home for it
 * instead of each keeping its own copy. `SHAPE_PAINT` is the one a case reads
 * back off the rendered swatch; `NEUTRAL_PAINT` is what a row carries where the
 * case reads something else about it and a real document's reading would only
 * be a distraction.
 */

/** The shape arm's own paint, asserted back off the swatch it fills. */
export const SHAPE_PAINT = "#2ee6a8";

/** A member's paint, planted inside a group's own fields: the arm must draw the
 *  group and never the member's treatment. */
export const MEMBER_PAINT = "#f00";

/** A shape's paint where the colour is not what the case is about. */
export const NEUTRAL_PAINT = "#000";
