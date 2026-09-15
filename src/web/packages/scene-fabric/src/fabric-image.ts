import { FabricImage, Rect } from 'fabric/es';
import type { PlanBox, PlanNode } from '@vigilia/renderer-core';
import { paintFor } from './paint.js';
import { placementFor } from './placement.js';

/**
 * An image asset as a Fabric object.
 *
 * ## It arrives after the frame that asked for it
 *
 * `FabricImage` needs a decoded element, so there is nothing to place until the
 * network answers — unlike every other kind, which is synchronous. The caller
 * is told through a callback, and that callback is also what restores z-order:
 * an image that loads second must not end up on top of one that loaded first.
 *
 * The caller must also not start a second load while the first is in flight,
 * because the plan is rebuilt every frame and a 1 Hz tick would otherwise open
 * one request per second per image. `adapter.ts` holds that guard.
 *
 * ## Fitting is scale, never width and height
 *
 * A Fabric image's `width`/`height` are its **natural** size; writing the box's
 * size into them would crop the source rather than fit it. So every mode is
 * expressed as a scale, and `cover` additionally clips — filling a box means
 * overflowing it on one axis, and nothing else would stop that spilling over
 * the neighbouring nodes.
 *
 * ## §111's monochrome is not implemented here
 *
 * `mount.ts` flattens artwork to one colour with a CSS mask, which uses only
 * the source's alpha. The canvas equivalent needs an offscreen composite and
 * therefore a custom object, like `VigiliaChart` — stage 7's work. Until then
 * the artwork is drawn unflattened and the gap is reported: an icon in the
 * wrong colours is still legible, and an absent one is not.
 */

export interface ImageHooks {
  readonly onReady: (nodeId: string, image: FabricImage) => void;
  readonly onAssetError?: (nodeId: string, src: string) => void;
  readonly onUnsupported?: (nodeId: string, reason: string) => void;
}

/**
 * Starts loading a node's image.
 *
 * Returns whether a load was started, so the caller knows whether to hold the
 * in-flight guard.
 */
export function beginImage(node: PlanNode, box: PlanBox, hooks: ImageHooks): boolean {
  if (node.content.kind !== 'image') {
    return false;
  }

  const src = node.content.src;

  if (src === undefined) {
    // Already reported as an `unresolved-asset` plan issue, and drawing nothing
    // is deliberate: the alternative is the browser's broken-image glyph, which
    // reads as a rendering failure rather than a missing file.
    return false;
  }

  if (node.content.monochrome !== undefined) {
    hooks.onUnsupported?.(
      node.id,
      'a monochrome image needs an offscreen composite on canvas (stage 7); the artwork is drawn unflattened',
    );
  }

  const fit = node.content.fit;

  void FabricImage.fromURL(src)
    .then((image) => {
      placeImage(image, node, box, fit);
      hooks.onReady(node.id, image);
    })
    .catch(() => {
      // Declared by the document, absent from what the server actually serves.
      // This cannot be a plan issue: a declared asset with a valid path always
      // resolves, so only the network knows.
      hooks.onAssetError?.(node.id, src);
    });

  return true;
}

/** Positions and scales a loaded image into its authored box. */
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
  image.set('id', node.id);
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
