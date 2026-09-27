// @vitest-environment jsdom

/**
 * The shared glass test stage.
 *
 * Its own file because both the composition suite and the lifecycle suite need
 * it, and duplicating it would put each of them over the size the project
 * treats as a stop. It is a test fixture, not a module: nothing outside
 * `*.dom.test.ts` imports it.
 */

import { Group, Point, Rect, StaticCanvas } from "fabric/es";
import { afterEach } from "vitest";
import { createGlass, type DeviceRect, type GlassHandle } from "./glass.js";

/**
 * What these tests can and cannot prove.
 *
 * `node-canvas` accepts `ctx.filter` and silently ignores it, so no test here
 * can show that a blur happened. They pin the composition around it — what is
 * sampled, what is excluded, what is clipped, what the radius converts to —
 * and the real blurred pixels are proved in the browser.
 *
 * A second limit, measured: jsdom hands `before:render` a context object that
 * is not the one `canvas.getContext()` returns, so the alpha Fabric has set
 * cannot be observed here. Tests that care about it set it from a listener
 * registered before the glass handler, which is the same position an ancestor
 * group's opacity occupies.
 */

export interface Draw {
  readonly alpha: number;
  readonly filter: string;
  readonly args: readonly number[];
}

export interface Stage {
  readonly canvas: StaticCanvas;
  readonly draws: Draw[];
  readonly errors: string[];
  readonly glass: GlassHandle;
  regions: DeviceRect[];
  paints: PaintCall[];
  /** Writes to `ctx.filter` of the probe's own value, which is how many times
   *  the capability was actually asked. */
  filterProbes: number;
  /** Makes the next glass composite throw, as a tainting draw would. */
  failNextComposite: boolean;
  pixel(x: number, y: number): readonly [number, number, number, number];
  destroy(): void;
}

const stages: Stage[] = [];

/** Vertical bars every `step` px, so a column identifies what is behind it. */
export function bars(
  width: number,
  height: number,
  step: number,
  on: string,
  off: string,
): Rect[] {
  const result: Rect[] = [];
  for (let x = 0; x < width; x += step)
    for (const [index, y] of [0, height / 2].entries())
      result.push(
        new Rect({
          left: x,
          top: y,
          width: step,
          height: height / 2,
          originX: "left",
          originY: "top",
          fill: (x / step) % 2 === index % 2 ? on : off,
          selectable: false,
          evented: false,
        }),
      );
  return result;
}

/** Records the rect the sampler hands the media, so a test can assert where
 *  the media was told to sit rather than only what it drew. */
export interface PaintCall {
  readonly region: DeviceRect;
  readonly device: DeviceRect;
}

export function stage(options: {
  readonly size?: number;
  readonly texture?: boolean;
  readonly artboard?: { readonly width: number; readonly height: number };
  readonly backdrop?: () => {
    paint(ctx: CanvasRenderingContext2D, region: DeviceRect): boolean;
  };
}): Stage {
  const size = options.size ?? 200;
  const canvas = new StaticCanvas(undefined, { width: size, height: size });
  const context = canvas.getContext() as CanvasRenderingContext2D;
  const draws: Draw[] = [];
  // `node-canvas` has no `ctx.filter` at all: it is an ordinary data property
  // that starts undefined and echoes whatever is written. The seam reproduces
  // that exactly, and counts the probe by the one value no panel ever asks for.
  let filterProbes = 0;
  let filterValue: unknown = context.filter;
  const originalFilter = Object.getOwnPropertyDescriptor(context, "filter");
  Object.defineProperty(context, "filter", {
    configurable: true,
    get: () => filterValue,
    set: (value: string) => {
      if (value === "blur(1px)") filterProbes += 1;
      filterValue = value;
    },
  });
  const original = context.drawImage.bind(context);
  (context as unknown as { drawImage: typeof original }).drawImage = ((
    ...args: unknown[]
  ) => {
    // Only the five-argument form is the glass composite; Fabric blits every
    // cached object with the two-argument one, and counting those would make
    // the object count look like a panel count.
    if (args.length === 5 && value.failNextComposite) {
      value.failNextComposite = false;
      throw new Error("SecurityError: tainted canvases may not be exported");
    }
    if (args.length === 5)
      draws.push({
        alpha: context.globalAlpha,
        filter: context.filter,
        args: args.slice(1).map((value) => Number(value)),
      });
    return (original as (...a: unknown[]) => unknown)(...args);
  }) as typeof original;

  if (options.texture !== false)
    for (const object of bars(size, size, 8, "#ffffff", "#000000"))
      canvas.add(object);

  const errors: string[] = [];
  const regions: Stage["regions"] = [];
  const paints: PaintCall[] = [];
  let destroyed = false;
  const glass = createGlass({
    canvas,
    // Omitted entirely unless asked for, so the "no media" cases really have none.
    ...(options.backdrop === undefined && options.artboard === undefined
      ? {}
      : {
          backdrop: () => ({
            artboard: options.artboard ?? { width: size, height: size },
            paint: (ctx, region, device) => {
              regions.push({ ...region });
              paints.push({ region: { ...region }, device: { ...device } });
              return options.backdrop?.().paint(ctx, region) ?? true;
            },
          }),
        }),
    onGlassError: (message) => errors.push(message),
  });

  const value: Stage = {
    canvas,
    draws,
    errors,
    glass,
    regions,
    paints,
    get filterProbes() {
      return filterProbes;
    },
    failNextComposite: false,
    pixel(x, y) {
      const d = context.getImageData(x, y, 1, 1).data;
      return [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0, d[3] ?? 0];
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      glass.dispose();
      void canvas.destroy();
      if (originalFilter === undefined)
        delete (context as unknown as Record<string, unknown>)["filter"];
      else Object.defineProperty(context, "filter", originalFilter);
    },
  };
  stages.push(value);
  return value;
}

afterEach(() => {
  for (const value of stages.splice(0)) value.destroy();
});

/** Spans (left, top) to (left + width, top + height); Fabric's own default
 * origin is centre, which would silently move every probe in these tests. */
export function panel(overrides: Record<string, unknown> = {}): Rect {
  return new Rect({
    left: 80,
    top: 80,
    width: 40,
    height: 40,
    originX: "left",
    originY: "top",
    rx: 0,
    ry: 0,
    fill: "rgba(255, 255, 255, 0.5)",
    vigiliaGlass: { blurRadius: 24 },
    ...overrides,
  });
}

export { Group, Point, Rect, StaticCanvas };
