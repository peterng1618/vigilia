import type { Sample, SampleEntry } from "@vigilia/renderer-core";
import { describeSemanticKey } from "@vigilia/renderer-core";
import type {
  ProviderHealth,
  SensorDescriptor,
  SensorProvider,
} from "./provider.js";

/**
 * Hardware metrics come from `systeminformation` rather than a collector Vigilia
 * maintains (§97). The library owns the platform-specific reads; this provider
 * only maps its answers onto the semantic vocabulary and reports honestly when
 * the platform will not say.
 */

export const LIBRARY_PROVIDER_ID = "library";

const BYTES_PER_GB = 1024 ** 3;
const MEGABIT_PER_BYTE_PER_SECOND = 8 / 1_000_000;

/** The vocabulary slice this provider can answer on a typical machine. */
const LIBRARY_KEYS = [
  "cpu.load",
  "cpu.clock",
  "ram.used",
  "ram.used.percent",
  "ram.total",
  "gpu.load",
  "gpu.temp",
  "gpu.power",
  "vram.used",
  "vram.total",
  "vram.used.percent",
  "disk.used",
  "disk.used.percent",
  "disk.total",
  "network.download",
  "network.upload",
] as const;

export const LIBRARY_DESCRIPTORS: readonly SensorDescriptor[] =
  LIBRARY_KEYS.map((key) => {
    const declared = describeSemanticKey(key);

    if (declared === undefined) {
      throw new Error(`${key} is not in the semantic key vocabulary`);
    }

    return {
      sensorId: `${LIBRARY_PROVIDER_ID}:${key}`,
      semanticKey: key,
      label: declared.label,
      ...(declared.unit === undefined ? {} : { unit: declared.unit }),
      tier: declared.expectedTier,
    };
  });

/** One reading per key from the library, `undefined` where it cannot say. */
export interface LibraryReadings {
  readonly cpuLoad?: number;
  readonly cpuClockMhz?: number;
  readonly ramUsedGb?: number;
  readonly ramTotalGb?: number;
  readonly gpuLoad?: number;
  readonly gpuTempC?: number;
  readonly gpuPowerW?: number;
  readonly vramUsedGb?: number;
  readonly vramTotalGb?: number;
  readonly diskUsedGb?: number;
  readonly diskTotalGb?: number;
  readonly download?: number;
  readonly upload?: number;
}

interface MemLike {
  readonly total?: number;
  readonly active?: number;
}

interface FsSizeLike {
  readonly size?: number;
  readonly used?: number;
}

interface NetStatsLike {
  readonly rx_sec?: number | null;
  readonly tx_sec?: number | null;
}

interface ControllerLike {
  readonly utilizationGpu?: number | null;
  readonly temperatureGpu?: number | null;
  readonly powerDraw?: number | null;
  readonly memoryUsed?: number | null;
  readonly memoryTotal?: number | null;
  readonly vram?: number | null;
}

/** Keeps only finite numbers; a library `null` means "cannot read". */
function finite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function bytesToGb(value: unknown): number | undefined {
  const bytes = finite(value);
  return bytes === undefined ? undefined : bytes / BYTES_PER_GB;
}

/** Sums disk capacity across mounted filesystems, ignoring pseudo-mounts. */
function diskTotals(
  filesystems: readonly FsSizeLike[],
): { usedGb: number; totalGb: number } | undefined {
  let used = 0;
  let total = 0;
  let found = false;

  for (const fs of filesystems) {
    const size = finite(fs.size);
    const usedBytes = finite(fs.used);

    if (size === undefined || usedBytes === undefined || size <= 0) {
      continue;
    }

    total += size;
    used += usedBytes;
    found = true;
  }

  return found
    ? { usedGb: used / BYTES_PER_GB, totalGb: total / BYTES_PER_GB }
    : undefined;
}

/** Highest GPU value across controllers: one figure should describe the busiest. */
function highest(
  controllers: readonly ControllerLike[],
  pick: (controller: ControllerLike) => number | undefined,
): number | undefined {
  let best: number | undefined;

  for (const controller of controllers) {
    const value = pick(controller);
    if (value === undefined) continue;
    best = best === undefined ? value : Math.max(best, value);
  }

  return best;
}

