import type { Binding } from "@vigilia/renderer-core";
import { describe, expect, it } from "vitest";
import { boundSemanticKeys } from "./bound-keys.js";

const binding = (semanticKey: string): Binding =>
  ({ id: `b-${semanticKey}`, semanticKey }) as Binding;

describe("boundSemanticKeys", () => {
  it("names each sensor once, however many objects bind it", () => {
    // The Starter binds `cpu.load` in a value, a sparkline and a trends chart.
    const keys = boundSemanticKeys({
      bindings: {
        "cpu-card-value": [binding("cpu.load"), binding("cpu.brand")],
        "cpu-card-sparkline": [binding("cpu.load")],
        "trends-chart": [binding("cpu.load"), binding("gpu.load")],
      },
    });

    expect(keys).toEqual(["cpu.brand", "cpu.load", "gpu.load"]);
  });

  it("sorts, so the request and the notice read the same twice", () => {
    expect(
      boundSemanticKeys({
        bindings: {
          a: [binding("ram.used")],
          b: [binding("cpu.load")],
        },
      }),
    ).toEqual(["cpu.load", "ram.used"]);
  });

  it("asks for nothing when a theme binds nothing", () => {
    expect(boundSemanticKeys({ bindings: {} })).toEqual([]);
    expect(boundSemanticKeys({})).toEqual([]);
  });
});
