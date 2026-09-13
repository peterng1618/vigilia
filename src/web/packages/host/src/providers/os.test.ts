import { describe, expect, it } from 'vitest';
import {
  cpuLoadBetween,
  OS_DESCRIPTORS,
  OsSensorProvider,
  readingsFromCpus,
  samplesFromReadings,
  type CpuTimes,
  type OsReadings,
} from './os.js';

const NOW = Date.parse('2026-01-01T00:00:10Z');
const GB = 1024 ** 3;

function times(user: number, idle: number): { readonly times: CpuTimes } {
  return { times: { user, nice: 0, sys: 0, idle, irq: 0 } };
}

function readings(overrides: Partial<OsReadings> = {}): OsReadings {
  return {
    idleTicks: 0,
    totalTicks: 0,
    cpuCount: 4,
    totalMemBytes: 16 * GB,
    freeMemBytes: 8 * GB,
    ...overrides,
  };
}

describe('readingsFromCpus', () => {
  it('sums every core into one snapshot', () => {
    const result = readingsFromCpus([times(10, 90), times(30, 70)], 16 * GB, 8 * GB);

    expect(result).toMatchObject({ idleTicks: 160, totalTicks: 200, cpuCount: 2 });
  });

  it('counts every busy category, not just user', () => {
    const result = readingsFromCpus(
      [{ times: { user: 1, nice: 2, sys: 4, idle: 8, irq: 16 } }],
      GB,
      0,
    );

    // Dropping nice/sys/irq would under-report load on a busy kernel.
    expect(result.totalTicks).toBe(31);
    expect(result.idleTicks).toBe(8);
  });

  it('handles no cores without dividing by anything', () => {
    expect(readingsFromCpus([], GB, 0)).toMatchObject({ cpuCount: 0, totalTicks: 0 });
  });
});

describe('cpuLoadBetween', () => {
  it('derives load from the CHANGE in ticks, not their absolute value', () => {
    // Absolute counters are cumulative since boot. 75% idle in the interval is
    // 25% load, regardless of how large the counters already were.
    const previous = readings({ idleTicks: 1_000_000, totalTicks: 2_000_000 });
    const next = readings({ idleTicks: 1_000_075, totalTicks: 2_000_100 });

    expect(cpuLoadBetween(previous, next)).toBeCloseTo(25);
  });

  it('reports a fully busy interval as 100', () => {
    expect(
      cpuLoadBetween(readings({ idleTicks: 0, totalTicks: 0 }), readings({ idleTicks: 0, totalTicks: 100 })),
    ).toBe(100);
  });

  it('reports a fully idle interval as 0', () => {
    expect(
      cpuLoadBetween(
        readings({ idleTicks: 0, totalTicks: 0 }),
        readings({ idleTicks: 100, totalTicks: 100 }),
      ),
    ).toBe(0);
  });

  it('cannot measure without a previous snapshot, and says so rather than guessing', () => {
    // undefined, never 0 — "not measured" and "idle" are different claims (§83).
    expect(cpuLoadBetween(undefined, readings({ totalTicks: 100 }))).toBeUndefined();
  });

  it('cannot measure across a zero-length interval', () => {
    const same = readings({ idleTicks: 50, totalTicks: 100 });

    expect(cpuLoadBetween(same, same)).toBeUndefined();
  });

  it.each([
    ['total ticks going backwards (suspend/resume)', { idleTicks: 40, totalTicks: 80 }],
    ['idle ticks going backwards (a core offlining)', { idleTicks: 40, totalTicks: 200 }],
  ])('refuses to compute when %s', (_label, nextOverrides) => {
    const previous = readings({ idleTicks: 50, totalTicks: 100 });

    expect(cpuLoadBetween(previous, readings(nextOverrides))).toBeUndefined();
  });
});

