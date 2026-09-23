import { describe, expect, it } from "vitest";
import {
  DISK_DESCRIPTORS,
  DISK_PROVIDER_ID,
  DiskSensorProvider,
  readingsFromStatfs,
  samplesFromDisk,
} from "./disk.js";

const BYTES_PER_GB = 1024 ** 3;

describe("disk readings", () => {
  it("derives total and free bytes from a statfs snapshot", () => {
    expect(readingsFromStatfs({ bsize: 4096, blocks: 100, bfree: 40 })).toEqual(
      { totalBytes: 409600, freeBytes: 163840 },
    );
  });
});

describe("disk samples", () => {
  const readings = {
    totalBytes: 100 * BYTES_PER_GB,
    freeBytes: 25 * BYTES_PER_GB,
  };
  const now = Date.parse("2026-09-24T00:00:00.000Z");

  it("maps a snapshot onto the declared vocabulary", () => {
    const entries = samplesFromDisk(readings, now, [
      "disk.used",
      "disk.used.percent",
      "disk.total",
    ]);

    expect(entries.map((entry) => entry.semanticKey)).toEqual([
      "disk.used",
      "disk.used.percent",
      "disk.total",
    ]);
    expect(entries.map((entry) => entry.sample)).toMatchObject([
      { status: "ok", value: 75, unit: "GB" },
      { status: "ok", value: 75, unit: "%" },
      { status: "ok", value: 100, unit: "GB" },
    ]);
    expect(entries[0]?.sample.sensorId).toBe(`${DISK_PROVIDER_ID}:disk.used`);
  });

  it("answers only the requested keys", () => {
    expect(samplesFromDisk(readings, now, ["disk.total"])).toHaveLength(1);
    expect(samplesFromDisk(readings, now, ["cpu.load"])).toEqual([]);
  });

  it("reports a zero-capacity volume as missing, never as zero", () => {
    const entries = samplesFromDisk({ totalBytes: 0, freeBytes: 0 }, now, [
      "disk.used.percent",
    ]);

    expect(entries[0]?.sample).toMatchObject({ status: "missing" });
    expect(entries[0]?.sample).not.toHaveProperty("value");
  });
});

describe("disk provider", () => {
  it("describes only vocabulary keys", () => {
    expect(
      DISK_DESCRIPTORS.map((descriptor) => descriptor.semanticKey),
    ).toEqual(["disk.used", "disk.used.percent", "disk.total"]);
    expect(DISK_DESCRIPTORS.every((d) => d.tier === "baseline")).toBe(true);
  });

  it("reads a real volume without inventing values", async () => {
    const entries = await new DiskSensorProvider().sample(
      ["disk.total"],
      Date.now(),
    );

    expect(entries).toHaveLength(1);
    const sample = entries[0]?.sample;
    // Either the real capacity, or an explained miss; never a fabricated zero.
    if (sample?.status === "ok") {
      expect(sample.value).toBeGreaterThan(0);
    } else {
      expect(sample?.status).toBe("missing");
      expect(sample?.message).toBeTruthy();
    }
  });

  it("reports an unreadable volume as missing with a reason", async () => {
    const provider = new DiskSensorProvider(
      process.platform === "win32" ? "Q:\\nope" : "/definitely/not/here",
    );

    const entries = await provider.sample(["disk.used"], Date.now());

    expect(entries[0]?.sample).toMatchObject({ status: "missing" });
    expect(entries[0]?.sample.message).toContain("could not read");
    expect(provider.health().available).toBe(false);
  });

  it("skips work for keys it does not own", async () => {
    expect(
      await new DiskSensorProvider().sample(["cpu.load"], Date.now()),
    ).toEqual([]);
  });
});
