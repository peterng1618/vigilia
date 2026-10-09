// @vitest-environment jsdom
import { objectBleeds, VIGILIA_BLEEDS_PROPERTY } from "@vigilia/renderer-core";
import { outsideCount, sceneBoxesOf } from "@vigilia/scene-fabric";
import { Circle, Rect } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createArtboardPanel } from "../artboard-panel.js";
import { idleCrop } from "./idle-crop.test-stage.js";
import { createSelectionInspector } from "./index.js";

// The switch re-dispatches its click through a `PointerEvent` to carry modifier
// state, and jsdom has never had one.
window.PointerEvent ??= MouseEvent as never;
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The control that marks a crop as deliberate.
 *
 * The property is what every other surface reads — `sceneBoxesOf` builds the
 * box from it, `persist.ts` writes it, the envelope validator refuses anything
 * that is not exactly `true`. So these cases assert against
 * {@link objectBleeds} and against the **count** rather than against the
 * checkbox's own state, because a control whose box shows a mark the counting
 * does not honour would look finished and change nothing.
 */

const ARTBOARD = { width: 1000, height: 1000 };

function setup(active: unknown) {
  const host = document.createElement("div");
  const history = { saveState: vi.fn() };
  // `fire` is stubbed rather than omitted because the control announces the
  // edit on it before recording history; a canvas without it throws mid-handler
  // and the assertion after it fails for the wrong reason.
  const fire = vi.fn();
  const editor = {
    canvas: {
      getActiveObject: () => active,
      getObjects: () => (active === undefined ? [] : [active]),
      requestRenderAll: vi.fn(),
      fire,
      on: vi.fn(),
      off: vi.fn(),
    },
    historyManager: history,
    errorManager: { warn: vi.fn(), error: vi.fn() },
    cropManager: idleCrop(),
  };
  createSelectionInspector(host, {
    editor: editor as never,
    globals: { palette: {} } as never,
    refreshGlass: vi.fn(),
  });
  const field = <T extends HTMLElement>(selector: string): T =>
    host.querySelector<T>(selector)!;
  return { host, history, fire, editor, field };
}

/**
 * The bleeds control is a plan-1 `ControlToggle`: a `<button role="switch">`
 * whose state is `aria-checked`, flipped by a click. `tick` sets it to `checked`
 * rather than blindly clicking, so a test that asks for the state it is already
 * in records no history.
 */
function tick(field: HTMLElement, checked: boolean): void {
  const on = field.getAttribute("aria-checked") === "true";
  if (on === checked) return;
  act(() => {
    field.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  });
}

/**
 * One canvas's event surface, shared by the control and the panel.
 *
 * Fabric's own emitter reduced to the three methods the two surfaces use, so
 * the test exercises a real subscription rather than asserting that a stub was
 * called — the panel's `on` really receives the control's `fire`.
 */
function sharedCanvas(active: Rect): {
  getActiveObject(): Rect;
  getObjects(): readonly Rect[];
  requestRenderAll(): void;
  on(event: string, handler: () => void): void;
  off(event: string, handler: () => void): void;
  fire(event: string): void;
} {
  const handlers = new Map<string, Set<() => void>>();
  return {
    getActiveObject: () => active,
    getObjects: () => [active],
    requestRenderAll: () => {},
    on: (event, handler) => {
      const set = handlers.get(event) ?? new Set();
      set.add(handler);
      handlers.set(event, set);
    },
    off: (event, handler) => {
      handlers.get(event)?.delete(handler);
    },
    fire: (event) => {
      for (const handler of handlers.get(event) ?? []) handler();
    },
  };
}

/**
 * Straddling the right edge, so it is a crop unless something says otherwise.
 *
 * The origins are stated because Fabric revives `center` by default, which makes
 * `left` the middle rather than the near edge: at the default the box runs
 * 899.5…1000.5, and 1000.5 is *inside* the one-unit edge tolerance, so the shape
 * would read as fitting and this figure would never move. The same trap
 * `player/src/artboard-crop.test.ts` pins for a display.
 */
function straddling(): Rect {
  return new Rect({
    id: "orb",
    left: 950,
    top: 100,
    width: 100,
    height: 100,
    originX: "left",
    originY: "top",
  });
}

