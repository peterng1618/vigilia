// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { mediaDrawArgs, mountBackgroundMedia } from "./background-media.js";

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

  it("reports an unresolvable declared background instead of dropping it", () => {
    const host = document.createElement("div");
    const errors: string[] = [];
    const handle = mountBackgroundMedia({
      host,
      artboard: {
        width: 400,
        height: 200,
        backgroundMedia: { assetId: "missing", fit: "cover" },
      },
      assets: [{ id: "hero", kind: "image", path: "assets/hero.png" }],
      resolveAsset: () => ({ url: "blob:hero" }),
      onMediaError: (message) => errors.push(message),
    });

    expect(errors).toEqual([
      'Background media asset "missing" is not declared by this theme.',
    ]);
    expect(
      host.querySelector("[data-vigilia-background-media] img"),
    ).toBeNull();

    // A declared-but-unreadable asset reports too, rather than no-opping.
    handle.update({
      artboard: {
        width: 400,
        height: 200,
        backgroundMedia: { assetId: "hero", fit: "cover" },
      },
      assets: [{ id: "hero", kind: "image", path: "assets/hero.png" }],
      resolveAsset: () => undefined,
      onMediaError: (message) => errors.push(message),
    });

    expect(errors[1]).toBe(
      'Background media asset "hero" has no readable bytes.',
    );
    handle.destroy();
  });
});

