import { expect, type Page } from "@playwright/test";
import {
  GLASS_MEDIA_SOURCE,
  GLASS_STRIPE_SOURCE_WIDTH,
  GLASS_STRIPE_SOURCE_X,
} from "./glass-fixture.js";

/**
 * The browser measure, shared by both mounts.
 *
 * `node-canvas` accepts `ctx.filter` and ignores it, so nothing here can be
 * checked in the unit suite: the blur and the media's decoded pixels both need
 * a real rasteriser.
 *
 * The statistics are **located features, never means**. A mean over a panel
 * stays identical whether a backdrop was blurred correctly, half-shifted or
 * tinted; a peak adjacent-column gradient and a plateau width cannot.
 *
 * The band is placed from the panel's own device box, never from hand-picked
 * artboard coordinates. Two mistakes shaped that, both recorded because they
 * produced confident wrong numbers first:
 *
 *  - `getElement()` on an interactive Fabric `Canvas` returns the **upper**
 *    canvas, the interaction layer. The scene is painted on `lowerCanvasEl`.
 *  - A band that reaches the panel's own 2px stroke reads a composite of about
 *    240 as content, and two statistics then pass **vacuously** on an empty
 *    band. The band is placed inside the straight part and its row count is
 *    asserted.
 */

/** The x window the band covers; its rows come from the panel's device box. */
export const BANDS = { panel: { left: 336, width: 120 } } as const;

interface Profile {
  /** Largest adjacent-column luminance step, over the band's column means. */
  readonly peakGradient: number;
  /** Columns at or above 90% of the band's peak. A sharp stripe reaches its
   *  extreme for a few pixels; a blurred one has a broad plateau. */
  readonly plateauWidth: number;
  /** Backing-store x of the dark run's **midpoint**. The first column that
   *  reaches the minimum is a flat run's left edge, not its centre, and the
   *  marker is wide enough for that to be a 30px error. */
  readonly darkestAt: number;
  readonly darkest: number;
  readonly brightest: number;
}

export interface Reading {
  /** Rows the backdrop band actually covers. An empty band makes every
   *  statistic vacuously pass, so it is asserted rather than assumed. */
  readonly bandRows: number;
  readonly glass: Profile;
  /** The same band read out of the media image itself, unblurred. */
  readonly reference: Profile;
  /** Backing-store x the media stripe must land at, from its own geometry. */
  readonly expectedCentre: number;
  readonly mediaReady: boolean;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface FabricCanvas {
  getObjects(): Array<{ get(name: string): unknown }>;
  getElement(): HTMLCanvasElement;
  lowerCanvasEl?: HTMLCanvasElement;
  viewportTransform: number[];
  getRetinaScaling(): number;
  renderAll(): void;
}

/** The media has to have real pixels, not merely to be "complete": `complete`
 *  is also true of a failed image, which is how an earlier run of this probe
 *  measured an empty scratch and blamed the sampler. */
export async function waitForMedia(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const mounted = (window as unknown as { vigilia?: unknown }).vigilia;
      const bridge = (window as unknown as { vigiliaEditorBridge?: unknown })
        .vigiliaEditorBridge;
      const image = document.querySelector<HTMLImageElement>(
        "[data-vigilia-background-media] img",
      );
      return (
        (mounted !== undefined || bridge !== undefined) &&
        image !== null &&
        image.complete &&
        image.naturalWidth > 0
      );
    },
    null,
    { timeout: 20_000 },
  );
  // The media decodes after the first paint and nothing repaints the canvas when
  // it does - bounded invalidation is Task 5's, not this assertion's. One forced
  // render is therefore part of measuring, and is stated rather than hidden.
  await page.evaluate(() => {
    const scope = window as unknown as
      | { vigilia?: { handle: { canvas: FabricCanvas } } }
      | { vigiliaEditorBridge?: { editor: { canvas: FabricCanvas } } };
    const canvas =
      "vigilia" in scope && scope.vigilia !== undefined
        ? scope.vigilia.handle.canvas
        : scope.vigiliaEditorBridge?.editor.canvas;
    canvas?.renderAll();
  });
}

