import { describe, expect, it } from "vitest";
import { flattenLhmSensors } from "./lhm-tree.js";

/** Shaped like a real `data.json`: a root, hardware nodes, type nodes, sensors. */
const TREE = {
  id: 0,
  Version: "0.9.4",
  Text: "Sensor",
  Children: [
    {
      id: 1,
      Text: "Sensor",
      Children: [
        {
          id: 2,
          Text: "GpuNvidia",
          HardwareId: "/gpu-nvidia/0",
          ImageURL: "images_icon/nvidia.png",
          Children: [
            {
              id: 3,
              Text: "Load",
              Children: [
                {
                  id: 4,
                  Text: "GPU Core",
                  SensorId: "/gpu-nvidia/0/load/0",
                  Type: "Load",
                  Min: "0.0",
                  Value: "37.0 %",
                  Max: "100.0",
                  RawValue: 37,
                },
              ],
            },
            {
              id: 5,
              Text: "Temperature",
              Children: [
                {
                  id: 6,
                  Text: "GPU Core",
                  SensorId: "/gpu-nvidia/0/temperature/0",
                  Type: "Temperature",
                  Value: "35.0 °C",
                  RawValue: 35,
                },
                {
                  id: 7,
                  Text: "GPU Hot Spot",
                  SensorId: "/gpu-nvidia/0/temperature/1",
                  Type: "Temperature",
                  Value: "N/A",
                  RawValue: "NaN",
                },
              ],
            },
          ],
        },
        {
          id: 8,
          Text: "Network",
          HardwareId: "/nic/0",
          Children: [
            {
              id: 9,
              Text: "Throughput",
              Children: [
                {
                  id: 10,
                  Text: "Download Speed",
                  SensorId: "/nic/0/throughput/7",
                  Type: "Throughput",
                  Value: "1.2 MB/s",
                  RawValue: 1200000,
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe("LHM tree", () => {
  it("flattens sensor nodes and remembers their hardware group", () => {
    const sensors = flattenLhmSensors(TREE);

    expect(sensors.map((sensor) => sensor.sensorId)).toEqual([
      "/gpu-nvidia/0/load/0",
      "/gpu-nvidia/0/temperature/0",
      "/gpu-nvidia/0/temperature/1",
      "/nic/0/throughput/7",
    ]);
    expect(sensors[0]).toMatchObject({
      text: "GPU Core",
      type: "Load",
      value: 37,
      hardwareType: "GpuNvidia",
      hardwareId: "/gpu-nvidia/0",
    });
    expect(sensors[3]).toMatchObject({
      hardwareType: "Network",
      type: "Throughput",
      value: 1200000,
    });
  });

  it("reads the unformatted value, not the display string", () => {
    // `Value` is "37.0 %"; only `RawValue` is the consistent number.
    expect(flattenLhmSensors(TREE)[0]?.value).toBe(37);
  });

  it("treats LHM's NaN literal as a gap, never as zero", () => {
    const hotSpot = flattenLhmSensors(TREE)[2];

    expect(hotSpot?.value).toBeUndefined();
    expect(hotSpot?.value).not.toBe(0);
  });

  it("returns nothing for a payload that is not a tree", () => {
    expect(flattenLhmSensors(null)).toEqual([]);
    expect(flattenLhmSensors({})).toEqual([]);
    expect(flattenLhmSensors({ Children: "no" })).toEqual([]);
  });
});
