import { describe, expect, it } from "vitest";
import { convertForDisplay } from "./measurement.js";

describe("measurement preference", () => {
  it("shows what the provider measured under metric", () => {
    // The measurement is untouched; a preference never rewrites it.
    expect(convertForDisplay("cpu.temp", 63, "°C", "metric")).toEqual({
      value: 63,
      unit: "°C",
    });
  });

  it("converts temperature to Fahrenheit when asked", () => {
    expect(convertForDisplay("cpu.temp", 100, "°C", "imperial")).toEqual({
      value: 212,
      unit: "°F",
    });
    expect(convertForDisplay("gpu.temp", 0, "°C", "imperial")).toEqual({
      value: 32,
      unit: "°F",
    });
  });

  it("leaves a family the vocabulary does not convert alone", () => {
    // A unit preference must not pretend to cover what it cannot convert.
    expect(convertForDisplay("ram.used", 10.5, "GB", "imperial")).toEqual({
      value: 10.5,
      unit: "GB",
    });
    expect(convertForDisplay("disk.used", 300, "GB", "imperial")).toEqual({
      value: 300,
      unit: "GB",
    });
    expect(
      convertForDisplay("network.download", 1.2, "Mb/s", "imperial"),
    ).toEqual({ value: 1.2, unit: "Mb/s" });
  });

  it("does not convert a value whose unit is not the one it expects", () => {
    // A provider reporting a non-Celsius temperature is left as measured.
    expect(convertForDisplay("cpu.temp", 300, "K", "imperial")).toEqual({
      value: 300,
      unit: "K",
    });
  });

  it("leaves an unknown key alone", () => {
    expect(convertForDisplay("nonexistent.sensor", 5, "x", "imperial")).toEqual(
      {
        value: 5,
        unit: "x",
      },
    );
  });
});
