import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { writeThemePackage } from "@vigilia/theme-package";
import { glassStripesPng } from "./glass-fixture.js";

/**
 * The editor preview `playwright.config.ts` starts, as `glass.spec.ts` does.
 *
 * **This was `page.goto("/")`, which resolved against `use.baseURL` — the
 * *player* at 4173.** Every step below is an editor affordance: a theme file
 * input, `#status`, `canvas.lower-canvas`. On the player, `open()` waited out
 * its 20 s image poll and then sat on the `#status` expectation for the rest of
 * the budget, so the test reported a timeout and said nothing whatever about
 * glass. The 240s/300s budgets were never too small; the page was never the
 * editor. A relative URL here names the config, and the config names the player.
 */
const EDITOR = "http://127.0.0.1:4174/";

/**
 * Does a frosted Circle carry the same material as a frosted Rect of the same
 * box?
 *
 * The report was *"the glass blur strength on circle is way stronger than glass
 * on rect at the same value. not that glass isn't working on circle."*
 *
 * Two different things could produce it, and they are not the same finding. A
 * **coverage fault** is the sampled region failing to cover the clipped shape,
 * so part of the disc carries frost with no backdrop behind it — a defect, and
 * `glass-shapes.dom.test.ts` pins it for all five shapes. A **geometric
 * difference** is the region covering the shape, the material being identical,
 * and the disc still reading differently because it has less backdrop behind it
 * than the box around it — not a defect.
 *
 * This answers which of the two it is, in a browser, on both the backdrops the
 * report can be confused by: the reference theme's own photograph, and stripes
 * whose 64 px pitch is past twice the radius so a blur's strength is readable.
 *
 * **Everything except the outline is held constant.** One shape per scene, the
 * same artboard, the same backdrop, the same box, the same radius, the same
 * 30 % fill. Only `type` differs between the two solo captures.
 *
 * Every capture is a **screenshot**, decoded in Node: a readback on the live
 * canvas races Fabric's repaint. The frost is **located by differencing** each
 * capture against its own untreated control rather than by deriving a probe
 * from the page's transform — an earlier version did the latter and put its
 * probe about 70 px from the shape, so every number it printed described a
 * patch of bare photograph and the two shapes agreed because the probe was on
 * neither of them.
 */

/** The reference theme's own artboard and backdrop, where the report was seen. */
const PHOTOGRAPH = { width: 1672, height: 941 } as const;
/** Smaller, for the stripes that carry detail a photograph does not. */
const STRIPES = { width: 1200, height: 800 } as const;

/** The reported repro, verbatim: same position, same 260x260 box. */
const BOX = { left: 470, top: 300, size: 260 } as const;
const RADIUS = 24;

/** The product's own frost token: a 30 % tint that transmits. */
const FROST = "#0815234d";

type Kind = "Rect" | "Circle";
type Backdrop = "photograph" | "stripes";
/**
 * `stacked` and `reversed` are the two frosted shapes at one position, in each
 * paint order. They are the control that separates a fault in the circle's own
 * composite from the density of two panels sharing one spot.
 */
type Scene = Kind | "stacked" | "reversed" | `${Kind}-bare`;

function objectFor(kind: Kind, frosted: boolean): Record<string, unknown> {
  const common = {
    version: "7.4.0" as const,
    originX: "left" as const,
    originY: "top" as const,
    left: BOX.left,
    top: BOX.top,
    vigiliaPaint: { fill: "palette.frost" },
    fill: FROST,
    ...(frosted ? { vigiliaGlass: { blurRadius: RADIUS } } : {}),
  };
  if (kind === "Circle")
    return { ...common, id: "probe", type: "Circle", radius: BOX.size / 2 };
  return {
    ...common,
    id: "probe",
    type: "Rect",
    width: BOX.size,
    height: BOX.size,
    rx: 0,
    ry: 0,
  };
}

