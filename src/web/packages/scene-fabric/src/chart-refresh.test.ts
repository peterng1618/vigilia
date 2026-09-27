import { describe, expect, it, vi } from "vitest";
import { startChartRefresh } from "./chart-refresh.js";

describe("startChartRefresh", () => {
  it("caps redraws at the selected rate and stops on disposal", () => {
    const callbacks = new Map<number, FrameRequestCallback>();
    let nextFrame = 0;
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      nextFrame += 1;
      callbacks.set(nextFrame, callback);
      return nextFrame;
    });
    const cancelFrame = vi.fn((frame: number) => callbacks.delete(frame));
    const refresh = vi.fn();
    const scheduler = startChartRefresh(refresh, 30, {
      requestFrame,
      cancelFrame,
    });
    const run = (now: number): void => {
      const frame = callbacks.keys().next().value;
      if (frame === undefined) throw new Error("Expected a scheduled frame.");
      callbacks.get(frame)?.(now);
      callbacks.delete(frame);
    };

    run(0);
    run(16);
    run(34);
    expect(refresh).toHaveBeenCalledTimes(2);

    scheduler.setRate(1);
    run(50);
    run(1_034);
    expect(refresh).toHaveBeenCalledTimes(3);

    scheduler.setRate(30);
    run(1_068);
    expect(refresh).toHaveBeenCalledTimes(4);

    scheduler.dispose();
    expect(cancelFrame).toHaveBeenCalledTimes(1);
  });

  it("keeps repainting after a refresh throws, and reports it once", () => {
    const callbacks = new Map<number, FrameRequestCallback>();
    let nextFrame = 0;
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      nextFrame += 1;
      callbacks.set(nextFrame, callback);
      return nextFrame;
    });
    const cancelFrame = vi.fn((frame: number) => callbacks.delete(frame));
    const onError = vi.fn();
    let throws = true;
    const refresh = vi.fn(() => {
      if (throws) throw new Error("setOption blew up");
    });
    const scheduler = startChartRefresh(
      refresh,
      30,
      { requestFrame, cancelFrame },
      {
        onError,
      },
    );
    const run = (now: number): void => {
      const frame = callbacks.keys().next().value;
      if (frame === undefined) throw new Error("The loop stopped.");
      callbacks.get(frame)?.(now);
      callbacks.delete(frame);
    };

    // **The whole point:** one failing repaint must not end the scene's
    // repainting. Every chart, every bound text object and the clock go through
    // this one function, so a throw that stopped it would freeze the display.
    run(0);
    run(34);
    run(68);
    expect(refresh).toHaveBeenCalledTimes(3);
    // Deduped, or a failing chart would log on every frame.
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toContain("setOption blew up");

    // And it recovers: a refresh that stops throwing is not reported again.
    throws = false;
    run(102);
    expect(refresh).toHaveBeenCalledTimes(4);
    expect(onError).toHaveBeenCalledTimes(1);

    scheduler.dispose();
  });

  it("says so when a repaint fails even with nothing listening", () => {
    const callbacks = new Map<number, FrameRequestCallback>();
    let nextFrame = 0;
    const requestFrame = (callback: FrameRequestCallback): number => {
      nextFrame += 1;
      callbacks.set(nextFrame, callback);
      return nextFrame;
    };
    const cancelFrame = (frame: number): boolean => callbacks.delete(frame);
    const scheduler = startChartRefresh(
      () => {
        throw new Error("boom");
      },
      30,
      { requestFrame, cancelFrame },
    );
    const frame = callbacks.keys().next().value;
    // The same shape the two sibling tests use: assert the frame exists, then
    // call it optionally. `callbacks.get(frame!)` would typecheck and would
    // also pass when the callback is missing, which is the opposite of what
    // this test is for.
    expect(frame).toBeDefined();
    // No `onError`: the loop still has to keep going rather than throw out of a
    // frame callback, which the browser would swallow and the loop would end.
    expect(() => callbacks.get(frame! as number)?.(0)).not.toThrow();
    expect(callbacks.size).toBeGreaterThan(0);
    scheduler.dispose();
  });
});
