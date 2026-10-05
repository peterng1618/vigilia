import { FakeSampleSource, type FakeSourceOptions } from "./index.js";

/** Includes outage, unmapped, unavailable, and text-value cases for renderer coverage. */
export const demoSourceOptions: FakeSourceOptions = {
  sampleIntervalMs: 1000,
  outages: [
    {
      semanticKey: "gpu.temp",
      everySeconds: 24,
      forSeconds: 6,
      status: "error",
    },
  ],
  // These must stay unmapped; otherwise the synthetic source would invent values for them.
  unmappedKeys: ["disk.nvme.queue-depth", "nonexistent.sensor"],
  forcedStatus: { "cpu.fan": "unavailable" },
  textValues: { "gpu.name": "Reference GPU" },
};

export function createDemoSource(nowMs: number): FakeSampleSource {
  return new FakeSampleSource(nowMs, demoSourceOptions);
}
