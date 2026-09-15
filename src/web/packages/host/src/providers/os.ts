import os from 'node:os';
import type { Sample, SampleEntry } from '@vigilia/renderer-core';
import { describeSemanticKey } from '@vigilia/renderer-core';
import type { ProviderHealth, SensorDescriptor, SensorProvider } from './provider.js';

/** Baseline no-driver provider. CPU load is derived from deltas of cumulative OS ticks. */

export const OS_PROVIDER_ID = 'os';

/** Cumulative counters from `os.cpus()[n].times`. */
export interface CpuTimes {
  readonly user: number;
  readonly nice: number;
  readonly sys: number;
  readonly idle: number;
  readonly irq: number;
}

/** One summed raw snapshot. */
export interface OsReadings {
  readonly idleTicks: number;
  readonly totalTicks: number;
  readonly cpuCount: number;
  readonly totalMemBytes: number;
  readonly freeMemBytes: number;
}

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

/** Returns interval CPU load, or undefined until a valid delta exists. */
export function cpuLoadBetween(
  previous: OsReadings | undefined,
  next: OsReadings,
): number | undefined {
  if (previous === undefined) {
    return undefined;
  }

  const totalDelta = next.totalTicks - previous.totalTicks;
  const idleDelta = next.idleTicks - previous.idleTicks;

  // Counters may move backwards across topology or suspend/resume changes.
  if (totalDelta <= 0 || idleDelta < 0) {
    return undefined;
  }

  const busyRatio = 1 - idleDelta / totalDelta;

  return Math.min(100, Math.max(0, busyRatio * 100));
}

function ok(sensorId: string, value: number, unit: string, timestamp: string): Sample {
  return { sensorId, timestamp, status: 'ok', value, unit };
}

function missing(sensorId: string, timestamp: string, message: string): Sample {
  // Omit value entirely so consumers cannot mistake missing for a present undefined value.
  return { sensorId, timestamp, status: 'missing', message };
}

/** Keys owned by the OS baseline provider. Metadata comes from the shared vocabulary. */
const OS_KEYS = ['cpu.load', 'ram.used', 'ram.used.percent', 'ram.total'] as const;

export const OS_DESCRIPTORS: readonly SensorDescriptor[] = OS_KEYS.map((key) => {
  const declared = describeSemanticKey(key);

  if (declared === undefined) {
    throw new Error(`${key} is not in the semantic key vocabulary`);
  }

  return {
    sensorId: `${OS_PROVIDER_ID}:${key}`,
    semanticKey: key,
    label: declared.label,
    ...(declared.unit === undefined ? {} : { unit: declared.unit }),
    tier: 'baseline' as const,
  };
});

const BYTES_PER_GB = 1024 ** 3;

function unitFor(key: (typeof OS_KEYS)[number]): string {
  return describeSemanticKey(key)?.unit ?? '';
}

/** Converts two snapshots to requested samples only. */
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

/** Holds only the previous snapshot required to compute interval CPU load. */
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
    return { available: true };
  }
}
