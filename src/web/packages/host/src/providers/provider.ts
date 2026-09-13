import type { SampleEntry } from '@vigilia/renderer-core';

/**
 * The provider boundary: **providers acquire, the host schedules** (§116).
 *
 * A provider must never start a timer, cache history, or push a sample. It
 * answers {@link SensorProvider.sample} when the registry asks. That rule is
 * what makes "opening a second phone must not double upstream polling" (§111)
 * a property of one scheduler rather than a hope about every provider.
 *
 * It is also what keeps ADR-0007 cheap to revisit: if Node's baseline
 * telemetry turns out worse than `psutil`, Python re-enters as one provider
 * behind this interface — not as the host.
 */

/**
 * Which sensors need privileged access (ADR-0004).
 *
 * Tiers are **discovered and reported, never hardcoded**: a machine without
 * the driver reports its extended sensors unavailable rather than pretending
 * the tier does not exist.
 */
export type SensorTier = 'baseline' | 'extended';

/** What a provider says it can read. */
export interface SensorDescriptor {
  /**
   * Provider-local and stable across restarts.
   *
   * **Tree or array position is never identity.** Position shifts when
   * hardware is added, and a theme bound to position would silently follow the
   * wrong sensor. Use the strongest stable identifier the provider exposes.
   */
  readonly sensorId: string;
  /** The semantic key themes bind to (§93). */
  readonly semanticKey: string;
  /** Human-readable, for the mapping UI. */
  readonly label: string;
  readonly unit?: string;
  readonly tier: SensorTier;
}

/** Whether a provider can currently be read, and why not if it cannot. */
export interface ProviderHealth {
  readonly available: boolean;
  /** Pre-redacted (§101): this reaches a browser. */
  readonly message?: string;
}

export interface SensorProvider {
  /** Stable, and the prefix of every `sensorId` this provider emits. */
  readonly id: string;
  readonly label: string;

  /** What this provider can read here, now. */
  describe(): Promise<readonly SensorDescriptor[]>;

  /**
   * Reads the requested semantic keys.
   *
   * Asked only for keys active displays need (§111). A key this provider
   * cannot read is **omitted or returned with a non-ok status — never zero**
   * (§83, §97).
   */
  sample(semanticKeys: readonly string[], nowMs: number): Promise<readonly SampleEntry[]>;

  health(): ProviderHealth;
}
