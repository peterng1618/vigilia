// @vitest-environment jsdom

import { createDemoSource } from "@vigilia/fake-source";
import { objectName } from "@vigilia/renderer-core";
import { serialiseScene } from "@vigilia/scene-fabric";
import { FabricImage, Rect } from "fabric/es";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountEditorShell } from "./editor-shell.js";
import { LiveRuntime } from "./live-runtime.js";
import { createNewFabricTheme } from "./new-fabric-theme.js";
import { PersistenceManager } from "./persistence-manager/index.js";

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

describe("the dirty guard and what the renderer paints", () => {
  /** The instrument that found this: snapshot, one live pass, snapshot. */
  it("is not made dirty by a reading being painted", async () => {
    const host = document.createElement("div");
    Object.defineProperties(host, {
      clientWidth: { value: 800 },
      clientHeight: { value: 600 },
    });
    const authored = createNewFabricTheme();
    const shell = await mountEditorShell({
      host,
      artboard: authored.artboard,
      envelope: authored,
    });
    shell.setGlobals(authored.globals);

    const objects =
      (
        authored.scene as {
          objects?: {
            id?: string;
            vigiliaText?: { runs?: { bindingId?: string }[] };
          }[];
        }
      ).objects ?? [];
    const bindings: Record<string, unknown[]> = {};
    for (const object of objects) {
      const runs = (object.vigiliaText?.runs ?? []).filter(
        (run) => run.bindingId,
      );
      if (object.id && runs.length > 0) {
        bindings[object.id] = runs.map((run) => ({
          id: `${object.id}-${run.bindingId}`,
          semanticKey: run.bindingId!,
        }));
      }
    }

    const manager = new PersistenceManager(shell.snapshot({ ...authored }), {});

    new LiveRuntime({
      canvas: shell.editor.canvas,
      bindings: bindings as never,
      source: createDemoSource(Date.now()),
      globals: authored.globals,
    }).refresh();

    // The canvas has genuinely moved — a reading is now painted on it.
    const painted = shell.snapshot({ ...authored }) as {
      scene: { objects: { id?: string; styles?: unknown }[] };
    };
    const styledByPass = painted.scene.objects.filter(
      (o) => o.styles !== undefined,
    );
    expect(styledByPass.length).toBeGreaterThan(0);

    // ...and the document has not, because a reading is not an edit. Without
    // this the Starter is reported as edited the moment it opens and every New
    // asks to save work nobody did.
    expect(manager.isDirty(shell.snapshot({ ...authored }), {})).toBe(false);

    // The half that matters: an edit the author made is still an edit.
    const edited = shell.snapshot({ ...authored });
    (edited.scene as { objects: { left: number }[] }).objects[0].left += 5;
    expect(manager.isDirty(edited, {})).toBe(true);

    shell.destroy();
  });
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

  it("carries an object's display name in the scene, not in editor metadata", async () => {
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
    const panel = new Rect({ id: "header", width: 40, height: 20 });
    panel.set("name", "Header rule");
    shell.editor.canvas.add(panel);

    const saved = shell.snapshot(input);
    // The name is authored document state on the object, so it travels in the
    // scene. An editor-metadata side map would be a second owner of the same
    // label, free to disagree with what the layer list prints.
    expect(saved.editorMetadata).toBeUndefined();
    expect(serialiseScene(shell.editor.canvas).objects[0]?.["name"]).toBe(
      "Header rule",
    );

    shell.destroy();
    host.remove();

    // Reopening the saved envelope is what makes the name durable; keeping it
    // only on the live object would pass every assertion above.
    const reopened = await mountEditorShell({
      host: document.createElement("div"),
      artboard: { width: 100, height: 100 },
      envelope: saved,
    });
    expect(objectName(reopened.editor.canvas.getObjects()[0] as Rect)).toBe(
      "Header rule",
    );
    reopened.destroy();
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
