// @vitest-environment jsdom
import { Rect } from "fabric/es";
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
  const inspector = createSelectionInspector(host, editor as never);
  return { inspector, host, history, editor };
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
