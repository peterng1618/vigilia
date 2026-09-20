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
});
