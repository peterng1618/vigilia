// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultGaugeSettings, supportsGlass } from "@vigilia/renderer-core";
import { VIGILIA_PAINT_PROPERTY, VigiliaChart } from "@vigilia/scene-fabric";
import {
  ActiveSelection,
  Circle,
  Ellipse,
  FabricImage,
  Group,
  IText,
  Line,
  Path,
  Point,
  Polygon,
  Polyline,
  Rect,
  Text,
  Textbox,
  Triangle,
} from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { uiCopy } from "../ui-copy.js";
import { createSelectionInspector } from "./index.js";
import { supportsGlassControl } from "./glass.js";

const globals = {
  palette: {
    none: { name: "None", value: { kind: "solid", color: "transparent" } },
    panel: { name: "Panel", value: { kind: "solid", color: "#081523d9" } },
    frost: {
      name: "Frosted panel",
      value: { kind: "solid", color: "#0815234d" },
    },
  },
} as never;

/**
 * The kinds a published theme may carry `vigiliaGlass` on.
 *
 * `renderer-core` now exports the guard itself, so the control asks it rather
 * than keeping its own list. The **published schema** is that same list, and
 * `fabric-envelope-schema-sync.test.ts` fails if the two ever disagree, so the
 * schema is the independent check that the set is not silently re-spelled.
 */
interface PublishedSchema {
  readonly $defs: Record<
    string,
    Record<string, unknown> & {
      readonly properties?: Record<string, Record<string, unknown>>;
      readonly allOf?: readonly Record<string, unknown>[];
      readonly enum?: readonly string[];
    }
  >;
}

// The path is built from the string `import.meta.url` rather than from a
// `URL` object: under jsdom that object is jsdom's own class, which Node's
// `fileURLToPath` refuses as "not of scheme file".
const SCHEMA = JSON.parse(
  readFileSync(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../../../../../../schema/theme-document.schema.json",
    ),
    "utf8",
  ),
) as PublishedSchema;

const PUBLISHED_GLASS_TYPES: readonly string[] = (
  SCHEMA.$defs["fabricObject"]?.["allOf"]?.[0] as {
    readonly then: {
      readonly properties: { readonly type: { enum: string[] } };
    };
  }
).then.properties.type.enum;

/** The bound the schema publishes, which is the one the validator enforces. */
const PUBLISHED_BLUR_MAXIMUM = (
  SCHEMA.$defs["glassTreatment"]?.["properties"]?.["blurRadius"] as {
    readonly maximum: number;
  }
).maximum;

function setup(active: unknown) {
  const host = document.createElement("div");
  const history = { saveState: vi.fn() };
  const refreshGlass = vi.fn();
  const editor = {
    canvas: {
      getActiveObject: () => active,
      getObjects: () => (active === undefined ? [] : [active]),
      requestRenderAll: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    },
    historyManager: history,
    errorManager: { warn: vi.fn(), error: vi.fn() },
  };
  createSelectionInspector(host, {
    editor: editor as never,
    globals,
    refreshGlass,
  });
  const field = <T extends HTMLElement>(selector: string): T =>
    host.querySelector<T>(selector)!;
  return { host, history, refreshGlass, editor, field };
}

function panel(): Rect {
  return new Rect({ id: "panel", left: 0, top: 0, width: 360, height: 200 });
}

/** A panel as the Add pane makes it: the card surface it hands every new shape. */
function newPanel(): Rect {
  const rect = panel();
  rect.set(VIGILIA_PAINT_PROPERTY, { fill: "palette.panel" });
  rect.set("fill", "#081523d9");
  return rect;
}

function tick(field: HTMLInputElement, checked: boolean): void {
  field.checked = checked;
  field.dispatchEvent(new Event("change"));
}

function type(field: HTMLInputElement, value: string): void {
  field.value = value;
  field.dispatchEvent(new Event("change"));
}

