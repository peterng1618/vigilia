import type { Artboard, AssetReference } from "@vigilia/renderer-core";
import type { BackdropMedia, DeviceRect } from "./glass.js";

export interface BackgroundMediaSource {
  readonly url: string;
  readonly dispose?: () => void;
}

export interface BackgroundMediaOptions {
  readonly host: HTMLElement;
  readonly artboard: Artboard;
  readonly assets: readonly AssetReference[] | undefined;
  readonly resolveAsset: (assetId: string) => BackgroundMediaSource | undefined;
  /** A declared background that cannot be resolved is reported, never silently
   * dropped. Distinct from `SceneAdapterOptions.onAssetError`, which reports a
   * node's own asset by id; this one carries a human-readable reason. */
  readonly onMediaError?: (message: string) => void;
  /** Called once per decoded video frame. Subscribed once, at mount, and
   *  re-armed on every later `update()`: making it per-update let a caller
   *  silently stop following frames by omitting it. Nothing subscribes unless a
   *  video is the media, so an image background starts no loop at all. */
  readonly onFrame?: () => void;
}

/** Reconfiguration carries the document, never the frame subscription. */
export type BackgroundMediaUpdate = Omit<
  BackgroundMediaOptions,
  "host" | "onFrame"
>;

export interface BackgroundMediaHandle {
  update(options: BackgroundMediaUpdate): void;
  setBounds(bounds: {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
  }): void;
  /** Pixel access for the glass sampler, or undefined with nothing to sample.
   *  The media is a DOM sibling below the canvas, so a glass panel cannot read
   *  it out of the canvas it is painting. */
  backdrop(): BackdropMedia | undefined;
  destroy(): void;
}

/** Mounts the optional DOM-only artboard background below the caller's canvas. */
export function mountBackgroundMedia(
  options: BackgroundMediaOptions,
): BackgroundMediaHandle {
  const layer = document.createElement("div");
  layer.dataset["vigiliaBackgroundMedia"] = "";
  layer.style.cssText =
    "position:absolute;inset:0;overflow:hidden;pointer-events:none;";
  options.host.prepend(layer);
  let disposeSource: (() => void) | undefined;
  let stopFrames: (() => void) | undefined;
  let stopDecoded: (() => void) | undefined;
  let element: HTMLImageElement | HTMLVideoElement | undefined;
  let fit: "cover" | "contain" = "cover";
  let artboardSize = { width: 0, height: 0 };
  const onFrame = options.onFrame;

  const stop = (): void => {
    disposeSource?.();
    disposeSource = undefined;
    stopFrames?.();
    stopFrames = undefined;
    stopDecoded?.();
    stopDecoded = undefined;
  };

  const update = (next: BackgroundMediaUpdate): void => {
    stop();
    layer.replaceChildren();
    element = undefined;
    const media = next.artboard.backgroundMedia;
    artboardSize = { width: next.artboard.width, height: next.artboard.height };
    const asset = next.assets?.find(
      (candidate) => candidate.id === media?.assetId,
    );
    if (media === undefined) return;
    if (asset === undefined) {
      next.onMediaError?.(
        `Background media asset "${media.assetId}" is not declared by this theme.`,
      );
      return;
    }
    if (!isBackgroundAsset(asset)) {
      next.onMediaError?.(
        `Background media asset "${asset.id}" is a ${asset.kind}, which cannot be a background.`,
      );
      return;
    }
    const source = next.resolveAsset(asset.id);
    if (source === undefined) {
      next.onMediaError?.(
        `Background media asset "${asset.id}" has no readable bytes.`,
      );
      return;
    }

    const mounted =
      asset.kind === "video"
        ? document.createElement("video")
        : document.createElement("img");
    mounted.src = source.url;
    mounted.style.cssText = `display:block;width:100%;height:100%;object-fit:${media.fit};`;
    if (mounted instanceof HTMLVideoElement) {
      mounted.autoplay = true;
      mounted.muted = true;
      mounted.loop = true;
      mounted.playsInline = true;
    }
    disposeSource = source.dispose;
    fit = media.fit;
    element = mounted;
    layer.append(mounted);
    stopFrames = followFrames(mounted, onFrame);
    stopDecoded = notifyOnDecode(mounted, onFrame);
  };

  update(options);
  return {
    update,
    setBounds(next) {
      layer.style.left = `${next.left}px`;
      layer.style.top = `${next.top}px`;
      layer.style.right = "";
      layer.style.bottom = "";
      layer.style.width = `${next.width}px`;
      layer.style.height = `${next.height}px`;
    },
    backdrop(): BackdropMedia | undefined {
      const mounted = element;
      if (mounted === undefined) return undefined;
      return {
        artboard: artboardSize,
        paint(ctx, region, device) {
          const source = intrinsic(mounted);
          if (source === undefined) return false;
          // A source with no intrinsic size — an SVG authored without width or
          // height — has no ratio to preserve, which is what the element does
          // too; the box stands in for the source so nothing is cropped.
          const [width, height] =
            source.width > 0 && source.height > 0
              ? [source.width, source.height]
              : [device.width, device.height];
          ctx.drawImage(
            mounted,
            ...mediaDrawArgs({
              sourceWidth: width,
              sourceHeight: height,
              fit,
              deviceLeft: device.left,
              deviceTop: device.top,
              deviceWidth: device.width,
              deviceHeight: device.height,
              region,
            }),
          );
          return true;
        },
      };
    },
    destroy() {
      stop();
      element = undefined;
      layer.remove();
    },
  };
}

