// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  buildPieOption,
  type ChartContent,
  computeComposition,
  defaultLineSettings,
  defaultPieSettings,
  type LineSettings,
  type PieSettings,
} from "@vigilia/renderer-core";
import { type ChartPropertyPanel, createChartPropertyPanel } from "./panel.js";

describe("every control the panel offers", () => {
  // The panel was the one place in the shell where a control had no id and its
  // label no `htmlFor`, so an assistive technology announced an unlabelled
  // field and a test could not reach the corner-radius control by name at all —
  // `querySelector('label[for=...]')` had nothing to match. Asserting on
  // position instead of association is what let it survive.
  const charts = [
    {
      id: "gauge",
      content: {
        family: "gauge" as const,
        settings: {
          startAngle: 90,
          endAngle: -270,
          min: 0,
          max: 100,
          thickness: 10,
          track: { kind: "solid" as const, color: "#000" },
          progress: { kind: "solid" as const, color: "#fff" },
          roundCap: true,
        },
      },
      bindings: [{ id: "g", semanticKey: "ram.used.percent" }],
    },
    {
      id: "trend",
      content: {
        family: "line" as const,
        settings: {
          lineWidth: 2,
          interpolation: "smooth" as const,
          stroke: { kind: "solid" as const, color: "#00b8d9" },
          showMarkers: false,
          markerSize: 4,
          windowSeconds: 60,
          maxPoints: 600,
          showAxes: false,
          // Two slices of paint: ids must stay unique across a `multiple` row,
          // not just across one family's settings.
          palette: [
            { ref: "palette.cpu" },
            { ref: "palette.gpu" },
            { ref: "palette.ram" },
          ],
        },
      },
      bindings: [
        { id: "cpu", semanticKey: "cpu.load" },
        { id: "gpu", semanticKey: "gpu.load" },
      ],
    },
    {
      id: "storage",
      content: {
        family: "bar" as const,
        settings: {
          orientation: "horizontal" as const,
          min: 0,
          max: 100,
          barWidth: 20,
          categoryGapPercent: 40,
          cornerRadius: 10,
          trackCornerRadius: 10,
          fill: { ref: "palette.storageFill" },
          track: { ref: "palette.chartTrack" },
          showAxes: false,
          showCategoryLabels: false,
        },
      },
      bindings: [{ id: "disk", semanticKey: "disk.used" }],
    },
    {
      id: "pie",
      content: {
        family: "pie" as const,
        settings: {
          innerRadiusPercent: 0,
          outerRadiusPercent: 80,
          startAngle: 0,
          endAngle: 360,
          padAngle: 0,
          cornerRadius: 4,
          showLabels: false,
          palette: [{ ref: "palette.storageFill" }],
          remainderFill: { ref: "palette.chartTrack" },
        },
      },
      bindings: [{ id: "slice", semanticKey: "disk.used" }],
    },
  ];

  it("reaches every control by its label rather than by position", () => {
    const panel = createChartPropertyPanel(
      document.body,
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );

    for (const chart of charts) {
      panel.render(chart as Parameters<ChartPropertyPanel["render"]>[0]);
      const controls = [
        ...panel.root.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
          "input, select, textarea",
        ),
      ];
      expect(controls.length).toBeGreaterThan(0);

      for (const control of controls) {
        const named = control.id !== "";
        expect(named, `${chart.id}: a control with no id`).toBe(true);

        const labels = [...(control.labels ?? [])];
        const text = labels.map((l) => l.textContent?.trim() ?? "");
        expect(
          text.some((t) => t.length > 0),
          `${chart.id}: "${control.id}" has no label with words on it`,
        ).toBe(true);
      }
    }
  });

  it("keeps those ids unique, including across bindings and repeated paint", () => {
    // Two bindings render the same fields twice and a `multiple` paint row
    // renders one control per slice, so a positional id would collide and the
    // second control's label would name the first.
    const panel = createChartPropertyPanel(
      document.body,
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );
    panel.render(charts[1] as Parameters<ChartPropertyPanel["render"]>[0]);

    const ids = [...panel.root.querySelectorAll<HTMLElement>("[id]")].map(
      (element) => element.id,
    );
    expect(ids).toHaveLength(new Set(ids).size);
  });

  it("reaches the corner-radius control by its label", () => {
    // The exact lookup that returned nothing twice: name the control, not find
    // it by walking the section.
    const panel = createChartPropertyPanel(
      document.body,
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );
    panel.render(charts[2] as Parameters<ChartPropertyPanel["render"]>[0]);

    const byLabel = [...panel.root.querySelectorAll("label")].find(
      (l) => l.textContent?.trim() === "Corner radius",
    );
    expect(byLabel).toBeDefined();
    const control = document.getElementById(byLabel!.htmlFor);
    expect(control?.getAttribute("data-vigilia-chart-setting")).toBe(
      "cornerRadius",
    );

    const trackByLabel = [...panel.root.querySelectorAll("label")].find(
      (l) => l.textContent?.trim() === "Track corner radius",
    );
    expect(trackByLabel).toBeDefined();
    expect(
      document
        .getElementById(trackByLabel!.htmlFor)
        ?.getAttribute("data-vigilia-chart-setting"),
    ).toBe("trackCornerRadius");
  });
});