/** The field's own invalid-input line, when it is showing. */
function alertIn(host: HTMLElement): Element | null {
  return host.querySelector(".vigilia-field [role='alert']");
}

/** A live object of every kind the editor can have selected. */
const LIVE_KIND: Readonly<Record<string, () => unknown>> = {
  Rect: () => panel(),
  Circle: () => new Circle({ left: 0, top: 0, radius: 20 }),
  Ellipse: () => new Ellipse({ left: 0, top: 0, rx: 20, ry: 12 }),
  Triangle: () => new Triangle({ left: 0, top: 0, width: 40, height: 40 }),
  Polygon: () =>
    new Polygon([new Point(0, -20), new Point(20, 20), new Point(-20, 20)]),
  Polyline: () =>
    new Polyline([new Point(0, 0), new Point(20, 20), new Point(40, 0)]),
  Line: () => new Line([0, 0, 20, 20]),
  Path: () => new Path("M 0 0 L 20 20 L 40 0"),
  Group: () => new Group([new Rect({ width: 40, height: 40 })]),
  ActiveSelection: () => new ActiveSelection([panel(), panel()]),
  Textbox: () => new Textbox("Hi", { left: 0, top: 0, width: 40 }),
  Text: () => new Text("Hi", { left: 0, top: 0 }),
  IText: () => new IText("Hi", { left: 0, top: 0 }),
  Image: () => new FabricImage("", { left: 0, top: 0, width: 40, height: 40 }),
  VigiliaChart: () =>
    new VigiliaChart({
      id: "chart",
      family: "gauge",
      width: 100,
      height: 100,
      settings: defaultGaugeSettings,
    }),
};

/** The kinds the treatment reaches, which is the owner's answer, not a list. */
const FROSTABLE: readonly string[] = [
  "Rect",
  "Circle",
  "Ellipse",
  "Triangle",
  "Polygon",
];

/**
 * The kinds a selection can be in that the treatment cannot reach, each one
 * here because it is a shape the editor really does offer a selection of.
 */
const UNFROSTABLE: readonly string[] = [
  "Polyline",
  "Path",
  "Line",
  "Textbox",
  "VigiliaChart",
];

/** What the author calls the kind, where that is not the class name. */
const SHOWN_AS: Readonly<Record<string, string>> = {
  VigiliaChart: "chart",
  Textbox: "Text",
};

/** The refused control, whether it is focusable, and the tooltip over it. */
function glassControl(host: HTMLElement): HTMLInputElement | null {
  return host.querySelector<HTMLInputElement>("[data-vigilia-glass-enabled]");
}

const popup = (): HTMLElement | null =>
  document.querySelector<HTMLElement>(".editor-shell-tooltip");

