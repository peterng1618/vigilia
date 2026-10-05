export type ChartRefreshRate = 1 | 30;

type FrameDriver = {
  readonly requestFrame: (callback: FrameRequestCallback) => number;
  readonly cancelFrame: (frame: number) => void;
};

export interface ChartRefreshOptions {
  /** Reports a refresh that threw, once per distinct message. A refresh that
      throws still reschedules, so one bad chart degrades the cadence instead of
      stopping the scene from repainting at all. */
  readonly onError?: (message: string) => void;
}

/** Repaints charts at a capped browser-frame rate without changing telemetry cadence. */
export function startChartRefresh(
  refresh: () => void,
  initialRate: ChartRefreshRate,
  frames: FrameDriver = {
    requestFrame: window.requestAnimationFrame.bind(window),
    cancelFrame: window.cancelAnimationFrame.bind(window),
  },
  options: ChartRefreshOptions = {},
): { setRate(rate: ChartRefreshRate): void; dispose(): void } {
  let rate = initialRate;
  let lastRefreshMs: number | undefined;
  let frame: number | undefined;
  let disposed = false;
  // Deduped, because a failing chart would otherwise report every frame.
  const reported = new Set<string>();

  const tick = (nowMs: number): void => {
    if (disposed) return;
    // **Scheduled before the refresh, not after.** A refresh that throws would
    // otherwise end the loop, and because every repaint in the scene goes
    // through this one function — charts, bound text, the clock — the whole
    // display would stop updating for good, with only the first failure logged.
    frame = frames.requestFrame(tick);
    if (lastRefreshMs !== undefined && nowMs - lastRefreshMs < 1_000 / rate)
      return;
    lastRefreshMs = nowMs;
    try {
      refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (reported.has(message)) return;
      reported.add(message);
      options.onError?.(
        `A repaint failed and was skipped; the scene keeps updating. ${message}`,
      );
    }
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
