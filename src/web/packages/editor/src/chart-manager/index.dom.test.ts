// @vitest-environment jsdom
import { createDemoSource } from "@vigilia/fake-source";
import type { Binding } from "@vigilia/renderer-core";
import { defaultGaugeSettings } from "@vigilia/renderer-core";
import { type SceneAdapter, VigiliaChart } from "@vigilia/scene-fabric";
import { describe, expect, it, vi } from "vitest";
import type { EditorInteraction } from "../editor-interaction.js";
import { ChartManager } from "./index.js";

describe("ChartManager", () => {
  it.each(["gauge", "line", "bar", "pie"] as const)(
    "adds, selects and records a palette-backed %s",
    (family) => {
      const objects: VigiliaChart[] = [];
      const canvas = {
        on: vi.fn(),
        off: vi.fn(),
        add: vi.fn((chart: VigiliaChart) => objects.push(chart)),
        getActiveObject: vi.fn(),
        getObjects: vi.fn(() => objects),
        requestRenderAll: vi.fn(),
        setActiveObject: vi.fn(),
      };
      const historyManager = { saveState: vi.fn() };
      const manager = new ChartManager({
        editor: { canvas, historyManager } as unknown as EditorInteraction,
        scene: {} as SceneAdapter,
        source: createDemoSource(0),
        globals: {
          palette: {
            none: {
              name: "None",
              value: { kind: "solid", color: "transparent" },
            },
            ink: {
              name: "Ink",
              value: { kind: "solid", color: "#102030" },
            },
          },
        },
        panelHost: document.body,
      });

      manager.addChart(family);

      const chart = objects[0]!;
      expect(chart).toMatchObject({ family, width: 240, height: 160 });
      // A corner origin, as a panel and a text object both now are, so the
      // inspector's X and Y are the chart's corner rather than its middle. A
      // chart is the object a dashboard's layout is most sensitive to, and a
      // centre origin put every one of them half its own size from where the
      // author put it.
      expect(chart.originX).toBe("left");
      expect(chart.originY).toBe("top");
      expect(JSON.stringify(chart.settings)).toContain("palette.ink");
      expect(canvas.setActiveObject).toHaveBeenCalledWith(chart);
      expect(historyManager.saveState).toHaveBeenCalledTimes(1);
      manager.destroy();
    },
  );

  it("does not add a chart when no palette reference can be derived", () => {
    const canvas = {
      on: vi.fn(),
      off: vi.fn(),
      add: vi.fn(),
      getActiveObject: vi.fn(),
      getObjects: vi.fn(() => []),
      requestRenderAll: vi.fn(),
      setActiveObject: vi.fn(),
    };
    const historyManager = { saveState: vi.fn() };
    const manager = new ChartManager({
      editor: { canvas, historyManager } as unknown as EditorInteraction,
      scene: {} as SceneAdapter,
      source: createDemoSource(0),
      panelHost: document.body,
    });

    expect(() => manager.addChart("gauge")).toThrow("palette token");
    expect(canvas.add).not.toHaveBeenCalled();
    expect(historyManager.saveState).not.toHaveBeenCalled();
    manager.destroy();
  });

  it("hydrates a revived chart without bindings", () => {
    const chart = Object.assign(Object.create(VigiliaChart.prototype), {
      id: "unbound-gauge",
      family: "gauge",
      settings: {
        ...defaultGaugeSettings,
        track: { ref: "palette.track" },
        progress: { ref: "palette.accent" },
      },
    }) as VigiliaChart;
    const canvas = {
      on: vi.fn(),
      off: vi.fn(),
      getActiveObject: vi.fn(),
      getObjects: vi.fn(() => [chart]),
      requestRenderAll: vi.fn(),
    };
    const manager = new ChartManager({
      editor: { canvas } as unknown as EditorInteraction,
      scene: {} as SceneAdapter,
      source: createDemoSource(0),
      globals: {
        palette: {
          track: { name: "Track", value: { kind: "solid", color: "#223344" } },
          accent: {
            name: "Accent",
            value: { kind: "solid", color: "#00b8d9" },
          },
        },
      },
      panelHost: document.body,
    });

    expect(chart.option).toMatchObject({ series: expect.any(Array) });
    manager.destroy();
  });

  it("updates the selected Fabric chart from envelope bindings", () => {
    const listeners = new Map<string, (event?: unknown) => void>();
    const chart = Object.assign(Object.create(VigiliaChart.prototype), {
      id: "cpu-gauge",
      family: "gauge",
      settings: {
        ...defaultGaugeSettings,
        track: { ref: "palette.track" },
        progress: { ref: "palette.accent" },
      },
      width: 100,
      height: 100,
      scaleX: 2,
      scaleY: 1.5,
      resizeTo: vi.fn(),
    }) as VigiliaChart;
    let revivedChart = chart;
    const canvas = {
      on: vi.fn((event: string, listener: (event?: unknown) => void) =>
        listeners.set(event, listener),
      ),
      off: vi.fn(),
      getActiveObject: vi.fn(() => chart),
      getObjects: vi.fn(() => [revivedChart]),
      requestRenderAll: vi.fn(),
    };
    const scene = { objectFor: vi.fn(() => chart) } as unknown as SceneAdapter;
    const manager = new ChartManager({
      editor: { canvas } as unknown as EditorInteraction,
      scene,
      source: createDemoSource(0),
      bindings: { "cpu-gauge": [{ id: "cpu", semanticKey: "cpu.load" }] },
      globals: {
        palette: {
          none: {
            name: "None",
            value: { kind: "solid", color: "transparent" },
          },
          track: { name: "Track", value: { kind: "solid", color: "#223344" } },
          accent: {
            name: "Accent",
            value: { kind: "solid", color: "#00b8d9" },
          },
        },
      },
      panelHost: document.body,
    });

    expect(chart.option).toMatchObject({ series: expect.any(Array) });

    listeners.get("object:modified")!({ target: chart });
    expect(chart.resizeTo).toHaveBeenCalledWith(200, 150);

    listeners.get("selection:created")!();
    const binding = document.querySelector<HTMLSelectElement>(
      '[data-vigilia-binding="cpu"]',
    )!;
    binding.value = "ram.used";
    binding.dispatchEvent(new Event("change"));
    expect(chart.option).toMatchObject({ series: expect.any(Array) });

    const thickness = document.querySelector<HTMLInputElement>(
      '[data-vigilia-chart-setting="thickness"]',
    )!;
    thickness.value = "24";
    thickness.dispatchEvent(new Event("change"));

    expect(chart.settings).toMatchObject({ thickness: 24 });
    expect(
      document.querySelector<HTMLInputElement>(
        '[data-vigilia-chart-setting="thickness"]',
      )!.value,
    ).toBe("24");

    const progress = document.querySelector<HTMLSelectElement>(
      '[data-vigilia-chart-paint="progress"]',
    )!;
    progress.value = "palette.track";
    progress.dispatchEvent(new Event("change"));
    expect(chart.settings).toMatchObject({
      progress: { ref: "palette.track" },
    });

    revivedChart = Object.assign(Object.create(VigiliaChart.prototype), {
      id: "cpu-gauge",
      family: "gauge",
      settings: chart.settings,
    }) as VigiliaChart;
    listeners.get("editor:history-state-loaded")!();
    expect(revivedChart.option).toMatchObject({ series: expect.any(Array) });

    listeners.get("editor:object-pasted")!();
    expect(revivedChart.option).toMatchObject({ series: expect.any(Array) });

    manager.destroy();
    expect(canvas.off).toHaveBeenCalledTimes(6);
  });
});

