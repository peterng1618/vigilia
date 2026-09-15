import {
  Ellipse,
  FixedLayout,
  Group,
  LayoutManager,
  Rect,
  type FabricImage,
  type FabricObject,
} from 'fabric/es';
import type { PlanBox, PlanNode, ResolvedStyle } from '@vigilia/renderer-core';
import { VigiliaChart } from './chart-object.js';
import { beginImage, placeImage } from './fabric-image.js';
import { buildText, isTextObject, textGaps, updateText } from './fabric-text.js';
import { paintFor, unsupportedPaint } from './paint.js';
import { placementFor } from './placement.js';

/**
 * One Fabric object per `PlanNode`, and the updates that keep it current.
 *
 * `adapter.ts` owns the tree, identity and z-order; this file owns the mapping
 * from a content kind to a Fabric class. Split because the two fail in
 * different ways: a mistake here draws the wrong thing, a mistake there draws
 * the right things in the wrong order, twice, or not at all.
 *
 * ## The stroke inset is not a rounding choice
 *
 * `mount.ts` set `box-sizing: border-box`, so an authored rectangle stayed the
 * **outer** rectangle and an outline grew inward. Fabric centres a stroke on
 * the path, putting half of it outside the authored geometry — every stroked
 * node would then be a stroke-width wider than the box the artboard laid out.
 * So the shape is inset by half the stroke and the outer edge stays where the
 * author put it.
 *
 * ## Boxes are in the parent's space, and the caller says which
 *
 * A plan box is local to its parent group's top-left; a Fabric child's
 * coordinates are relative to the group's centre. Every function here takes the
 * box it should use, already converted by the caller — see
 * `placement.ts`'s `withinGroup` for why creation and update differ.
 */

/** Told when the renderer cannot express something the document asked for. */
export type UnsupportedReporter = (nodeId: string, reason: string) => void;

export interface NodeContext {
  /** Device-pixel oversample for chart backing canvases. */
  readonly renderScale: number;
  readonly onUnsupported?: UnsupportedReporter;
  readonly onAssetError?: (nodeId: string, src: string) => void;
  /** An async object — an image — is finally ready to be placed and stacked. */
  readonly onReady?: (nodeId: string, object: FabricObject) => void;
}

/**
 * Creates the object for one node, and for a group its whole subtree.
 *
 * Returns `undefined` when there is nothing to place *yet or ever*: an image
 * still loading, a video, a chart with no size. The caller keeps no entry, so a
 * later plan tries again rather than caching the absence.
 */
export function createNodeObject(
  node: PlanNode,
  box: PlanBox,
  context: NodeContext,
  register: (nodeId: string, object: FabricObject) => void,
): FabricObject | undefined {
  const object = build(node, box, context, register);

  reportGaps(node, context);

  if (object === undefined) {
    return undefined;
  }

  // The match key for a plan node, and — from stage 3 — a persisted custom
  // property on every class. Matching by position in `_objects` fails on the
  // first insert: add a rectangle at index 0 and every binding is one node
  // out, silently, because each still resolves to *some* node.
  object.set('id', node.id);
  object.set('visible', node.visible);
  object.setCoords();

  register(node.id, object);

  return object;
}

/** Applies a later plan to an object that already exists. */
export function updateNodeObject(
  object: FabricObject,
  node: PlanNode,
  previous: PlanNode | undefined,
  box: PlanBox,
  context: NodeContext,
): void {
  const geometryChanged = previous === undefined || !sameBox(previous.box, node.box);
  const styleChanged = previous === undefined || previous.style !== node.style;

  switch (node.content.kind) {
    case 'chart':
      if (object instanceof VigiliaChart) {
        updateChart(object, node, previous, box, geometryChanged);
      }
      break;

    case 'text':
      // Unconditionally, unlike the other kinds: new text is what an update
      // usually carries, the segments are rebuilt every frame so a comparison
      // would cost about what the write costs, and the position depends on the
      // measured result rather than on the box alone.
      if (isTextObject(object)) {
        updateText(object, node, box);
      }
      break;

    case 'image':
      if (geometryChanged || styleChanged) {
        placeImage(object as FabricImage, node, box, node.content.fit);
      }
      break;

    case 'group':
    case 'shape':
      if (geometryChanged) {
        const placement = placementFor(box);

        object.set({
          left: placement.left,
          top: placement.top,
          angle: placement.angle,
          scaleX: placement.scaleX,
          scaleY: placement.scaleY,
        });

        if (node.content.kind === 'shape') {
          resizeShape(object, box, node.style);
        } else {
          object.set({ width: placement.width, height: placement.height });
        }
      }
      break;
  }

  // A group takes no paint, so there is nothing to re-apply to one.
  if (styleChanged && node.content.kind !== 'group' && node.content.kind !== 'image') {
    object.set(paintFor(node.style, node.content.kind === 'text' ? 'text' : 'box'));

    if (node.content.kind === 'shape') {
      // The inset depends on the stroke, so a style change can move the edges.
      resizeShape(object, box, node.style);
    }
  }

  object.set('visible', node.visible);
  object.setCoords();
}

