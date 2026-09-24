import type { LhmSensor } from "./lhm-tree.js";

/** Which LHM sensor answers which Vigilia semantic key. Modelled on explicit
 * sensor names and LHM sensor kinds, never on provider instance identity (§93). */

/** LHM's `SensorType`, spelling its kind as `data.json` reports it. */
export type LhmSensorType =
  | "Temperature"
  | "Load"
  | "Power"
  | "Clock"
  | "Fan"
  | "Data"
  | "Throughput"
  | "Level"
  | "Voltage"
  | "Current";

export interface LhmBinding {
  readonly semanticKey: string;
  /** Hardware group the sensor must sit under, e.g. `GpuNvidia`. */
  readonly hardwareType?: string;
  readonly type: LhmSensorType;
  /** Exact LHM sensor name, when the name is unambiguous. */
  readonly text?: string;
  /** Accepted names, first match wins. */
  readonly anyText?: readonly string[];
  /** Converts LHM's SI value to the unit the vocabulary declares. */
  readonly scale?: number;
}

const MEGABIT_PER_BYTE_PER_SECOND = 8 / 1_000_000;

/** CPU, GPU and memory bindings, in priority order within each key. */
const BINDINGS: readonly LhmBinding[] = [
  // CPU
  {
    semanticKey: "cpu.temp",
    hardwareType: "Cpu",
    type: "Temperature",
    anyText: ["CPU Package", "Core Average", "CPU Total"],
  },
  {
    semanticKey: "cpu.power",
    hardwareType: "Cpu",
    type: "Power",
    anyText: ["Package", "CPU Package"],
  },
  {
    semanticKey: "cpu.clock",
    hardwareType: "Cpu",
    type: "Clock",
    anyText: ["Cores (Average)", "Core Average"],
  },
  { semanticKey: "cpu.fan", hardwareType: "Cpu", type: "Fan" },

  // GPU
  {
    semanticKey: "gpu.load",
    hardwareType: "GpuNvidia",
    type: "Load",
    anyText: ["GPU Core", "D3D 3D"],
  },
  {
    semanticKey: "gpu.load",
    hardwareType: "GpuAmd",
    type: "Load",
    anyText: ["GPU Core", "D3D 3D"],
  },
  {
    semanticKey: "gpu.temp",
    hardwareType: "GpuNvidia",
    type: "Temperature",
    anyText: ["GPU Core"],
  },
  {
    semanticKey: "gpu.temp",
    hardwareType: "GpuAmd",
    type: "Temperature",
    anyText: ["GPU Core"],
  },
  {
    semanticKey: "gpu.power",
    hardwareType: "GpuNvidia",
    type: "Power",
    anyText: ["GPU Package", "GPU Power"],
  },
  {
    semanticKey: "gpu.power",
    hardwareType: "GpuAmd",
    type: "Power",
    anyText: ["GPU Package", "GPU Power"],
  },
  {
    semanticKey: "gpu.clock",
    hardwareType: "GpuNvidia",
    type: "Clock",
    anyText: ["GPU Core"],
  },
  {
    semanticKey: "gpu.clock",
    hardwareType: "GpuAmd",
    type: "Clock",
    anyText: ["GPU Core"],
  },
  { semanticKey: "gpu.fan", hardwareType: "GpuNvidia", type: "Fan" },
  { semanticKey: "gpu.fan", hardwareType: "GpuAmd", type: "Fan" },

  // VRAM: LHM reports `Data` in GB for memory, `Load` in % for its share.
  {
    semanticKey: "vram.used",
    hardwareType: "GpuNvidia",
    type: "Data",
    anyText: ["GPU Memory Used"],
  },
  {
    semanticKey: "vram.used",
    hardwareType: "GpuAmd",
    type: "Data",
    anyText: ["GPU Memory Used"],
  },
  {
    semanticKey: "vram.total",
    hardwareType: "GpuNvidia",
    type: "Data",
    anyText: ["GPU Memory Total"],
  },
  {
    semanticKey: "vram.total",
    hardwareType: "GpuAmd",
    type: "Data",
    anyText: ["GPU Memory Total"],
  },
  {
    semanticKey: "vram.used.percent",
    hardwareType: "GpuNvidia",
    type: "Load",
    anyText: ["GPU Memory"],
  },
  {
    semanticKey: "vram.used.percent",
    hardwareType: "GpuAmd",
    type: "Load",
    anyText: ["GPU Memory"],
  },

  // Disk capacity. `Used Space` is `SensorType.Load` yet carries a percentage
  // (LHM computes `100 - free/total`), so it answers only the percent key.
  // `disk.used` is derived from Total minus Free; see `deriveDiskUsed`.
  {
    semanticKey: "disk.used.percent",
    hardwareType: "Storage",
    type: "Load",
    anyText: ["Used Space"],
  },
  {
    semanticKey: "disk.total",
    hardwareType: "Storage",
    type: "Data",
    anyText: ["Total Space"],
  },
  {
    semanticKey: "disk.free",
    hardwareType: "Storage",
    type: "Data",
    anyText: ["Free Space"],
  },

  // Network: LHM's `Throughput` is bytes per second; the vocabulary is Mb/s.
  {
    semanticKey: "network.download",
    hardwareType: "Network",
    type: "Throughput",
    anyText: ["Download Speed"],
  },
  {
    semanticKey: "network.upload",
    hardwareType: "Network",
    type: "Throughput",
    anyText: ["Upload Speed"],
  },
];

