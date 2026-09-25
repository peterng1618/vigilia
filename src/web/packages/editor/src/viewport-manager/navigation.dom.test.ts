// @vitest-environment jsdom
import { Canvas } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { bindViewportNavigation } from "./navigation.js";

function setup() {
  const host = document.createElement("div");
  Object.defineProperties(host, {
    clientWidth: { value: 1000 },
    clientHeight: { value: 800 },
  });
  const canvas = new Canvas(document.createElement("canvas"));
  const viewport = {
    zoom: () => 1,
    zoomToPoint: vi.fn(),
    zoomBy: vi.fn(),
    zoomToFit: vi.fn(),
    zoomToSelection: vi.fn(),
    reset: vi.fn(),
    panBy: vi.fn(),
    resize: vi.fn(),
    // Declared by Task 1's ViewportManager; navigation does not call it, but the
    // stub has to satisfy the interface or this call does not compile.
    onChange: vi.fn(() => (): void => undefined),
    destroy: vi.fn(),
  };
  const unbind = bindViewportNavigation({ canvas, viewport });
  return { canvas, viewport, unbind };
}

describe("viewport navigation", () => {
  it("pans vertically on a wheel", () => {
    const { canvas, viewport } = setup();
    canvas.upperCanvasEl.dispatchEvent(
      new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true }),
    );
    expect(viewport.panBy).toHaveBeenCalledWith(0, -100);
    expect(viewport.zoomToPoint).not.toHaveBeenCalled();
  });

  it("pans horizontally on a shifted wheel", () => {
    const { canvas, viewport } = setup();
    canvas.upperCanvasEl.dispatchEvent(
      new WheelEvent("wheel", {
        deltaY: 100,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(viewport.panBy).toHaveBeenCalledWith(-100, 0);
  });

  it("zooms about the pointer on a ctrl-wheel", () => {
    const { canvas, viewport } = setup();
    canvas.upperCanvasEl.dispatchEvent(
      new WheelEvent("wheel", {
        deltaY: -100,
        ctrlKey: true,
        clientX: 40,
        clientY: 50,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(viewport.zoomToPoint).toHaveBeenCalled();
    expect(viewport.panBy).not.toHaveBeenCalled();
  });

  it("pans on a space-drag and stops on release", () => {
    const { canvas, viewport } = setup();
    // The brief requires the grab affordance, and a pan must not select: with
    // target find still on, the same press would drag the object underneath.
    expect(canvas.skipTargetFind).toBe(false);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    expect(canvas.upperCanvasEl.style.cursor).toBe("grab");
    expect(canvas.skipTargetFind).toBe(true);
    canvas.upperCanvasEl.dispatchEvent(
      new MouseEvent("mousedown", {
        clientX: 10,
        clientY: 10,
        bubbles: true,
        cancelable: true,
      }),
    );
    // Fabric re-applies `defaultCursor` on hover, so a cursor written straight
    // to the element is overwritten mid-drag; during the drag the dragging
    // cursor has to be the one Fabric re-applies.
    expect(canvas.defaultCursor).toBe("grabbing");
    window.dispatchEvent(
      new MouseEvent("mousemove", { clientX: 40, clientY: 25, bubbles: true }),
    );
    expect(viewport.panBy).toHaveBeenCalledWith(30, 15);
    // A second move pins the anchor update: a handler that kept the first
    // press position as its origin would still satisfy the single-move
    // assertion above.
    window.dispatchEvent(
      new MouseEvent("mousemove", { clientX: 55, clientY: 40, bubbles: true }),
    );
    expect(viewport.panBy).toHaveBeenNthCalledWith(2, 15, 15);
    window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keyup", { key: " " }));
    viewport.panBy.mockClear();
    // Releasing the key gives target find back: a stuck claim would make the
    // canvas permanently unselectable at the end of a pan. The cursor goes
    // back to the pre-gesture value too, not to the pan cursor.
    expect(canvas.skipTargetFind).toBe(false);
    expect(canvas.defaultCursor).toBe("default");
    window.dispatchEvent(
      new MouseEvent("mousemove", { clientX: 80, clientY: 80, bubbles: true }),
    );
    expect(viewport.panBy).not.toHaveBeenCalled();
  });

  it("pans on a middle-drag", () => {
    // Step 3 specifies middle-drag panning; without this test the button
    // number and the release handling are both unverified.
    const { canvas, viewport } = setup();
    canvas.upperCanvasEl.dispatchEvent(
      new MouseEvent("mousedown", {
        button: 1,
        clientX: 10,
        clientY: 10,
        bubbles: true,
        cancelable: true,
      }),
    );
    window.dispatchEvent(
      new MouseEvent("mousemove", { clientX: 25, clientY: 40, bubbles: true }),
    );
    expect(viewport.panBy).toHaveBeenCalledWith(15, 30);
    // The anchor update again: a middle-drag that measured every move from the
    // press point would pass the first assertion and pan twice as fast.
    window.dispatchEvent(
      new MouseEvent("mousemove", { clientX: 40, clientY: 55, bubbles: true }),
    );
    expect(viewport.panBy).toHaveBeenNthCalledWith(2, 15, 15);
    window.dispatchEvent(
      new MouseEvent("mouseup", { button: 1, bubbles: true }),
    );
    viewport.panBy.mockClear();
    window.dispatchEvent(
      new MouseEvent("mousemove", { clientX: 90, clientY: 90, bubbles: true }),
    );
    expect(viewport.panBy).not.toHaveBeenCalled();
  });

  it("leaves Space to the control that activates on it", () => {
    // Space activates a focused button; claiming it for panning would silently
    // break every toolbar control for keyboard users, and the default is not
    // prevented so the control still sees the key.
    const { canvas } = setup();
    const button = document.createElement("button");
    document.body.append(button);
    button.focus();
    const event = new KeyboardEvent("keydown", {
      key: " ",
      bubbles: true,
      cancelable: true,
    });
    button.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(canvas.skipTargetFind).toBe(false);
    button.remove();
  });

  it("unbinds every listener", () => {
    const { canvas, viewport, unbind } = setup();
    unbind();
    canvas.upperCanvasEl.dispatchEvent(
      new WheelEvent("wheel", { deltaY: 100, bubbles: true }),
    );
    expect(viewport.panBy).not.toHaveBeenCalled();
  });

  it("defers the camera keys to a focused text field", () => {
    // `-`, `=` and `shift+1` are all ordinary text characters, so an unguarded
    // window listener would zoom while the author types a layer name.
    const { viewport } = setup();
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    const eventFor = (key: string, shiftKey = false) =>
      new KeyboardEvent("keydown", { key, shiftKey, bubbles: true });
    const keys = ["-", "=", "+"];
    // Both delivery paths are covered: a real keystroke inside the field
    // retargets to the field, while a listener that saw the window instead
    // still has to consult what is focused.
    const fieldEvents = keys.map((key) => eventFor(key));
    const windowEvents = [
      ...keys.map((key) => eventFor(key)),
      eventFor("!", true),
    ];

    for (const event of fieldEvents) input.dispatchEvent(event);
    expect(viewport.zoomBy).not.toHaveBeenCalled();

    for (const event of windowEvents) window.dispatchEvent(event);
    expect(viewport.zoomToPoint).not.toHaveBeenCalled();
    expect(viewport.zoomBy).not.toHaveBeenCalled();
    expect(viewport.zoomToFit).not.toHaveBeenCalled();
    // A guard that swallowed the key would also stop a hyphen reaching the
    // field: the event has to stay uncancelled for the character to be typed.
    for (const event of [...fieldEvents, ...windowEvents]) {
      expect(event.defaultPrevented).toBe(false);
    }
    input.remove();
  });

  it("zooms in on =, out on -, and fits on shift+1", () => {
    // The direction is the substance: `zoomBy(any number)` would pass with the
    // sign inverted, which is the difference between zooming in and out.
    const { viewport } = setup();
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "=", bubbles: true }),
    );
    expect(viewport.zoomBy).toHaveBeenCalledOnce();
    expect(viewport.zoomBy.mock.calls[0]?.[0]).toBeGreaterThan(1);

    viewport.zoomBy.mockClear();
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "-", bubbles: true }),
    );
    expect(viewport.zoomBy.mock.calls[0]?.[0]).toBeLessThan(1);

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "!", shiftKey: true, bubbles: true }),
    );
    expect(viewport.zoomToFit).toHaveBeenCalled();
  });
});