function build(
  node: PlanNode,
  box: PlanBox,
  context: NodeContext,
  register: (nodeId: string, object: FabricObject) => void,
): FabricObject | undefined {
  switch (node.content.kind) {
    case 'group':
      return buildGroup(node, box, context, register);

    case 'shape':
      return buildShape(node, box);

    case 'text':
      return buildText(node, box);

    case 'chart':
      return buildChart(node, box, context);

    case 'image':
      // Asynchronous: nothing exists until the image decodes. The caller holds
      // the in-flight guard, because it is the one being called back.
      beginImage(node, box, {
        onReady: (nodeId, image) => context.onReady?.(nodeId, image),
        ...(context.onAssetError === undefined ? {} : { onAssetError: context.onAssetError }),
        ...(context.onUnsupported === undefined ? {} : { onUnsupported: context.onUnsupported }),
      });

      return undefined;

    case 'video':
      // Not a gap to be worked around later: a Fabric video object was
      // measured and rejected at 22.9–28.2 ms per frame against a 33.3 ms
      // budget. It becomes a DOM layer behind the canvas, at stage 7.
      context.onUnsupported?.(
        node.id,
        'video cannot be a canvas object — a DOM layer behind the scene is stage 7',
      );

      return undefined;
  }
}

/**
 * A group whose own box is the authored one.
 *
 * Three things here were read out of Fabric's source rather than guessed, and
 * each is load-bearing:
 *
 * - **`FixedLayout`.** The default `FitContentLayout` returns `true` from
 *   `shouldPerformLayout` for *every* trigger, so `add()` would recompute the
 *   group's bounding box from its children and discard the authored geometry —
 *   which §137's reversal now says the group owns. `FixedLayout` lays out on
 *   initialization and imperative calls only.
 * - **Constructed empty, then filled.** With no objects `calcBoundingBox`
 *   returns `undefined`, so the initialization layout is skipped entirely and
 *   `left`/`top`/`width`/`height` survive exactly as given.
 * - **Built at its own content origin.** `add()` converts a child out of the
 *   plane the group's `left`/`top` live in, by inverting the group's matrix.
 *   Placing the group at `(w/2, h/2)` with no angle and no scale makes that
 *   inversion the exact conversion a plan child needs — its box is relative to
 *   the group's top-left, in unrotated space. The real transform goes on
 *   afterwards, and moving or rotating a group carries its children.
 */
function buildGroup(
  node: PlanNode,
  box: PlanBox,
  context: NodeContext,
  register: (nodeId: string, object: FabricObject) => void,
): Group {
  const placement = placementFor(box);
  const group = new Group([], {
    left: placement.width / 2,
    top: placement.height / 2,
    width: placement.width,
    height: placement.height,
    originX: 'center',
    originY: 'center',
    layoutManager: new LayoutManager(new FixedLayout()),
    // Editor interaction state, which has no business in a display scene — nor,
    // per spec 0013, in a persisted one. Stage 4 turns them on for the editor.
    subTargetCheck: false,
    interactive: false,
  });

  const children = node.children
    .map((child) => createNodeObject(child, child.box, context, register))
    .filter((child): child is FabricObject => child !== undefined);

  if (children.length > 0) {
    group.add(...children);
  }

  group.set({
    left: placement.left,
    top: placement.top,
    angle: placement.angle,
    scaleX: placement.scaleX,
    scaleY: placement.scaleY,
  });

  return group;
}

function buildShape(node: PlanNode, box: PlanBox): FabricObject {
  if (node.content.kind !== 'shape') {
    throw new Error('buildShape received a non-shape node.');
  }

  const placement = placementFor(box);
  const inset = insetFor(node.style);
  const width = Math.max(0, placement.width - inset * 2);
  const height = Math.max(0, placement.height - inset * 2);
  const common = {
    ...paintFor(node.style, 'box'),
    originX: 'center' as const,
    originY: 'center' as const,
    left: placement.left,
    top: placement.top,
    angle: placement.angle,
    scaleX: placement.scaleX,
    scaleY: placement.scaleY,
    width,
    height,
  };

  if (node.content.shape === 'ellipse') {
    // rx/ry last, because `Ellipse` derives `width`/`height` from them: passing
    // both in the other order leaves the two disagreeing.
    return new Ellipse({ ...common, rx: width / 2, ry: height / 2 });
  }

  // A `line` is a `Rect`, deliberately, and not Fabric's `Line`. The document's
  // line is an authored rectangle with a fill — which is exactly what
  // `mount.ts` drew, its shape switch having no `line` case at all — whereas
  // `Line` strokes a segment between two points and would change how every
  // theme that uses one looks.
  return new Rect({
    ...common,
    ...(node.content.shape === 'rectangle' && node.content.cornerRadius > 0
      ? { rx: node.content.cornerRadius, ry: node.content.cornerRadius }
      : {}),
  });
}

