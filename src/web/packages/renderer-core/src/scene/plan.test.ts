import { describe, expect, it } from "vitest";
import { defaultBarSettings } from "../charts/bar.js";
import { defaultLineSettings } from "../charts/line.js";
import { emptySampleSource } from "../data/source.js";
import { SampleStore } from "../data/store.js";
import type { ThemeDocument, ThemeNode } from "../theme/document.js";
import { defaultGaugeSettings, type Sample } from "../types.js";
import {
  buildChartPlan,
  buildScenePlan,
  computeMaxLines,
  formatNumber,
  formatUnit,
  MISSING_VALUE_TEXT,
  type PlanContext,
  type PlanTextSegment,
} from "./plan.js";

const NOW = Date.parse("2026-01-01T00:00:10Z");

function ok(value: number, unit = "%", sensorId = "cpu.load.total"): Sample {
  return {
    sensorId,
    timestamp: new Date(NOW).toISOString(),
    status: "ok",
    value,
    unit,
  };
}

function storeWith(entries: Record<string, Sample>): SampleStore {
  const store = new SampleStore();
  store.ingest(Object.entries(entries), NOW);
  return store;
}

function documentWith(
  nodes: readonly ThemeNode[],
  globals?: ThemeDocument["globals"],
): ThemeDocument {
  return {
    schemaVersion: 1,
    id: "demo",
    artboard: { width: 800, height: 480, fitMode: "contain" },
    ...(globals === undefined ? {} : { globals }),
    nodes,
  };
}

function plan(document: ThemeDocument, overrides: Partial<PlanContext> = {}) {
  return buildScenePlan({
    document,
    source: emptySampleSource,
    nowMs: NOW,
    animate: false,
    ...overrides,
  });
}

describe("artboard", () => {
  it("carries size and fit mode through", () => {
    const result = plan(documentWith([]));
    expect(result.artboard).toMatchObject({
      width: 800,
      height: 480,
      fitMode: "contain",
    });
  });

  it("defaults fit mode to contain", () => {
    const document: ThemeDocument = {
      schemaVersion: 1,
      id: "d",
      artboard: { width: 100, height: 100 },
      nodes: [],
    };
    expect(plan(document).artboard.fitMode).toBe("contain");
  });

  it("resolves the background through globals", () => {
    const document = documentWith([], {
      palette: { bg: { name: "Background", value: "#101216" } },
    });
    const withBackground: ThemeDocument = {
      ...document,
      artboard: { ...document.artboard, background: { ref: "palette.bg" } },
    };

    expect(plan(withBackground).artboard.background).toBe("#101216");
  });
});

describe("type presets", () => {
  it("resolves each text run through its own preset and palette token", () => {
    const result = plan(
      documentWith(
        [
          {
            id: "readout",
            type: "text",
            content: {
              runs: [
                {
                  kind: "literal",
                  text: "CPU ",
                  typePreset: "typePresets.label",
                  style: { color: { ref: "palette.ink" } },
                },
                {
                  kind: "literal",
                  text: "48%",
                  typePreset: "typePresets.value",
                },
              ],
            },
          },
        ],
        {
          palette: { ink: { name: "Ink", value: "#ffffff" } },
          typePresets: {
            label: {
              name: "Label",
              value: {
                family: "Inter",
                size: 14,
                weight: 500,
                letterSpacing: 1.2,
                lineHeight: 1.1,
              },
            },
            value: {
              name: "Value",
              value: { family: "Inter", size: 32, weight: 700 },
            },
          },
        },
      ),
    );
    const content = result.nodes[0]!.content;
    expect(content).toMatchObject({
      kind: "text",
      segments: [
        {
          text: "CPU ",
          style: {
            fontFamily: "Inter",
            fontSize: 14,
            fontWeight: 500,
            letterSpacing: 1.2,
            lineHeight: 1.1,
            color: "#ffffff",
          },
        },
        {
          text: "48%",
          style: { fontFamily: "Inter", fontSize: 32, fontWeight: 700 },
        },
      ],
    });
  });
});

