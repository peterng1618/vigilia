import {
  type Artboard,
  type ArtboardTransform,
  type AssetReference,
  computeArtboardTransform,
  type SceneHandle,
  type ScenePlan,
} from "@vigilia/renderer-core";
import { StaticCanvas } from "fabric/es";
import {
  createSceneAdapter,
  type SceneAdapter,
  type SceneAdapterOptions,
} from "./adapter.js";
import { cssArtboardPaint } from "./artboard-paint.js";
import {
  type BackgroundMediaSource,
  mountBackgroundMedia,
} from "./background-media.js";
import { clampRenderScale } from "./render-scale.js";

/**
 * Owns the canvas element, viewport/artboard fit and DPR. `adapter.ts` owns plan
 * reconciliation. Detached charts receive artboard scale × Fabric retina scale.
 */

export interface FabricSceneOptions
  extends Omit<SceneAdapterOptions, "canvas"> {
  readonly host: HTMLElement;
  readonly plan: ScenePlan;
  readonly artboard?: Artboard;
  readonly assets?: readonly AssetReference[];
  readonly resolveAsset?: (
    assetId: string,
  ) => BackgroundMediaSource | undefined;
  /** Reports an unresolvable declared background; distinct from the adapter's
   * per-node `onAssetError`. */
  readonly onMediaError?: (message: string) => void;
}

export interface FabricSceneHandle extends SceneHandle {
  readonly canvas: StaticCanvas;
  readonly adapter: SceneAdapter;
  /**
   * `ScenePlan` never carries `backgroundMedia`, so a document-level artboard
   * change cannot travel through `update()`.
   */
  updateArtboard(artboard: Artboard): void;
}

export function mountFabricScene(
  options: FabricSceneOptions,
): FabricSceneHandle {
  const { host } = options;
  let plan = options.plan;

  host.textContent = "";
  host.style.overflow = "hidden";

  // Preserve hosts already positioned by their own layout.
  if (getComputedStyle(host).position === "static") {
    host.style.position = "relative";
  }

  const element = document.createElement("canvas");
  element.dataset["vigilia"] = "artboard";
  element.style.position = "absolute";
  element.style.top = "0";
  element.style.left = "0";
  host.append(element);

  const canvas = new StaticCanvas(element, {
    width: Math.max(1, host.clientWidth),
    height: Math.max(1, host.clientHeight),
    renderOnAddRemove: false,
  });

  const adapter = createSceneAdapter({
    canvas,
    ...withoutHostAndPlan(options),
  });
  let currentArtboard = options.artboard;
  const media =
    options.resolveAsset === undefined || currentArtboard === undefined
      ? undefined
      : mountBackgroundMedia({
          host,
          artboard: currentArtboard,
          assets: options.assets,
          resolveAsset: options.resolveAsset,
          ...(options.onMediaError === undefined
            ? {}
            : { onMediaError: options.onMediaError }),
        });

  let currentTransform = fit();

  function fit(): ArtboardTransform {
    const transform = computeArtboardTransform({
      artboard: { width: plan.artboard.width, height: plan.artboard.height },
      viewport: { width: host.clientWidth, height: host.clientHeight },
      fitMode: plan.artboard.fitMode,
    });

    // Letterbox bars are host background, not artboard paint (§53).
    host.style.background = cssArtboardPaint(plan.artboard.barColor) ?? "#000";
    element.style.visibility = transform.isDegenerate ? "hidden" : "visible";
    if (!transform.isDegenerate)
      media?.setBounds({
        left: transform.offsetX,
        top: transform.offsetY,
        width: plan.artboard.width * transform.scale,
        height: plan.artboard.height * transform.scale,
      });

    if (transform.isDegenerate) {
      return transform;
    }

    canvas.setDimensions({
      width: Math.max(1, host.clientWidth),
      height: Math.max(1, host.clientHeight),
    });

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

    updateArtboard(artboard: Artboard): void {
      currentArtboard = artboard;
      if (media === undefined || options.resolveAsset === undefined) return;
      media.update({
        artboard,
        assets: options.assets,
        resolveAsset: options.resolveAsset,
      });
    },

    resize(): void {
      currentTransform = fit();
      canvas.requestRenderAll();
    },

    dispose(): void {
      adapter.dispose();
      media?.destroy();
      // `destroy()` also disposes remaining Fabric objects.
      void canvas.destroy();
      host.textContent = "";
    },
  };
}
/** Forward adapter options explicitly so scene-only options cannot leak through later. */
function withoutHostAndPlan(
  options: FabricSceneOptions,
): Omit<SceneAdapterOptions, "canvas"> {
  return {
    ...(options.renderScale === undefined
      ? {}
      : { renderScale: options.renderScale }),
    ...(options.onAssetError === undefined
      ? {}
      : { onAssetError: options.onAssetError }),
    ...(options.onUnsupported === undefined
      ? {}
      : { onUnsupported: options.onUnsupported }),
  };
}
