// @vitest-environment jsdom

import { type Artboard, type ScenePlan } from "@vigilia/renderer-core";
import { Group, Rect } from "fabric/es";
import { describe, expect, it } from "vitest";
import { mountFabricScene } from "./scene.js";

function plan(): ScenePlan {
  return {
    artboard: {
      width: 400,
      height: 300,
      fitMode: "contain",
      background: "#000",
      barColor: "#000",
    },
    nodes: [],
    issues: [],
  };
}

function host(): HTMLElement {
  const element = document.createElement("div");
  Object.defineProperty(element, "clientWidth", { value: 400 });
  Object.defineProperty(element, "clientHeight", { value: 300 });
  document.body.append(element);
  return element;
}

describe("mountFabricScene updateArtboard", () => {
  it("swaps background media without remounting scene", () => {
    const element = host();
    const artboard: Artboard = { width: 400, height: 300 };
    const scene = mountFabricScene({
      host: element,
      plan: plan(),
      artboard,
      assets: [
        { id: "a", kind: "image", path: "assets/a.png" },
        { id: "b", kind: "image", path: "assets/b.png" },
      ],
      resolveAsset: (assetId) => ({ url: `blob:${assetId}` }),
    });

    scene.updateArtboard({
      ...artboard,
      backgroundMedia: { assetId: "b", fit: "cover" },
    });

    const media = element.querySelector<HTMLImageElement>(
      "[data-vigilia-background-media] img",
    );
    expect(media?.src).toBe("blob:b");
    scene.dispose();
    element.remove();
  });

  it("is inert when scene mounted without asset resolver", () => {
    const element = host();
    const scene = mountFabricScene({ host: element, plan: plan() });

    expect(() =>
      scene.updateArtboard({
        width: 400,
        height: 300,
        backgroundMedia: { assetId: "b", fit: "cover" },
      }),
    ).not.toThrow();
    expect(element.querySelector("[data-vigilia-background-media]")).toBeNull();

    scene.dispose();
    element.remove();
  });
});

describe("mountFabricScene disposal", () => {
  it("releases the media layer, its frame callback and the host contents", () => {
    // The player's `pagehide` is the only teardown this mount has, and it
    // reaches the scene only through `dispose()`. What survives it is not
    // visible on screen - a background that keeps decoding, a video frame
    // callback still asking for repaints, a canvas still holding a scene.
    const element = host();
    const scheduled: (() => void)[] = [];
    const proto = HTMLVideoElement.prototype as unknown as {
      requestVideoFrameCallback: (cb: () => void) => number;
      cancelVideoFrameCallback: (handle: number) => void;
    };
    const had = "requestVideoFrameCallback" in proto;
    proto.requestVideoFrameCallback = (cb) => {
      scheduled.push(cb);
      return scheduled.length;
    };
    const cancelled: number[] = [];
    proto.cancelVideoFrameCallback = (handle) => cancelled.push(handle);

    try {
      let frames = 0;
      const scene = mountFabricScene({
        host: element,
        plan: plan(),
        artboard: { width: 400, height: 300 },
        assets: [{ id: "loop", kind: "video", path: "assets/loop.webm" }],
        resolveAsset: () => ({ url: "blob:loop" }),
        onGlassError: () => {
          frames += 1;
        },
      });
      const artboard: Artboard = {
        width: 400,
        height: 300,
        backgroundMedia: { assetId: "loop", fit: "cover" },
      };
      scene.updateArtboard(artboard);

      expect(
        element.querySelector("[data-vigilia-background-media] video"),
        "the media layer is mounted",
      ).not.toBeNull();
      expect(scheduled, "the video is being followed").toHaveLength(1);

      scene.dispose();

      expect(
        element.querySelector("[data-vigilia-background-media]"),
        "the media layer is gone",
      ).toBeNull();
      expect(element.textContent, "the host is empty").toBe("");
      expect(cancelled, "the frame callback was cancelled").toHaveLength(1);
      // A frame that was already queued must not fire after teardown.
      const before = frames;
      scheduled.forEach((cb) => cb());
      expect(frames).toBe(before);
      element.remove();
    } finally {
      if (!had) {
        delete (proto as Record<string, unknown>)["requestVideoFrameCallback"];
        delete (proto as Record<string, unknown>)["cancelVideoFrameCallback"];
      }
    }
  });

  it("releases a still image's decode listener on dispose", () => {
    // The counterpart to the video case, and the one that reaches a repaint:
    // a decode landing after teardown would ask the host to repaint a canvas
    // that has already been released.
    const element = host();
    const scene = mountFabricScene({
      host: element,
      plan: plan(),
      artboard: { width: 400, height: 300 },
      assets: [{ id: "hero", kind: "image", path: "assets/hero.png" }],
      resolveAsset: () => ({ url: "blob:hero" }),
    });
    scene.updateArtboard({
      width: 400,
      height: 300,
      backgroundMedia: { assetId: "hero", fit: "cover" },
    });
    const image = element.querySelector<HTMLImageElement>(
      "[data-vigilia-background-media] img",
    );
    expect(image, "the media layer is mounted").not.toBeNull();
    let repaints = 0;
    const original = scene.canvas.requestRenderAll.bind(scene.canvas);
    scene.canvas.requestRenderAll = (): void => {
      repaints += 1;
      original();
    };

    image?.dispatchEvent(new Event("load"));
    expect(repaints, "a live decode asks for a repaint").toBe(1);

    scene.dispose();
    image?.dispatchEvent(new Event("load"));
    expect(repaints, "and a decode after teardown asks for nothing").toBe(1);
    element.remove();
  });

  it("is safe to dispose twice", () => {
    const element = host();
    const scene = mountFabricScene({ host: element, plan: plan() });
    scene.dispose();
    expect(() => scene.dispose()).not.toThrow();
    element.remove();
  });

  it("releases the glass lifecycle with the scene", () => {
    // Measured, because it decides what is left to prove: `canvas.destroy()`
    // disposes every Fabric object, and a disposed object drops its listeners,
    // so the panel's `before:render` and its scratch surface go with it whether
    // or not the glass handle is disposed. What Fabric cannot reach is the
    // handle's own listener on the canvas and on each group: the canvas is
    // destroyed, not disposed as a child, and a group that a caller kept a
    // reference to outlives the scene.
    const element = host();
    const scene = mountFabricScene({
      host: element,
      plan: plan(),
      artboard: { width: 400, height: 300 },
    });
    const group = new Group([], {});
    scene.canvas.add(group);
    scene.canvas.add(
      new Rect({
        left: 40,
        top: 40,
        width: 60,
        height: 40,
        originX: "left",
        originY: "top",
        fill: "rgba(255, 255, 255, 0.2)",
        vigiliaGlass: { blurRadius: 8 },
      }),
    );
    scene.canvas.renderAll();
    const listening = (target: object, event: string): number =>
      (
        target as unknown as {
          __eventListeners?: Record<string, unknown[]>;
        }
      ).__eventListeners?.[event]?.length ?? 0;
    expect(
      listening(group, "object:added"),
      "the handle watches the group it found",
    ).toBe(1);
    expect(listening(scene.canvas, "object:added"), "and the canvas").toBe(1);

    scene.dispose();

    expect(
      listening(group, "object:added"),
      "the group's listener is released with the scene",
    ).toBe(0);
    expect(listening(scene.canvas, "object:added"), "and the canvas's").toBe(0);
    element.remove();
  });
});
