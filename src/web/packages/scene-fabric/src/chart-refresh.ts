export type ChartRefreshRate = 1 | 30;

type FrameDriver = {
  readonly requestFrame: (callback: FrameRequestCallback) => number;
  readonly cancelFrame: (frame: number) => void;
};

interface ChartRefreshOptions {
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
): {
  setRate(rate: ChartRefreshRate): void;
  /** Stops repainting until `start()`: the page is going away. */
  stop(): void;
  /** Re-arms a stopped loop. Idempotent, because `pageshow` fires on the first
   *  load as well as on a return from the back/forward cache. */
  start(): void;
  /** Ends the loop for good. `start()` after this does nothing. */
  dispose(): void;
} {
  let rate = initialRate;
  let lastRefreshMs: number | undefined;
  let frame: number | undefined;
  // Three lifetimes, not two. The page's own (`stop`/`start`) is separate from
  // the editor's, because a page frozen into the back/forward cache comes back
  // — and a loop that could only be stopped came back dead (vg-510).
  let state: "running" | "stopped" | "disposed" = "running";
  // Deduped, because a failing chart would otherwise report every frame.
  const reported = new Set<string>();

  const tick = (nowMs: number): void => {
    if (state !== "running") return;
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
    stop(): void {
      if (state !== "running") return;
      state = "stopped";
      if (frame !== undefined) frames.cancelFrame(frame);
      frame = undefined;
    },
    start(): void {
      if (state !== "stopped") return;
      state = "running";
      frame = frames.requestFrame(tick);
    },
    dispose(): void {
      state = "disposed";
      if (frame !== undefined) frames.cancelFrame(frame);
      frame = undefined;
    },
  };
}
