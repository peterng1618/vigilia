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
 * The statistic is a **located measure, never a mean**. A mean over a panel
 * stays identical whether a backdrop was blurred correctly, half-shifted or
 * tinted; a peak adjacent-column gradient does not.
 *
 * The band is placed from the panel's own device box, never from hand-picked
 * artboard coordinates. Three mistakes shaped that, each recorded because it
 * produced a confident wrong number first:
 *
 *  - `getElement()` on an interactive Fabric `Canvas` returns the **upper**
 *    canvas, the interaction layer. The scene is on `lowerCanvasEl`.
 *  - A band that reaches the panel's own 2px stroke reads a composite of about
 *    240 as content, and two statistics then passed **vacuously** on an empty
 *    band. The band is placed inside the straight part and its row count is
 *    asserted.
 *  - The first column that reaches the minimum is a flat run's **left edge**,
 *    not its centre — a 30px error on a marker this wide. Positions are run
 *    midpoints.
 */

/** The x window the band covers; its rows come from the panel's device box. */
export const BANDS = { panel: { left: 336, width: 120 } } as const;

interface Band {
  /** Mean luminance of each column in the band. */
  readonly means: readonly number[];
  /** Largest adjacent-column step. */
  readonly peakGradient: number;
  readonly darkest: number;
  readonly brightest: number;
}

interface Run {
  /** Backing-store x of the run's midpoint. */
  readonly centre: number;
}

export interface Reading {
  /** Rows the backdrop band actually covers. An empty band makes every
   *  statistic vacuously pass, so it is asserted rather than assumed. */
  readonly bandRows: number;
  readonly glass: Band;
  /** The same band read out of the media image itself, unblurred. */
  readonly reference: Band;
  readonly glassRun: Run;
  readonly referenceRun: Run;
  /** The marker centre, which needs a level near the media's own darkness. */
  readonly referenceCentre: number;
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

/** Where in a profile's own range a run is counted. */
const MARKER_LEVEL = 0.15;
/** Near the bright end: a blur bleeds the marker's darkness outward, and that
 *  is the only level at which the widening is visible. At the midpoint the
 *  blurred flanks are still below the level in both profiles. */
const BLEED_LEVEL = 0.85;

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
    const scope = window as unknown as {
      vigilia?: { handle: { canvas: FabricCanvas } };
      vigiliaEditorBridge?: { editor: { canvas: FabricCanvas } };
    };
    const canvas =
      scope.vigilia?.handle.canvas ?? scope.vigiliaEditorBridge?.editor.canvas;
    canvas?.renderAll();
  });
}