/** LHM already reports  in GB, which is the vocabulary unit,
 * so it needs no conversion — only Throughput does. */
const DATA_SCALE = 1;

/**
 * `disk.used` has no direct LHM sensor: LHM exposes `Total Space` and
 * `Free Space` in GB and a `Used Space` that is really a percentage. Deriving
 * from the two GB figures keeps the unit the vocabulary promises.
 */
function deriveDiskUsed(sensors: readonly LhmSensor[]): number | undefined {
  const total = sumByType(sensors, ["Total Space"]);
  const free = sumByType(sensors, ["Free Space"]);

  return total === undefined || free === undefined ? undefined : total - free;
}

function sumByType(
  sensors: readonly LhmSensor[],
  names: readonly string[],
): number | undefined {
  let sum = 0;
  let found = false;

  for (const sensor of sensors) {
    if (sensor.value === undefined || !names.includes(sensor.text)) {
      continue;
    }

    sum += scaleFor({ semanticKey: "", type: "Data" }, sensor.value);
    found = true;
  }

  return found ? sum : undefined;
}

function matches(binding: LhmBinding, sensor: LhmSensor): boolean {
  if (sensor.type !== binding.type) {
    return false;
  }

  if (
    binding.hardwareType !== undefined &&
    sensor.hardwareType !== binding.hardwareType
  ) {
    return false;
  }

  if (binding.text !== undefined) {
    return sensor.text === binding.text;
  }

  if (binding.anyText !== undefined) {
    return binding.anyText.includes(sensor.text);
  }

  // No name constraint: any sensor of this kind under this hardware group.
  return true;
}

/** Converts a raw LHM value to the unit the vocabulary declares for the key. */
export function scaleFor(binding: LhmBinding, value: number): number {
  if (binding.scale !== undefined) {
    return value * binding.scale;
  }

  if (binding.type === "Data") {
    return value * DATA_SCALE;
  }

  if (binding.type === "Throughput") {
    return value * MEGABIT_PER_BYTE_PER_SECOND;
  }

  return value;
}

export interface LhmMatch {
  readonly semanticKey: string;
  readonly sensor: LhmSensor;
  readonly value: number;
}

/**
 * First sensor that answers each key. Multiple hardware instances of one group
 * (two GPUs, several disks) are aggregated: `Data` and `Throughput` sum, while
 * `Load`, `Temperature`, `Power` and `Clock` take the highest, which is what a
 * single figure for that key should mean.
 */
export function matchLhmSensors(
  sensors: readonly LhmSensor[],
  semanticKeys: readonly string[],
): readonly LhmMatch[] {
  const wanted = new Set(semanticKeys);
  const chosen = new Map<string, LhmMatch>();

  for (const binding of BINDINGS) {
    // `disk.free` is a derivation input, not a semantic key.
    if (
      binding.semanticKey === "disk.free" ||
      !wanted.has(binding.semanticKey)
    ) {
      continue;
    }

    for (const sensor of sensors) {
      if (sensor.value === undefined || !matches(binding, sensor)) {
        continue;
      }

      const value = scaleFor(binding, sensor.value);
      const existing = chosen.get(binding.semanticKey);

      if (existing === undefined) {
        chosen.set(binding.semanticKey, {
          semanticKey: binding.semanticKey,
          sensor,
          value,
        });
        continue;
      }

      const combines = binding.type === "Data" || binding.type === "Throughput";
      const next = combines
        ? existing.value + value
        : Math.max(existing.value, value);

      chosen.set(binding.semanticKey, { ...existing, value: next });
    }
  }

  if (wanted.has("disk.used") && !chosen.has("disk.used")) {
    const used = deriveDiskUsed(sensors);
    const total = sumByType(sensors, ["Total Space"]);

    if (used !== undefined && total !== undefined && total > 0) {
      chosen.set("disk.used", {
        semanticKey: "disk.used",
        sensor: {
          sensorId: "derived",
          hardwareId: "",
          hardwareType: "Storage",
          text: "Used Space (derived)",
          type: "Data",
          value: used,
        },
        value: used,
      });
    }
  }

  return [...chosen.values()];
}
