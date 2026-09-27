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
      const scene = mountFabricScene({
        host: element,
        plan: plan(),
        artboard: { width: 400, height: 300 },
        assets: [{ id: "loop", kind: "video", path: "assets/loop.webm" }],
        resolveAsset: () => ({ url: "blob:loop" }),
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
      // A frame callback already queued when teardown happened must not reach
      // the host afterwards. Counting *repaints*, not a snapshot against itself:
      // `onFrame` is the scene's `requestRenderAll`, so this is what a leaked
      // callback would drive.
      const canvas = scene.canvas;
      let repaints = 0;
      const originalRequest = canvas.requestRenderAll.bind(canvas);
      canvas.requestRenderAll = (): void => {
        repaints += 1;
        originalRequest();
      };
      scheduled.forEach((cb) => cb());
      canvas.requestRenderAll = originalRequest;
      expect(
        repaints,
        "a queued frame after teardown asks for no repaint",
      ).toBe(0);
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

  it("releases everything over repeated full mount/render/dispose cycles", () => {
    // Task 1 measured a 56-surface leak over ten mount/unmount cycles, and it
    // was the *scene* that leaked, not just the glass handle - so this cycles
    // the whole mount rather than the handle alone.
    const created: HTMLCanvasElement[] = [];
    const original = document.createElement.bind(document);
    (document as unknown as { createElement: typeof original }).createElement =
      ((name: string, options?: ElementCreationOptions) => {
        const made = original(name, options);
        if (name === "canvas") created.push(made as HTMLCanvasElement);
        return made;
      }) as typeof original;

    const perCycle: number[] = [];
    const stillHolding: number[] = [];
    try {
      for (let cycle = 0; cycle < 10; cycle += 1) {
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
        const before = created.length;
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
        scene.dispose();
        // Everything this cycle allocated after the baseline, and any of it
        // still holding a backing store.
        // The glass scratch is the one that is *reused* between frames, so it
        // is the one whose size changes when a second frame is drawn. Fabric
        // allocates canvases of its own during a render and `destroy()` does
        // not zero those, so they cannot be the subject of this claim.
        const sized = created
          .slice(before)
          .map((made) => `${made.width}x${made.height}`);
        scene.canvas.renderAll();
        const scratch = created
          .slice(before)
          .find((made, i) => `${made.width}x${made.height}` !== sized[i]);
        perCycle.push(created.length - before);
        // Whether the reused scratch is still holding a backing store.
        stillHolding.push(
          scratch === undefined ? 0 : scratch.width > 0 ? 1 : 0,
        );
        element.remove();
      }
    } finally {
      (
        document as unknown as { createElement: typeof original }
      ).createElement = original;
    }

    // Task 1's leak was a count that *grew* with the cycles - 56 surfaces
    // after ten - so the property is that it does not. A single cycle could
    // never have shown it, which is why this is ten.
    expect(
      perCycle[0],
      "the surface was found, so the test measured something",
    ).toBeGreaterThan(0);
    expect(
      new Set(stillHolding).size,
      "the scratch is released on every cycle, identically",
    ).toBe(1);
    expect(
      Math.max(...stillHolding),
      "and no cycle leaves a backing store behind",
    ).toBe(0);
  });

  it("is inert once disposed", () => {
    // A `ResizeObserver` and an `orientationchange` handler both outlive a
    // teardown, so a host that resizes after the scene is gone must not drive
    // a destroyed canvas. Mounted **with** a resolver, so the media path is
    // live: an `updateArtboard` on a scene with no media returns early and
    // would never reach the guard at all.
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
    expect(
      element.querySelector("[data-vigilia-background-media] img"),
      "the media layer is live before teardown",
    ).not.toBeNull();

    scene.dispose();
    expect(
      element.querySelector("[data-vigilia-background-media] img"),
      "and gone after it",
    ).toBeNull();

    // Counted from here, so only a post-teardown allocation is in the tally.
    const original = document.createElement.bind(document);
    let createdAfterDispose = 0;
    (document as unknown as { createElement: typeof original }).createElement =
      ((name: string, options?: ElementCreationOptions) => {
        if (name === "img" || name === "video") createdAfterDispose += 1;
        return original(name, options);
      }) as typeof original;

    expect(() => {
      scene.resize();
      scene.update(plan());
      scene.updateArtboard({
        width: 400,
        height: 300,
        backgroundMedia: { assetId: "hero", fit: "contain" },
      });
    }).not.toThrow();
    // The DOM cannot show the leak, because `destroy()` removed the layer and
    // anything re-appended lands on a detached node. What it *does* show is
    // the allocation: an `updateArtboard` past the guard builds a fresh image
    // with a load listener, and nothing will ever release it.
    (document as unknown as { createElement: typeof original }).createElement =
      original;
    expect(createdAfterDispose, "a disposed scene allocates no new media").toBe(
      0,
    );
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
