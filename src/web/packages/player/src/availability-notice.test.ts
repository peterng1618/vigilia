import type { Sample } from "@vigilia/renderer-core";
import { describe, expect, it } from "vitest";
import { availabilityNoticeText } from "./availability-notice.js";

/** The host's own reason for a key nothing reports (§97, `server.ts`). */
const NO_PROVIDER =
  "no provider on this PC reports that sensor; check the device assignment or that its source is running";

const at = "2026-09-29T00:00:00.000Z";
const gap = (message: string, sensorId = "host:key"): Sample => ({
  sensorId,
  timestamp: at,
  status: "missing",
  message,
});
const ok = (sensorId = "library:key"): Sample => ({
  sensorId,
  timestamp: at,
  status: "ok",
  value: 1,
});

/** Counts how many times a substring appears, so "said once" is a fact. */
const occurrences = (text: string, part: string): number =>
  text.split(part).length - 1;

describe("availabilityNoticeText", () => {
  it("says a shared cause once, with the sensors that share it", () => {
    const text = availabilityNoticeText([
      gap(NO_PROVIDER, "host:cpu.temp.1"),
      gap(NO_PROVIDER, "host:cpu.temp.2"),
      gap(
        "this machine reports no reading for that sensor",
        "library:gpu.load",
      ),
    ]);

    expect(occurrences(text ?? "", NO_PROVIDER)).toBe(1);
    expect(text).toContain("3 of 3 sensors have no reading");
    expect(text).toContain(`2× ${NO_PROVIDER}`);
    expect(text).toContain(
      "1× this machine reports no reading for that sensor",
    );
  });

  it("leads with the cause the most sensors share", () => {
    const text = availabilityNoticeText([
      gap("first", "a"),
      gap("second", "b"),
      gap("second", "c"),
      gap("second", "d"),
    ]);

    expect(text).toBe("4 of 4 sensors have no reading — 3× second, 1× first");
  });

  it("keeps a transport address off the display", () => {
    const text = availabilityNoticeText([
      gap(
        "LibreHardwareMonitor is not reachable at http://127.0.0.1:8085: fetch failed",
        "lhm:gpu.load",
      ),
    ]);

    expect(text).not.toContain("127.0.0.1");
    expect(text).toContain(
      "LibreHardwareMonitor is not reachable at its configured address: fetch failed",
    );
  });

  it("says how many causes it left out without changing the sensor count", () => {
    const text = availabilityNoticeText([
      gap("one", "a"),
      gap("two", "b"),
      gap("three", "c"),
      gap("four", "d"),
      gap("five", "e"),
    ]);

    expect(text).toContain("5 of 5 sensors have no reading");
    expect(text).toContain("1× one");
    expect(text).toContain("1× three");
    expect(text).not.toContain("1× four");
    expect(text).toContain("+2 more reasons");
  });

  it("shows nothing when every requested sensor has a reading", () => {
    expect(availabilityNoticeText([ok(), ok()])).toBeUndefined();
  });

  it("shows nothing before any sample has arrived", () => {
    expect(availabilityNoticeText([undefined, undefined])).toBeUndefined();
  });

  it("names the sensor when the host sent no reason", () => {
    const text = availabilityNoticeText([
      { sensorId: "lhm:gpu.load", timestamp: at, status: "missing" },
    ]);

    expect(text).toBe(
      "1 of 1 sensors have no reading — 1× lhm:gpu.load: missing",
    );
  });
});