describe("the glass control in the selection inspector", () => {
  it("offers frosted glass with a blur radius, both named", () => {
    const { host, field } = setup(panel());
    const enabled = field<HTMLInputElement>("[data-vigilia-glass-enabled]");
    // Non-vacuous: the selection really is a rectangle, so a gate that refused
    // everything cannot satisfy the control assertions below.
    expect(panel()).toBeInstanceOf(Rect);
    expect(enabled.type).toBe("checkbox");
    expect(host.querySelector("[data-vigilia-glass-blur]")).toBeNull();

    tick(enabled, true);

    const blur = field<HTMLInputElement>("[data-vigilia-glass-blur]");
    expect(blur.type).toBe("number");
    expect(blur.min).toBe("0");
    for (const selector of [
      "[data-vigilia-glass-enabled]",
      "[data-vigilia-glass-blur]",
    ]) {
      const control = host.querySelector<HTMLElement>(selector)!;
      const name =
        host.querySelector<HTMLLabelElement>(`label[for="${control.id}"]`)
          ?.textContent ?? control.closest("label")?.textContent;
      expect(name, selector).toBeTruthy();
    }
  });

  it("writes the treatment and tells the glass lifecycle when it is enabled", () => {
    const rect = panel();
    const { history, refreshGlass, field } = setup(rect);

    tick(field<HTMLInputElement>("[data-vigilia-glass-enabled]"), true);

    // The authored property is the only place a radius exists.
    expect(rect.get("vigiliaGlass")).toEqual({
      blurRadius: expect.any(Number),
    });
    // Nothing re-resolves the glass lifecycle on its own, so the control is
    // what has to ask; without this call the blur never appears on screen.
    expect(refreshGlass).toHaveBeenCalledTimes(1);
    expect(history.saveState).toHaveBeenCalledTimes(1);
  });

  it("removes the treatment when the author turns it off", () => {
    const rect = panel();
    rect.set("vigiliaGlass", { blurRadius: 12 });
    const { history, refreshGlass, host, field } = setup(rect);

    expect(host.querySelector("[data-vigilia-glass-blur]")).not.toBeNull();

    tick(field<HTMLInputElement>("[data-vigilia-glass-enabled]"), false);

    expect(rect.get("vigiliaGlass")).toBeUndefined();
    expect(refreshGlass).toHaveBeenCalledTimes(1);
    expect(history.saveState).toHaveBeenCalledTimes(1);
    // A radius box over a panel with no treatment accepts an edit and applies
    // none, so it goes with the treatment.
    expect(host.querySelector("[data-vigilia-glass-blur]")).toBeNull();
  });

  it("reads back the radius an author already set", () => {
    const rect = panel();
    rect.set("vigiliaGlass", { blurRadius: 24 });
    const { field } = setup(rect);

    expect(field<HTMLInputElement>("[data-vigilia-glass-blur]").value).toBe(
      "24",
    );
  });

  it("moves the blur radius and refreshes the composite", () => {
    const rect = panel();
    rect.set("vigiliaGlass", { blurRadius: 8 });
    const { history, refreshGlass, field } = setup(rect);

    type(field<HTMLInputElement>("[data-vigilia-glass-blur]"), "32");

    expect(rect.get("vigiliaGlass")).toEqual({ blurRadius: 32 });
    expect(refreshGlass).toHaveBeenCalledTimes(1);
    expect(history.saveState).toHaveBeenCalledTimes(1);
  });

  it("accepts zero blur, which is a treatment with no blur", () => {
    const rect = panel();
    rect.set("vigiliaGlass", { blurRadius: 8 });
    const { history, field } = setup(rect);

    type(field<HTMLInputElement>("[data-vigilia-glass-blur]"), "0");

    expect(rect.get("vigiliaGlass")).toEqual({ blurRadius: 0 });
    expect(history.saveState).toHaveBeenCalledTimes(1);
  });

  it("lands a radius past the published bound on it, because landing teaches it", () => {
    const bound = PUBLISHED_BLUR_MAXIMUM;
    const rect = panel();
    rect.set("vigiliaGlass", { blurRadius: 12 });
    const { host, history, field } = setup(rect);
    const blur = field<HTMLInputElement>("[data-vigilia-glass-blur]");

    // The field asks the owner for the ceiling rather than restating it, so the
    // number below is the schema's and the field's own bound cannot drift from
    // it. Asserted against the published schema rather than against a constant
    // imported here, because a test that reads the same constant as the code
    // proves only that they are both 48.
    expect(blur.max).toBe(String(bound));

    type(blur, "60");

    // Not a refusal. The finding was "took me a while to figure out blur only
    // accepts 48 maximum": a field that reverted to 12 taught nothing about
    // where the maximum is, and the slider that teaches it needs both bounds.
    expect(rect.get("vigiliaGlass")).toEqual({ blurRadius: bound });
    expect(history.saveState).toHaveBeenCalledTimes(1);

    // Re-read: the accepted edit re-rendered the panel, so the element the
    // commit belonged to is detached and holds no authority.
    const afterCommit = host.querySelector<HTMLInputElement>(
      "[data-vigilia-glass-blur]",
    )!;
    expect(afterCommit.value).toBe(String(bound));
    // And the slider the bound exists to enable, beside the box it moves.
    const range = afterCommit.parentElement?.querySelector<HTMLInputElement>(
      "input[type='range']",
    );
    expect(range).not.toBeNull();
    expect(range?.min).toBe("0");
    expect(range?.max).toBe(String(bound));
    expect(afterCommit.parentElement?.textContent).toContain(`0–${bound}`);
  });

  it("refuses an emptied radius rather than coercing it to the bound", () => {
    const rect = panel();
    rect.set("vigiliaGlass", { blurRadius: 12 });
    const { history, field, editor } = setup(rect);

    // The bound does not swallow this: `Number("")` is 0, which is a real
    // radius, so coercing it would silently mean "no blur" and look like it
    // was refused. The field still has to tell them apart.
    type(field<HTMLInputElement>("[data-vigilia-glass-blur]"), "");

    expect(rect.get("vigiliaGlass")).toEqual({ blurRadius: 12 });
    expect(history.saveState).not.toHaveBeenCalled();
    expect(editor.errorManager.warn).toHaveBeenCalled();
  });

  it("says nothing when a stale event is refused, because nothing was wrong", () => {
    const first = panel();
    first.set("vigiliaGlass", { blurRadius: 12 });
    const { host, history, editor } = setup(first);
    const blur = host.querySelector<HTMLInputElement>(
      "[data-vigilia-glass-blur]",
    )!;
    const second = panel();
    second.set("id", "second");
    (editor.canvas as { getActiveObject: () => unknown }).getActiveObject =
      () => second;

    type(blur, "30");

    // The field belonged to a selection that is gone. Reporting "that value
    // cannot be applied" would blame the author's number for a selection
    // change, which is the one thing here that is not the number's fault.
    expect(first.get("vigiliaGlass")).toEqual({ blurRadius: 12 });
    expect(history.saveState).not.toHaveBeenCalled();
    expect(editor.errorManager.warn).not.toHaveBeenCalled();
    expect(alertIn(host)).toBeNull();
  });

  it("refuses an emptied radius, which is not a number at all", () => {
    const rect = panel();
    rect.set("vigiliaGlass", { blurRadius: 12 });
    const { history, field } = setup(rect);
    const blur = field<HTMLInputElement>("[data-vigilia-glass-blur]");

    // `Number("")` is 0, so coercing an empty box would silently mean "no blur".
    // That is a different mistake from a number that is merely out of range,
    // and the field still has to tell them apart.
    type(blur, "");

    expect(rect.get("vigiliaGlass")).toEqual({ blurRadius: 12 });
    expect(blur.value).toBe("12");
    expect(history.saveState).not.toHaveBeenCalled();
  });

  it("clamps a radius past the bound onto it, because landing on it teaches it", () => {
    const rect = panel();
    rect.set("vigiliaGlass", { blurRadius: 12 });
    const { history, field } = setup(rect);
    const blur = field<HTMLInputElement>("[data-vigilia-glass-blur]");

    // Not a refusal: reverting to the old value is what made the bound
    // undiscoverable, and an author typing 60 to find the maximum is exactly
    // who this change is for.
    type(blur, "-6");

    expect(rect.get("vigiliaGlass")).toEqual({ blurRadius: 0 });
    expect(blur.value).toBe("0");
    expect(history.saveState).toHaveBeenCalledTimes(1);
  });

  it("refuses a glass edit for an object the panel no longer describes", () => {
    const first = panel();
    const { host, history, refreshGlass, editor } = setup(first);
    const enabled = host.querySelector<HTMLInputElement>(
      "[data-vigilia-glass-enabled]",
    )!;
    const second = panel();
    second.set("id", "second");
    (editor.canvas as { getActiveObject: () => unknown }).getActiveObject =
      () => second;

    tick(enabled, true);

    expect(first.get("vigiliaGlass")).toBeUndefined();
    expect(history.saveState).not.toHaveBeenCalled();
    expect(refreshGlass).not.toHaveBeenCalled();
    expect(enabled.isConnected).toBe(false);
  });

  it("offers a selection that cannot carry glass a disabled control that says why", () => {
    // The finding this control exists to close: a `Circle` — or, before the
    // widening, any shape the editor had not been taught — arrived with no
    // control at all, so the rule was something an author could only infer from
    // an absence.
    const text = new Textbox("Hi", { left: 0, top: 0, width: 40 });
    const { host } = setup(text);
    const control = glassControl(host);

    expect(control).not.toBeNull();
    expect(control?.getAttribute("aria-disabled")).toBe("true");
    // Not `disabled`: that would put it out of the tab order and make the
    // reason below a disclosure only a pointer could reach.
    expect(control?.hasAttribute("disabled")).toBe(false);
    expect(control?.disabled).toBe(false);
    // A radius box over an object with no treatment accepts an edit and applies
    // none, so it stays out.
    expect(host.querySelector("[data-vigilia-glass-blur]")).toBeNull();
    // And the fields the editor does serve for it are untouched by the refusal.
    expect(host.querySelector("[data-vigilia-opacity]")).not.toBeNull();
  });

  it.each(FROSTABLE)("offers the control enabled on a %s", (kind) => {
    const make = LIVE_KIND[kind];
    expect(typeof make, `${kind} has no live object`).toBe("function");
    if (make === undefined) return;
    const { host } = setup(make());

    const control = glassControl(host);
    expect(control, kind).not.toBeNull();
    expect(control?.getAttribute("aria-disabled"), kind).toBeNull();
    expect(control?.disabled, kind).toBe(false);
    expect(control?.checked, kind).toBe(false);
  });

  it.each(UNFROSTABLE)("offers the control disabled on a %s", (kind) => {
    const make = LIVE_KIND[kind];
    expect(typeof make, `${kind} has no live object`).toBe("function");
    if (make === undefined) return;
    const { host } = setup(make());

    const control = glassControl(host);
    expect(control, kind).not.toBeNull();
    expect(control?.getAttribute("aria-disabled"), kind).toBe("true");
  });

  it("takes no edit on a refused control, and says nothing about the refusal", () => {
    // The refusal is the control's reason, not an error: the author did nothing
    // wrong, so an alert line beside a control they cannot operate would blame
    // them for the editor's decision.
    const line = new Line([0, 0, 20, 20]);
    const { history, refreshGlass, editor, host, field } = setup(line);

    tick(field<HTMLInputElement>("[data-vigilia-glass-enabled]"), true);

    expect(line.get("vigiliaGlass")).toBeUndefined();
    // Put back, so the box does not claim a treatment the object does not have.
    expect(
      field<HTMLInputElement>("[data-vigilia-glass-enabled]").checked,
    ).toBe(false);
    expect(history.saveState).not.toHaveBeenCalled();
    expect(refreshGlass).not.toHaveBeenCalled();
    expect(editor.errorManager.warn).not.toHaveBeenCalled();
    expect(alertIn(host)).toBeNull();
  });

  it.each(UNFROSTABLE)(
    "names the %s it cannot frost, rather than one generic sentence",
    (kind) => {
      const make = LIVE_KIND[kind];
      expect(typeof make, `${kind} has no live object`).toBe("function");
      if (make === undefined) return;
      const { host } = setup(make());

      const control = glassControl(host)!;
      control.dispatchEvent(new Event("focus"));

      const reason = popup()?.textContent ?? "";
      control.dispatchEvent(new Event("blur"));
      // The name the author selected is in it: "glass applies to panels" tells
      // an author nothing they can act on.
      expect(reason, kind).toContain(SHOWN_AS[kind] ?? kind);
      expect(reason, kind).not.toBe(
        uiCopy.inspectorFields.glassRefused("__not a shape__"),
      );
    },
  );

  it("reaches a refused control's reason by hovering, not only by focusing", () => {
    // A disclosure only the keyboard can reach is the same defect as one only a
    // mouse can reach, in the other direction. Asserted on hover alone, so it
    // cannot pass because focus happens to work — the finding was that hover
    // fired its event and still showed nothing.
    vi.useFakeTimers();
    const path = new Path("M 0 0 L 20 20 L 40 0");
    const { host } = setup(path);
    const control = glassControl(host)!;

    control.dispatchEvent(new Event("pointerenter"));
    vi.advanceTimersByTime(700);

    expect(popup()?.textContent).toBe(
      uiCopy.inspectorFields.glassRefused("Path"),
    );
    expect(control.getAttribute("aria-describedby")).toBe(popup()?.id);

    control.dispatchEvent(new Event("pointerleave"));
    expect(popup()).toBeNull();
    vi.useRealTimers();
  });

  it("reaches a refused control's reason with no mouse", () => {
    // A `disabled` checkbox is out of the tab order, so the same tooltip would
    // reach nobody who was not holding a pointer — the absence it replaces, in
    // a form that now looks deliberate. Focus is the keyboard path, and it is
    // the only one this asserts.
    const path = new Path("M 0 0 L 20 20 L 40 0");
    const { host } = setup(path);
    const control = glassControl(host)!;

    expect(control.tabIndex).toBeGreaterThanOrEqual(0);
    control.dispatchEvent(new Event("focus"));

    const reason = popup();
    expect(reason?.textContent).toBe(
      uiCopy.inspectorFields.glassRefused("Path"),
    );
    // And it is described to whatever announces the control, not only drawn.
    expect(control.getAttribute("aria-describedby")).toBe(reason?.id);

    control.dispatchEvent(new Event("blur"));
    expect(popup()).toBeNull();
    expect(control.hasAttribute("aria-describedby")).toBe(false);
  });

  it("withholds glass from a locked object, which the editor refuses to write", () => {
    const rect = panel();
    rect.set("locked", true);
    const { host } = setup(rect);

    expect(host.querySelector("[data-vigilia-glass-enabled]")).toBeNull();
    expect(host.querySelector("[data-vigilia-panel-fill]")).toBeNull();
  });

  it("gives a new card the frosted surface, not the opaque one", () => {
    // The control named for glass did not carry it. A card the author frosted
    // kept `panel` at 85 % — opaque enough that the blur beneath it is a blur of
    // nothing, so the card read as a tint over a smooth gradient and the
    // photograph behind it was one select away in a control called "Fill".
    const rect = newPanel();
    const { history, refreshGlass, field } = setup(rect);

    tick(field<HTMLInputElement>("[data-vigilia-glass-enabled]"), true);

    expect(rect.get(VIGILIA_PAINT_PROPERTY)).toEqual({
      fill: "palette.frost",
    });
    // Resolved, not only referenced: a reference nothing re-resolves would leave
    // the card painted in the colour it had a frame earlier.
    expect(rect.get("fill")).toBe("#0815234d");
    // The treatment and the surface are one edit, so one undo takes both back.
    expect(history.saveState).toHaveBeenCalledTimes(1);
    expect(refreshGlass).toHaveBeenCalledTimes(1);
  });

  it("shows the frosted surface in the fill picker, not only on the canvas", () => {
    const { host, field } = setup(newPanel());

    tick(field<HTMLInputElement>("[data-vigilia-glass-enabled]"), true);

    expect(
      host.querySelector<HTMLSelectElement>("[data-vigilia-panel-fill]")?.value,
    ).toBe("palette.frost");
  });

  it("leaves a fill the author chose, because glass is not the author", () => {
    // The other half of the rule: a token the author picked in the Fill picker
    // is a choice, and a treatment layered over it must not overwrite it. There
    // is no record of which hand set a reference, so the current card default is
    // the only honest test for "a default" — and anything else is left alone.
    const rect = newPanel();
    rect.set(VIGILIA_PAINT_PROPERTY, { fill: "palette.none" });
    const { history, field } = setup(rect);

    tick(field<HTMLInputElement>("[data-vigilia-glass-enabled]"), true);

    expect(rect.get("vigiliaGlass")).toEqual({
      blurRadius: expect.any(Number),
    });
    expect(rect.get(VIGILIA_PAINT_PROPERTY)).toEqual({ fill: "palette.none" });
    expect(history.saveState).toHaveBeenCalledTimes(1);
  });

  it("leaves a card that already carries the frosted surface alone", () => {
    const rect = newPanel();
    rect.set(VIGILIA_PAINT_PROPERTY, { fill: "palette.frost" });
    const { field } = setup(rect);

    tick(field<HTMLInputElement>("[data-vigilia-glass-enabled]"), true);

    expect(rect.get(VIGILIA_PAINT_PROPERTY)).toEqual({ fill: "palette.frost" });
  });

  it("does not put a surface on a shape the treatment cannot reach", () => {
    // A group is in the owner's set and the renderer still refuses it: Fabric
    // overrides `Group.drawObject`, so a group never fires `before:render` and
    // `scene-fabric/src/glass.ts` refuses the treatment at attach. Enabling it
    // here would take an edit that paints nothing, so it is refused with the
    // reason instead — and an edit through it still writes nothing.
    const group = new Group([new Rect({ width: 40, height: 40 })]);
    const { history, refreshGlass, host, field } = setup(group);

    expect(glassControl(host)?.getAttribute("aria-disabled")).toBe("true");

    tick(field<HTMLInputElement>("[data-vigilia-glass-enabled]"), true);

    expect(group.get("vigiliaGlass")).toBeUndefined();
    expect(group.get(VIGILIA_PAINT_PROPERTY)).toBeUndefined();
    expect(history.saveState).not.toHaveBeenCalled();
    expect(refreshGlass).not.toHaveBeenCalled();
  });

  it("agrees with the owner's guard for every kind Fabric ships", () => {
    /**
     * The regression test for the second owner. `fed6dc3` spelled the set out
     * as an `instanceof` chain, which agrees with `GLASS_OBJECT_TYPES` only
     * until someone adds a kind there — and then a shape is frostable in a
     * theme and un-authorable in the inspector, with no error anywhere. The
     * predicate now asks, so this is the guard that has to notice if it stops.
     */
    const disagrees: string[] = [];
    for (const [kind, make] of Object.entries(LIVE_KIND)) {
      if (supportsGlassControl(make() as never) !== supportsGlass(kind))
        disagrees.push(kind);
    }

    // `Group` alone, and named: it is the one kind the owner admits that this
    // renderer cannot composite. Listing the disagreement rather than excluding
    // it is what keeps it from being the first kind quietly left out of the
    // next widening — and its reason has to say what to do instead.
    expect(disagrees).toEqual(["Group"]);
    expect(uiCopy.inspectorFields.glassRefused("Group")).toMatch(
      /panel inside/,
    );
  });

  it("has a live object for every kind the published schema allows", () => {
    for (const type of PUBLISHED_GLASS_TYPES)
      expect(typeof LIVE_KIND[type], `${type} has no live object`).toBe(
        "function",
      );
  });

  it("offers every kind the schema allows, so none is left un-authorable", () => {
    /**
     * The gap the controller ruled on: a kind the published schema lets carry
     * `vigiliaGlass` but the inspector gives no control for. Every kind gets
     * one now — enabled, or refused with its own reason — so a kind added to
     * the vocabulary cannot reopen the gap silently.
     */
    for (const type of PUBLISHED_GLASS_TYPES) {
      const make = LIVE_KIND[type];
      // Named first: a kind added to the vocabulary with no live object here
      // has no authoring decision either, and must not pass silently.
      expect(
        typeof make,
        `${type} is in the published schema with no live object`,
      ).toBe("function");
      if (make === undefined) continue;

      const { host } = setup(make());

      expect(glassControl(host), `${type} has no glass control`).not.toBeNull();
    }
  });
});
