import type { FabricThemeEnvelope } from "@vigilia/renderer-core";
import { describe, expect, it } from "vitest";
import { requiredDeviceGroups } from "./required-devices.js";

function themeWith(keys: readonly string[]): FabricThemeEnvelope {
  return {
    schemaVersion: 2,
    fabricVersion: "7.4.0",
    id: "t",
    artboard: { width: 100, height: 100 },
    scene: {},
    bindings: Object.fromEntries(
      keys.map((key, index) => [
        `node-${index}`,
        [{ id: "b", semanticKey: key }],
      ]),
    ),
  };
}

describe("the device slots a theme needs", () => {
  it("asks nothing of a theme binding no device keys", () => {
    expect(requiredDeviceGroups(themeWith(["cpu.load", "ram.used"]))).toEqual(
      [],
    );
  });

  it("asks for a system disk when the theme binds a disk key", () => {
    expect(requiredDeviceGroups(themeWith(["disk.used"]))).toEqual([
      "system-disk",
    ]);
  });

  it("asks for a data disk only for the second disk slot", () => {
    // disk.data.* is the second disk; every other disk key is the system one.
    expect(requiredDeviceGroups(themeWith(["disk.data.total"]))).toEqual([
      "data-disk",
    ]);
    expect(
      requiredDeviceGroups(themeWith(["disk.used", "disk.data.total"])),
    ).toEqual(["system-disk", "data-disk"]);
  });

  it("asks for a graphics card when the theme reads gpu or vram", () => {
    expect(requiredDeviceGroups(themeWith(["gpu.load"]))).toEqual(["gpu"]);
    expect(requiredDeviceGroups(themeWith(["vram.used"]))).toEqual(["gpu"]);
  });

  it("returns the slots in the order the page presents them", () => {
    expect(
      requiredDeviceGroups(
        themeWith(["disk.data.used", "gpu.temp", "disk.total"]),
      ),
    ).toEqual(["gpu", "system-disk", "data-disk"]);
  });

  it("asks nothing when there is no active theme", () => {
    expect(requiredDeviceGroups(undefined)).toEqual([]);
  });

  it("ignores a key outside the vocabulary", () => {
    expect(requiredDeviceGroups(themeWith(["nonexistent.sensor"]))).toEqual([]);
  });
});
