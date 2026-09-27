// @vitest-environment jsdom
import { VIGILIA_PAINT_PROPERTY } from "@vigilia/scene-fabric";
import { Rect, Shadow, Textbox } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { createSelectionInspector } from "./index.js";

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

function setup(active: unknown) {
  const host = document.createElement("div");
  const history = { saveState: vi.fn() };
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
    refreshGlass: vi.fn(),
  });
  const field = <T extends HTMLElement>(selector: string): T =>
    host.querySelector<T>(selector)!;
  return { host, history, editor, field };
}

function panel(): Rect {
  return new Rect({ id: "panel", left: 0, top: 0, width: 360, height: 200 });
}

function pick(field: HTMLSelectElement, value: string): void {
  field.value = value;
  field.dispatchEvent(new Event("change"));
}

function type(field: HTMLInputElement, value: string): void {
  field.value = value;
  field.dispatchEvent(new Event("change"));
}

describe("panel fields in the selection inspector", () => {
  it("offers fill, stroke, border width and corner radius for a panel", () => {
    const rect = panel();
    const { host, field } = setup(rect);
    // Non-vacuous: the selection must actually be a rectangle, or a gate that
    // refuses everything would satisfy the field assertions below.
    expect(rect).toBeInstanceOf(Rect);
    expect(host.querySelector("[data-vigilia-panel-fill]")).not.toBeNull();
    expect(host.querySelector("[data-vigilia-panel-stroke]")).not.toBeNull();
    expect(field<HTMLInputElement>("[data-vigilia-panel-border]").type).toBe(
      "number",
    );
    expect(field<HTMLInputElement>("[data-vigilia-panel-radius]").type).toBe(
      "number",
    );
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

  it("writes a chosen fill token onto the object and its palette reference", () => {
    const rect = panel();
    const { history, field } = setup(rect);

    pick(field<HTMLSelectElement>("[data-vigilia-panel-fill]"), "palette.text");

    // The resolved paint and the authored reference both move, so the panel
    // still follows the token after the next palette edit.
    expect(rect.fill).toBe("#ecf5ff");
    expect(rect.get(VIGILIA_PAINT_PROPERTY)).toEqual({ fill: "palette.text" });
    expect(history.saveState).toHaveBeenCalledTimes(1);
  });

  it("keeps the other references when one paint changes", () => {
    const rect = panel();
    rect.set({
      [VIGILIA_PAINT_PROPERTY]: {
        fill: "palette.background",
        stroke: "palette.text",
        shadowColor: "palette.text",
      },
      shadow: new Shadow({ color: "#ecf5ff", blur: 8 }),
    });
    const { field } = setup(rect);

    pick(field<HTMLSelectElement>("[data-vigilia-panel-fill]"), "palette.text");

    // Palette identity is per property: choosing a fill must not silently
    // re-point the border or the shadow an author already set.
    expect(rect.get(VIGILIA_PAINT_PROPERTY)).toEqual({
      fill: "palette.text",
      stroke: "palette.text",
      shadowColor: "palette.text",
    });
  });

  it("clears the fill and its reference when the author picks none", () => {
    const rect = panel();
    rect.set({
      fill: "#0c0e13",
      [VIGILIA_PAINT_PROPERTY]: { fill: "palette.background" },
    });
    const { field } = setup(rect);

    pick(field<HTMLSelectElement>("[data-vigilia-panel-fill]"), "");

    expect(rect.fill).toBe("");
    expect(rect.get(VIGILIA_PAINT_PROPERTY)).toEqual({});
  });

  it("sets the corner radius on both axes in one committed edit", () => {
    const rect = panel();
    const { history, field } = setup(rect);

    type(field<HTMLInputElement>("[data-vigilia-panel-radius]"), "24");

    expect(rect.get("rx")).toBe(24);
    expect(rect.get("ry")).toBe(24);
    expect(history.saveState).toHaveBeenCalledTimes(1);
  });

  it("refuses a negative border width rather than clamping it", () => {
    const rect = panel();
    const { history, editor, field } = setup(rect);
    const width = field<HTMLInputElement>("[data-vigilia-panel-border]");
    const before = rect.get("strokeWidth");

    type(width, "-4");

    // The object's own width survives, and the field is put back to it. A
    // clamp to zero would look identical on screen but lose the authored
    // border the author never asked to change.
    expect(rect.get("strokeWidth")).toBe(before);
    expect(width.value).toBe(String(before));
    expect(history.saveState).not.toHaveBeenCalled();
    expect(editor.errorManager.warn).toHaveBeenCalled();
  });

  it("refuses an emptied numeric field instead of reading it as zero", () => {
    const rect = panel();
    rect.set({ rx: 18, ry: 18 });
    const { history, field } = setup(rect);
    const radius = field<HTMLInputElement>("[data-vigilia-panel-radius]");

    type(radius, "");

    // `Number("")` is 0, so an empty box must not become a zero radius.
    expect(rect.get("rx")).toBe(18);
    expect(history.saveState).not.toHaveBeenCalled();
  });

  it("offers only solid tokens for a shadow colour", () => {
    const { field } = setup(panel());
    const values = [
      ...field<HTMLSelectElement>("[data-vigilia-panel-shadow]").options,
    ].map((option) => option.value);

    expect(values).toContain("palette.text");
    // Fabric's Shadow colour is a string; the envelope refuses a gradient
    // reference rather than drawing one, so it must never be offered here.
    expect(values).not.toContain("palette.scene");
  });

  it("gives a chosen shadow token a real, offset, tunable shadow", () => {
    const rect = panel();
    const { history, field } = setup(rect);

    pick(
      field<HTMLSelectElement>("[data-vigilia-panel-shadow]"),
      "palette.text",
    );
    history.saveState.mockClear();

    const shadow = rect.get("shadow");
    expect(shadow).toBeInstanceOf(Shadow);
    // A colour alone paints nothing, so the committed edit must leave a shadow
    // the author can see and then tune — and one that falls below the panel
    // rather than glowing evenly around it.
    expect((shadow as Shadow).blur).toBeGreaterThan(0);
    expect((shadow as Shadow).color).toBe("#ecf5ff");
    expect((shadow as Shadow).offsetY).toBeGreaterThan(0);

    const blur = field<HTMLInputElement>("[data-vigilia-panel-shadow-blur]");
    type(blur, "24");

    expect((rect.get("shadow") as Shadow).blur).toBe(24);
    expect(history.saveState).toHaveBeenCalledTimes(1);
  });

  it("moves the shadow down without touching its blur", () => {
    const rect = panel();
    rect.set({
      [VIGILIA_PAINT_PROPERTY]: { shadowColor: "palette.text" },
      shadow: new Shadow({ color: "#ecf5ff", blur: 18, offsetY: 6 }),
    });
    const { field } = setup(rect);

    type(field<HTMLInputElement>("[data-vigilia-panel-shadow-offset]"), "12");

    const shadow = rect.get("shadow") as Shadow;
    expect(shadow.offsetY).toBe(12);
    expect(shadow.blur).toBe(18);
  });

  it("accepts a negative offset, which an imported shadow may already carry", () => {
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

    type(offset, "-3");

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

  it("removes the shadow and its reference when the token is cleared", () => {
    const rect = panel();
    rect.set({
      [VIGILIA_PAINT_PROPERTY]: {
        fill: "palette.background",
        shadowColor: "palette.text",
      },
      shadow: new Shadow({ color: "#ecf5ff", blur: 8 }),
    });
    const { host, field } = setup(rect);

    pick(field<HTMLSelectElement>("[data-vigilia-panel-shadow]"), "");

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

  it("refuses a field event for an object the panel no longer describes", () => {
    const first = panel();
    const { host, history, editor } = setup(first);
    const fill = host.querySelector<HTMLSelectElement>(
      "[data-vigilia-panel-fill]",
    )!;
    const second = panel();
    second.set("id", "second");
    (editor.canvas as { getActiveObject: () => unknown }).getActiveObject =
      () => second;

    pick(fill, "palette.text");

    // The first panel is no longer selected, so its fill must not change and
    // the edit must not be recorded against the current selection's history.
    expect(first.get(VIGILIA_PAINT_PROPERTY)).toBeUndefined();
    expect(history.saveState).not.toHaveBeenCalled();
    // And the panel now describes the object that is actually selected.
    expect(fill.isConnected).toBe(false);
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
      } as never,
      globals,
      refreshGlass: vi.fn(),
    });

    inspector.render();
    inspector.render();

    expect(saveState).not.toHaveBeenCalled();
  });
});