describe("geometry", () => {
  it("defaults an absent transform to a zero-sized box at the origin", () => {
    // Defaulting to a visible size would put a rectangle on screen that the
    // document never described.
    const result = plan(documentWith([{ id: "r", type: "rectangle" }]));

    expect(result.nodes[0]!.box).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    });
  });

  it("keeps group-local coordinates rather than flattening them", () => {
    // §57: transforms compose, so a child's box stays relative to its group.
    // Baking world coordinates here would break grouping and ungrouping.
    const result = plan(
      documentWith([
        {
          id: "g",
          type: "group",
          transform: { x: 100, y: 50 },
          children: [
            {
              id: "r",
              type: "rectangle",
              transform: { x: 10, y: 5, width: 20, height: 20 },
            },
          ],
        },
      ]),
    );

    expect(result.nodes[0]!.children[0]!.box.x).toBe(10);
  });

  it("treats a node as visible unless the document says otherwise", () => {
    const result = plan(
      documentWith([
        { id: "a", type: "rectangle" },
        { id: "b", type: "rectangle", visible: false },
      ]),
    );

    expect(result.nodes.map((n) => n.visible)).toEqual([true, false]);
  });

  it("preserves document order, which is paint order (§137)", () => {
    const result = plan(
      documentWith([
        { id: "first", type: "rectangle" },
        { id: "second", type: "ellipse" },
      ]),
    );

    expect(result.nodes.map((n) => n.id)).toEqual(["first", "second"]);
  });
});

describe("style resolution (§75)", () => {
  const globals = { palette: { accent: { name: "Accent", value: "#00b8d9" } } };

  it("substitutes a global reference for its literal", () => {
    const result = plan(
      documentWith(
        [
          {
            id: "r",
            type: "rectangle",
            style: { fill: { ref: "palette.accent" } },
          },
        ],
        globals,
      ),
    );

    expect(result.nodes[0]!.style["fill"]).toBe("#00b8d9");
  });

  it("passes a local literal through", () => {
    const result = plan(
      documentWith([
        { id: "r", type: "rectangle", style: { fill: { value: "#ff0000" } } },
      ]),
    );

    expect(result.nodes[0]!.style["fill"]).toBe("#ff0000");
  });

  it("reports an unresolvable reference instead of guessing a default", () => {
    // A silently substituted colour is how a theme ends up looking wrong with
    // nothing to point at.
    const result = plan(
      documentWith([
        {
          id: "r",
          type: "rectangle",
          style: { fill: { ref: "palette.nope" } },
        },
      ]),
    );

    expect(result.nodes[0]!.style["fill"]).toBeUndefined();
    expect(result.issues).toEqual([
      {
        code: "unresolved-global",
        nodeId: "r",
        detail: 'Global "palette.nope" is not defined in this document.',
      },
    ]);
  });

  it("keeps a literal falsy value rather than dropping it", () => {
    const result = plan(
      documentWith([
        { id: "r", type: "rectangle", style: { opacity: { value: 0 } } },
      ]),
    );

    expect(result.nodes[0]!.style["opacity"]).toBe(0);
  });
});

