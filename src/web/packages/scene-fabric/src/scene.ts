import { StaticCanvas } from 'fabric/es';
import {
  computeArtboardTransform,
  type ArtboardTransform,
  type ScenePlan,
  type SceneHandle,
} from '@vigilia/renderer-core';
import { createSceneAdapter, type SceneAdapter, type SceneAdapterOptions } from './adapter.js';
import { clampRenderScale } from './render-scale.js';

/**
 * Mounts a scene on a `StaticCanvas` and keeps it fitted to its host.
 *
 * Everything here is about the *element*: its size, the artboard transform and
 * the device pixel ratio. `adapter.ts` owns everything about the *plan*. The
 * split is the same one `mount.ts` and `plan.ts` have, one layer down.
 *
 * ## §51 becomes one matrix instead of one CSS transform
 *
 * `mount.ts` put `translate() scale()` on a wrapper div and let the browser
 * scale a DOM subtree. Here the identical numbers become the canvas'
 * `viewportTransform`, which is the same uniform mapping applied to everything
 * drawn — so strokes, glyphs and shadows still scale together and nothing
 * reflows (§57). `computeArtboardTransform` is unchanged and still owns §51,
 * §53 and §55; this file only chooses where to put its output.
 *
 * The transform is **not** the adapter's business, because it depends on the
 * viewport and the adapter is shared with the editor, whose viewport is its own
 * affair.
 *
 * ## Device pixels reach the charts, which is not automatic
 *
 * Fabric's `enableRetinaScaling` sizes its *own* backing store by the device
 * pixel ratio. A chart draws into a **detached** canvas that Fabric knows
 * nothing about, so its resolution has to be set deliberately: the factor is
 * the artboard scale times the retina scaling, which is exactly how many real
 * pixels one artboard pixel occupies. Without it a chart on a phone is a
 * sharp scene containing one blurry rectangle.
 */

export interface FabricSceneOptions extends Omit<SceneAdapterOptions, 'canvas'> {
  /** Where the scene is mounted. Emptied first, like `mountScene`'s host. */
  readonly host: HTMLElement;
  readonly plan: ScenePlan;
}

/** A `SceneHandle` plus the canvas, for the editor and for tests. */
export interface FabricSceneHandle extends SceneHandle {
  readonly canvas: StaticCanvas;
  readonly adapter: SceneAdapter;
}

export function mountFabricScene(options: FabricSceneOptions): FabricSceneHandle {
  const { host } = options;
  let plan = options.plan;

  host.textContent = '';
  // The host clips the scene: in `cover` mode the design is larger than the
  // viewport by design, and without this it would spill onto the page.
  host.style.overflow = 'hidden';

  // Only when the host is not already positioned. Writing `relative`
  // unconditionally overrode a host styled `position: absolute; inset: 0`,
  // which collapsed its height to zero and hid the whole scene — a lesson
  // `mount.ts` records and this inherits by sharing the host contract.
  if (getComputedStyle(host).position === 'static') {
    host.style.position = 'relative';
  }

  const element = document.createElement('canvas');
  element.dataset['vigilia'] = 'artboard';
  element.style.position = 'absolute';
  element.style.top = '0';
  element.style.left = '0';
  host.append(element);

  const canvas = new StaticCanvas(element, {
    width: Math.max(1, host.clientWidth),
    height: Math.max(1, host.clientHeight),
    // The adapter batches with `requestRenderAll`, so rendering on every add
    // would repaint the whole scene once per object while mounting it.
    renderOnAddRemove: false,
  });

  const adapter = createSceneAdapter({ canvas, ...withoutHostAndPlan(options) });

  let currentTransform = fit();

  function fit(): ArtboardTransform {
    const transform = computeArtboardTransform({
      artboard: { width: plan.artboard.width, height: plan.artboard.height },
      viewport: { width: host.clientWidth, height: host.clientHeight },
      fitMode: plan.artboard.fitMode,
    });

    // §53: the bars are the *host's* background, not the artboard's — they are
    // what shows where the design is not.
    host.style.background = asCss(plan.artboard.barColor) ?? '#000';

    // A degenerate transform means no visible area — a hidden element, or a
    // phone mid-rotation. Nothing to draw, and a canvas must not be sized to
    // zero, so the element is hidden and left at its last size (§124).
    element.style.visibility = transform.isDegenerate ? 'hidden' : 'visible';

    if (transform.isDegenerate) {
      return transform;
    }

    canvas.setDimensions({
      width: Math.max(1, host.clientWidth),
      height: Math.max(1, host.clientHeight),
    });

    // The whole of §51, as four numbers and two offsets. Fabric's matrix is
    // [scaleX, skewY, skewX, scaleY, translateX, translateY]; the scale is
    // uniform because a split one would distort strokes and glyphs.
    canvas.setViewportTransform([
      transform.scale,
      0,
      0,
      transform.scale,
      transform.offsetX,
      transform.offsetY,
    ]);

    adapter.setRenderScale(
      clampRenderScale(transform.scale * canvas.getRetinaScaling(), 1, 1),
    );

    return transform;
  }

  adapter.apply(plan);
  canvas.requestRenderAll();

  return {
    canvas,
    adapter,
    artboard: element,

    transform(): ArtboardTransform {
      return currentTransform;
    },

    update(next: ScenePlan): void {
      plan = next;
      currentTransform = fit();
      adapter.apply(next);
    },

    resize(): void {
      currentTransform = fit();
      canvas.requestRenderAll();
    },

    dispose(): void {
      adapter.dispose();
      // `destroy`, not `dispose`: it calls `dispose()` on every remaining
      // object as well as tearing down the element
      // (`StaticCanvas.ts:1473`).
      void canvas.destroy();
      host.textContent = '';
    },
  };
}

/**
 * The adapter's own options, without the two that belong to this layer.
 *
 * Written out rather than spread wholesale so adding an option to
 * {@link FabricSceneOptions} cannot silently start forwarding it.
 */
function withoutHostAndPlan(options: FabricSceneOptions): Omit<SceneAdapterOptions, 'canvas'> {
  return {
    ...(options.renderScale === undefined ? {} : { renderScale: options.renderScale }),
    ...(options.onAssetError === undefined ? {} : { onAssetError: options.onAssetError }),
    ...(options.onUnsupported === undefined ? {} : { onUnsupported: options.onUnsupported }),
  };
}

function asCss(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
