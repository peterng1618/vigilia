import { expect, type Page } from "@playwright/test";
import { installFixedClock } from "./clock.js";

/**
 * Canvas-aware probes for the Fabric player path.
 *
 * A canvas exposes no elements, spans or computed style, so behaviour is read
 * through the scene handle the player already exposes for diagnostics
 * (`window.vigilia`). Only plain values cross the boundary — a Fabric object
 * would not survive it.
 */

export interface CanvasProbe {
  readonly objectCount: number;
  readonly ids: readonly string[];
  /** Top-level plus grouped descendants; plan nodes are matched by id. */
  readonly allIds: readonly string[];
  readonly viewportTransform: readonly number[];
  readonly canvasSize: { readonly width: number; readonly height: number };
  readonly retinaScaling: number;
  /** The oversample factor each chart object ended up with. */
  readonly chartRenderScales: readonly number[];
}

type HandleWindow = typeof window & {
  vigilia: { handle: Record<string, unknown> };
};

/**
 * Painted pixels on the artboard; 0 means nothing has been drawn yet.
 *
 * Anything non-zero counts as painted. The plate is a solid rect covering the
 * whole artboard, so every pixel that has been touched is opaque and nothing
 * that has not is transparent — a clean on/off, which is why this needs no
 * threshold and no notion of what colour the theme happens to use.
 */
async function drawnPixels(page: Page): Promise<number> {
  return page.evaluate(() => {
    const element = document.querySelector<HTMLCanvasElement>(
      'canvas[data-vigilia="artboard"]',
    );
    const context = element?.getContext("2d");

    if (element === null || context === null || context === undefined) {
      return 0;
    }

    const data = context.getImageData(0, 0, element.width, element.height).data;
    let drawn = 0;

    for (let i = 0; i < data.length; i += 4) {
      if (
        data[i] !== 0 ||
        data[i + 1] !== 0 ||
        data[i + 2] !== 0 ||
        data[i + 3] !== 0
      ) {
        drawn += 1;
      }
    }

    return drawn;
  });
}

/**
 * Opens the player on the default path, painted and settled.
 *
 * ## `static=1`, and how much simulated time this costs
 *
 * Entrance animation off means one frame paints the scene, so the wait is 100 ms
 * instead of 1500. That matters because `clock.runFor` is linear in simulated
 * time and pays it in browser-protocol round trips — measured on this machine,
 * ~4.5 ms wall per simulated ms: `runFor(1500)` alone is 8.2 s against a 495 ms
 * page load, and those waits were ~90% of this suite's wall time.
 *
 * `fastForward` is not a substitute: it is a flat ~120 ms but skips the
 * intermediate frames, and 10 cases need them to mount at all.
 *
 * The ink guard is load-bearing rather than decorative: what a shortened wait
 * can land on is a frame still blank, which would turn every ink assertion in
 * the file into a vacuous pass. Measured, a blank artboard is a real state —
 * 0 painted pixels at `runFor(500)` and `runFor(750)`.
 */
export async function openCanvasPlayer(
  page: Page,
  query = "/?theme=stress",
): Promise<void> {
  await installFixedClock(page);
  await page.goto(
    query.includes("?") ? `${query}&static=1` : `${query}?static=1`,
  );
  await page.waitForSelector('canvas[data-vigilia="artboard"]');
  // A chart whose content is entirely animated draws nothing until time advances.
  await page.clock.runFor(100);
  expect(await drawnPixels(page)).toBeGreaterThan(0);
}

