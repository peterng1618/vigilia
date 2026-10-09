// @vitest-environment jsdom
import { VIGILIA_PAINT_PROPERTY } from "@vigilia/scene-fabric";
import {
  Circle,
  Ellipse,
  Line,
  Path,
  Polygon,
  Polyline,
  Rect,
  Shadow,
  Textbox,
  Triangle,
} from "fabric/es";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createNewShape } from "../new-object-defaults.js";
import { uiCopy } from "../ui-copy.js";
import { createSelectionInspector } from "./index.js";
import { idleCrop } from "./idle-crop.test-stage.js";
// The shared React drivers: a converted field is a plan-1 control, so a raw
// `change` event no longer commits it — the picker is opened and an entry
// clicked, and a number is typed through React's own value tracker.
import { choose, flush, optionsOf } from "./runs.test-stage.js";

/**
 * React only flushes work scheduled inside `act` when it has been told it is in
 * a test; without this, the draft a plan-1 control holds lands after the blur
 * that should have committed it.
 */
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// Every `setup` attaches its host so a control can hold focus. The body is
// settled and then emptied between cases: `flush` lets a plan-1 select close
// its portal through React before the wipe detaches it, and emptying stops a
// stale popup's options from being found by the next case's global query.
afterEach(async () => {
  await flush();
  document.body.replaceChildren();
});

/** A palette with a solid surface, a solid content token and a gradient, so a
 * control that must refuse a gradient is offered one to refuse. */
const globals = {
  palette: {
    none: {
      name: "None",
      value: { kind: "solid", color: "transparent" },
    },
    background: {
      name: "Background",
      value: { kind: "solid", color: "#0c0e13" },
    },
    text: { name: "Text", value: { kind: "solid", color: "#ecf5ff" } },
    scene: {
      name: "Scene",
      value: {
        kind: "gradient",
        angle: 90,
        stops: [
          { offset: 0, color: "#355473" },
          { offset: 1, color: "#07111d" },
        ],
      },
    },
  },
} as never;

/** `others` is what else the canvas holds — the selection is `active`, and the
 *  paint pass is whole-canvas, so an edit to one object re-resolves all of
 *  them. That is why the shape of the *rest* of the scene decides whether an
 *  inspector edit is silent. */
function setup(active: unknown, others: readonly unknown[] = []) {
  const host = document.createElement("div");
  // Attached: a plan-1 control commits on blur, and jsdom fires a blur only for
  // an element that can hold focus — nothing is focusable while it is detached.
  document.body.append(host);
  const history = { saveState: vi.fn() };
  const editor = {
    canvas: {
      getActiveObject: () => active,
      getObjects: () =>
        active === undefined ? [...others] : [active, ...others],
      requestRenderAll: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    },
    historyManager: history,
    errorManager: { warn: vi.fn(), error: vi.fn() },
    cropManager: idleCrop(),
  };
  const inspector = createSelectionInspector(host, {
    editor: editor as never,
    globals,
    refreshGlass: vi.fn(),
  });
  const field = <T extends HTMLElement>(selector: string): T =>
    host.querySelector<T>(selector)!;
  return { host, history, editor, inspector, field };
}

function panel(): Rect {
  return new Rect({ id: "panel", left: 0, top: 0, width: 360, height: 200 });
}

/**
 * A draft in a plan-1 control, as React sees one. A converted field is a plan-1
 * control that holds its own draft and commits on blur, so it has to be driven
 * the way a person does — through the prototype's setter, because React
 * installs a value tracker that suppresses a plain assignment, then off the
 * field.
 */
async function edit(
  field: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): Promise<void> {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(field) as HTMLInputElement,
      "value",
    )?.set;
    if (setter === undefined) field.value = value;
    else setter.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  // Its own turn: a blur in the same turn as the draft reads it before React
  // has applied it.
  await act(async () => {
    field.focus();
    field.blur();
  });
}

/** Authored placement, as a value rather than a fresh literal: Fabric infers
    its options type from one, and the inferred type rejects the `id`. */
const PLACED = {
  id: "shape",
  left: 0,
  top: 0,
  originX: "left",
  originY: "top",
} as const;

const CORNERS = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 50, y: 100 },
] as const;

