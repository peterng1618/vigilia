import type { SampleEntry } from '@vigilia/renderer-core';
import type { SensorDescriptor, SensorProvider } from './provider.js';

/**
 * The scheduler: it owns *when*, providers own *what* (§116).
 *
 * Two rules live here and nowhere else, because both are properties of the
 * scheduler rather than of any provider:
 *
 * - **One poll per cycle for the union of keys active displays need** (§111).
 *   Opening a second phone adds keys to a set; it does not add a poll. If this
 *   were per-client, two phones showing the same dashboard would double the
 *   load on the hardware the dashboard is measuring.
 * - **A failing provider is isolated.** LHM missing, not running, or answering
 *   with nonsense must not stop baseline telemetry. The sample cycle therefore
 *   settles every provider independently and records failures instead of
 *   propagating the first one.
 */

/** What one provider did during a cycle, when it did not succeed. */
export interface ProviderFailure {
  readonly providerId: string;
  /** Pre-redacted (§101): this can reach a browser. */
  readonly message: string;
}

export interface SampleCycle {
  readonly entries: readonly SampleEntry[];
  readonly failures: readonly ProviderFailure[];
  /** Requested keys no provider answered. Reported, never fabricated (§97). */
  readonly unmapped: readonly string[];
}

export interface DescribedSensor extends SensorDescriptor {
  readonly providerId: string;
}

/**
 * The union of semantic keys a set of displays needs.
 *
 * Pure, and deliberately a `Set` fed by many clients: this is the function
 * that makes a second phone free. Sorted so a cycle's key order — and so the
 * shape of anything logged about it — is stable rather than insertion-ordered.
 */
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
  /**
   * @param providers In **precedence order**. Where two providers can answer
   *   the same semantic key, the earlier one wins — which is how the spec's
   *   ownership table is enforced: the OS baseline provider is registered
   *   first, so a dashboard of baseline metrics never acquires a dependency on
   *   LibreHardwareMonitor for data the OS already exposes reliably.
   */
  constructor(private readonly providers: readonly SensorProvider[]) {}

  /** Every sensor every healthy provider can read, with its provider's id. */
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

  /**
   * Polls every provider once for the requested keys.
   *
   * Providers run concurrently and are settled independently — `allSettled`,
   * not `all`. With `all`, one provider rejecting would discard the successful
   * results of every other provider in the same cycle, which is precisely the
   * failure isolation this class exists to provide.
   */
  async sample(semanticKeys: readonly string[], nowMs: number): Promise<SampleCycle> {
    if (semanticKeys.length === 0) {
      // Nothing is being displayed, so nothing is acquired. §111 asks for
      // exactly this: no active client means no upstream polling.
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
        // First provider in precedence order to answer a key owns it. A later
        // provider's duplicate is dropped rather than overwriting, so adding a
        // provider cannot silently re-point an existing dashboard.
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
