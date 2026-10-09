// @vitest-environment jsdom
import type { Binding, ChartContent, FabricPalette } from "@vigilia/renderer-core";
import {
  computeComposition,
  defaultLineSettings,
  defaultPieSettings,
  settingsFieldsFor,
} from "@vigilia/renderer-core";
import { afterEach, describe, expect, it } from "vitest";
import { isSettingVisible } from "../editor-shell/controls/settings-field.js";
import { uiCopy } from "../ui-copy.js";
import type { ChartEdits } from "./chart-fields.js";
import {
  type ChartFieldsStage,
  choose,
  clickHook,
  edit,
  flush,
  mountChartFields,
  optionsOf,
  pick,
  pressedLabel,
  segment,
  valueText,
} from "./chart-stage.test-stage.js";
import {
  type ChartFieldTarget,
  chartContentView,
  chartPaintView,
} from "./panel.js";

/**
 * The chart fields as displayed behaviour: which control each descriptor
 * reaches, and what pressing it writes.
 *
 * `panel.dom.test.ts` proves the reading a chart's questions are projected
 * into; this proves the other half — that every one of those rows reaches a
 * named, operable control, and that the control calls the owner exactly once
 * with the value the author chose. A completeness list over the projection
 * alone would pass on a renderer that drew nothing, which is what this file
 * exists to catch.
 */

const palette: FabricPalette = {
  cpu: { name: "CPU", value: { kind: "solid", color: "#00b8d9" } },
  gpu: { name: "GPU", value: { kind: "solid", color: "#a78bfa" } },
  ram: { name: "RAM", value: { kind: "solid", color: "#2dd4bf" } },
};

const gauge: ChartFieldTarget = {
  id: "cpu-gauge",
  content: {
    family: "gauge",
    settings: {
      startAngle: 90,
      endAngle: -270,
      min: 0,
      max: 100,
      thickness: 10,
      track: { ref: "palette.cpu" },
      progress: { ref: "palette.gpu" },
      roundCap: true,
    },
  },
  bindings: [{ id: "cpu", semanticKey: "cpu.load" }],
};

const line: ChartFieldTarget = {
  id: "trend",
  content: { family: "line", settings: { ...defaultLineSettings } },
  bindings: [
    { id: "cpu", semanticKey: "cpu.load" },
    { id: "gpu", semanticKey: "gpu.load" },
  ],
};

const bar: ChartFieldTarget = {
  id: "storage",
  content: {
    family: "bar",
    settings: {
      orientation: "horizontal",
      min: 0,
      max: 100,
      barWidth: 20,
      categoryGapPercent: 40,
      cornerRadius: 10,
      trackCornerRadius: 10,
      fill: { ref: "palette.cpu" },
      track: { ref: "palette.gpu" },
      showAxes: false,
      showCategoryLabels: false,
    },
  },
  bindings: [{ id: "disk", semanticKey: "disk.used" }],
};

const pie: ChartFieldTarget = {
  id: "ram",
  content: { family: "pie", settings: { ...defaultPieSettings } },
  bindings: [{ id: "slice", semanticKey: "ram.used.percent" }],
};

const FAMILIES = [gauge, line, bar, pie] as const;

interface Calls {
  readonly settings: ChartContent["settings"][];
  readonly bindings: Binding[];
  readonly aspects: number[];
  readonly added: [string, string][];
  readonly removed: [string, string][];
}

/**
 * A stage over one target, with a port that records what each control asked
 * for. The target is replaced rather than mutated, so a case can answer an edit
 * the way the owner would and re-render the controls over it.
 */
function stageFor(target: ChartFieldTarget, tokens: FabricPalette | undefined) {
  let current = target;
  const calls: Calls = {
    settings: [],
    bindings: [],
    aspects: [],
    added: [],
    removed: [],
  };
  const edits: ChartEdits = {
    onSettings: (_id, settings) => calls.settings.push(settings),
    onBinding: (_id, binding) => calls.bindings.push(binding),
    onAspect: (_id, ratio) => calls.aspects.push(ratio),
    onAddBinding: (id, key) => calls.added.push([id, key]),
    onRemoveBinding: (id, bindingId) => calls.removed.push([id, bindingId]),
  };
  const stage = mountChartFields({
    content: () => chartContentView(current),
    paint: () => chartPaintView(current, tokens),
    edits,
  });
  return {
    stage,
    calls,
    /** The target the owner now holds, after applying what a control wrote. */
    set(next: ChartFieldTarget): void {
      current = next;
      stage.render();
    },
  };
}

const stages: ChartFieldsStage[] = [];