describe("marking a deliberate bleed in the inspector", () => {
  it("is offered for any selection, since any object can bleed", () => {
    // Deliberately not restricted by kind: the question is about an object's
    // overhang, not about what the object is. A circle and a rectangle have
    // the same answer here, so withholding the control by kind would teach a
    // rule the product does not have.
    for (const shape of [
      straddling(),
      new Circle({ id: "c", left: 950, top: 100, radius: 50 }),
    ]) {
      const { host } = setup(shape);
      expect(host.querySelector("[data-vigilia-bleeds]")).not.toBeNull();
      host.remove();
    }
  });

  it("marks the object, so the count no longer reports it", () => {
    const object = straddling();
    const { host, history, field } = setup(object);
    const box = {
      visible: true,
      bleeds: false,
      left: 950,
      top: 100,
      width: 100,
      height: 100,
      depth: 0,
    };

    expect(outsideCount([box], ARTBOARD).outside).toBe(1);

    tick(field<HTMLElement>("[data-vigilia-bleeds]"), true);

    expect(objectBleeds(object)).toBe(true);
    expect(history.saveState).toHaveBeenCalled();
    expect(
      outsideCount([{ ...box, bleeds: objectBleeds(object) }], ARTBOARD)
        .outside,
    ).toBe(0);
    host.remove();
  });

  it("removes the property outright when unmarked", () => {
    // Not `false`: a plain boolean would leave `vigiliaBleeds: false` on every
    // object an author ever unmarked, and a document nobody can read by eye.
    const object = straddling();
    object.set(VIGILIA_BLEEDS_PROPERTY, true);
    const { host, field } = setup(object);

    tick(field<HTMLElement>("[data-vigilia-bleeds]"), false);

    expect(object.get(VIGILIA_BLEEDS_PROPERTY)).toBeUndefined();
    expect(objectBleeds(object)).toBe(false);
    host.remove();
  });

  it("shows an author's existing mark when the object is selected", () => {
    // The reopened-document case. A mark the editor wrote once and did not show
    // on reopen would read as lost.
    const object = straddling();
    object.set(VIGILIA_BLEEDS_PROPERTY, true);
    const { host, field } = setup(object);

    expect(
      field<HTMLElement>("[data-vigilia-bleeds]").getAttribute("aria-checked"),
    ).toBe("true");
    host.remove();
  });

  it("leaves an unmarked object unchecked", () => {
    const { host, field } = setup(straddling());

    expect(
      field<HTMLElement>("[data-vigilia-bleeds]").getAttribute("aria-checked"),
    ).toBe("false");
    host.remove();
  });

  it("changes the figure the author reads, through the real control", () => {
    // **This test is the point, and it is here because the first version of it
    // was not.** That version asserted `fire("object:modified")` had been
    // called — the mechanism — under a name claiming the outcome. It passed
    // while the artboard panel, which had **no canvas subscription at all**,
    // went on printing "1 of 1 objects are now outside" after the author ticked
    // the box. The brief's promise, "marked, it is silent", held on the phone
    // and not in the editor.
    //
    // So this drives the whole path and reads the **number**: real control, real
    // property, real event, real subscription, real figure. If any link is
    // removed the note does not move, and this fails on the text.
    const object = straddling();
    const canvas = sharedCanvas(object);
    const host = document.createElement("div");
    const panelHost = document.createElement("div");
    const panel = createArtboardPanel(panelHost, undefined, vi.fn(), {
      sceneBoxes: () => sceneBoxesOf(canvas.getObjects() as never[]),
      canvasEvents: canvas,
    });
    panel.render({ width: 1000, height: 1000 });
    createSelectionInspector(host, {
      editor: {
        canvas,
        historyManager: { saveState: vi.fn() },
        errorManager: { warn: vi.fn(), error: vi.fn() },
        cropManager: idleCrop(),
      } as never,
      globals: { palette: {} } as never,
      refreshGlass: vi.fn(),
    });

    const note = (): string =>
      panelHost.querySelector("[data-vigilia-artboard-note]")?.textContent ??
      "";
    expect(note(), "an unmarked overhang is reported").toContain(
      "1 of 1 objects are now outside",
    );

    tick(host.querySelector<HTMLElement>("[data-vigilia-bleeds]")!, true);

    expect(objectBleeds(object)).toBe(true);
    expect(
      note(),
      "the figure the author reads has followed the mark",
    ).not.toContain("are now outside");

    // And back, so the checkbox is shown to be a control rather than a latch.
    tick(host.querySelector<HTMLElement>("[data-vigilia-bleeds]")!, false);

    expect(note()).toContain("1 of 1 objects are now outside");
    panel.destroy();
    host.remove();
  });

  it("records one history entry per committed edit", () => {
    const object = straddling();
    const { host, history, field } = setup(object);
    const mark = field<HTMLElement>("[data-vigilia-bleeds]");

    tick(mark, true);
    tick(mark, false);

    expect(history.saveState).toHaveBeenCalledTimes(2);
    host.remove();
  });
});
