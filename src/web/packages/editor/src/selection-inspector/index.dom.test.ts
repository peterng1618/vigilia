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
  Canvas,
  FabricImage,
  type FabricObject,
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
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createObjectLockManager } from "../object-lock-manager/index.js";
import {
  type ChartFieldTarget,
  chartContentView,
  chartPaintView,
} from "../chart-manager/panel.js";
import { uiCopy } from "../ui-copy.js";
import { idleCrop } from "./idle-crop.test-stage.js";
import { createSelectionInspector } from "./index.js";
import {
  type ChartFieldsPort,
  KIND_QUESTIONS,
  perKindColumn,
  rendersExtra,
  SELECTION_KINDS,
  type SelectionKind,
  selectionKindOf,
} from "./per-kind-column.js";

// The column's sections keep their open state in React now, and React only
// flushes a click's update inside `act` — so the one test that clicks a header
// needs an act environment. Nothing else here drives React directly.
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// Every `setup` attaches its host so a field can hold focus; the body is
// emptied between cases so the hosts (and the popups a control portals into it)
// do not pile up.
afterEach(() => {
  document.body.replaceChildren();
});

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

/** A canvas stub that answers selection and history like the editor's.
 *
 *  `active` may be a value or a getter. A getter is how a test deselects: the
 *  selection has to be able to change *after* the inspector is built, or the
 *  branch that reads it cannot be reached. `objects` decouples the document
 *  from the selection — after a history restore the scene holds the object
 *  while nothing is selected, and a stub that ties the two together cannot
 *  express the case the restore branch exists for. */
function canvasWith(
  active: unknown | (() => unknown),
  objects?: () => readonly unknown[],
) {
  const read =
    typeof active === "function" ? (active as () => unknown) : () => active;
  return {
    getActiveObject: () => read(),
    getObjects: () => {
      if (objects !== undefined) return objects();
      const current = read();
      return current === undefined ? [] : [current];
    },
    requestRenderAll: vi.fn(),
    fire: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  };
}