describe("background media as a glass backdrop", () => {
  const artboard = {
    width: 400,
    height: 200,
    backgroundMedia: { assetId: "hero", fit: "cover" },
  } as const;

  it("has nothing to sample without a declared, resolvable background", () => {
    const host = document.createElement("div");
    const handle = mountBackgroundMedia({
      host,
      artboard: { width: 400, height: 200 },
      assets: [],
      resolveAsset: () => ({ url: "blob:hero" }),
    });
    expect(handle.backdrop()).toBeUndefined();

    handle.update({
      artboard,
      assets: [],
      resolveAsset: () => ({ url: "blob:hero" }),
    });
    // Declared but undeclared by this theme: already reported, and nothing to draw.
    expect(handle.backdrop()).toBeUndefined();
    handle.destroy();
  });

  it("crops to the element's object-fit at the media layer's own offset", () => {
    // 200x100 source cover-cropped into a 400x400 device box placed at (60, 20).
    const covered = mediaDrawArgs({
      sourceWidth: 200,
      sourceHeight: 100,
      fit: "cover",
      deviceLeft: 60,
      deviceTop: 20,
      deviceWidth: 400,
      deviceHeight: 400,
      region: { left: 0, top: 0, width: 800, height: 800 },
    });
    // Cover takes the wider scale, crops the source symmetrically, and centres
    // the overflow vertically: [sx, sy, sw, sh, dx, dy, dw, dh].
    expect(covered).toEqual([-300, -150, 800, 400, -140, 20, 800, 400]);

    const contained = mediaDrawArgs({
      sourceWidth: 200,
      sourceHeight: 100,
      fit: "contain",
      deviceLeft: 60,
      deviceTop: 20,
      deviceWidth: 400,
      deviceHeight: 400,
      region: { left: 0, top: 0, width: 800, height: 800 },
    });
    // Contain letterboxes instead, and the bars stay where the element shows them.
    expect(contained).toEqual([-100, -50, 400, 200, 60, 120, 400, 200]);
  });

  it("keeps a source feature at the same place in the region it is sampled for", () => {
    // The open question: a panel away from the media's origin must show the
    // part of the background actually behind it, not the part at the origin.
    // Sampling into a region that starts at x=200 must shift the media by the
    // same amount, or the wallpaper slides under the panel.
    const atOrigin = mediaDrawArgs({
      sourceWidth: 200,
      sourceHeight: 100,
      fit: "cover",
      deviceLeft: 0,
      deviceTop: 0,
      deviceWidth: 400,
      deviceHeight: 200,
      region: { left: 0, top: 0, width: 600, height: 400 },
    });
    const shifted = mediaDrawArgs({
      sourceWidth: 200,
      sourceHeight: 100,
      fit: "cover",
      deviceLeft: 0,
      deviceTop: 0,
      deviceWidth: 400,
      deviceHeight: 200,
      region: { left: 200, top: 0, width: 600, height: 400 },
    });
    // Same crop, moved left by exactly the region's own left offset.
    expect(shifted.slice(0, 4)).toEqual(atOrigin.slice(0, 4));
    expect((shifted[4] ?? 0) - (atOrigin[4] ?? 0)).toBe(-200);
    // A stripe at the source's horizontal centre lands at the box's centre in
    // both, which is what makes a located feature testable at all.
    expect((atOrigin[4] ?? 0) + (atOrigin[6] ?? 0) / 2).toBe(200);
  });

  it("follows video frames and starts no loop without a video", () => {
    const scheduled: (() => void)[] = [];
    const cancelled: number[] = [];
    const proto = HTMLVideoElement.prototype as unknown as {
      requestVideoFrameCallback: (cb: () => void) => number;
      cancelVideoFrameCallback: (handle: number) => void;
    };
    const hadCallbacks = "requestVideoFrameCallback" in proto;
    proto.requestVideoFrameCallback = (cb) => {
      scheduled.push(cb);
      return scheduled.length;
    };
    proto.cancelVideoFrameCallback = (handle) => cancelled.push(handle);

    try {
      const host = document.createElement("div");
      let frames = 0;
      const still = mountBackgroundMedia({
        host,
        artboard,
        assets: [{ id: "hero", kind: "image", path: "assets/hero.png" }],
        resolveAsset: () => ({ url: "blob:hero" }),
        onFrame: () => {
          frames += 1;
        },
      });
      // An image background is not a moving thing; no loop may start for it.
      expect(scheduled).toHaveLength(0);
      expect(frames).toBe(0);
      still.destroy();

      const moving = mountBackgroundMedia({
        host,
        artboard: {
          ...artboard,
          backgroundMedia: { assetId: "loop", fit: "cover" },
        },
        assets: [{ id: "loop", kind: "video", path: "assets/loop.webm" }],
        resolveAsset: () => ({ url: "blob:loop" }),
        onFrame: () => {
          frames += 1;
        },
      });
      expect(scheduled).toHaveLength(1);
      scheduled[0]?.();
      expect(frames).toBe(1);
      // It re-arms, or the loop would run exactly once.
      expect(scheduled).toHaveLength(2);
      moving.destroy();
      expect(cancelled).toHaveLength(1);
      // Nothing may fire after teardown.
      const before = frames;
      scheduled.forEach((cb) => cb());
      expect(frames).toBe(before);

      if (!hadCallbacks) {
        delete (proto as Record<string, unknown>)["requestVideoFrameCallback"];
        delete (proto as Record<string, unknown>)["cancelVideoFrameCallback"];
      }
    } finally {
      if (!hadCallbacks) {
        delete (proto as Record<string, unknown>)["requestVideoFrameCallback"];
        delete (proto as Record<string, unknown>)["cancelVideoFrameCallback"];
      }
    }
  });

  it("keeps following frames across a reconfiguration that omits onFrame", () => {
    // The subscription is taken at mount. Two shipped paths reconfigure the
    // media without restating it - the editor's `setArtboard`, and its
    // `setBackgroundMedia` remount - and both used to stop the video cold.
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
    proto.cancelVideoFrameCallback = () => {};

    try {
      const host = document.createElement("div");
      let frames = 0;
      const handle = mountBackgroundMedia({
        host,
        artboard: {
          ...artboard,
          backgroundMedia: { assetId: "loop", fit: "cover" },
        },
        assets: [{ id: "loop", kind: "video", path: "assets/loop.webm" }],
        resolveAsset: () => ({ url: "blob:loop" }),
        onFrame: () => {
          frames += 1;
        },
      });
      expect(scheduled).toHaveLength(1);

      // A same-media reconfiguration, as `updateArtboard` performs it.
      handle.update({
        artboard: {
          ...artboard,
          backgroundMedia: { assetId: "loop", fit: "cover" },
        },
        assets: [{ id: "loop", kind: "video", path: "assets/loop.webm" }],
        resolveAsset: () => ({ url: "blob:loop" }),
      });
      expect(
        scheduled,
        "the video is followed again after update",
      ).toHaveLength(2);
      // The schedule grows by one per armed loop, and firing a frame re-arms
      // it, so everything after this point is a delta rather than a count.
      scheduled[1]?.();
      expect(frames, "a frame still reaches the host").toBe(1);

      // A switch to a different video, as `setBackgroundMedia` performs it.
      const afterFire = scheduled.length;
      handle.update({
        artboard: {
          ...artboard,
          backgroundMedia: { assetId: "other", fit: "cover" },
        },
        assets: [{ id: "other", kind: "video", path: "assets/other.webm" }],
        resolveAsset: () => ({ url: "blob:other" }),
      });
      expect(scheduled.length, "the new video is followed too").toBe(
        afterFire + 1,
      );

      // And back to an image, which must stop following entirely.
      const afterSwitch = scheduled.length;
      handle.update({
        artboard,
        assets: [{ id: "hero", kind: "image", path: "assets/hero.png" }],
        resolveAsset: () => ({ url: "blob:hero" }),
      });
      expect(scheduled.length, "an image starts no loop").toBe(afterSwitch);
      handle.destroy();
    } finally {
      if (!had) {
        delete (proto as Record<string, unknown>)["requestVideoFrameCallback"];
        delete (proto as Record<string, unknown>)["cancelVideoFrameCallback"];
      }
    }
  });
});