describe("text (§89)", () => {
  const node = (bindings: unknown[], runs: unknown[]): ThemeNode =>
    ({
      id: "t",
      type: "text",
      bindings,
      content: { runs },
    }) as unknown as ThemeNode;

  function segments(
    source: SampleStore | typeof emptySampleSource,
    bindings: unknown[],
    runs: unknown[],
  ) {
    const result = plan(documentWith([node(bindings, runs)]), { source });
    const content = result.nodes[0]!.content;
    if (content.kind !== "text") {
      throw new Error("expected a text node");
    }
    return {
      authored: content.authored,
      segments: content.segments as PlanTextSegment[],
      issues: result.issues,
    };
  }

  it("keeps authored runs separate from the current resolved value", () => {
    const runs = [{ kind: "value", bindingId: "b", precision: 0 }];
    const result = segments(
      storeWith({ "cpu.temp": ok(61.4, "°C", "cpu.temp") }),
      [{ id: "b", semanticKey: "cpu.temp" }],
      runs,
    );

    expect(result.authored.runs).toEqual(runs);
    expect(result.segments.map((segment) => segment.text)).toEqual(["61°C"]);
  });

  it("mixes literals and live values in one element", () => {
    const result = segments(
      storeWith({ "cpu.temp": ok(61.4, "°C", "cpu.temp") }),
      [{ id: "b", semanticKey: "cpu.temp" }],
      [
        { kind: "literal", text: "CPU " },
        { kind: "value", bindingId: "b", precision: 0 },
      ],
    );

    expect(result.segments.map((s) => s.text)).toEqual(["CPU ", "61°C"]);
  });

  it("renders a placeholder and the status for a non-ok sample, never a number", () => {
    // §83: a non-ok sample carries no value, and nothing may be substituted.
    const stale: Sample = {
      sensorId: "cpu.temp",
      timestamp: new Date(NOW).toISOString(),
      status: "stale",
      message: "last read 12 s ago",
    };

    const result = segments(
      storeWith({ "cpu.temp": stale }),
      [{ id: "b", semanticKey: "cpu.temp" }],
      [{ kind: "value", bindingId: "b" }],
    );

    expect(result.segments[0]).toEqual({
      text: MISSING_VALUE_TEXT,
      style: {},
      status: "stale",
      message: "last read 12 s ago",
    });
  });

  it("reports an unmapped semantic key, which needs remapping rather than a retry", () => {
    const result = segments(
      emptySampleSource,
      [{ id: "b", semanticKey: "gpu.hotspot" }],
      [{ kind: "value", bindingId: "b" }],
    );

    expect(result.segments[0]!.text).toBe(MISSING_VALUE_TEXT);
    expect(result.issues[0]).toMatchObject({ code: "unmapped-key" });
  });

  it("does not throw on a run whose binding is missing", () => {
    // Validation rejects this at import; reaching it means an unvalidated
    // document, and one bad run must not take down a dashboard on a phone.
    const result = segments(
      emptySampleSource,
      [],
      [{ kind: "value", bindingId: "ghost" }],
    );

    expect(result.segments[0]!.text).toBe(MISSING_VALUE_TEXT);
    expect(result.issues[0]!.detail).toContain("does not declare");
  });

  it("applies the binding scale and offset", () => {
    // A theme showing MB from a sensor reporting bytes, without the host
    // knowing anything about the theme.
    const result = segments(
      storeWith({ "ram.used": ok(2_147_483_648, "B", "ram.used") }),
      [{ id: "b", semanticKey: "ram.used", scale: 1 / 1_073_741_824 }],
      [{ kind: "value", bindingId: "b", precision: 1 }],
    );

    expect(result.segments[0]!.text).toBe("2.0 B");
  });

  it("lets a run override the binding precision", () => {
    const result = segments(
      storeWith({ "cpu.load.total": ok(45.678) }),
      [{ id: "b", semanticKey: "cpu.load.total", precision: 0 }],
      [{ kind: "value", bindingId: "b", precision: 2 }],
    );

    expect(result.segments[0]!.text).toBe("45.68%");
  });

  it("honours unitDisplay none", () => {
    const result = segments(
      storeWith({ "cpu.load.total": ok(45) }),
      [{ id: "b", semanticKey: "cpu.load.total", unitDisplay: "none" }],
      [{ kind: "value", bindingId: "b", precision: 0 }],
    );

    expect(result.segments[0]!.text).toBe("45");
  });

  it("renders a text and a boolean sample", () => {
    const textSample: Sample = {
      sensorId: "gpu.name",
      timestamp: new Date(NOW).toISOString(),
      status: "ok",
      textValue: "RTX 4080",
    };
    const boolSample: Sample = {
      sensorId: "pump.running",
      timestamp: new Date(NOW).toISOString(),
      status: "ok",
      booleanValue: true,
    };

    const result = segments(
      storeWith({ "gpu.name": textSample, "pump.running": boolSample }),
      [
        { id: "b1", semanticKey: "gpu.name" },
        { id: "b2", semanticKey: "pump.running" },
      ],
      [
        { kind: "value", bindingId: "b1" },
        { kind: "literal", text: " / " },
        { kind: "value", bindingId: "b2" },
      ],
    );

    expect(result.segments.map((s) => s.text)).toEqual([
      "RTX 4080",
      " / ",
      "on",
    ]);
  });

  it("flags an ok sample that carries no value at all as an error", () => {
    // That combination is a provider bug. An empty box would hide it.
    const empty: Sample = {
      sensorId: "x",
      timestamp: new Date(NOW).toISOString(),
      status: "ok",
    };

    const result = segments(
      storeWith({ x: empty }),
      [{ id: "b", semanticKey: "x" }],
      [{ kind: "value", bindingId: "b" }],
    );

    expect(result.segments[0]).toMatchObject({
      text: MISSING_VALUE_TEXT,
      status: "error",
    });
  });

  it("resolves per-run styles independently", () => {
    const result = plan(
      documentWith(
        [
          node(
            [],
            [
              { kind: "literal", text: "a", typePreset: "typePresets.small" },
              { kind: "literal", text: "b", typePreset: "typePresets.large" },
            ],
          ),
        ],
        {
          typePresets: {
            small: { name: "Small", value: { family: "Inter", size: 12 } },
            large: { name: "Large", value: { family: "Inter", size: 48 } },
          },
        },
      ),
    );
    const content = result.nodes[0]!.content;
    if (content.kind !== "text") throw new Error("expected a text node");

    expect(
      content.segments.map((segment) => segment.style["fontSize"]),
    ).toEqual([12, 48]);
  });
});

