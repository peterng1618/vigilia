import type { Sample, SampleSource, SensorStatus } from '@vigilia/renderer-core';

/**
 * A deterministic synthetic {@link SampleSource} for developing the display path
 * without a host.
 *
 * ## What this is, and what it is not
 *
 * It is **not a provider.** A provider acquires real hardware readings on the PC
 * and lives in `src/Vigilia.Providers.*`; the host schedules it. This fabricates
 * numbers, and it exists because the theming and display work — chart adapters,
 * the scene plan, the player — needs live-looking data long before the SignalR
 * transport does. §97 forbids ever presenting a fabricated reading as real, so
 * this package is dev and test scaffolding only and must never be a dependency
 * of a shipped bundle.
 *
 * There is a separate `FakeSensorProvider` in C# whose job is provider contract
 * conformance. The two fakes are unrelated implementations with different
 * purposes; nothing keeps their semantic keys aligned, so treat {@link PROFILES}
 * as this side's own dev catalogue rather than a shared contract.
 *
 * ## Deterministic by construction
 *
 * Every value is a pure function of `(semanticKey, timestamp)`. There is no
 * accumulated state and no randomness, which buys three things:
 *
 * - A screenshot test pinned to a fixed clock produces identical pixels on every
 *   run and every machine. (The C# side needs `StableHash` for the same reason:
 *   `string.GetHashCode()` is randomised per process.)
 * - History for any window is available **immediately**, so a 60-second line
 *   chart is full on the first frame instead of taking a minute to fill.
 * - Two clients asking at the same instant see the same value, which is what a
 *   real host would do and what makes multi-phone behaviour testable.
 */

/** How a family of sensors behaves, chosen by the last segment of its key. */
export interface SensorProfile {
  readonly unit: string;
  readonly min: number;
  readonly max: number;
  /** Seconds for one full cycle of the dominant wave. */
  readonly periodSeconds: number;
  /** How abruptly the value moves: 1 is a smooth sine, higher is spikier. */
  readonly spikiness: number;
}

/**
 * Dev catalogue, keyed by the **last dotted segment** of a semantic key.
 *
 * Ranges are plausible rather than measured — the point is that a dashboard
 * built against these looks like a dashboard, so typography and thresholds can
 * be judged. Load moves fast and spikily, temperature lags behind it, and a
 * clock barely moves; a theme laid out against uniformly wobbling values would
 * hide exactly the design problems this is meant to expose.
 */
export const PROFILES: Readonly<Record<string, SensorProfile>> = {
  load: { unit: '%', min: 2, max: 97, periodSeconds: 23, spikiness: 2.5 },
  temp: { unit: '°C', min: 34, max: 82, periodSeconds: 47, spikiness: 1 },
  clock: { unit: 'MHz', min: 800, max: 5200, periodSeconds: 31, spikiness: 1.8 },
  fan: { unit: 'RPM', min: 600, max: 2100, periodSeconds: 61, spikiness: 1 },
  power: { unit: 'W', min: 15, max: 220, periodSeconds: 19, spikiness: 2.2 },
  used: { unit: 'GB', min: 6.5, max: 22.5, periodSeconds: 97, spikiness: 1 },
  ratio: { unit: '', min: 0, max: 1, periodSeconds: 29, spikiness: 1.4 },
  fps: { unit: 'FPS', min: 48, max: 165, periodSeconds: 13, spikiness: 3 },
};

/** Used when a key's last segment is not in {@link PROFILES}. */
const FALLBACK_PROFILE: SensorProfile = {
  unit: '',
  min: 0,
  max: 100,
  periodSeconds: 37,
  spikiness: 1,
};

/** A deterministic outage, so gap rendering can be seen without waiting for one. */
export interface OutageRule {
  readonly semanticKey: string;
  /** Cycle length in seconds. */
  readonly everySeconds: number;
  /** How much of each cycle is out. */
  readonly forSeconds: number;
  /** Status reported while out. Defaults to `error`. */
  readonly status?: Exclude<SensorStatus, 'ok'>;
}

export interface FakeSourceOptions {
  /**
   * Sampling cadence. §122 starts hardware sampling at one second, and matching
   * it matters: a source that produced a new value on every animation frame
   * would let a theme look smooth for reasons the real system cannot reproduce.
   */
  readonly sampleIntervalMs?: number;
  /** Keys pinned to a status regardless of the clock. */
  readonly forcedStatus?: Readonly<Record<string, Exclude<SensorStatus, 'ok'>>>;
  readonly outages?: readonly OutageRule[];
  /** Keys that report text instead of a number, e.g. a GPU model name. */
  readonly textValues?: Readonly<Record<string, string>>;
  /** Shifts every waveform, so two sources can differ without either being random. */
  readonly seed?: number;
}

export class FakeSampleSource implements SampleSource {
  readonly #intervalMs: number;
  readonly #forcedStatus: Readonly<Record<string, Exclude<SensorStatus, 'ok'>>>;
  readonly #outages: readonly OutageRule[];
  readonly #textValues: Readonly<Record<string, string>>;
  readonly #seed: number;
  #nowMs: number;

  constructor(nowMs: number, options: FakeSourceOptions = {}) {
    this.#nowMs = nowMs;
    this.#intervalMs = Math.max(1, options.sampleIntervalMs ?? 1000);
    this.#forcedStatus = options.forcedStatus ?? {};
    this.#outages = options.outages ?? [];
    this.#textValues = options.textValues ?? {};
    this.#seed = options.seed ?? 0;
  }

