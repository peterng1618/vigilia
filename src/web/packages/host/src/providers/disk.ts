import fs from "node:fs/promises";
import type { Sample, SampleEntry } from "@vigilia/renderer-core";
import { describeSemanticKey } from "@vigilia/renderer-core";
import type {
  ProviderHealth,
  SensorDescriptor,
  SensorProvider,
} from "./provider.js";

/** Baseline no-driver disk provider. `fs.statfs` is the whole source: the
 * capacity numbers a filesystem already reports, with no driver and no
 * elevation. Usage is a snapshot, so unlike CPU load it needs no delta. */

export const DISK_PROVIDER_ID = "disk";

/** The volume Vigilia reports on. One filesystem keeps the semantic keys
 * unambiguous; a per-volume key fan-out is a separate product decision. */
export const DISK_ROOT = process.platform === "win32" ? "C:\\" : "/";

export interface DiskReadings {
  readonly totalBytes: number;
  readonly freeBytes: number;
}

export function readingsFromStatfs(stat: {
  readonly bsize: number;
  readonly blocks: number;
  readonly bfree: number;
}): DiskReadings {
  return {
    totalBytes: stat.bsize * stat.blocks,
    freeBytes: stat.bsize * stat.bfree,
  };
}

const DISK_KEYS = ["disk.used", "disk.used.percent", "disk.total"] as const;

export const DISK_DESCRIPTORS: readonly SensorDescriptor[] = DISK_KEYS.map(
  (key) => {
    const declared = describeSemanticKey(key);

    if (declared === undefined) {
      throw new Error(`${key} is not in the semantic key vocabulary`);
    }

    return {
      sensorId: `${DISK_PROVIDER_ID}:${key}`,
      semanticKey: key,
      label: declared.label,
      ...(declared.unit === undefined ? {} : { unit: declared.unit }),
      tier: "baseline" as const,
    };
  },
);

const BYTES_PER_GB = 1024 ** 3;

function unitFor(key: (typeof DISK_KEYS)[number]): string {
  return describeSemanticKey(key)?.unit ?? "";
}

function ok(
  sensorId: string,
  value: number,
  unit: string,
  timestamp: string,
): Sample {
  return { sensorId, timestamp, status: "ok", value, unit };
}

function missing(sensorId: string, timestamp: string, message: string): Sample {
  return { sensorId, timestamp, status: "missing", message };
}

/** Converts one snapshot to the requested samples only. */
export function samplesFromDisk(
  readings: DiskReadings,
  nowMs: number,
  semanticKeys: readonly string[],
): readonly SampleEntry[] {
  const timestamp = new Date(nowMs).toISOString();
  const wanted = new Set(semanticKeys);
  const entries: SampleEntry[] = [];
  const usedBytes = readings.totalBytes - readings.freeBytes;

  if (wanted.has("disk.used")) {
    entries.push({
      semanticKey: "disk.used",
      sample: ok(
        `${DISK_PROVIDER_ID}:disk.used`,
        usedBytes / BYTES_PER_GB,
        unitFor("disk.used"),
        timestamp,
      ),
    });
  }

  if (wanted.has("disk.used.percent")) {
    const sensorId = `${DISK_PROVIDER_ID}:disk.used.percent`;

    entries.push({
      semanticKey: "disk.used.percent",
      sample:
        readings.totalBytes > 0
          ? ok(
              sensorId,
              (usedBytes / readings.totalBytes) * 100,
              unitFor("disk.used.percent"),
              timestamp,
            )
          : missing(sensorId, timestamp, "the volume reported no capacity"),
    });
  }

  if (wanted.has("disk.total")) {
    entries.push({
      semanticKey: "disk.total",
      sample: ok(
        `${DISK_PROVIDER_ID}:disk.total`,
        readings.totalBytes / BYTES_PER_GB,
        unitFor("disk.total"),
        timestamp,
      ),
    });
  }

  return entries;
}

export class DiskSensorProvider implements SensorProvider {
  readonly id = DISK_PROVIDER_ID;
  readonly label = "Disk capacity (baseline)";

  constructor(private readonly root: string = DISK_ROOT) {}

  private failure: string | undefined;

  async describe(): Promise<readonly SensorDescriptor[]> {
    return DISK_DESCRIPTORS;
  }

  async sample(
    semanticKeys: readonly string[],
    nowMs: number,
  ): Promise<readonly SampleEntry[]> {
    if (
      !semanticKeys.some((key) =>
        (DISK_KEYS as readonly string[]).includes(key),
      )
    ) {
      return [];
    }

    const timestamp = new Date(nowMs).toISOString();

    try {
      const readings = readingsFromStatfs(await fs.statfs(this.root));
      this.failure = undefined;
      return samplesFromDisk(readings, nowMs, semanticKeys);
    } catch (error) {
      // An unreadable volume is reportable state, never a fabricated zero.
      this.failure = error instanceof Error ? error.message : String(error);
      return semanticKeys
        .filter((key) => (DISK_KEYS as readonly string[]).includes(key))
        .map((semanticKey) => ({
          semanticKey,
          sample: missing(
            `${DISK_PROVIDER_ID}:${semanticKey}`,
            timestamp,
            `could not read ${this.root}: ${this.failure}`,
          ),
        }));
    }
  }

  health(): ProviderHealth {
    return this.failure === undefined
      ? { available: true }
      : { available: false, message: this.failure };
  }
}
