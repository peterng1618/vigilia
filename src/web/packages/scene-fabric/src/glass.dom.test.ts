// @vitest-environment jsdom

import { Group, Point, Rect, StaticCanvas } from "fabric/es";
import { afterEach, describe, expect, it } from "vitest";
import { createGlass, type DeviceRect, type GlassHandle } from "./glass.js";

/**
 * What these tests can and cannot prove.
 *
 * `node-canvas` accepts `ctx.filter` and silently ignores it, so no test here
 * can show that a blur happened. They pin the composition around it — what is
 * sampled, what is excluded, what is clipped, what the radius converts to —
 * and the real blurred pixels are proved in the browser.
 */

interface Draw {
  readonly alpha: number;
  readonly filter: string;
  readonly args: readonly number[];
}

interface Stage {
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
function bars(
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

/** Records the rect the sampler hands the media, so a test can assert where the
 *  media was told to sit rather than only what it drew. */
interface PaintCall {
  readonly region: DeviceRect;
  readonly device: DeviceRect;
}

function stage(options: {
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
function panel(overrides: Record<string, unknown> = {}): Rect {
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

describe("glass composition", () => {
  it("samples the backdrop, not the panel's own already-painted fill", () => {
    const withGlass = stage({});
    const without = stage({});
    for (const s of [withGlass, without]) {
      s.canvas.add(
        new Rect({
          left: 0,
          top: 0,
          width: 200,
          height: 200,
          originX: "left",
          originY: "top",
          fill: "#000000",
          selectable: false,
          evented: false,
        }),
      );
    }
    const glassed = panel();
    withGlass.canvas.add(glassed);
    without.canvas.add(panel());
    withGlass.canvas.renderAll();
    without.canvas.renderAll();

    // Prove the probe is where it is meant to be: inside the panel, on the
    // uniform black plate, and away from its edges.
    expect(glassed.containsPoint(new Point(100, 100))).toBe(true);
    const withValue = withGlass.pixel(100, 100);
    const plain = without.pixel(100, 100);
    // 50% white over black is 127 either way, so a *uniform* plate cannot tell
    // a correct sample from a self-sampled one. What separates them is the
    // clip: with the clip the panel returns to exactly the untinted value, and
    // a self-sampled panel would come back lighter, because the sampled region
    // would already carry the fill.
    expect(plain[0]).toBeGreaterThan(120);
    expect(plain[0]).toBeLessThan(135);
    expect(withValue).toEqual(plain);
    expect(withGlass.draws).toHaveLength(1);
  });

  it("leaves an object painted after the panel bit-for-bit unchanged", () => {
    const withGlass = stage({});
    const without = stage({});
    for (const s of [withGlass, without]) {
      s.canvas.add(panel());
      s.canvas.add(
        new Rect({
          left: 84,
          top: 84,
          width: 4,
          height: 32,
          originX: "left",
          originY: "top",
          fill: "#ff0000",
          selectable: false,
          evented: false,
        }),
      );
    }
    withGlass.canvas.renderAll();
    without.canvas.renderAll();

    // Prove the bar is really there before claiming it survived.
    expect(without.pixel(86, 100)[0]).toBe(255);
    expect(without.pixel(86, 100)[1]).toBe(0);
    for (const y of [90, 100, 110])
      expect(withGlass.pixel(86, y)).toEqual(without.pixel(86, y));
  });

  it("lets an overlapping panel sample the earlier one that is already painted", () => {
    const withGlass = stage({});
    const without = stage({});
    const probe = { x: 110, y: 100 };
    // The earlier panel covers 60..120; the glass panel 80..140, so the
    // intersection is 80..120 x 80..120 and the probe sits inside it.
    const earlierAt = (): Rect =>
      new Rect({
        left: 60,
        top: 80,
        width: 60,
        height: 40,
        originX: "left",
        originY: "top",
        fill: "#00ff00",
        selectable: false,
        evented: false,
      });
    for (const s of [withGlass, without]) {
      s.canvas.add(earlierAt());
      s.canvas.add(panel({ width: 60, height: 40 }));
    }
    withGlass.canvas.renderAll();
    without.canvas.renderAll();

    // Match set first: the probe must be inside the earlier panel AND inside
    // the glass panel, or the assertion below would pass for the wrong reason.
    const glassed = without.canvas.getObjects()[
      bars(200, 200, 8, "#fff", "#000").length + 1
    ] as Rect;
    expect(glassed).toBeInstanceOf(Rect);
    expect(earlierAt().containsPoint(new Point(probe.x, probe.y))).toBe(true);
    expect(glassed.containsPoint(new Point(probe.x, probe.y))).toBe(true);
    // And the overlap is real: green shows through where the glass sits.
    const overlap = without.pixel(probe.x, probe.y);
    expect(overlap[1]).toBeGreaterThan(overlap[0] + 40);

    // The glass panel covers the same pixels, so if its sample missed the
    // earlier panel the artboard behind it would show instead of green.
    const under = withGlass.pixel(probe.x, probe.y);
    expect(under[1]).toBeGreaterThan(under[0] + 40);
  });

  it("composites a grouped panel the same as a flattened one and stays in bounds", () => {
    const grouped = stage({ backdrop: () => ({ paint: () => true }) });
    const flat = stage({ backdrop: () => ({ paint: () => true }) });
    const inside = new Group([panel({ left: -20, top: -20 })], {
      left: 140,
      top: 140,
      angle: 30,
      objectCaching: false,
    });
    grouped.canvas.add(inside);
    flat.canvas.add(panel({ left: 120, top: 120 }));
    grouped.canvas.renderAll();
    flat.canvas.renderAll();

    // Both panels are centred on the same point over the same backdrop.
    const centre = { x: 140, y: 140 };
    const child = inside.getObjects()[0] as Rect;
    expect(child.getCenterPoint().x).toBeCloseTo(centre.x, 5);
    expect(child.getCenterPoint().y).toBeCloseTo(centre.y, 5);
    expect(grouped.pixel(centre.x, centre.y)).toEqual(
      flat.pixel(centre.x, centre.y),
    );
    expect(flat.pixel(centre.x, centre.y)[0]).toBeGreaterThan(120);

    // The rotated group samples a strictly larger box than the flat panel, and
    // that box is still inside the surface — the probe's out-of-bounds case.
    const rotated = grouped.regions[0];
    const axisAligned = flat.regions[0];
    expect(rotated).toBeDefined();
    expect(axisAligned).toBeDefined();
    expect(rotated?.width ?? 0).toBeGreaterThan(axisAligned?.width ?? 0);
    expect(rotated?.left ?? -1).toBeGreaterThanOrEqual(0);
    expect(rotated?.top ?? -1).toBeGreaterThanOrEqual(0);
    expect((rotated?.left ?? 0) + (rotated?.width ?? 0)).toBeLessThanOrEqual(
      200,
    );
    expect((rotated?.top ?? 0) + (rotated?.height ?? 0)).toBeLessThanOrEqual(
      200,
    );
  });

  it("clips to the rounded path and samples a padded box", () => {
    // A solid magenta backdrop over a transparent canvas makes the clip
    // observable: the media is the only thing there, so an unclipped draw would
    // repaint the rounded-off corner too.
    const magenta = stage({
      texture: false,
      backdrop: () => ({
        paint: (ctx, region) => {
          ctx.fillStyle = "#ff00ff";
          ctx.fillRect(0, 0, region.width, region.height);
          return true;
        },
      }),
    });
    const without = stage({ texture: false });
    for (const s of [magenta, without])
      s.canvas.add(panel({ rx: 20, ry: 20, width: 60, height: 60 }));
    magenta.canvas.renderAll();
    without.canvas.renderAll();

    // Match set, derived rather than assumed. The panel spans 80..140 with a
    // 20px corner, so the top-left arc is centred at (100,100) with radii 20.
    const corner = { x: 84, y: 84 };
    expect(
      ((corner.x - 100) / 20) ** 2 + ((corner.y - 100) / 20) ** 2,
    ).toBeGreaterThan(1);
    // It is inside the bounding box, so only the rounding can exclude it.
    expect(corner.x).toBeGreaterThan(80);
    expect(corner.y).toBeGreaterThan(80);

    // The corner is outside the clip, so glass leaves it exactly as it was:
    // the panel's own 50% white over nothing.
    expect(magenta.pixel(corner.x, corner.y)).toEqual(
      without.pixel(corner.x, corner.y),
    );
    // The centre is inside: the media is opaque there, where without glass the
    // canvas is transparent under the panel's 50% white.
    const inside = magenta.pixel(110, 110);
    const bare = without.pixel(110, 110);
    expect(bare[3]).toBeGreaterThan(100);
    expect(bare[3]).toBeLessThan(160);
    expect(inside[3]).toBe(255);
    // Magenta has no green, and the panel's white adds a little back.
    expect(inside[1]).toBeLessThan(bare[1] - 80);
    expect(inside[0]).toBe(255);
    expect(inside[2]).toBe(255);

    // Padding: the sample must reach at least a full blur radius past the
    // panel on every side, or the blur eats its own edge and the panel shows a
    // dark rim where the kernel had nothing to sample.
    const bounds = magenta.canvas.getObjects()[0] as Rect;
    bounds.setCoords();
    const box = bounds.getBoundingRect();
    const region = magenta.regions[0];
    expect(region).toBeDefined();
    expect(region?.left ?? 0).toBeLessThanOrEqual(box.left - 24);
    expect(region?.top ?? 0).toBeLessThanOrEqual(box.top - 24);
    expect((region?.left ?? 0) + (region?.width ?? 0)).toBeGreaterThanOrEqual(
      box.left + box.width + 24,
    );
  });

  it("resolves a moved panel's bounds fresh rather than from the last setCoords", () => {
    const s = stage({ backdrop: () => ({ paint: () => true }) });
    const object = panel();
    s.canvas.add(object);
    s.canvas.renderAll();
    const first = { ...s.regions[0] };

    // A programmatic move does not go through Fabric's gesture handlers, which
    // are what normally refresh the memoised bounds.
    object.set({ left: 120, top: 60 });
    s.canvas.renderAll();
    const second = s.regions[1];

    expect(second?.left ?? 0).toBeGreaterThan(first.left ?? 0);
    expect(second?.top ?? 0).toBeLessThan(first.top ?? 0);
    // The sample followed the panel by exactly the distance it moved, padding
    // included; a stale bound would leave it where the panel used to be.
    expect((second?.left ?? 0) - (first.left ?? 0)).toBe(40);
    expect((first.top ?? 0) - (second?.top ?? 0)).toBe(20);
  });

  it("hands the media the artboard rect in device pixels, not the camera zoom", () => {
    // The media layer is positioned in CSS pixels, so the plane scale used to
    // convert its bounds would apply the camera zoom a second time. Carrying the
    // artboard rect instead makes it right at any zoom, and the zoom is what
    // this case exists to vary: a fit camera is not 1:1.
    const s = stage({ artboard: { width: 200, height: 200 } });
    s.canvas.setViewportTransform([0.5, 0, 0, 0.5, 40, 20]);
    s.canvas.add(panel({ vigiliaGlass: { blurRadius: 8 } }));
    s.canvas.renderAll();

    expect(s.paints).toHaveLength(1);
    const device = s.paints[0]?.device;
    // 200 artboard units through a 0.5 viewport at offset (40, 20): 100x100 at
    // (40, 20). The old derivation produced 200x200 at (80, 40).
    expect(device).toEqual({ left: 40, top: 20, width: 100, height: 100 });
    // And the panel's own region still follows the same matrix.
    expect(s.regions[0]?.left).toBeGreaterThanOrEqual(0);
    expect(s.regions[0]?.top).toBeGreaterThanOrEqual(0);
  });

  it("keeps the media rect through a capture multiplier at a zoom", () => {
    // Zoom 2, multiplier 3: the plane scale is 6. The old derivation multiplied
    // the already-fit CSS bounds by the plane scale, which at zoom 1 happens to
    // agree with the correct answer and only diverges from here.
    const s = stage({ artboard: { width: 200, height: 200 } });
    s.canvas.setViewportTransform([2, 0, 0, 2, 0, 0]);
    s.canvas.add(panel({ vigiliaGlass: { blurRadius: 8 } }));
    s.canvas.renderAll();
    s.paints.length = 0;
    s.canvas.toCanvasElement(3);
    expect(s.paints[0]?.device).toEqual({
      left: 0,
      top: 0,
      width: 1200,
      height: 1200,
    });
  });

  it("draws the backdrop at full alpha whatever the panel's own opacity is", () => {
    const s = stage({});
    s.canvas.add(panel({ opacity: 0.5 }));
    s.canvas.renderAll();

    expect(s.draws).toHaveLength(1);
    expect(s.draws[0]?.alpha).toBe(1);
    // The panel's fill is still composited by Fabric, over the backdrop.
    expect(s.pixel(100, 100)[0]).toBeGreaterThan(120);
  });

  it("converts the authored radius to device pixels through the real matrix", () => {
    const filterFor = (configure: (canvas: StaticCanvas) => void): string => {
      const s = stage({});
      s.canvas.add(panel());
      configure(s.canvas);
      s.canvas.renderAll();
      return s.draws[0]?.filter ?? "none";
    };

    // 1:1 at DPR 1 is the case where artboard units and device pixels coincide,
    // which is exactly why the distinction was invisible until now.
    expect(filterFor(() => {})).toBe("blur(24px)");
    // Zoom halves it.
    expect(
      filterFor((canvas) =>
        canvas.setViewportTransform([0.5, 0, 0, 0.5, 0, 0]),
      ),
    ).toBe("blur(12px)");
    // A panel's own scale multiplies it, exactly as its `rx` does.
    const scaled = stage({});
    scaled.canvas.add(panel({ scaleX: 2, scaleY: 2, left: 60, top: 60 }));
    scaled.canvas.renderAll();
    expect(scaled.draws[0]?.filter).toBe("blur(48px)");
    // The retina leg, which every other case here leaves at 1 — so both
    // `* retina` terms would otherwise be unexercised. The collaborator Fabric
    // reads the ratio through is stubbed rather than the global, which
    // jsdom pins at 1; a real high-DPI browser is the browser suite's job.
    const dense = stage({});
    dense.canvas.getRetinaScaling = () => 2;
    dense.canvas.add(panel());
    dense.canvas.renderAll();
    expect(dense.draws[0]?.filter).toBe("blur(48px)");
    // Zero is a valid treatment and must not be filtered away silently.
    const zero = stage({});
    zero.canvas.add(panel({ vigiliaGlass: { blurRadius: 0 } }));
    zero.canvas.renderAll();
    expect(zero.draws[0]?.filter).toBe("none");
  });

  it("scales the sample with a toCanvasElement capture multiplier", () => {
    const s = stage({ backdrop: () => ({ paint: () => true }) });
    s.canvas.add(panel());
    s.canvas.renderAll();
    const live = s.regions[0];
    s.draws.length = 0;
    s.regions.length = 0;

    const capture = s.canvas.toCanvasElement(2);
    const doubled = s.regions[0];

    expect(capture.width).toBe(400);
    expect(live?.width).toBeGreaterThan(0);
    // The same panel, twice the pixels. The blur padding is a fixed device-pixel
    // allowance rather than a proportional one, so it does not double exactly.
    expect(doubled?.width ?? 0).toBeGreaterThan(live?.width ?? 0);
    expect(doubled?.width ?? 0).toBeLessThanOrEqual((live?.width ?? 0) * 2 + 8);
    // The composite lands on the capture's own context, not the live one, so
    // the live recorder stays empty; the region is what proves the device scale.
    expect(s.draws).toHaveLength(0);
  });

  it("refuses a sample larger than the bound and still samples a smaller one", () => {
    const big = stage({ size: 3000 });
    big.canvas.backgroundColor = "#000000";
    const wide = new Rect({
      left: 0,
      top: 0,
      width: 3000,
      height: 1500,
      originX: "left",
      originY: "top",
      vigiliaGlass: { blurRadius: 48 },
    });
    big.canvas.add(wide);
    big.canvas.renderAll();

    // Match set: the panel is on the surface and covers it, and 3000x1500 is
    // past the 4,194,304 px bound, so the refusal is about extent and nothing else.
    expect(wide.isOnScreen()).toBe(true);
    expect(3000 * 1500).toBeGreaterThan(4_194_304);
    expect(big.errors[0]).toContain("too large to sample");
    expect(big.glass.liveSurfaces()).toBe(0);
    expect(big.draws).toHaveLength(0);

    const small = stage({ size: 3000 });
    small.canvas.backgroundColor = "#000000";
    small.canvas.add(panel({ left: 100, top: 100 }));
    small.canvas.renderAll();
    expect(small.errors).toEqual([]);
    expect(small.glass.liveSurfaces()).toBe(1);
    expect(small.draws).toHaveLength(1);
  });

  it("reports a tainted or otherwise failing backdrop instead of throwing mid-render", () => {
    // Cross-origin media taints the scratch, and the next draw throws
    // `SecurityError`. A panel must not take the frame down with it.
    const s = stage({
      backdrop: () => ({
        paint: () => {
          throw new Error(
            "SecurityError: tainted canvases may not be exported",
          );
        },
      }),
    });
    s.canvas.add(panel());
    expect(() => s.canvas.renderAll()).not.toThrow();
    expect(s.errors).toHaveLength(1);
    expect(s.errors[0]).toContain("tainted canvases may not be exported");
    expect(s.errors[0]).toContain("failed");

    // A second frame is the same failure, and must not flood the host.
    s.canvas.renderAll();
    expect(s.errors).toHaveLength(1);
  });

  it("composites without media, and without a report, when the source has no pixels", () => {
    const absent = stage({});
    absent.canvas.add(panel());
    absent.canvas.renderAll();
    expect(absent.draws).toHaveLength(1);
    expect(absent.errors).toEqual([]);

    const empty = stage({ backdrop: () => ({ paint: () => false }) });
    empty.canvas.add(panel());
    empty.canvas.renderAll();
    expect(empty.draws).toHaveLength(1);
    expect(empty.regions).toHaveLength(1);
    expect(empty.errors).toEqual([]);
  });

  it("never samples an ancestor group's own cache", () => {
    const s = stage({ backdrop: () => ({ paint: () => true }) });
    const group = new Group([panel()], {
      left: 100,
      top: 100,
      objectCaching: false,
    });
    s.canvas.add(group);
    s.canvas.renderAll();
    expect(s.draws).toHaveLength(1);
    expect(s.errors).toEqual([]);

    // Force caching back on after attach: the child now paints into the
    // group's cache, whose backdrop is the panel's own already-painted pixels.
    group.objectCaching = true;
    s.draws.length = 0;
    s.errors.length = 0;
    s.canvas.renderAll();
    expect(s.draws).toHaveLength(0);
    expect(s.errors[0]).toContain("caches its children");
  });

  it("refuses a group, which Fabric gives no render boundary", () => {
    const s = stage({});
    s.canvas.add(
      new Group(
        [
          new Rect({
            left: 80,
            top: 80,
            width: 40,
            height: 40,
            originX: "left",
            originY: "top",
            fill: "rgba(255, 255, 255, 0.5)",
          }),
        ],
        { left: 100, top: 100, vigiliaGlass: { blurRadius: 24 } } as Record<
          string,
          unknown
        >,
      ),
    );
    s.canvas.renderAll();
    expect(s.draws).toHaveLength(0);
    expect(s.errors[0]).toContain("no render boundary");
  });

  it("re-attaches after revival replaces object identity", async () => {
    const s = stage({});
    s.canvas.add(panel());
    s.canvas.renderAll();
    expect(s.draws).toHaveLength(1);

    await s.canvas.loadFromJSON({
      version: "7.4.0",
      objects: [
        {
          type: "Rect",
          id: "revived",
          left: 80,
          top: 80,
          width: 40,
          height: 40,
          fill: "rgba(255, 255, 255, 0.5)",
          vigiliaGlass: { blurRadius: 24 },
        },
      ],
    });
    s.draws.length = 0;
    s.canvas.renderAll();

    expect(s.draws).toHaveLength(1);
    expect(s.glass.liveSurfaces()).toBe(1);
  });

  it("restores the context when the composite throws mid-draw", () => {
    // A tainting draw throws after the handler has clipped to the panel's path
    // and put the identity transform in place for the final draw. Fabric's own
    // save/restore wraps the whole object, but not the state left between the
    // throw and the object's own paint.
    //
    // The leak that matters is the **clip**, not the alpha or the shadow: the
    // path was built centred on the object's local origin, so under the identity
    // transform the panel's fill lands at (-20,-20)-(20,20) - outside the clip it
    // left behind at (80,80)-(120,120) - and is discarded. The sample then reads
    // the black plate. A leaked alpha of 1 would only make the fill brighter.
    const withGlass = stage({});
    const without = stage({});
    for (const stageUnderTest of [withGlass, without]) {
      stageUnderTest.canvas.add(
        new Rect({
          left: 0,
          top: 0,
          width: 200,
          height: 200,
          originX: "left",
          originY: "top",
          fill: "#000000",
          selectable: false,
          evented: false,
        }),
      );
      stageUnderTest.canvas.add(panel({ opacity: 0.5 }));
    }
    withGlass.failNextComposite = true;
    withGlass.canvas.renderAll();
    without.canvas.renderAll();

    // The composite was abandoned, so the panel must paint exactly as it would
    // with no glass at all: 0.5 object opacity over a 0.5 white fill over black
    // is 63, not 127 - the 127 is a half-opacity white on its own. Removing the
    // `finally` makes the panel read black instead, because the fill is clipped
    // away. That is the whole point of restoring the context.
    expect(withGlass.errors[0]).toContain("tainted canvases");
    expect(withGlass.pixel(100, 100)).toEqual(without.pixel(100, 100));
  });

  it("asks once whether the browser can filter, however many panels", () => {
    const s = stage({});
    s.canvas.add(panel());
    s.canvas.add(panel({ left: 120, top: 120 }));
    s.canvas.renderAll();
    expect(s.filterProbes, "one probe for the whole frame").toBe(1);

    s.canvas.renderAll();
    expect(s.filterProbes, "and none on the next frame").toBe(1);
  });

  it("does not publish a scratch surface it could not get a context for", () => {
    const created = document.createElement.bind(document);
    const opened: HTMLCanvasElement[] = [];
    // Armed only once the stage exists, so Fabric's own canvas still resolves.
    const armed = { now: false };
    (document as unknown as { createElement: typeof created }).createElement =
      ((name: string, options?: ElementCreationOptions) => {
        const element = created(name, options) as HTMLElement;
        if (name === "canvas" && armed.now) {
          // A canvas that refuses a context is the failure this guards: the panel
          // has to fall back to no sample rather than report a live surface it
          // cannot draw into.
          Object.defineProperty(element, "getContext", { value: () => null });
          opened.push(element as HTMLCanvasElement);
        }
        return element;
      }) as typeof created;
    try {
      const s = stage({ texture: false });
      armed.now = true;
      s.canvas.add(panel());
      s.canvas.renderAll();
      expect(opened.length, "a surface was tried").toBeGreaterThan(0);
      expect(s.glass.liveSurfaces(), "but none is live").toBe(0);
      expect(s.draws).toHaveLength(0);
    } finally {
      (document as unknown as { createElement: typeof created }).createElement =
        created;
    }
  });

  it("refuses an unusable corner radius rather than clipping to a square", () => {
    const s = stage({});
    // Present and not a number: reading it as 0 would silently clip to a square
    // nobody authored, which is a different panel from the one asked for.
    s.canvas.add(
      panel({
        rx: "wide" as unknown as number,
        ry: "wide" as unknown as number,
      }),
    );
    s.canvas.renderAll();
    expect(s.draws).toHaveLength(0);
    expect(s.errors[0]).toContain("no measurable box");

    // A following, well-formed panel is unaffected: the failed one left no
    // clipped context behind for it.
    s.errors.length = 0;
    s.canvas.add(panel({ left: 120, top: 120 }));
    s.canvas.renderAll();
    expect(s.draws).toHaveLength(1);
    expect(s.errors).toEqual([]);
  });

  it("releases every scratch surface and listener on dispose", () => {
    const created: HTMLCanvasElement[] = [];
    const original = document.createElement.bind(document);
    (document as unknown as { createElement: typeof original }).createElement =
      ((name: string, options?: ElementCreationOptions) => {
        const element = original(name, options);
        if (name === "canvas") created.push(element as HTMLCanvasElement);
        return element;
      }) as typeof original;

    const perCycle: number[] = [];
    const stillHolding: number[] = [];
    try {
      for (let cycle = 0; cycle < 3; cycle += 1) {
        // No texture: the only canvas this cycle allocates besides Fabric's own
        // is the glass scratch, so the release contract is what is measured.
        const s = stage({ texture: false });
        const before = created.length;
        const mine = s.canvas.lowerCanvasEl;
        s.canvas.add(panel());
        s.canvas.add(panel({ left: 120, top: 120 }));
        s.canvas.renderAll();
        expect(s.glass.liveSurfaces()).toBe(2);
        s.glass.dispose();
        expect(s.glass.liveSurfaces()).toBe(0);

        const scratch = created.slice(before).filter((e) => e !== mine);
        perCycle.push(scratch.length);
        // Backing store still allocated by this cycle's scratch surfaces.
        // Task 1 measured this growing without an explicit release.
        stillHolding.push(scratch.filter((e) => e.width > 0).length);

        // Disposal must stop the panels compositing, not just release memory.
        s.draws.length = 0;
        s.canvas.renderAll();
        expect(s.draws).toHaveLength(0);
        // And it must hand the panels' own caching back, so an ordinary panel
        // is not left permanently uncached because it once carried glass.
        expect(s.canvas.getObjects().every((o) => o.objectCaching)).toBe(true);
      }
    } finally {
      (
        document as unknown as { createElement: typeof original }
      ).createElement = original;
    }

    // Same work each cycle, same allocation each cycle, and every scratch
    // surface left with no backing store behind it.
    expect(new Set(perCycle).size).toBe(1);
    expect(perCycle[0]).toBeGreaterThanOrEqual(2);
    expect(new Set(stillHolding).size).toBe(1);
    expect(stillHolding[0]).toBe(0);
  });
});
