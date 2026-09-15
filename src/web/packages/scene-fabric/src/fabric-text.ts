import { FabricText, Rect, Textbox, type TextProps } from 'fabric/es';
import type {
  PlanBox,
  PlanNode,
  PlanTextLayout,
  PlanTextSegment,
} from '@vigilia/renderer-core';
import { paintFor } from './paint.js';
import { placementFor } from './placement.js';
import { textShapeFor } from './text-runs.js';

/**
 * Text as a Fabric object.
 *
 * ## Two classes, because `wrap` is not a flag Fabric has
 *
 * `Textbox` wraps to a width it owns; `FabricText` does not wrap at all and
 * cannot be told to. `mount.ts` made the same split with `white-space: pre-wrap`
 * against `pre`, and the plan already decides it — so the class follows the
 * plan's `wrap`, and a node that changes between them is *replaced* rather than
 * mutated. `adapter.ts`'s `classFor` is what notices, and it has to compare
 * constructors exactly: `Textbox` extends `FabricText`, so `instanceof` would
 * happily keep a wrapping object for a node that stopped wrapping.
 *
 * ## Alignment is placement, not layout
 *
 * Fabric has no vertical alignment and no box for a `FabricText` to sit inside:
 * both classes size themselves to their content. So aligning text within its
 * authored box means **positioning the object**, from its measured dimensions,
 * every time the text changes — a new reading is a new width.
 *
 * `Textbox` is the easy half: its width *is* the box's, so its centre is the
 * box's centre for all three horizontal alignments and `textAlign` does the
 * rest. A `FabricText` has the width of its glyphs, so left and right
 * alignment move the object.
 *
 * ## Overflow, which Fabric does not do and this does
 *
 * The DOM path gets `overflow: hidden`, `text-overflow: ellipsis` and
 * `-webkit-line-clamp` for free. A canvas has none of them, so both halves are
 * built here, and they follow `mount.ts`'s structure exactly rather than a new
 * interpretation of §89:
 *
 * - **Clipping** applies to `clip` *and* `ellipsis`, because it does in the DOM
 *   (`overflow !== 'visible'` → hidden on the box). It is a `clipPath` rect on
 *   the object, in the object's own local space — see {@link applyClip}. It
 *   also means the ellipsis measurement below does not have to be perfect:
 *   whatever it leaves over the edge is clipped, rather than painted across a
 *   neighbouring node.
 * - **Ellipsising** truncates the **segments** and rebuilds the shape, never
 *   the concatenated string. `text-runs.ts` owns the text → per-grapheme style
 *   mapping; truncating its output would need a second implementation of the
 *   same index arithmetic, and the two would disagree the first time a run
 *   boundary landed inside the cut.
 *
 * The fit is found by bisection on the grapheme count rather than from
 * `__charBounds`, which is a private field and would not survive a Fabric
 * minor. That costs `log2(n)` measurements — seven or so for a line of text —
 * and only for a node that actually overflows; the common case is one
 * measurement that fits and stops.
 *
 * ## What is still stage 5's, and is reported rather than approximated
 *
 * Wrapped text asking for an ellipsis when the plan could not compute
 * `maxLines` — which happens only when the type size did not resolve to a
 * number. The DOM falls back to collapsing it to a single nowrap line, and the
 * equivalent here is swapping `Textbox` for `FabricText`, i.e. changing the
 * object's class from inside a style decision. It reports a gap and clips
 * instead: §89 wants overflow authored, never silent, and a clamp guessed from
 * an unresolved size hides text that would have fitted.
 *
 * ## Why the type is a union rather than the base class
 *
 * `Textbox` is **not assignable to `FabricText`** under
 * `exactOptionalPropertyTypes`: its `toObject` is typed over
 * `SerializedTextboxProps`, which makes the inherited signature incompatible
 * with the base's. That is Fabric's typing meeting a `tsconfig.base.json`
 * setting, not something to fix here — the repo's rule is that a Vigilia rule
 * yields to the library — so the pair is named as a union and
 * {@link isTextObject} narrows to it.
 */

/** Either text class, because one is not assignable to the other's type. */
export type PlanTextObject = FabricText | Textbox;

/**
 * The character an ellipsised run ends with.
 *
 * The single glyph, not three dots: it is what `text-overflow: ellipsis`
 * renders, so the two paths agree, and it measures as one grapheme.
 */
const ELLIPSIS = '…';

/**
 * Whether an object is one of the two text classes.
 *
 * `instanceof FabricText` is true for a `Textbox` at runtime — it extends it —
 * so this is a static-typing shim over a correct runtime check.
 */