describe("charts", () => {
  const chartNode = (
    family: string,
    settings: unknown,
    bindings: unknown[],
  ): ThemeNode =>
    ({
      id: "c",
      type: "chart",
      bindings,
      content: { family, settings },
    }) as unknown as ThemeNode;

  it("feeds the latest sample to a gauge", () => {
    const result = plan(
      documentWith([
        chartNode("gauge", defaultGaugeSettings, [
          { id: "b", semanticKey: "cpu.load.total" },
        ]),
      ]),
      { source: storeWith({ "cpu.load.total": ok(42) }) },
    );

    const content = result.nodes[0]!.content;
    expect(content.kind).toBe("chart");
    if (content.kind === "chart" && content.family === "gauge") {
      expect(content.option.series[0].data[0]!.value).toBe(42);
    }
  });

  it("derives a chart option without requiring a legacy document tree", () => {
    const issues = [] as import("./plan.js").PlanIssue[];
    const chart = buildChartPlan(
      "c",
      { family: "gauge", settings: defaultGaugeSettings },
      [{ id: "b", semanticKey: "cpu.load.total" }],
      {
        source: storeWith({ "cpu.load.total": ok(42) }),
        nowMs: NOW,
        animate: false,
      },
      issues,
    );

    expect(chart.family).toBe("gauge");
    if (chart.family === "gauge") {
      expect(chart.option.series[0].data[0]!.value).toBe(42);
    }
    expect(issues).toEqual([]);
  });

  it("applies scale and offset to chart data too", () => {
    // A gauge with a 0–100 range bound to a 0–1 ratio would otherwise sit at
    // the bottom of its range forever.
    const result = plan(
      documentWith([
        chartNode("gauge", defaultGaugeSettings, [
          { id: "b", semanticKey: "fan.ratio", scale: 100 },
        ]),
      ]),
      { source: storeWith({ "fan.ratio": ok(0.42, "", "fan.ratio") }) },
    );

    const content = result.nodes[0]!.content;
    if (content.kind === "chart" && content.family === "gauge") {
      expect(content.option.series[0].data[0]!.value).toBeCloseTo(42);
    }
  });

  it("gives a line chart its windowed history", () => {
    const store = new SampleStore();
    store.ingest(
      [
        [
          "cpu.load.total",
          { ...ok(10), timestamp: new Date(NOW - 3000).toISOString() },
        ],
        [
          "cpu.load.total",
          { ...ok(20), timestamp: new Date(NOW - 2000).toISOString() },
        ],
        [
          "cpu.load.total",
          { ...ok(30), timestamp: new Date(NOW - 1000).toISOString() },
        ],
      ],
      NOW,
    );

    const result = plan(
      documentWith([
        chartNode("line", defaultLineSettings, [
          { id: "b", semanticKey: "cpu.load.total" },
        ]),
      ]),
      { source: store },
    );

    const content = result.nodes[0]!.content;
    if (content.kind === "chart" && content.family === "line") {
      expect(content.option.series[0]!.data.map((point) => point[1])).toEqual([
        10, 20, 30,
      ]);
    }
  });

  it("keeps the next live segment outside the line viewport", () => {
    const store = new SampleStore();
    store.ingest(
      [
        [
          "cpu.load.total",
          {
            ...ok(10),
            timestamp: new Date(NOW - 3000).toISOString(),
            presentationTimestamp: new Date(NOW - 2000).toISOString(),
          },
        ],
        [
          "cpu.load.total",
          {
            ...ok(20),
            timestamp: new Date(NOW - 2000).toISOString(),
            presentationTimestamp: new Date(NOW - 1000).toISOString(),
          },
        ],
        [
          "cpu.load.total",
          {
            ...ok(30),
            timestamp: new Date(NOW - 1000).toISOString(),
            presentationTimestamp: new Date(NOW).toISOString(),
          },
        ],
      ],
      NOW,
    );
    const source = Object.assign(store, { chartPlaybackDelayMs: 1_000 });
    const result = plan(
      documentWith([
        chartNode("line", defaultLineSettings, [
          { id: "b", semanticKey: "cpu.load.total" },
        ]),
      ]),
      { source },
    );

    const content = result.nodes[0]!.content;
    if (content.kind === "chart" && content.family === "line") {
      expect(content.option.xAxis.max).toBe(NOW);
      expect(content.option.renderOverscanRightMs).toBe(1_000);
      expect(content.option.series[0]!.data.at(-1)).toEqual([NOW, 30]);
    }
  });

  it("requests the delayed line viewport's left-edge predecessor", () => {
    const windows: number[] = [];
    const source = {
      chartPlaybackDelayMs: 1_000,
      latest: () => undefined,
      history: (_key: string, windowSeconds: number) => {
        windows.push(windowSeconds);
        return [];
      },
    };

    buildChartPlan(
      "line",
      { family: "line", settings: defaultLineSettings },
      [{ id: "b", semanticKey: "cpu.load.total" }],
      { source, nowMs: NOW },
      [],
    );

    expect(windows).toEqual([defaultLineSettings.windowSeconds + 1]);
  });

  it("gives a bar chart one category per binding, in order", () => {
    const result = plan(
      documentWith([
        chartNode("bar", defaultBarSettings, [
          { id: "b1", semanticKey: "cpu.load.total" },
          { id: "b2", semanticKey: "gpu.load.total" },
        ]),
      ]),
      {
        source: storeWith({
          "cpu.load.total": ok(30),
          "gpu.load.total": ok(70, "%", "gpu.load.total"),
        }),
      },
    );

    const content = result.nodes[0]!.content;
    if (content.kind === "chart" && content.family === "bar") {
      expect(content.option.series[0].data.map((d) => d.value)).toEqual([
        30, 70,
      ]);
    }
  });

  it("reports each unmapped chart key once", () => {
    const result = plan(
      documentWith([
        chartNode("bar", defaultBarSettings, [
          { id: "b1", semanticKey: "a.missing" },
          { id: "b2", semanticKey: "b.missing" },
        ]),
      ]),
    );

    expect(result.issues.map((i) => i.detail)).toEqual([
      'No sensor is mapped to "a.missing".',
      'No sensor is mapped to "b.missing".',
    ]);
  });

  it("still emits a drawable option when a key is unmapped", () => {
    // The adapters' own gap rules cover the missing sample; the chart must
    // still render its track rather than the frame failing.
    const result = plan(
      documentWith([
        chartNode("gauge", defaultGaugeSettings, [
          { id: "b", semanticKey: "nope" },
        ]),
      ]),
    );

    const content = result.nodes[0]!.content;
    if (content.kind === "chart" && content.family === "gauge") {
      expect(content.option.series[0].progress.show).toBe(false);
    }
  });
});

