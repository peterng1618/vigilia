export type ChartRefreshRate = 1 | 30;

type FrameDriver = {
  readonly requestFrame: (callback: FrameRequestCallback) => number;
  readonly cancelFrame: (frame: number) => void;
};

/** Repaints charts at a capped browser-frame rate without changing telemetry cadence. */
export function startChartRefresh(
  refresh: () => void,
  initialRate: ChartRefreshRate,
  frames: FrameDriver = {
    requestFrame: window.requestAnimationFrame.bind(window),
    cancelFrame: window.cancelAnimationFrame.bind(window),
  },
): { setRate(rate: ChartRefreshRate): void; dispose(): void } {
  let rate = initialRate;
  let lastRefreshMs: number | undefined;
  let frame: number | undefined;
  let disposed = false;

  const tick = (nowMs: number): void => {
    if (disposed) return;
    if (lastRefreshMs === undefined || nowMs - lastRefreshMs >= 1_000 / rate) {
      lastRefreshMs = nowMs;
      refresh();
    }
    frame = frames.requestFrame(tick);
  };

  frame = frames.requestFrame(tick);

  return {
    setRate(nextRate: ChartRefreshRate): void {
      rate = nextRate;
    },
    dispose(): void {
      disposed = true;
      if (frame !== undefined) frames.cancelFrame(frame);
    },
  };
}
