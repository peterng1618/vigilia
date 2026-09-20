import type { CuratedFontFace } from './font-catalog.js';

interface PreviewFontFace {
  readonly load: () => Promise<unknown>;
}

interface PreviewFontSet {
  add(face: PreviewFontFace): void;
  delete(face: PreviewFontFace): boolean;
}

export interface PreviewHandle {
  readonly release: () => void;
}

export interface FontPreviewOptions {
  readonly fetch?: typeof fetch;
  readonly createFontFace?: (family: string, source: ArrayBuffer, descriptors: FontFaceDescriptors) => PreviewFontFace;
  readonly fonts?: PreviewFontSet;
}

let active: { readonly controller: AbortController; readonly release: () => void } | undefined;

/** Downloads a candidate only for browser preview; callers release it before another preview or unmount. */
export async function previewFontFace(face: CuratedFontFace, options: FontPreviewOptions = {}): Promise<PreviewHandle> {
  releaseFontPreview();
  const controller = new AbortController();
  active = { controller, release: () => controller.abort() };
  try {
    const response = await (options.fetch ?? fetch)(face.sourceUrl, { signal: controller.signal });
    if (!response.ok) throw new Error(`Font preview download failed (${response.status}).`);
    const fonts = options.fonts ?? document.fonts;
    if (fonts === undefined) throw new Error('Font previews require the browser FontFace API.');
    const font = (options.createFontFace ?? ((family, source, descriptors) => new FontFace(family, source, descriptors)))(
      face.family,
      await response.arrayBuffer(),
      { weight: String(face.weight), style: face.style },
    );
    await font.load();
    fonts.add(font);
    let released = false;
    const release = (): void => {
      if (released) return;
      released = true;
      fonts.delete(font);
      if (active?.controller === controller) active = undefined;
    };
    if (active?.controller !== controller) {
      release();
      throw new DOMException('Aborted', 'AbortError');
    }
    active = { controller, release };
    return { release };
  } catch (error) {
    if (active?.controller === controller) active = undefined;
    throw error;
  }
}

export function releaseFontPreview(): void {
  if (active === undefined) return;
  active.controller.abort();
  active.release();
}
