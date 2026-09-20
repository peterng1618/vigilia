import { SAMPLE_EVENT, createBatch } from "@vigilia/renderer-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEditorSource } from "./live-source.js";

describe("createEditorSource", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("reports a live disconnect without inventing samples", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:10Z"));
    const listeners = new Map<
      string,
      (event: { readonly data: string }) => void
    >();
    const close = vi.fn();
    class EventSourceStub {
      constructor(_url: string) {}
      addEventListener(
        type: string,
        listener: (event: { readonly data: string }) => void,
      ): void {
        listeners.set(type, listener);
      }
      close = close;
    }
    vi.stubGlobal("EventSource", EventSourceStub);
    const onStatus = vi.fn();
    const live = createEditorSource({
      mode: "live",
      keys: ["cpu.load"],
      onStatus,
    });

    listeners.get("error")!({ data: "" });
    expect(onStatus).toHaveBeenLastCalledWith("reconnecting");
    expect(live.source.latest("cpu.load")).toBeUndefined();

    const now = Date.now();
    const event = JSON.stringify(
      createBatch(
        [
          {
            semanticKey: "cpu.load",
            sample: {
              sensorId: "cpu.load",
              timestamp: new Date(now).toISOString(),
              status: "ok",
              value: 42,
              unit: "%",
            },
          },
        ],
        now,
      ),
    );
    listeners.get(SAMPLE_EVENT)!({ data: event });

    expect(live.source.latest("cpu.load")).toBeUndefined();
    vi.advanceTimersByTime(1_000);
    expect(live.source.latest("cpu.load")?.value).toBe(42);
    live.close();
    expect(close).toHaveBeenCalledOnce();
  });
});
