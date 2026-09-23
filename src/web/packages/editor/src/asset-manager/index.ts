import type {
  AssetReference,
  FabricThemeEnvelope,
  FontAssetReference,
} from "@vigilia/renderer-core";
import {
  objectAssetReference,
  setObjectAssetReference,
} from "@vigilia/scene-fabric";
import { FabricImage, Group, type StaticCanvas } from "fabric/es";
import type { EditorInteraction } from "../editor-interaction.js";
import type { CuratedFontFace } from "../font-catalog.js";
import { boundedImageElement } from "../image-manager/index.js";
import { uiCopy } from "../ui-copy.js";

const TYPES = {
  png: { mime: "image/png", kind: "image" },
  jpg: { mime: "image/jpeg", kind: "image" },
  jpeg: { mime: "image/jpeg", kind: "image" },
  webp: { mime: "image/webp", kind: "image" },
  svg: { mime: "image/svg+xml", kind: "svg" },
  mp4: { mime: "video/mp4", kind: "video" },
  webm: { mime: "video/webm", kind: "video" },
  woff2: { mime: "font/woff2", kind: "font" },
  woff: { mime: "font/woff", kind: "font" },
  ttf: { mime: "font/ttf", kind: "font" },
  otf: { mime: "font/otf", kind: "font" },
} as const;

type AssetExtension = keyof typeof TYPES;
type AssetKind = (typeof TYPES)[AssetExtension]["kind"];
type LocalAssetReference =
  | (AssetReference & { readonly kind: AssetKind })
  | FontAssetReference;

/** Owns declared package bytes and the disposable browser previews derived from them. */
export class AssetManager {
  #assets: Record<string, Uint8Array> = {};
  #declarations: LocalAssetReference[] = [];
  #previewUrls = new Map<string, string>();

  get assets(): Readonly<Record<string, Uint8Array>> {
    return { ...this.#assets };
  }

  get declarations(): readonly LocalAssetReference[] {
    return this.#declarations;
  }

  async import(file: File): Promise<LocalAssetReference> {
    const extension = extensionOf(file.name);
    if (extension === undefined)
      throw new Error("Unsupported asset file type.");
    const type = TYPES[extension];
    if (file.type !== type.mime)
      throw new Error("File MIME type does not match its extension.");

    const bytes = new Uint8Array(await file.arrayBuffer());
    const previewBytes = extension === "svg" ? sanitisedSvg(bytes) : bytes;
    const { id, path } = this.#allocate(file.name, extension);
    const reference: LocalAssetReference = {
      id,
      kind: type.kind,
      path,
      sha256: await sha256(bytes),
    };

    this.#assets[path] = bytes;
    this.#declarations.push(reference);
    if (type.kind === "image" || type.kind === "svg") {
      this.#previewUrls.set(
        id,
        URL.createObjectURL(
          new Blob([previewBytes as unknown as BlobPart], { type: type.mime }),
        ),
      );
    }
    return reference;
  }

  async adoptFont(
    face: CuratedFontFace,
    bytes: Uint8Array,
  ): Promise<LocalAssetReference> {
    const path = `assets/${face.id}.woff2`;
    const reference: LocalAssetReference = {
      id: face.id,
      kind: "font",
      path,
      sha256: await sha256(bytes),
      family: face.family,
      weight: face.weight,
      style: face.style,
      format: face.format,
      sourceUrl: face.sourceUrl,
      license: face.license,
    };
    const existing = this.#declarations.findIndex(
      (asset) => asset.id === face.id,
    );
    if (existing >= 0) this.#declarations.splice(existing, 1, reference);
    else this.#declarations.push(reference);
    this.#assets[path] = new Uint8Array(bytes);
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