function buildChart(
  node: PlanNode,
  box: PlanBox,
  context: NodeContext,
): FabricObject | undefined {
  if (node.content.kind !== 'chart') {
    throw new Error('buildChart received a non-chart node.');
  }

  const placement = placementFor(box);

  if (!(placement.width > 0) || !(placement.height > 0)) {
    // `VigiliaChart` refuses a box it cannot draw in, by throwing — correctly,
    // since `echarts.init` on a zero-sized element silently never draws. But a
    // document that reaches here with one is a validation failure, and taking
    // the whole frame down for it would hide every other node's problem too.
    context.onUnsupported?.(
      node.id,
      `a chart needs a positive size; the document gives ${placement.width}x${placement.height}`,
    );

    return undefined;
  }

  return new VigiliaChart({
    // Spread rather than picked apart: `family` and `settings` are correlated
    // by `PlanChart`, and naming them separately widens each to the union of
    // all four families, which no longer satisfies `ChartContent`.
    ...node.content,
    width: placement.width,
    height: placement.height,
    renderScale: context.renderScale,
    ...paintFor(node.style, 'box'),
    left: placement.left,
    top: placement.top,
    angle: placement.angle,
    scaleX: placement.scaleX,
    scaleY: placement.scaleY,
  });
}

function updateChart(
  chart: VigiliaChart,
  node: PlanNode,
  previous: PlanNode | undefined,
  box: PlanBox,
  geometryChanged: boolean,
): void {
  if (node.content.kind !== 'chart') {
    return;
  }

  if (geometryChanged) {
    const placement = placementFor(box);

    if (placement.width > 0 && placement.height > 0) {
      // Re-layout rather than scaling drawn pixels: ECharts re-ticks its axes
      // and keeps type at its authored size. `resizeTo` writes width, height
      // and both scales, so it goes before the position.
      chart.resizeTo(placement.width, placement.height);
    }

    chart.set({
      left: placement.left,
      top: placement.top,
      angle: placement.angle,
      scaleX: placement.scaleX,
      scaleY: placement.scaleY,
    });
  }

  // Unconditional, and this is the one update that must not be guarded: the
  // option is rebuilt precisely *because* the samples changed, and comparing
  // two freshly built option trees costs more than handing it over.
  chart.setOption(node.content.option);

  if (
    previous !== undefined &&
    previous.content.kind === 'chart' &&
    previous.content.settings !== node.content.settings
  ) {
    // Authored rather than per-frame, so this moves rarely — but it does move,
    // from the editor, and the object's own copy is what gets persisted.
    chart.set('settings', node.content.settings);
  }
}

/** Re-sizes a shape for a new box or a new stroke width. */
function resizeShape(object: FabricObject, box: PlanBox, style: ResolvedStyle): void {
  const inset = insetFor(style);
  const width = Math.max(0, box.width - inset * 2);
  const height = Math.max(0, box.height - inset * 2);

  if (object instanceof Ellipse) {
    // Only the radii: `Ellipse._set` writes `width`/`height` from them, and
    // writing those as well would put the two out of step.
    object.set({ rx: width / 2, ry: height / 2 });

    return;
  }

  object.set({ width, height });
}

/** Half the stroke width — how far outside the path Fabric paints it. */
function insetFor(style: ResolvedStyle): number {
  const width = style['strokeWidth'];
  const color = style['strokeColor'];

  if (typeof width !== 'number' || !Number.isFinite(width) || width <= 0) {
    return 0;
  }

  return typeof color === 'string' && color.length > 0 ? width / 2 : 0;
}

/** Field by field: the plan builds a fresh box object every frame. */
function sameBox(a: PlanBox, b: PlanBox): boolean {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.rotation === b.rotation &&
    a.scaleX === b.scaleX &&
    a.scaleY === b.scaleY
  );
}

/**
 * Everything about this node the renderer could not express.
 *
 * Reported per node rather than logged here, so the caller decides what to do
 * with it and one central list stays the only place these are described.
 */
function reportGaps(node: PlanNode, context: NodeContext): void {
  const report = context.onUnsupported;

  if (report === undefined || node.content.kind === 'group') {
    return;
  }

  for (const property of unsupportedPaint(
    node.style,
    node.content.kind === 'text' ? 'text' : 'box',
  )) {
    report(node.id, `the style property "${property}" is not expressible on canvas`);
  }

  for (const gap of textGaps(node)) {
    report(node.id, gap);
  }
}
