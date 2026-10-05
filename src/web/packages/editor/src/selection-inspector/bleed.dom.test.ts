// @vitest-environment jsdom
import { objectBleeds, VIGILIA_BLEEDS_PROPERTY } from "@vigilia/renderer-core";
import { outsideCount } from "@vigilia/scene-fabric";
import { Circle, Rect } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { idleCrop } from "./idle-crop.test-stage.js";
import { createSelectionInspector } from "./index.js";

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

function tick(field: HTMLInputElement, checked: boolean): void {
  field.checked = checked;
  field.dispatchEvent(new Event("change"));
}

/** Straddling the right edge, so it is a crop unless something says otherwise. */
function straddling(): Rect {
  return new Rect({ id: "orb", left: 950, top: 100, width: 100, height: 100 });
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

    tick(field<HTMLInputElement>("[data-vigilia-bleeds]"), true);

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

    tick(field<HTMLInputElement>("[data-vigilia-bleeds]"), false);

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

    expect(field<HTMLInputElement>("[data-vigilia-bleeds]").checked).toBe(true);
    host.remove();
  });

  it("leaves an unmarked object unchecked", () => {
    const { host, field } = setup(straddling());

    expect(field<HTMLInputElement>("[data-vigilia-bleeds]").checked).toBe(
      false,
    );
    host.remove();
  });

  it("tells the shell the object changed, so the artboard count re-reads", () => {
    // The count lives in another panel and is recomputed on render. An edit
    // that did not announce itself would leave the figure beside the size
    // showing the number from before the mark — the control appearing to do
    // nothing on the surface that states it.
    const object = straddling();
    const { host, fire, field } = setup(object);

    tick(field<HTMLInputElement>("[data-vigilia-bleeds]"), true);

    expect(fire.mock.calls.map(([name]) => name)).toContain("object:modified");
    host.remove();
  });

  it("records one history entry per committed edit", () => {
    const object = straddling();
    const { host, history, field } = setup(object);
    const mark = field<HTMLInputElement>("[data-vigilia-bleeds]");

    tick(mark, true);
    tick(mark, false);

    expect(history.saveState).toHaveBeenCalledTimes(2);
    host.remove();
  });
});