describe("chart property panel", () => {
  it("names the series it removes, and removes only that one", () => {
    // The reconciliation that keeps each series its own colour lives in the
    // manager; this is the control that reaches it, and it names the reading so
    // an author can tell three "Remove" buttons apart.
    const onRemoveBinding = vi.fn();
    const panel = createChartPropertyPanel(
      document.body,
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      onRemoveBinding,
    );
    const bindings = [
      { id: "b1", semanticKey: "cpu.load" },
      { id: "b2", semanticKey: "gpu.load" },
      { id: "b3", semanticKey: "ram.used.percent" },
    ];
    panel.render(
      {
        id: "trend",
        content: {
          family: "line",
          settings: {
            lineWidth: 2,
            interpolation: "smooth",
            stroke: { kind: "solid", color: "#00b8d9" },
            showMarkers: false,
            markerSize: 4,
            windowSeconds: 60,
            maxPoints: 600,
            showAxes: false,
            palette: [
              { ref: "palette.cpu" },
              { ref: "palette.gpu" },
              { ref: "palette.ram" },
            ],
          },
        },
        bindings,
      },
      undefined,
    );

    const buttons = [
      ...panel.root.querySelectorAll<HTMLButtonElement>(
        "[data-vigilia-chart-binding-remove]",
      ),
    ];
    expect(buttons.map((b) => b.textContent)).toEqual([
      "Remove the series reading cpu.load",
      "Remove the series reading gpu.load",
      "Remove the series reading ram.used.percent",
    ]);
    buttons[1]?.click();
    expect(onRemoveBinding).toHaveBeenCalledWith("trend", "b2");
  });

  it("offers line aspect presets and visible history", () => {
    const resize = vi.fn();
    const panel = createChartPropertyPanel(
      document.body,
      vi.fn(),
      vi.fn(),
      resize,
      vi.fn(),
      vi.fn(),
    );
    panel.render({
      id: "trend",
      content: {
        family: "line",
        settings: {
          lineWidth: 2,
          interpolation: "smooth",
          stroke: { kind: "solid", color: "#00b8d9" },
          showMarkers: false,
          markerSize: 4,
          windowSeconds: 60,
          maxPoints: 600,
          showAxes: false,
        },
      },
      bindings: [],
    });

    expect(
      panel.root.querySelector('[data-vigilia-chart-setting="windowSeconds"]')
        ?.previousSibling?.textContent,
    ).toBe("Visible history (s)");
    expect(
      panel.root.querySelector('[data-vigilia-chart-aspect="2"]'),
    ).not.toBeNull();
    expect(
      panel.root.querySelector('[data-vigilia-chart-aspect="3"]'),
    ).not.toBeNull();
    expect(
      panel.root.querySelector('[data-vigilia-chart-aspect="4"]'),
    ).not.toBeNull();
    panel.root
      .querySelector<HTMLButtonElement>('[data-vigilia-chart-aspect="2"]')!
      .click();
    expect(resize).toHaveBeenCalledWith("trend", 2);
  });

  it("derives controls from the shared field descriptors and returns authored settings", () => {
    const change = vi.fn();
    const bindingChange = vi.fn();
    const panel = createChartPropertyPanel(
      document.body,
      change,
      bindingChange,
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );
    const content = {
      family: "gauge" as const,
      settings: {
        startAngle: 90,
        endAngle: -270,
        min: 0,
        max: 100,
        thickness: 10,
        track: { kind: "solid" as const, color: "#000000" },
        progress: { kind: "solid" as const, color: "#ffffff" },
        roundCap: true,
      },
    };

    panel.render({
      id: "cpu-gauge",
      content,
      bindings: [{ id: "cpu", semanticKey: "cpu.load" }],
    });

    const thickness = panel.root.querySelector<HTMLInputElement>(
      '[data-vigilia-chart-setting="thickness"]',
    )!;
    expect(thickness.value).toBe("10");
    thickness.value = "20";
    thickness.dispatchEvent(new Event("change"));

    expect(change).toHaveBeenCalledWith(
      "cpu-gauge",
      expect.objectContaining({ thickness: 20 }),
    );
    expect(
      panel.root.querySelector('[data-vigilia-chart-setting="track"]'),
    ).toBeNull();

    const binding = panel.root.querySelector<HTMLSelectElement>(
      '[data-vigilia-binding="cpu"]',
    )!;
    binding.value = "ram.used";
    binding.dispatchEvent(new Event("change"));
    expect(bindingChange).toHaveBeenCalledWith("cpu-gauge", {
      id: "cpu",
      semanticKey: "ram.used",
    });

    const precision = panel.root.querySelector<HTMLInputElement>(
      '[data-vigilia-binding-field="cpu.precision"]',
    )!;
    precision.value = "2";
    precision.dispatchEvent(new Event("change"));
    expect(bindingChange).toHaveBeenLastCalledWith("cpu-gauge", {
      id: "cpu",
      semanticKey: "cpu.load",
      precision: 2,
    });

    const unitDisplay = panel.root.querySelector<HTMLSelectElement>(
      '[data-vigilia-binding-field="cpu.unitDisplay"]',
    )!;
    unitDisplay.value = "long";
    unitDisplay.dispatchEvent(new Event("change"));
    expect(bindingChange).toHaveBeenLastCalledWith("cpu-gauge", {
      id: "cpu",
      semanticKey: "cpu.load",
      unitDisplay: "long",
    });

    const scale = panel.root.querySelector<HTMLInputElement>(
      '[data-vigilia-binding-field="cpu.scale"]',
    )!;
    scale.value = "1.5";
    scale.dispatchEvent(new Event("change"));
    expect(bindingChange).toHaveBeenLastCalledWith("cpu-gauge", {
      id: "cpu",
      semanticKey: "cpu.load",
      scale: 1.5,
    });

    const offset = panel.root.querySelector<HTMLInputElement>(
      '[data-vigilia-binding-field="cpu.offset"]',
    )!;
    offset.value = "-4";
    offset.dispatchEvent(new Event("change"));
    expect(bindingChange).toHaveBeenLastCalledWith("cpu-gauge", {
      id: "cpu",
      semanticKey: "cpu.load",
      offset: -4,
    });
  });
});

