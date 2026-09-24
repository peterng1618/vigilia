import {
  describeSemanticKey,
  formatInstant,
  instantIn,
  parseInstant,
} from "@vigilia/renderer-core";
import { describe, expect, it } from "vitest";
import { CLOCK_DESCRIPTORS, ClockSensorProvider } from "./clock.js";

/** 2026-09-24 14:07:09 UTC, a Thursday. */
const INSTANT_MS = Date.UTC(2026, 8, 24, 14, 7, 9);

describe("the instant the host sends", () => {
  it("is this machine's wall clock, written with its offset", () => {
    const value = instantIn(INSTANT_MS);
    const local = new Date(INSTANT_MS);

    // The offset travels with the value, so a display needs no zone knowledge.
    expect(parseInstant(value)).toMatchObject({
      year: local.getFullYear(),
      month: local.getMonth() + 1,
      day: local.getDate(),
      hour: local.getHours(),
      minute: local.getMinutes(),
    });
  });

  it("is an instant, not a formatted string: the author decides how it reads", () => {
    // The same reading renders as any of these, and the host chose none of them.
    const value = "2026-09-24T14:07:09+07:00";
    expect(formatInstant(value, "HH:mm")).toBe("14:07");
    expect(formatInstant(value, "dddd")).toBe("Thursday");
    expect(formatInstant(value, "[Today is ]dddd")).toBe("Today is Thursday");
  });
});

describe("the clock provider", () => {
  it("describes the time and date keys", () => {
    expect(CLOCK_DESCRIPTORS.map((d) => d.semanticKey)).toEqual([
      "time.now",
      "date.today",
    ]);
  });

  it("reports the keys the vocabulary declares as instants", () => {
    // The vocabulary owns the default an unformatted binding reads with.
    expect(describeSemanticKey("time.now")?.instant).toEqual({
      defaultFormat: "HH:mm",
    });
    expect(describeSemanticKey("date.today")?.instant).toEqual({
      defaultFormat: "DD MMM YYYY",
    });
  });

  it("answers both keys with the same instant, as text", async () => {
    const entries = await new ClockSensorProvider().sample(
      ["time.now", "date.today"],
      INSTANT_MS,
    );

    expect(entries).toHaveLength(2);
    // A clock is a string, not a number: a numeric value would be a different fact.
    expect(entries[0]?.sample).toMatchObject({ status: "ok" });
    expect(entries[0]?.sample).not.toHaveProperty("value");
    expect(entries[0]?.sample.textValue).toBe(entries[1]?.sample.textValue);
  });

  it("reads the instant in the zone the consumer chose, without touching the theme", async () => {
    const provider = new ClockSensorProvider();
    provider.setTimeZone("Asia/Tokyo");

    const [entry] = await provider.sample(["time.now"], INSTANT_MS);

    // 14:07 UTC is 23:07 in Tokyo, and the reading says so on its own: a display
    // never re-converts, so every screen shows the zone this PC was set to.
    expect(formatInstant(entry?.sample.textValue ?? "", "HH:mm")).toBe("23:07");
  });

  it("answers only the requested keys", async () => {
    const entries = await new ClockSensorProvider().sample(
      ["time.now"],
      INSTANT_MS,
    );

    expect(entries.map((e) => e.semanticKey)).toEqual(["time.now"]);
    expect(
      await new ClockSensorProvider().sample(["cpu.load"], INSTANT_MS),
    ).toEqual([]);
  });
});
