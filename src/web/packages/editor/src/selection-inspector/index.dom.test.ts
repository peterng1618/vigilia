// @vitest-environment jsdom
import type {
  Binding,
  ChartContent,
  ChartFamily,
} from "@vigilia/renderer-core";
import {
  defaultGaugeSettings,
  defaultPieSettings,
  instantIn,
  MAX_OBJECT_NAME_LENGTH,
} from "@vigilia/renderer-core";
import { VigiliaChart } from "@vigilia/scene-fabric";
import { IText, Rect, Textbox } from "fabric/es";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { uiCopy } from "../ui-copy.js";
import { createSelectionInspector } from "./index.js";

/** A chart with settings but no live ECharts behind it: what the inspector
    reads is the object, not the engine that paints it. */
function chartOf(
  family: ChartFamily,
  settings: ChartContent["settings"],
): VigiliaChart {
  const chart = Object.create(VigiliaChart.prototype) as VigiliaChart;
  chart.family = family;
  chart.settings = settings;
  return chart;
}

/** A canvas stub that answers selection and history like the editor's. */
function canvasWith(active: unknown) {
  return {
    getActiveObject: () => active,
    getObjects: () => (active === undefined ? [] : [active]),
    requestRenderAll: vi.fn(),
    fire: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  };
}

function setup(
  active: unknown,
  options: {
    readonly nodeBindings?: (nodeId: string) => readonly Binding[];
    readonly onNodeBindingsChange?: (
      nodeId: string,
      bindings: readonly Binding[],
    ) => void;
  } = {},
) {
  const history = { saveState: vi.fn() };
  const host = document.createElement("div");
  const editor = {
    canvas: canvasWith(active),
    historyManager: history,
    errorManager: { warn: vi.fn(), error: vi.fn() },
  };
  const revealTypePresets = vi.fn();
  const inspector = createSelectionInspector(host, {
    editor: editor as never,
    globals: {
      palette: {
        ink: { name: "Ink", value: { kind: "solid", color: "#e8ecf3" } },
      },
      typePresets: {
        body: {
          name: "Body",
          value: { family: "Inter", size: 16, weight: "600" },
        },
      },
    } as never,
    revealTypePresets,
    refreshGlass: vi.fn(),
    ...options,
  });
  return { inspector, host, history, editor, revealTypePresets };
}

/**
 * The weekday word a language spells for an instant, read straight from `Intl`
 * rather than from the module under test, so a broken formatter cannot agree
 * with itself.
 */
function weekdayWord(instant: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(`${instant.slice(0, 10)}T00:00:00Z`));
}