describe("the series a chart reads", () => {
  const trend = (
    bindings: readonly { id: string; semanticKey: string }[],
  ): Parameters<ChartPropertyPanel["render"]>[0] => ({
    id: "trends",
    content: {
      family: "line",
      settings: {
        lineWidth: 2,
        interpolation: "smooth",
        stroke: { kind: "solid", color: "#0af" },
        showMarkers: false,
        markerSize: 4,
        windowSeconds: 60,
        maxPoints: 600,
        showAxes: false,
      },
    },
    bindings,
  });

  it("declares the first series, which is what a chart arrives without", () => {
    // The panel could only ever edit a binding the document already declared,
    // and a chart inserted through the Add pane declares none — so the whole
    // family was unauthorable from the surface.
    const add = vi.fn();
    const panel = createChartPropertyPanel(
      document.body,
      vi.fn(),
      vi.fn(),
      vi.fn(),
      add,
      vi.fn(),
    );
    panel.render(trend([]));

    const chooser = panel.root.querySelector<HTMLSelectElement>(
      "[data-vigilia-chart-binding-add]",
    )!;
    chooser.value = "cpu.load";
    chooser.dispatchEvent(new Event("change"));

    expect(add).toHaveBeenCalledWith("trends", "cpu.load");
    // The choice is consumed rather than held, so re-rendering the panel cannot
    // create the same series a second time.
    expect(chooser.value).toBe("");
  });

  it("removes a series, but never the last one", () => {
    const remove = vi.fn();
    const panel = createChartPropertyPanel(
      document.body,
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      remove,
    );

    panel.render(trend([{ id: "a", semanticKey: "cpu.load" }]));
    expect(
      panel.root.querySelector("[data-vigilia-chart-binding-remove]"),
    ).toBeNull();

    panel.render(
      trend([
        { id: "a", semanticKey: "cpu.load" },
        { id: "b", semanticKey: "gpu.load" },
      ]),
    );
    panel.root
      .querySelector<HTMLButtonElement>(
        '[data-vigilia-chart-binding-remove="b"]',
      )!
      .click();
    expect(remove).toHaveBeenCalledWith("trends", "b");
  });

  it("says a gauge takes one reading rather than accepting a second", () => {
    // `buildChartPlan` reads `bindings[0]` for a gauge and ignores the rest, so
    // a second one would be a control that accepts an edit and applies none.
    const add = vi.fn();
    const panel = createChartPropertyPanel(
      document.body,
      vi.fn(),
      vi.fn(),
      vi.fn(),
      add,
      vi.fn(),
    );
    panel.render({
      id: "ram-gauge",
      content: {
        family: "gauge",
        settings: {
          startAngle: 90,
          endAngle: -270,
          min: 0,
          max: 100,
          thickness: 10,
          track: { kind: "solid", color: "#000" },
          progress: { kind: "solid", color: "#fff" },
          roundCap: true,
        },
      },
      bindings: [{ id: "a", semanticKey: "ram.used.percent" }],
    });

    const chooser = panel.root.querySelector<HTMLSelectElement>(
      "[data-vigilia-chart-binding-add]",
    )!;
    expect(chooser.disabled).toBe(true);
    expect(
      panel.root.querySelector("[data-vigilia-chart-binding-full]")!
        .textContent,
    ).toContain("gauge");
  });
});