/**
 * The nine `drawImage` arguments that reproduce the element's `object-fit` over
 * a device-space region, offset by where the media layer actually sits.
 * `object-fit` is a CSS layout decision that `drawImage` does not apply, and
 * `object-position` is never authored, so the crop stays centred.
 */
export function mediaDrawArgs(input: {
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly fit: "cover" | "contain";
  readonly deviceLeft: number;
  readonly deviceTop: number;
  readonly deviceWidth: number;
  readonly deviceHeight: number;
  readonly region: DeviceRect;
}): readonly [number, number, number, number, number, number, number, number] {
  const { sourceWidth, sourceHeight, deviceWidth, deviceHeight } = input;
  const scale =
    input.fit === "cover"
      ? Math.max(deviceWidth / sourceWidth, deviceHeight / sourceHeight)
      : Math.min(deviceWidth / sourceWidth, deviceHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return [
    (sourceWidth - width) / 2,
    (sourceHeight - height) / 2,
    width,
    height,
    input.deviceLeft - input.region.left + (deviceWidth - width) / 2,
    input.deviceTop - input.region.top + (deviceHeight - height) / 2,
    width,
    height,
  ];
}

/**
 * Fabric cannot see a `<video>` that is a DOM sibling rather than an object, so
 * nothing repaints and the glass keeps a still frame of a moving background.
 * Repainting on the video's own cadence is the fix; on its own it is a loop.
 */
function followFrames(
  element: HTMLImageElement | HTMLVideoElement,
  onFrame: (() => void) | undefined,
): (() => void) | undefined {
  if (!(element instanceof HTMLVideoElement) || onFrame === undefined) return;
  if (typeof element.requestVideoFrameCallback !== "function") return;
  let live = true;
  const step = (): void => {
    if (!live) return;
    onFrame();
    pending = element.requestVideoFrameCallback(step);
  };
  let pending = element.requestVideoFrameCallback(step);
  return () => {
    live = false;
    element.cancelVideoFrameCallback(pending);
  };
}

/**
 * A still image's bytes land after the first paint, and until they do a glass
 * panel sampling this layer has nothing to sample - it keeps the empty
 * backdrop it took, because a DOM sibling is invisible to Fabric and nothing
 * else in the scene changes to trigger a repaint. One notification when the
 * decode lands, which is not a loop.
 */
function notifyOnDecode(
  element: HTMLImageElement | HTMLVideoElement,
  onFrame: (() => void) | undefined,
): (() => void) | undefined {
  if (onFrame === undefined) return undefined;
  // A video's first frame is the first `requestVideoFrameCallback`, so it is
  // already covered and must not ask twice.
  if (element instanceof HTMLVideoElement) return undefined;
  const onLoad = (): void => {
    element.removeEventListener("load", onLoad);
    onFrame();
  };
  element.addEventListener("load", onLoad);
  return () => {
    element.removeEventListener("load", onLoad);
  };
}

/** The decoded pixels, or undefined while there are none to draw. */
function intrinsic(
  element: HTMLImageElement | HTMLVideoElement,
): { readonly width: number; readonly height: number } | undefined {
  if (element instanceof HTMLVideoElement) {
    if (element.readyState < 2) return undefined;
    return { width: element.videoWidth, height: element.videoHeight };
  }
  if (!element.complete || element.naturalWidth === 0) return undefined;
  return { width: element.naturalWidth, height: element.naturalHeight };
}

function isBackgroundAsset(
  asset: AssetReference,
): asset is AssetReference & { readonly kind: "image" | "svg" | "video" } {
  return (
    asset.kind === "image" || asset.kind === "svg" || asset.kind === "video"
  );
}
