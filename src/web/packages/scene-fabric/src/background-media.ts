import type { Artboard, AssetReference } from "@vigilia/renderer-core";

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
}

export interface BackgroundMediaHandle {
  update(options: Omit<BackgroundMediaOptions, "host">): void;
  setBounds(bounds: {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
  }): void;
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

  const update = (next: Omit<BackgroundMediaOptions, "host">): void => {
    disposeSource?.();
    disposeSource = undefined;
    layer.replaceChildren();
    const media = next.artboard.backgroundMedia;
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

    const element =
      asset.kind === "video"
        ? document.createElement("video")
        : document.createElement("img");
    element.src = source.url;
    element.style.cssText = `display:block;width:100%;height:100%;object-fit:${media.fit};`;
    if (element instanceof HTMLVideoElement) {
      element.autoplay = true;
      element.muted = true;
      element.loop = true;
      element.playsInline = true;
    }
    disposeSource = source.dispose;
    layer.append(element);
  };

  update(options);
  return {
    update,
    setBounds(bounds) {
      layer.style.left = `${bounds.left}px`;
      layer.style.top = `${bounds.top}px`;
      layer.style.right = "";
      layer.style.bottom = "";
      layer.style.width = `${bounds.width}px`;
      layer.style.height = `${bounds.height}px`;
    },
    destroy() {
      disposeSource?.();
      disposeSource = undefined;
      layer.remove();
    },
  };
}

function isBackgroundAsset(
  asset: AssetReference,
): asset is AssetReference & { readonly kind: "image" | "svg" | "video" } {
  return (
    asset.kind === "image" || asset.kind === "svg" || asset.kind === "video"
  );
}
