import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createDeviceSettingsStore,
  displayNameFor,
  EMPTY_DEVICE_SETTINGS,
  normalizeDeviceSettings,
} from "./devices.js";

describe("device settings", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "vigilia-devices-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("keeps known groups and drops anything else", () => {
    const settings = normalizeDeviceSettings({
      assigned: {
        gpu: "nvidia-geforce-rtx-3080-ti",
        "system-disk": "lexar-500gb-ssd",
        "data-disk": "wdc-wd30nmvw-11c3ns4",
        // Not a group any provider reads.
        cpu: "intel-core-i9",
        gpu2: "second-gpu",
      },
      names: { "wdc-wd30nmvw-11c3ns4": "Data drive" },
    });

    expect(Object.keys(settings.assigned).sort()).toEqual([
      "data-disk",
      "gpu",
      "system-disk",
    ]);
    expect(Object.keys(settings.assigned)).not.toContain("cpu");
  });

  it("rejects an assignment that is not a device id", () => {
    const settings = normalizeDeviceSettings({
      assigned: { gpu: "../../etc/passwd", "system-disk": "" },
    });

    expect(settings.assigned).toEqual({});
  });

  it("trims, shortens and drops empty display names", () => {
    const settings = normalizeDeviceSettings({
      names: {
        "lexar-500gb-ssd": "  System drive  ",
        "wdc-wd30nmvw-11c3ns4": "x".repeat(200),
        "st4000dm004-2cv104": "   ",
        "../escape": "nope",
      },
    });

    expect(settings.names["lexar-500gb-ssd"]).toBe("System drive");
    expect(settings.names["wdc-wd30nmvw-11c3ns4"]).toHaveLength(48);
    // An all-whitespace name means "use the detected one".
    expect(settings.names["st4000dm004-2cv104"]).toBeUndefined();
    expect(settings.names["../escape"]).toBeUndefined();
  });

  it("round-trips through the store", async () => {
    const store = createDeviceSettingsStore(dir);

    expect(await store.read()).toEqual(EMPTY_DEVICE_SETTINGS);

    await store.write({
      assigned: { gpu: "nvidia-geforce-rtx-3080-ti" },
      names: { "nvidia-geforce-rtx-3080-ti": "Main GPU" },
    });

    const read = await store.read();
    expect(read.assigned.gpu).toBe("nvidia-geforce-rtx-3080-ti");
    expect(read.names["nvidia-geforce-rtx-3080-ti"]).toBe("Main GPU");
  });

  it("falls back to defaults for a corrupt file rather than failing a poll", async () => {
    await writeFile(path.join(dir, "devices.json"), "{ not json", "utf8");

    expect(await createDeviceSettingsStore(dir).read()).toEqual(
      EMPTY_DEVICE_SETTINGS,
    );
  });

  it("shows the consumer's name, else the detected one", () => {
    const settings = normalizeDeviceSettings({
      names: { "lexar-500gb-ssd": "System drive" },
    });

    expect(displayNameFor(settings, "lexar-500gb-ssd", "Lexar 500GB SSD")).toBe(
      "System drive",
    );
    expect(displayNameFor(settings, "st4000dm004-2cv104", "ST4000DM004")).toBe(
      "ST4000DM004",
    );
  });
});
