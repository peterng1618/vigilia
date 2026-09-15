import type { SampleEntry, SensorTier } from '@vigilia/renderer-core';

/** Provider boundary: providers acquire; the host schedules and owns history. */

export type { SensorTier };

/** What a provider can read on this machine. */
export interface SensorDescriptor {
  /** Provider-local stable identity. Never derive identity from tree/array position. */
  readonly sensorId: string;
  /** Semantic key themes bind to. */
  readonly semanticKey: string;
  readonly label: string;
  readonly unit?: string;
  readonly tier: SensorTier;
}

/** Current provider availability; messages may reach a browser and must be redacted. */
export interface ProviderHealth {
  readonly available: boolean;
  readonly message?: string;
}

export interface SensorProvider {
  /** Stable provider id and sensor-id prefix. */
  readonly id: string;
  readonly label: string;

  describe(): Promise<readonly SensorDescriptor[]>;

  /** Reads requested keys only. Unsupported/unavailable values are omitted or non-ok, never zero. */
  sample(semanticKeys: readonly string[], nowMs: number): Promise<readonly SampleEntry[]>;

  health(): ProviderHealth;
}
