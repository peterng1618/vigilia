import { FabricImage, Group, type StaticCanvas } from 'fabric/es';
import type { AssetReference, FabricThemeEnvelope } from '@vigilia/renderer-core';
import { objectAssetReference } from '@vigilia/scene-fabric';

const TYPES = {
  png: { mime: 'image/png', kind: 'image' },
  jpg: { mime: 'image/jpeg', kind: 'image' },
  jpeg: { mime: 'image/jpeg', kind: 'image' },
  webp: { mime: 'image/webp', kind: 'image' },
  svg: { mime: 'image/svg+xml', kind: 'svg' },
} as const;

type AssetExtension = keyof typeof TYPES;
type AssetKind = (typeof TYPES)[AssetExtension]['kind'];

/** Owns declared package bytes and the disposable browser previews derived from them. */
export class AssetManager {
  #assets: Record<string, Uint8Array> = {};
  #declarations: AssetReference[] = [];
  #previewUrls = new Map<string, string>();

  get assets(): Readonly<Record<string, Uint8Array>> {
    return { ...this.#assets };
  }

  get declarations(): readonly AssetReference[] {
    return this.#declarations;
  }

  async import(file: File): Promise<AssetReference> {
    const extension = extensionOf(file.name);
    if (extension === undefined) throw new Error('Unsupported asset file type.');
    const type = TYPES[extension];
    if (file.type !== type.mime) throw new Error('File MIME type does not match its extension.');

    const bytes = new Uint8Array(await file.arrayBuffer());
    const previewBytes = extension === 'svg' ? sanitisedSvg(bytes) : bytes;
    const { id, path } = this.#allocate(file.name, extension);
    const reference: AssetReference = { id, kind: type.kind, path, sha256: await sha256(bytes) };

    this.#assets[path] = bytes;
    this.#declarations.push(reference);
    this.#previewUrls.set(id, URL.createObjectURL(new Blob([previewBytes as unknown as BlobPart], { type: type.mime })));
    return reference;
  }

  remove(assetId: string): boolean {
    const index = this.#declarations.findIndex((asset) => asset.id === assetId);
    if (index < 0) return false;
    const [asset] = this.#declarations.splice(index, 1);
    if (asset !== undefined) delete this.#assets[asset.path];
    this.#revoke(assetId);
    return true;
  }

  load(envelope: Pick<FabricThemeEnvelope, 'assets'>, assets: Readonly<Record<string, Uint8Array>>): void {
    this.destroy();
    this.#declarations = [...(envelope.assets ?? [])];
    this.#assets = Object.fromEntries(Object.entries(assets).map(([path, bytes]) => [path, new Uint8Array(bytes)]));
  }

  async hydrate(canvas: StaticCanvas): Promise<void> {
    for (const object of objectsOf(canvas.getObjects())) {
      if (!(object instanceof FabricImage)) continue;
      const reference = objectAssetReference(object);
      if (reference === undefined) continue;
      const asset = this.#declarations.find((candidate) => candidate.id === reference.assetId && candidate.kind === reference.kind);
      if (asset === undefined || this.#assets[asset.path] === undefined) continue;
      const hydrated = await FabricImage.fromURL(this.#preview(asset));
      object.setElement(hydrated.getElement());
    }
    canvas.requestRenderAll();
  }

  previewUrl(assetId: string): string | undefined {
    const asset = this.#declarations.find((candidate) => candidate.id === assetId);
    return asset === undefined ? undefined : this.#preview(asset);
  }

  destroy(): void {
    for (const url of this.#previewUrls.values()) URL.revokeObjectURL(url);
    this.#previewUrls.clear();
  }

  #preview(asset: AssetReference): string {
    const existing = this.#previewUrls.get(asset.id);
    if (existing !== undefined) return existing;
    const bytes = this.#assets[asset.path];
    if (bytes === undefined) throw new Error(`Missing declared asset bytes for ${asset.id}.`);
    const extension = extensionOf(asset.path);
    const type = extension === undefined ? undefined : TYPES[extension];
    if (type === undefined || type.kind !== asset.kind) throw new Error(`Unsupported declared asset ${asset.id}.`);
    const preview = extension === 'svg' ? sanitisedSvg(bytes) : bytes;
    const url = URL.createObjectURL(new Blob([preview as unknown as BlobPart], { type: type.mime }));
    this.#previewUrls.set(asset.id, url);
    return url;
  }

  #allocate(name: string, extension: AssetExtension): { id: string; path: string } {
    const base = name.slice(0, -(extension.length + 1)).replaceAll(/[^A-Za-z0-9_-]+/g, '-').replaceAll(/^-+|-+$/g, '') || 'asset';
    let suffix = 1;
    while (true) {
      const candidate = suffix === 1 ? base : `${base}-${suffix}`;
      const path = `assets/${candidate}.${extension}`;
      if (!this.#declarations.some((asset) => asset.id === candidate || asset.path === path)) return { id: candidate, path };
      suffix += 1;
    }
  }

  #revoke(assetId: string): void {
    const url = this.#previewUrls.get(assetId);
    if (url !== undefined) URL.revokeObjectURL(url);
    this.#previewUrls.delete(assetId);
  }
}

function extensionOf(name: string): AssetExtension | undefined {
  const extension = name.toLowerCase().split('.').pop();
  return extension !== undefined && extension in TYPES ? extension as AssetExtension : undefined;
}

function sanitisedSvg(bytes: Uint8Array): Uint8Array {
  const source = new TextDecoder().decode(bytes);
  const document = new DOMParser().parseFromString(source, 'image/svg+xml');
  if (document.querySelector('parsererror, script, foreignObject, iframe, object, embed, link, audio, video')) throw new Error('unsafe SVG');
  for (const element of document.querySelectorAll('*')) {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith('on') || (name === 'style' && /url\s*\(/i.test(value))) throw new Error('unsafe SVG');
      if ((name === 'href' || name === 'src' || name === 'xlink:href') && !value.startsWith('#') && !value.startsWith('data:image/')) throw new Error('unsafe SVG');
    }
  }
  for (const style of document.querySelectorAll('style')) {
    if (/url\s*\(/i.test(style.textContent ?? '')) throw new Error('unsafe SVG');
  }
  return new TextEncoder().encode(new XMLSerializer().serializeToString(document.documentElement));
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function* objectsOf(objects: readonly object[]): Generator<object> {
  for (const object of objects) {
    yield object;
    if (object instanceof Group) yield* objectsOf(object.getObjects());
  }
}