describe("the selection inspector", () => {
  let rect: Rect;

  beforeEach(() => {
    rect = new Rect({ left: 0, top: 0, width: 40, height: 20 });
  });

  it("renders nothing with no selection", () => {
    const { host } = setup(undefined);

    expect(host.querySelectorAll("[data-vigilia-geometry]")).toHaveLength(0);
  });

  it("shows the selected object's geometry in whole units", () => {
    const { host } = setup(rect);
    const value = (key: string) =>
      host.querySelector<HTMLInputElement>(`[data-vigilia-geometry="${key}"]`)
        ?.value;

    expect(value("left")).toBe("0");
    expect(value("width")).toBe("40");
    expect(value("height")).toBe("20");
    expect(value("angle")).toBe("0");
  });

  it("moves the object and records exactly one history entry", () => {
    const { host, history } = setup(rect);
    const left = host.querySelector<HTMLInputElement>(
      '[data-vigilia-geometry="left"]',
    )!;

    left.value = "120";
    left.dispatchEvent(new Event("change"));

    expect(rect.left).toBe(120);
    expect(history.saveState).toHaveBeenCalledTimes(1);
  });

  it("pairs X/Y and W/H on one row each, with rotation alone", () => {
    const { host } = setup(rect);
    const input = (key: string) =>
      host.querySelector<HTMLInputElement>(`[data-vigilia-geometry="${key}"]`)!;
    const rowOf = (key: string) => input(key).closest(".vigilia-field-row");

    // Non-vacuous: a pairing assertion on two absent rows would compare null
    // to null and pass for the stacked layout this replaced.
    expect(rowOf("left")).not.toBeNull();
    expect(rowOf("width")).not.toBeNull();
    // A pair shares its row element; the two pairs are distinct rows.
    expect(rowOf("left")).toBe(rowOf("top"));
    expect(rowOf("width")).toBe(rowOf("height"));
    expect(rowOf("left")).not.toBe(rowOf("width"));
    // Rotation stands alone, in the single-field row the shell already has.
    expect(input("angle").closest(".vigilia-field")).not.toBeNull();
    expect(rowOf("angle")).toBeNull();
  });

  it("commits a paired edit as one history entry", () => {
    const { host, history } = setup(rect);
    const width = host.querySelector<HTMLInputElement>(
      '[data-vigilia-geometry="width"]',
    )!;

    width.value = "80";
    width.dispatchEvent(new Event("change"));

    // The sibling's unchanged value is written back too, but that is a no-op
    // for geometry: one committed edit, one entry.
    expect(rect.width * rect.scaleX).toBe(80);
    expect(history.saveState).toHaveBeenCalledTimes(1);
  });

  it("commits only the edited half, leaving a fractional sibling alone", () => {
    // A drag leaves fractional scale, and the field shows the rounded read of
    // it. Committing that unchanged display value must not quantise the
    // dimension the author never touched.
    rect.set({ width: 520, height: 36.32, scaleX: 1.0009, scaleY: 1.00444 });
    const { host, history } = setup(rect);
    const width = host.querySelector<HTMLInputElement>(
      '[data-vigilia-geometry="width"]',
    )!;
    expect(width.value).toBe("520");

    width.value = "520";
    width.dispatchEvent(new Event("change"));

    expect(rect.scaleX).toBeCloseTo(1, 5);
    expect(rect.scaleY).toBeCloseTo(1.00444, 5);
    expect(rect.height * rect.scaleY).toBeCloseTo(36.48, 2);
    expect(history.saveState).toHaveBeenCalledTimes(1);
  });

  it("refuses a value that would make the object invalid", () => {
    const { host, history, editor } = setup(rect);
    const width = host.querySelector<HTMLInputElement>(
      '[data-vigilia-geometry="width"]',
    )!;

    width.value = "-5";
    width.dispatchEvent(new Event("change"));

    // Restored to the object's own value; nothing recorded.
    expect(width.value).toBe("40");
    expect(rect.scaleX).toBe(1);
    expect(history.saveState).not.toHaveBeenCalled();
    expect(editor.errorManager.warn).toHaveBeenCalled();
  });

  it("shows opacity as a percentage and stores Fabric's 0-1", () => {
    rect.set({ opacity: 0.5 });
    const { host, history } = setup(rect);
    const opacity = host.querySelector<HTMLInputElement>(
      "[data-vigilia-opacity]",
    )!;

    expect(opacity.value).toBe("50");

    opacity.value = "25";
    opacity.dispatchEvent(new Event("change"));

    expect(rect.opacity).toBe(0.25);
    expect(history.saveState).toHaveBeenCalledTimes(1);
  });

  it("refuses opacity outside the range rather than clamping it", () => {
    rect.set({ opacity: 0.5 });
    const { host, history, editor } = setup(rect);
    const opacity = host.querySelector<HTMLInputElement>(
      "[data-vigilia-opacity]",
    )!;

    opacity.value = "150";
    opacity.dispatchEvent(new Event("change"));

    expect(rect.opacity).toBe(0.5);
    expect(opacity.value).toBe("50");
    expect(history.saveState).not.toHaveBeenCalled();
    expect(editor.errorManager.warn).toHaveBeenCalled();
  });

  it("shows the object's display name and writes an edit back to it", () => {
    rect.set("name", "Header panel");
    const { host, history } = setup(rect);
    const name = host.querySelector<HTMLInputElement>("[data-vigilia-name]")!;

    expect(name.value).toBe("Header panel");

    name.value = "Header rule";
    name.dispatchEvent(new Event("change"));

    expect(rect.get("name")).toBe("Header rule");
    // One committed edit, one history entry (§67).
    expect(history.saveState).toHaveBeenCalledTimes(1);
  });

  it("leaves the name field empty for an object that has none", () => {
    // Absence is what a scene authored before the field looks like; showing the
    // id in the field would make an unnamed object look named.
    const { host } = setup(rect);
    const name = host.querySelector<HTMLInputElement>("[data-vigilia-name]")!;

    expect(name.value).toBe("");
  });

  it("clears the name when the author empties the field", () => {
    rect.set("name", "Header panel");
    const { host, history } = setup(rect);
    const name = host.querySelector<HTMLInputElement>("[data-vigilia-name]")!;

    name.value = "   ";
    name.dispatchEvent(new Event("change"));

    // The key goes rather than holding a blank label, so the layer list falls
    // back to the id exactly as it does for a scene that never had a name.
    expect(rect.get("name")).toBeUndefined();
    expect(history.saveState).toHaveBeenCalledTimes(1);
  });

  it("refuses a name past the published bound rather than storing it", () => {
    rect.set("name", "Header panel");
    const { host, history, editor } = setup(rect);
    const name = host.querySelector<HTMLInputElement>("[data-vigilia-name]")!;

    name.value = "x".repeat(MAX_OBJECT_NAME_LENGTH + 1);
    name.dispatchEvent(new Event("change"));

    // The envelope would refuse this on import, so a save would throw; the field
    // rejects the edit and restores what the object actually carries.
    expect(rect.get("name")).toBe("Header panel");
    expect(name.value).toBe("Header panel");
    expect(history.saveState).not.toHaveBeenCalled();
    expect(editor.errorManager.warn).toHaveBeenCalled();
  });

  it("gives the name field an accessible label", () => {
    const { host } = setup(rect);
    const name = host.querySelector<HTMLInputElement>("[data-vigilia-name]")!;
    const label = host.querySelector<HTMLLabelElement>(
      `label[for="${name.id}"]`,
    );

    expect(label?.textContent).toBe("Name");
    // A field the author can only reach by pointer is not a control.
    expect(name.tagName).toBe("INPUT");
  });

  it("withholds the name field on a locked object, like every other write", () => {
    rect.set("locked", true);
    const { host } = setup(rect);

    expect(host.querySelector("[data-vigilia-name]")).toBeNull();
  });

  it("announces the edit so the layer list republishes the row", () => {
    // The layer row prints this name, and the panel caches its projection, so
    // a rename that only wrote the object would leave the two surfaces
    // disagreeing until something else happened to republish.
    rect.set("name", "Header panel");
    const { host, editor } = setup(rect);
    const name = host.querySelector<HTMLInputElement>("[data-vigilia-name]")!;

    name.value = "Header rule";
    name.dispatchEvent(new Event("change"));

    expect(editor.canvas.fire).toHaveBeenCalledWith(
      "object:modified",
      expect.objectContaining({ target: rect }),
    );
  });

  it("announces nothing when a name is refused", () => {
    rect.set("name", "Header panel");
    const { host, editor } = setup(rect);
    const name = host.querySelector<HTMLInputElement>("[data-vigilia-name]")!;

    name.value = "x".repeat(MAX_OBJECT_NAME_LENGTH + 1);
    name.dispatchEvent(new Event("change"));

    expect(editor.canvas.fire).not.toHaveBeenCalled();
  });

  it("names what a paint reference resolves to", () => {
    rect.set({ vigiliaPaint: { fill: "palette.ink" } });
    const { host } = setup(rect);
    const line = host.querySelector("[data-vigilia-resolution]");

    // The author chose a token; they must see what it means.
    expect(line?.textContent).toContain("palette.ink");
    expect(line?.textContent).toContain("#e8ecf3");
  });

  it("reports a reference that no longer resolves rather than blanking it", () => {
    rect.set({ vigiliaPaint: { fill: "palette.gone" } });
    const { host } = setup(rect);

    expect(
      host.querySelector("[data-vigilia-resolution]")?.textContent,
    ).toContain("no longer resolves");
  });

  it("names the paint a chart keeps in its own settings", () => {
    const chart = chartOf("gauge", {
      ...defaultGaugeSettings,
      track: { ref: "palette.track" },
      progress: { ref: "palette.ink" },
    });
    const { host } = setup(chart);

    // `vigiliaPaint` is where a box or a text run keeps its colour; a chart
    // keeps it in the settings its family owns, so reading only the former
    // reported every chart in every theme as unpainted.
    const progress = host.querySelector(
      '[data-vigilia-resolution="Progress paint"]',
    );
    expect(progress?.textContent).toContain("palette.ink");
    expect(progress?.textContent).toContain("#e8ecf3");
    expect(host.textContent).not.toContain(uiCopy.inspectorFields.notSet);
  });

  it("names each of a chart's own paints, and reports one that no longer resolves", () => {
    const chart = chartOf("pie", {
      ...defaultPieSettings,
      palette: [{ ref: "palette.ink" }, { ref: "palette.gone" }],
    });
    const { host } = setup(chart);

    // One line per entry, under the field descriptor that owns its name, so a
    // pie's slices are told apart from its remainder.
    expect(
      host.querySelector('[data-vigilia-resolution="Slice paint 1"]')
        ?.textContent,
    ).toContain("palette.ink");
    expect(
      host.querySelector('[data-vigilia-resolution="Slice paint 2"]')
        ?.textContent,
    ).toContain("no longer resolves");
  });

  it("names the type preset a text object is set in, and what it resolves to", () => {
    const text = new IText("Hi", { left: 0, top: 0 });
    text.set({
      vigiliaText: {
        runs: [{ kind: "literal", text: "Hi", typePreset: "typePresets.body" }],
      },
    });
    const { host } = setup(text);

    // The object's type is its first authored run's preset — the same run
    // `applyObjectTypePresets` reads — shown with what it means.
    const line = host.querySelector('[data-vigilia-resolution="Type preset"]');
    expect(line?.textContent).toContain("typePresets.body");
    expect(line?.textContent).toContain("Inter");
  });

  it("reports a text object whose type preset no longer resolves", () => {
    const text = new IText("Hi", { left: 0, top: 0 });
    text.set({
      vigiliaText: {
        runs: [{ kind: "literal", text: "Hi", typePreset: "typePresets.gone" }],
      },
    });
    const { host } = setup(text);

    expect(
      host.querySelector('[data-vigilia-resolution="Type preset"]')
        ?.textContent,
    ).toContain("no longer resolves");
  });

  it("offers a shape no type preset, because a shape has no type", () => {
    const { host } = setup(rect);

    expect(
      host.querySelector('[data-vigilia-resolution="Type preset"]'),
    ).toBeNull();
  });

  it("reveals the type-preset panel rather than duplicating its fields", () => {
    const text = new IText("Hi", { left: 0, top: 0 });
    text.set({
      vigiliaText: {
        runs: [{ kind: "literal", text: "Hi", typePreset: "typePresets.body" }],
      },
    });
    const { host, revealTypePresets } = setup(text);

    // Activating the control is what makes the panel reachable; the fields
    // themselves stay owned by the panel.
    host
      .querySelector<HTMLButtonElement>("[data-vigilia-reveal-type-presets]")
      ?.click();

    expect(revealTypePresets).toHaveBeenCalled();
  });

  it("offers a shape none of a text object's fields", () => {
    const { host } = setup(rect);

    // A shape has no text layout to edit, so it must not be offered one.
    for (const field of [
      "[data-vigilia-text-align]",
      "[data-vigilia-text-wrap]",
      "[data-vigilia-text-overflow]",
      '[data-vigilia-resolution="Type preset"]',
    ]) {
      expect(host.querySelector(field)).toBeNull();
    }
  });

  it("keeps describing the same object after history drops the selection", () => {
    const { inspector, host } = setup(rect);
    rect.set({ id: "keep-me" });

    // History restores the scene and Fabric loses its selection, but the
    // author must not lose the panel they were working in.
    inspector.render();

    expect(
      host.querySelector('[data-vigilia-geometry="width"]'),
    ).not.toBeNull();
  });

  it("refuses a stale opacity event rather than mutating the old selection", () => {
    rect.set({ opacity: 0.5 });
    const { host, history, editor } = setup(rect);
    const opacity = host.querySelector<HTMLInputElement>(
      "[data-vigilia-opacity]",
    )!;
    const other = new Rect({ left: 0, top: 0, width: 10, height: 10 });
    (editor.canvas as { getActiveObject: () => unknown }).getActiveObject =
      () => other;

    opacity.value = "10";
    opacity.dispatchEvent(new Event("change"));

    // The panel describes `other` now; the field the author was holding was
    // bound to `rect`, and an event from it must not reach back.
    expect(rect.opacity).toBe(0.5);
    expect(history.saveState).not.toHaveBeenCalled();
  });

  it("withholds only the fields that write the object, not the ones the editor still serves", () => {
    rect.set({ locked: true, selectable: false, evented: false });
    const { host } = setup(rect);

    // Deleted, duplicate, cut, nudge and arrange all refuse a locked object, so
    // the fields that write it directly are withheld rather than advertised.
    for (const selector of [
      "[data-vigilia-opacity]",
      '[data-vigilia-geometry="left"]',
      "[data-vigilia-panel-fill]",
    ]) {
      expect(host.querySelector(selector), selector).toBeNull();
    }
    expect(host.textContent).toContain("locked");
    // Read-only: the author still needs to see what the object resolves to.
    expect(host.querySelector("[data-vigilia-resolution]")).not.toBeNull();
  });

  it("keeps the run editor on a locked object, because nothing refuses it", () => {
    const text = new IText("Hi", { left: 0, top: 0, id: "locked-label" });
    text.set({
      locked: true,
      selectable: false,
      evented: false,
      vigiliaText: {
        runs: [{ kind: "value", bindingId: "clock-date" }],
      },
    });
    const { host } = setup(text);

    // `#setBindings` writes bindings without reading a lock, and the ordering
    // and grouping actions stay on a bare selection, so hiding the run editor
    // would refuse work the editor actually performs.
    expect(host.querySelector("[data-vigilia-runs]")).not.toBeNull();
    expect(host.querySelector("[data-vigilia-run-source]")).not.toBeNull();
    expect(host.textContent).toContain("locked");
  });

  it("previews a run's format in the language setLocale hands it", () => {
    // The instant is pinned so the expected word is fixed rather than a guess at
    // which weekday the suite happens to run on.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-26T15:30:00Z"));

    try {
      const bindings: readonly Binding[] = [
        { id: "clock-date", semanticKey: "date.today", format: "dddd" },
      ];
      const text = new Textbox("", { id: "clock-label" });
      text.set({
        vigiliaText: { runs: [{ kind: "value", bindingId: "clock-date" }] },
      });
      const { inspector, host } = setup(text, {
        nodeBindings: () => bindings,
      });
      const preview = (): string | null | undefined =>
        host.querySelector<HTMLElement>("[data-vigilia-run-format-preview]")
          ?.textContent;

      const instant = instantIn(Date.now());

      // The preview is a reading the paint must agree with, and the inspector is
      // the only thing that spells one for the author. Before any language is
      // pushed, it reads the default.
      expect(preview()).toBe(weekdayWord(instant, "en"));

      inspector.setLocale("ja");

      // `setLocale` re-renders, so the preview the author sees after choosing a
      // language is the one that language produces — not the one from before.
      expect(preview()).toBe(weekdayWord(instant, "ja"));
      expect(preview()).not.toBe(weekdayWord(instant, "en"));
    } finally {
      vi.useRealTimers();
    }
  });
});