export function isTextObject(object: object): object is PlanTextObject {
  return object instanceof FabricText;
}

/** Creates the text object for a node, positioned and styled. */
export function buildText(node: PlanNode, box: PlanBox): PlanTextObject {
  if (node.content.kind !== 'text') {
    throw new Error('buildText received a non-text node.');
  }

  const placement = placementFor(box);
  const common: Partial<TextProps> = {
    ...paintFor(node.style, 'text'),
    originX: 'center' as const,
    originY: 'center' as const,
    textAlign: node.content.layout.align,
    angle: placement.angle,
    scaleX: placement.scaleX,
    scaleY: placement.scaleY,
  };

  // Constructed empty and filled by `applyText`, so the text, the per-run
  // styles and the measurement-dependent position are written in exactly one
  // place rather than once here and once on every update.
  const object = node.content.layout.wrap
    ? new Textbox('', { ...common, width: box.width })
    : new FabricText('', common);

  applyText(object, node, box);

  return object;
}

/** Applies a later plan to an existing text object. */
export function updateText(object: PlanTextObject, node: PlanNode, box: PlanBox): void {
  if (node.content.kind !== 'text') {
    return;
  }

  const placement = placementFor(box);

  if (object instanceof Textbox) {
    // The authored width, which is what it wraps to.
    object.set('width', box.width);
  }

  object.set({
    textAlign: node.content.layout.align,
    angle: placement.angle,
    scaleX: placement.scaleX,
    scaleY: placement.scaleY,
  });

  applyText(object, node, box);
}

/**
 * Writes the text, its per-run styles and the position alignment implies.
 *
 * `initDimensions` is not optional: Fabric measures on construction, and a
 * `set('text')` afterwards leaves `width`/`height` describing the *previous*
 * string until it runs. The alignment below would then place the object using
 * the size of the reading before last — which looks like a wobble that follows
 * the data, and is the kind of thing that gets blamed on the font.
 */
function applyText(object: PlanTextObject, node: PlanNode, box: PlanBox): void {
  if (node.content.kind !== 'text') {
    return;
  }

  const { layout, segments } = node.content;

  write(object, segments, node.style);

  if (layout.overflow === 'ellipsis' && !fits(object, box, layout)) {
    write(object, ellipsised(object, segments, node.style, box, layout), node.style);
  }

  const width = object.width * object.scaleX;
  const height = object.height * object.scaleY;
  const placement = placementFor(box);

  object.set({
    left:
      layout.align === 'left'
        ? box.x + width / 2
        : layout.align === 'right'
          ? box.x + box.width - width / 2
          : placement.left,
    top:
      layout.verticalAlign === 'top'
        ? box.y + height / 2
        : layout.verticalAlign === 'bottom'
          ? box.y + box.height - height / 2
          : placement.top,
  });

  applyClip(object, layout, box);
}

/** Writes the text and per-grapheme styles, and re-measures. */
function write(
  object: PlanTextObject,
  segments: readonly PlanTextSegment[],
  nodeStyle: PlanNode['style'],
): void {
  const shape = textShapeFor(segments, nodeStyle, (value) => object.graphemeSplit(value));

  object.set({ text: shape.text, styles: shape.styles });
  object.initDimensions();
}

/**
 * Whether the object, as currently measured, is inside its authored box.
 *
 * Two different questions, because the DOM asks two: wrapped text overflows by
 * **line count** and is clamped, unwrapped text overflows by **width** and is
 * ellipsised on one line. Height is not checked for unwrapped text — the DOM
 * does not either, it just clips, and so does {@link applyClip}.
 */
function fits(object: PlanTextObject, box: PlanBox, layout: PlanTextLayout): boolean {
  if (layout.wrap) {
    // No clamp to apply: reported as a gap rather than guessed at.
    return layout.maxLines === undefined || object.textLines.length <= layout.maxLines;
  }

  return object.width <= box.width;
}

/**
 * The largest prefix of the segments that fits, with an ellipsis.
 *
 * Bisection over the **grapheme** count, because that is what Fabric indexes
 * styles by and what {@link truncate} has to cut on. `low` is always a count
 * known to fit and `high` one known not to, so the loop cannot return something
 * that overflows — and it starts at zero, which is the ellipsis alone. That is
 * deliberate: a box too narrow for one character shows a clipped ellipsis, the
 * same as the DOM, rather than the full string.
 */