describe("assets", () => {
  it("resolves an image through the caller-supplied resolver", () => {
    const result = plan(
      documentWith([
        { id: "i", type: "image", content: { assetId: "logo", fit: "cover" } },
      ]),
      { resolveAsset: (id) => (id === "logo" ? "blob:logo" : undefined) },
    );

    expect(result.nodes[0]!.content).toEqual({
      kind: "image",
      src: "blob:logo",
      fit: "cover",
    });
  });

  it("reports an asset it cannot resolve", () => {
    const result = plan(
      documentWith([{ id: "i", type: "image", content: { assetId: "logo" } }]),
    );

    expect(result.issues[0]).toMatchObject({
      code: "unresolved-asset",
      nodeId: "i",
    });
  });
});

describe("formatNumber", () => {
  it("honours an explicit precision exactly, including trailing zeroes", () => {
    // §89 asks for tabular readouts: a digit count that changes with the value
    // makes a value box jitter.
    expect(formatNumber(45, 2)).toBe("45.00");
    expect(formatNumber(45.678, 1)).toBe("45.7");
    expect(formatNumber(45.678, 0)).toBe("46");
  });

  it("clamps precision to the schema range", () => {
    expect(formatNumber(1, 99)).toBe("1.000000");
    expect(formatNumber(1, -5)).toBe("1");
  });

  it("rounds to one decimal and drops a trailing zero when unspecified", () => {
    // Reads correctly for percentages, temperatures and RPM alike; a fixed
    // default would be wrong for at least one of them.
    expect(formatNumber(45.67, undefined)).toBe("45.7");
    expect(formatNumber(1200, undefined)).toBe("1200");
    expect(formatNumber(0.5, undefined)).toBe("0.5");
    expect(formatNumber(45.0, undefined)).toBe("45");
  });

  it("handles negatives", () => {
    expect(formatNumber(-3.25, 1)).toBe("-3.3");
    expect(formatNumber(-0.04, undefined)).toBe("0");
  });
});