/** A reading the composition can actually measure. */
function sample(sensorId: string, value: number) {
  return {
    sensorId,
    timestamp: "2026-01-01T00:00:00Z",
    status: "ok" as const,
    value,
    unit: "GB",
  };
}

function panelOf(
  change: (id: string, settings: ChartContent["settings"]) => void,
) {
  return createChartPropertyPanel(
    document.body,
    change,
    vi.fn(),
    vi.fn(),
    vi.fn(),
    vi.fn(),
  );
}

const pieOf = (settings: PieSettings) => ({
  id: "ram",
  content: { family: "pie" as const, settings },
  bindings: [],
});

/** The last settings the panel committed. */
function committed<T>(change: ReturnType<typeof vi.fn>): T {
  return change.mock.calls.at(-1)?.[1] as T;
}

describe("a setting one level down", () => {
  it("commits the fixed total where the renderer reads it, not as a flat key", () => {
    // The live regression this replaces: the panel committed
    // `{...settings, [property]: value}`, so picking "A fixed total" wrote
    // `total: "fixed"` — a string where the union belongs — and the number
    // behind it wrote a literal `"total.value"` key the renderer never reads.
    const change = vi.fn();
    const panel = panelOf(change);
    panel.render(pieOf(defaultPieSettings));

    const total = panel.root.querySelector<HTMLSelectElement>(
      '[data-vigilia-chart-setting="total"]',
    )!;
    total.value = "fixed";
    total.dispatchEvent(new Event("change"));

    const fixed = committed<PieSettings>(change);
    expect(fixed.total).toEqual({ kind: "fixed" });
    expect("total.value" in fixed).toBe(false);

    panel.render(pieOf(fixed));
    const value = panel.root.querySelector<HTMLInputElement>(
      '[data-vigilia-chart-setting="total.value"]',
    )!;
    value.value = "64";
    value.dispatchEvent(new Event("change"));

    const authored = committed<PieSettings>(change);
    expect("total.value" in authored).toBe(false);
    expect(authored.total).toEqual({ kind: "fixed", value: 64 });

    // Measured through the renderer that draws it rather than restated from the
    // settings object: the remainder exists only because the path the descriptor
    // declares is the path `computeComposition` reads.
    const composition = computeComposition(authored, [
      { sensorId: "ram.used", sample: sample("ram.used", 20) },
      { sensorId: "ram.cached", sample: sample("ram.cached", 12) },
    ]);
    expect(composition.remainder).toBe(64 - 32);
  });

  it("writes an animation field into the block, not under a dotted key", () => {
    const change = vi.fn();
    const panel = panelOf(change);
    panel.render({
      id: "trend",
      content: { family: "line", settings: { ...defaultLineSettings } },
      bindings: [],
    });

    const duration = panel.root.querySelector<HTMLInputElement>(
      '[data-vigilia-chart-setting="animation.durationMs"]',
    )!;
    duration.value = "2400";
    duration.dispatchEvent(new Event("change"));

    const authored = committed<LineSettings>(change);
    expect("animation.durationMs" in authored).toBe(false);
    // The author's one field plus the other three from the block's own owner.
    expect(authored.animation).toEqual({
      durationMs: 2400,
      easing: "linear",
      appearMs: 650,
      appearEasing: "cubicOut",
    });
  });

  it("asks the fixed-total question only while the total is fixed", () => {
    const panel = panelOf(vi.fn());

    panel.render(pieOf(defaultPieSettings));
    // Not a disabled control: a question that does not apply here is not asked.
    expect(
      panel.root.querySelector('[data-vigilia-chart-setting="total.value"]'),
    ).toBeNull();

    panel.render(
      pieOf({ ...defaultPieSettings, total: { kind: "fixed", value: 64 } }),
    );
    expect(
      panel.root.querySelector('[data-vigilia-chart-setting="total.value"]'),
    ).not.toBeNull();
  });

  it("clears an optional setting back to the renderer's own choice", () => {
    const change = vi.fn();
    const panel = panelOf(change);
    panel.render(pieOf({ ...defaultPieSettings, endAngle: 200 }));

    const end = panel.root.querySelector<HTMLInputElement>(
      '[data-vigilia-chart-setting="endAngle"]',
    )!;
    expect(end.value).toBe("200");
    end.value = "";
    end.dispatchEvent(new Event("change"));

    const cleared = committed<PieSettings>(change);
    expect("endAngle" in cleared).toBe(false);

    // Through the option builder, not the settings object: absent means the
    // builder leaves `endAngle` off and the engine closes the ring.
    const ring = (settings: PieSettings) =>
      (
        buildPieOption(settings, []) as unknown as {
          readonly series: readonly Record<string, unknown>[];
        }
      ).series[0];
    expect(ring({ ...defaultPieSettings, endAngle: 200 })?.["endAngle"]).toBe(
      200,
    );
    expect(ring(cleared)?.["endAngle"]).toBeUndefined();
  });
});
