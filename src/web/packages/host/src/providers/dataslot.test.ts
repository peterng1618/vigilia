import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { matchLhmSensorsAssigned } from "./lhm-mapping.js";
import { flattenLhmSensors } from "./lhm-tree.js";

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

describe("the data-disk slot", () => {
  const keys = ["disk.used", "disk.total", "disk.data.used", "disk.data.total"];

  it("answers the data keys from the assigned drive, independently of the system drive", () => {
    const matched = new Map(
      matchLhmSensorsAssigned(realSensors(), keys, {
        systemDisk: "lexar-500gb-ssd",
        dataDisk: "st4000dm004-2cv104",
      }).map((match) => [match.semanticKey, match.value]),
    );

    // One theme slot per drive: the system keys describe the SSD, the data keys
    // the 4 TB drive, so a theme showing two disks needs no drive names.
    expect(matched.get("disk.total")).toBeCloseTo(500.1, 1);
    expect(matched.get("disk.data.total")).toBeCloseTo(4000.8, 1);
    expect(matched.get("disk.data.used")).toBeGreaterThan(0);
    expect(matched.get("disk.data.used")).toBeLessThan(4000.8);
  });

  it("reports nothing for the data slot when no drive is assigned", () => {
    const matched = matchLhmSensorsAssigned(realSensors(), keys, {
      systemDisk: "lexar-500gb-ssd",
    }).map((match) => match.semanticKey);

    // An unconfigured data slot must not silently borrow another drive.
    expect(matched).not.toContain("disk.data.total");
    expect(matched).not.toContain("disk.data.used");
  });

  it("reports nothing when the assigned data drive is gone", () => {
    const matched = matchLhmSensorsAssigned(realSensors(), keys, {
      dataDisk: "drive-that-was-removed",
    }).map((match) => match.semanticKey);

    expect(matched).not.toContain("disk.data.total");
  });

  it("leaves the system keys untouched by a data assignment", () => {
    const matched = new Map(
      matchLhmSensorsAssigned(realSensors(), ["disk.total"], {
        dataDisk: "st4000dm004-2cv104",
      }).map((match) => [match.semanticKey, match.value]),
    );

    // Nothing assigned the system slot, so it keeps the default (all combined).
    expect(matched.get("disk.total")).toBeGreaterThan(1000);
  });
});