function over(target: ChartFieldTarget, tokens: FabricPalette | undefined = palette) {
  const box = stageFor(target, tokens);
  stages.push(box.stage);
  return box;
}

afterEach(async () => {
  while (stages.length > 0) await stages.pop()?.dispose();
});

/** The last settings a control committed. */
function lastSettings(calls: Calls): ChartContent["settings"] {
  const last = calls.settings.at(-1);
  if (last === undefined) throw new Error("nothing was committed");
  return last;
}

/**
 * The control a label names, resolved the way an assistive technology resolves
 * it: `<label for>` → id, then `aria-labelledby`. The `for` branch is the one
 * the association depends on, so a removed pairing throws rather than falling
 * through to something that merely looks labelled.
 */
function labelled(name: string): HTMLElement {
  for (const label of document.querySelectorAll("label")) {
    if (label.textContent?.trim() !== name) continue;
    const target =
      label.htmlFor === "" ? null : document.getElementById(label.htmlFor);
    if (target !== null) return target;
  }
  for (const element of document.querySelectorAll<HTMLElement>(
    "[aria-labelledby]",
  )) {
    const text = (element.getAttribute("aria-labelledby") ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join(" ")
      .trim();
    if (text === name) return element;
  }
  throw new Error(`no control is labelled "${name}"`);
}

describe("every chart family's controls", () => {
  it("reaches a named, operable control for every descriptor it shows", () => {
    for (const target of FAMILIES) {
      const { stage } = over(target);
      const visible = settingsFieldsFor(target.content.family).filter((field) =>
        isSettingVisible(field, target.content.settings),
      );

      for (const field of visible) {
        // The hook is how a spec, a driver and a screenshot address this
        // control; the label is how a person does.
        const control = pick(
          stage.host,
          `data-vigilia-chart-setting="${field.property}"`,
        );
        expect(control.id, `${target.id}: ${field.property} has no id`).not.toBe(
          "",
        );
        expect(
          labelled(field.label),
          `${target.id}: "${field.property}" is not named "${field.label}"`,
        ).toBe(control);
      }
    }
  });

  it("gives the series chooser and the aspect group a control of their own", () => {
    const { stage } = over(line);
    expect(
      pick(stage.host, "data-vigilia-chart-binding-add").tagName,
      "the series chooser",
    ).toBe("BUTTON");
    expect(
      [
        ...stage.host.querySelectorAll<HTMLElement>(
          "button[data-vigilia-chart-aspect]",
        ),
      ].map((button) => button.textContent?.trim()),
    ).toEqual(["2:1", "3:1", "4:1"]);
    expect(
      pressedLabel(stage.host, "data-vigilia-chart-aspect"),
    ).toBeUndefined();
  });

  it("carries each binding's own hook on its own control", () => {
    const { stage } = over(gauge);
    expect(
      pick<HTMLButtonElement>(stage.host, 'data-vigilia-binding="cpu"').id,
    ).toBe("vigilia-chart-binding-cpu");
    expect(valueText(stage.host, 'data-vigilia-binding="cpu"')).toBe("CPU load");
    for (const field of ["precision", "scale", "offset"]) {
      expect(
        pick<HTMLInputElement>(
          stage.host,
          `data-vigilia-binding-field="cpu.${field}"`,
        ).id,
      ).toBe(`vigilia-chart-binding-cpu-${field}`);
    }
    expect(
      pick<HTMLButtonElement>(
        stage.host,
        'data-vigilia-binding-field="cpu.unitDisplay"',
      ).id,
    ).toBe("vigilia-chart-binding-cpu-unit-display");
  });
});

describe("a setting one level down", () => {
  it("commits the animation field into the block, not under a dotted key", async () => {
    const { stage, calls } = over(line);
    const duration = pick<HTMLInputElement>(
      stage.host,
      'data-vigilia-chart-setting="animation.durationMs"',
    );

    await edit(duration, "2400");

    const authored = lastSettings(calls);
    // A flat `{...settings, "animation.durationMs": 2400}` writes a key the
    // validator accepts and the renderer never reads.
    expect("animation.durationMs" in authored).toBe(false);
    // The author's one field, plus the other three the block is materialised
    // with from its own owner.
    expect(authored.animation).toEqual({
      durationMs: 2400,
      easing: "linear",
      appearMs: 650,
      appearEasing: "cubicOut",
    });
  });

  it("commits the fixed total where the renderer reads it", async () => {
    // The live regression this replaces: the panel committed
    // `{...settings, [property]: value}`, so choosing a fixed total wrote
    // `total: "fixed"` — a string where the union belongs — and the number
    // behind it wrote a literal `"total.value"` key the renderer never reads.
    const { stage, calls, set } = over(pie);

    await choose(stage.host, 'data-vigilia-chart-setting="total"', "A fixed total");
    const fixed = lastSettings(calls) as typeof defaultPieSettings;
    expect(fixed.total).toEqual({ kind: "fixed" });
    expect("total.value" in fixed).toBe(false);

    set({ ...pie, content: { family: "pie", settings: fixed } });
    await edit(
      pick<HTMLInputElement>(
        stage.host,
        'data-vigilia-chart-setting="total.value"',
      ),
      "64",
    );

    const authored = lastSettings(calls) as typeof defaultPieSettings;
    expect("total.value" in authored).toBe(false);
    expect(authored.total).toEqual({ kind: "fixed", value: 64 });

    // Measured through the renderer that draws it rather than restated from the
    // settings object: the remainder exists only because the path the control
    // committed to is the path `computeComposition` reads.
    const composition = computeComposition(authored, [
      { sensorId: "ram.used", sample: sample("ram.used", 20) },
      { sensorId: "ram.cached", sample: sample("ram.cached", 12) },
    ]);
    expect(composition.remainder).toBe(64 - 32);
  });

  it("clears an optional setting back to the renderer's own choice", async () => {
    const { stage, calls } = over({
      ...pie,
      content: {
        family: "pie",
        settings: { ...defaultPieSettings, endAngle: 200 },
      },
    });

    const end = pick<HTMLInputElement>(
      stage.host,
      'data-vigilia-chart-setting="endAngle"',
    );
    expect(end.value).toBe("200");
    await edit(end, "");

    // Removed, not written as zero: "empty lets the data choose it" is what the
    // descriptor's `optional` promises.
    expect("endAngle" in lastSettings(calls)).toBe(false);
  });

  it("refuses an invalid draft rather than writing one", async () => {
    const { stage, calls } = over(gauge);
    const thickness = pick<HTMLInputElement>(
      stage.host,
      'data-vigilia-chart-setting="thickness"',
    );

    await edit(thickness, "-4");

    // The descriptor's own bound, refused rather than clamped: nothing reaches
    // the owner, and the box says why.
    expect(calls.settings).toHaveLength(0);
    expect(thickness.getAttribute("aria-invalid")).toBe("true");
  });

  it("applies a toggle the moment it is pressed", async () => {
    const { stage, calls } = over(gauge);
    await clickHook(stage.host, 'data-vigilia-chart-setting="roundCap"');
    expect(lastSettings(calls)).toMatchObject({ roundCap: false });
  });

  it("offers a select's options in the descriptor's own order", async () => {
    const { stage } = over(line);
    expect(
      await optionsOf(stage.host, 'data-vigilia-chart-setting="interpolation"'),
    ).toEqual(["Linear", "Smooth", "Step"]);
  });
});

describe("a chart's series", () => {
  it("declares the first series, which is what a chart arrives without", async () => {
    const { stage, calls } = over({ ...line, bindings: [] });

    await choose(stage.host, "data-vigilia-chart-binding-add", "CPU load");

    expect(calls.added).toEqual([["trend", "cpu.load"]]);
    // The choice is consumed rather than held, so a re-render cannot declare
    // the same series a second time.
    expect(valueText(stage.host, "data-vigilia-chart-binding-add")).toBe(
      uiCopy.inspectorFields.runSeries,
    );
  });

  it("says a gauge takes one reading rather than accepting a second", async () => {
    // `buildChartPlan` reads a gauge's first binding and ignores the rest, so a
    // second one would be a control that accepts an edit and applies none.
    const { stage, calls } = over(gauge);
    const chooser = pick<HTMLButtonElement>(
      stage.host,
      "data-vigilia-chart-binding-add",
    );

    expect(chooser.disabled).toBe(true);
    expect(
      pick(stage.host, "data-vigilia-chart-binding-full").textContent,
    ).toContain("gauge");

    await clickHook(stage.host, "data-vigilia-chart-binding-add");
    await flush();
    // A disabled value cannot invoke a command, whatever a test does to it.
    expect(calls.added).toHaveLength(0);
  });

  it("removes a series by name, and never offers the last one", async () => {
    const two = over(line);
    const buttons = [
      ...two.stage.host.querySelectorAll<HTMLButtonElement>(
        "[data-vigilia-chart-binding-remove]",
      ),
    ];
    expect(buttons.map((button) => button.textContent?.trim())).toEqual([
      "Remove the series reading cpu.load",
      "Remove the series reading gpu.load",
    ]);
    await clickHook(two.stage.host, 'data-vigilia-chart-binding-remove="gpu"');
    expect(two.calls.removed).toEqual([["trend", "gpu"]]);

    // A chart with nothing bound draws no data, so the last series stays.
    const one = over(gauge);
    expect(
      one.stage.host.querySelector("[data-vigilia-chart-binding-remove]"),
    ).toBeNull();
  });

  it("writes a series' own reading, and keeps the fields it does not name", async () => {
    const { stage, calls } = over({
      ...gauge,
      bindings: [{ id: "cpu", semanticKey: "cpu.load", precision: 1 }],
    });

    await choose(stage.host, 'data-vigilia-binding="cpu"', "RAM used");

    expect(calls.bindings.at(-1)).toEqual({
      id: "cpu",
      semanticKey: "ram.used",
      precision: 1,
    });
  });

  it("removes an optional binding field rather than writing an empty one", async () => {
    const { stage, calls, set } = over({
      ...gauge,
      bindings: [{ id: "cpu", semanticKey: "cpu.load", unitDisplay: "long" }],
    });

    // Absent means the display decides, and the choice that names it is the only
    // way back to that state.
    await choose(
      stage.host,
      'data-vigilia-binding-field="cpu.unitDisplay"',
      uiCopy.unitDisplayOptions[""],
    );
    expect("unitDisplay" in (calls.bindings.at(-1) ?? {})).toBe(false);
    expect(calls.bindings.at(-1)?.id).toBe("cpu");

    set({
      ...gauge,
      bindings: [{ id: "cpu", semanticKey: "cpu.load", unitDisplay: "short" }],
    });
    expect(
      valueText(stage.host, 'data-vigilia-binding-field="cpu.unitDisplay"'),
    ).toBe("Short");
  });

  it("refuses a fraction in a whole-number field", async () => {
    const { stage, calls } = over({
      ...gauge,
      bindings: [{ id: "cpu", semanticKey: "cpu.load", precision: 1 }],
    });
    const precision = pick<HTMLInputElement>(
      stage.host,
      'data-vigilia-binding-field="cpu.precision"',
    );

    await edit(precision, "2.5");

    expect(calls.bindings).toHaveLength(0);
    expect(precision.getAttribute("aria-invalid")).toBe("true");

    await edit(precision, "3");
    expect(calls.bindings.at(-1)).toMatchObject({ precision: 3 });
  });
});

describe("what a chart paints its data with", () => {
  it("names each token by the name its author gave it", async () => {
    const { stage } = over(gauge);
    expect(
      await optionsOf(stage.host, 'data-vigilia-chart-paint="track"'),
    ).toEqual(["CPU", "GPU", "RAM"]);
  });

  it("writes the token the author chose", async () => {
    const { stage, calls } = over(gauge);
    await choose(stage.host, 'data-vigilia-chart-paint="track"', "RAM");
    expect(lastSettings(calls)).toMatchObject({ track: { ref: "palette.ram" } });
  });

  it("writes one entry of a repeated paint, leaving its neighbours alone", async () => {
    const { stage, calls } = over({
      ...line,
      content: {
        family: "line",
        settings: {
          ...defaultLineSettings,
          palette: [{ ref: "palette.cpu" }, { ref: "palette.gpu" }],
        },
      },
    });

    await choose(stage.host, 'data-vigilia-chart-paint="palette.0"', "RAM");

    expect(lastSettings(calls)).toMatchObject({
      palette: [{ ref: "palette.ram" }, { ref: "palette.gpu" }],
    });
  });

  it("cannot change a paint when the theme offers no token", async () => {
    // A palette that offers nothing has no valid choice to change a reference
    // to, so the control shows where the paint is instead of accepting an edit
    // that would write a token choice nobody made.
    const box = stageFor(gauge, undefined);
    stages.push(box.stage);
    const track = pick<HTMLButtonElement>(
      box.stage.host,
      'data-vigilia-chart-paint="track"',
    );

    expect(track.disabled).toBe(true);
    await clickHook(box.stage.host, 'data-vigilia-chart-paint="track"');
    await flush();
    expect(box.calls.settings).toHaveLength(0);
  });
});

describe("the line chart's aspect group", () => {
  it("resizes the chart to the ratio that was pressed, and shows it as pressed", async () => {
    const { stage, calls } = over({ ...line, aspect: 2 });
    expect(pressedLabel(stage.host, "data-vigilia-chart-aspect")).toBe("2:1");

    await segment(stage.host, "data-vigilia-chart-aspect", "3:1");

    expect(calls.aspects).toEqual([3]);
  });

  it("presses nothing when the chart is at none of the offered ratios", () => {
    const { stage } = over(line);
    expect(
      pressedLabel(stage.host, "data-vigilia-chart-aspect"),
    ).toBeUndefined();
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