/** Reads the scene through the handle the player already exposes. */
export async function probe(page: Page): Promise<CanvasProbe> {
  return page.evaluate(() => {
    const { handle } = (window as unknown as HandleWindow).vigilia;
    const canvas = handle["canvas"] as {
      getObjects(): { get(key: string): unknown }[];
      viewportTransform: number[];
      getWidth(): number;
      getHeight(): number;
      getRetinaScaling(): number;
    };
    const objects = canvas.getObjects();
    const all: string[] = [];
    const scales: number[] = [];

    const collect = (list: { get(key: string): unknown }[]): void => {
      for (const object of list) {
        all.push(String(object.get("id")));

        // By a property only a chart has, not by `type`: Fabric's instance
        // getter lower-cases the class name and its own source says not to
        // build on it ("DO NOT build new code around this type value").
        if (typeof object.get("family") === "string") {
          scales.push(Number(object.get("renderScale")));
        }

        const children = object.get("_objects");

        if (Array.isArray(children)) {
          collect(children as { get(key: string): unknown }[]);
        }
      }
    };

    collect(objects);

    return {
      objectCount: objects.length,
      ids: objects.map((object) => String(object.get("id"))),
      allIds: all,
      viewportTransform: [...canvas.viewportTransform],
      canvasSize: { width: canvas.getWidth(), height: canvas.getHeight() },
      retinaScaling: canvas.getRetinaScaling(),
      chartRenderScales: scales,
    };
  });
}

/** One scalar Fabric property; anything else means the probe asked wrong. */
export async function canvasProp(
  page: Page,
  nodeId: string,
  key: string,
): Promise<string | number | boolean | undefined> {
  return readObject(page, nodeId, key, isScalar);
}

/** Presence, for object-valued properties like shadows that cannot cross. */
export async function canvasHas(
  page: Page,
  nodeId: string,
  key: string,
): Promise<boolean> {
  // Checked in-page: values like clipPath hold circular refs that do not survive serialization.
  return (await readObject(page, nodeId, key)) !== undefined;
}

