import { expect, type Page, test } from "@playwright/test";
import {
  BACKGROUND_LAYER_INK,
  BACKGROUND_LAYER_PAINT,
  HOST_BACKGROUND_LAYER_THEME_ID,
  HOST_PORT,
} from "./host-theme.js";

/**
 * The background media layer on the real player: the authored transform is
 * visible, and the layer clips it.
 *
 * The theme (`host-theme.ts`) is a narrow source placed with `contain`,
 * `scale: 1.4` and `offsetX: 0.25` in a wide board, so the placed rect leaves
 * the board's top and bottom edges on every viewport — the clip is a place on
 * screen, not an off-screen coordinate. Every expected rect is derived here
 * from the measured layer rect and the image's natural size, so no assertion
 * carries a viewport-sized pixel number.
 */

const HOST = `http://127.0.0.1:${HOST_PORT}`;

/** The fixture's artboard, also the layer's own box (`bounds: "theme"`). */
const ARTBOARD = { width: 640, height: 200 } as const;
/** The authored media transform, verbatim from the fixture. */
const MEDIA = { scale: 1.4, offsetX: 0.25, offsetY: 0 } as const;
/** The glass panel's authored box, so the pixel reads can aim inside it. */
const PANEL = { left: 420, top: 20, width: 120, height: 120 } as const;
/** The panel's authored fill, `rgba(255, 255, 255, 0.10)`: the glass is
 *  translucent, so what a panel pixel shows is the blur of what is behind it
 *  with this much white over it. */
const PANEL_WHITE_ALPHA = 0.1;

interface Rect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

interface Geometry {
  readonly host: Rect;
  readonly layer: Rect;
  readonly media: Rect;
  readonly natural: { readonly width: number; readonly height: number };
  readonly transform: {
    readonly scale: number;
    readonly offsetX: number;
    readonly offsetY: number;
  };
}

/** Reads the host, the layer and the placed child in one sample, so a live
 *  re-fit cannot make an assertion compare two different moments. */
function readGeometry(page: Page): Promise<Geometry> {
  return page.evaluate(() => {
    const host = document.querySelector<HTMLElement>("#artboard");
    const layer = document.querySelector<HTMLElement>(
      "[data-yunari-background-media]",
    );
    const media = layer?.querySelector<HTMLImageElement>("img");
    if (
      host === null ||
      layer === null ||
      media === undefined ||
      media === null
    ) {
      throw new Error("the background media layer is not mounted");
    }
    const toRect = (element: Element) => {
      const box = element.getBoundingClientRect();
      return {
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      };
    };
    const handle = (
      window as unknown as {
        yunari: {
          handle: {
            transform(): {
              scale: number;
              offsetX: number;
              offsetY: number;
            };
          };
        };
      }
    ).yunari.handle;
    const transform = handle.transform();
    return {
      host: toRect(host),
      layer: toRect(layer),
      media: toRect(media),
      natural: { width: media.naturalWidth, height: media.naturalHeight },
      transform: {
        scale: transform.scale,
        offsetX: transform.offsetX,
        offsetY: transform.offsetY,
      },
    };
  });
}

/** The placement oracle, written from the contract rather than imported: a test
 *  that called the renderer's own `placement()` could agree with it while both
 *  were wrong. `contain` only — the fixture's fit. */
function containedPlacement(
  box: { readonly width: number; readonly height: number },
  source: { readonly width: number; readonly height: number },
): Rect {
  const factor = Math.min(box.width / source.width, box.height / source.height);
  const width = source.width * factor * MEDIA.scale;
  const height = source.height * factor * MEDIA.scale;
  return {
    left: (box.width * (1 + 2 * MEDIA.offsetX)) / 2 - width / 2,
    top: (box.height * (1 + 2 * MEDIA.offsetY)) / 2 - height / 2,
    width,
    height,
  };
}

const within = (actual: number, expected: number, label: string): void => {
  expect(
    Math.abs(actual - expected),
    `${label}: expected ${expected.toFixed(2)} px, read ${actual.toFixed(2)} px`,
  ).toBeLessThanOrEqual(1);
};

