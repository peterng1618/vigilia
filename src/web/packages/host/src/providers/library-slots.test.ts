import { describe, expect, it } from "vitest";
import { readingsFromLibrary, samplesFromLibrary } from "./library.js";

const BYTES_PER_GB = 1024 ** 3;

/** Two volumes, as the library reports them on Windows. */
const filesystems = [
  { mount: "C:", fs: "C:", size: 500 * BYTES_PER_GB, used: 305 * BYTES_PER_GB },
  {
    mount: "D:",
    fs: "D:",
    size: 4000 * BYTES_PER_GB,
    used: 1600 * BYTES_PER_GB,
  },
];

describe("library disk slots", () => {
  it("sums every volume when nothing is assigned", () => {
    const readings = readingsFromLibrary({ filesystems });

    expect(readings.diskTotalGb).toBeCloseTo(4500, 0);
  });

  it("describes one volume when the aggregate is scoped to it", () => {
    // What the provider does with a system-disk assignment: pass only that
    // volume, so the unsuffixed disk keys describe it alone.
    const readings = readingsFromLibrary({ filesystems: [filesystems[0]!] });

    expect(readings.diskTotalGb).toBeCloseTo(500, 0);
    expect(readings.diskUsedGb).toBeCloseTo(305, 0);
  });

  it("derives the data slot's percentage from that slot's own figures", () => {
    const entries = samplesFromLibrary(
      { dataDiskUsedGb: 1600, dataDiskTotalGb: 4000 },
      ["disk.data.total", "disk.data.used", "disk.data.used.percent"],
      0,
    );
    const byKey = new Map(
      entries.map((entry) => [entry.semanticKey, entry.sample]),
    );

    expect(byKey.get("disk.data.total")).toMatchObject({
      value: 4000,
      unit: "GB",
    });
    expect(byKey.get("disk.data.used.percent")).toMatchObject({
      value: 40,
      unit: "%",
    });
  });

  it("reports the data slot as a gap when no volume answers it", () => {
    const entries = samplesFromLibrary({}, ["disk.data.total"], 0);

    expect(entries[0]?.sample.status).toBe("missing");
    expect(entries[0]?.sample).not.toHaveProperty("value");
  });

  it("reports the data slot as a gap when its volume has no capacity", () => {
    const entries = samplesFromLibrary(
      { dataDiskUsedGb: 0, dataDiskTotalGb: 0 },
      ["disk.data.used.percent"],
      0,
    );

    // A zero-capacity slot is a gap, never a fabricated 0 %.
    expect(entries[0]?.sample.status).toBe("missing");
  });
});