function isScalar(value: unknown): value is string | number | boolean {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

/** Read one Fabric property; missing means no such object. */
async function readObject<T = unknown>(
  page: Page,
  nodeId: string,
  key: string,
  guard?: (value: unknown) => value is T,
): Promise<T | undefined> {
  const value = await page.evaluate(
    ([id, prop]) => {
      const { handle } = (window as unknown as HandleWindow).vigilia;
      const adapter = handle["adapter"] as {
        objectFor(nodeId: string): { get(key: string): unknown } | undefined;
      };
      const canvas = handle["canvas"] as {
        getObjects(): { get(key: string): unknown }[];
      };
      // The adapter indexes what a plan applied, and a scene revived from a
      // saved package never went through one: there, the canvas is the index.
      const object =
        adapter.objectFor(id) ??
        canvas.getObjects().find((entry) => entry.get("id") === id);

      return object?.get(prop);
    },
    [nodeId, key] as const,
  );

  if (value === undefined || value === null) {
    return undefined;
  }

  return guard === undefined || guard(value) ? (value as T) : undefined;
}

/** True when data ticks update the node without replacing its object. */
export async function keepsObjectIdentity(
  page: Page,
  nodeId: string,
  runMs: number,
): Promise<boolean> {
  await page.evaluate((id) => {
    const { handle } = (window as unknown as HandleWindow).vigilia;
    const adapter = handle["adapter"] as {
      objectFor(nodeId: string): unknown;
    };

    Reflect.set(window, "__vigiliaMarked", adapter.objectFor(id));
  }, nodeId);

  await page.clock.runFor(runMs);

  return page.evaluate((id) => {
    const { handle } = (window as unknown as HandleWindow).vigilia;
    const adapter = handle["adapter"] as {
      objectFor(nodeId: string): unknown;
    };

    return (
      adapter.objectFor(id) ===
      (window as unknown as { __vigiliaMarked: unknown }).__vigiliaMarked
    );
  }, nodeId);
}

/**
 * How much of a region is drawn *over* its background, as a fraction of the
 * region's area.
 *
 * Not a count of non-transparent pixels: the artboard paints a background, so
 * every pixel inside it has alpha 255 and a missing node would still score 1.0.
 * The measure finds the region's most common colour — the background behind the
 * node on a flat artboard — and counts pixels that differ from it.
 *
 * Read off the canvas' own backing store rather than from a screenshot, so it
 * is unaffected by page scroll or PNG encoding. `region` is in **CSS** pixels;
 * the backing store may be larger, which is what the ratio corrects for.
 */
export async function drawnFractionIn(
  page: Page,
  region: { x: number; y: number; width: number; height: number },
): Promise<number> {
  return page.evaluate((box) => {
    const element = document.querySelector<HTMLCanvasElement>(
      'canvas[data-vigilia="artboard"]',
    );
    const context = element?.getContext("2d");

    if (element === null || context === null || context === undefined) {
      return -1;
    }

    const ratio = element.width / element.getBoundingClientRect().width;
    const width = Math.max(1, Math.round(box.width * ratio));
    const height = Math.max(1, Math.round(box.height * ratio));
    const data = context.getImageData(
      Math.round(box.x * ratio),
      Math.round(box.y * ratio),
      width,
      height,
    ).data;

    const counts = new Map<number, number>();

    for (let index = 0; index < data.length; index += 4) {
      // One integer per RGBA pixel, so the modal colour is a map lookup rather
      // than a string key per pixel.
      const key =
        ((data[index] ?? 0) << 24) |
        ((data[index + 1] ?? 0) << 16) |
        ((data[index + 2] ?? 0) << 8) |
        (data[index + 3] ?? 0);

      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    let background = 0;
    let commonest = 0;

    for (const [key, count] of counts) {
      if (count > commonest) {
        commonest = count;
        background = key;
      }
    }

    let drawn = 0;

    for (let index = 0; index < data.length; index += 4) {
      const key =
        ((data[index] ?? 0) << 24) |
        ((data[index + 1] ?? 0) << 16) |
        ((data[index + 2] ?? 0) << 8) |
        (data[index + 3] ?? 0);

      if (key !== background) {
        drawn += 1;
      }
    }

    return drawn / (width * height);
  }, region);
}

/**
 * The same measure, over one node's own box.
 *
 * The whole-frame version is too coarse to be a guard: it stayed happily over
 * its threshold while **every SVG icon in the assets fixture was missing**. The
 * geometry comes from the renderer itself — the object's bounding rect, mapped
 * through the viewport transform — rather than from a rectangle copied out of a
 * fixture, so it cannot drift from what is actually drawn.
 */
export async function drawnFractionOf(
  page: Page,
  nodeId: string,
): Promise<number> {
  const region = await page.evaluate((id) => {
    const { handle } = (window as unknown as HandleWindow).vigilia;
    const adapter = handle["adapter"] as {
      objectFor(nodeId: string):
        | {
            getBoundingRect(): {
              left: number;
              top: number;
              width: number;
              height: number;
            };
          }
        | undefined;
    };
    const object = adapter.objectFor(id);

    if (object === undefined) {
      return undefined;
    }

    const canvas = handle["canvas"] as { viewportTransform: number[] };
    const rect = object.getBoundingRect();
    const [scale = 1, , , , offsetX = 0, offsetY = 0] =
      canvas.viewportTransform;

    return {
      x: rect.left * scale + offsetX,
      y: rect.top * scale + offsetY,
      width: rect.width * scale,
      height: rect.height * scale,
    };
  }, nodeId);

  return region === undefined ? -1 : drawnFractionIn(page, region);
}

/** Fraction of a Fabric image's decoded source matching one RGB colour. */
export async function sourceColorFraction(
  page: Page,
  nodeId: string,
  color: readonly [number, number, number],
): Promise<number> {
  return page.evaluate(
    ([id, expected]) => {
      const { handle } = (window as unknown as HandleWindow).vigilia;
      const adapter = handle["adapter"] as {
        objectFor(
          nodeId: string,
        ): { getElement?(): HTMLCanvasElement } | undefined;
      };
      const source = adapter.objectFor(id)?.getElement?.();
      const context = source?.getContext("2d");

      if (source === undefined || context === null || context === undefined) {
        return -1;
      }

      const data = context.getImageData(0, 0, source.width, source.height).data;
      let opaque = 0;
      let matching = 0;

      for (let index = 0; index < data.length; index += 4) {
        if ((data[index + 3] ?? 0) === 0) {
          continue;
        }

        opaque += 1;

        if (
          Math.abs((data[index] ?? 0) - expected[0]) <= 2 &&
          Math.abs((data[index + 1] ?? 0) - expected[1]) <= 2 &&
          Math.abs((data[index + 2] ?? 0) - expected[2]) <= 2
        ) {
          matching += 1;
        }
      }

      return opaque === 0 ? 0 : matching / opaque;
    },
    [nodeId, color] as const,
  );
}
