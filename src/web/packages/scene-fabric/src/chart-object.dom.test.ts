// @vitest-environment jsdom
import { Group, StaticCanvas } from "fabric/es";
import { describe, expect, it } from "vitest";
import {
  buildBarOption,
  buildGaugeOption,
  buildLineOption,
  buildPieOption,
  defaultBarSettings,
  defaultGaugeSettings,
  defaultLineSettings,
  defaultPieSettings,
  type Sample,
} from "@vigilia/renderer-core";
import { VigiliaChart, type VigiliaChartOptions } from "./chart-object.js";

/**
 * The chart object, actually mounted.
 *
 * ## Why this file overrides the node environment
 *
 * `vitest.config.ts` runs in `node` and says visual behaviour belongs to
 * Playwright. That is still right, and this is not visual behaviour — nothing
 * here looks at a pixel. It asserts **wiring**: that the object constructs, that
 * ECharts initialises on a detached canvas, that the serialised surface is what
 * it claims, that a revived object is an object, and that an engine repaint
 * reaches an enclosing group's cache.
 *
 * All of that needs a `document` and a real 2D context, and nothing more —
 * `jsdom` plus the `canvas` package already in the tree provide exactly that.
 * Deferring it to a browser is what let stage 1 ship an object that **could not
 * be constructed at all**: `option` was a getter with no setter, so Fabric's
 * only entry path threw on every construction, under a green suite of 1,131
 * tests. The prototype-shape test in `chart-object.test.ts` catches that class
 * without a DOM; this file catches the things only a mount can show.
 *
 * Keep it that way. If an assertion here starts needing to compare pixels,
 * colours or layout, it belongs in `tests/e2e`.
 */

const NOW_MS = Date.UTC(2026, 8, 15, 12, 0, 0);

function sample(value: number, offsetMs = 0): Sample {
  return {
    sensorId: "cpu.load",
    timestamp: new Date(NOW_MS - offsetMs).toISOString(),
    status: "ok",
    value,
  };
}

// `animate: false` throughout — the engine's own animation loop does not drive
// Fabric, and these assert wiring rather than motion.
const LINE_OPTION = buildLineOption(
  defaultLineSettings,
  [{ sensorId: "cpu.load", samples: [sample(1, 1000), sample(2)] }],
  NOW_MS,
  false,
);

function chartOptions(
  overrides: Partial<VigiliaChartOptions> = {},
): VigiliaChartOptions {
  return {
    family: "line",
    settings: defaultLineSettings,
    width: 300,
    height: 180,
    option: LINE_OPTION,
    ...overrides,
  } as VigiliaChartOptions;
}

