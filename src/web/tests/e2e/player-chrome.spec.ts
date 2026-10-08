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

/** The artboard's own aspect: `bars: {x: 0, y: 0}`, so there is no bar to hide in. */
const SQUARE_ON_SCREEN = { width: 1040, height: 780 } as const;

/** `?theme=portrait-cover`'s own artboard, from `packages/fake-source/src/themes/portrait-cover.json`. */
const POSTER = { width: 440, height: 956 } as const;

/** `?theme=assets`'s own artboard, from `packages/fake-source/src/themes/assets.json`. */
const ASSETS_ARTBOARD = { width: 960, height: 540 } as const;

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
    // **Every element the display adds, not just `body`'s direct children.** A
    // strip that re-fixes itself *inside* a band is out of flow, so the band
    // collapses to zero height and a direct-children check passes while the
    // strip covers the artboard — measured: with the crop strip restored to
    // `position: fixed`, this guard stayed green while all three geometry tests
    // failed. The host's own subtree is excluded, because everything the
    // renderer draws legitimately lives inside it.
    return [...document.body.querySelectorAll<HTMLElement>("*")]
      .filter((element) => element !== host && !host.contains(element))
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

test("a viewport the artboard would exactly fill still keeps the strip off it", async ({
  page,
}) => {
  // The artboard's own aspect, so `bars: {x: 0, y: 0}` and nowhere to hide.
  // Measured before this plan: the crop strip covered the top 28.8px of the
  // 780px viewport, full width, 3.7% of the composition. The column now takes
  // that room out of the viewport first: the artboard is fitted to 1040x722.4,
  // and the painted box is *shorter* than the viewport by the chrome's height —
  // which is the proof the strip took its room rather than being moved onto it.
  await page.setViewportSize(SQUARE_ON_SCREEN);
  await openCanvasPlayer(page, "/?theme=stress");
  await expect(page.locator("[data-vigilia-crop]")).toBeVisible();

  const geometry = await chromeGeometry(page, STRESS_ARTBOARD);

  expect(geometry.strips.length).toBeGreaterThan(0);
  expect(geometry.degenerate).toBe(false);
  expect(geometry.painted.h).toBeLessThan(SQUARE_ON_SCREEN.height);
  // Still a fit, not merely a move: `contain` fills its host on one axis.
  expect(geometry.painted.w).toBeLessThanOrEqual(geometry.host.w + 0.5);
  expect(geometry.painted.h).toBeLessThanOrEqual(geometry.host.h + 0.5);
  for (const strip of geometry.strips) {
    expect(
      overlap(strip.box, geometry.painted),
      `${strip.id} over the artboard`,
    ).toBe(0);
    expect(
      overlap(strip.box, geometry.host),
      `${strip.id} over the viewport`,
    ).toBe(0);
  }
});

test("a cover artboard, whose painted box is larger than its viewport, is not covered either", async ({
  page,
}) => {
  // `?theme=portrait-cover` at a landscape viewport: scale 1.9181818, so the
  // artboard is drawn 844 wide and 1833.8 tall into a 361px-tall host and
  // clipped to it. An assertion that the painted box fits inside the host is
  // false here by design — as is an assertion that the *unclipped* painted box
  // is clear of a strip, because that box runs the full height of the viewport
  // and therefore under the band a strip sits in. What a reader can lose is
  // pixels the canvas actually draws, and Fabric clips to the host, so the
  // discriminating check is the host overlap.
  await page.setViewportSize(PHONE.landscape);
  await openCanvasPlayer(page, "/?theme=portrait-cover");

  const geometry = await chromeGeometry(page, POSTER);
  await expect(
    page.locator("[data-vigilia-chrome-strip]").first(),
  ).toBeVisible();

  expect(geometry.degenerate).toBe(false);
  expect(geometry.strips.length).toBeGreaterThan(0);
  // Genuinely the cover case, not a quiet `contain`.
  expect(geometry.painted.h).toBeGreaterThan(geometry.host.h);
  // And there is visible artboard for a strip to cover, so the loop is not vacuous.
  expect(overlap(geometry.host, geometry.painted)).toBeGreaterThan(0);
  for (const candidate of geometry.strips) {
    expect(
      overlap(candidate.box, geometry.host),
      `${candidate.id} over the artboard`,
    ).toBe(0);
  }
});

test("a contained artboard raises no crop strip, and its one strip is beside it", async ({
  page,
}) => {
  // `?theme=assets` (960x540, `contain`) has nothing out of frame, so no crop
  // strip is raised; the fixture's synthetic-data disclosure is the only strip.
  // The compatibility claim this can pin on the preview bundle is the band's
  // arithmetic: the host is the viewport *less* the band, so the strip took its
  // room from the artboard rather than being drawn over it. (A preview display
  // can never have "nothing to say" — every fixture theme raises the scaffold
  // banner — which is why the empty case belongs to Task 2.3's real host.)
  await page.setViewportSize(PHONE.landscape);
  await openCanvasPlayer(page, "/?theme=assets");
  await expect(page.locator("[data-vigilia-crop]")).toHaveCount(0);

  const geometry = await chromeGeometry(page, ASSETS_ARTBOARD);
  const scaffold = geometry.strips.find(
    (strip) => strip.id === "vigilia-scaffold",
  );

  expect(geometry.strips).toHaveLength(1);
  expect(scaffold).toBeDefined();
  expect(geometry.degenerate).toBe(false);
  if (scaffold === undefined) throw new Error("no scaffold strip");
  expect(geometry.host.w).toBeCloseTo(PHONE.landscape.width, 0);
  // The band took the strip's height out of the viewport, so the two add up.
  expect(geometry.host.h + scaffold.box.h).toBeCloseTo(
    PHONE.landscape.height,
    0,
  );
  expect(overlap(scaffold.box, geometry.host)).toBe(0);
  expect(overlap(scaffold.box, geometry.painted)).toBe(0);
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
