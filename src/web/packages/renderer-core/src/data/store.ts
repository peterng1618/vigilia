import type { Sample } from '../types.js';
import type { SampleSource } from './source.js';

/** Bounds for {@link SampleStore}. Both apply; the tighter one wins. */
export interface SampleStoreOptions {
  /** Drop samples older than this on ingest. */
  readonly maxAgeSeconds?: number;
  /** Keep at most this many samples per semantic key. */
  readonly maxSamplesPerKey?: number;
}

/**
 * Defaults: five minutes or 600 samples per key.
 *
 * CHOSEN, NOT MEASURED. Five minutes covers the widest shipped window (300 s)
 * at the 1 s baseline, and 600 points matches the line adapter's own cap — so
 * the store never holds less than a chart is allowed to draw.
 */
export const defaultSampleStoreOptions: Required<SampleStoreOptions> = {
  maxAgeSeconds: 300,
  maxSamplesPerKey: 600,
};

/**
 * Bounded in-memory history for the transport to fill (§122).
 *
 * The transport pushes ingested samples in; the plan builder pulls through
 * {@link SampleSource}. A time bound alone is a bound on age, not on memory —
 * a source sampling faster than the 1 s baseline would otherwise grow a key
 * without limit — so every ingest also enforces the per-key count cap.
 */
export class SampleStore implements SampleSource {
  private readonly maxAgeMs: number;
  private readonly maxSamples: number;
  private readonly series = new Map<string, Sample[]>();
  private lastNowMs = Number.NEGATIVE_INFINITY;

  constructor(options: SampleStoreOptions = {}) {
    this.maxAgeMs =
      Math.max(0, (options.maxAgeSeconds ?? defaultSampleStoreOptions.maxAgeSeconds)) * 1000;
    this.maxSamples = Math.max(
      1,
      Math.floor(options.maxSamplesPerKey ?? defaultSampleStoreOptions.maxSamplesPerKey),
    );
  }

  /** Records samples ingested at `nowMs`, pruning each touched key. */
  ingest(entries: Iterable<readonly [string, Sample]>, nowMs: number): void {
    this.lastNowMs = nowMs;
    const touched = new Set<string>();

    for (const [semanticKey, sample] of entries) {
      let list = this.series.get(semanticKey);

      if (list === undefined) {
        list = [];
        this.series.set(semanticKey, list);
      }

      list.push(sample);
      touched.add(semanticKey);
    }

    for (const semanticKey of touched) {
      this.prune(semanticKey, nowMs);
    }
  }

  latest(semanticKey: string): Sample | undefined {
    return this.series.get(semanticKey)?.at(-1);
  }

  history(semanticKey: string, windowSeconds: number): readonly Sample[] {
    const list = this.series.get(semanticKey);

    if (list === undefined || list.length === 0) {
      return [];
    }

    if (!Number.isFinite(this.lastNowMs)) {
      return [...list];
    }

    const start = this.lastNowMs - Math.max(0, windowSeconds) * 1000;

    return list.filter((sample) => {
      const time = Date.parse(sample.timestamp);
      return Number.isFinite(time) && time >= start && time <= this.lastNowMs;
    });
  }

  /** Drops everything, for reconnect: a server backlog must not interleave two timelines. */
  reset(): void {
    this.series.clear();
    this.lastNowMs = Number.NEGATIVE_INFINITY;
  }

  private prune(semanticKey: string, nowMs: number): void {
    const list = this.series.get(semanticKey);

    if (list === undefined) {
      return;
    }

    const cutoff = nowMs - this.maxAgeMs;
    const kept = list.filter((sample) => {
      const time = Date.parse(sample.timestamp);
      return !Number.isFinite(time) || time >= cutoff;
    });

    this.series.set(
      semanticKey,
      kept.length > this.maxSamples ? kept.slice(kept.length - this.maxSamples) : kept,
    );
  }
}