describe("constructing a chart", () => {
  it("accepts a built option, which is the regression that mattered", () => {
    // Fabric's `_setOptions` assigns every key of the options bag onto the
    // instance. When `option` was a getter with no setter this threw
    // `TypeError: Cannot set property option … which has only a getter` —
    // every single time, and nothing noticed.
    const chart = new VigiliaChart(chartOptions());

    expect(chart.disposed).toBe(false);
    expect(chart.option).toBe(LINE_OPTION);
    chart.dispose();
  });

  it("applies its own defaults rather than Fabric’s", () => {
    // `FabricObject`'s constructor assigns `FabricObject.ownDefaults` by name,
    // not `this.constructor.getDefaults()`, so a subclass must assign its own.
    // Measured here rather than read off the static, because the whole point is
    // that the constructor path applies them.
    const chart = new VigiliaChart(chartOptions());

    expect(chart.originX).toBe("center");
    expect(chart.originY).toBe("center");
    expect(chart.objectCaching).toBe(false);
    expect(chart.strokeWidth).toBe(0);
    chart.dispose();
  });

  it("lets the caller override a Fabric property the defaults also set", () => {
    // The previous constructor re-set origin and caching *after* applying the
    // caller's options, so it silently overrode them. Nothing needs a different
    // origin today; this asserts the mechanism, not a use case.
    const chart = new VigiliaChart(
      chartOptions({ angle: 37, left: 10, top: 20 }),
    );

    expect(chart.angle).toBe(37);
    expect(chart.left).toBe(10);
    expect(chart.top).toBe(20);
    chart.dispose();
  });

  it("refuses a box it cannot draw in", () => {
    // `echarts.init` on a 0-sized element does not fail loudly, it just never
    // draws. Refuse rather than coerce.
    expect(() => new VigiliaChart(chartOptions({ width: 0 }))).toThrow(
      /positive width and height/,
    );
    expect(() => new VigiliaChart(chartOptions({ height: 0 }))).toThrow(
      /positive width and height/,
    );
  });

  it("clamps the render scale against its own box", () => {
    const chart = new VigiliaChart(chartOptions({ renderScale: 99 }));

    expect(chart.renderScale).toBeLessThanOrEqual(3);
    chart.dispose();
  });

  it("mounts every family the engine registration covers", () => {
    // `chart-engine.ts` registers four families and `GridComponent`. A missing
    // registration does not throw on `init` — the chart just never draws — so
    // the only honest check is to build each family's real option and mount it.
    const built: readonly VigiliaChartOptions[] = [
      chartOptions(),
      chartOptions({
        family: "gauge",
        settings: defaultGaugeSettings,
        option: buildGaugeOption(defaultGaugeSettings, sample(42), false),
      }),
      chartOptions({
        family: "bar",
        settings: defaultBarSettings,
        option: buildBarOption(
          defaultBarSettings,
          [{ sensorId: "cpu.load", sample: sample(1) }],
          false,
        ),
      }),
      chartOptions({
        family: "pie",
        settings: defaultPieSettings,
        option: buildPieOption(
          defaultPieSettings,
          [{ sensorId: "cpu.load", sample: sample(1) }],
          false,
        ),
      }),
    ];

    for (const options of built) {
      const chart = new VigiliaChart(options);

      expect(chart.disposed, `${String(options.family)} failed to mount`).toBe(
        false,
      );
      chart.dispose();
    }
  });
});

describe("the serialised object", () => {
  it("emits the custom properties and nothing derived", () => {
    const chart = new VigiliaChart(chartOptions());
    const json = chart.toObject();

    expect(json).toMatchObject({ type: "VigiliaChart", family: "line" });
    expect(json.settings).toEqual(defaultLineSettings);

    // The §67 rule, measured on the real output rather than on the key list:
    // the built option holds live samples in `series[].data`, and `renderScale`
    // is the display's, not the document's.
    expect(json).not.toHaveProperty("option");
    expect(json).not.toHaveProperty("renderScale");
    chart.dispose();
  });

  it("omits the origin when defaults are stripped, like every other class", () => {
    // **This assertion inverted on 2026-09-15**, and it is not a regression.
    // It used to require the origin to survive stripping, which needed a
    // `toObject` override — §134's explicit-origin condition. That condition
    // was replaced: defaults are stripped everywhere, so a persisted key means
    // an authored deviation and an absent one means the default of the Fabric
    // major the envelope records and refuses to load across. The override was
    // withdrawn with it.
    //
    // What makes this worth asserting rather than deleting is that the chart
    // must behave like `Rect` and `Group` here. A single class still writing
    // its origin is how the withdrawn rule comes back for one object.
    const chart = new VigiliaChart(chartOptions());

    chart.includeDefaultValues = false;

    const json = chart.toObject();

    expect(json).not.toHaveProperty("originX");
    expect(json).not.toHaveProperty("originY");
    // Still centred in memory: only the *persisted* surface changed.
    expect(chart.originX).toBe("center");
    chart.dispose();
  });

  it("revives through Fabric’s own path, into a real chart", async () => {
    // `fromObject` is not overridden, so this exercises
    // `FabricObject._fromObject` — including `enlivenObjectEnlivables`, which
    // an override would have skipped. A revived chart carries configuration,
    // not pixels: the option is derived and `plan.ts` re-supplies it.
    const chart = new VigiliaChart(chartOptions({ angle: 37 }));
    const json = chart.toObject();
    chart.dispose();

    // Cast because the inherited static keeps `FabricObject`'s return type; the
    // point of the assertion below is that the instance is the right class.
    const revived = (await VigiliaChart.fromObject(json)) as VigiliaChart;

    expect(revived).toBeInstanceOf(VigiliaChart);
    expect(revived.family).toBe("line");
    expect(revived.settings).toEqual(defaultLineSettings);
    expect(revived.angle).toBe(37);
    expect(revived.originX).toBe("center");
    expect(revived.option).toBeUndefined();
    revived.dispose();
  });
});

