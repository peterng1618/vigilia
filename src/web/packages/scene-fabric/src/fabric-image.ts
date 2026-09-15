import { FabricImage, Rect } from 'fabric/es';
import type { PlanBox, PlanNode } from '@vigilia/renderer-core';
import { paintFor } from './paint.js';
import { placementFor } from './placement.js';
import { clampRenderScale } from './render-scale.js';

/**
 * An image asset as a Fabric object.
 *
 * ## The object exists from the first frame; only its pixels arrive late
 *
 * The obvious shape — `FabricImage.fromURL(...).then(add)` — makes an image the
 * one kind that cannot be created synchronously, and that difference is
 * expensive. It was built that way first and produced two defects, neither
 * visible in a unit test:
 *
 * - The "is this node still in the plan?" guard on the callback compared against
 *   the **top-level** id list, so every image inside a group was disposed on
 *   arrival. In the assets fixture that is all seven of them.
 * - A late arrival has to be inserted into its parent *group*, and `Group.add`
 *   converts coordinates by inverting the group's matrix — which is only the
 *   conversion a plan child needs while the group sits at its content origin
 *   with no angle. By the time an image decodes, the group is at its final
 *   transform, so the image would land somewhere the document never asked for.
 *
 * So the element is created **unloaded** and handed to Fabric immediately. The
 * object is built, positioned, registered and grouped exactly like every other
 * kind, and `setElement` swaps the decoded bitmap in later. Until then its
 * natural size is 0, and `isNotVisible()` means Fabric draws nothing — which is
 * what an image that has not loaded should look like.
 *
 * ## Fitting is scale, never width and height
 *
 * A Fabric image's `width`/`height` are its **natural** size; writing the box's
 * size into them would crop the source rather than fit it. So every mode is a
 * scale, and `cover` additionally clips — filling a box means overflowing it on
 * one axis, and nothing else would stop that painting over its neighbours.
 *
 * ## A vector asset has to be rasterised first, and that is not a preference
 *
 * **Chrome draws nothing** for an SVG with no intrinsic size — one with a
 * `viewBox` and no `width`/`height`, which is what an exported icon looks like
 * — when `drawImage` is given a **source rectangle**. Measured, one 24x24
 * icon, ink in the destination:
 *
 * | call | ink |
 * |---|---|
 * | `drawImage(svg, 0, 0, 150, 150, 0, 0, 96, 96)` at `devicePixelRatio` 4 | **0** |
 * | the same at `devicePixelRatio` 1 | 2,308 — a *partial* icon |
 * | `drawImage(svg, 0, 0, 96, 96)`, no source rect | 11,989 |
 * | the same source-rect call with a PNG | 21,852 |
 *
 * `FabricImage._renderFill` always uses the source-rect form, because it
 * supports cropping. So a vector asset goes through an offscreen canvas first,
 * drawn with the form that works, and Fabric is handed that canvas. It renders
 * a canvas source perfectly.
 *
 * The symptom this explains was device-dependent and therefore worse than a
 * plain failure: the icons drew as mangled fragments on a 1x display and
 * vanished entirely on a 4x one, under a green suite and an e2e test that only
 * counted ink over the whole frame.
 *
 * The cost is a fixed-resolution raster, so the factor comes from
 * `render-scale.ts` — the same ceiling a chart's backing canvas uses, for the
 * same reason. Re-rasterising on zoom is stage 4's concern, when there is zoom.
 *
 * ## §111's monochrome is not implemented here
 *
 * `mount.ts` flattens artwork to one colour with a CSS mask, which uses only
 * the source's alpha. The canvas equivalent needs an offscreen composite and
 * therefore a custom object, like `VigiliaChart` — stage 7's work. Until then
 * the artwork is drawn unflattened and the gap is reported: an icon in the
 * wrong colours is still legible, and an absent one is not.
 */

export interface ImageOptions {
  /** Device-pixel oversample for a rasterised vector asset. */
  readonly renderScale: number;
}

export interface ImageHooks {
  readonly onAssetError?: (nodeId: string, src: string) => void;
  readonly onUnsupported?: (nodeId: string, reason: string) => void;
  /** Called when the bitmap has decoded and the scene needs redrawing. */
  readonly onDecoded?: (nodeId: string) => void;
}

/**
 * Builds the image object for a node, with its pixels still in flight.
 *
 * Returns `undefined` only when the document declares no resolvable asset, in
 * which case there is nothing to draw and `plan.ts` has already reported an
 * `unresolved-asset` issue. Drawing nothing is deliberate: the alternative is
 * the browser's broken-image glyph, which reads as a rendering failure rather
 * than a missing file.
 */