describe("a chart that throws", () => {
  it("costs that chart alone, and the rest of the scene keeps repainting", () => {
    // **The claim under test.** `EditorSession.refresh()` composes the text
    // repaint and `ChartManager.refresh()` in one callback, so a chart whose
    // `setOption` throws must not stop the readings beside it — otherwise one
    // bad option freezes the whole editor, which is the same defect one level
    // up in the frame loop.
    const good = new VigiliaChart({
      id: "good",
      family: "gauge",
      width: 100,
      height: 100,
      settings: defaultGaugeSettings,
    });
    const bad = new VigiliaChart({
      id: "bad",
      family: "gauge",
      width: 100,
      height: 100,
      settings: defaultGaugeSettings,
    });
    const goodSetOption = vi
      .spyOn(good, "setOption")
      .mockImplementation(() => undefined);
    const badSetOption = vi.spyOn(bad, "setOption").mockImplementation(() => {
      throw new Error("setOption blew up");
    });

    const objects = [bad, good];
    const canvas = {
      on: vi.fn(),
      off: vi.fn(),
      add: vi.fn(),
      getActiveObject: vi.fn(),
      getObjects: vi.fn(() => objects),
      requestRenderAll: vi.fn(),
      setActiveObject: vi.fn(),
    };
    const warn = vi.fn();
    const manager = new ChartManager({
      editor: {
        canvas,
        historyManager: { saveState: vi.fn() },
        errorManager: { warn, error: vi.fn() },
      } as unknown as EditorInteraction,
      scene: {} as SceneAdapter,
      source: createDemoSource(0),
      panelHost: document.body,
    });

    // The constructor hydrates too, so the spies are cleared and the assertion
    // is about one refresh pass rather than about how often the manager runs.
    goodSetOption.mockClear();
    badSetOption.mockClear();
    warn.mockClear();

    manager.refresh();

    // The healthy chart drew. If the throw had escaped, the loop would have
    // ended here and this would be zero — which is the whole assertion.
    expect(goodSetOption).toHaveBeenCalledTimes(1);
    expect(badSetOption).toHaveBeenCalledTimes(1);
    // And it was reported rather than swallowed: a silently frozen chart is
    // indistinguishable from a chart with no data.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[1])).toContain("setOption blew up");
    manager.destroy();
  });
});

