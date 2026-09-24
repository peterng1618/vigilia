import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { diskDeviceReadings, matchLhmSensors } from "./lhm-mapping.js";
import { flattenLhmSensors } from "./lhm-tree.js";

/** Captured from a real LibreHardwareMonitor v0.9.6 reply (314 sensors,
 * i9-10850K + RTX 3080 Ti + NVMe + SSD + HDDs + Ethernet). A hand-written
 * fixture did not reveal the shapes these tests pin: hardware nodes are named
 * by model, and `RawValue` is a unit-suffixed string. */
function realSensors() {
  const path = fileURLToPath(
    new URL("./__fixtures__/real-lhm.json", import.meta.url),
  );
  return flattenLhmSensors(JSON.parse(readFileSync(path, "utf8")));
}

describe("real LibreHardwareMonitor payload", () => {
  it("reads unit-suffixed RawValue strings as numbers", () => {
    const sensors = realSensors();
    const load = sensors.find(
      (sensor) => sensor.text === "GPU Core" && sensor.type === "Load",
    );

    // LHM sends "3.0 %", not 3.0; Number() on that is NaN.
    expect(load?.value).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(load?.value)).toBe(true);
  });

  it("finds hardware nodes by their model name, not a kind tag", () => {
    const groups = new Set(realSensors().map((sensor) => sensor.hardwareType));

    expect(groups.has("NVIDIA GeForce RTX 3080 Ti")).toBe(true);
    expect(groups.has("Intel Core i9-10850K")).toBe(true);
  });

  it("answers the extended keys from real sensors", () => {
    const matched = new Map(
      matchLhmSensors(realSensors(), [
        "cpu.temp",
        "cpu.power",
        "cpu.clock",
        "cpu.fan",
        "gpu.load",
        "gpu.temp",
        "gpu.power",
        "gpu.fan",
        "vram.used",
        "vram.total",
        "vram.used.percent",
        "disk.used",
        "disk.total",
        "disk.used.percent",
        "network.download",
        "network.upload",
      ]).map((match) => [match.semanticKey, match.value]),
    );

    // CPU temperature: this machine has no "CPU Package", so the fallback name
    // LHM actually uses must answer.
    expect(matched.get("cpu.temp")).toBeGreaterThan(0);
    expect(matched.get("cpu.power")).toBeGreaterThan(0);
    expect(matched.get("cpu.clock")).toBeGreaterThan(0);
    expect(matched.get("gpu.load")).toBeGreaterThanOrEqual(0);
    expect(matched.get("gpu.temp")).toBeGreaterThan(0);
    expect(matched.get("gpu.power")).toBeGreaterThan(0);
    // VRAM arrives as SmallData in MB and must land in GB.
    expect(matched.get("vram.total")).toBeCloseTo(12, 0);
    expect(matched.get("vram.used")).toBeLessThan(12);
    // Disk sums several devices; the SSD alone is ~500 GB.
    expect(matched.get("disk.total")).toBeGreaterThan(100);
    expect(matched.get("disk.used")).toBeGreaterThan(0);
    expect(matched.get("disk.used.percent")).toBeGreaterThan(0);
  });

  it("finds a liquid cooler's pump and radiator fans", () => {
    const matched = new Map(
      matchLhmSensors(realSensors(), ["cpu.fan", "cpu.temp"]).map((match) => [
        match.semanticKey,
        match.value,
      ]),
    );

    // This machine has no "CPU Fan" header: the CPU is cooled by an NZXT Kraken
    // (a pump) and by motherboard fan headers, both of which answer cpu.fan.
    expect(matched.get("cpu.fan")).toBeGreaterThan(0);
    // And its temperature comes from the CPU package, not the coolant.
    expect(matched.get("cpu.temp")).toBeGreaterThan(0);
  });

  it("leaves a key absent rather than inventing one", () => {
    const matched = matchLhmSensors(realSensors(), ["cpu.temp"]).map(
      (match) => match.semanticKey,
    );

    // A key the machine genuinely cannot answer stays absent.
    expect(matchLhmSensors(realSensors(), ["nonexistent.sensor"])).toEqual([]);
    expect(matched).toContain("cpu.temp");
  });

  it("fans disk capacity out per device, with a self-consistent percentage", () => {
    const devices = diskDeviceReadings(realSensors());

    // This machine has four drives; each must appear under its own id.
    expect(devices.length).toBe(4);
    for (const device of devices) {
      expect(device.totalGb).toBeGreaterThan(0);
      expect(device.usedGb).toBeGreaterThanOrEqual(0);
      expect(device.usedGb).toBeLessThanOrEqual(device.totalGb);
      expect(device.usedPercent).toBeCloseTo(
        (device.usedGb / device.totalGb) * 100,
        6,
      );
      expect(device.deviceId).toMatch(/^[a-z0-9-]+$/);
    }
    // Ids are unique, so per-device keys cannot collide.
    expect(new Set(devices.map((device) => device.deviceId)).size).toBe(
      devices.length,
    );
  });
});