export function buildImage(
  node: PlanNode,
  box: PlanBox,
  options: ImageOptions,
  hooks: ImageHooks,
): FabricImage | undefined {
  if (node.content.kind !== 'image') {
    throw new Error('buildImage received a non-image node.');
  }

  const src = node.content.src;

  if (src === undefined) {
    return undefined;
  }

  if (node.content.monochrome !== undefined) {
    hooks.onUnsupported?.(
      node.id,
      'a monochrome image needs an offscreen composite on canvas (stage 7); the artwork is drawn unflattened',
    );
  }

  const element = document.createElement('img');
  // Decorative: the document has no alt-text field, and inventing one from a
  // layer label would put a designer's note into the accessibility tree. The
  // element is never in the document anyway — it is a pixel source.
  element.alt = '';

  const object = new FabricImage(element, { originX: 'center', originY: 'center' });
  const fit = node.content.fit;

  placeImage(object, node, box, fit);

  const vector = node.content.assetKind === 'svg';

  element.addEventListener('load', () => {
    // `setElement` is what recomputes `width`/`height` from the decoded
    // source; without it the object keeps the natural size it had before the
    // pixels arrived, which is zero.
    object.setElement(vector ? rasterise(element, box, options.renderScale) : element);
    placeImage(object, node, box, fit);
    object.set('dirty', true);
    hooks.onDecoded?.(node.id);
  });

  element.addEventListener('error', () => {
    // Declared by the document, absent from what the server actually serves.
    // This cannot be a plan issue: a declared asset with a valid path always
    // resolves, so only the network knows.
    hooks.onAssetError?.(node.id, src);
  });

  element.src = src;

  return object;
}

/**
 * Draws a vector source into a canvas Fabric can crop.
 *
 * The **five**-argument `drawImage` — no source rectangle — because that is the
 * form Chrome honours for an SVG with no intrinsic size. The raster is sized to
 * the authored box times the device oversample, capped by `clampRenderScale`,
 * which is the same ceiling a chart's backing canvas is held to: `w x h x
 * scale²` is not bounded by a factor alone.
 */
function rasterise(
  element: HTMLImageElement,
  box: PlanBox,
  renderScale: number,
): HTMLCanvasElement {
  const width = Math.max(1, Math.round(box.width));
  const height = Math.max(1, Math.round(box.height));
  const scale = clampRenderScale(renderScale, width, height);
  const canvas = document.createElement('canvas');

  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext('2d');

  if (context !== null) {
    context.drawImage(element, 0, 0, canvas.width, canvas.height);
  }

  return canvas;
}

/** Positions and scales an image into its authored box. */
export function placeImage(
  image: FabricImage,
  node: PlanNode,
  box: PlanBox,
  fit: 'contain' | 'cover' | 'stretch',
): void {
  const placement = placementFor(box);

  image.set({
    ...paintFor(node.style, 'box'),
    originX: 'center',
    originY: 'center',
    left: placement.left,
    top: placement.top,
    angle: placement.angle,
    visible: node.visible,
  });

  fitImage(image, box, fit, placement.scaleX, placement.scaleY);
  image.setCoords();
}

function fitImage(
  image: FabricImage,
  box: PlanBox,
  fit: 'contain' | 'cover' | 'stretch',
  scaleX: number,
  scaleY: number,
): void {
  const naturalWidth = image.width;
  const naturalHeight = image.height;

  if (!(naturalWidth > 0) || !(naturalHeight > 0)) {
    // Not decoded yet. Scaling by zero would be a division, and there is
    // nothing to draw until the bitmap lands.
    return;
  }

  const ratioX = box.width / naturalWidth;
  const ratioY = box.height / naturalHeight;

  if (fit === 'stretch') {
    // The one mode that distorts, and the one the author has to ask for.
    image.set({ scaleX: ratioX * scaleX, scaleY: ratioY * scaleY, clipPath: undefined });

    return;
  }

  const ratio = fit === 'cover' ? Math.max(ratioX, ratioY) : Math.min(ratioX, ratioY);

  image.set({ scaleX: ratio * scaleX, scaleY: ratio * scaleY });

  if (fit !== 'cover') {
    image.set('clipPath', undefined);

    return;
  }

  // In the image's own space, so it rotates and scales with the image. A
  // non-absolute clip path is measured in unscaled object pixels, which is why
  // the box is divided by the ratio rather than used directly.
  image.set(
    'clipPath',
    new Rect({
      width: box.width / ratio,
      height: box.height / ratio,
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 0,
    }),
  );
}
