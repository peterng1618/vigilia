// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { FabricImage, type StaticCanvas } from 'fabric/es';
import { AssetManager } from './index.js';

const PNG = new Uint8Array([137, 80, 78, 71]);

function file(bytes: Uint8Array | string, name: string, type: string): File {
  const source = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  return Object.assign(new File([source as unknown as BlobPart], name, { type }), {
    arrayBuffer: async () => source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength),
  });
}

describe('AssetManager', () => {
  it('copies an allowed image into a collision-safe package path', async () => {
    const manager = new AssetManager();

    const first = await manager.import(file(PNG, 'logo.png', 'image/png'));
    const second = await manager.import(file(PNG, 'logo.png', 'image/png'));

    expect(first).toMatchObject({ id: 'logo', kind: 'image', path: 'assets/logo.png' });
    expect(second).toMatchObject({ id: 'logo-2', kind: 'image', path: 'assets/logo-2.png' });
    expect(manager.assets['assets/logo.png']).toEqual(PNG);
    expect(manager.assets['assets/logo-2.png']).toEqual(PNG);
  });

  it('leaves package bytes unchanged for unsafe or mismatched files', async () => {
    const manager = new AssetManager();
    const unsafe = file('<svg><script>alert(1)</script></svg>', 'logo.svg', 'image/svg+xml');
    const mismatch = file(PNG, 'logo.png', 'image/jpeg');

    await expect(manager.import(unsafe)).rejects.toThrow('unsafe SVG');
    await expect(manager.import(mismatch)).rejects.toThrow('MIME type');

    expect(manager.assets).toEqual({});
  });

  it('retains MP4 bytes and supplies a disposable background source', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:loop');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const manager = new AssetManager();

    const asset = await manager.import(file(new Uint8Array([0, 1, 2]), 'loop.mp4', 'video/mp4'));
    const source = manager.backgroundSource(asset.id);

    expect(asset).toMatchObject({ kind: 'video', path: 'assets/loop.mp4' });
    expect(manager.assets['assets/loop.mp4']).toEqual(new Uint8Array([0, 1, 2]));
    expect(source?.url).toBe('blob:loop');
    source?.dispose?.();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:loop');
    expect(createObjectURL).toHaveBeenCalledOnce();
  });

  it('rejects a MIME type that does not match a WebM extension', async () => {
    const manager = new AssetManager();

    await expect(manager.import(file(PNG, 'loop.webm', 'video/mp4'))).rejects.toThrow('MIME type');

    expect(manager.assets).toEqual({});
  });

  it('revokes each preview URL when the manager is destroyed', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:logo');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const manager = new AssetManager();

    await manager.import(file(PNG, 'logo.png', 'image/png'));
    manager.destroy();

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:logo');
  });

  it('hydrates an asset-referenced Fabric image from declared package bytes', async () => {
    const manager = new AssetManager();
    const element = document.createElement('img');
    const image = Object.assign(Object.create(FabricImage.prototype), {
      get: vi.fn(() => ({ assetId: 'logo', kind: 'image' })),
      setElement: vi.fn(),
    }) as FabricImage;
    const canvas = { getObjects: () => [image], requestRenderAll: vi.fn() } as unknown as StaticCanvas;
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:logo');
    vi.spyOn(FabricImage, 'fromURL').mockResolvedValue({ getElement: () => element } as FabricImage);
    manager.load(
      { assets: [{ id: 'logo', kind: 'image', path: 'assets/logo.png' }] },
      { 'assets/logo.png': PNG },
    );

    await manager.hydrate(canvas);

    expect(FabricImage.fromURL).toHaveBeenCalledWith('blob:logo');
    expect(image.setElement).toHaveBeenCalledWith(element);
  });
});