describe("formatUnit", () => {
  it("omits a space before a percent or degree sign", () => {
    // The most visible formatting error on a dashboard.
    expect(formatUnit("%", "short", undefined)).toBe("%");
    expect(formatUnit("°C", "short", undefined)).toBe("°C");
  });

  it("adds a space before a word-like unit", () => {
    expect(formatUnit("RPM", "short", undefined)).toBe(" RPM");
    expect(formatUnit("W", "short", undefined)).toBe(" W");
  });

  it("renders nothing for none or a missing unit", () => {
    expect(formatUnit("%", "none", undefined)).toBe("");
    expect(formatUnit(undefined, "short", undefined)).toBe("");
    expect(formatUnit("", "short", undefined)).toBe("");
  });

  it("uses a long name when one is supplied", () => {
    expect(formatUnit("W", "long", { W: "watts" })).toBe(" watts");
  });

  it("falls back to the short symbol rather than inventing a long name", () => {
    expect(formatUnit("RPM", "long", undefined)).toBe(" RPM");
  });
});

describe("text layout (§89)", () => {
  const layoutOf = (
    content: { runs: unknown[]; [key: string]: unknown },
    height = 60,
  ) => {
    const runs =
      content.runs.length === 0
        ? [{ kind: "literal", text: "", typePreset: "typePresets.layout" }]
        : content.runs;
    const node = {
      id: "t",
      type: "text",
      transform: { width: 200, height },
      content: { ...content, runs },
    } as unknown as ThemeNode;

    const result = plan(
      documentWith([node], {
        typePresets: {
          layout: {
            name: "Layout",
            value: { family: "Inter", size: 20, lineHeight: 1.5 },
          },
        },
      }),
    );
    const planned = result.nodes[0]!.content;
    if (planned.kind !== "text") {
      throw new Error("expected a text node");
    }
    return planned.layout;
  };

  it("clips by default", () => {
    // §89 wants overflow explicit. Of the three modes, clipping is the only one
    // that cannot mislead: it shows less rather than something else.
    expect(layoutOf({ runs: [] })).toMatchObject({
      wrap: false,
      overflow: "clip",
      align: "left",
      verticalAlign: "top",
    });
  });

  it("carries authored layout through", () => {
    expect(
      layoutOf({
        runs: [],
        wrap: true,
        overflow: "visible",
        align: "right",
        verticalAlign: "bottom",
      }),
    ).toMatchObject({
      wrap: true,
      overflow: "visible",
      align: "right",
      verticalAlign: "bottom",
    });
  });

  it("computes a line clamp only for wrapped, ellipsised text", () => {
    // text-overflow: ellipsis applies to a single line; only a clamp ellipsises
    // wrapped text, and a clamp needs a line count.
    expect(
      layoutOf({ runs: [], wrap: true, overflow: "ellipsis" }, 60).maxLines,
    ).toBe(2);
    expect(
      layoutOf({ runs: [], wrap: false, overflow: "ellipsis" }, 60).maxLines,
    ).toBeUndefined();
    expect(
      layoutOf({ runs: [], wrap: true, overflow: "clip" }, 60).maxLines,
    ).toBeUndefined();
  });

  it("omits the clamp when the type size is not resolvable", () => {
    // A wrong clamp is worse than none: it hides text that would have fitted.
    expect(
      layoutOf(
        {
          runs: [{ kind: "literal", text: "" }],
          wrap: true,
          overflow: "ellipsis",
        },
        60,
      ).maxLines,
    ).toBeUndefined();
  });
});

