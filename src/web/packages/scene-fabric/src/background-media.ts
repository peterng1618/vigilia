import {
  type AssetReference,
  BACKGROUND_MEDIA_DEFAULTS,
  type Background,
  type BackgroundMedia,
  type BackgroundMediaFit,
} from "@yunari/renderer-core";
import type { BackdropMedia } from "./glass.js";

export interface BackgroundMediaSource {
  readonly url: string;
  readonly dispose?: () => void;
}

export interface BackgroundMediaOptions {
  readonly host: HTMLElement;
  readonly background: Background | undefined;
  readonly artboard: { readonly width: number; readonly height: number };
  readonly assets: readonly AssetReference[] | undefined;
  readonly resolveAsset: (assetId: string) => BackgroundMediaSource | undefined;
  /** A declared background that cannot be resolved is reported, never silently
   * dropped. Distinct from `SceneAdapterOptions.onAssetError`, which reports a
   * node's own asset by id; this one carries a human-readable reason. */
  readonly onMediaError?: (message: string) => void;
  /** Called once per decoded video frame. Subscribed once, at mount, and kept
   *  across a re-placement: making it per-update let a caller silently stop
   *  following frames by omitting it. Nothing subscribes unless a video is the
   *  media, so an image background starts no loop at all. */
  readonly onFrame?: () => void;
}

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
  /** Reconfigures the layer. Same asset re-places the mounted element; a
   *  different asset (or none) tears it down and mounts afresh, because a
   *  remount is what restarts a video. */
  setBackground(background: Background | undefined): void;
  setArtboardSize(size: {
    readonly width: number;
    readonly height: number;
  }): void;
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
  const { assets, resolveAsset, onMediaError, onFrame } = options;
  let background = options.background;
  let artboardSize = {
    width: options.artboard.width,
    height: options.artboard.height,
  };
  let bounds: MediaBounds | undefined;
  let element: HTMLImageElement | HTMLVideoElement | undefined;
  let mountedAssetId: string | undefined;
  let disposeSource: (() => void) | undefined;
  let stopFrames: (() => void) | undefined;
  let stopDecoded: (() => void) | undefined;
  let stopIntrinsic: (() => void) | undefined;

  /**
   * The layer is the clip: one of the two bounds boxes. The child is placed
   * inside it by `placement`, which may extend past the clip on purpose.
   */
  const place = (): void => {
    const media = background?.media;
    const box =
      media?.bounds === "display" ? bounds?.display : bounds?.artboard;
    if (box === undefined) return;
    layer.style.left = `${box.left}px`;
    layer.style.top = `${box.top}px`;
    layer.style.right = "";
    layer.style.bottom = "";
    layer.style.width = `${box.width}px`;
    layer.style.height = `${box.height}px`;
    const child = element;
    if (child === undefined || media === undefined) return;
    const rect = placement({
      box: { width: box.width, height: box.height },
      source: intrinsic(child),
      fit: media.fit ?? BACKGROUND_MEDIA_DEFAULTS.fit,
      scale: media.scale ?? BACKGROUND_MEDIA_DEFAULTS.scale,
      offsetX: media.offsetX ?? BACKGROUND_MEDIA_DEFAULTS.offsetX,
      offsetY: media.offsetY ?? BACKGROUND_MEDIA_DEFAULTS.offsetY,
    });
    child.style.left = `${rect.left}px`;
    child.style.top = `${rect.top}px`;
    child.style.width = `${rect.width}px`;
    child.style.height = `${rect.height}px`;
  };

  const stop = (): void => {
    disposeSource?.();
    disposeSource = undefined;
    stopFrames?.();
    stopFrames = undefined;
    stopDecoded?.();
    stopDecoded = undefined;
    stopIntrinsic?.();
    stopIntrinsic = undefined;
  };

  /** Resolves and mounts one media, reporting rather than dropping a refusal. */
  const mount = (media: BackgroundMedia): void => {
    const asset = assets?.find((candidate) => candidate.id === media.assetId);
    if (asset === undefined) {
      onMediaError?.(
        `Background media asset "${media.assetId}" is not declared by this theme.`,
      );
      return;
    }
    if (!isBackgroundAsset(asset)) {
      onMediaError?.(
        `Background media asset "${asset.id}" is a ${asset.kind}, which cannot be a background.`,
      );
      return;
    }
    const source = resolveAsset(asset.id);
    if (source === undefined) {
      onMediaError?.(
        `Background media asset "${asset.id}" has no readable bytes.`,
      );
      return;
    }

    const child =
      asset.kind === "video"
        ? document.createElement("video")
        : document.createElement("img");
    child.src = source.url;
    child.style.cssText = "display:block;position:absolute;";
    if (child instanceof HTMLVideoElement) {
      child.autoplay = true;
      child.muted = true;
      child.loop = true;
      child.playsInline = true;
    }
    disposeSource = source.dispose;
    element = child;
    mountedAssetId = asset.id;
    layer.append(child);
    stopFrames = followFrames(child, onFrame);
    // Re-place before the decode repaint: the glass sample the repaint takes
    // must read the placed rect, not the pre-load fallback.
    stopIntrinsic = notifyOnIntrinsic(child, place);
    stopDecoded = notifyOnDecode(child, onFrame);
  };

  const setBackground = (next: Background | undefined): void => {
    background = next;
    const media = next?.media;
    if (media?.assetId !== mountedAssetId) {
      stop();
      layer.replaceChildren();
      element = undefined;
      mountedAssetId = undefined;
      if (media !== undefined) mount(media);
    }
    place();
  };

  setBackground(options.background);
  return {
    setBackground,
    setArtboardSize(size) {
      artboardSize = { width: size.width, height: size.height };
      place();
    },
    setBounds(next) {
      bounds = next;
      place();
    },
    backdrop(): BackdropMedia | undefined {
      const mounted = element;
      if (mounted === undefined) return undefined;
      // The rect the layer covers, in artboard units. A display-bounded layer
      // covers more than the artboard and may start outside it, so the glass
      // sampler is told the rect actually painted, not the board's own.
      const scale =
        bounds === undefined ? 0 : bounds.artboard.width / artboardSize.width;
      const rect =
        background?.media?.bounds === "display" &&
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
          const media = background?.media;
          // The child is placed inside this rect, the layer's box in artboard
          // units; the glass maps that box onto the device rect it samples, so
          // the sampler and the element cannot show different crops.
          const placed = placement({
            box: { width: rect.width, height: rect.height },
            source,
            fit: media?.fit ?? BACKGROUND_MEDIA_DEFAULTS.fit,
            scale: media?.scale ?? BACKGROUND_MEDIA_DEFAULTS.scale,
            offsetX: media?.offsetX ?? BACKGROUND_MEDIA_DEFAULTS.offsetX,
            offsetY: media?.offsetY ?? BACKGROUND_MEDIA_DEFAULTS.offsetY,
          });
          const scaleX = rect.width > 0 ? device.width / rect.width : 0;
          const scaleY = rect.height > 0 ? device.height / rect.height : 0;
          // Five arguments: the whole source, placed. A source window is the
          // defect 0012 cropped the file with.
          ctx.drawImage(
            mounted,
            device.left - region.left + placed.left * scaleX,
            device.top - region.top + placed.top * scaleY,
            placed.width * scaleX,
            placed.height * scaleY,
          );
          return true;
        },
      };
    },
    destroy() {
      stop();
      element = undefined;
      mountedAssetId = undefined;
      layer.remove();
    },
  };
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

/**
 * The intrinsic size arrives after the first placement — after `load` for an
 * image, after `loadedmetadata` for a video — and the fit has nothing to fit
 * until it does. Re-place once when it lands.
 */
function notifyOnIntrinsic(
  element: HTMLImageElement | HTMLVideoElement,
  place: () => void,
): () => void {
  const event = element instanceof HTMLVideoElement ? "loadedmetadata" : "load";
  element.addEventListener(event, place);
  return () => {
    element.removeEventListener(event, place);
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
