import type { AssetReference } from "@vigilia/renderer-core";

interface LoadedFontFace {
  readonly load: () => Promise<unknown>;
}

interface FontSet {
  add(face: LoadedFontFace): void;
  delete(face: LoadedFontFace): boolean;
}

export interface FontAssetLoadOptions {
  readonly assets: readonly AssetReference[];
  readonly bytes: Readonly<Record<string, Uint8Array>>;
  readonly onError: (message: string) => void;
  readonly fonts?: FontSet;
  readonly createFontFace?: (
    family: string,
    source: ArrayBuffer,
    descriptors: FontFaceDescriptors,
  ) => LoadedFontFace;
}

/** Registers packaged faces before Fabric measures text and returns their isolated release handle. */
export async function loadFontAssets(
  options: FontAssetLoadOptions,
): Promise<() => void> {
  const fonts = options.fonts ?? document.fonts;
  if (fonts === undefined) {
    options.onError("Packaged fonts require the browser FontFace API.");
    return () => undefined;
  }
  const loaded: LoadedFontFace[] = [];
  for (const asset of options.assets) {
    if (asset.kind !== "font") continue;
    const face = asset as AssetReference & {
      readonly family?: unknown;
      readonly weight?: unknown;
      readonly style?: unknown;
    };
    const bytes = options.bytes[asset.path];
    if (
      bytes === undefined ||
      typeof face.family !== "string" ||
      (typeof face.weight !== "string" && typeof face.weight !== "number") ||
      (face.style !== "normal" && face.style !== "italic")
    ) {
      options.onError(
        `Could not load packaged font "${asset.id}": declared bytes or metadata are missing`,
      );
      continue;
    }
    try {
      const font = (
        options.createFontFace ??
        ((family, source, descriptors) =>
          new FontFace(family, source, descriptors))
      )(face.family, Uint8Array.from(bytes).buffer as ArrayBuffer, {
        weight: String(face.weight),
        style: face.style,
      });
      await font.load();
      fonts.add(font);
      loaded.push(font);
    } catch (error) {
      options.onError(
        `Could not load packaged font "${asset.id}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return () => {
    for (const font of loaded) fonts.delete(font);
  };
}
