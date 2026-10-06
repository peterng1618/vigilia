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
import { VigiliaChart, Wedge } from "@vigilia/scene-fabric";
import {
  ActiveSelection,
  type FabricObject,
  FabricImage,
  Group,
  IText,
  Line,
  Path,
  Point,
  Polygon,
  Polyline,
  Rect,
  Textbox,
} from "fabric/es";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { uiCopy } from "../ui-copy.js";
import { idleCrop } from "./idle-crop.test-stage.js";
import { createSelectionInspector } from "./index.js";
import {
  type ChartFieldsPort,
  KIND_QUESTIONS,
  perKindColumn,
  SELECTION_KINDS,
  type SelectionKind,
  selectionKindOf,
} from "./per-kind-column.js";

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

  it("names where to choose from when nothing is selected", () => {
    const { host } = setup(undefined);

    // One line saying what to do, rather than an empty column or a section
    // header standing over no fields.
    expect(
      host.querySelector("[data-vigilia-nothing-selected]")?.textContent,
    ).toBe(uiCopy.inspectorFields.nothingSelected);
    expect(host.querySelectorAll("[data-vigilia-section]")).toHaveLength(0);
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

describe("the column's sections", () => {
  let rect: Rect;

  beforeEach(() => {
    rect = new Rect({ left: 0, top: 0, width: 40, height: 20 });
  });

  const ids = (host: HTMLElement): (string | undefined)[] =>
    [...host.querySelectorAll<HTMLElement>("[data-vigilia-section]")].map(
      (section) => section.dataset["vigiliaSection"],
    );

  const isOpen = (host: HTMLElement, id: string): boolean | undefined =>
    host.querySelector<HTMLDetailsElement>(
      `[data-vigilia-section="${id}"] details`,
    )?.open;

  const summaryOf = (host: HTMLElement, id: string): HTMLElement =>
    host.querySelector<HTMLElement>(`[data-vigilia-section="${id}"] summary`)!;

  it("asks the five questions in order, and only Position starts closed", () => {
    const { host } = setup(rect);

    expect(ids(host)).toEqual([
      "content",
      "position",
      "layer",
      "paint",
      "spends",
    ]);
    // Geometry is adjusted once and the binding is chosen constantly, so the
    // one section that is not asked repeatedly is the one put away.
    expect(isOpen(host, "position")).toBe(false);
    for (const id of ["content", "layer", "paint", "spends"]) {
      expect(isOpen(host, id), id).toBe(true);
    }
  });

  it("says how much the closed Position holds, so collapsed is not hidden", () => {
    const { host } = setup(rect);
    const section = host.querySelector<HTMLElement>(
      '[data-vigilia-section="position"]',
    )!;

    // The count is the body's own length: a header that could claim more than
    // the section holds is the defect the section control exists to prevent.
    const count = Number(
      section.querySelector(".vigilia-section-count")?.textContent,
    );
    const body = section.querySelector(".vigilia-section-body")!;
    expect(count).toBe(body.childElementCount);
    expect(body.childElementCount).toBeGreaterThan(0);
  });

  it("keeps the sections the author opened across a re-render", () => {
    const { host, inspector } = setup(rect);
    summaryOf(host, "position").click();
    summaryOf(host, "paint").click();
    expect(isOpen(host, "position")).toBe(true);
    expect(isOpen(host, "paint")).toBe(false);

    inspector.render();

    // The author's own arrangement, not a fresh default: rebuilding the column
    // would collapse Position again and reopen Paint under their hands.
    expect(isOpen(host, "position")).toBe(true);
    expect(isOpen(host, "paint")).toBe(false);
  });

  it("puts the caret back in the field being typed into", () => {
    const { host, inspector } = setup(rect);
    // Attached, because nothing is focusable while it is detached and jsdom
    // would report `body` as the active element whatever this does.
    document.body.append(host);
    const name = host.querySelector<HTMLInputElement>("[data-vigilia-name]")!;
    name.focus();
    expect(document.activeElement).toBe(name);

    inspector.render();

    // The re-render replaces the field, so the caret has to be put back in the
    // new element — the two share only the data hook that names them.
    const after = host.querySelector<HTMLInputElement>("[data-vigilia-name]")!;
    expect(after).not.toBe(name);
    expect(document.activeElement).toBe(after);
    host.remove();
  });

  it("does not put focus back on a control that only toggles", () => {
    const { host, inspector } = setup(rect);
    document.body.append(host);
    const glass = host.querySelector<HTMLInputElement>(
      "[data-vigilia-glass-enabled]",
    )!;
    glass.focus();
    expect(document.activeElement).toBe(glass);

    inspector.render();

    // `focus` is not free here: it is what opens the glass control's reason
    // popup, so restoring it re-opened a reason the author had just dismissed
    // with Escape. A checkbox has no caret to lose.
    expect(document.activeElement).not.toBe(
      host.querySelector("[data-vigilia-glass-enabled]"),
    );
    host.remove();
  });

  it("renders no header at all for a section with nothing in it", () => {
    rect.set({ locked: true });
    const { host } = setup(rect);

    // Every field that writes is withheld, so Content has no question left to
    // ask and must not stand a header over nothing.
    expect(host.querySelector('[data-vigilia-section="content"]')).toBeNull();
    // Read-only, so the author still sees what the object resolves to.
    expect(
      host.querySelector('[data-vigilia-section="spends"]'),
    ).not.toBeNull();
  });

  it("puts each field under the question it answers", () => {
    const { host } = setup(rect);
    const inSection = (id: string, selector: string): Element | null =>
      host.querySelector(`[data-vigilia-section="${id}"] ${selector}`);

    expect(inSection("content", "[data-vigilia-name]")).not.toBeNull();
    expect(
      inSection("position", '[data-vigilia-geometry="left"]'),
    ).not.toBeNull();
    expect(
      inSection("position", '[data-vigilia-geometry="width"]'),
    ).not.toBeNull();
    expect(inSection("position", "[data-vigilia-bleeds]")).not.toBeNull();
    expect(
      inSection("layer", '[data-vigilia-geometry="angle"]'),
    ).not.toBeNull();
    expect(inSection("layer", "[data-vigilia-opacity]")).not.toBeNull();
    expect(inSection("paint", "[data-vigilia-panel-fill]")).not.toBeNull();
    expect(inSection("spends", "[data-vigilia-resolution]")).not.toBeNull();

    // ...and nowhere else: rotation is not a position, and what an object
    // resolves to is not how it is painted.
    expect(inSection("position", '[data-vigilia-geometry="angle"]')).toBeNull();
    expect(inSection("paint", "[data-vigilia-resolution]")).toBeNull();
  });

  it("is a plan a test can read as data, before anything renders", () => {
    const editor = {
      canvas: canvasWith(rect),
      historyManager: { saveState: vi.fn() },
      errorManager: { warn: vi.fn(), error: vi.fn() },
      cropManager: idleCrop(),
    };
    const sections = perKindColumn(rect, {
      editor: editor as never,
      globals: undefined,
      locale: undefined,
      geometry: {
        read: () => 0,
        write: () => {},
        measuredEdge: () => undefined,
      },
      stillTarget: () => true,
      commit: () => {},
      rerender: () => {},
      revealTypePresets: undefined,
      refreshGlass: () => {},
      nodeBindings: undefined,
      onNodeBindingsChange: undefined,
      sampleSource: undefined,
      sections: new Map(),
    });

    expect(sections.map((section) => section.section)).toEqual([
      "content",
      "position",
      "layer",
      "paint",
      "spends",
    ]);
    expect(
      sections
        .filter((section) => section.defaultOpen)
        .map((section) => section.section),
    ).toEqual(["content", "layer", "paint", "spends"]);
    for (const section of sections) {
      expect(section.count, section.section).toBe(
        section.root.querySelectorAll(".vigilia-section-body > *").length,
      );
    }
  });

  it("mounts a chart's own fields in the chart's own column", () => {
    // The seam the Data tab used to be. A chart's settings and bindings are
    // written by the chart manager and mounted here, in the Content and Paint
    // sections of the selection's column — so the question "where is this
    // chart's data?" is answered where the author already is, and the count
    // over each section includes the fields the owner handed over.
    const chart = chartOf("gauge", defaultGaugeSettings);
    const field = (marker: string): HTMLElement => {
      const element = document.createElement("div");
      element.dataset["marker"] = marker;
      return element;
    };
    const chartFields: ChartFieldsPort = {
      content: () => [field("content")],
      paint: () => [field("paint")],
    };
    const sections = perKindColumn(chart, {
      editor: {
        canvas: canvasWith(chart),
        historyManager: { saveState: vi.fn() },
        errorManager: { warn: vi.fn(), error: vi.fn() },
        cropManager: idleCrop(),
      } as never,
      globals: undefined,
      locale: undefined,
      geometry: {
        read: () => 0,
        write: () => {},
        measuredEdge: () => undefined,
      },
      stillTarget: () => true,
      commit: () => {},
      rerender: () => {},
      revealTypePresets: undefined,
      refreshGlass: () => {},
      nodeBindings: undefined,
      onNodeBindingsChange: undefined,
      sampleSource: undefined,
      sections: new Map(),
      chartFields,
    });
    const inSection = (name: string, marker: string): HTMLElement | null =>
      sections
        .find((section) => section.section === name)
        ?.root.querySelector<HTMLElement>(`[data-marker="${marker}"]`) ?? null;

    expect(inSection("content", "content")).not.toBeNull();
    expect(inSection("paint", "paint")).not.toBeNull();
    // Nowhere else: a chart's paint is not a content field, and the count over
    // each section is what tells the two apart when both are mounted.
    expect(inSection("paint", "content")).toBeNull();
    expect(inSection("content", "paint")).toBeNull();
    expect(sections.find((s) => s.section === "content")?.count).toBe(2);
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

  /**
   * `vigiliaText.box` is stored **unscaled** — `assertBoxHeight` puts the object
   * back at `box.height / scaleY` precisely so the scale can be reapplied by
   * `boxFrom` — so a text object carrying a scale draws a box larger than the
   * number the Size field shows. Measured on the running editor: a 140 × 27.12
   * box at `scaleY 2` read **27** in the H field and drew an edge of 54.24.
   */
  function scaledCaption(): Textbox {
    const text = caption();
    const box = { width: 140, height: 27 };
    text.set("vigiliaText", {
      ...(text.get("vigiliaText") as Record<string, unknown>),
      box,
    });
    text.set({ scaleX: 2, scaleY: 2 });
    // Where the text pass leaves the object's own edges: `assertBoxWidth` and
    // `assertBoxHeight` assign the authored box straight onto the object,
    // because a `set` re-enters `initDimensions` and Fabric re-derives the
    // height from the wrapped text. Assigned rather than set here for the same
    // reason; left at Fabric's measurement, this would be asserting jsdom's
    // font metrics rather than the inspector.
    text.width = box.width;
    text.height = box.height;
    return text;
  }

  const sizeLine = (host: HTMLElement): string | null | undefined =>
    host.querySelector('[data-vigilia-resolution="Size"]')?.textContent;

  it("says which number the Size fields show, and what the object measures", () => {
    // The field cannot show the measured edge instead: `write` puts the number
    // the author types into `vigiliaText.box`, so a field reading the edge
    // would name a number it is about to overwrite. So it keeps the box and
    // reports the disagreement, rather than leaving the author to choose
    // between a number on a panel and a box on a canvas.
    const { host } = setup(scaledCaption());

    const line = sizeLine(host);
    expect(line).toContain("authored");
    expect(line).toContain("280 × 54");
  });

  it("says nothing when the box and the edge are the same number", () => {
    const text = caption();
    text.set("vigiliaText", {
      ...(text.get("vigiliaText") as Record<string, unknown>),
      box: { width: text.width, height: text.height },
    });
    const { host } = setup(text);

    expect(sizeLine(host)).toBeUndefined();
  });

  it("says nothing for a shape, whose fields already are its measured edge", () => {
    const panel = new Rect({ left: 0, top: 0, width: 360, height: 200 });
    panel.set({ scaleX: 2, scaleY: 2 });
    const { host } = setup(panel);

    // W reads 360 and the object draws 720, which is the same disagreement —
    // but there the field *is* the scaled edge, so there is nothing to report.
    expect(
      host.querySelector<HTMLInputElement>('[data-vigilia-geometry="width"]')
        ?.value,
    ).toBe("720");
    expect(sizeLine(host)).toBeUndefined();
  });
});

describe("the column a kind gets", () => {
  /** A shape that carries a paint reference, so a container built from it has
      something for its own appearance question to read. */
  function paintedRect(id: string): Rect {
    const rect = new Rect({ left: 0, top: 0, width: 40, height: 20, id });
    rect.set("vigiliaPaint", { fill: "palette.ink" });
    return rect;
  }

  /** A text object with authored runs: the only kind that has typography. */
  function textBox(): Textbox {
    const text = new Textbox("Hi", {
      left: 0,
      top: 0,
      width: 40,
      id: "label-1",
    });
    text.set("vigiliaText", {
      runs: [{ kind: "literal", text: "Hi", typePreset: "typePresets.body" }],
    });
    return text;
  }

  /**
   * One live example per kind, in the brief's own terms: a `Wedge`, a text box,
   * a chart, an image, a group, and a selection spanning two kinds. The list is
   * the driver — a kind added to `SELECTION_KINDS` arrives here without an
   * example and fails to compile, rather than passing unnoticed.
   */
  const EXAMPLE: Readonly<Record<SelectionKind, () => FabricObject>> = {
    shape: () =>
      new Wedge({
        left: 0,
        top: 0,
        radius: 20,
        startAngle: 0,
        endAngle: 90,
      }),
    text: () => textBox(),
    chart: () => chartOf("gauge", defaultGaugeSettings),
    image: () =>
      new FabricImage("", { left: 0, top: 0, width: 40, height: 40 }),
    group: () => new Group([paintedRect("panel-1"), textBox()]),
    activeSelection: () =>
      new ActiveSelection([paintedRect("panel-1"), textBox()]),
  };

  /**
   * Everything each kind rendered **before** the column learned its kinds, read
   * off the pre-change DOM rather than off the column — otherwise the test would
   * only restate whatever the column now does, and would agree with a bug.
   *
   * `shape`'s reference is the `Wedge`, so the corner radius is absent on
   * purpose and asserted separately: `rx` is a `Rect`'s property and no other
   * shape reads it.
   */
  const EVERY_OBJECT: readonly string[] = [
    "[data-vigilia-name]",
    '[data-vigilia-geometry="left"]',
    '[data-vigilia-geometry="top"]',
    '[data-vigilia-geometry="width"]',
    '[data-vigilia-geometry="height"]',
    '[data-vigilia-geometry="angle"]',
    "[data-vigilia-opacity]",
    "[data-vigilia-bleeds]",
    "[data-vigilia-glass-enabled]",
    "[data-vigilia-resolution]",
  ];

  const PRE_PLAN: Readonly<Record<SelectionKind, readonly string[]>> = {
    shape: [
      ...EVERY_OBJECT,
      "[data-vigilia-panel-fill]",
      "[data-vigilia-panel-stroke]",
      "[data-vigilia-panel-border]",
      "[data-vigilia-panel-shadow]",
      '[data-vigilia-shape-angle="startAngle"]',
      '[data-vigilia-shape-angle="endAngle"]',
    ],
    text: [
      ...EVERY_OBJECT,
      "[data-vigilia-runs]",
      "[data-vigilia-text-align]",
      "[data-vigilia-text-vertical-align]",
      "[data-vigilia-text-wrap]",
      "[data-vigilia-text-overflow]",
      "[data-vigilia-run-source]",
      '[data-vigilia-resolution="Type preset"]',
      "[data-vigilia-reveal-type-presets]",
    ],
    chart: [...EVERY_OBJECT],
    image: [...EVERY_OBJECT, "[data-vigilia-crop]"],
    group: [...EVERY_OBJECT],
    activeSelection: [...EVERY_OBJECT],
  };

  it.each([...SELECTION_KINDS])(
    "answers a %s with a column rather than an empty one",
    (kind) => {
      const { host } = setup(EXAMPLE[kind]());

      // Not "has the fields I expected". The defect this pins is a kind that
      // reaches the column with no rule and renders nothing at all — the
      // original unreachability defect with a new cause — so the assertion is
      // that the column answered with something.
      expect(
        host.querySelectorAll("[data-vigilia-section]").length,
        kind,
      ).toBeGreaterThan(0);
      expect(
        host.querySelectorAll(
          "[data-vigilia-section] input, [data-vigilia-section] select, [data-vigilia-section] button",
        ).length,
        kind,
      ).toBeGreaterThan(0);
    },
  );

  it.each([...SELECTION_KINDS])(
    "keeps every field a %s had before the column was per-kind",
    (kind) => {
      const { host } = setup(EXAMPLE[kind]());

      for (const selector of PRE_PLAN[kind]) {
        expect(
          host.querySelector(selector),
          `${kind}: ${selector}`,
        ).not.toBeNull();
      }
    },
  );

  it.each([...SELECTION_KINDS])(
    "reads its %s example as that kind and no other",
    (kind) => {
      // The two containers share a class — Fabric's `ActiveSelection` *is* a
      // `Group` — so this is what would catch a dispatch that named the parent
      // first and described a multi-selection as one object.
      expect(selectionKindOf(EXAMPLE[kind]())).toBe(kind);
    },
  );

  it("has a rule for every kind it lists, so none reaches the column unhandled", () => {
    // The runtime half of a compile-time claim: a kind in the list with no entry
    // in `KIND_QUESTIONS` is a type error, and this is the same fact at runtime.
    expect(Object.keys(KIND_QUESTIONS).sort()).toEqual(
      [...SELECTION_KINDS].sort(),
    );
  });

  it("answers a locked object rather than standing a header over nothing", () => {
    const locked = new Rect({
      left: 0,
      top: 0,
      width: 40,
      height: 20,
      locked: true,
    });
    const { host } = setup(locked);

    // Every field that writes is withheld, so one section is left — the
    // read-only one — and it has a body rather than a count of zero.
    expect(host.querySelectorAll("[data-vigilia-section]")).toHaveLength(1);
    expect(host.querySelector("[data-vigilia-resolution]")).not.toBeNull();
    expect(host.querySelector("[data-vigilia-name]")).toBeNull();
  });

  it("keeps a rectangle's corner radius, which no other shape reads", () => {
    const { host } = setup(
      new Rect({ left: 0, top: 0, width: 40, height: 20 }),
    );

    // The radius is a `Rect` property. A column that answered every shape with
    // the same fields would offer it to a `Wedge` and read back `NaN`.
    expect(host.querySelector("[data-vigilia-panel-radius]")).not.toBeNull();
    expect(
      setup(EXAMPLE.shape()).host.querySelector("[data-vigilia-panel-radius]"),
    ).toBeNull();
  });

  it.each([
    [
      "a Polygon",
      () =>
        new Polygon([new Point(0, -20), new Point(20, 20), new Point(-20, 20)]),
      "[data-vigilia-shape-sides]",
    ],
    [
      "a Polyline",
      () => new Polyline([new Point(0, 0), new Point(20, 20)]),
      "[data-vigilia-shape-points]",
    ],
    ["a Line", () => new Line([0, 0, 20, 20]), "[data-vigilia-shape-line]"],
    [
      "a Path",
      () => new Path("M 0 0 L 20 20 L 40 0"),
      "[data-vigilia-shape-path]",
    ],
  ])(
    "keeps %s's own geometry, which no other shape has",
    (_name, make, selector) => {
      const { host } = setup(make());

      // The general W/H pair belongs to every shape; these numbers belong to one
      // kind each. A per-kind column that answered every shape the same way
      // would be the "lesser selection" this task exists to prevent.
      expect(host.querySelector(selector)).not.toBeNull();
    },
  );

  describe("a container", () => {
    /** The two kinds whose appearance is their children's. */
    const CONTAINERS: readonly (readonly [
      SelectionKind,
      () => FabricObject,
    ])[] = [
      ["group", EXAMPLE.group],
      ["activeSelection", EXAMPLE.activeSelection],
    ];

    it.each(CONTAINERS)(
      "shows bounds and the children's appearance for a %s, and not the questions it lacks",
      (_kind, make) => {
        const { host } = setup(make());

        // Bounds: the same Position pair every other object gets, at the same
        // density — a group is not a lesser selection.
        expect(
          host.querySelector('[data-vigilia-geometry="width"]'),
        ).not.toBeNull();
        expect(
          host.querySelector('[data-vigilia-geometry="left"]'),
        ).not.toBeNull();

        // The children's appearance, read off the children: the container has no
        // ink of its own, so a line about its own fill could only say "none"
        // while the canvas behind it is painted.
        expect(
          host.querySelector('[data-vigilia-resolution="Paint"]')?.textContent,
        ).toContain("Ink");
        expect(
          host.querySelector('[data-vigilia-resolution="Type preset"]')
            ?.textContent,
        ).toContain("Body");

        // ...and the questions this kind genuinely does not have, which is what
        // "not a lesser selection" means for a kind that lacks them: nothing is
        // shown, rather than a control that would accept an edit and apply none.
        for (const absent of [
          "[data-vigilia-panel-fill]",
          "[data-vigilia-panel-stroke]",
          "[data-vigilia-crop]",
          "[data-vigilia-runs]",
          "[data-vigilia-text-align]",
        ]) {
          expect(host.querySelector(absent), absent).toBeNull();
        }
      },
    );

    it("still says a container resolves to nothing when none of its children is painted", () => {
      const { host } = setup(new Group([new Rect({ width: 10, height: 10 })]));

      // The line the container carried before it learned to read its children:
      // the question is still asked, and the answer is still "none".
      expect(
        host.querySelector('[data-vigilia-resolution="Paint"]')?.textContent,
      ).toContain(uiCopy.inspectorFields.notSet);
    });

    it("answers one line per token, not one per child", () => {
      const card = new Group([
        paintedRect("panel-1"),
        paintedRect("panel-2"),
        paintedRect("panel-3"),
      ]);
      const { host } = setup(card);

      // Three children sharing one token resolve to that one token; repeating it
      // three times would make the section a copy of the canvas rather than an
      // answer to what the selection is made of.
      expect(
        host.querySelectorAll('[data-vigilia-resolution="Paint"]'),
      ).toHaveLength(1);
    });
  });
});
