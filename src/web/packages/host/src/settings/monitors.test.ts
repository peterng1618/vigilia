import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  hintFor,
  isAttached,
  launchFor,
  listMonitors,
  type Monitor,
} from "./monitors.js";

const mockGraphics = vi.fn();
vi.mock("systeminformation", () => ({ default: { graphics: mockGraphics } }));

/**
 * `graphics().displays[0]` on this PC, read 2026-10-18 from
 * `systeminformation` 5.33.13: the real key names, and the real nullability —
 * `serial` is present and a string here, and the library answers `null` rather
 * than `""` when a monitor reports none.
 */
const PROBE_ENTRY = {
  vendor: "XMI",
  model: "7QBB-RA",
  serial: "4790810010513",
  productionYear: 2023,
  displayId: "display\\xmid003\\5&384540cd&0&uid4355_0",
  deviceName: "\\\\.\\DISPLAY1",
  main: true,
  builtin: false,
  connection: "DP",
  resolutionX: 2560,
  resolutionY: 1440,
  sizeX: 60,
  sizeY: 34,
  pixelDepth: 32,
  currentResX: 2048,
  currentResY: 1152,
  positionX: 0,
  positionY: 0,
  currentRefreshRate: 75,
};

/** A second screen, in the shape the same reader gives one with no serial. */
const NO_SERIAL_ENTRY = {
  vendor: "DEL",
  model: "DELL U2412M",
  serial: null,
  deviceName: "\\\\.\\DISPLAY2",
  main: false,
  currentResX: 1920,
  currentResY: 1080,
  positionX: 2560,
  positionY: 0,
};

/** The reader's fallback entry, which carries no device name at all. */
const UNNAMED_ENTRY = {
  vendor: "",
  model: "",
  serial: null,
  main: true,
  currentResX: 1024,
  currentResY: 768,
  positionX: 0,
  positionY: 0,
};

const ATTACHED: Monitor[] = [
  {
    deviceName: "\\\\.\\DISPLAY1",
    serial: "4790810010513",
    main: true,
    positionX: 0,
    positionY: 0,
    currentResX: 2560,
    currentResY: 1440,
  },
  {
    deviceName: "\\\\.\\DISPLAY2",
    main: false,
    positionX: 2560,
    positionY: 0,
    currentResX: 1920,
    currentResY: 1080,
  },
];

describe("the host's own monitors", () => {
  it("prefers the serial, because a device name moves when cables do", () => {
    expect(hintFor(ATTACHED[0]!)).toEqual({
      serial: "4790810010513",
      deviceName: "\\\\.\\DISPLAY1",
    });
    expect(hintFor(ATTACHED[1]!)).toEqual({ deviceName: "\\\\.\\DISPLAY2" });
  });

  // R27: an empty string is absence, not a value — a hint carrying `""` matches
  // nothing, so the display would read as detached for ever.
  it("leaves the serial out when a monitor reports none, or only space", () => {
    const absent = hintFor(ATTACHED[1]!);
    expect(Object.keys(absent)).toEqual(["deviceName"]);

    const blank = hintFor({ ...ATTACHED[0]!, serial: "   " });
    expect(Object.keys(blank)).toEqual(["deviceName"]);
    expect(blank.deviceName).toBe("\\\\.\\DISPLAY1");
  });

  it("matches a hint on serial when it has one, and on deviceName when it does not", () => {
    expect(
      isAttached(
        { serial: "4790810010513", deviceName: "\\\\.\\DISPLAY1" },
        ATTACHED,
      ),
    ).toBe(true);
    expect(
      isAttached({ serial: "gone", deviceName: "\\\\.\\DISPLAY1" }, ATTACHED),
    ).toBe(false);
    expect(isAttached({ deviceName: "\\\\.\\DISPLAY2" }, ATTACHED)).toBe(true);
    expect(isAttached({ deviceName: "\\\\.\\DISPLAY9" }, ATTACHED)).toBe(false);
  });

  it("builds a URL on loopback and a command that targets the monitor", () => {
    const { url, command } = launchFor(ATTACHED[1]!, 5227, "left-screen");

    expect(url).toBe("http://127.0.0.1:5227/?display=left-screen");
    expect(command).toContain("--window-position=2560,0");
    expect(command).toContain("--window-size=1920,1080");
    expect(command).toContain(url);
  });

  describe("reading what is attached", () => {
    beforeEach(() => {
      mockGraphics.mockReset();
    });

    it("maps the probe's own answer to monitors", async () => {
      mockGraphics.mockResolvedValue({
        displays: [PROBE_ENTRY, NO_SERIAL_ENTRY, UNNAMED_ENTRY],
      });

      // The unnamed entry is dropped rather than listed: nothing can be pointed
      // at a screen with no name to hint at.
      expect(await listMonitors()).toStrictEqual([
        {
          deviceName: "\\\\.\\DISPLAY1",
          serial: "4790810010513",
          main: true,
          positionX: 0,
          positionY: 0,
          currentResX: 2048,
          currentResY: 1152,
        },
        {
          deviceName: "\\\\.\\DISPLAY2",
          main: false,
          positionX: 2560,
          positionY: 0,
          currentResX: 1920,
          currentResY: 1080,
        },
      ]);
    });

    // R29: an answered probe with nothing attached is an empty list...
    it("answers an empty list when the probe found no displays", async () => {
      mockGraphics.mockResolvedValue({ displays: [] });

      expect(await listMonitors()).toEqual([]);
    });

    // ...and a probe that failed is not that answer.
    it("throws when the probe itself failed rather than answering an empty list", async () => {
      mockGraphics.mockRejectedValue(new Error("wmic is not on PATH"));

      await expect(listMonitors()).rejects.toThrow("wmic is not on PATH");
    });
  });
});
