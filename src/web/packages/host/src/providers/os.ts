import os from 'node:os';
import type { Sample, SampleEntry } from '@vigilia/renderer-core';
import type { ProviderHealth, SensorDescriptor, SensorProvider } from './provider.js';

/**
 * The baseline provider: real readings with no driver and no elevation.
 *
 * Everything here comes from `node:os`, so it needs no dependency, no
 * LibreHardwareMonitor and no privileged access — which is what makes it the
 * tier Vigilia must stay useful on when nothing else is available (ADR-0004).
 *
 * ## The measurement that is easy to get wrong
 *
 * `os.cpus()` reports **cumulative** tick counters since boot, not a rate. The
 * load over an interval is the change in busy ticks divided by the change in
 * total ticks. Reporting the absolute counters as a percentage would produce a
 * number that is near-constant and meaningless — it would look plausible and
 * be wrong, which is the failure mode §33 and §97 exist to prevent.
 *
 * So the arithmetic is pure and takes two snapshots, and the first sampling
 * cycle after start has nothing to diff against: it reports `missing`, **not
 * zero** (§83).
 */

export const OS_PROVIDER_ID = 'os';

/** The cumulative tick counters, as `os.cpus()[n].times` reports them. */
export interface CpuTimes {
  readonly user: number;
  readonly nice: number;
  readonly sys: number;
  readonly idle: number;
  readonly irq: number;
}

/** One instant's raw readings, summed across cores. */
export interface OsReadings {
  /** Busy + idle ticks summed over every core. */
  readonly idleTicks: number;
  readonly totalTicks: number;
  readonly cpuCount: number;
  readonly totalMemBytes: number;
  readonly freeMemBytes: number;
}

/** Sums per-core counters into one snapshot. */
export function readingsFromCpus(
  cpus: readonly { readonly times: CpuTimes }[],
  totalMemBytes: number,
  freeMemBytes: number,
): OsReadings {
  let idleTicks = 0;
  let totalTicks = 0;

  for (const cpu of cpus) {
    const { user, nice, sys, idle, irq } = cpu.times;

    idleTicks += idle;
    totalTicks += user + nice + sys + idle + irq;
  }

  return {
    idleTicks,
    totalTicks,
    cpuCount: cpus.length,
    totalMemBytes,
    freeMemBytes,
  };
}

/**
 * CPU load as a percentage over the interval between two snapshots.
 *
 * @returns `undefined` when the interval carries no information — no previous
 *   snapshot, or no ticks elapsed between them. **Not zero:** "I could not
 *   measure this" and "the CPU was idle" are different claims, and collapsing
 *   them is exactly what §83 forbids.
 */
export function cpuLoadBetween(
  previous: OsReadings | undefined,
  next: OsReadings,
): number | undefined {
  if (previous === undefined) {
    return undefined;
  }

  const totalDelta = next.totalTicks - previous.totalTicks;
  const idleDelta = next.idleTicks - previous.idleTicks;

  // Counters can also go backwards — a core offlining, or a suspend/resume —
  // and a negative delta would yield a nonsense percentage.
  if (totalDelta <= 0 || idleDelta < 0) {
    return undefined;
  }

  const busyRatio = 1 - idleDelta / totalDelta;

  // Clamped because rounding across cores can put this a hair outside [0, 1].
  return Math.min(100, Math.max(0, busyRatio * 100));
}

function ok(sensorId: string, value: number, unit: string, timestamp: string): Sample {
  return { sensorId, timestamp, status: 'ok', value, unit };
}

function missing(sensorId: string, timestamp: string, message: string): Sample {
  // No `value` key at all — not `value: undefined`. With
  // exactOptionalPropertyTypes those are different types, and more importantly
  // a consumer checking `'value' in sample` must see the truth.
  return { sensorId, timestamp, status: 'missing', message };
}