function objectsFor(scene: Scene): Record<string, unknown>[] {
  switch (scene) {
    case "Rect":
      return [objectFor("Rect", true)];
    case "Circle":
      return [objectFor("Circle", true)];
    case "stacked":
      return [
        { ...objectFor("Rect", true), id: "probe-under" },
        objectFor("Circle", true),
      ];
    case "reversed":
      return [
        { ...objectFor("Circle", true), id: "probe-under" },
        objectFor("Rect", true),
      ];
    case "Rect-bare":
      return [objectFor("Rect", false)];
    case "Circle-bare":
      return [objectFor("Circle", false)];
  }
}

function packageFor(scene: Scene, backdrop: Backdrop): Uint8Array {
  const photograph = readFileSync(
    fileURLToPath(
      new URL(
        "../../packages/editor/src/starter-backdrop.jpg",
        import.meta.url,
      ),
    ),
  );
  const asset =
    backdrop === "photograph"
      ? {
          id: "backdrop",
          kind: "image" as const,
          path: "assets/backdrop.jpg",
          license: {
            name: "Vigilia",
            attribution: "Starter backdrop, shipped with the editor.",
          },
        }
      : {
          id: "stripes",
          kind: "image" as const,
          path: "assets/stripes.png",
          license: { name: "MIT", attribution: "Vigilia test fixture." },
        };
  const written = writeThemePackage({
    envelope: {
      schemaVersion: 2 as const,
      fabricVersion: "7.4.0" as const,
      id: `probe-${scene}-${backdrop}`,
      metadata: { name: "Glass shape parity", themeLanguage: "en" },
      artboard: {
        ...(backdrop === "photograph" ? PHOTOGRAPH : STRIPES),
        contentFit: "contain" as const,
        background: { ref: "palette.none" as const },
        barColor: { ref: "palette.bar" as const },
        backgroundMedia: { assetId: asset.id, fit: "cover" as const },
      },
      globals: {
        palette: {
          none: {
            name: "None",
            value: { kind: "solid" as const, color: "transparent" },
          },
          bar: {
            name: "Bar",
            value: { kind: "solid" as const, color: "#101318" },
          },
          frost: {
            name: "Frost",
            value: { kind: "solid" as const, color: FROST },
          },
        },
      },
      assets: [asset],
      scene: { version: "7.4.0" as const, objects: objectsFor(scene) },
    },
    assets:
      backdrop === "photograph"
        ? { "assets/backdrop.jpg": photograph }
        : { "assets/stripes.png": glassStripesPng() },
  });
  if (!written.ok) throw new Error(written.message);
  return written.bytes;
}

async function open(
  page: Page,
  scene: Scene,
  backdrop: Backdrop,
): Promise<void> {
  const name = `probe-${scene}-${backdrop}.vigilia-theme`;
  await page.locator('input[accept=".vigilia-theme"]').setInputFiles({
    name,
    mimeType: "application/octet-stream",
    buffer: Buffer.from(packageFor(scene, backdrop)),
  });
  await expect(page.locator("#status")).toHaveText(`Opened ${name}`);
  await page.waitForFunction(
    () => {
      const image = document.querySelector<HTMLImageElement>(
        "[data-vigilia-background-media] img",
      );
      return image !== null && image.complete && image.naturalWidth > 0;
    },
    null,
    { timeout: 20_000 },
  );
  // The media decodes after the first paint and nothing repaints on decode.
  await page.evaluate(() => {
    const scope = window as unknown as Record<string, unknown>;
    const key = Object.keys(scope).find((c) =>
      c.startsWith("vigilia-fabric-editor"),
    );
    (
      scope[key ?? ""] as { canvas: { renderAll(): void } } | undefined
    )?.canvas.renderAll();
  });
  // Two animation frames, so the capture is of a frame the compositor produced.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function shoot(page: Page, scene: Scene, backdrop: Backdrop) {
  await open(page, scene, backdrop);
  return page.locator("canvas.lower-canvas").screenshot();
}

/**
 * 6/255: above what a PNG round-trip and the 1.5 % grain leave behind, and far
 * below the tens of luma a 30 % tint and a blur of this backdrop move.
 */
const THRESHOLD = 6;