interface Pixel {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/**
 * Samples one screenshot pixel per viewport point, in one decode.
 *
 * The bitmap is denser than the page on a phone (device pixel ratio), so the
 * conversion is the bitmap's own width over the element's, not a constant.
 */
async function samplePixels(
  page: Page,
  shot: string,
  points: readonly { readonly x: number; readonly y: number }[],
): Promise<Pixel[]> {
  return page.evaluate(
    async ([data, targets]) => {
      const bytes = Uint8Array.from(atob(data!), (char) => char.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes]));
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (context === null) throw new Error("no 2d context for the screenshot");
      context.drawImage(bitmap, 0, 0);
      const host = document
        .querySelector<HTMLElement>("#artboard")!
        .getBoundingClientRect();
      const scaleX = bitmap.width / host.width;
      const scaleY = bitmap.height / host.height;
      return targets.map((point) => {
        const x = Math.round((point.x - host.left) * scaleX);
        const y = Math.round((point.y - host.top) * scaleY);
        const pixel = context.getImageData(x, y, 1, 1).data;
        return { r: pixel[0]!, g: pixel[1]!, b: pixel[2]! };
      });
    },
    [shot, points] as const,
  );
}

const expectPixel = (
  actual: Pixel | undefined,
  expected: { readonly r: number; readonly g: number; readonly b: number },
  label: string,
): void => {
  expect(actual, `${label}: a pixel was read`).toBeDefined();
  expect(Math.abs(actual!.r - expected.r), `${label}: red`).toBeLessThanOrEqual(
    12,
  );
  expect(
    Math.abs(actual!.g - expected.g),
    `${label}: green`,
  ).toBeLessThanOrEqual(12);
  expect(
    Math.abs(actual!.b - expected.b),
    `${label}: blue`,
  ).toBeLessThanOrEqual(12);
};

/** The largest per-channel difference between two sampled colours. */
function channelDistance(a: Pixel, b: Pixel): number {
  return Math.max(
    Math.abs(a.r - b.r),
    Math.abs(a.g - b.g),
    Math.abs(a.b - b.b),
  );
}

/** What the translucent panel shows when a flat colour is behind it. The
 *  backdrop is blurred, and the blur of one flat source is that source, so the
 *  panel's own fill is the whole composite for this fixture. */
function panelOver(base: Pixel): Pixel {
  const mix = (channel: number): number =>
    Math.round(channel * (1 - PANEL_WHITE_ALPHA) + 255 * PANEL_WHITE_ALPHA);
  return { r: mix(base.r), g: mix(base.g), b: mix(base.b) };
}

