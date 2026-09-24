/** LibreHardwareMonitor's `data.json` tree (§97). LHM is an optional external
 * prebuilt program, never a linked library, so this reads its published JSON
 * and translates nothing it does not have. */

export interface LhmSensor {
  /** LHM's own identifier, e.g. `/intelcpu/0/temperature/2`. */
  readonly sensorId: string;
  /** Hardware node path this sensor sits under, e.g. `/intelcpu/0`. */
  readonly hardwareId: string;
  /** Hardware group name, e.g. `GpuNvidia`, `Storage`, `Network`. */
  readonly hardwareType: string;
  readonly text: string;
  /** LHM's sensor kind, e.g. `Temperature`, `Load`, `Throughput`, `Data`. */
  readonly type: string;
  /**
   * Unformatted SI value from `RawValue`. LHM emits `"NaN"` for a sensor it
   * cannot read; that is a gap, never a zero.
   */
  readonly value: number | undefined;
}

interface LhmNode {
  readonly Text?: unknown;
  readonly SensorId?: unknown;
  readonly Type?: unknown;
  readonly HardwareId?: unknown;
  readonly RawValue?: unknown;
  readonly Children?: unknown;
}

function asRecord(value: unknown): LhmNode | undefined {
  return typeof value === "object" && value !== null
    ? (value as LhmNode)
    : undefined;
}

/** LHM writes named floating-point literals for values it could not read. */
function numeric(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Flattens the tree to its readable sensors. A sensor node is the one carrying
 * both `SensorId` and `RawValue`; every other node is a container whose group
 * type the walk remembers.
 */
export function flattenLhmSensors(payload: unknown): readonly LhmSensor[] {
  const root = asRecord(payload);
  const children = root === undefined ? undefined : root["Children"];

  if (!Array.isArray(children)) {
    return [];
  }

  const sensors: LhmSensor[] = [];

  const walk = (
    node: LhmNode,
    hardwareId: string,
    hardwareType: string,
  ): void => {
    const ownHardwareId =
      typeof node.HardwareId === "string" ? node.HardwareId : hardwareId;
    // A hardware node's type is its own `Text` ("GpuNvidia", "Storage", ...).
    const ownHardwareType =
      typeof node.HardwareId === "string" && typeof node.Text === "string"
        ? node.Text
        : hardwareType;

    if (typeof node.SensorId === "string" && typeof node.Type === "string") {
      sensors.push({
        sensorId: node.SensorId,
        hardwareId: ownHardwareId,
        hardwareType: ownHardwareType,
        text: typeof node.Text === "string" ? node.Text : "",
        type: node.Type,
        value: numeric(node["RawValue"]),
      });
    }

    if (!Array.isArray(node.Children)) {
      return;
    }

    for (const child of node.Children) {
      const record = asRecord(child);
      if (record !== undefined) {
        walk(record, ownHardwareId, ownHardwareType);
      }
    }
  };

  for (const child of children) {
    const record = asRecord(child);
    if (record !== undefined) {
      walk(record, "", "");
    }
  }

  return sensors;
}
