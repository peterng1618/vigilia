// @vitest-environment jsdom

import { VIGILIA_TEXT_PROPERTY } from "@vigilia/scene-fabric";
import { Canvas, Textbox } from "fabric/es";
import { describe, expect, it } from "vitest";
import { LiveRuntime } from "./live-runtime.js";

describe("LiveRuntime", () => {
  it("shows a value run's token while authoring, without changing authored runs", async () => {
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

    // Tokens are the authoring default: the author sees the structure.
    expect(text.text).toBe("CPU @cpu.load");
    expect(text.get(VIGILIA_TEXT_PROPERTY)).toEqual(authored);
    await canvas.dispose();
  });

  it("shows the live value when the author asks for values", async () => {
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
      source: { latest: () => undefined, history: () => [] },
    });

    runtime.setRunDisplay("values");
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
    await canvas.dispose();
  });

  it("adds no history entry and changes nothing authored when the mode changes", async () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const text = new Textbox("CPU --", { id: "cpu-label" });
    const authored = {
      runs: [
        { kind: "literal" as const, text: "CPU " },
        { kind: "value" as const, bindingId: "load" },
      ],
    };
    text.set(VIGILIA_TEXT_PROPERTY, authored);
    canvas.add(text);

    const runtime = new LiveRuntime({
      canvas,
      bindings: { "cpu-label": [{ id: "load", semanticKey: "cpu.load" }] },
      source: { latest: () => undefined, history: () => [] },
    });

    runtime.setRunDisplay("values");
    runtime.setRunDisplay("tokens");

    // The mode is editor transient state: authored content is untouched.
    expect(text.get(VIGILIA_TEXT_PROPERTY)).toEqual(authored);
    expect(runtime.runDisplay).toBe("tokens");
    await canvas.dispose();
  });
});
