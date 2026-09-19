import type { Artboard, AssetReference } from '@vigilia/renderer-core';

export interface BackgroundMediaSource {
  readonly url: string;
  readonly dispose?: () => void;
}

export interface BackgroundMediaOptions {
  readonly host: HTMLElement;
  readonly artboard: Artboard;
  readonly assets: readonly AssetReference[] | undefined;
  readonly resolveAsset: (assetId: string) => BackgroundMediaSource | undefined;
}

export interface BackgroundMediaHandle {
  update(options: Omit<BackgroundMediaOptions, 'host'>): void;
  destroy(): void;
}

/** Mounts the optional DOM-only artboard background below the caller's canvas. */
export function mountBackgroundMedia(options: BackgroundMediaOptions): BackgroundMediaHandle {
  const layer = document.createElement('div');
  layer.dataset['vigiliaBackgroundMedia'] = '';
  layer.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;';
  options.host.prepend(layer);
  let disposeSource: (() => void) | undefined;

  const update = (next: Omit<BackgroundMediaOptions, 'host'>): void => {
    disposeSource?.();
    disposeSource = undefined;
    layer.replaceChildren();
    const media = next.artboard.backgroundMedia;
    const asset = next.assets?.find((candidate) => candidate.id === media?.assetId);
    if (media === undefined || asset === undefined || !isBackgroundAsset(asset)) return;
    const source = next.resolveAsset(asset.id);
    if (source === undefined) return;

    const element = asset.kind === 'video' ? document.createElement('video') : document.createElement('img');
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
    destroy() {
      disposeSource?.();
      disposeSource = undefined;
      layer.remove();
    },
  };
}

function isBackgroundAsset(asset: AssetReference): asset is AssetReference & { readonly kind: 'image' | 'svg' | 'video' } {
  return asset.kind === 'image' || asset.kind === 'svg' || asset.kind === 'video';
}