function ellipsised(
  object: PlanTextObject,
  segments: readonly PlanTextSegment[],
  nodeStyle: PlanNode['style'],
  box: PlanBox,
  layout: PlanTextLayout,
): readonly PlanTextSegment[] {
  const total = segments.reduce(
    (count, segment) => count + object.graphemeSplit(segment.text).length,
    0,
  );

  let low = 0;
  let high = total;

  while (low < high) {
    // Rounded up, so `low` advances and the loop terminates.
    const probe = Math.ceil((low + high) / 2);

    write(object, truncate(object, segments, probe), nodeStyle);

    if (fits(object, box, layout)) {
      low = probe;
    } else {
      high = probe - 1;
    }
  }

  return truncate(object, segments, low);
}

/** The first `graphemes` graphemes of the segments, with an ellipsis appended. */
function truncate(
  object: PlanTextObject,
  segments: readonly PlanTextSegment[],
  graphemes: number,
): readonly PlanTextSegment[] {
  const kept: PlanTextSegment[] = [];
  let remaining = graphemes;

  for (const segment of segments) {
    if (remaining <= 0) {
      break;
    }

    const parts = object.graphemeSplit(segment.text);

    kept.push(
      parts.length <= remaining
        ? segment
        : { ...segment, text: parts.slice(0, remaining).join('') },
    );

    remaining -= parts.length;
  }

  const last = kept[kept.length - 1];

  if (last === undefined) {
    // Nothing fitted. The ellipsis still needs a style to be drawn in, and the
    // first segment's is the one the reader would have seen first.
    return [{ ...(segments[0] ?? { text: '', style: {} }), text: ELLIPSIS }];
  }

  kept[kept.length - 1] = { ...last, text: `${last.text}${ELLIPSIS}` };

  return kept;
}

/**
 * Clips the object to its authored box, for any overflow mode but `visible`.
 *
 * A **relative** clip path, so it inherits the object's angle and scale and
 * therefore rotates with the node — an `absolutePositioned` one would stay
 * axis-aligned while the text turned under it. The offset is the box's centre
 * expressed in the object's local space, which is needed at all because
 * alignment moves the object off the box's centre: left-aligned text is
 * centred on its own glyphs, not on the box.
 *
 * The offset is computed in the unrotated frame and divided by scale, which is
 * exact at angle 0 and consistent with the alignment arithmetic above at every
 * other angle — that arithmetic is already unrotated. Rotated *and* edge-aligned
 * text is not at parity with the DOM path either way, and was not before this.
 */
function applyClip(object: PlanTextObject, layout: PlanTextLayout, box: PlanBox): void {
  if (layout.overflow === 'visible') {
    // Cleared rather than left behind: a node whose overflow changed from
    // `clip` to `visible` would otherwise keep clipping, with nothing to
    // explain why. Deleted rather than set to `undefined`, because
    // `exactOptionalPropertyTypes` makes those different things and Fabric
    // declares the property optional.
    delete object.clipPath;
    return;
  }

  const scaleX = object.scaleX === 0 ? 1 : object.scaleX;
  const scaleY = object.scaleY === 0 ? 1 : object.scaleY;

  object.clipPath = new Rect({
    width: box.width / scaleX,
    height: box.height / scaleY,
    left: (box.x + box.width / 2 - object.left) / scaleX,
    top: (box.y + box.height / 2 - object.top) / scaleY,
    originX: 'center',
    originY: 'center',
  });
}

/** Everything about this node's text the canvas cannot express. */
export function textGaps(node: PlanNode): readonly string[] {
  if (node.content.kind !== 'text') {
    return [];
  }

  const gaps: string[] = [];
  const { layout } = node.content;

  // The one overflow case still unhandled. Everything else — clipping for both
  // non-visible modes, single-line ellipsis, and the wrapped line clamp — is
  // implemented above. `maxLines` is absent only when the plan could not
  // resolve the type size to a number, and clamping on a guessed line height
  // hides text that would have fitted.
  if (layout.overflow === 'ellipsis' && layout.wrap && layout.maxLines === undefined) {
    gaps.push(
      'wrapped text cannot be ellipsised without a resolved font size — clipped instead',
    );
  }

  // The splitter only has to agree with Fabric's on *counts* here, and this
  // path reports rather than positions, so code points are close enough to
  // avoid constructing an object just to ask.
  const shape = textShapeFor(node.content.segments, node.style, (value) => [...value]);

  for (const property of shape.unsupported) {
    gaps.push(`"${property}" differs per run, which only a whole object can carry`);
  }

  return gaps;
}
