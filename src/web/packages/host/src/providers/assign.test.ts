import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { matchLhmSensors, matchLhmSensorsAssigned } from "./lhm-mapping.js";
import { flattenLhmSensors } from "./lhm-tree.js";

/** The captured real payload: one GPU, four drives. */
function realSensors() {
  return flattenLhmSensors(
    JSON.parse(
      readFileSync(
        fileURLToPath(new URL("./__fixtures__/real-lhm.json", import.meta.url)),
        "utf8",
      ),
    ),
  );
}

describe("device assignment", () => {
  it("changes which GPU answers the theme's gpu.* keys", () => {
    const sensors = [
      ...realSensors(),
      // A second GPU, so "the highest reading" and "the chosen one" differ.
      {
        sensorId: "/gpu-amd/0/load/0",
        hardwareId: "/gpu-amd/0",
        hardwareType: "AMD Radeon RX 6800",
        text: "GPU Core",
        type: "Load",
        value: 99,
      },
      {
        sensorId: "/gpu-amd/0/temperature/0",
        hardwareId: "/gpu-amd/0",
        hardwareType: "AMD Radeon RX 6800",
        text: "GPU Core",
        type: "Temperature",
        value: 88,
      },
    ];

    // Unassigned: the highest reading wins, as before.
    const unassigned = new Map(
      matchLhmSensorsAssigned(sensors, ["gpu.load", "gpu.temp"], {}).map(
        (m) => [m.semanticKey, m.value],
      ),
    );
    expect(unassigned.get("gpu.load")).toBe(99);

    // Assigned to the NVIDIA card: the theme's single gpu.load must follow it,
    // even though the AMD card reads higher.
    const chosen = new Map(
      matchLhmSensorsAssigned(sensors, ["gpu.load", "gpu.temp"], {
        gpu: "nvidia-geforce-rtx-3080-ti",
      }).map((m) => [m.semanticKey, m.value]),
    );
    expect(chosen.get("gpu.load")).toBeLessThan(99);
    expect(chosen.get("gpu.temp")).toBeLessThan(88);
  });

  it("changes which drive the system-disk keys describe", () => {
    const sensors = realSensors();

    const all = new Map(
      matchLhmSensorsAssigned(sensors, ["disk.total"], {}).map((m) => [
        m.semanticKey,
        m.value,
      ]),
    );
    // Every drive summed.
    expect(all.get("disk.total")).toBeGreaterThan(1000);

    const one = new Map(
      matchLhmSensorsAssigned(sensors, ["disk.total"], {
        systemDisk: "lexar-500gb-ssd",
      }).map((m) => [m.semanticKey, m.value]),
    );
    // Just the chosen SSD.
    expect(one.get("disk.total")).toBeCloseTo(500.1, 1);
  });

  it("leaves other groups untouched when only one is assigned", () => {
    const sensors = realSensors();

    const assigned = new Map(
      matchLhmSensorsAssigned(sensors, ["cpu.temp", "cpu.fan"], {
        systemDisk: "lexar-500gb-ssd",
      }).map((m) => [m.semanticKey, m.value]),
    );

    expect(assigned.get("cpu.temp")).toBeGreaterThan(0);
    expect(assigned.get("cpu.fan")).toBeGreaterThan(0);
  });

  it("falls back to the default when the assigned device is gone", () => {
    // A drive removed after it was chosen: the keys must report a gap, not a
    // reading from a different drive.
    const assigned = matchLhmSensorsAssigned(realSensors(), ["disk.total"], {
      systemDisk: "drive-that-was-removed",
    });

    expect(assigned).toEqual([]);
  });

  it("behaves exactly as before when nothing is assigned", () => {
    const sensors = realSensors();
    const keys = ["cpu.temp", "gpu.load", "disk.total", "network.download"];

    expect(matchLhmSensorsAssigned(sensors, keys, {})).toEqual(
      matchLhmSensors(sensors, keys),
    );
  });
});