/** Every semantic key this provider can produce. */
export const OS_DESCRIPTORS: readonly SensorDescriptor[] = [
  {
    sensorId: `${OS_PROVIDER_ID}:cpu.load`,
    semanticKey: 'cpu.load',
    label: 'CPU load (all cores)',
    unit: '%',
    tier: 'baseline',
  },
  {
    sensorId: `${OS_PROVIDER_ID}:ram.used`,
    semanticKey: 'ram.used',
    label: 'RAM used',
    unit: 'GB',
    tier: 'baseline',
  },
  {
    sensorId: `${OS_PROVIDER_ID}:ram.used.percent`,
    semanticKey: 'ram.used.percent',
    label: 'RAM used (share of total)',
    unit: '%',
    tier: 'baseline',
  },
  {
    sensorId: `${OS_PROVIDER_ID}:ram.total`,
    semanticKey: 'ram.total',
    label: 'RAM total',
    unit: 'GB',
    tier: 'baseline',
  },
];

const BYTES_PER_GB = 1024 ** 3;

/**
 * Turns two snapshots into samples. Pure — the whole decision surface.
 *
 * Only the requested keys are produced (§111). A requested key this provider
 * does not know is simply absent from the result: the registry reports
 * unmapped keys, and inventing a status for a key that is not ours would
 * misattribute another provider's gap to this one.
 */
export function samplesFromReadings(
  previous: OsReadings | undefined,
  next: OsReadings,
  nowMs: number,
  semanticKeys: readonly string[],
): readonly SampleEntry[] {
  const timestamp = new Date(nowMs).toISOString();
  const wanted = new Set(semanticKeys);
  const entries: SampleEntry[] = [];

  if (wanted.has('cpu.load')) {
    const sensorId = `${OS_PROVIDER_ID}:cpu.load`;
    const load = cpuLoadBetween(previous, next);

    entries.push({
      semanticKey: 'cpu.load',
      sample:
        load === undefined
          ? missing(sensorId, timestamp, 'waiting for a second reading to measure load against')
          : ok(sensorId, load, '%', timestamp),
    });
  }

  const usedBytes = next.totalMemBytes - next.freeMemBytes;

  if (wanted.has('ram.used')) {
    entries.push({
      semanticKey: 'ram.used',
      sample: ok(`${OS_PROVIDER_ID}:ram.used`, usedBytes / BYTES_PER_GB, 'GB', timestamp),
    });
  }

  if (wanted.has('ram.used.percent')) {
    const sensorId = `${OS_PROVIDER_ID}:ram.used.percent`;

    entries.push({
      semanticKey: 'ram.used.percent',
      sample:
        next.totalMemBytes > 0
          ? ok(sensorId, (usedBytes / next.totalMemBytes) * 100, '%', timestamp)
          : missing(sensorId, timestamp, 'total memory reported as zero'),
    });
  }

  if (wanted.has('ram.total')) {
    entries.push({
      semanticKey: 'ram.total',
      sample: ok(
        `${OS_PROVIDER_ID}:ram.total`,
        next.totalMemBytes / BYTES_PER_GB,
        'GB',
        timestamp,
      ),
    });
  }

  return entries;
}

/**
 * Reads `node:os`. Holds the previous snapshot and nothing else.
 *
 * The one snapshot of state is not a history cache — it is the minimum a rate
 * measurement requires, and it is what the provider *acquires from*, not a
 * buffer for clients. Bounded history belongs to the host (§122).
 */
export class OsSensorProvider implements SensorProvider {
  readonly id = OS_PROVIDER_ID;
  readonly label = 'Operating system (baseline)';

  private previous: OsReadings | undefined;

  private read(): OsReadings {
    return readingsFromCpus(os.cpus(), os.totalmem(), os.freemem());
  }

  describe(): Promise<readonly SensorDescriptor[]> {
    return Promise.resolve(OS_DESCRIPTORS);
  }

  sample(semanticKeys: readonly string[], nowMs: number): Promise<readonly SampleEntry[]> {
    const next = this.read();
    const entries = samplesFromReadings(this.previous, next, nowMs, semanticKeys);

    this.previous = next;

    return Promise.resolve(entries);
  }

  health(): ProviderHealth {
    // `node:os` is always present. This provider having nothing to report is
    // the point of the baseline tier.
    return { available: true };
  }
}