  load(
    envelope: Pick<FabricThemeEnvelope, "assets">,
    assets: Readonly<Record<string, Uint8Array>>,
  ): void {
    this.destroy();
    this.#declarations = (envelope.assets ?? []).filter(
      (asset): asset is LocalAssetReference =>
        asset.kind === "image" ||
        asset.kind === "svg" ||
        asset.kind === "video" ||
        asset.kind === "font",
    );
    this.#assets = Object.fromEntries(
      Object.entries(assets).map(([path, bytes]) => [
        path,
        new Uint8Array(bytes),
      ]),
    );
  }

  async hydrate(canvas: StaticCanvas): Promise<void> {
    for (const object of objectsOf(canvas.getObjects())) {
      if (!(object instanceof FabricImage)) continue;
      const reference = objectAssetReference(object);
      if (reference === undefined) continue;
      const asset = this.#declarations.find(
        (candidate) =>
          candidate.id === reference.assetId &&
          candidate.kind === reference.kind,
      );
      if (asset === undefined || this.#assets[asset.path] === undefined)
        continue;
      const hydrated = await FabricImage.fromURL(this.#preview(asset));
      const element = hydrated.getElement();
      object.setElement(
        element instanceof HTMLImageElement
          ? boundedImageElement(element)
          : element,
      );
    }
    canvas.requestRenderAll();
  }

  previewUrl(assetId: string): string | undefined {
    const asset = this.#declarations.find(
      (candidate) => candidate.id === assetId,
    );
    return asset === undefined || asset.kind === "video"
      ? undefined
      : this.#preview(asset);
  }

  backgroundSource(
    assetId: string,
  ): { readonly url: string; readonly dispose: () => void } | undefined {
    const asset = this.#declarations.find(
      (candidate) => candidate.id === assetId,
    );
    if (asset === undefined || !["image", "svg", "video"].includes(asset.kind))
      return undefined;
    const bytes = this.#assets[asset.path];
    const extension = extensionOf(asset.path);
    const type = extension === undefined ? undefined : TYPES[extension];
    if (bytes === undefined || type === undefined || type.kind !== asset.kind)
      return undefined;
    const preview = asset.kind === "svg" ? sanitisedSvg(bytes) : bytes;
    const url = URL.createObjectURL(
      new Blob([preview as unknown as BlobPart], { type: type.mime }),
    );
    return { url, dispose: () => URL.revokeObjectURL(url) };
  }

  destroy(): void {
    for (const url of this.#previewUrls.values()) URL.revokeObjectURL(url);
    this.#previewUrls.clear();
  }

  #preview(asset: LocalAssetReference): string {
    const existing = this.#previewUrls.get(asset.id);
    if (existing !== undefined) return existing;
    const bytes = this.#assets[asset.path];
    if (bytes === undefined)
      throw new Error(`Missing declared asset bytes for ${asset.id}.`);
    const extension = extensionOf(asset.path);
    const type = extension === undefined ? undefined : TYPES[extension];
    if (type === undefined || type.kind !== asset.kind || type.kind === "video")
      throw new Error(`Unsupported declared asset ${asset.id}.`);
    const preview = extension === "svg" ? sanitisedSvg(bytes) : bytes;
    const url = URL.createObjectURL(
      new Blob([preview as unknown as BlobPart], { type: type.mime }),
    );
    this.#previewUrls.set(asset.id, url);
    return url;
  }

  #allocate(
    name: string,
    extension: AssetExtension,
  ): { id: string; path: string } {
    const base =
      name
        .slice(0, -(extension.length + 1))
        .replaceAll(/[^A-Za-z0-9_-]+/g, "-")
        .replaceAll(/^-+|-+$/g, "") || "asset";
    let pathSuffix = 1;
    let path = `assets/${base}.${extension}`;
    while (this.#declarations.some((asset) => asset.path === path)) {
      pathSuffix += 1;
      path = `assets/${base}-${pathSuffix}.${extension}`;
    }
    let idSuffix = 1;
    let id = base;
    while (this.#declarations.some((asset) => asset.id === id)) {
      idSuffix += 1;
      id = `${base}-${idSuffix}`;
    }
    return { id, path };
  }

  #revoke(assetId: string): void {
    const url = this.#previewUrls.get(assetId);
    if (url !== undefined) URL.revokeObjectURL(url);
    this.#previewUrls.delete(assetId);
  }
}

