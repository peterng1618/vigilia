import { describe, expect, it, vi } from 'vitest';
import type { Sample, SampleEntry } from '@vigilia/renderer-core';
import type { ProviderHealth, SensorDescriptor, SensorProvider } from './provider.js';
import { ProviderRegistry, unionOfKeys } from './registry.js';

const NOW = Date.parse('2026-01-01T00:00:10Z');

function sample(sensorId: string, value: number): Sample {
  return {
    sensorId,
    timestamp: new Date(NOW).toISOString(),
    status: 'ok',
    value,
    unit: '%',
  };
}

/** A provider that answers a fixed set of keys and records every call. */
function stubProvider(
  id: string,
  answers: Record<string, number>,
  options: { readonly failWith?: string } = {},
): SensorProvider & { readonly calls: string[][] } {
  const calls: string[][] = [];

  return {
    id,
    label: id,
    calls,
    describe(): Promise<readonly SensorDescriptor[]> {
      return Promise.resolve(
        Object.keys(answers).map((key) => ({
          sensorId: `${id}:${key}`,
          semanticKey: key,
          label: key,
          tier: 'baseline' as const,
        })),
      );
    },
    sample(semanticKeys: readonly string[]): Promise<readonly SampleEntry[]> {
      calls.push([...semanticKeys]);

      if (options.failWith !== undefined) {
        return Promise.reject(new Error(options.failWith));
      }

      return Promise.resolve(
        semanticKeys
          .filter((key) => key in answers)
          .map((key) => ({
            semanticKey: key,
            sample: sample(`${id}:${key}`, answers[key] ?? 0),
          })),
      );
    },
    health(): ProviderHealth {
      return { available: options.failWith === undefined };
    },
  };
}

describe('unionOfKeys', () => {
  it('merges what several displays need into one set', () => {
    expect(
      unionOfKeys([
        ['cpu.load', 'memory.used'],
        ['cpu.load', 'gpu.temp'],
      ]),
    ).toEqual(['cpu.load', 'gpu.temp', 'memory.used']);
  });

  it('is empty when nothing is displayed, so nothing gets polled (§111)', () => {
    expect(unionOfKeys([])).toEqual([]);
    expect(unionOfKeys([[], []])).toEqual([]);
  });

  it('is stable regardless of client order', () => {
    const a = unionOfKeys([['b', 'a'], ['c']]);
    const b = unionOfKeys([['c'], ['a', 'b']]);

    expect(a).toEqual(b);
  });
});