function setup(
  active: unknown | (() => unknown),
  options: {
    readonly nodeBindings?: (nodeId: string) => readonly Binding[];
    readonly onNodeBindingsChange?: (
      nodeId: string,
      bindings: readonly Binding[],
    ) => void;
    readonly objects?: () => readonly unknown[];
  } = {},
) {
  const history = { saveState: vi.fn() };
  // Attached: nothing is focusable while it is detached, and a plan-1 control
  // commits on blur — which jsdom fires only for an element that can hold
  // focus. `afterEach` empties the body so the hosts do not pile up.
  const host = document.createElement("div");
  document.body.append(host);
  const editor = {
    canvas: canvasWith(active, options.objects),
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

/**
 * A draft in a plan-1 text field, as React sees one: through the prototype's
 * setter, because React replaces `value` on the node with a tracker that would
 * suppress a plain assignment.
 */
async function draft(input: HTMLInputElement, value: string): Promise<void> {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(input) as HTMLInputElement,
      "value",
    )?.set;
    if (setter === undefined) input.value = value;
    else setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Off the field, which is what the control commits. Its own turn, because a
 *  blur in the same turn as the draft would read it before React applied it. */
async function leave(input: HTMLInputElement): Promise<void> {
  await act(async () => {
    input.focus();
    input.blur();
  });
}

/** A committed edit on one of the plan-1 controls. */
async function edit(input: HTMLInputElement, value: string): Promise<void> {
  await draft(input, value);
  await leave(input);
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

  it("refuses a fractional rotation rather than storing it", async () => {
    const { host, history } = setup(rect);
    const angle = host.querySelector<HTMLInputElement>(
      '[data-vigilia-geometry="angle"]',
    )!;
    angle.focus();

    await edit(angle, "45.5");

    // The deleted `numberField` refused a non-integer rather than rounding it.
    // Without that rule the fraction reaches `object.set({angle})` and lands a
    // history entry behind it. The rejected draft stays in the box, with its
    // reason, so the author can correct it.
    expect(rect.angle).toBe(0);
    expect(history.saveState).not.toHaveBeenCalled();
    expect(angle.value).toBe("45.5");
    expect(angle.getAttribute("aria-invalid")).toBe("true");
  });

  it("stores a whole rotation", async () => {
    const { host, history } = setup(rect);
    const angle = host.querySelector<HTMLInputElement>(
      '[data-vigilia-geometry="angle"]',
    )!;

    await edit(angle, "45");

    expect(rect.angle).toBe(45);
    expect(history.saveState).toHaveBeenCalledTimes(1);
  });

  it("moves the object and records exactly one history entry", async () => {
    const { host, history } = setup(rect);
    const left = host.querySelector<HTMLInputElement>(
      '[data-vigilia-geometry="left"]',
    )!;

    await edit(left, "120");

    expect(rect.left).toBe(120);
    expect(history.saveState).toHaveBeenCalledTimes(1);
  });

  it("pairs X/Y and W/H on one row each, with rotation alone", () => {
    const { host } = setup(rect);
    const input = (key: string) =>
      host.querySelector<HTMLInputElement>(`[data-vigilia-geometry="${key}"]`)!;
    // A pair is a layout, and `[data-vigilia-pair]` is the row it lays out.
    const rowOf = (key: string) => input(key).closest("[data-vigilia-pair]");

    // Non-vacuous: a pairing assertion on two absent rows would compare null
    // to null and pass for the stacked layout this replaced.
    expect(rowOf("left")).not.toBeNull();
    expect(rowOf("width")).not.toBeNull();
    // A pair shares its row element; the two pairs are distinct rows.
    expect(rowOf("left")).toBe(rowOf("top"));
    expect(rowOf("width")).toBe(rowOf("height"));
    expect(rowOf("left")).not.toBe(rowOf("width"));
    // Rotation stands alone: Layer renders it as its own row, never as one
    // half of the pairs Position builds.
    expect(input("angle").closest("[data-vigilia-pair]")).toBeNull();
    expect(input("angle").closest('[data-vigilia-section="layer"]')).not.toBe(
      null,
    );
  });

  it("commits a paired edit as one history entry", async () => {
    const { host, history } = setup(rect);
    const width = host.querySelector<HTMLInputElement>(
      '[data-vigilia-geometry="width"]',
    )!;

    await edit(width, "80");

    // The sibling's unchanged value is written back too, but that is a no-op
    // for geometry: one committed edit, one entry.
    expect(rect.width * rect.scaleX).toBe(80);
    expect(history.saveState).toHaveBeenCalledTimes(1);
  });

  it("commits only the edited half, leaving a fractional sibling alone", async () => {
    // A drag leaves fractional scale, and the field shows the rounded read of
    // it. Editing one half must not write the sibling, or the round-trip
    // through the field would quantise the dimension the author never touched.
    rect.set({ width: 520, height: 36.32, scaleX: 1.0009, scaleY: 1.00444 });
    const { host, history } = setup(rect);
    const width = host.querySelector<HTMLInputElement>(
      '[data-vigilia-geometry="width"]',
    )!;
    expect(width.value).toBe("520");

    await edit(width, "1040");

    expect(rect.scaleX).toBeCloseTo(2, 5);
    // The half the author did not edit keeps its fractional scale: a commit
    // that wrote the sibling would land it on `Math.round(36.48)` and quantise
    // it to about 0.991.
    expect(rect.scaleY).toBeCloseTo(1.00444, 5);
    expect(rect.height * rect.scaleY).toBeCloseTo(36.48, 2);
    expect(history.saveState).toHaveBeenCalledTimes(1);
  });

  it("refuses a value that would make the object invalid", async () => {
    const { host, history } = setup(rect);
    const width = host.querySelector<HTMLInputElement>(
      '[data-vigilia-geometry="width"]',
    )!;

    await edit(width, "-5");

    // Was restored to 40 with nothing recorded. The floor is 1, so -5 now
    // lands on 1: reverting is what made the bound undiscoverable.
    expect(width.value).toBe("1");
    expect(rect.scaleX).toBeGreaterThan(0);
    expect(history.saveState).toHaveBeenCalledTimes(1);
  });

  it("shows opacity as a percentage and stores Fabric's 0-1", async () => {
    rect.set({ opacity: 0.5 });
    const { host, history } = setup(rect);
    const opacity = host.querySelector<HTMLInputElement>(
      "[data-vigilia-opacity]",
    )!;

    expect(opacity.value).toBe("50");

    await edit(opacity, "25");

    expect(rect.opacity).toBe(0.25);
    expect(history.saveState).toHaveBeenCalledTimes(1);
  });

  it("refuses opacity outside the range rather than clamping it", async () => {
    rect.set({ opacity: 0.5 });
    const { host, history, editor } = setup(rect);
    const opacity = host.querySelector<HTMLInputElement>(
      "[data-vigilia-opacity]",
    )!;

    await edit(opacity, "150");

    expect(rect.opacity).toBe(0.5);
    expect(opacity.value).toBe("50");
    expect(history.saveState).not.toHaveBeenCalled();
    expect(editor.errorManager.warn).toHaveBeenCalled();
  });

  it("shows the object's display name and writes an edit back to it", async () => {
    rect.set("name", "Header panel");
    const { host, history } = setup(rect);
    const name = host.querySelector<HTMLInputElement>("[data-vigilia-name]")!;

    expect(name.value).toBe("Header panel");

    await edit(name, "Header rule");

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

  it("clears the name when the author empties the field", async () => {
    rect.set("name", "Header panel");
    const { host, history } = setup(rect);
    const name = host.querySelector<HTMLInputElement>("[data-vigilia-name]")!;

    await edit(name, "   ");

    // The key goes rather than holding a blank label, so the layer list falls
    // back to the id exactly as it does for a scene that never had a name.
    expect(rect.get("name")).toBeUndefined();
    expect(history.saveState).toHaveBeenCalledTimes(1);
  });

  it("refuses a name past the published bound rather than storing it", async () => {
    rect.set("name", "Header panel");
    const { host, history, editor } = setup(rect);
    const name = host.querySelector<HTMLInputElement>("[data-vigilia-name]")!;

    await edit(name, "x".repeat(MAX_OBJECT_NAME_LENGTH + 1));

    // The envelope would refuse this on import, so a save would throw; the field
    // rejects the edit and shows what the object actually carries.
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

  it("announces the edit so the layer list republishes the row", async () => {
    // The layer row prints this name, and the panel caches its projection, so
    // a rename that only wrote the object would leave the two surfaces
    // disagreeing until something else happened to republish.
    rect.set("name", "Header panel");
    const { host, editor } = setup(rect);
    const name = host.querySelector<HTMLInputElement>("[data-vigilia-name]")!;

    await edit(name, "Header rule");

    expect(editor.canvas.fire).toHaveBeenCalledWith(
      "object:modified",
      expect.objectContaining({ target: rect }),
    );
  });

  it("announces nothing when a name is refused", async () => {
    rect.set("name", "Header panel");
    const { host, editor } = setup(rect);
    const name = host.querySelector<HTMLInputElement>("[data-vigilia-name]")!;

    await edit(name, "x".repeat(MAX_OBJECT_NAME_LENGTH + 1));

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

  /** The two ways a selection can go away, which the column must treat
   *  differently — spec §541 and §552's "the right column empties on deselect".
   *
   *  The previous version of this test never dropped the selection, so it
   *  passed whichever branch `target()` took; these two fail if the branch is
   *  swapped back. */
  it("empties on a deselect, and re-binds across a history restore", () => {
    const rect = new Rect({ left: 0, top: 0, width: 40, height: 20 });
    rect.set({ id: "cpu-card" });
    let active: FabricObject | undefined = rect;
    // The scene keeps the object across the restore even though the selection
    // does not — that is what makes re-binding possible at all.
    const { host, editor } = setup(() => active, { objects: () => [rect] });

    const handlerFor = (name: string): (() => void) => {
      const call = editor.canvas.on.mock.calls.find(
        ([registered]) => registered === name,
      );
      expect(call, `nothing is subscribed to ${name}`).toBeDefined();
      return call?.[1] as () => void;
    };

    expect(host.querySelector("[data-vigilia-name]")).not.toBeNull();

    // A pointer deselect: Fabric clears the selection and no history is
    // involved. The column names where to choose from and holds no field.
    active = undefined;
    handlerFor("selection:cleared")();
    expect(
      host.querySelector("[data-vigilia-nothing-selected]"),
      "a deselect must empty the column",
    ).not.toBeNull();
    expect(host.querySelector("[data-vigilia-name]")).toBeNull();

    // A history restore drops the selection too, and must NOT empty it: the id
    // survives the rebuild, so the author keeps the panel they were working in.
    active = rect;
    handlerFor("selection:created")();
    active = undefined;
    handlerFor("editor:history-state-loaded")();
    expect(
      host.querySelector("[data-vigilia-name]"),
      "a history restore must keep the panel the author was working in",
    ).not.toBeNull();
    expect(host.querySelector("[data-vigilia-nothing-selected]")).toBeNull();
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

  it("republishes when the object is locked from the layer row (vg-148)", () => {
    // vg-148: locking through the layer row sets the flags and fires no
    // selection event, so the column went on offering writing fields the object
    // would refuse until something else happened to re-render it. This drives
    // the real manager over a real canvas — an event the manager never fires
    // cannot reach the column through a stub that does not route one.
    const canvas = new Canvas(document.createElement("canvas"));
    const object = new Rect({ left: 0, top: 0, width: 40, height: 20 });
    object.set("id", "cpu-card");
    canvas.add(object);
    canvas.setActiveObject(object);

    const host = document.createElement("div");
    createSelectionInspector(host, {
      editor: {
        canvas,
        historyManager: { saveState: vi.fn() },
        errorManager: { warn: vi.fn(), error: vi.fn() },
        cropManager: idleCrop(),
      } as never,
      refreshGlass: vi.fn(),
    });

    expect(host.querySelector("[data-vigilia-name]")).not.toBeNull();
    expect(host.textContent).not.toContain(uiCopy.inspectorFields.locked);

    createObjectLockManager(canvas, vi.fn()).lockObject();

    expect(host.textContent).toContain(uiCopy.inspectorFields.locked);
    expect(host.querySelector("[data-vigilia-name]")).toBeNull();
    expect(host.querySelector('[data-vigilia-geometry="width"]')).toBeNull();
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

  const isOpen = (host: HTMLElement, id: string): boolean =>
    host
      .querySelector(`[data-vigilia-section="${id}"] > h2 > button`)
      ?.getAttribute("aria-expanded") === "true";

  const summaryOf = (host: HTMLElement, id: string): HTMLElement =>
    host.querySelector<HTMLElement>(
      `[data-vigilia-section="${id}"] > h2 > button`,
    )!;

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

    // The count is every row the section renders — the fields React owns now
    // plus the body it does not yet — and a header that could claim more than
    // the section holds is the defect the section control exists to prevent.
    const count = Number(
      section.querySelector("[data-vigilia-section-count]")?.textContent,
    );
    // Each field and extra renders exactly one row element inside the panel;
    // the still-imperative body container is the one child that is not a row.
    const body = section.querySelector("[data-vigilia-section-body]")!;
    const rows = body.parentElement!.childElementCount - 1;
    expect(count).toBe(rows);
    expect(rows).toBeGreaterThan(0);
  });

  it("keeps the sections the author opened across a re-publish", () => {
    const { host, inspector } = setup(rect);
    act(() => {
      summaryOf(host, "position").click();
      summaryOf(host, "paint").click();
    });
    expect(isOpen(host, "position")).toBe(true);
    expect(isOpen(host, "paint")).toBe(false);

    inspector.render();

    // The author's own arrangement, not a fresh default: a re-publish that
    // rebuilt the sections would collapse Position again and reopen Paint under
    // their hands. React keeps the open state; the projection only says what a
    // fresh section starts as.
    expect(isOpen(host, "position")).toBe(true);
    expect(isOpen(host, "paint")).toBe(false);
  });

  it("keeps the caret in the field being typed into", () => {
    const { host, inspector } = setup(rect);
    const name = host.querySelector<HTMLInputElement>("[data-vigilia-name]")!;
    name.focus();
    expect(document.activeElement).toBe(name);

    inspector.render();

    // The field is React's now, so a re-publish updates it in place rather than
    // rebuilding it: the caret is kept by the element surviving, where the
    // imperative body had to put it back into a fresh element.
    const after = host.querySelector<HTMLInputElement>("[data-vigilia-name]")!;
    expect(after).toBe(name);
    expect(document.activeElement).toBe(after);
  });

  it("does not put focus back on a control that only toggles", () => {
    const { host, inspector } = setup(rect);
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
  });

  /**
   * A draft belongs to the object it was typed into.
   *
   * The imperative editor's queued blur was the reported defect: the author
   * typed a name, selected something else, and the blur that followed wrote the
   * abandoned draft where it no longer belonged. React's row identity is what
   * answers it now — a row keyed by field id alone would be reconciled onto the
   * next object still holding the previous one's draft — so each of the four
   * ways the described object can change gets its own case.
   */
  describe("a draft and the object it describes", () => {
    /** Two named rects and a selection a test can move between them. */
    function twoObjects(): {
      readonly a: Rect;
      readonly b: Rect;
      readonly select: (object: FabricObject | undefined) => void;
      readonly inspector: ReturnType<typeof setup>["inspector"];
      readonly host: HTMLElement;
      readonly history: ReturnType<typeof setup>["history"];
    } {
      const a = new Rect({ left: 0, top: 0, width: 40, height: 20 });
      a.set({ id: "obj-1", name: "Panel A" });
      const b = new Rect({ left: 60, top: 0, width: 40, height: 20 });
      b.set({ id: "obj-2", name: "Panel B" });
      let active: FabricObject | undefined = a;
      const built = setup(() => active);
      return {
        a,
        b,
        select: (object) => {
          active = object;
        },
        inspector: built.inspector,
        host: built.host,
        history: built.history,
      };
    }

    /** The draft in the name field, left uncommitted. */
    async function typedName(host: HTMLElement): Promise<HTMLInputElement> {
      const field = host.querySelector<HTMLInputElement>(
        "[data-vigilia-name]",
      )!;
      await draft(field, "Typed A");
      return field;
    }

    it("writes nothing when the selection moves to another object", async () => {
      const { a, b, select, inspector, host, history } = twoObjects();
      const field = await typedName(host);

      select(b);
      inspector.render();
      expect(
        host.querySelector<HTMLInputElement>("[data-vigilia-name]")?.value,
      ).toBe("Panel B");

      // The blur A's field was queued for now lands on an element that has left
      // the tree. Neither object took the draft.
      await act(async () => {
        field.blur();
      });
      expect(a.get("name")).toBe("Panel A");
      expect(b.get("name")).toBe("Panel B");
      expect(history.saveState).not.toHaveBeenCalled();
    });

    it("writes nothing when the selection is gone", async () => {
      // Deselected and deleted are one path here: the canvas reports no active
      // object either way, so the row leaves the tree the same way. What the
      // draft must not do is reach an object the panel no longer describes.
      const { a, select, inspector, host, history } = twoObjects();
      const field = await typedName(host);

      select(undefined);
      inspector.render();
      expect(host.querySelector("[data-vigilia-name]")).toBeNull();

      await act(async () => {
        field.blur();
      });
      expect(a.get("name")).toBe("Panel A");
      expect(history.saveState).not.toHaveBeenCalled();
    });

    it("writes nothing into the object an undo rebuilt under the same id", async () => {
      const { a, select, inspector, host, history } = twoObjects();
      const field = await typedName(host);

      // An undo hands back a *new* object carrying the same id, so an identity
      // taken from the id would reconcile the old row onto it.
      const rebuilt = new Rect({ left: 0, top: 0, width: 40, height: 20 });
      rebuilt.set({ id: a.get("id"), name: "Panel A" });
      select(rebuilt);
      inspector.render();
      expect(
        host.querySelector<HTMLInputElement>("[data-vigilia-name]")?.value,
      ).toBe("Panel A");

      await act(async () => {
        field.blur();
      });
      expect(rebuilt.get("name")).toBe("Panel A");
      expect(history.saveState).not.toHaveBeenCalled();
    });

    it("writes nothing when the object is locked between the draft and the blur", async () => {
      const { a, select, inspector, host, history } = twoObjects();
      const field = await typedName(host);

      // A locked object is offered no writing field at all, so the row is gone
      // by the time the blur would have committed.
      a.set("locked", true);
      select(a);
      inspector.render();
      expect(host.querySelector("[data-vigilia-name]")).toBeNull();

      await act(async () => {
        field.blur();
      });
      expect(a.get("name")).toBe("Panel A");
      expect(history.saveState).not.toHaveBeenCalled();
    });
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
    });

    expect(sections.map((section) => section.id)).toEqual([
      "content",
      "position",
      "layer",
      "paint",
      "spends",
    ]);
    expect(
      sections
        .filter((section) => section.defaultOpen)
        .map((section) => section.id),
    ).toEqual(["content", "layer", "paint", "spends"]);
    for (const section of sections) {
      // The count is every row the section renders — the fields and extras React
      // owns plus the body it does not — and the header's count has to agree.
      expect(section.count, section.id).toBe(
        section.fields.length + section.extras.length + section.body.length,
      );
    }
  });

  it("mounts a chart's own fields in the chart's own column", () => {
    // The seam the Data tab used to be. A chart's settings and bindings are
    // written by the chart manager, which hands the column the values to render
    // — in the Content and Paint sections, where the author already is.
    const chart = chartOf("gauge", defaultGaugeSettings);
    const target: ChartFieldTarget = {
      id: "cpu-gauge",
      content: { family: "gauge", settings: defaultGaugeSettings },
      bindings: [{ id: "b1", semanticKey: "cpu.load" }],
    };
    // Real values from the owner's own projection, so an extra that arrived
    // emptied would fail here rather than passing a shape check.
    const content = chartContentView(target);
    const paint = chartPaintView(target, undefined);
    const chartFields: ChartFieldsPort = {
      content: () => content,
      paint: () => paint,
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
      chartFields,
    });
    const section = (name: string) => {
      const found = sections.find((candidate) => candidate.id === name);
      if (found === undefined) throw new Error(`no ${name} section`);
      return found;
    };
    const kinds = (name: string): string[] =>
      section(name)
        .extras.filter(rendersExtra)
        .map((extra) => extra.kind);

    expect(kinds("content")).toEqual(["chartContent"]);
    expect(kinds("paint")).toEqual(["chartPaint"]);
    // The payload is the owner's own reading, not a reconstruction of it.
    expect(section("content").extras[0]).toEqual({
      kind: "chartContent",
      content,
    });
    expect(section("paint").extras[0]).toEqual({ kind: "chartPaint", paint });
    // Nowhere else: a chart's paint is not a content field, and the count over
    // each section is what tells the two apart when both are mounted. The
    // chart's own body counts once, however many controls it carries.
    for (const name of ["content", "paint"]) {
      expect(section(name).count, name).toBe(
        section(name).fields.length + 1 + section(name).body.length,
      );
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

  it("writes the authored box, and leaves the type at its preset's size", async () => {
    const text = caption();
    const { host, history } = setup(text);

    const width = host.querySelector<HTMLInputElement>(
      '[data-vigilia-geometry="width"]',
    )!;
    await edit(width, "220");
    const height = host.querySelector<HTMLInputElement>(
      '[data-vigilia-geometry="height"]',
    )!;
    await edit(height, "40");

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

  it("gives a whole box when only one Size field is filled in", async () => {
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
    await edit(height, "40");

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

  it("still scales a shape, whose width is a size rather than a box", async () => {
    // The same field, the other kind of object: a `Rect`'s width is a natural
    // size, and scaling is how it changes.
    const panel = new Rect({ left: 0, top: 0, width: 360, height: 200 });
    const { host } = setup(panel);

    const width = host.querySelector<HTMLInputElement>(
      '[data-vigilia-geometry="width"]',
    )!;
    await edit(width, "180");

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

    it.each(CONTAINERS)(
      "offers a %s no crop, and carries the bleed mark in its Position",
      (_kind, make) => {
        const { host } = setup(make());

        // A container is a selection like any other for the bleed mark: the
        // question is about an object's overhang, not about what it is made of.
        expect(host.querySelector("[data-vigilia-bleeds]")).not.toBeNull();
        // A crop is about an image's own frame, and a container has none — a
        // row that offered one would write a clip nothing there can hold.
        expect(host.querySelector("[data-vigilia-crop]")).toBeNull();
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