describe('samplesFromReadings', () => {
  const previous = readings({ idleTicks: 0, totalTicks: 0 });
  const next = readings({ idleTicks: 50, totalTicks: 100 });

  it('produces only the keys asked for (§111)', () => {
    const entries = samplesFromReadings(previous, next, NOW, ['cpu.load']);

    expect(entries.map((entry) => entry.semanticKey)).toEqual(['cpu.load']);
  });

  it('omits keys it does not own rather than inventing a status for them', () => {
    // Claiming `gpu.temp` is missing would misattribute another provider's gap
    // to this one. Absence is the registry's business to report.
    const entries = samplesFromReadings(previous, next, NOW, ['gpu.temp', 'cpu.load']);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.semanticKey).toBe('cpu.load');
  });

  it('reports an unmeasurable first cycle as missing WITHOUT a value (§83, §97)', () => {
    const entries = samplesFromReadings(undefined, next, NOW, ['cpu.load']);
    const sample = entries[0]?.sample;

    expect(sample?.status).toBe('missing');
    // The absence of the key is the assertion. A zero here would render as a
    // real reading of an idle CPU on every host start.
    expect(sample).not.toHaveProperty('value');
    expect(sample?.message).toBeTruthy();
  });

  it('converts memory to GB and percent from the same byte readings', () => {
    const entries = samplesFromReadings(previous, next, NOW, [
      'memory.used',
      'memory.used.percent',
      'memory.total',
    ]);
    const byKey = new Map(entries.map((entry) => [entry.semanticKey, entry.sample]));

    expect(byKey.get('memory.used')?.value).toBeCloseTo(8);
    expect(byKey.get('memory.used.percent')?.value).toBeCloseTo(50);
    expect(byKey.get('memory.total')?.value).toBeCloseTo(16);
  });

  it('refuses a percentage when total memory reads as zero', () => {
    const entries = samplesFromReadings(
      previous,
      readings({ idleTicks: 50, totalTicks: 100, totalMemBytes: 0, freeMemBytes: 0 }),
      NOW,
      ['memory.used.percent'],
    );

    expect(entries[0]?.sample.status).toBe('missing');
    expect(entries[0]?.sample).not.toHaveProperty('value');
  });

  it('stamps every sample with the passed clock, not the wall clock', () => {
    const entries = samplesFromReadings(previous, next, NOW, ['memory.total']);

    expect(entries[0]?.sample.timestamp).toBe('2026-01-01T00:00:10.000Z');
  });

  it('carries a unit on every ok sample, so the display need not guess', () => {
    const entries = samplesFromReadings(previous, next, NOW, [
      'cpu.load',
      'memory.used',
      'memory.used.percent',
      'memory.total',
    ]);

    for (const entry of entries) {
      expect(entry.sample.unit).toBeTruthy();
    }
  });
});

describe('OsSensorProvider', () => {
  it('describes only baseline sensors — it needs no driver (ADR-0004)', async () => {
    const provider = new OsSensorProvider();

    expect(await provider.describe()).toBe(OS_DESCRIPTORS);
    expect(OS_DESCRIPTORS.every((descriptor) => descriptor.tier === 'baseline')).toBe(true);
  });

  it('prefixes every sensor id with the provider id', () => {
    for (const descriptor of OS_DESCRIPTORS) {
      expect(descriptor.sensorId.startsWith('os:')).toBe(true);
    }
  });

  it('is always available, which is what makes it the baseline', () => {
    expect(new OsSensorProvider().health().available).toBe(true);
  });

  it('reads real CPU load once it has two snapshots to diff', async () => {
    const provider = new OsSensorProvider();

    // First call has nothing to diff against and must not fabricate.
    const first = await provider.sample(['cpu.load'], NOW);

    expect(first[0]?.sample.status).toBe('missing');

    // Burn real CPU so the second interval has ticks in it.
    const spinUntil = Date.now() + 120;
    let sink = 0;

    while (Date.now() < spinUntil) {
      sink += Math.random();
    }

    expect(sink).toBeGreaterThan(0);

    const second = await provider.sample(['cpu.load'], NOW + 120);
    const sample = second[0]?.sample;

    expect(sample?.status).toBe('ok');
    expect(sample?.value).toBeGreaterThanOrEqual(0);
    expect(sample?.value).toBeLessThanOrEqual(100);
  });

  it('reads real memory from the machine it runs on', async () => {
    const provider = new OsSensorProvider();
    const entries = await provider.sample(['memory.total', 'memory.used.percent'], NOW);
    const byKey = new Map(entries.map((entry) => [entry.semanticKey, entry.sample]));

    // A real machine has more than zero and less than 100% of its memory used.
    expect(byKey.get('memory.total')?.value).toBeGreaterThan(0);
    expect(byKey.get('memory.used.percent')?.value).toBeGreaterThan(0);
    expect(byKey.get('memory.used.percent')?.value).toBeLessThan(100);
  });
});