/** Every primitive the Add pane can insert, as a live selection. */
const SHAPES = [
  [
    "rect",
    () => new Rect({ ...PLACED, width: 360, height: 200, rx: 10, ry: 10 }),
  ],
  ["circle", () => new Circle({ ...PLACED, radius: 100 })],
  ["ellipse", () => new Ellipse({ ...PLACED, rx: 180, ry: 100 })],
  ["triangle", () => new Triangle({ ...PLACED, width: 360, height: 200 })],
  ["polygon", () => new Polygon([...CORNERS], PLACED)],
  ["polyline", () => new Polyline([...CORNERS], PLACED)],
  ["line", () => new Line([0, 0, 100, 50], PLACED)],
  ["path", () => new Path("M 0 0 L 100 0 L 0 50 Z", PLACED)],
  ["arc", () => createNewShape("arc", globals, "arc", { left: 0, top: 0 })],
  [
    "wedge",
    () => createNewShape("wedge", globals, "wedge", { left: 0, top: 0 }),
  ],
] as const;
describe("panel fields in the selection inspector", () => {
  it("offers fill, stroke, border width and corner radius for a panel", () => {
    const rect = panel();
    const { host } = setup(rect);
    // Non-vacuous: the selection must actually be a rectangle, or a gate that
    // refuses everything would satisfy the field assertions below.
    expect(rect).toBeInstanceOf(Rect);
    expect(host.querySelector("[data-vigilia-panel-fill]")).not.toBeNull();
    expect(host.querySelector("[data-vigilia-panel-stroke]")).not.toBeNull();
    // A number field is a plan-1 `ControlNumber`: a text input that takes a
    // decimal, not a native `<input type=number>`.
    expect(
      host.querySelector<HTMLInputElement>("[data-vigilia-panel-border]")
        ?.inputMode,
    ).toBe("decimal");
    expect(
      host.querySelector<HTMLInputElement>("[data-vigilia-panel-radius]")
        ?.inputMode,
    ).toBe("decimal");
  });

  it("names every panel control", () => {
    const rect = panel();
    rect.set({ shadow: new Shadow({ color: "#ecf5ff", blur: 8, offsetY: 4 }) });
    const { host } = setup(rect);
    for (const selector of [
      "[data-vigilia-panel-fill]",
      "[data-vigilia-panel-stroke]",
      "[data-vigilia-panel-border]",
      "[data-vigilia-panel-radius]",
      "[data-vigilia-panel-shadow]",
      "[data-vigilia-panel-shadow-blur]",
      "[data-vigilia-panel-shadow-offset]",
    ]) {
      const control = host.querySelector<HTMLElement>(selector)!;
      const name =
        host.querySelector<HTMLLabelElement>(`label[for="${control.id}"]`)
          ?.textContent ?? control.closest("label")?.textContent;
      expect(name, selector).toBeTruthy();
    }
  });

  it("writes a chosen fill token onto the object and its palette reference", async () => {
    const rect = panel();
    const { host, history } = setup(rect);

    await choose(host, "data-vigilia-panel-fill", "Text");

    // The resolved paint and the authored reference both move, so the panel
    // still follows the token after the next palette edit.
    expect(rect.fill).toBe("#ecf5ff");
    expect(rect.get(VIGILIA_PAINT_PROPERTY)).toEqual({ fill: "palette.text" });
    expect(history.saveState).toHaveBeenCalledTimes(1);
  });

  it("says so when an inspector edit refuses an arc elsewhere in the scene", async () => {
    // The pass this control runs is **whole-canvas**: it walks every object, so
    // editing a panel's fill re-refuses an arc on the far side of the scene.
    // It used to pass no reporter at all, so an author watching a figure
    // disappear because they had recoloured something else was told nothing.
    const arc = createNewShape("arc", globals, "arc", { left: 0, top: 0 });
    arc.set({ fill: "#ecf5ff" });
    arc.set(VIGILIA_PAINT_PROPERTY, { fill: "palette.text" });
    const rect = panel();
    const { host, editor } = setup(rect, [arc]);

    // Non-vacuous: the arc is one that refuses, so a reporter wired to nothing
    // could not satisfy this.
    expect(arc.fill, "the arc starts filled").toBe("#ecf5ff");

    await choose(host, "data-vigilia-panel-fill", "Text");

    expect(arc.fill, "the arc's fill is withheld").toBe("");
    expect(
      editor.errorManager.warn,
      "and the author is told the shell's own way",
    ).toHaveBeenCalledWith("paint", expect.stringMatching(/arc/i));
  });

  it("keeps the other references when one paint changes", async () => {
    const rect = panel();
    rect.set({
      [VIGILIA_PAINT_PROPERTY]: {
        fill: "palette.background",
        stroke: "palette.text",
        shadowColor: "palette.text",
      },
      shadow: new Shadow({ color: "#ecf5ff", blur: 8 }),
    });
    const { host } = setup(rect);

    await choose(host, "data-vigilia-panel-fill", "Text");

    // Palette identity is per property: choosing a fill must not silently
    // re-point the border or the shadow an author already set.
    expect(rect.get(VIGILIA_PAINT_PROPERTY)).toEqual({
      fill: "palette.text",
      stroke: "palette.text",
      shadowColor: "palette.text",
    });
  });

  it("clears the fill and its reference when the author picks none", async () => {
    const rect = panel();
    rect.set({
      fill: "#0c0e13",
      [VIGILIA_PAINT_PROPERTY]: { fill: "palette.background" },
    });
    const { host } = setup(rect);

    await choose(
      host,
      "data-vigilia-panel-fill",
      uiCopy.inspectorFields.notSet,
    );

    expect(rect.fill).toBe("");
    expect(rect.get(VIGILIA_PAINT_PROPERTY)).toEqual({});
  });

  it("sets the corner radius on both axes in one committed edit", async () => {
    const rect = panel();
    const { history, field } = setup(rect);

    await edit(field<HTMLInputElement>("[data-vigilia-panel-radius]"), "24");

    expect(rect.get("rx")).toBe(24);
    expect(rect.get("ry")).toBe(24);
    expect(history.saveState).toHaveBeenCalledTimes(1);
  });

  it("clamps a negative border width onto zero, because the bound is where it lands", async () => {
    const rect = panel();
    const { history, field } = setup(rect);
    const width = field<HTMLInputElement>("[data-vigilia-panel-border]");

    await edit(width, "-4");

    // Was a refusal, and the reasoning was that a clamp to zero "would look
    // identical on screen but lose the authored border". That is the finding
    // this pass overturned: the author typed -4 to find out what the bound is,
    // and reverting them to the old value teaches nothing. Landing on 0 says it.
    expect(rect.get("strokeWidth")).toBe(0);
    expect(width.value).toBe("0");
    expect(history.saveState).toHaveBeenCalledTimes(1);
  });

  it("refuses a fractional paint number rather than rounding it", async () => {
    const rect = panel();
    rect.set({ strokeWidth: 4, rx: 6, ry: 6 });
    rect.set("shadow", new Shadow({ color: "#ecf5ff", blur: 8 }));
    const { host, history } = setup(rect);

    // Every paint number the panel offers refused a fraction before its field
    // was converted — the old `numberField` demanded `Number.isInteger` — and
    // the converted control restates that as `integer`. The visible line is the
    // refusal; the write funnel re-checks the same rule, so a bypassed control
    // stores nothing either. Rounding would be a different act from displaying a
    // value a gesture left fractional.
    for (const selector of [
      "[data-vigilia-panel-border]",
      "[data-vigilia-panel-radius]",
      "[data-vigilia-panel-shadow-blur]",
    ]) {
      const box = host.querySelector<HTMLInputElement>(selector)!;
      await edit(box, "4.5");
      expect(
        host.querySelector(`[id="${box.id}-invalid"]`)?.textContent?.trim(),
        selector,
      ).toBeTruthy();
      // The draft is kept with its reason rather than restored to the old value:
      // plan-1's number holds a rejected draft, where the pre-plan field put the
      // old value back. Either way nothing fractional is stored.
      expect(box.value, selector).toBe("4.5");
    }

    expect(rect.get("strokeWidth")).toBe(4);
    expect(rect.get("rx")).toBe(6);
    expect((rect.get("shadow") as Shadow).blur).toBe(8);
    expect(history.saveState).not.toHaveBeenCalled();
  });

  it("refuses an emptied numeric field instead of reading it as zero", async () => {
    const rect = panel();
    rect.set({ rx: 18, ry: 18 });
    const { history, field } = setup(rect);
    const radius = field<HTMLInputElement>("[data-vigilia-panel-radius]");

    await edit(radius, "");

    // `Number("")` is 0, so an empty box must not become a zero radius.
    expect(rect.get("rx")).toBe(18);
    expect(history.saveState).not.toHaveBeenCalled();
  });

  it("offers only solid tokens for a shadow colour", async () => {
    const { host } = setup(panel());
    const names = await optionsOf(host, "data-vigilia-panel-shadow");

    expect(names).toContain("Text");
    // Fabric's Shadow colour is a string; the envelope refuses a gradient
    // reference rather than drawing one, so it must never be offered here.
    expect(names).not.toContain("Scene");
  });

  it("gives a chosen shadow token a real, offset, tunable shadow", async () => {
    const rect = panel();
    const { host, history } = setup(rect);

    await choose(host, "data-vigilia-panel-shadow", "Text");
    history.saveState.mockClear();

    const shadow = rect.get("shadow");
    expect(shadow).toBeInstanceOf(Shadow);
    // A colour alone paints nothing, so the committed edit must leave a shadow
    // the author can see and then tune — and one that falls below the panel
    // rather than glowing evenly around it.
    expect((shadow as Shadow).blur).toBeGreaterThan(0);
    expect((shadow as Shadow).color).toBe("#ecf5ff");
    expect((shadow as Shadow).offsetY).toBeGreaterThan(0);

    await edit(
      host.querySelector<HTMLInputElement>("[data-vigilia-panel-shadow-blur]")!,
      "24",
    );

    expect((rect.get("shadow") as Shadow).blur).toBe(24);
    expect(history.saveState).toHaveBeenCalledTimes(1);
  });

  it("moves the shadow down without touching its blur", async () => {
    const rect = panel();
    rect.set({
      [VIGILIA_PAINT_PROPERTY]: { shadowColor: "palette.text" },
      shadow: new Shadow({ color: "#ecf5ff", blur: 18, offsetY: 6 }),
    });
    const { field } = setup(rect);

    await edit(
      field<HTMLInputElement>("[data-vigilia-panel-shadow-offset]"),
      "12",
    );

    const shadow = rect.get("shadow") as Shadow;
    expect(shadow.offsetY).toBe(12);
    expect(shadow.blur).toBe(18);
  });

  it("accepts a negative offset, which an imported shadow may already carry", async () => {
    const rect = panel();
    rect.set({
      [VIGILIA_PAINT_PROPERTY]: { shadowColor: "palette.text" },
      shadow: new Shadow({ color: "#ecf5ff", blur: 8, offsetY: -6 }),
    });
    const { history, field } = setup(rect);
    const offset = field<HTMLInputElement>(
      "[data-vigilia-panel-shadow-offset]",
    );
    expect(offset.value).toBe("-6");

    await edit(offset, "-3");

    // A floor of zero would show the imported value and then refuse the same
    // value back, which is a control that contradicts itself.
    expect((rect.get("shadow") as Shadow).offsetY).toBe(-3);
    expect(history.saveState).toHaveBeenCalledTimes(1);
  });

  it("shows no shadow controls until a shadow exists", () => {
    const { host } = setup(panel());

    // A blur box over a panel with no shadow accepts an edit and applies none.
    expect(host.querySelector("[data-vigilia-panel-shadow-blur]")).toBeNull();
    expect(host.querySelector("[data-vigilia-panel-shadow-offset]")).toBeNull();
  });

  it("removes the shadow and its reference when the token is cleared", async () => {
    const rect = panel();
    rect.set({
      [VIGILIA_PAINT_PROPERTY]: {
        fill: "palette.background",
        shadowColor: "palette.text",
      },
      shadow: new Shadow({ color: "#ecf5ff", blur: 8 }),
    });
    const { host } = setup(rect);

    await choose(
      host,
      "data-vigilia-panel-shadow",
      uiCopy.inspectorFields.notSet,
    );

    expect(rect.get("shadow")).toBeNull();
    expect(rect.get(VIGILIA_PAINT_PROPERTY)).toEqual({
      fill: "palette.background",
    });
    expect(host.querySelector("[data-vigilia-panel-shadow-blur]")).toBeNull();
    expect(host.querySelector("[data-vigilia-panel-shadow-offset]")).toBeNull();
  });

  it("offers a selection that is not a panel no panel controls at all", () => {
    const text = new Textbox("Hi", { left: 0, top: 0, width: 40 });
    const { host } = setup(text);

    // A text object has no corner radius and no border; a control that cannot
    // apply is worse than an absent one.
    for (const selector of [
      "[data-vigilia-panel-fill]",
      "[data-vigilia-panel-stroke]",
      "[data-vigilia-panel-border]",
      "[data-vigilia-panel-radius]",
      "[data-vigilia-panel-shadow]",
    ]) {
      expect(host.querySelector(selector), selector).toBeNull();
    }
    // And the fields it does own are untouched by that gate.
    expect(host.querySelector("[data-vigilia-opacity]")).not.toBeNull();
  });

  it("disconnects the panel's controls when the selection moves under them", () => {
    const first = panel();
    const { host, history, editor, inspector } = setup(first);
    const fill = host.querySelector<HTMLElement>("[data-vigilia-panel-fill]")!;
    const second = panel();
    second.set("id", "second");
    (editor.canvas as { getActiveObject: () => unknown }).getActiveObject =
      () => second;

    // The republish a real selection change fires. React keys each row by the
    // revision it was projected from, so the control bound to `first` is
    // unmounted — an edit from it cannot reach the object the panel now
    // describes, and it cannot write to the one it has left.
    inspector.render();

    expect(first.get(VIGILIA_PAINT_PROPERTY)).toBeUndefined();
    expect(history.saveState).not.toHaveBeenCalled();
    expect(fill.isConnected).toBe(false);
    // And the column now describes the object that is actually selected.
    expect(
      host.querySelector<HTMLElement>("[data-vigilia-panel-fill]"),
    ).not.toBe(fill);
  });

  it("records no history for a selection that only redraws the panel", () => {
    const rect = panel();
    const host = document.createElement("div");
    const saveState = vi.fn();
    const inspector = createSelectionInspector(host, {
      editor: {
        canvas: {
          getActiveObject: () => rect,
          getObjects: () => [rect],
          requestRenderAll: vi.fn(),
          on: vi.fn(),
          off: vi.fn(),
        },
        historyManager: { saveState },
        errorManager: { warn: vi.fn(), error: vi.fn() },
        cropManager: idleCrop(),
      } as never,
      globals,
      refreshGlass: vi.fn(),
    });

    inspector.render();
    inspector.render();

    expect(saveState).not.toHaveBeenCalled();
  });
});

