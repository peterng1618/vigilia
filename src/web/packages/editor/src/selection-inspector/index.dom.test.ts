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
import { idleCrop } from "./idle-crop.test-stage.js";
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
    cropManager: idleCrop(),
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
    const { host, history } = setup(rect);
    const width = host.querySelector<HTMLInputElement>(
      '[data-vigilia-geometry="width"]',
    )!;

    width.value = "-5";
    width.dispatchEvent(new Event("change"));

    // Was restored to 40 with nothing recorded. The floor is 1, so -5 now
    // lands on 1: reverting is what made the bound undiscoverable.
    expect(width.value).toBe("1");
    expect(rect.scaleX).toBeGreaterThan(0);
    expect(history.saveState).toHaveBeenCalledTimes(1);
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

    // The author chose a token by its name; they must see what it means under
    // that name. `palette.ink` is what the document stores, not what it says.
    expect(line?.textContent).toContain("Ink");
    expect(line?.textContent).not.toContain("palette.ink");
    expect(line?.textContent).toContain("#e8ecf3");
  });

  it("reports a reference that no longer resolves rather than blanking it", () => {
    rect.set({ vigiliaPaint: { fill: "palette.gone" } });
    const { host } = setup(rect);

    expect(
      host.querySelector("[data-vigilia-resolution]")?.textContent,
    ).toContain("no longer resolves");
  });

  it("prints the raw reference for a token that no longer exists, since no name is left", () => {
    rect.set({ vigiliaPaint: { fill: "palette.gone" } });
    const { host } = setup(rect);

    // A deleted token has no authored name, so the reference is the only thing
    // that still identifies it — and the author needs it to find the dangling
    // use. This is the one surface where the ref is the subject.
    expect(
      host.querySelector("[data-vigilia-resolution]")?.textContent,
    ).toContain("palette.gone");
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
    expect(progress?.textContent).toContain("Ink");
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
    ).toContain("Ink");
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
    //
    // This line printed `typePresets.body` while the panel beside it printed
    // `Body` and both dropdowns printed `Body`, which is what made vg-089 look
    // like a mis-bound dropdown: the screenshot had caught this line, not the
    // control it was blamed on.
    const line = host.querySelector('[data-vigilia-resolution="Type preset"]');
    expect(line?.textContent).toContain("Body");
    expect(line?.textContent).not.toContain("typePresets.body");
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

describe("the size of a text object", () => {
  /**
   * Measured on the surface while placing the first card of the rebuild: a
   * 24-400 caption asked for a 220 × 40 box came back at `scaleX 3.448` and
   * `scaleY 0.439` — the type stretched to three and a half times its width
   * and squashed to under half its height. The field says Size; on a `Textbox`
   * the width *is* the box the text wraps inside, so there was nothing to
   * scale.
   */
  function caption(): Textbox {
    const text = new Textbox("AMD Ryzen 7 7800X3D", {
      left: 0,
      top: 0,
      originX: "left",
      originY: "top",
      fontSize: 32,
    });
    text.set({
      vigiliaText: {
        runs: [
          {
            kind: "literal",
            text: "AMD Ryzen 7 7800X3D",
            typePreset: "typePresets.body",
          },
        ],
      },
    });
    return text;
  }

  it("writes the authored box, and leaves the type at its preset's size", () => {
    const text = caption();
    const { host, history } = setup(text);

    const width = host.querySelector<HTMLInputElement>(
      '[data-vigilia-geometry="width"]',
    )!;
    width.value = "220";
    width.dispatchEvent(new Event("change"));
    const height = host.querySelector<HTMLInputElement>(
      '[data-vigilia-geometry="height"]',
    )!;
    height.value = "40";
    height.dispatchEvent(new Event("change"));

    const authored = text.get("vigiliaText") as {
      box: { width: number; height: number };
    };
    expect(authored.box).toEqual({ width: 220, height: 40 });
    expect(text.scaleX).toBe(1);
    expect(text.scaleY).toBe(1);
    expect(text.fontSize).toBe(32);
    // One committed edit each, matching every other field here.
    expect(history.saveState).toHaveBeenCalledTimes(2);
  });

  it("gives a whole box when only one Size field is filled in", () => {
    // An inserted caption has no box yet: its width is Fabric's measurement
    // until an author types one. Writing the height alone used to produce
    // `{ height }` with no width, and the next text change multiplied an
    // undefined width by the scale — the object lost its width and stopped
    // producing a bounding rect at all.
    const text = caption();
    const measured = text.width;
    const { host } = setup(text);

    const height = host.querySelector<HTMLInputElement>(
      '[data-vigilia-geometry="height"]',
    )!;
    height.value = "40";
    height.dispatchEvent(new Event("change"));

    const authored = text.get("vigiliaText") as {
      box: { width: number; height: number };
    };
    expect(authored.box.height).toBe(40);
    expect(authored.box.width).toBe(measured);
    // The other half: the box is a number, not the `undefined` that made the
    // width unreadable.
    expect(Number.isFinite(authored.box.width)).toBe(true);
  });

  it("shows the authored box back, not the measurement underneath it", () => {
    // A `Textbox` derives its own width from its longest unbreakable run, so a
    // re-read of the measurement reports what the text happens to measure —
    // 64 here — where the author wrote 300. The box is the authored truth.
    const text = caption();
    text.set("vigiliaText", {
      ...(text.get("vigiliaText") as Record<string, unknown>),
      box: { width: 300, height: 90 },
    });
    const { inspector } = setup(text);

    expect(
      inspector.root.querySelector<HTMLInputElement>(
        '[data-vigilia-geometry="width"]',
      )?.value,
    ).toBe("300");
    expect(
      inspector.root.querySelector<HTMLInputElement>(
        '[data-vigilia-geometry="height"]',
      )?.value,
    ).toBe("90");
  });

  it("still scales a shape, whose width is a size rather than a box", () => {
    // The same field, the other kind of object: a `Rect`'s width is a natural
    // size, and scaling is how it changes.
    const panel = new Rect({ left: 0, top: 0, width: 360, height: 200 });
    const { host } = setup(panel);

    const width = host.querySelector<HTMLInputElement>(
      '[data-vigilia-geometry="width"]',
    )!;
    width.value = "180";
    width.dispatchEvent(new Event("change"));

    expect(panel.scaleX).toBeCloseTo(0.5, 6);
    expect(panel.get("vigiliaText")).toBeUndefined();
  });
});