interface Frame {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

async function decode(shot: Buffer): Promise<Frame> {
  const { createCanvas, loadImage } = await import("canvas");
  const image = await loadImage(shot);
  const surface = createCanvas(image.width, image.height);
  const context = surface.getContext("2d");
  context.drawImage(image, 0, 0);
  return {
    width: image.width,
    height: image.height,
    data: context.getImageData(0, 0, image.width, image.height).data,
  };
}

const luma = (frame: Frame, x: number, y: number): number => {
  const i = (y * frame.width + x) * 4;
  return (
    0.2126 * (frame.data[i] ?? 0) +
    0.7152 * (frame.data[i + 1] ?? 0) +
    0.0722 * (frame.data[i + 2] ?? 0)
  );
};

/** Where the treatment landed: the box of the pixels the two captures differ on. */
interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

function frostBox(frosted: Frame, bare: Frame): Box | undefined {
  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  let area = 0;
  for (let y = 0; y < frosted.height; y += 1)
    for (let x = 0; x < frosted.width; x += 1)
      if (Math.abs(luma(frosted, x, y) - luma(bare, x, y)) > THRESHOLD) {
        area += 1;
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
  // A scene the treatment never reached measures nothing.
  return area === 0 ? undefined : { left, top, right, bottom };
}

/** A capture's field over a disc, which is what two shapes can be compared on. */
interface Field {
  readonly mean: number;
  readonly range: number;
  /** Mean absolute step between horizontally adjacent pixels. */
  readonly detail: number;
  readonly pixels: number;
}

function overDisc(frame: Frame, cx: number, cy: number, radius: number): Field {
  let sum = 0;
  let count = 0;
  let low = Number.POSITIVE_INFINITY;
  let high = Number.NEGATIVE_INFINITY;
  let detail = 0;
  for (let y = Math.round(cy - radius); y <= cy + radius; y += 1)
    for (let x = Math.round(cx - radius); x <= cx + radius; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > radius * radius) continue;
      if (x < 0 || y < 0 || x >= frame.width || y >= frame.height) continue;
      const value = luma(frame, x, y);
      sum += value;
      count += 1;
      if (value < low) low = value;
      if (value > high) high = value;
      if (x + 1 < frame.width)
        detail += Math.abs(luma(frame, x + 1, y) - value);
    }
  return {
    mean: count === 0 ? Number.NaN : sum / count,
    range: count === 0 ? Number.NaN : high - low,
    detail: count === 0 ? Number.NaN : detail / count,
    pixels: count,
  };
}

/**
 * The disc every capture in a comparison is measured over.
 *
 * A **shared** disc rather than each shape's own: the diff that locates the
 * frost erodes by a fraction of a pixel at the blur's own edge falloff, so two
 * shapes at the same box come out with boxes about a pixel apart, and over the
 * stripes that is 0.56 luma of apparent difference on identical material — the
 * measurement finding its own edge rather than the shape's. The intersection of
 * the boxes, at 90 % of its half-width, is inside every one of them.
 */
function commonDisc(
  boxes: readonly (Box | undefined)[],
): { cx: number; cy: number; radius: number } | undefined {
  const present = boxes.filter((b): b is Box => b !== undefined);
  const first = present[0];
  if (first === undefined) return undefined;
  const left = Math.max(...present.map((b) => b.left));
  const right = Math.min(...present.map((b) => b.right));
  const top = Math.max(...present.map((b) => b.top));
  const bottom = Math.min(...present.map((b) => b.bottom));
  return {
    cx: (left + right) / 2,
    cy: (top + bottom) / 2,
    radius: 0.45 * Math.min(right - left, bottom - top),
  };
}

test.describe("a frosted circle and a frosted rect of the same box", () => {
  test.setTimeout(240_000);
  for (const backdrop of ["stripes", "photograph"] as const)
    test(`carry the same material over the ${backdrop}`, async ({
      page,
    }, testInfo) => {
      await page.goto(EDITOR);
      const shots = {
        rect: await shoot(page, "Rect", backdrop),
        circle: await shoot(page, "Circle", backdrop),
        stacked: await shoot(page, "stacked", backdrop),
        reversed: await shoot(page, "reversed", backdrop),
        rectBare: await shoot(page, "Rect-bare", backdrop),
        circleBare: await shoot(page, "Circle-bare", backdrop),
      };
      for (const [label, body] of Object.entries(shots)) {
        writeFileSync(
          `test-results/glass-parity-${backdrop}-${label}.png`,
          body,
        );
        await testInfo.attach(`${backdrop}-${label}.png`, {
          body,
          contentType: "image/png",
        });
      }

      // Each frosted capture against the untreated control of the shape that is
      // **underneath** it, so the difference is the extra panel and not a
      // change of backdrop.
      const decoded = {
        rect: await decode(shots.rect),
        circle: await decode(shots.circle),
        stacked: await decode(shots.stacked),
        reversed: await decode(shots.reversed),
        rectBare: await decode(shots.rectBare),
        circleBare: await decode(shots.circleBare),
      };
      const boxes = {
        rect: frostBox(decoded.rect, decoded.rectBare),
        circle: frostBox(decoded.circle, decoded.circleBare),
        stacked: frostBox(decoded.stacked, decoded.rectBare),
        reversed: frostBox(decoded.reversed, decoded.circleBare),
      };
      for (const [label, box] of Object.entries(boxes))
        expect(box, `${label} reached the backdrop at all`).toBeDefined();

      /** Both solo shapes over the one disc they share. */
      const solo = commonDisc([boxes.rect, boxes.circle]);
      /** Both paint orders over the one disc they share. */
      const pair = commonDisc([boxes.stacked, boxes.reversed]);
      if (solo === undefined || pair === undefined) return;

      const fields = {
        rect: overDisc(decoded.rect, solo.cx, solo.cy, solo.radius),
        circle: overDisc(decoded.circle, solo.cx, solo.cy, solo.radius),
        stacked: overDisc(decoded.stacked, pair.cx, pair.cy, pair.radius),
        reversed: overDisc(decoded.reversed, pair.cx, pair.cy, pair.radius),
        rectBare: overDisc(decoded.rectBare, solo.cx, solo.cy, solo.radius),
        circleBare: overDisc(decoded.circleBare, solo.cx, solo.cy, solo.radius),
      };
      console.log(
        `FROST === backdrop ${backdrop} ` +
          `soloDisc r=${solo.radius.toFixed(1)} pairDisc r=${pair.radius.toFixed(1)}`,
      );
      for (const [label, f] of Object.entries(fields))
        console.log(
          `FROST ${label.padEnd(11)} mean=${f.mean.toFixed(2)} ` +
            `range=${f.range.toFixed(2)} detail=${f.detail.toFixed(3)} ` +
            `px=${f.pixels}`,
        );

      // **The same material over the area both shapes carry.**
      //
      // Not over each shape's own footprint: a disc covers less of its box than
      // a rect does, so those areas differ by construction and a mean over them
      // compares the outlines rather than the material. The shared disc is the
      // only region both carry, and it is where "the circle is stronger" would
      // show if the material differed.
      expect(
        Math.abs(fields.rect.mean - fields.circle.mean),
        `a frosted circle carries the rect's material over the area they share (${fields.rect.mean.toFixed(2)} vs ${fields.circle.mean.toFixed(2)})`,
      ).toBeLessThan(0.5);
      expect(
        Math.abs(fields.rect.detail - fields.circle.detail),
        "and diffuses it by the same amount",
      ).toBeLessThan(0.05);

      // **The control.** The two untreated scenes are the same backdrop under
      // the same 30 % tint, so they are what the frosted pair is read against.
      expect(
        Math.abs(fields.rectBare.mean - fields.circleBare.mean),
        "the two untreated scenes measure the same backdrop",
      ).toBeLessThan(1.5);

      // **The stacking control.** Two frosted panels at one position read
      // denser than either alone, because the upper panel's blur samples the
      // lower panel's frost rather than the backdrop. Inverting the paint order
      // reproduces it, which places the extra density in the overlap and not in
      // the outline.
      expect(
        Math.abs(fields.stacked.mean - fields.reversed.mean),
        `two frosted panels read the same whichever is on top (${fields.stacked.mean.toFixed(2)} vs ${fields.reversed.mean.toFixed(2)})`,
      ).toBeLessThan(2.5);
      expect(
        fields.stacked.mean,
        "and both are denser than either shape alone",
      ).toBeLessThan(fields.rect.mean - 10);
    });
});