describe("shape material and a shape's own fields", () => {
  it.each(SHAPES)("offers the material fields for a %s", (kind, build) => {
    const { host } = setup(build());

    // Every one of these classes owns a fill, a stroke, a border width and a
    // shadow. Offering them for one kind only would leave a shape that can be
    // placed and not coloured.
    for (const selector of [
      "[data-vigilia-panel-border]",
      "[data-vigilia-panel-shadow]",
    ]) {
      expect(host.querySelector(selector), selector).not.toBeNull();
    }

    // One control on the paint, not two — and which property it writes is the
    // scene's own decision, from `paintPropertyFor`. An unfilled open shape
    // (a polyline, a line, an arc) is ink rather than fill, so it offers the
    // one labelled control; everything else offers Fill *and* Stroke, since a
    // closed shape legitimately paints either. `ink.dom.test.ts` is what
    // proves the unfilled case does not flood.
    const strokeOnly = kind === "arc";
    expect(
      host.querySelector("[data-vigilia-panel-fill]"),
      kind,
    ).not.toBeNull();
    expect(
      host.querySelector("[data-vigilia-panel-stroke]") !== null,
      kind,
    ).toBe(!strokeOnly);
  });

  it.each(SHAPES)(
    "offers a corner radius for a %s only when it is a rectangle",
    (kind, build) => {
      const { host } = setup(build());
      const radius = host.querySelector("[data-vigilia-panel-radius]");

      // A radius box over a shape Fabric gives no `rx` to would show `NaN` and
      // write a property the object does not read.
      expect(radius !== null, kind).toBe(kind === "rect");
    },
  );

  it.each(SHAPES)(
    "gives every material field on a %s an accessible name",
    (kind, build) => {
      const shape = build();
      shape.set(
        "shadow",
        new Shadow({ color: "#ecf5ff", blur: 8, offsetY: 4 }),
      );
      const { host } = setup(shape);

      // The converted surface carries each hook on the control a person
      // operates and emits no `.vigilia-field` at all, so the pre-conversion
      // selector matched nothing and this case stayed green on its `> 0` guard —
      // which cannot tell "every field" from "one field". Selecting by the
      // surface's own hooks is the re-point; naming every expected hook is the
      // guard the count never was.
      //
      // Every shape owns these. `stroke` is absent on an arc — its one paint
      // field already writes the stroke and is labelled `Ink` — and the corner
      // radius is a `Rect`'s alone.
      const expected = [
        "[data-vigilia-panel-fill]",
        "[data-vigilia-panel-border]",
        "[data-vigilia-panel-shadow]",
        "[data-vigilia-panel-shadow-blur]",
        "[data-vigilia-panel-shadow-offset]",
        "[data-vigilia-glass-enabled]",
        ...(kind === "arc" ? [] : ["[data-vigilia-panel-stroke]"]),
        ...(kind === "rect" ? ["[data-vigilia-panel-radius]"] : []),
      ];
      for (const hook of expected) {
        expect(host.querySelector(hook), `${kind}: ${hook}`).not.toBeNull();
      }
      // And nothing this shape must not have: a radius on a `Wedge` would read
      // back `NaN`.
      if (kind !== "rect") {
        expect(
          host.querySelector("[data-vigilia-panel-radius]"),
          kind,
        ).toBeNull();
      }

      for (const hook of expected) {
        const control = host.querySelector<HTMLElement>(hook)!;
        const name =
          host
            .querySelector<HTMLLabelElement>(`label[for="${control.id}"]`)
            ?.textContent?.trim() ??
          control.getAttribute("aria-labelledby") ??
          "";
        expect(name, `${kind}: ${control.outerHTML}`).toBeTruthy();
      }
    },
  );

  it("files a shape's material under Paint and its own geometry under Position", () => {
    const polygon = new Polygon([...CORNERS], PLACED);
    const { host, field } = setup(polygon);

    // Material is what ink; a side count is where and how big. A shape's own
    // fields are not a lesser selection, and they are not one section either.
    expect(
      field<HTMLElement>(
        '[data-vigilia-section="paint"] [data-vigilia-panel-fill]',
      ),
    ).not.toBeNull();
    expect(
      field<HTMLElement>(
        '[data-vigilia-section="position"] [data-vigilia-shape-sides]',
      ),
    ).not.toBeNull();
    expect(
      host.querySelector(
        '[data-vigilia-section="paint"] [data-vigilia-shape-sides]',
      ),
    ).toBeNull();
  });

  it("writes a chosen fill onto a shape that is not a rectangle", async () => {
    const triangle = new Triangle({ ...PLACED, width: 360, height: 200 });
    const { host, history } = setup(triangle);

    await choose(host, "data-vigilia-panel-fill", "Text");

    expect(triangle.fill).toBe("#ecf5ff");
    expect(triangle.get(VIGILIA_PAINT_PROPERTY)).toEqual({
      fill: "palette.text",
    });
    expect(history.saveState).toHaveBeenCalledTimes(1);
  });

  it("shows a polygon's own side count, and clamps a two-sided one onto three", async () => {
    const polygon = new Polygon([...CORNERS], PLACED);
    const { history, field } = setup(polygon);
    const sides = field<HTMLInputElement>("[data-vigilia-shape-sides]");
    expect(sides.value).toBe("3");

    await edit(sides, "2");

    // A two-sided polygon is not a repaired three-sided one by refusal: the
    // author typed 2 to find where the bound is, and landing on 3 says it.
    // Coercing silently was the complaint; reverting hid the same number.
    expect(polygon.points).toHaveLength(3);
    expect(sides.value).toBe("3");
    expect(history.saveState).toHaveBeenCalledTimes(1);
  });

  it("redraws a polygon with the side count the author asked for", async () => {
    const polygon = new Polygon([...CORNERS], {
      ...PLACED,
      left: 20,
      top: 30,
    });
    const { history, field } = setup(polygon);

    await edit(field<HTMLInputElement>("[data-vigilia-shape-sides]"), "6");

    expect(polygon.points).toHaveLength(6);
    // The box the author placed is theirs; only the corners move.
    expect(polygon.width).toBe(100);
    expect(polygon.height).toBe(100);
    expect(polygon.left).toBe(20);
    expect(polygon.top).toBe(30);
    expect(history.saveState).toHaveBeenCalledTimes(1);
  });

  it("shows a polyline's own points and writes back the ones typed", async () => {
    const polyline = new Polyline([...CORNERS], PLACED);
    const { history, field } = setup(polyline);
    const points = field<HTMLTextAreaElement>("[data-vigilia-shape-points]");

    expect(points.value).toBe("0, 0\n100, 0\n50, 100");

    await edit(points, "1, 2\n3, 4");

    expect(polyline.points).toEqual([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ]);
    expect(history.saveState).toHaveBeenCalledTimes(1);
  });

  it.each(["a, b", "1, 2, 3", "1, 2\nnot a point", "1, 2\n"])(
    "refuses %o as a polyline's points rather than reading it as zero",
    async (typed) => {
      const polyline = new Polyline([...CORNERS], PLACED);
      const before = polyline.points;
      const { history, editor, field } = setup(polyline);

      await edit(
        field<HTMLTextAreaElement>("[data-vigilia-shape-points]"),
        typed,
      );

      expect(polyline.points).toEqual(before);
      expect(history.saveState).not.toHaveBeenCalled();
      expect(editor.errorManager.warn).toHaveBeenCalled();
    },
  );

  it("moves a line from its own two endpoints", async () => {
    const line = new Line([0, 0, 100, 50], PLACED);
    const { history, field } = setup(line);

    await edit(
      field<HTMLInputElement>('[data-vigilia-shape-line="x2"]'),
      "200",
    );

    expect(line.x2).toBe(200);
    expect(line.x1).toBe(0);
    expect(line.width).toBe(200);
    expect(history.saveState).toHaveBeenCalledTimes(1);
  });

  it("shows a path's own data as editable path data", async () => {
    const path = new Path("M 0 0 L 100 0 L 0 50 Z", PLACED);
    const { history, field } = setup(path);
    const data = field<HTMLTextAreaElement>("[data-vigilia-shape-path]");

    expect(data.value).toBe("M 0 0 L 100 0 L 0 50 Z");

    await edit(data, "M 0 0 L 10 10");

    // Fabric's own parser is the one that reads it, and its normalised
    // commands are what the scene persists.
    expect(path.path).toEqual([
      ["M", 0, 0],
      ["L", 10, 10],
    ]);
    expect(history.saveState).toHaveBeenCalledTimes(1);
  });

  it.each(["not a path", "   ", "M 0 0"])(
    "refuses %o as a path rather than emptying the shape",
    async (typed) => {
      const path = new Path("M 0 0 L 100 0 L 0 50 Z", PLACED);
      const before = path.path;
      const { history, editor, field } = setup(path);
      const data = field<HTMLTextAreaElement>("[data-vigilia-shape-path]");

      await edit(data, typed);

      // A path Fabric cannot parse comes back empty, and a lone moveto has no
      // extent at all: either would replace a real shape with one nothing can
      // select or see.
      expect(path.path).toEqual(before);
      expect(data.value).toBe("M 0 0 L 100 0 L 0 50 Z");
      expect(history.saveState).not.toHaveBeenCalled();
      expect(editor.errorManager.warn).toHaveBeenCalled();
    },
  );
});

