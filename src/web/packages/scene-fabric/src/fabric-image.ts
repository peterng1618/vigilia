import { FabricImage, Rect } from 'fabric/es';
import type { PlanBox, PlanNode } from '@vigilia/renderer-core';
import { paintFor } from './paint.js';
import { placementFor } from './placement.js';
import { clampRenderScale } from './render-scale.js';

/**
 * Image object exists synchronously; decoded pixels arrive through `setElement`.
 * Fabric image width/height are natural source dimensions, so fitting uses scale.
 * SVGs are rasterised first because Chrome fails Fabric's source-rect draw path
 * for viewBox-only SVGs.
 */

export interface ImageOptions {
  readonly renderScale: number;
}

export interface ImageHooks {
  readonly onAssetError?: (nodeId: string, src: string) => void;
  readonly onUnsupported?: (nodeId: string, reason: string) => void;
  readonly onDecoded?: (nodeId: string) => void;
}

/** Build an unloaded image object; undefined means no resolvable source. */
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
  element.alt = '';

  const object = new FabricImage(element, { originX: 'center', originY: 'center' });
  const fit = node.content.fit;

  placeImage(object, node, box, fit);

  const vector = node.content.assetKind === 'svg';

  element.addEventListener('load', () => {
    object.setElement(vector ? rasterise(element, box, options.renderScale) : element);
    placeImage(object, node, box, fit);
    object.set('dirty', true);
    hooks.onDecoded?.(node.id);
  });

  element.addEventListener('error', () => {
    hooks.onAssetError?.(node.id, src);
  });

  element.src = src;

  return object;
}

/** Rasterise SVG with the drawImage form Chrome handles for viewBox-only sources. */
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
    return;
  }

  const ratioX = box.width / naturalWidth;
  const ratioY = box.height / naturalHeight;

  if (fit === 'stretch') {
    image.set({ scaleX: ratioX * scaleX, scaleY: ratioY * scaleY, clipPath: undefined });

    return;
  }

  const ratio = fit === 'cover' ? Math.max(ratioX, ratioY) : Math.min(ratioX, ratioY);

  image.set({ scaleX: ratio * scaleX, scaleY: ratio * scaleY });

  if (fit !== 'cover') {
    image.set('clipPath', undefined);

    return;
  }

  // Non-absolute clip paths use unscaled image-local units.
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