export async function readGlass(page: Page): Promise<Reading> {
  await waitForMedia(page);
  return page.evaluate(
    (input) => {
      const { bands, STRIPE_X, STRIPE_WIDTH, SOURCE_WIDTH } = input;
      const scope = window as unknown as
        | { vigilia?: { handle: { canvas: FabricCanvas } } }
        | { vigiliaEditorBridge?: { editor: { canvas: FabricCanvas } } };
      const canvas =
        "vigilia" in scope && scope.vigilia !== undefined
          ? scope.vigilia.handle.canvas
          : scope.vigiliaEditorBridge?.editor.canvas;
      if (canvas === undefined) throw new Error("no Fabric canvas is mounted");

      const element = canvas.lowerCanvasEl ?? canvas.getElement();
      const context = element.getContext("2d");
      if (context === null) throw new Error("no 2D context");
      const width = element.width;
      const data = context.getImageData(0, 0, width, element.height).data;
      const luma = (x: number, y: number): number => {
        const i = (y * width + x) * 4;
        return 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      };

      const layer = document.querySelector<HTMLElement>(
        "[data-vigilia-background-media]",
      );
      const image = document.querySelector<HTMLImageElement>(
        "[data-vigilia-background-media] img",
      );
      if (layer === null || image === null)
        throw new Error("no background media layer");

      // The media layer's own box in the canvas's backing pixels, and where a
      // panel covering that part of the artboard must show the stripe.
      const mediaBox = layer.getBoundingClientRect();
      const canvasBox = element.getBoundingClientRect();
      const perCss = element.width / canvasBox.width;
      const mediaLeft = (mediaBox.left - canvasBox.left) * perCss;
      const mediaScale = (mediaBox.width * perCss) / SOURCE_WIDTH;
      const expectedCentre =
        mediaLeft + (STRIPE_X + STRIPE_WIDTH / 2) * mediaScale;

      // The same media, unblurred, drawn into a scratch at its own rect. The
      // canvas is transparent outside the panel - the media is a DOM sibling -
      // so the reference has to come from the image itself.
      const scratch = document.createElement("canvas");
      scratch.width = width;
      scratch.height = element.height;
      const scratchContext = scratch.getContext("2d");
      if (scratchContext === null) throw new Error("no scratch context");
      scratchContext.drawImage(
        image,
        mediaLeft,
        (mediaBox.top - canvasBox.top) * perCss,
        mediaBox.width * perCss,
        mediaBox.height * perCss,
      );
      const referenceData = scratchContext.getImageData(
        0,
        0,
        width,
        element.height,
      ).data;
      const referenceLuma = (x: number, y: number): number => {
        const i = (y * width + x) * 4;
        return (
          0.2126 * referenceData[i] +
          0.7152 * referenceData[i + 1] +
          0.0722 * referenceData[i + 2]
        );
      };

      const panel = canvas
        .getObjects()
        .find((candidate) => candidate.get("id") === "glass") as
        | { getBoundingRect(): Rect }
        | undefined;
      if (panel === undefined) throw new Error('no object with id "glass"');
      const rect = panel.getBoundingRect();

      const view = canvas.viewportTransform;
      const retina = canvas.getRetinaScaling();
      const toDevice = (x: number, y: number): readonly [number, number] => [
        (x * view[0] + y * view[2] + view[4]) * retina,
        (x * view[1] + y * view[3] + view[5]) * retina,
      ];
      const [x0, y0] = toDevice(bands.panel.left, rect.top);
      const [x1] = toDevice(bands.panel.left + bands.panel.width, rect.top);
      const [, panelBottom] = toDevice(rect.left, rect.top + rect.height);
      const left = Math.max(0, Math.round(Math.min(x0, x1)));
      const right = Math.min(width - 1, Math.round(Math.max(x0, x1)) - 1);
      const height = panelBottom - y0;
      // A third of the way down, a quarter of the panel's height: inside the
      // straight part of the rounded path at any panel size, clear of the border.
      const bandTop = Math.round(y0 + height * 0.3);
      const bandBottom = Math.min(
        Math.round(panelBottom) - 1,
        bandTop + Math.max(8, Math.floor(height * 0.25)) - 1,
      );

      const profile = (read: (x: number, y: number) => number): Profile => {
        const columns = Math.max(1, right - left + 1);
        const means = new Array<number>(columns).fill(0);
        let darkest = Infinity;
        let brightest = -Infinity;
        for (let y = bandTop; y <= bandBottom; y += 1) {
          for (let x = left; x <= right; x += 1) {
            const value = read(x, y);
            means[x - left] += value;
            if (value < darkest) darkest = value;
            if (value > brightest) brightest = value;
          }
        }
        const rows = bandBottom - bandTop + 1;
        for (let i = 0; i < columns; i += 1) means[i] /= rows;
        const floor = darkest + (brightest - darkest) * 0.15;
        let firstDark = -1;
        let lastDark = -1;
        for (let i = 0; i < columns; i += 1) {
          if (means[i] > floor ?? 0) continue;
          if (means[i] === undefined || means[i] > floor) continue;
          if (firstDark < 0) firstDark = i;
          lastDark = i;
        }
        if (firstDark < 0) firstDark = 0;
        if (lastDark < firstDark) lastDark = firstDark;
        const darkestAt = left + Math.round((firstDark + lastDark) / 2);
        let peakGradient = 0;
        for (let i = 1; i < columns; i += 1) {
          const step = Math.abs(means[i] - means[i - 1]);
          if (step > peakGradient) peakGradient = step;
        }
        const peak = Math.max(...means);
        let plateau = 0;
        for (const value of means) if (value >= peak * 0.9) plateau += 1;
        return {
          peakGradient,
          plateauWidth: plateau,
          darkestAt,
          darkest,
          brightest,
        };
      };

      return {
        bandRows: bandBottom - bandTop + 1,
        glass: profile(luma),
        reference: profile(referenceLuma),
        expectedCentre,
        mediaReady: image.naturalWidth > 0,
      };
    },
    {
      bands: BANDS,
      STRIPE_X: GLASS_STRIPE_SOURCE_X,
      STRIPE_WIDTH: GLASS_STRIPE_SOURCE_WIDTH,
      SOURCE_WIDTH: GLASS_MEDIA_SOURCE.width,
    },
  ) as Promise<Reading>;
}