describe("a shape whose geometry the author retypes", () => {
  /**
   * Measured on the surface while drawing the device icons: a path sized to
   * 28 × 28 and then given 14 × 14 of new data drew **1 × 3 units**. Its
   * commands are absolute coordinates in its own space, so the scale the
   * earlier size wrote belonged to a drawing that no longer exists — and
   * insert-then-size-then-draw is the order every icon in a dashboard is built
   * in.
   */
  it("drops the scale the previous geometry left behind", async () => {
    const path = new Path("M 0 0 L 360 0 L 360 150 L 0 150 Z", {
      id: "icon",
      left: 100,
      top: 100,
    });
    path.set({ scaleX: 28 / 360, scaleY: 28 / 150 });
    const { host } = setup(path);

    const data = host.querySelector<HTMLTextAreaElement>(
      "[data-vigilia-shape-path]",
    )!;
    await edit(data, "M 7 7 L 21 7 L 21 21 L 7 21 Z");

    expect(path.scaleX).toBe(1);
    expect(path.scaleY).toBe(1);
    // 14 units of square data, drawn as 14 units.
    expect(path.width).toBeCloseTo(14, 1);
    expect(path.width * path.scaleX).toBeCloseTo(14, 1);
  });

  it("does the same for a polyline's points", async () => {
    const line = new Polyline(
      [
        { x: 0, y: 200 },
        { x: 360, y: 0 },
      ],
      { id: "spark", left: 0, top: 0 },
    );
    line.set({ scaleX: 0.5, scaleY: 0.5 });
    const { host } = setup(line);

    const points = host.querySelector<HTMLTextAreaElement>(
      "[data-vigilia-shape-points]",
    )!;
    await edit(points, "10, 20\n30, 40");

    expect(line.scaleX).toBe(1);
    expect(line.scaleY).toBe(1);
  });
});

