import type {
  Artboard,
  AssetReference,
  BackgroundMediaFit,
} from "@yunari/renderer-core";
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
type BackgroundMediaUpdate = Omit<BackgroundMediaOptions, "host" | "onFrame">;

/** A box in host pixels: where a media layer sits and how large it is. */
export interface MediaBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** The two boxes a media layer can be sized to. */
export interface MediaBounds {
  readonly artboard: MediaBox;
  readonly display: MediaBox;
}

export interface PlacementInput {
  readonly box: { readonly width: number; readonly height: number };
  readonly source:
    | { readonly width: number; readonly height: number }
    | undefined;
  readonly fit: BackgroundMediaFit;
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

/** Finite, non-negative. A refused reading leaves nothing to draw. */
const size = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

/**
 * The one media placement: fit the source into the box, scale about the box
 * centre, then shift by a fraction of the box. The result may extend outside
 * the box; the box is the caller's clip.
 */
export function placement(input: PlacementInput): MediaBox {
  const boxWidth = size(input.box.width);
  const boxHeight = size(input.box.height);
  const sourceWidth = input.source === undefined ? 0 : size(input.source.width);
  const sourceHeight =
    input.source === undefined ? 0 : size(input.source.height);

  // No source size yet, and `fill` either way, mean the box is the base rect.
  let baseWidth = boxWidth;
  let baseHeight = boxHeight;
  if (input.fit !== "fill" && sourceWidth > 0 && sourceHeight > 0) {
    const x = boxWidth / sourceWidth;
    const y = boxHeight / sourceHeight;
    const factor = input.fit === "contain" ? Math.min(x, y) : Math.max(x, y);
    baseWidth = sourceWidth * factor;
    baseHeight = sourceHeight * factor;
  }

  const scale = Number.isFinite(input.scale) ? input.scale : 1;
  const offsetX = Number.isFinite(input.offsetX) ? input.offsetX : 0;
  const offsetY = Number.isFinite(input.offsetY) ? input.offsetY : 0;
  const width = size(baseWidth * scale);
  const height = size(baseHeight * scale);
  return {
    left: (boxWidth * (1 + 2 * offsetX)) / 2 - width / 2,
    top: (boxHeight * (1 + 2 * offsetY)) / 2 - height / 2,
    width,
    height,
  };
}

export interface BackgroundMediaHandle {
  update(options: BackgroundMediaUpdate): void;
  setBounds(bounds: MediaBounds): void;
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
  layer.dataset["yunariBackgroundMedia"] = "";
  layer.style.cssText =
    "position:absolute;inset:0;overflow:hidden;pointer-events:none;";
  options.host.prepend(layer);
  let disposeSource: (() => void) | undefined;
  let stopFrames: (() => void) | undefined;
  let stopDecoded: (() => void) | undefined;
  let element: HTMLImageElement | HTMLVideoElement | undefined;
  let fit: "theme" | "display" = "theme";
  let artboardSize = { width: 0, height: 0 };
  let bounds: MediaBounds | undefined;
  const onFrame = options.onFrame;

  /** The layer sits on one of the two boxes; both fill it with `cover`. */
  const place = (): void => {
    const box = fit === "display" ? bounds?.display : bounds?.artboard;
    if (box === undefined) return;
    layer.style.left = `${box.left}px`;
    layer.style.top = `${box.top}px`;
    layer.style.right = "";
    layer.style.bottom = "";
    layer.style.width = `${box.width}px`;
    layer.style.height = `${box.height}px`;
  };

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
    mounted.style.cssText =
      "display:block;width:100%;height:100%;object-fit:cover;";
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
    place();
  };

  update(options);
  return {
    update,
    setBounds(next) {
      bounds = next;
      place();
    },
    backdrop(): BackdropMedia | undefined {
      const mounted = element;
      if (mounted === undefined) return undefined;
      // The rect the layer covers, in artboard units. A display-filled layer
      // covers more than the artboard and may start outside it, so the glass
      // sampler is told the rect actually painted, not the board's own.
      const scale =
        bounds === undefined ? 0 : bounds.artboard.width / artboardSize.width;
      const rect =
        fit === "display" &&
        bounds !== undefined &&
        scale > 0 &&
        Number.isFinite(scale)
          ? {
              left: (bounds.display.left - bounds.artboard.left) / scale,
              top: (bounds.display.top - bounds.artboard.top) / scale,
              width: bounds.display.width / scale,
              height: bounds.display.height / scale,
            }
          : {
              left: 0,
              top: 0,
              width: artboardSize.width,
              height: artboardSize.height,
            };
      return {
        rect,
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
 * The nine `drawImage` arguments that reproduce the element's `object-fit: cover`
 * over a device-space region, offset by where the media layer actually sits.
 * `object-fit` is a CSS layout decision that `drawImage` does not apply, and
 * `object-position` is never authored, so the crop stays centred.
 *
 * The crop belongs on the **source** and the scale on the **destination**:
 * `cover` takes the source rect whose aspect matches the device rect and lets
 * `drawImage` scale it into the whole of it. Taking a source window sized by
 * the *device* rect and drawing it 1:1 instead would show a pixel-for-pixel crop
 * of the middle of the file — a different picture from the element's at every
 * scale but the one where the artboard's device rect is the file's own size
 * (0012).
 */
export function mediaDrawArgs(input: {
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly deviceLeft: number;
  readonly deviceTop: number;
  readonly deviceWidth: number;
  readonly deviceHeight: number;
  readonly region: DeviceRect;
}): readonly [number, number, number, number, number, number, number, number] {
  const { sourceWidth, sourceHeight, deviceWidth, deviceHeight } = input;
  const left = input.deviceLeft - input.region.left;
  const top = input.deviceTop - input.region.top;
  // Cover: the largest source rect of the device rect's aspect, centred.
  const cropWidth = Math.min(
    sourceWidth,
    (sourceHeight * deviceWidth) / deviceHeight,
  );
  const cropHeight = Math.min(
    sourceHeight,
    (sourceWidth * deviceHeight) / deviceWidth,
  );
  return [
    (sourceWidth - cropWidth) / 2,
    (sourceHeight - cropHeight) / 2,
    cropWidth,
    cropHeight,
    left,
    top,
    deviceWidth,
    deviceHeight,
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
