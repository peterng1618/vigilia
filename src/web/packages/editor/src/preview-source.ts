import { FakeSampleSource } from '@vigilia/fake-source';
import type { SampleSource } from '@vigilia/renderer-core';

export const PREVIEW_STARTUP_DURATION_MS = 2_000;
const PREVIEW_HISTORY_SECONDS = 300;

export type PreviewSampleSource = SampleSource & {
  readonly chartStartupDurationMs: number;
};

export function createPreviewSource(options: {
  readonly keys: readonly string[];
  readonly now: () => number;
}): { readonly source: PreviewSampleSource } {
  const keys = new Set(options.keys);
  const waveform = new FakeSampleSource(0);

  return {
    source: {
      latest(key) {
        if (!keys.has(key)) return undefined;
        const now = options.now();
        return Number.isFinite(now) ? waveform.sampleAt(key, now) : undefined;
      },
      history(key, windowSeconds) {
        if (!keys.has(key)) return [];
        const now = options.now();
        if (!Number.isFinite(now)) return [];
        waveform.setNow(now);
        return waveform.history(key, Math.min(windowSeconds, PREVIEW_HISTORY_SECONDS));
      },
      chartStartupDurationMs: PREVIEW_STARTUP_DURATION_MS,
    } as PreviewSampleSource,
  };
}