  /** Moves the clock. The caller owns time so tests and screenshots can pin it. */
  setNow(nowMs: number): void {
    this.#nowMs = nowMs;
  }

  get nowMs(): number {
    return this.#nowMs;
  }

  latest(semanticKey: string): Sample | undefined {
    // Quantised to the sampling cadence, so the value holds still between ticks
    // exactly as a real 1 Hz feed would. Without this, a value readout would
    // flicker through digits at frame rate.
    return this.sampleAt(semanticKey, this.#quantise(this.#nowMs));
  }

  history(semanticKey: string, windowSeconds: number): readonly Sample[] {
    const end = this.#quantise(this.#nowMs);
    const start = end - Math.max(0, windowSeconds) * 1000;
    const samples: Sample[] = [];

    for (let t = this.#quantise(start); t <= end; t += this.#intervalMs) {
      samples.push(this.sampleAt(semanticKey, t));
    }

    return samples;
  }

  /**
   * The sample a key would have had at an exact instant.
   *
   * Public because it is the whole determinism story: a test can assert the
   * value at a fixed time without constructing a clock.
   */
  sampleAt(semanticKey: string, timeMs: number): Sample {
    const timestamp = new Date(timeMs).toISOString();

    const forced = this.#forcedStatus[semanticKey];
    if (forced !== undefined) {
      return {
        sensorId: semanticKey,
        timestamp,
        status: forced,
        message: `Fake source: ${semanticKey} is pinned to ${forced}.`,
      };
    }

    const outage = this.#outageAt(semanticKey, timeMs);
    if (outage !== undefined) {
      // No value field at all — not a zero, and not an explicit undefined
      // either, since the wire format omits the key entirely (§83).
      return {
        sensorId: semanticKey,
        timestamp,
        status: outage,
        message: `Fake source: simulated ${outage} window.`,
      };
    }

    const text = this.#textValues[semanticKey];
    if (text !== undefined) {
      return { sensorId: semanticKey, timestamp, status: 'ok', textValue: text };
    }

    const profile = profileFor(semanticKey);

    return {
      sensorId: semanticKey,
      timestamp,
      status: 'ok',
      value: waveform(semanticKey, timeMs, profile, this.#seed),
      unit: profile.unit,
    };
  }

  #quantise(timeMs: number): number {
    return Math.floor(timeMs / this.#intervalMs) * this.#intervalMs;
  }

  #outageAt(semanticKey: string, timeMs: number): Exclude<SensorStatus, 'ok'> | undefined {
    for (const rule of this.#outages) {
      if (rule.semanticKey !== semanticKey || rule.everySeconds <= 0) {
        continue;
      }

      const cycleMs = rule.everySeconds * 1000;
      // Offset by the key's hash so several outage rules do not line up, which
      // would make every gap in a dashboard happen at the same moment.
      const phase = (timeMs + stableHash(semanticKey) % cycleMs) % cycleMs;

      if (phase < rule.forSeconds * 1000) {
        return rule.status ?? 'error';
      }
    }

    return undefined;
  }
}

/** Picks a profile from the last dotted segment of a semantic key. */
export function profileFor(semanticKey: string): SensorProfile {
  const segment = semanticKey.split('.').at(-1) ?? '';
  return PROFILES[segment] ?? FALLBACK_PROFILE;
}

/**
 * The value for a key at an instant.
 *
 * Two sines of incommensurate periods plus a slow drift. That combination never
 * repeats over any window a person would watch, yet is exactly reproducible —
 * which is the property a screenshot test needs and a random walk cannot give.
 */
export function waveform(
  semanticKey: string,
  timeMs: number,
  profile: SensorProfile,
  seed = 0,
): number {
  const hash = stableHash(semanticKey) + seed;
  // Phase from the hash, so two sensors with the same profile do not move in
  // lockstep — a dashboard where every gauge agrees looks broken.
  const phase = (hash % 1000) / 1000 * Math.PI * 2;
  const seconds = timeMs / 1000;

  const fast = Math.sin((seconds / profile.periodSeconds) * Math.PI * 2 + phase);
  // 1.618: an irrational-ish ratio, so the two waves never line up into an
  // obvious repeating pattern.
  const slow = Math.sin((seconds / (profile.periodSeconds * 1.618)) * Math.PI * 2 + phase * 1.7);

  // Weighted toward the fast wave, then normalised into 0–1.
  const mixed = (fast * 0.65 + slow * 0.35 + 1) / 2;

  // Spikiness pushes the distribution toward the extremes without ever leaving
  // 0–1, so a "load" trace has bursts while a "temp" trace stays smooth.
  const shaped = profile.spikiness === 1 ? mixed : Math.pow(mixed, profile.spikiness);

  const value = profile.min + shaped * (profile.max - profile.min);

  // Rounded to three decimals so JSON stays small and comparisons are exact.
  return Math.round(value * 1000) / 1000;
}

/**
 * FNV-1a, 32-bit.
 *
 * Deliberately not `String.prototype` anything platform-dependent, and the
 * direct counterpart of the C# side's `FakeSensorProvider.StableHash`: .NET
 * randomises string hashing per process, and a JS engine makes no determinism
 * promise either. A hand-written hash is the only way two runs agree.
 */
export function stableHash(value: string): number {
  let hash = 0x811c9dc5;

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    // Multiply by the FNV prime, 16777619, in 32-bit space.
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash;
}