test.describe("the background media layer on the player", () => {
  test("places the media by its authored transform and clips it to the board", async ({
    page,
  }, testInfo) => {
    await page.goto(`${HOST}/?theme=${HOST_BACKGROUND_LAYER_THEME_ID}`);
    await expect(page.locator("#artboard canvas.lower-canvas")).toBeVisible();
    // The layer is the claim; without it every pixel below would read the
    // host's paint and pass for the wrong reason.
    await expect(
      page.locator("[data-yunari-background-media]"),
      "the player mounted a background media layer",
    ).toHaveCount(1);
    // The layer mounts before its bytes decode, and the placement that needs
    // the natural size lands on `load`; a read before that is a read of the
    // fallback rect.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const image = document.querySelector<HTMLImageElement>(
              "[data-yunari-background-media] img",
            );
            return image !== null && image.complete && image.naturalWidth > 0;
          }),
        { timeout: 20_000 },
      )
      .toBe(true);
    await page.waitForTimeout(400);

    const geometry = await readGeometry(page);
    expect(geometry.natural.width, "the source decoded").toBeGreaterThan(0);
    expect(geometry.transform.scale, "the board is on screen").toBeGreaterThan(
      0,
    );

    // 1. The layer is the board's screen rect.
    const board: Rect = {
      left: geometry.host.left + geometry.transform.offsetX,
      top: geometry.host.top + geometry.transform.offsetY,
      width: ARTBOARD.width * geometry.transform.scale,
      height: ARTBOARD.height * geometry.transform.scale,
    };
    within(geometry.layer.left, board.left, "layer left");
    within(geometry.layer.top, board.top, "layer top");
    within(geometry.layer.width, board.width, "layer width");
    within(geometry.layer.height, board.height, "layer height");

    // 2. The child is the placement rect, computed from the measured layer and
    //    the source's own size rather than from a pixel number in this file.
    const placed = containedPlacement(
      { width: geometry.layer.width, height: geometry.layer.height },
      geometry.natural,
    );
    within(
      geometry.media.left,
      geometry.layer.left + placed.left,
      "media left",
    );
    within(geometry.media.top, geometry.layer.top + placed.top, "media top");
    within(geometry.media.width, placed.width, "media width");
    within(geometry.media.height, placed.height, "media height");

    // 3. The child really does overhang its clip, or the clip cases below would
    //    pass on a layer that never clipped anything.
    expect(
      geometry.media.top,
      "the placed media hangs above the board, so the clip has something to cut",
    ).toBeLessThan(geometry.layer.top - 2);
    expect(
      geometry.media.top + geometry.media.height,
      "the placed media hangs below the board",
    ).toBeGreaterThan(geometry.layer.top + geometry.layer.height + 2);

    // 4. The pixels. Points are viewport coordinates derived from the measured
    //    rects; the expected colours are the fixture's own paint and ink.
    const scaleX = geometry.layer.width / ARTBOARD.width;
    const scaleY = geometry.layer.height / ARTBOARD.height;
    const artboardPoint = (x: number, y: number) => ({
      x: geometry.layer.left + x * scaleX,
      y: geometry.layer.top + y * scaleY,
    });
    const panelBottom = PANEL.top + PANEL.height;
    const points = [
      // Inside the board, left of the media (which starts at x 410 units).
      artboardPoint(100, 100),
      // Inside the media and below the glass panel, which ends at y 140.
      artboardPoint(480, panelBottom + 50),
      // Above the layer, inside the overhanging child: the clip's own claim.
      {
        x: geometry.layer.left + 480 * scaleX,
        y: (geometry.media.top + geometry.layer.top) / 2,
      },
      // Below the layer, likewise inside the child.
      {
        x: geometry.layer.left + 480 * scaleX,
        y:
          (geometry.layer.top +
            geometry.layer.height +
            geometry.media.top +
            geometry.media.height) /
          2,
      },
      // Inside the glass panel's own rect, which sits wholly inside the media
      // strip: the panel is what Task 7's backdrop sampler reads, so this probes
      // the sampler's answer rather than the DOM layer's.
      artboardPoint(500, 80),
    ];

    const screenshot = await page.locator("#artboard").screenshot();
    await testInfo.attach("background-layer.png", {
      body: screenshot,
      contentType: "image/png",
    });
    const pixels = await samplePixels(
      page,
      screenshot.toString("base64"),
      points,
    );

    expectPixel(
      pixels[0],
      BACKGROUND_LAYER_PAINT,
      "where the media does not cover, the background colour shows",
    );
    expectPixel(
      pixels[1],
      BACKGROUND_LAYER_INK,
      "inside the placed rect, the media's own ink shows",
    );
    expectPixel(
      pixels[2],
      BACKGROUND_LAYER_PAINT,
      "above the layer, the clipped child paints nothing",
    );
    expectPixel(
      pixels[3],
      BACKGROUND_LAYER_PAINT,
      "below the layer, the clipped child paints nothing",
    );

    // 5. Inside the glass panel, which the fixture places wholly inside the
    //    media. A panel pixel is the backdrop the glass sampler read, blurred
    //    and tinted; the same pixel over the bare paint is what the sampler
    //    would produce if the layer and the sampler had drifted apart.
    const panelMedia = panelOver(BACKGROUND_LAYER_INK);
    const panelPaint = panelOver(BACKGROUND_LAYER_PAINT);
    expect(
      channelDistance(panelMedia, panelPaint),
      "the two possible panel readings are far enough apart to tell apart",
    ).toBeGreaterThan(120);
    const panel = pixels[4];
    expect(panel, "the panel's pixel was read").toBeDefined();
    expect(
      channelDistance(panel!, panelMedia),
      `inside the glass, the media shows through the panel: read ${JSON.stringify(panel)}, expected about ${JSON.stringify(panelMedia)}`,
    ).toBeLessThanOrEqual(30);
    expect(
      channelDistance(panel!, panelPaint),
      "inside the glass, the panel does not sample the bare paint",
    ).toBeGreaterThan(60);
  });
});