/**
 * The failure mode the brief names: a kind the panel's gate does not admit is
 * inserted and cannot be shaped. Nothing errors — the object arrives, is
 * selectable, and simply has no fields — so these cases assert the fields are
 * *present*, and then that a typed angle reaches the object.
 */
describe("the angles of a swept shape", () => {
  const SWEPT = ["arc", "wedge"] as const;

  /**
   * Both angle fields share one `data-` name and are told apart by its value,
   * the way a line's four endpoint boxes already are: they are one kind of
   * number about one thing, so they are one selector with a key rather than two
   * unrelated names that could drift apart.
   */
  const ANGLE = {
    start: '[data-vigilia-shape-angle="startAngle"]',
    end: '[data-vigilia-shape-angle="endAngle"]',
  } as const;

  /** A new shape of a swept kind, narrowed to the class that owns the angles. */
  function swept(kind: (typeof SWEPT)[number]): Circle {
    return createNewShape(kind, globals, kind, {
      left: 0,
      top: 0,
    }) as Circle;
  }

  it.each(SWEPT)("offers a start and an end angle for a %s", (kind) => {
    const { host } = setup(swept(kind));

    expect(host.querySelector(ANGLE.start), kind).not.toBeNull();
    expect(host.querySelector(ANGLE.end), kind).not.toBeNull();
  });

  it.each(SWEPT)("writes a typed %s angle onto the object", async (kind) => {
    const shape = swept(kind);
    const { field, history } = setup(shape);

    await edit(field<HTMLInputElement>(ANGLE.end), "270");

    expect(shape.endAngle).toBe(270);
    expect(history.saveState).toHaveBeenCalled();
  });

  it("keeps offering the angles when the author sweeps a full turn", () => {
    // The gate is the class, never the current numbers. A circle's own defaults
    // are 0° and 360°, so a gate that asked "is this the default sweep?" would
    // take the fields away the moment an author closed an arc back up — and an
    // author whose controls vanish mid-edit has to reload to get them back.
    const shape = swept("arc");
    shape.set({ startAngle: 0, endAngle: 360 });
    const { host } = setup(shape);

    expect(host.querySelector(ANGLE.start)).not.toBeNull();
    expect(host.querySelector(ANGLE.end)).not.toBeNull();
  });

  it("offers no angle fields to a shape that carries no sweep", () => {
    // The converse guard. A rectangle owns no angles, and a control that wrote
    // one would write a property nothing on that object reads.
    const { host } = setup(
      new Rect({ ...PLACED, width: 360, height: 200, rx: 10, ry: 10 }),
    );

    expect(host.querySelector(ANGLE.start)).toBeNull();
    expect(host.querySelector(ANGLE.end)).toBeNull();
  });

  it("lands an angle past 360 on the bound rather than coercing it", async () => {
    // The bound teaches itself: `numberField` puts an out-of-range value on the
    // bound it crossed. What must never happen is a wrap — an angle of 450
    // drawn as 90 is a shape the author did not ask for and cannot see the
    // difference in.
    const shape = swept("wedge");
    const { field } = setup(shape);

    await edit(field<HTMLInputElement>(ANGLE.end), "450");

    expect(shape.endAngle).toBe(360);
  });

  it("refuses an emptied angle box rather than reading it as zero", async () => {
    const shape = swept("arc");
    shape.set("startAngle", 45);
    const { field, history } = setup(shape);

    await edit(field<HTMLInputElement>(ANGLE.start), "");

    // `Number("")` is 0, so an emptied box must leave the object alone rather
    // than snapping the sweep back to the top of the circle.
    expect(shape.startAngle).toBe(45);
    expect(history.saveState).not.toHaveBeenCalled();
  });
});