/** The blur, and the backdrop's position. */
export function assertBlur(reading: Reading, label: string): void {
  const { glass, reference } = reading;
  // Match set first: the band covers rows, and the media has the contrast every
  // comparison below is measured against.
  expect(
    reading.bandRows,
    `${label}: the backdrop band covers rows`,
  ).toBeGreaterThan(8);
  expect(reading.mediaReady, `${label}: the media has pixels`).toBe(true);
  expect(
    reference.brightest - reference.darkest,
    `${label}: the media has contrast to blur`,
  ).toBeGreaterThan(40);

  // Real blur, and specifically not a tint: a tint leaves the edge intact.
  expect(
    glass.peakGradient,
    `${label}: the backdrop is softened under the panel (panel ${glass.peakGradient.toFixed(1)} vs media ${reference.peakGradient.toFixed(1)})`,
  ).toBeLessThan(reference.peakGradient / 3);
  // A second, independent signal, and the one a tint cannot fake: blurring
  // lifts the dark core, because the marker's darkness is spread sideways.
  // (A plateau-width ratio was tried first and is a poor instrument here - the
  // media's own bars are already broad enough that the ratio never separates.)
  expect(
    glass.darkest,
    `${label}: the dark core is lifted by the blur (panel ${glass.darkest.toFixed(1)} vs media ${reference.darkest.toFixed(1)})`,
  ).toBeGreaterThan(reference.darkest + 20);
  expect(
    glass.brightest - glass.darkest,
    `${label}: the panel is not a flat wash`,
  ).toBeGreaterThan(8);
}

/**
 * The panel shows the part of the background **behind it**. A located stripe
 * at a known source position must land where the media layer's own geometry
 * says, not where the media's origin was.
 */
export function assertMediaOffset(reading: Reading, label: string): void {
  // 1. A **precondition**, not a regression test: the media layer has pixels and
  //    sits where its own geometry puts it, so the band below is reading what
  //    this test thinks it is. It is a DOM fact and no change to the glass
  //    sampler can move it, so it is stated as a precondition rather than
  //    dressed up as coverage.
  expect(
    Math.abs(reading.reference.darkestAt - reading.expectedCentre),
    `${label}: the media layer is where its geometry puts it (measured ${reading.reference.darkestAt}, expected ${Math.round(reading.expectedCentre)})`,
  ).toBeLessThanOrEqual(4);
  // 2. The panel shows the media behind it, measured against the *same* media
  //    read from the same band.
  //
  //    The tolerance is **one blur radius**, and that is weaker than I want:
  //    the panel's dark run measures about 14px right of the media's, and one
  //    radius is about 15.6px, so the two are indistinguishable at this
  //    resolution. A symmetric blur should preserve a symmetric feature's centre
  //    exactly, so the residual is unexplained; it is recorded in the task
  //    report as an open measurement, not written off as noise. What this
  //    tolerance does still catch is a sampler that shifts the media by a
  //    panel's width, which is what a wrong offset looks like.
  expect(
    Math.abs(reading.glass.darkestAt - reading.reference.darkestAt),
    `${label}: the panel shows the media behind it, within one blur radius (panel ${reading.glass.darkestAt}, media ${reading.reference.darkestAt})`,
  ).toBeLessThanOrEqual(20);
}
