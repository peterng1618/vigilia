import { expect, type Page, test } from "@playwright/test";
import { openCanvasPlayer } from "./canvas-probe.js";
import { captureVisualReview } from "./editor-canvas.js";

/**
 * What the display says about itself, and what it is allowed to cover.
 *
 * The requirement is a sentence about pixels — "diagnostics stop eating the
 * phone's best pixels" (spec :474) — so it is measured in pixels, at the two
 * phone shapes it was measured at when the plan was written. Both assertions
 * below are needed and they are not the same claim: `host` is the renderer's
 * own viewport, which a strip must be outside of *by construction*, and
 * `painted` is where the authored composition actually lands, which is the
 * thing a reader loses.
 */

const PHONE = {
  portrait: { width: 390, height: 844 },
  landscape: { width: 844, height: 390 },
} as const;

/** `?theme=stress`'s own artboard, from `packages/fake-source/src/themes/stress.json`. */
const STRESS_ARTBOARD = { width: 1024, height: 768 } as const;

interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

interface ChromeGeometry {
  readonly host: Box;
  readonly strips: readonly { readonly id: string; readonly box: Box }[];
  readonly painted: Box;
  readonly degenerate: boolean;
}

async function chromeGeometry(
  page: Page,
  artboard: { readonly width: number; readonly height: number },
): Promise<ChromeGeometry> {
  return page.evaluate((size) => {
    const box = (element: Element): Box => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
    };
    const host = document.querySelector<HTMLElement>("#artboard");
    if (host === null) throw new Error("the display has no artboard host");
    const handle = (
      window as unknown as {
        vigilia?: {
          handle?: {
            transform(): {
              scale: number;
              offsetX: number;
              offsetY: number;
              isDegenerate: boolean;
            };
          };
        };
      }
    ).vigilia?.handle;
    const transform = handle?.transform();
    if (transform === undefined) throw new Error("the display has no scene");

    const hostBox = box(host);
    return {
      host: hostBox,
      strips: [
        ...document.querySelectorAll<HTMLElement>(
          "[data-vigilia-chrome-strip]",
        ),
      ].map((strip) => ({ id: strip.id, box: box(strip) })),
      // The transform's offsets are relative to the host, the rects are not.
      painted: {
        x: hostBox.x + transform.offsetX,
        y: hostBox.y + transform.offsetY,
        w: size.width * transform.scale,
        h: size.height * transform.scale,
      },
      degenerate: transform.isDegenerate,
    };
  }, artboard);
}

/** Area shared by two boxes, in square CSS pixels. */
function overlap(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return Math.max(0, w) * Math.max(0, h);
}

for (const [name, viewport] of Object.entries(PHONE)) {
  test(`no strip covers the artboard at ${name} ${viewport.width}x${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await openCanvasPlayer(page, "/?theme=stress");
    await expect(page.locator("[data-vigilia-crop]")).toBeVisible();

    const geometry = await chromeGeometry(page, STRESS_ARTBOARD);

    // Something was actually said, or the rest of this test measures nothing.
    expect(geometry.strips.length).toBeGreaterThan(0);
    expect(geometry.degenerate).toBe(false);

    for (const strip of geometry.strips) {
      // The renderer's viewport excludes the chrome, by construction: the band
      // is a row of the column the artboard is fitted into.
      expect(
        overlap(strip.box, geometry.host),
        `${strip.id} over the viewport`,
      ).toBe(0);
      // And the authored composition is not covered, which is what a reader
      // loses. At 390x844 this one is already true of the old layout — the
      // strips sat on the letterbox bars — and at 844x390 it was not: 28.8px at
      // each end of a 390px artboard.
      expect(
        overlap(strip.box, geometry.painted),
        `${strip.id} over the artboard`,
      ).toBe(0);
    }

    // The artboard is still fitted to what is left, not merely moved: with
    // contain, the painted box must fill its host on one axis.
    expect(geometry.painted.w).toBeLessThanOrEqual(geometry.host.w + 0.5);
    expect(geometry.painted.h).toBeLessThanOrEqual(geometry.host.h + 0.5);
    expect(
      Math.abs(geometry.painted.w - geometry.host.w) < 0.5 ||
        Math.abs(geometry.painted.h - geometry.host.h) < 0.5,
      "the artboard was not refitted to the box the chrome left it",
    ).toBe(true);

    if (name === "landscape") {
      await captureVisualReview(page, testInfo, "player-chrome");
    }
  });
}

test("nothing else the display adds covers the artboard", async ({ page }) => {
  await page.setViewportSize(PHONE.landscape);
  await openCanvasPlayer(page, "/?theme=stress");
  await expect(page.locator("[data-vigilia-crop]")).toBeVisible();

  // The guard, not the fix: the requirement is a property of the display, and a
  // future notice appended to `document.body` with `position: fixed` would put
  // it back with nothing to catch it. Every element the display adds is either
  // the artboard host itself or outside it.
  const geometry = await chromeGeometry(page, STRESS_ARTBOARD);
  const intruders = await page.evaluate(() => {
    const box = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
    };
    const host = document.querySelector<HTMLElement>("#artboard");
    if (host === null) throw new Error("no host");
    const hostBox = box(host);
    return [...document.body.children]
      .filter((element) => element !== host)
      .map((element) => ({ id: element.id, box: box(element) }))
      .filter(({ box: candidate }) => {
        const w =
          Math.min(candidate.x + candidate.w, hostBox.x + hostBox.w) -
          Math.max(candidate.x, hostBox.x);
        const h =
          Math.min(candidate.y + candidate.h, hostBox.y + hostBox.h) -
          Math.max(candidate.y, hostBox.y);
        return Math.max(0, w) * Math.max(0, h) > 0;
      });
  });

  expect(geometry.strips.length).toBeGreaterThan(0);
  expect(intruders).toEqual([]);
});

test("the load-failure page is the whole display", async ({ page }) => {
  await page.setViewportSize(PHONE.landscape);
  await page.goto("/?theme=does-not-exist");

  const failure = page.locator("[data-vigilia-load-failure]");
  await expect(failure).toBeVisible();
  const box = (await failure.boundingBox())!;

  expect(box.x).toBeCloseTo(0, 0);
  expect(box.y).toBeCloseTo(0, 0);
  expect(box.width).toBeCloseTo(PHONE.landscape.width, 0);
  expect(box.height).toBeCloseTo(PHONE.landscape.height, 0);
});
