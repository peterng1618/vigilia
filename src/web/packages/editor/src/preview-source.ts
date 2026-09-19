import { FakeSampleSource } from '@vigilia/fake-source';
import { SampleStore, type SampleSource } from '@vigilia/renderer-core';

export function createPreviewSource(options: {
  readonly keys: readonly string[];
  readonly now: () => number;
}): { readonly source: SampleSource } {
  const keys = new Set(options.keys);
  const waveform = new FakeSampleSource(0);
  const store = new SampleStore();
  let sampledAt = Number.NaN;

  const update = (): void => {
    const now = options.now();
    if (!Number.isFinite(now) || now === sampledAt) return;
    waveform.setNow(now);
    store.ingest([...keys].map((key) => [key, waveform.sampleAt(key, now)] as const), now);
    sampledAt = now;
  };

  return {
    source: {
      latest(key) {
        if (!keys.has(key)) return undefined;
        update();
        return store.latest(key);
      },
      history(key, windowSeconds) {
        if (!keys.has(key)) return [];
        update();
        return store.history(key, windowSeconds);
      },
    },
  };
}