// @vitest-environment jsdom
import type { Canvas } from "fabric/es";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCanvasNudge, NUDGE_IDLE_MS } from "./canvas-nudge.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("canvas nudge burst coalescing", () => {
  it("records exactly one history entry per burst, and none while it is open", () => {
    vi.useFakeTimers();
    const { history, saveState, depth } = fakeHistory();
    const { canvas } = canvasWith({ x: 10, y: 20 });
    const nudge = createCanvasNudge({ canvas, history });

    nudge.nudgeBy(1, 0);
    nudge.nudgeBy(1, 0);
    nudge.nudgeBy(10, 0);

    // Open burst: suspended once, nothing recorded yet.
    expect(history.suspend).toHaveBeenCalledTimes(1);
    expect(saveState).not.toHaveBeenCalled();

    vi.advanceTimersByTime(NUDGE_IDLE_MS);

    // Closed burst: released, exactly one entry — not three.
    expect(depth()).toBe(0);
    expect(saveState).toHaveBeenCalledTimes(1);
  });

  it("starts a second burst when the presses are further apart than the idle window", () => {
    vi.useFakeTimers();
    const { history, saveState, depth } = fakeHistory();
    const { canvas } = canvasWith({ x: 10, y: 20 });
    const nudge = createCanvasNudge({ canvas, history });

    nudge.nudgeBy(1, 0);
    vi.advanceTimersByTime(NUDGE_IDLE_MS);
    nudge.nudgeBy(1, 0);
    vi.advanceTimersByTime(NUDGE_IDLE_MS);

    // Two bursts, two entries: the first burst's `release` must not still be
    // open, or the second `suspend` would nest over it and never unwind.
    expect(history.suspend).toHaveBeenCalledTimes(2);
    expect(depth()).toBe(0);
    expect(saveState).toHaveBeenCalledTimes(2);
  });

  it("moves the selected object by the nudge step", () => {
    vi.useFakeTimers();
    const { canvas, position } = canvasWith({ x: 10, y: 20 });
    const nudge = createCanvasNudge({ canvas, history: fakeHistory().history });

    nudge.nudgeBy(1, 0);
    nudge.nudgeBy(0, -10);

    expect(position()).toEqual({ x: 11, y: 10 });
  });

  it("releases the open burst on dispose without leaving a timer behind", () => {
    vi.useFakeTimers();
    const { history, saveState, depth } = fakeHistory();
    const { canvas } = canvasWith({ x: 10, y: 20 });
    const nudge = createCanvasNudge({ canvas, history });

    nudge.nudgeBy(1, 0);
    nudge.dispose();
    vi.advanceTimersByTime(NUDGE_IDLE_MS);

    // The timer is owned by the session, which is gone: nothing may fire after,
    // and the suspension it opened must still be lifted.
    expect(depth()).toBe(0);
    expect(saveState).not.toHaveBeenCalled();
  });
});

/** Mirrors `EditorHistory`'s suspend counter, so a released burst is observable. */
function fakeHistory() {
  let depth = 0;
  const suspend = vi.fn(() => {
    depth += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      depth -= 1;
    };
  });
  const saveState = vi.fn();
  return { history: { suspend, saveState }, saveState, depth: () => depth };
}

/** One unlocked, selectable object: enough for `nudge` to have a target. */
function canvasWith(start: { readonly x: number; readonly y: number }) {
  let x = start.x;
  let y = start.y;
  const object = {
    locked: false,
    getRelativeCenterPoint: () => ({ x, y }),
    setPositionByOrigin: (point: {
      readonly x: number;
      readonly y: number;
    }) => {
      x = point.x;
      y = point.y;
    },
    setCoords: vi.fn(),
  };
  const canvas = {
    getActiveObject: vi.fn(() => object),
    requestRenderAll: vi.fn(),
    fire: vi.fn(),
  } as unknown as Canvas;
  return { canvas, position: () => ({ x, y }) };
}
