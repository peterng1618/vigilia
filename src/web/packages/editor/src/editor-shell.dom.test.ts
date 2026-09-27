// @vitest-environment jsdom

import { serialiseScene } from "@vigilia/scene-fabric";
import { FabricImage } from "fabric/es";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountEditorShell } from "./editor-shell.js";

// jsdom cannot drawImage an undecoded img inside Fabric's render pass; a proxy
// over a real context forwards everything, no-ops only drawImage, and swallows
// Fabric's node-canvas-only `patternQuality` writes.
beforeEach(() => {
  const real = document.createElement("canvas").getContext("2d");
  if (real !== null) {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () =>
        new Proxy(real, {
          get(target, property) {
            if (property === "drawImage") return (): void => {};
            const value = Reflect.get(target, property, target);
            return typeof value === "function" ? value.bind(target) : value;
          },
          set(target, property, value) {
            if (property === "patternQuality") return true;
            return Reflect.set(target, property, value);
          },
        }) as unknown as CanvasRenderingContext2D,
    );
  }
});

describe("native editor shell", () => {
  it("mounts direct Fabric text mechanics", async () => {
    const host = document.createElement("div");
    Object.defineProperties(host, {
      clientWidth: { value: 400 },
      clientHeight: { value: 300 },
    });

    const shell = await mountEditorShell({
      host,
      artboard: { width: 100, height: 100 },
    });
    const text = shell.editor.textManager.addText({ text: "Native" });

    expect(host.querySelector("canvas")).not.toBeNull();
    expect(shell.editor.canvas.getActiveObject()).toBe(text);
    shell.destroy();
  });

  it("exposes the mounted editor on window for devtools/e2e access, and removes it on destroy", async () => {
    const host = document.createElement("div");
    Object.defineProperties(host, {
      clientWidth: { value: 400 },
      clientHeight: { value: 300 },
    });

    const shell = await mountEditorShell({
      host,
      artboard: { width: 100, height: 100 },
    });
    const entry = Object.entries(
      window as unknown as Record<string, unknown>,
    ).find(([key]) => key.startsWith("vigilia-fabric-editor-"));

    expect(entry?.[1]).toBe(shell.editor);

    shell.destroy();

    expect(
      entry === undefined
        ? undefined
        : (window as unknown as Record<string, unknown>)[entry[0]],
    ).toBeUndefined();
  });

  it("records a completed drag in history so undo restores the prior position", async () => {
    const host = document.createElement("div");
    Object.defineProperties(host, {
      clientWidth: { value: 400 },
      clientHeight: { value: 300 },
    });

    const shell = await mountEditorShell({
      host,
      artboard: { width: 100, height: 100 },
    });
    const text = shell.editor.textManager.addText({ text: "Native", left: 5 });

    text.set("left", 90);
    shell.editor.canvas.fire("object:modified", { target: text });
    await shell.editor.historyManager.undo();

    const revived = shell.editor.canvas
      .getObjects()
      .find((object) => object.get("id") === text.get("id"));
    expect(revived?.left).toBe(5);
    shell.destroy();
  });

  it("keeps an open crop frame out of the serialised scene", async () => {
    const host = document.createElement("div");
    Object.defineProperties(host, {
      clientWidth: { value: 400 },
      clientHeight: { value: 300 },
    });
    const shell = await mountEditorShell({
      host,
      artboard: { width: 400, height: 300 },
    });
    const element = document.createElement("img");
    Object.defineProperty(element, "naturalWidth", { value: 100 });
    Object.defineProperty(element, "naturalHeight", { value: 100 });
    const image = new FabricImage(element, { id: "image-1" });
    image.set({ width: 100, height: 100 });
    shell.editor.canvas.add(image);
    shell.editor.canvas.setActiveObject(image);

    expect(shell.editor.cropManager.begin()).toBe(true);
    const scene = serialiseScene(shell.editor.canvas);

    expect(scene.objects).toHaveLength(1);
    expect(scene.objects[0]?.["id"]).toBe("image-1");

    shell.destroy();
    host.remove();
  });

  it("writes display names into editorMetadata and reads them back on reopen", async () => {
    const host = document.createElement("div");
    Object.defineProperties(host, {
      clientWidth: { value: 400 },
      clientHeight: { value: 300 },
    });
    const shell = await mountEditorShell({
      host,
      artboard: { width: 100, height: 100 },
    });
    const input = {
      id: "theme",
      artboard: { width: 100, height: 100 },
      metadata: { locale: "en" },
    };

    // Nothing renamed yet: the key is absent rather than an empty object, so a
    // document that never renamed a layer does not grow dead payload.
    expect(shell.layerNames()).toEqual({});
    expect(shell.snapshot(input).editorMetadata).toBeUndefined();

    shell.setLayerNames({ header: "Header rule" });
    const saved = shell.snapshot(input);
    expect(saved.editorMetadata).toEqual({
      layerNames: { header: "Header rule" },
    });

    shell.destroy();
    host.remove();

    // Reopening the saved envelope is what makes the name durable; keeping it
    // only on the shell would pass every assertion above.
    const reopened = await mountEditorShell({
      host: document.createElement("div"),
      artboard: { width: 100, height: 100 },
      envelope: saved,
    });
    expect(reopened.layerNames()).toEqual({ header: "Header rule" });
    expect(reopened.snapshot(input).editorMetadata).toEqual({
      layerNames: { header: "Header rule" },
    });
    reopened.destroy();
  });

  it("reads only string-valued layer names out of a hand-edited editorMetadata", async () => {
    const host = document.createElement("div");
    Object.defineProperties(host, {
      clientWidth: { value: 400 },
      clientHeight: { value: 300 },
    });
    const envelopeFor = (layerNames: unknown) => ({
      schemaVersion: 2 as const,
      fabricVersion: "7.4.0",
      id: "theme",
      metadata: { locale: "en" } as const,
      artboard: { width: 100, height: 100 },
      scene: { version: "7.4.0", objects: [] },
      // Seeded literally: `setLayerNames` only ever writes the shape the editor
      // produces, so only a literal envelope exercises the reader against a file
      // carrying something else under the same key.
      editorMetadata: { layerNames },
    });

    // `logo` and the blank key survive a naive Object.fromEntries, so the filter
    // is the only thing keeping them out.
    const shell = await mountEditorShell({
      host,
      artboard: { width: 100, height: 100 },
      envelope: envelopeFor({ header: "Header rule", logo: 42, "  ": 7 }),
    });
    expect(shell.layerNames()).toEqual({ header: "Header rule" });
    shell.destroy();
    host.remove();

    // The key itself is free-form JSON too; a wrong-shaped one must not throw.
    // An array is the case a plain `typeof raw === "object"` check lets through,
    // and it must be rejected as a whole: an array *member* is already covered
    // by the per-value string filter above.
    for (const wrong of [null, ["nope"]]) {
      const wrongShape = await mountEditorShell({
        host: document.createElement("div"),
        artboard: { width: 100, height: 100 },
        envelope: envelopeFor(wrong),
      });
      expect(wrongShape.layerNames()).toEqual({});
      wrongShape.destroy();
    }
  });

  it("exposes a camera over the mounted canvas", async () => {
    const host = document.createElement("div");
    Object.defineProperty(host, "clientWidth", { value: 1000 });
    Object.defineProperty(host, "clientHeight", { value: 400 });
    document.body.append(host);
    const shell = await mountEditorShell({
      host,
      artboard: {
        width: 1280,
        height: 720,
        background: { kind: "solid", color: "#000" },
        barColor: { kind: "solid", color: "#000" },
      } as never,
    });
    expect(shell.editor.viewport.zoom()).toBeGreaterThan(0);
    // The canvas fills the host, not the artboard: a canvas sized to the
    // artboard would be 711 wide at this host's fit scale; it must fill the
    // host instead.
    expect(shell.editor.canvas.getWidth()).toBe(1000);
    expect(shell.editor.canvas.getHeight()).toBe(400);
    shell.destroy();
  });
});