/** Local-file controls; the editor continues to own canvas selection and history. */
export function createAssetPanel(
  host: HTMLElement,
  manager: AssetManager,
  editor: EditorInteraction,
  changed: () => void,
  isReferenced?: (assetId: string) => boolean,
): HTMLElement {
  const root = document.createElement("section");
  const select = document.createElement("select");
  const importInput = input("data-vigilia-asset-import");
  const replaceInput = input("data-vigilia-asset-replace");
  const remove = document.createElement("button");
  remove.type = "button";
  remove.dataset["vigiliaAssetRemove"] = "";
  remove.textContent = uiCopy.panels.removeAsset;
  root.append(
    Object.assign(document.createElement("h2"), {
      textContent: uiCopy.panels.assets,
    }),
    select,
    importInput,
    replaceInput,
    remove,
  );
  host.append(root);
  const render = (): void => {
    select.replaceChildren(
      ...manager.declarations.map((asset) =>
        Object.assign(document.createElement("option"), {
          value: asset.id,
          textContent: asset.id,
        }),
      ),
    );
  };
  const add = async (file: File, replaceSelected: boolean): Promise<void> => {
    const asset = await manager.import(file);
    if (asset.kind === "video" || asset.kind === "font") {
      changed();
      render();
      return;
    }
    const target = editor.canvas.getActiveObject();
    if (
      replaceSelected &&
      target instanceof FabricImage &&
      objectAssetReference(target) !== undefined
    ) {
      const url = manager.previewUrl(asset.id);
      if (url === undefined) return;
      const image = await FabricImage.fromURL(url);
      setObjectAssetReference(target, { assetId: asset.id, kind: asset.kind });
      target.setElement(image.getElement());
      target.setCoords();
    } else {
      const imported = await editor.imageManager.importImage({
        source: file,
        scale: "image-contain",
        withoutSave: true,
      });
      if (imported === null || !(imported.image instanceof FabricImage)) return;
      setObjectAssetReference(imported.image, {
        assetId: asset.id,
        kind: asset.kind,
      });
      imported.image.setCoords();
      editor.canvas.setActiveObject(imported.image);
    }
    editor.historyManager.saveState();
    editor.canvas.requestRenderAll();
    changed();
    render();
  };
  importInput.addEventListener("change", () => {
    const file = importInput.files?.[0];
    if (file !== undefined) void add(file, false);
    importInput.value = "";
  });
  replaceInput.addEventListener("change", () => {
    const file = replaceInput.files?.[0];
    if (file !== undefined) void add(file, true);
    replaceInput.value = "";
  });
  remove.addEventListener("click", () => {
    const id = select.value;
    if (
      [...editor.canvas.getObjects()].some(
        (object) => objectAssetReference(object)?.assetId === id,
      ) ||
      isReferenced?.(id) === true
    )
      return;
    if (manager.remove(id)) {
      changed();
      render();
    }
  });
  render();
  return root;
}

function input(
  data: "data-vigilia-asset-import" | "data-vigilia-asset-replace",
): HTMLInputElement {
  const element = document.createElement("input");
  element.type = "file";
  element.accept =
    ".png,.jpg,.jpeg,.webp,.svg,.mp4,.webm,.woff2,.woff,.ttf,.otf";
  element.hidden = true;
  element.setAttribute(data, "");
  return element;
}

function extensionOf(name: string): AssetExtension | undefined {
  const extension = name.toLowerCase().split(".").pop();
  return extension !== undefined && extension in TYPES
    ? (extension as AssetExtension)
    : undefined;
}

function sanitisedSvg(bytes: Uint8Array): Uint8Array {
  const source = new TextDecoder().decode(bytes);
  const document = new DOMParser().parseFromString(source, "image/svg+xml");
  if (
    document.querySelector(
      "parsererror, script, foreignObject, iframe, object, embed, link, audio, video",
    )
  )
    throw new Error("unsafe SVG");
  for (const element of document.querySelectorAll("*")) {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (
        name.startsWith("on") ||
        (name === "style" && /url\s*\(/i.test(value))
      )
        throw new Error("unsafe SVG");
      if (
        (name === "href" || name === "src" || name === "xlink:href") &&
        !value.startsWith("#") &&
        !value.startsWith("data:image/")
      )
        throw new Error("unsafe SVG");
    }
  }
  for (const style of document.querySelectorAll("style")) {
    if (/url\s*\(/i.test(style.textContent ?? ""))
      throw new Error("unsafe SVG");
  }
  return new TextEncoder().encode(
    new XMLSerializer().serializeToString(document.documentElement),
  );
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    bytes as unknown as BufferSource,
  );
  return [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function* objectsOf(objects: readonly object[]): Generator<object> {
  for (const object of objects) {
    yield object;
    if (object instanceof Group) yield* objectsOf(object.getObjects());
  }
}
