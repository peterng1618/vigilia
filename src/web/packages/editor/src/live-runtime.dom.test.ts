// @vitest-environment jsdom
import { Canvas, Textbox } from "fabric/es";
import { describe, expect, it } from "vitest";
import { VIGILIA_TEXT_PROPERTY } from "@vigilia/scene-fabric";
import { LiveRuntime } from "./live-runtime.js";

describe("LiveRuntime", () => {
  it("replaces a bound text value from its runtime source without changing authored runs", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const text = new Textbox("CPU --", { id: "cpu-label" });
    const authored = {
      runs: [
        { kind: "literal" as const, text: "CPU " },
        {
          kind: "value" as const,
          bindingId: "load",
          precision: 0,
          unitDisplay: "short" as const,
        },
      ],
    };
    text.set(VIGILIA_TEXT_PROPERTY, authored);
    canvas.add(text);

    const runtime = new LiveRuntime({
      canvas,
      bindings: { "cpu-label": [{ id: "load", semanticKey: "cpu.load" }] },
      source: {
        latest: () => undefined,
        history: () => [],
      },
    });

    runtime.setSource({
      latest: (key) =>
        key === "cpu.load"
          ? {
              sensorId: "cpu.load",
              timestamp: "2026-09-20T00:00:00.000Z",
              status: "ok",
              value: 48,
              unit: "%",
            }
          : undefined,
      history: () => [],
    });

    expect(text.text).toBe("CPU 48%");
    expect(text.get(VIGILIA_TEXT_PROPERTY)).toEqual(authored);
    canvas.dispose();
  });
});