describe("computeMaxLines", () => {
  it("divides the box by the line box", () => {
    expect(computeMaxLines(60, 20, 1.5)).toBe(2);
    expect(computeMaxLines(100, 10, 1)).toBe(10);
  });

  it("defaults the line height when none is given", () => {
    // 1.2 — the same default a browser applies to `normal`.
    expect(computeMaxLines(48, 20, undefined)).toBe(2);
  });

  it("never returns zero", () => {
    // A box too short for one line should still show that line clipped rather
    // than nothing at all.
    expect(computeMaxLines(5, 40, 1.2)).toBe(1);
  });

  it("returns undefined for unusable input rather than guessing", () => {
    expect(computeMaxLines(0, 20, 1.2)).toBeUndefined();
    expect(computeMaxLines(-10, 20, 1.2)).toBeUndefined();
    expect(computeMaxLines(60, 0, 1.2)).toBeUndefined();
    expect(computeMaxLines(60, "20px", 1.2)).toBeUndefined();
    expect(computeMaxLines(Number.NaN, 20, 1.2)).toBeUndefined();
  });

  it("ignores a nonsensical line height instead of dividing by zero", () => {
    expect(computeMaxLines(60, 20, 0)).toBe(2);
    expect(computeMaxLines(60, 20, -3)).toBe(2);
  });
});