/** Sums per-interface throughput: total host traffic, not one link's. */
function throughput(stats: readonly NetStatsLike[]):
  | {
      download: number;
      upload: number;
    }
  | undefined {
  let rx = 0;
  let tx = 0;
  let found = false;

  for (const stat of stats) {
    const down = finite(stat.rx_sec);
    const up = finite(stat.tx_sec);

    if (down === undefined && up === undefined) {
      continue;
    }

    rx += down ?? 0;
    tx += up ?? 0;
    found = true;
  }

  return found
    ? {
        download: rx * MEGABIT_PER_BYTE_PER_SECOND,
        upload: tx * MEGABIT_PER_BYTE_PER_SECOND,
      }
    : undefined;
}

/** Turns the library's raw answers into vocabulary readings. */
export function readingsFromLibrary(input: {
  readonly load?: { readonly currentLoad?: number } | undefined;
  readonly speed?: { readonly avg?: number } | undefined;
  readonly mem?: MemLike | undefined;
  readonly filesystems?: readonly FsSizeLike[] | undefined;
  readonly network?: readonly NetStatsLike[] | undefined;
  readonly controllers?: readonly ControllerLike[] | undefined;
}): LibraryReadings {
  const mem = input.mem;
  const totalGb = bytesToGb(mem?.total);
  // `active` is what the user means by "used"; `used` counts caches.
  const usedGb = bytesToGb(mem?.active);
  const disks =
    input.filesystems === undefined ? undefined : diskTotals(input.filesystems);
  const net =
    input.network === undefined ? undefined : throughput(input.network);
  const controllers = input.controllers ?? [];
  const vramTotalRaw = highest(controllers, (c) =>
    finite(c.vram ?? c.memoryTotal ?? undefined),
  );
  const vramUsedRaw = highest(controllers, (c) => finite(c.memoryUsed));

  return {
    ...(finite(input.load?.currentLoad) === undefined
      ? {}
      : { cpuLoad: finite(input.load?.currentLoad)! }),
    ...(finite(input.speed?.avg) === undefined
      ? {}
      : { cpuClockMhz: finite(input.speed?.avg)! * 1000 }),
    ...(usedGb === undefined ? {} : { ramUsedGb: usedGb }),
    ...(totalGb === undefined ? {} : { ramTotalGb: totalGb }),
    ...(highest(controllers, (c) => finite(c.utilizationGpu)) === undefined
      ? {}
      : { gpuLoad: highest(controllers, (c) => finite(c.utilizationGpu))! }),
    ...(highest(controllers, (c) => finite(c.temperatureGpu)) === undefined
      ? {}
      : { gpuTempC: highest(controllers, (c) => finite(c.temperatureGpu))! }),
    ...(highest(controllers, (c) => finite(c.powerDraw)) === undefined
      ? {}
      : { gpuPowerW: highest(controllers, (c) => finite(c.powerDraw))! }),
    ...(vramUsedRaw === undefined ? {} : { vramUsedGb: vramUsedRaw / 1024 }),
    ...(vramTotalRaw === undefined ? {} : { vramTotalGb: vramTotalRaw / 1024 }),
    ...(disks === undefined
      ? {}
      : { diskUsedGb: disks.usedGb, diskTotalGb: disks.totalGb }),
    ...(net === undefined
      ? {}
      : { download: net.download, upload: net.upload }),
  };
}

