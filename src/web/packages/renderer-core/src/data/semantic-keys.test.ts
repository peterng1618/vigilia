import { describe, expect, it } from "vitest";

import {
  SEMANTIC_KEYS,
  describeSemanticKey,
  isKnownSemanticKey,
  labelForSemanticKey,
  semanticKeysByFamily,
} from "./semantic-keys.js";

describe("the semantic key vocabulary", () => {
  it("declares every key exactly once", () => {
    const keys = SEMANTIC_KEYS.map((descriptor) => descriptor.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("spells system memory `ram`, not `memory`", () => {
    // The decision this module exists to own: `ram` and `vram` are separate
    // families, so neither needs a qualifier to be unambiguous.
    expect(isKnownSemanticKey("ram.used")).toBe(true);
    expect(isKnownSemanticKey("memory.used")).toBe(false);
    expect(isKnownSemanticKey("vram.used")).toBe(true);
  });

  it("keeps ram and vram in different families", () => {
    expect(describeSemanticKey("ram.used")?.family).toBe("ram");
    expect(describeSemanticKey("vram.used")?.family).toBe("vram");
  });

  it("treats a percentage as a qualifier on the quantity", () => {
    expect(describeSemanticKey("ram.used")?.unit).toBe("GB");
    expect(describeSemanticKey("ram.used.percent")?.unit).toBe("%");
  });

  it("marks the four keys the OS provider actually reads as baseline", () => {
    for (const key of [
      "cpu.load",
      "ram.used",
      "ram.used.percent",
      "ram.total",
    ]) {
      expect(describeSemanticKey(key)?.expectedTier).toBe("baseline");
    }
  });

  it("marks driver-dependent keys extended", () => {
    for (const key of ["cpu.temp", "gpu.load", "vram.used"]) {
      expect(describeSemanticKey(key)?.expectedTier).toBe("extended");
    }
  });

  it("declares no indexed multi-device form, which is still undecided", () => {
    // Spec 0010 sketches `gpu.0.load`. Guessing at it here would let a real
    // provider contradict the vocabulary later.
    expect(SEMANTIC_KEYS.filter((d) => /\.\d+\./.test(d.key))).toEqual([]);
  });
});

describe("describeSemanticKey", () => {
  it("treats an unknown key as unknown rather than an error", () => {
    expect(describeSemanticKey("disk.nvme.queue-depth")).toBeUndefined();
    expect(isKnownSemanticKey("disk.nvme.queue-depth")).toBe(false);
  });
});

describe("labelForSemanticKey", () => {
  it("labels a known key", () => {
    expect(labelForSemanticKey("cpu.load")).toBe("CPU load");
  });

  it('falls back to the raw key, which is more informative than "unknown"', () => {
    expect(labelForSemanticKey("disk.nvme.queue-depth")).toBe(
      "disk.nvme.queue-depth",
    );
  });
});

describe("semanticKeysByFamily", () => {
  it("groups without losing or duplicating a key", () => {
    const grouped = semanticKeysByFamily();
    const total = [...grouped.values()].reduce(
      (sum, list) => sum + list.length,
      0,
    );

    expect(total).toBe(SEMANTIC_KEYS.length);
  });

  it("keeps declaration order inside a family", () => {
    expect(grouping("ram")).toEqual([
      "ram.used",
      "ram.used.percent",
      "ram.total",
    ]);
  });

  function grouping(family: "ram"): readonly string[] {
    return (semanticKeysByFamily().get(family) ?? []).map(
      (descriptor) => descriptor.key,
    );
  }
});
