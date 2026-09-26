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
