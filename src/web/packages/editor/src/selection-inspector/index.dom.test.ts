// @vitest-environment jsdom
import { IText, Rect } from "fabric/es";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSelectionInspector } from "./index.js";

/** A canvas stub that answers selection and history like the editor's. */
function canvasWith(active: unknown) {
  return {
    getActiveObject: () => active,
    getObjects: () => (active === undefined ? [] : [active]),
    requestRenderAll: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  };
}

function setup(active: unknown) {
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
  });
  return { inspector, host, history, editor, revealTypePresets };
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
});
