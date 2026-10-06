// @vitest-environment jsdom
import { createDemoSource } from "@vigilia/fake-source";
import type { Binding } from "@vigilia/renderer-core";
import {
  type GaugeSettings,
  defaultGaugeSettings,
  defaultLineSettings,
} from "@vigilia/renderer-core";
import {
  type SceneAdapter,
  serialiseScene,
  VigiliaChart,
} from "@vigilia/scene-fabric";
import { Canvas, Group } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import type { EditorInteraction } from "../editor-interaction.js";
import { newObjectPlacement } from "../new-object-defaults.js";
import { ChartManager, carriedPaintFor } from "./index.js";

/** The authored frame a new chart has to land inside, as the editor supplies it. */
const artboard = () => ({ width: 1920, height: 1080 });

/**
 * Mounts the chart's own fields the way the inspector's column does: the two
 * bodies the owner hands over, into a host the test can query.
 *
 * The manager no longer owns a panel that redraws itself, so a test that reads
 * a control after a change rebuilds these bodies the way the inspector does —
 * on the `object:modified` the manager announces.
 */
function mountFields(
  manager: ChartManager,
  chart: VigiliaChart,
  host: HTMLElement,
): void {
  host.replaceChildren(
    ...manager.fields.content(chart),
    ...manager.fields.paint(chart),
  );
}

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
        // A settings write is announced the way a gesture is, so the inspector
        // re-reads the column; a stub canvas carries the same event channel.
        fire: vi.fn(),
      };
      const historyManager = { saveState: vi.fn() };
      const manager = new ChartManager({
        editor: {
          canvas,
          historyManager,
          artboard,
        } as unknown as EditorInteraction,
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

  it("keeps each series its own colour when a middle one is removed", () => {
    // The per-series paint is a positional array sitting beside the bindings.
    // Filtering the bindings without it slid every later series onto its
    // neighbour's colour — silently, with nothing on screen that looked wrong.
    // Measured on the reference trends chart: removing the middle of CPU/GPU/RAM
    // left CPU on its blue and painted **RAM with the GPU's green**.
    const settings = {
      palette: [
        { ref: "palette.cpu" },
        { ref: "palette.gpu" },
        { ref: "palette.ram" },
      ],
    } as unknown as Parameters<typeof carriedPaintFor>[1];
    const cpu = { id: "b1", semanticKey: "cpu.load" };
    const gpu = { id: "b2", semanticKey: "gpu.load" };
    const ram = { id: "b3", semanticKey: "ram.used.percent" };
    const paint = (
      previous: readonly Binding[],
      next: readonly Binding[],
    ): unknown =>
      (
        carriedPaintFor("line", settings, previous, next) as {
          palette: unknown;
        }
      ).palette;

    // The middle one, where truncating from the end would leave cpu and gpu.
    expect(paint([cpu, gpu, ram], [cpu, ram])).toEqual([
      { ref: "palette.cpu" },
      { ref: "palette.ram" },
    ]);
    // The last one, which truncation already got right.
    expect(paint([cpu, gpu, ram], [cpu, gpu])).toEqual([
      { ref: "palette.cpu" },
      { ref: "palette.gpu" },
    ]);
    // Nothing removed: the settings come back untouched, so an unrelated edit
    // does not rewrite a chart's paint.
    expect(
      carriedPaintFor("line", settings, [cpu, gpu, ram], [cpu, gpu, ram]),
    ).toBe(settings);
  });

  it("keeps a series' paint when its key is repointed", () => {
    // **Repointing a chart's key emptied its paint, and unmounted the editor.**
    // The filter asked whether the *binding object* survived, but the panel
    // hands over `{ ...binding, semanticKey }` — a fresh object for a binding
    // nobody touched. So the one gesture every author makes on a chart reported
    // every series removed: the paint array was emptied, `seriesPaintFor` grew
    // it back by repeating `current.at(-1)` (which is `undefined`), and the
    // document carried `palette: [null]`.
    //
    // `chartPaint` reads a non-record as "must reference a palette token", so
    // the next `snapshot()` threw `Invalid Fabric theme` from inside React's
    // `useSyncExternalStore` — a render-phase throw, which unmounts the shell.
    // Measured: repointing the starter's own sparkline from `cpu.load` to
    // `gpu.load` unmounted the editor in 200 ms, which is what
    // `reference-theme.spec.ts:533` then waited 90 s for a save button to
    // reappear inside.
    const settings = {
      palette: [{ ref: "palette.frostInk" }],
    } as unknown as Parameters<typeof carriedPaintFor>[1];
    const before = { id: "cpu-card-spark", semanticKey: "cpu.load" };
    const after = { id: "cpu-card-spark", semanticKey: "gpu.load" };

    // Same series, new key: the paint is untouched, by identity.
    expect(carriedPaintFor("line", settings, [before], [after])).toBe(settings);

    // The removed case this filter exists for still works, on `id` now.
    expect(
      (
        carriedPaintFor(
          "line",
          {
            palette: [{ ref: "palette.cpu" }, { ref: "palette.gpu" }],
          } as unknown as Parameters<typeof carriedPaintFor>[1],
          [
            { id: "b1", semanticKey: "cpu.load" },
            { id: "b2", semanticKey: "gpu.load" },
          ],
          [{ id: "b1", semanticKey: "gpu.temp" }],
        ) as { palette: unknown }
      ).palette,
    ).toEqual([{ ref: "palette.cpu" }]);
  });

  it("keeps a chart's colour when a series is bound to it or unbound from it", () => {
    // **Binding a series to a chart emptied its own property panel.** An author
    // who bound a reading could not then choose the series colour: the panel went
    // from `[stroke, palette.0]` to `[]`, measured in live DOM.
    //
    // The filter walked `previous` and kept only entries whose series survived,
    // so an empty `previous` — binding the *first* series — kept nothing at all.
    // Unbinding the last one emptied it from the other side. `seriesPaintFor`
    // then regrew the empty array by repeating `current.at(-1)`, which is
    // `undefined`, so the envelope carried `palette: [null]`: a paint entry that
    // is not a record, which the validator refuses and no picker can render.
    const line = (entries: readonly unknown[]) =>
      ({ palette: entries }) as unknown as Parameters<
        typeof carriedPaintFor
      >[1];
    const paletteOf = (settings: unknown): unknown =>
      (settings as { palette: unknown }).palette;

    // Binding the first series to a chart inserted from the Add pane.
    expect(
      paletteOf(
        carriedPaintFor(
          "line",
          line([{ ref: "palette.series" }]),
          [],
          [{ id: "b1", semanticKey: "cpu.load" }],
        ),
      ),
    ).toEqual([{ ref: "palette.series" }]);

    // Unbinding the last one: the series is gone, but the slot it is chosen into
    // is not, and `seriesPaintFor` still guarantees one.
    expect(
      paletteOf(
        carriedPaintFor(
          "line",
          line([{ ref: "palette.cpu" }, { ref: "palette.gpu" }]),
          [
            { id: "b1", semanticKey: "cpu.load" },
            { id: "b2", semanticKey: "gpu.load" },
          ],
          [],
        ),
      ),
    ).toEqual([{ ref: "palette.cpu" }]);
  });

  it("draws a chart it did not create once the document's bindings reach it", () => {
    // A chart's series *are* its bindings, and this manager held only what it
    // was constructed with — so a card inserted from the library, whose charts
    // nothing here ever wrote, arrived with a binding set this side had never
    // heard of and drew with no series at all. The envelope is the owner; the
    // chart has to be told when it changed somewhere other than here.
    const objects: unknown[] = [];
    const canvas = {
      on: vi.fn(),
      off: vi.fn(),
      add: vi.fn((chart: unknown) => objects.push(chart)),
      getActiveObject: vi.fn(),
      getObjects: vi.fn(() => objects),
      requestRenderAll: vi.fn(),
      setActiveObject: vi.fn(),
    };
    const chart = new VigiliaChart({
      id: "card-sparkline",
      family: "line",
      settings: defaultLineSettings,
      width: 240,
      height: 160,
    });
    objects.push(chart);

    const manager = new ChartManager({
      editor: { canvas, artboard } as unknown as EditorInteraction,
      scene: {} as SceneAdapter,
      source: createDemoSource(0),
    });

    expect(chart.option?.series).toHaveLength(0);

    manager.setBindings({
      "card-sparkline": [{ id: "b1", semanticKey: "cpu.load" }],
    });

    expect(chart.option?.series).toHaveLength(1);
    manager.destroy();
    chart.dispose();
  });

  it("places a new chart on the same cascade a shape takes", () => {
    // The defect had two origins: the shapes and the text inset by 40, the
    // charts by their own 120, 80. A gauge inserted after a rectangle therefore
    // landed in a second corner rather than beside it, and neither origin knew
    // the other existed. This is the case that fails if a second origin returns.
    const objects: unknown[] = [];
    const canvas = {
      on: vi.fn(),
      off: vi.fn(),
      add: vi.fn((chart: unknown) => objects.push(chart)),
      getActiveObject: vi.fn(),
      getObjects: vi.fn(() => objects),
      requestRenderAll: vi.fn(),
      setActiveObject: vi.fn(),
      fire: vi.fn(),
    };
    const manager = new ChartManager({
      editor: {
        canvas,
        artboard,
        historyManager: { saveState: vi.fn() },
      } as unknown as EditorInteraction,
      scene: {} as SceneAdapter,
      source: createDemoSource(0),
      globals: {
        palette: {
          none: {
            name: "None",
            value: { kind: "solid" as const, color: "transparent" },
          },
          ink: {
            name: "Ink",
            value: { kind: "solid" as const, color: "#102030" },
          },
        },
      },
    });

    manager.addChart("gauge");
    const first = objects[0] as VigiliaChart;
    manager.addChart("gauge");
    const second = objects[1] as VigiliaChart;

    // The first chart takes the inset every other new object takes…
    expect({ left: first.left, top: first.top }).toEqual(
      newObjectPlacement(0, { width: 1920, height: 1080 }),
    );
    // …and the second steps from it, rather than joining it at the chart's own
    // 120, 80 that the shape path never knew about.
    expect({ left: second.left, top: second.top }).toEqual(
      newObjectPlacement(1, { width: 1920, height: 1080 }),
    );
    expect([second.left, second.top]).not.toEqual([120, 80]);
    manager.destroy();
  });

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
      editor: {
        canvas,
        historyManager,
        artboard,
      } as unknown as EditorInteraction,
      scene: {} as SceneAdapter,
      source: createDemoSource(0),
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
      editor: { canvas, artboard } as unknown as EditorInteraction,
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
    const host = document.createElement("div");
    document.body.append(host);
    const canvas = {
      on: vi.fn((event: string, listener: (event?: unknown) => void) =>
        listeners.set(event, listener),
      ),
      off: vi.fn(),
      getActiveObject: vi.fn(() => chart),
      getObjects: vi.fn(() => [revivedChart]),
      requestRenderAll: vi.fn(),
      // The inspector re-reads the column on `object:modified`, so a test
      // reading a control after a change rebuilds these bodies the same way.
      fire: () => mountFields(manager, chart, host),
    };
    const scene = { objectFor: vi.fn(() => chart) } as unknown as SceneAdapter;
    const manager = new ChartManager({
      editor: { canvas, artboard } as unknown as EditorInteraction,
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
    });
    mountFields(manager, chart, host);

    expect(chart.option).toMatchObject({ series: expect.any(Array) });

    listeners.get("object:modified")!({ target: chart });
    expect(chart.resizeTo).toHaveBeenCalledWith(200, 150);

    const binding = host.querySelector<HTMLSelectElement>(
      '[data-vigilia-binding="cpu"]',
    )!;
    binding.value = "ram.used";
    binding.dispatchEvent(new Event("change"));
    expect(chart.option).toMatchObject({ series: expect.any(Array) });

    const thickness = host.querySelector<HTMLInputElement>(
      '[data-vigilia-chart-setting="thickness"]',
    )!;
    thickness.value = "24";
    thickness.dispatchEvent(new Event("change"));

    expect(chart.settings).toMatchObject({ thickness: 24 });
    expect(
      host.querySelector<HTMLInputElement>(
        '[data-vigilia-chart-setting="thickness"]',
      )!.value,
    ).toBe("24");

    const progress = host.querySelector<HTMLSelectElement>(
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
    // `object:modified`, `editor:history-state-loaded`, `editor:object-pasted`.
    expect(canvas.off).toHaveBeenCalledTimes(3);
  });

  it("announces a ratio resize, so a geometry field re-reads the chart", () => {
    // **The claim under test.** A ratio button is a deliberate geometry edit,
    // and the object's Height changed — measured, 215 → 241 at 4:1, 321 at 3:1,
    // 482 at 2:1 — while the selection inspector's Height field sat on 215
    // through all four comparisons. The object was right and the field was
    // stale: `#resizeToAspect` re-rendered the chart's own panel and the canvas,
    // but announced nothing, and the inspector re-reads on `object:modified`.
    // The Height field is editable, so an author reading a number the product no
    // longer holds types a height against it.
    const host = document.createElement("div");
    document.body.append(host);
    const chart = Object.assign(Object.create(VigiliaChart.prototype), {
      id: "trends",
      family: "line",
      settings: defaultLineSettings,
      width: 963,
      height: 215,
      scaleX: 1,
      scaleY: 1,
      resizeTo(this: { width: number; height: number }, w: number, h: number) {
        this.width = w;
        this.height = h;
      },
    }) as VigiliaChart;
    const canvas = {
      on: vi.fn(),
      off: vi.fn(),
      getActiveObject: vi.fn(() => chart),
      getObjects: vi.fn(() => [chart]),
      requestRenderAll: vi.fn(),
      fire: vi.fn(),
    };
    const manager = new ChartManager({
      editor: { canvas, artboard } as unknown as EditorInteraction,
      scene: {} as SceneAdapter,
      source: createDemoSource(0),
    });
    mountFields(manager, chart, host);

    host
      .querySelector<HTMLButtonElement>('[data-vigilia-chart-aspect="2"]')!
      .click();

    // The object resized, exactly as the saved document showed: 963 wide at
    // 2:1 is 481.5, which is the 482 the inspector rounds to.
    expect(chart.width).toBe(963);
    expect(chart.height).toBe(481.5);
    // And it said so, which is what the inspector reads to re-render.
    expect(canvas.fire).toHaveBeenCalledWith(
      "object:modified",
      expect.objectContaining({ target: chart }),
    );

    manager.destroy();
  });

  it("names the ratio the chart is at, so a control group says which is active", () => {
    // The second half of the same finding: three buttons and nothing to tell
    // them apart, so after clicking there was no way to tell 2:1 from 3:1.
    // The ratio is the chart's own width over its height — read from the object
    // rather than remembered, so it is right after a drag as well as a click.
    const chart = Object.assign(Object.create(VigiliaChart.prototype), {
      id: "trends",
      family: "line",
      settings: defaultLineSettings,
      width: 800,
      height: 400,
      scaleX: 1,
      scaleY: 1,
      resizeTo(this: { width: number; height: number }, w: number, h: number) {
        this.width = w;
        this.height = h;
      },
    }) as VigiliaChart;
    const host = document.createElement("div");
    document.body.append(host);
    const listeners = new Map<string, (event?: unknown) => void>();
    const canvas = {
      on: vi.fn((event: string, listener: (event?: unknown) => void) =>
        listeners.set(event, listener),
      ),
      off: vi.fn(),
      getActiveObject: vi.fn(() => chart),
      getObjects: vi.fn(() => [chart]),
      requestRenderAll: vi.fn(),
      fire: vi.fn(),
    };
    const manager = new ChartManager({
      editor: { canvas, artboard } as unknown as EditorInteraction,
      scene: {} as SceneAdapter,
      source: createDemoSource(0),
    });
    mountFields(manager, chart, host);

    const pressed = (): (string | null)[] =>
      [...host.querySelectorAll("[data-vigilia-chart-aspect]")].map((button) =>
        button.getAttribute("aria-pressed"),
      );

    // 800 × 400 is 2:1, and that is the only button that says so.
    expect(pressed()).toEqual(["true", "false", "false"]);

    host
      .querySelector<HTMLButtonElement>('[data-vigilia-chart-aspect="3"]')!
      .click();

    // The manager announced the change, and the column is what re-reads it.
    mountFields(manager, chart, host);
    expect(pressed()).toEqual(["false", "true", "false"]);

    // A chart dragged to a ratio the control group does not offer names none
    // of them, rather than lighting up whichever is nearest.
    chart.width = 1000;
    chart.height = 300;
    chart.scaleX = 1;
    chart.scaleY = 1;
    listeners.get("object:modified")!({ target: chart });
    mountFields(manager, chart, host);

    expect(pressed()).toEqual(["false", "false", "false"]);

    manager.destroy();
  });

  it("keeps the announced ratio out of the saved document", () => {
    // §67: only authored state persists. The active ratio is read off the
    // chart's own width and height to draw the control group, and a chart
    // carries no `aspect` property — so the state that tells the author which
    // button is live cannot reach a save and become a fourth source of truth
    // beside the geometry it describes.
    const chart = new VigiliaChart({
      id: "trends",
      family: "line",
      settings: defaultLineSettings,
      width: 800,
      height: 400,
    });
    const canvas = new Canvas(document.createElement("canvas"));
    canvas.add(chart);
    canvas.setActiveObject(chart);
    const host = document.createElement("div");
    document.body.append(host);
    const manager = new ChartManager({
      editor: { canvas, artboard } as unknown as EditorInteraction,
      scene: {} as SceneAdapter,
      source: createDemoSource(0),
    });
    mountFields(manager, chart, host);

    host
      .querySelector<HTMLButtonElement>('[data-vigilia-chart-aspect="4"]')!
      .click();

    // The chart's own persisted shape: no ratio, no pressed state, just the
    // geometry the ratio produced. 4:1 of an 800-wide chart is 200 tall, and
    // that height is authored geometry — the ratio itself is not stored.
    const saved = serialiseScene(canvas).objects[0]!;
    expect(saved).not.toHaveProperty("aspect");
    expect(JSON.stringify(saved)).not.toContain("aria-pressed");
    expect(saved["height"]).toBe(200);

    manager.destroy();
  });

  it("reassigns a grouped chart's paint, so no token is deleted from under it", () => {
    // §75: deleting a referenced global forces reassignment. A card is a
    // group, so a chart one level down is the case that bites — and a live
    // `Group` keeps its children in `_objects` and exposes `getObjects()`, so
    // a walk reading `object.get("objects")` never descended into one and left
    // every chart inside a card naming the token the author had just deleted.
    //
    // **The claim under test is the saved document, not the canvas.** A
    // dangling global reference is a defect only once it is persisted; the
    // live object could be rewritten at any moment, so asserting on it would
    // pass on a walk that never touches the file.
    //
    // `GaugeSettings`, not `ChartContent["settings"]` — the union cannot be
    // narrowed back through `family` under `exactOptionalPropertyTypes`, so
    // the cast leaves the chart's options unassignable.
    const settings: GaugeSettings = {
      ...defaultGaugeSettings,
      track: { ref: "palette.ink" },
    };
    const canvas = new Canvas(document.createElement("canvas"));
    // `GroupProps` carries no `id`; a group is named the way Fabric accepts
    // one — after construction, the same as the asset panel's own group.
    const card = new Group([
      new VigiliaChart({
        id: "cpu-gauge",
        family: "gauge",
        settings,
        width: 200,
        height: 200,
      }),
    ]);
    card.set("id", "group-cpu-card");
    canvas.add(card);
    // The same chart at the root, which the walk already reached — this fails
    // if the descent is fixed by stopping at the top level instead.
    canvas.add(
      new VigiliaChart({
        id: "ram-gauge",
        family: "gauge",
        settings,
        width: 200,
        height: 200,
      }),
    );
    const manager = new ChartManager({
      editor: {
        canvas,
        artboard,
        errorManager: { warn: vi.fn(), error: vi.fn() },
      } as unknown as EditorInteraction,
      scene: {} as SceneAdapter,
      source: createDemoSource(0),
      globals: {
        palette: {
          ink: { name: "Ink", value: { kind: "solid", color: "#102030" } },
          gpu: { name: "GPU", value: { kind: "solid", color: "#00b8d9" } },
        },
      } as never,
    });

    manager.reassignPaletteReferences("palette.ink", "palette.gpu");

    const saved = serialiseScene(canvas);
    const children = saved.objects[0]!["objects"] as Record<string, unknown>[];
    expect(children[0]!["settings"]).toMatchObject({
      track: { ref: "palette.gpu" },
    });
    // And nothing anywhere in the file still names the deleted token.
    expect(JSON.stringify(saved)).not.toContain("palette.ink");

    manager.destroy();
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
        artboard,
        historyManager: { saveState: vi.fn() },
        errorManager: { warn, error: vi.fn() },
      } as unknown as EditorInteraction,
      scene: {} as SceneAdapter,
      source: createDemoSource(0),
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
      fire: vi.fn(),
    };
    const host = document.createElement("div");
    const manager = new ChartManager({
      editor: {
        canvas,
        artboard,
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
    });
    // The manager announces on change and the column rebuilds; this is the
    // column standing in for the inspector.
    const draw = (): void => {
      const chart = objects.at(-1);
      if (chart !== undefined)
        host.replaceChildren(
          ...manager.fields.content(chart),
          ...manager.fields.paint(chart),
        );
    };
    return { manager, host, draw, objects };
  }

  it("gains a series paint for every series bound", () => {
    const { manager, host, draw, objects } = harness();
    manager.addChart("line");
    const palette = (): unknown =>
      (objects[0]?.settings as unknown as Record<string, unknown>)["palette"];
    expect(Array.isArray(palette()) && (palette() as unknown[]).length).toBe(1);

    for (const semanticKey of ["cpu.load", "gpu.load", "ram.used.percent"]) {
      draw();
      const chooser = host.querySelector<HTMLSelectElement>(
        "[data-vigilia-chart-binding-add]",
      )!;
      chooser.value = semanticKey;
      chooser.dispatchEvent(new Event("change"));
    }
    draw();

    expect((palette() as unknown[]).length).toBe(3);
    // The control follows the array, so three entries means three pickers.
    expect(
      host.querySelectorAll("[data-vigilia-chart-paint^='palette']").length,
    ).toBe(3);
    manager.destroy();
  });

  it("leaves a gauge's paints alone, because a gauge has no series", () => {
    const { manager, host, draw, objects } = harness();
    manager.addChart("gauge");
    const before = objects[0]?.settings;
    draw();
    const chooser = host.querySelector<HTMLSelectElement>(
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