describe("the canvas round trip", () => {
  it("revives a chart through StaticCanvas.loadFromJSON", async () => {
    // The path stage 3 actually depends on, which had no test: only
    // `VigiliaChart.fromObject` did, and calling that directly proves the class
    // can revive itself while saying nothing about whether the *canvas* can
    // find it. That needs `classRegistry.setClass` to have run — which happens
    // on import of `chart-object.ts`, and is exactly what `package.json`'s
    // `sideEffects` entry stops a bundler from dropping.
    const source = new StaticCanvas(undefined, { width: 400, height: 300 });
    const chart = new VigiliaChart(
      chartOptions({ left: 150, top: 90, angle: 37 }),
    );

    source.add(chart);

    const json = source.toObject();
    source.dispose();

    const revived = new StaticCanvas(undefined, { width: 400, height: 300 });
    await revived.loadFromJSON(json);

    const objects = revived.getObjects();

    expect(objects).toHaveLength(1);

    const [first] = objects;

    // The assertion that matters: a real `VigiliaChart`, not the plain
    // `FabricObject` the registry falls back to when a class is unknown.
    expect(first).toBeInstanceOf(VigiliaChart);
    expect((first as VigiliaChart).family).toBe("line");
    expect((first as VigiliaChart).settings).toEqual(defaultLineSettings);
    expect(first?.angle).toBe(37);
    // Derived, so it does not survive — `plan.ts` re-supplies it, which is the
    // normal render path.
    expect((first as VigiliaChart).option).toBeUndefined();

    revived.dispose();
  });
});

describe("an engine repaint reaches the canvas", () => {
  it("invalidates an enclosing group’s cache", () => {
    // The defect this exists for: `dirty` was set by field assignment, which
    // skips `FabricObject._set` — and `_set` is the only thing that propagates
    // dirtiness to `this.parent`. A Fabric `Group` caches by default, so the
    // group would have kept redrawing a stale bitmap while the chart repainted
    // underneath it: a live chart frozen the moment it is grouped, and visible
    // nowhere else.
    const chart = new VigiliaChart(chartOptions());
    const group = new Group([chart]);

    group.set("dirty", false);
    chart.set("dirty", false);
    expect(group.dirty).toBe(false);

    // A real engine repaint, not a synthetic event: `setOption` runs with
    // `lazyUpdate: false`, so zrender paints and fires `rendered` before this
    // returns.
    chart.setOption(LINE_OPTION);

    expect(chart.dirty).toBe(true);
    expect(group.dirty).toBe(true);
    chart.dispose();
  });
});

describe("disposal", () => {
  it("is idempotent and refuses further work", () => {
    // Whatever owns the canvas must call this: `canvas.remove()` does not.
    const chart = new VigiliaChart(chartOptions());

    chart.dispose();
    expect(chart.disposed).toBe(true);
    expect(() => chart.dispose()).not.toThrow();

    // A disposed chart accepts nothing, so a late telemetry push cannot
    // resurrect a released ECharts instance.
    chart.setOption(LINE_OPTION);
    chart.resizeTo(10, 10);
    chart.setRenderScale(1);
    expect(chart.disposed).toBe(true);
  });
});