/** Values that answer a semantic key, in the unit the vocabulary declares. */
export function samplesFromLibrary(
  readings: LibraryReadings,
  semanticKeys: readonly string[],
  nowMs: number,
): readonly SampleEntry[] {
  const timestamp = new Date(nowMs).toISOString();
  const entries: SampleEntry[] = [];

  const push = (semanticKey: string, value: number | undefined): void => {
    if (!semanticKeys.includes(semanticKey)) {
      return;
    }

    const sensorId = `${LIBRARY_PROVIDER_ID}:${semanticKey}`;
    const declared = describeSemanticKey(semanticKey);

    if (value === undefined) {
      entries.push({
        semanticKey,
        sample: {
          sensorId,
          timestamp,
          status: "missing",
          message: "this machine reports no reading for that sensor",
        },
      });
      return;
    }

    const sample: Sample = {
      sensorId,
      timestamp,
      status: "ok",
      value,
      ...(declared?.unit === undefined ? {} : { unit: declared.unit }),
    };
    entries.push({ semanticKey, sample });
  };

  const ramPercent =
    readings.ramUsedGb !== undefined &&
    readings.ramTotalGb !== undefined &&
    readings.ramTotalGb > 0
      ? (readings.ramUsedGb / readings.ramTotalGb) * 100
      : undefined;
  const vramPercent =
    readings.vramUsedGb !== undefined &&
    readings.vramTotalGb !== undefined &&
    readings.vramTotalGb > 0
      ? (readings.vramUsedGb / readings.vramTotalGb) * 100
      : undefined;
  const diskPercent =
    readings.diskUsedGb !== undefined &&
    readings.diskTotalGb !== undefined &&
    readings.diskTotalGb > 0
      ? (readings.diskUsedGb / readings.diskTotalGb) * 100
      : undefined;

  push("cpu.load", readings.cpuLoad);
  push("cpu.clock", readings.cpuClockMhz);
  push("ram.used", readings.ramUsedGb);
  push("ram.used.percent", ramPercent);
  push("ram.total", readings.ramTotalGb);
  push("gpu.load", readings.gpuLoad);
  push("gpu.temp", readings.gpuTempC);
  push("gpu.power", readings.gpuPowerW);
  push("vram.used", readings.vramUsedGb);
  push("vram.used.percent", vramPercent);
  push("vram.total", readings.vramTotalGb);
  push("disk.used", readings.diskUsedGb);
  push("disk.used.percent", diskPercent);
  push("disk.total", readings.diskTotalGb);
  push("network.download", readings.download);
  push("network.upload", readings.upload);

  return entries;
}

type LibraryModule = {
  currentLoad(): Promise<{ currentLoad?: number }>;
  cpuCurrentSpeed(): Promise<{ avg?: number }>;
  mem(): Promise<MemLike>;
  fsSize(): Promise<readonly FsSizeLike[]>;
  networkStats(): Promise<readonly NetStatsLike[]>;
  graphics(): Promise<{ controllers?: readonly ControllerLike[] }>;
};

export class LibrarySensorProvider implements SensorProvider {
  readonly id = LIBRARY_PROVIDER_ID;
  readonly label = "System information (baseline)";

  private failure: string | undefined;

  constructor(private readonly library?: LibraryModule) {}

  /** Loaded lazily so a host that never needs metrics does not pay for it. */
  private async module(): Promise<LibraryModule> {
    if (this.library !== undefined) {
      return this.library;
    }

    const imported = await import("systeminformation");
    return (imported.default ?? imported) as unknown as LibraryModule;
  }

  async describe(): Promise<readonly SensorDescriptor[]> {
    return LIBRARY_DESCRIPTORS;
  }

  async sample(
    semanticKeys: readonly string[],
    nowMs: number,
  ): Promise<readonly SampleEntry[]> {
    const owned = semanticKeys.filter((key) =>
      (LIBRARY_KEYS as readonly string[]).includes(key),
    );

    if (owned.length === 0) {
      return [];
    }

    try {
      const library = await this.module();
      const [load, speed, mem, filesystems, network, graphics] =
        await Promise.all([
          library.currentLoad(),
          library.cpuCurrentSpeed(),
          library.mem(),
          library.fsSize(),
          library.networkStats(),
          library.graphics(),
        ]);

      this.failure = undefined;

      return samplesFromLibrary(
        readingsFromLibrary({
          load,
          speed,
          mem,
          filesystems,
          network,
          controllers: graphics.controllers ?? [],
        }),
        owned,
        nowMs,
      );
    } catch (error) {
      this.failure = error instanceof Error ? error.message : String(error);
      const timestamp = new Date(nowMs).toISOString();

      return owned.map((semanticKey) => ({
        semanticKey,
        sample: {
          sensorId: `${LIBRARY_PROVIDER_ID}:${semanticKey}`,
          timestamp,
          status: "missing" as const,
          message: `system information is unavailable: ${this.failure}`,
        },
      }));
    }
  }

  health(): ProviderHealth {
    return this.failure === undefined
      ? { available: true }
      : { available: false, message: this.failure };
  }
}
