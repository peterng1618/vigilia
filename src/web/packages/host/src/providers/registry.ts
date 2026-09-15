import type { SampleEntry } from '@vigilia/renderer-core';
import type { SensorDescriptor, SensorProvider } from './provider.js';

/** Scheduler: polls the requested-key union once and isolates provider failures. */

export interface ProviderFailure {
  readonly providerId: string;
  /** May reach a browser; keep redacted. */
  readonly message: string;
}

export interface SampleCycle {
  readonly entries: readonly SampleEntry[];
  readonly failures: readonly ProviderFailure[];
  /** Requested keys no provider answered. */
  readonly unmapped: readonly string[];
}

export interface DescribedSensor extends SensorDescriptor {
  readonly providerId: string;
}

/** Stable sorted union of keys requested by active clients. */
export function unionOfKeys(perClientKeys: Iterable<readonly string[]>): readonly string[] {
  const union = new Set<string>();

  for (const keys of perClientKeys) {
    for (const key of keys) {
      union.add(key);
    }
  }

  return [...union].sort();
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class ProviderRegistry {
  /** Providers are ordered by precedence; the first provider to answer a key owns it. */
  constructor(private readonly providers: readonly SensorProvider[]) {}

  async describe(): Promise<readonly DescribedSensor[]> {
    const settled = await Promise.allSettled(
      this.providers.map(async (provider) => {
        const descriptors = await provider.describe();

        return descriptors.map((descriptor) => ({
          ...descriptor,
          providerId: provider.id,
        }));
      }),
    );

    return settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
  }

  /** Polls providers concurrently and preserves successful results when another fails. */
  async sample(semanticKeys: readonly string[], nowMs: number): Promise<SampleCycle> {
    if (semanticKeys.length === 0) {
      return { entries: [], failures: [], unmapped: [] };
    }

    const settled = await Promise.allSettled(
      this.providers.map((provider) => provider.sample(semanticKeys, nowMs)),
    );

    const entries: SampleEntry[] = [];
    const failures: ProviderFailure[] = [];
    const claimed = new Set<string>();

    settled.forEach((result, index) => {
      const provider = this.providers[index];

      if (provider === undefined) {
        return;
      }

      if (result.status === 'rejected') {
        failures.push({ providerId: provider.id, message: describeError(result.reason) });
        return;
      }

      for (const entry of result.value) {
        // Keep the earliest provider's answer for each semantic key.
        if (claimed.has(entry.semanticKey)) {
          continue;
        }

        claimed.add(entry.semanticKey);
        entries.push(entry);
      }
    });

    return {
      entries,
      failures,
      unmapped: semanticKeys.filter((key) => !claimed.has(key)),
    };
  }
}
