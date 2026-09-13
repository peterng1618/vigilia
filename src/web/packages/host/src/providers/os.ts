import os from 'node:os';
import type { Sample, SampleEntry } from '@vigilia/renderer-core';
import { describeSemanticKey } from '@vigilia/renderer-core';
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

/**
 * The semantic keys this provider reads, in discovery order.
 *
 * The list of keys is the only thing declared here. Their labels, units and
 * tiers come from `semantic-keys.ts`, which owns the vocabulary — this file
 * used to restate all three, and had already drifted: `'CPU load (all cores)'`
 * against the vocabulary's `'CPU load'`, with each unit written a third time
 * inside `samplesFromReadings`. An owner nothing imports is not an owner.
 */
const OS_KEYS = ['cpu.load', 'ram.used', 'ram.used.percent', 'ram.total'] as const;

/** Every semantic key this provider can produce. */
export const OS_DESCRIPTORS: readonly SensorDescriptor[] = OS_KEYS.map((key) => {
  const declared = describeSemanticKey(key);

  if (declared === undefined) {
    // Unreachable while `os.test.ts` asserts every key is in the vocabulary,
    // and a loud failure is the right response if that ever stops being true:
    // a descriptor with an invented label is how the two copies drifted before.
    throw new Error(`${key} is not in the semantic key vocabulary`);
  }

  return {
    sensorId: `${OS_PROVIDER_ID}:${key}`,
    semanticKey: key,
    label: declared.label,
    // `exactOptionalPropertyTypes`: omit the key rather than pass undefined.
    ...(declared.unit === undefined ? {} : { unit: declared.unit }),
    // This provider needs no driver and no elevation, so everything it reads is
    // baseline by construction — asserted against the vocabulary in the tests
    // rather than copied from it, since availability is the provider's to
    // report (ADR-0004).
    tier: 'baseline' as const,
  };
});

const BYTES_PER_GB = 1024 ** 3;

/**
 * The unit a key is declared in.
 *
 * Read from the vocabulary rather than written at each `ok(...)` call, where
 * every unit previously appeared a third time — so a sample could carry a unit
 * its own descriptor disagreed with, and a display would label it wrongly with
 * nothing to notice.
 */
function unitFor(key: (typeof OS_KEYS)[number]): string {
  return describeSemanticKey(key)?.unit ?? '';
}

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
          : ok(sensorId, load, unitFor('cpu.load'), timestamp),
    });
  }

  const usedBytes = next.totalMemBytes - next.freeMemBytes;

  if (wanted.has('ram.used')) {
    entries.push({
      semanticKey: 'ram.used',
      sample: ok(
        `${OS_PROVIDER_ID}:ram.used`,
        usedBytes / BYTES_PER_GB,
        unitFor('ram.used'),
        timestamp,
      ),
    });
  }

  if (wanted.has('ram.used.percent')) {
    const sensorId = `${OS_PROVIDER_ID}:ram.used.percent`;

    entries.push({
      semanticKey: 'ram.used.percent',
      sample:
        next.totalMemBytes > 0
          ? ok(sensorId, (usedBytes / next.totalMemBytes) * 100, unitFor('ram.used.percent'), timestamp)
          : missing(sensorId, timestamp, 'total memory reported as zero'),
    });
  }

  if (wanted.has('ram.total')) {
    entries.push({
      semanticKey: 'ram.total',
      sample: ok(
        `${OS_PROVIDER_ID}:ram.total`,
        next.totalMemBytes / BYTES_PER_GB,
        unitFor('ram.total'),
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
