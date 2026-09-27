import { describe, expect, it } from "vitest";

import {
  describeSemanticKey,
  isKnownSemanticKey,
  labelForSemanticKey,
  SEMANTIC_KEYS,
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

  it("declares the device identity keys as text, not as measurements", () => {
    // A caption is a name, not a quantity: no unit, and no `instant` (which
    // would make `plan.ts` reformat the provider's string as a date).
    for (const key of [
      "cpu.brand",
      "cpu.model",
      "cpu.manufacturer",
      "gpu.name",
      "disk.name",
    ]) {
      const declared = describeSemanticKey(key);

      expect(declared, key).toBeDefined();
      expect(declared?.unit, key).toBeUndefined();
      expect(declared?.instant, key).toBeUndefined();
      expect(isKnownSemanticKey(key), key).toBe(true);
    }
  });

  it("keeps the three CPU identity fields as separate keys", () => {
    // The library reports a manufacturer, a brand and a model that all differ
    // (`Intel` / `Core™ i9-10850K` / `165` on the dev machine), and which one
    // reads best is the theme author's choice.
    for (const key of ["cpu.brand", "cpu.model", "cpu.manufacturer"]) {
      expect(describeSemanticKey(key)?.family, key).toBe("cpu");
      expect(describeSemanticKey(key)?.label, key).toBeTruthy();
    }
  });

  it("puts a device caption in its own device's family", () => {
    // The family is what makes the settings page ask which device a theme
    // means, so a caption must ask exactly as the readings beside it do.
    expect(describeSemanticKey("gpu.name")?.family).toBe("gpu");
    expect(describeSemanticKey("disk.name")?.family).toBe("disk");
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
