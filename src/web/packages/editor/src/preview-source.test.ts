import { describe, expect, it } from "vitest";
import { createPreviewSource } from "./preview-source.js";

describe("createPreviewSource", () => {
  it("generates deterministic, bounded samples only for requested semantic keys", () => {
    let now = 0;
    const preview = createPreviewSource({ keys: ["cpu.load"], now: () => now });

    const first = preview.source.latest("cpu.load");
    now += 1_000;
    const next = preview.source.latest("cpu.load");

    expect(first?.value).not.toBe(next?.value);
    expect(preview.source.latest("ram.used")).toBeUndefined();

    for (let second = 0; second < 700; second += 1) {
      now += 1_000;
      preview.source.latest("cpu.load");
    }

    expect(preview.source.history("cpu.load", 1_000)).toHaveLength(301);
  });
});
