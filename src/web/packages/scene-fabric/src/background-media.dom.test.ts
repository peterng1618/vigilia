// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { mountBackgroundMedia } from "./background-media.js";

describe("background media", () => {
  it("mounts fitted image media below the Fabric canvas and disposes its source", () => {
    const host = document.createElement("div");
    const canvas = document.createElement("canvas");
    host.append(canvas);
    let disposed = false;

    const handle = mountBackgroundMedia({
      host,
      artboard: {
        width: 400,
        height: 200,
        backgroundMedia: { assetId: "hero", fit: "contain" },
      },
      assets: [{ id: "hero", kind: "image", path: "assets/hero.png" }],
      resolveAsset: () => ({
        url: "blob:hero",
        dispose: () => {
          disposed = true;
        },
      }),
    });

    const image = host.querySelector<HTMLImageElement>(
      "[data-vigilia-background-media] img",
    );
    expect(image?.src).toBe("blob:hero");
    expect(image?.style.objectFit).toBe("contain");
    expect(
      host.firstElementChild?.hasAttribute("data-vigilia-background-media"),
    ).toBe(true);
    expect(host.lastElementChild).toBe(canvas);

    handle.destroy();

    expect(disposed).toBe(true);
    expect(host.querySelector("[data-vigilia-background-media]")).toBeNull();
  });

  it("mounts muted looping video media", () => {
    const host = document.createElement("div");
    const handle = mountBackgroundMedia({
      host,
      artboard: {
        width: 400,
        height: 200,
        backgroundMedia: { assetId: "loop", fit: "cover" },
      },
      assets: [{ id: "loop", kind: "video", path: "assets/loop.webm" }],
      resolveAsset: () => ({ url: "blob:loop" }),
    });

    const video = host.querySelector<HTMLVideoElement>(
      "[data-vigilia-background-media] video",
    );
    expect(video?.src).toBe("blob:loop");
    expect(video?.style.objectFit).toBe("cover");
    expect(video?.autoplay).toBe(true);
    expect(video?.muted).toBe(true);
    expect(video?.loop).toBe(true);
    expect(video?.playsInline).toBe(true);

    handle.destroy();
  });

  it("replaces the old source when its media changes", () => {
    const host = document.createElement("div");
    const disposed: string[] = [];
    const handle = mountBackgroundMedia({
      host,
      artboard: {
        width: 400,
        height: 200,
        backgroundMedia: { assetId: "one", fit: "cover" },
      },
      assets: [{ id: "one", kind: "image", path: "assets/one.png" }],
      resolveAsset: (id) => ({
        url: `blob:${id}`,
        dispose: () => {
          disposed.push(id);
        },
      }),
    });

    handle.update({
      artboard: {
        width: 400,
        height: 200,
        backgroundMedia: { assetId: "two", fit: "contain" },
      },
      assets: [{ id: "two", kind: "svg", path: "assets/two.svg" }],
      resolveAsset: (id) => ({
        url: `blob:${id}`,
        dispose: () => {
          disposed.push(id);
        },
      }),
    });

    expect(disposed).toEqual(["one"]);
    expect(host.querySelector("img")?.src).toBe("blob:two");
    expect(host.querySelector("img")?.style.objectFit).toBe("contain");
  });
});