export async function readGlass(page: Page): Promise<Reading> {
  await waitForMedia(page);
  return page.evaluate(
    (input) => {
      const { bands, STRIPE_X, STRIPE_WIDTH, SOURCE_WIDTH, marker, bleed } =
        input;
      const scope = window as unknown as {
        vigilia?: { handle: { canvas: FabricCanvas } };
        vigiliaEditorBridge?: { editor: { canvas: FabricCanvas } };
      };
      const canvas =
        scope.vigilia?.handle.canvas ??
        scope.vigiliaEditorBridge?.editor.canvas;
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

      /** Column means, and the extrema **of those means**. Taking the extrema
       *  per pixel instead put the level below whole runs of columns, which is
       *  the scale mismatch this replaced. */
      const band = (read: (x: number, y: number) => number): Band => {
        const columns = Math.max(1, right - left + 1);
        const means = new Array<number>(columns).fill(0);
        for (let y = bandTop; y <= bandBottom; y += 1)
          for (let x = left; x <= right; x += 1) means[x - left] += read(x, y);
        const rows = bandBottom - bandTop + 1;
        for (let i = 0; i < columns; i += 1) means[i] /= rows;
        let peakGradient = 0;
        for (let i = 1; i < columns; i += 1) {
          const step = Math.abs(means[i] - means[i - 1]);
          if (step > peakGradient) peakGradient = step;
        }
        return {
          means,
          peakGradient,
          darkest: Math.min(...means),
          brightest: Math.max(...means),
        };
      };

      /** The midpoint of the columns below `level`: the first and last index
       *  under it, which is the hull of possibly-disjoint runs rather than one
       *  run. On this band they are contiguous and the two agree.
       *
       *  Each profile gets **its own** level - the same fraction of its own
       *  range, not the same absolute luminance. That is deliberate: a blurred
       *  profile is lifted and lower-contrast, so one absolute level would fall
       *  in a different part of each profile's range and bias the comparison.
       *  It is also why this is only ever compared within one profile - the
       *  earlier "the dark run gets wider" claim compared across two, and that
       *  asymmetry is exactly what made it meaningless. */
      const run = (b: Band, fraction: number): Run => {
        const means = b.means;
        const level = b.darkest + fraction * (b.brightest - b.darkest);
        let first = -1;
        let last = -1;
        for (let i = 0; i < means.length; i += 1) {
          const value = means[i];
          if (value === undefined || value > level) continue;
          if (first < 0) first = i;
          last = i;
        }
        if (first < 0) first = 0;
        if (last < first) last = first;

        return { centre: left + Math.round((first + last) / 2) };
      };

      const glass = band(luma);
      const reference = band(referenceLuma);
      // The marker's own centre needs a level near the media's darkness, not the
      // bleed level: at 0.85 the dark bars fall below it too.
      const referenceCentre = run(reference, marker).centre;
      return {
        bandRows: bandBottom - bandTop + 1,
        glass,
        reference,
        glassRun: run(glass, bleed),
        referenceRun: run(reference, bleed),
        referenceCentre,
        expectedCentre,
        mediaReady: image.naturalWidth > 0,
      };
    },
    {
      bands: BANDS,
      STRIPE_X: GLASS_STRIPE_SOURCE_X,
      STRIPE_WIDTH: GLASS_STRIPE_SOURCE_WIDTH,
      SOURCE_WIDTH: GLASS_MEDIA_SOURCE.width,
      marker: MARKER_LEVEL,
      bleed: BLEED_LEVEL,
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

  // **The blur evidence, and it is two-sided on purpose.** A tint over a
  // transparent canvas gives a peak gradient of *zero*, which passes "under a
  // third" on its own; an unblurred copy of the media gives the media's own
  // gradient, which fails it. Only the pair rejects both, and both numbers come
  // from the same band.
  expect(
    glass.peakGradient,
    `${label}: the backdrop is softened under the panel (panel ${glass.peakGradient.toFixed(1)} vs media ${reference.peakGradient.toFixed(1)})`,
  ).toBeLessThan(reference.peakGradient / 3);
  expect(
    glass.peakGradient,
    `${label}: the panel is not a flat wash (a tint over an empty canvas scores 0)`,
  ).toBeGreaterThan(0.5);
  expect(
    glass.brightest - glass.darkest,
    `${label}: the panel carries backdrop detail`,
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
    Math.abs(reading.referenceCentre - reading.expectedCentre),
    `${label}: the media layer is where its geometry puts it (measured ${reading.referenceCentre}, expected ${Math.round(reading.expectedCentre)})`,
  ).toBeLessThanOrEqual(4);
  // 2. The panel shows the media behind it, measured against the *same* media
  //    read from the same band.
  //
  //    Measured, not assumed: the panel's run centre lands **2px** from the
  //    media's, and the media's own centre is exact against its derived
  //    position. The tolerance is 6 - three times the observed residual, and far
  //    inside the panel's width, so a sampler that shifted the media by a
  //    panel's width still cannot pass.
  //
  //    (An earlier round carried a 14px residual and a one-blur-radius
  //    tolerance here. Both belonged to a fixture with a different marker and
  //    bar pitch, and the 14px was the run detector picking up the media's
  //    fragmented bar runs rather than the marker. It was re-measured, not
  //    inherited.)
  expect(
    Math.abs(reading.glassRun.centre - reading.referenceRun.centre),
    `${label}: the panel shows the media behind it (panel ${reading.glassRun.centre}, media ${reading.referenceRun.centre})`,
  ).toBeLessThanOrEqual(6);
}