describe('ProviderRegistry', () => {
  it('polls each provider ONCE per cycle for the union, not once per client', async () => {
    const os = stubProvider('os', { 'cpu.load': 10 });
    const registry = new ProviderRegistry([os]);

    // Two phones both showing cpu.load is one key, and must be one poll.
    const keys = unionOfKeys([['cpu.load'], ['cpu.load']]);
    await registry.sample(keys, NOW);

    expect(os.calls).toEqual([['cpu.load']]);
  });

  it('does not poll at all when no display needs anything', async () => {
    const os = stubProvider('os', { 'cpu.load': 10 });
    const registry = new ProviderRegistry([os]);

    const cycle = await registry.sample([], NOW);

    expect(os.calls).toEqual([]);
    expect(cycle.entries).toEqual([]);
  });

  it('merges entries from several providers in one cycle', async () => {
    const registry = new ProviderRegistry([
      stubProvider('os', { 'cpu.load': 10 }),
      stubProvider('lhm', { 'cpu.temp.package': 65 }),
    ]);

    const cycle = await registry.sample(['cpu.load', 'cpu.temp.package'], NOW);

    expect(cycle.entries.map((entry) => entry.semanticKey).sort()).toEqual([
      'cpu.load',
      'cpu.temp.package',
    ]);
    expect(cycle.failures).toEqual([]);
  });

  describe('failure isolation', () => {
    it('keeps baseline telemetry when the extended provider throws', async () => {
      const os = stubProvider('os', { 'cpu.load': 10 });
      const lhm = stubProvider('lhm', { 'cpu.temp.package': 65 }, { failWith: 'LHM not running' });
      const registry = new ProviderRegistry([os, lhm]);

      const cycle = await registry.sample(['cpu.load', 'cpu.temp.package'], NOW);

      // The whole point: LHM being absent is normal, and must not take the
      // machine's CPU load down with it.
      expect(cycle.entries).toHaveLength(1);
      expect(cycle.entries[0]?.semanticKey).toBe('cpu.load');
      expect(cycle.failures).toEqual([{ providerId: 'lhm', message: 'LHM not running' }]);
    });

    it('isolates a failure regardless of precedence position', async () => {
      // A failing FIRST provider must not discard the second's results either
      // — which is what Promise.all would have done.
      const registry = new ProviderRegistry([
        stubProvider('os', { 'cpu.load': 10 }, { failWith: 'boom' }),
        stubProvider('lhm', { 'cpu.temp.package': 65 }),
      ]);

      const cycle = await registry.sample(['cpu.load', 'cpu.temp.package'], NOW);

      expect(cycle.entries.map((entry) => entry.semanticKey)).toEqual(['cpu.temp.package']);
      expect(cycle.failures.map((failure) => failure.providerId)).toEqual(['os']);
    });

    it('reports a key a failed provider owned as unmapped, not as zero (§83)', async () => {
      const registry = new ProviderRegistry([
        stubProvider('lhm', { 'cpu.temp.package': 65 }, { failWith: 'no web server' }),
      ]);

      const cycle = await registry.sample(['cpu.temp.package'], NOW);

      expect(cycle.entries).toEqual([]);
      expect(cycle.unmapped).toEqual(['cpu.temp.package']);
    });

    it('survives a provider rejecting with a non-Error', async () => {
      const registry = new ProviderRegistry([
        {
          id: 'rude',
          label: 'rude',
          describe: () => Promise.resolve([]),
          sample: () => Promise.reject('just a string'),
          health: () => ({ available: false }),
        },
      ]);

      const cycle = await registry.sample(['cpu.load'], NOW);

      expect(cycle.failures[0]).toMatchObject({ providerId: 'rude', message: 'just a string' });
    });
  });

  describe('ownership precedence', () => {
    it('gives an overlapping key to the earlier provider', async () => {
      // The spec's mapping table: the OS owns cpu.load even when LHM offers it.
      const registry = new ProviderRegistry([
        stubProvider('os', { 'cpu.load': 10 }),
        stubProvider('lhm', { 'cpu.load': 99 }),
      ]);

      const cycle = await registry.sample(['cpu.load'], NOW);

      expect(cycle.entries).toHaveLength(1);
      expect(cycle.entries[0]?.sample.sensorId).toBe('os:cpu.load');
      expect(cycle.entries[0]?.sample.value).toBe(10);
    });

    it('falls through to a later provider when the earlier one cannot answer', async () => {
      const registry = new ProviderRegistry([
        stubProvider('os', { 'cpu.load': 10 }),
        stubProvider('lhm', { 'cpu.temp.package': 65 }),
      ]);

      const cycle = await registry.sample(['cpu.temp.package'], NOW);

      expect(cycle.entries[0]?.sample.sensorId).toBe('lhm:cpu.temp.package');
    });
  });

  describe('unmapped keys', () => {
    it('reports a key nothing provides rather than inventing one (§97)', async () => {
      const registry = new ProviderRegistry([stubProvider('os', { 'cpu.load': 10 })]);

      const cycle = await registry.sample(['cpu.load', 'disk.nvme.queue-depth'], NOW);

      expect(cycle.unmapped).toEqual(['disk.nvme.queue-depth']);
      expect(cycle.entries.map((entry) => entry.semanticKey)).toEqual(['cpu.load']);
    });

    it('is empty when everything resolved', async () => {
      const registry = new ProviderRegistry([stubProvider('os', { 'cpu.load': 10 })]);

      expect((await registry.sample(['cpu.load'], NOW)).unmapped).toEqual([]);
    });
  });

  describe('describe', () => {
    it('tags every descriptor with the provider that owns it', async () => {
      const registry = new ProviderRegistry([
        stubProvider('os', { 'cpu.load': 10 }),
        stubProvider('lhm', { 'cpu.temp.package': 65 }),
      ]);

      const described = await registry.describe();

      expect(described).toEqual([
        expect.objectContaining({ semanticKey: 'cpu.load', providerId: 'os' }),
        expect.objectContaining({ semanticKey: 'cpu.temp.package', providerId: 'lhm' }),
      ]);
    });

    it('still lists healthy providers when one cannot describe itself', async () => {
      const broken: SensorProvider = {
        id: 'broken',
        label: 'broken',
        describe: () => Promise.reject(new Error('nope')),
        sample: () => Promise.resolve([]),
        health: () => ({ available: false }),
      };
      const registry = new ProviderRegistry([broken, stubProvider('os', { 'cpu.load': 10 })]);

      const described = await registry.describe();

      expect(described.map((descriptor) => descriptor.providerId)).toEqual(['os']);
    });
  });

  it('passes the host clock through to providers rather than letting each read its own', async () => {
    const spy = vi.fn(() => Promise.resolve([]));
    const registry = new ProviderRegistry([
      {
        id: 'os',
        label: 'os',
        describe: () => Promise.resolve([]),
        sample: spy,
        health: () => ({ available: true }),
      },
    ]);

    await registry.sample(['cpu.load'], NOW);

    // One clock per cycle keeps every sample in a batch comparable.
    expect(spy).toHaveBeenCalledWith(['cpu.load'], NOW);
  });
});