describe("editor background media", () => {
  /** `requestVideoFrameCallback` is the media's frame cadence, and the editor
   *  has to ride it: the video is a DOM sibling Fabric never sees. Counting the
   *  schedules is how a *remount* that lost the subscription shows up - the
   *  session performs one during mount, so an update-only test never sees it. */
  function trackVideoFrames(): { count: number; restore: () => void } {
    const proto = HTMLVideoElement.prototype as unknown as {
      requestVideoFrameCallback: (cb: () => void) => number;
      cancelVideoFrameCallback: (handle: number) => void;
    };
    const had = "requestVideoFrameCallback" in proto;
    const tracker = { count: 0 };
    proto.requestVideoFrameCallback = () => {
      tracker.count += 1;
      return tracker.count;
    };
    proto.cancelVideoFrameCallback = () => {};
    return {
      get count() {
        return tracker.count;
      },
      restore() {
        if (!had) {
          delete (proto as Record<string, unknown>)[
            "requestVideoFrameCallback"
          ];
          delete (proto as Record<string, unknown>)["cancelVideoFrameCallback"];
        }
      },
    };
  }

  it("keeps following video frames across the remount the session performs at start", async () => {
    const frames = trackVideoFrames();
    const host = document.createElement("div");
    Object.defineProperties(host, {
      clientWidth: { value: 400 },
      clientHeight: { value: 300 },
    });
    const video = [
      { id: "loop", kind: "video" as const, path: "assets/loop.webm" },
    ];
    const artboard = {
      width: 100,
      height: 100,
      backgroundMedia: { assetId: "loop", fit: "cover" as const },
    };

    try {
      const shell = await mountEditorShell({
        host,
        artboard,
        assets: video,
        resolveAsset: () => ({ url: "blob:loop" }),
      });
      expect(frames.count, "the first mount follows frames").toBe(1);

      // What the session does during mount: a remount, not an update.
      shell.setBackgroundMedia(video, () => ({ url: "blob:loop" }));
      expect(frames.count, "the remounted layer still follows frames").toBe(2);

      // And an image background, which must start no loop.
      shell.setBackgroundMedia(
        [{ id: "hero", kind: "image", path: "assets/hero.png" }],
        () => ({ url: "blob:hero" }),
      );
      expect(frames.count, "an image starts no loop").toBe(2);
      shell.destroy();
    } finally {
      frames.restore();
    }
  });

  it("repaints when a swapped background image decodes", async () => {
    // The editor's whole reason for the media frame subscription: the layer is
    // a DOM sibling, so a background that arrives after the first paint is
    // invisible to Fabric. A glass panel sampling it keeps an empty backdrop
    // until something asks for a repaint, and nothing else in the scene
    // changes to do it.
    const host = document.createElement("div");
    Object.defineProperties(host, {
      clientWidth: { value: 400 },
      clientHeight: { value: 300 },
    });
    const hero = [
      { id: "hero", kind: "image" as const, path: "assets/hero.png" },
    ];

    const shell = await mountEditorShell({
      host,
      artboard: {
        width: 100,
        height: 100,
        backgroundMedia: { assetId: "hero", fit: "cover" },
      },
      assets: hero,
      resolveAsset: () => ({ url: "blob:hero" }),
    });
    const canvas = shell.editor.canvas;
    // `requestRenderAll` defers to a rAF, so the request is what is counted,
    // not the render it eventually produces.
    let asked = 0;
    const original = canvas.requestRenderAll.bind(canvas);
    canvas.requestRenderAll = (): void => {
      asked += 1;
      original();
    };

    const image = host.querySelector<HTMLImageElement>(
      "[data-vigilia-background-media] img",
    );
    expect(image, "the editor mounted a background image").not.toBeNull();
    expect(asked, "mounting alone asks for nothing").toBe(0);

    image?.dispatchEvent(new Event("load"));
    expect(asked, "the decode reaches the editor's canvas").toBe(1);

    // Once, not a loop: a still image is not a moving thing.
    image?.dispatchEvent(new Event("load"));
    expect(asked, "and it is not a loop").toBe(1);
    shell.destroy();
  });

  it("stops asking for a repaint once the editor is destroyed", async () => {
    // A decode that lands after teardown would ask a canvas the shell has
    // already released to repaint. The listener is on the image element, which
    // outlives `destroy()`, so what is under test is that the repaint stops -
    // not merely that nothing throws, which the DOM reports rather than
    // propagating through `dispatchEvent` and so proves nothing.
    const host = document.createElement("div");
    Object.defineProperties(host, {
      clientWidth: { value: 400 },
      clientHeight: { value: 300 },
    });
    const shell = await mountEditorShell({
      host,
      artboard: {
        width: 100,
        height: 100,
        backgroundMedia: { assetId: "hero", fit: "cover" },
      },
      assets: [{ id: "hero", kind: "image", path: "assets/hero.png" }],
      resolveAsset: () => ({ url: "blob:hero" }),
    });
    const canvas = shell.editor.canvas;
    const image = host.querySelector<HTMLImageElement>(
      "[data-vigilia-background-media] img",
    );
    expect(image, "the editor mounted a background image").not.toBeNull();
    let asked = 0;
    const original = canvas.requestRenderAll.bind(canvas);
    canvas.requestRenderAll = (): void => {
      asked += 1;
      original();
    };

    shell.destroy();
    expect(asked, "teardown itself asks for nothing").toBe(0);
    image?.dispatchEvent(new Event("load"));
    expect(asked, "and a decode afterwards asks for nothing").toBe(0);
  });
});