describe("a chart's series paint", () => {
  /**
   * Measured on the surface while building the trends panel: a line chart with
   * three sensors bound showed **one** "Series paint" control, and all three
   * lines drew in it. A new chart declares one series colour and kept it
   * however many bindings arrived, so a three-series chart — the target's
   * blue, violet and teal — was unreachable.
   */
  function harness() {
    const objects: VigiliaChart[] = [];
    const canvas = {
      add: (object: VigiliaChart) => objects.push(object),
      setActiveObject: vi.fn(),
      getActiveObject: () => objects.at(-1),
      getObjects: () => objects,
      on: vi.fn(),
      off: vi.fn(),
      requestRenderAll: vi.fn(),
    };
    const panelHost = document.createElement("div");
    let bindings: readonly Binding[] = [];
    const manager = new ChartManager({
      editor: {
        canvas,
        historyManager: { saveState: vi.fn() },
        errorManager: { warn: vi.fn(), error: vi.fn() },
      } as never,
      scene: {} as never,
      source: { latest: () => undefined, history: () => [] } as never,
      globals: {
        palette: {
          ink: { name: "Ink", value: { kind: "solid", color: "#102030" } },
        },
      } as never,
      panelHost,
    });
    return { manager, panelHost, objects, bindingsOf: () => bindings };
  }

  it("gains a series paint for every series bound", () => {
    const { manager, panelHost, objects } = harness();
    manager.addChart("line");
    const palette = (): unknown =>
      (objects[0]?.settings as unknown as Record<string, unknown>)["palette"];
    expect(Array.isArray(palette()) && (palette() as unknown[]).length).toBe(1);

    for (const semanticKey of ["cpu.load", "gpu.load", "ram.used.percent"]) {
      const chooser = panelHost.querySelector<HTMLSelectElement>(
        "[data-vigilia-chart-binding-add]",
      )!;
      chooser.value = semanticKey;
      chooser.dispatchEvent(new Event("change"));
    }

    expect((palette() as unknown[]).length).toBe(3);
    // The control follows the array, so three entries means three pickers.
    expect(
      panelHost.querySelectorAll("[data-vigilia-chart-paint^='palette']")
        .length,
    ).toBe(3);
    manager.destroy();
  });

  it("leaves a gauge's paints alone, because a gauge has no series", () => {
    const { manager, panelHost, objects } = harness();
    manager.addChart("gauge");
    const before = objects[0]?.settings;
    const chooser = panelHost.querySelector<HTMLSelectElement>(
      "[data-vigilia-chart-binding-add]",
    )!;
    chooser.value = "cpu.load";
    chooser.dispatchEvent(new Event("change"));

    // A gauge's track and progress are not per-series, so nothing about them
    // changes when a sensor is bound to it.
    expect(objects[0]?.settings).toEqual(before);
    manager.destroy();
  });
});
