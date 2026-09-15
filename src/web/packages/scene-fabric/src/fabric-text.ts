import { FabricText, Textbox, type TextProps } from 'fabric/es';
import type { PlanBox, PlanNode } from '@vigilia/renderer-core';
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
 * ## What is stage 5's, and is reported rather than approximated
 *
 * `overflow: clip | ellipsis` and the line clamp need measurement and
 * re-layout that Fabric does not do. `maxLines` is computed by the plan and is
 * unused here on purpose: clamping without ellipsising would hide text with no
 * indication, which is worse than overflowing it (§89 wants overflow authored,
 * never silent).
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

  const shape = textShapeFor(node.content.segments, node.style, (value) =>
    object.graphemeSplit(value),
  );

  object.set({ text: shape.text, styles: shape.styles });
  object.initDimensions();

  const { layout } = node.content;
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
}

/** Everything about this node's text the canvas cannot express. */
export function textGaps(node: PlanNode): readonly string[] {
  if (node.content.kind !== 'text') {
    return [];
  }

  const gaps: string[] = [];
  const { layout } = node.content;

  if (layout.overflow !== 'visible') {
    gaps.push(
      `text overflow "${layout.overflow}" needs measurement and re-layout Fabric does not do — stage 5`,
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
