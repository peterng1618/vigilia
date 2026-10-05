import { describe, expect, it } from "vitest";
import type { Sample } from "../types.js";
import {
  createBatch,
  decodeBatch,
  formatSseEvent,
  PROTOCOL_VERSION,
  SAMPLE_EVENT,
  type SampleEntry,
} from "./protocol.js";

const NOW = Date.parse("2026-01-01T00:00:10Z");

const sample: Sample = {
  sensorId: "os:cpu.load",
  timestamp: "2026-01-01T00:00:10.000Z",
  status: "ok",
  value: 42.5,
  unit: "%",
};

const entries: readonly SampleEntry[] = [{ semanticKey: "cpu.load", sample }];

describe("createBatch", () => {
  it("stamps the current version and the send time", () => {
    expect(createBatch(entries, NOW)).toEqual({
      version: PROTOCOL_VERSION,
      sentAt: "2026-01-01T00:00:10.000Z",
      samples: entries,
    });
  });
});

describe("decodeBatch", () => {
  it("round-trips a batch through JSON", () => {
    const result = decodeBatch(JSON.stringify(createBatch(entries, NOW)));

    expect(result.ok).toBe(true);
    expect(result.ok && result.batch.samples[0]?.sample.value).toBe(42.5);
  });

  it("preserves a non-ok status carrying no value (§83)", () => {
    const unavailable: Sample = {
      sensorId: "os:cpu.fan",
      timestamp: "2026-01-01T00:00:10.000Z",
      status: "unavailable",
      message: "needs a driver this machine does not have",
    };
    const result = decodeBatch(
      JSON.stringify(
        createBatch([{ semanticKey: "cpu.fan", sample: unavailable }], NOW),
      ),
    );

    expect(result.ok).toBe(true);
    // The absence of `value` is the payload. A transport that helpfully
    // defaulted it to 0 would turn a gap into a reading.
    expect(result.ok && result.batch.samples[0]?.sample).not.toHaveProperty(
      "value",
    );
  });

  it("refuses a newer version on the version alone (§141)", () => {
    const result = decodeBatch(
      JSON.stringify({
        version: PROTOCOL_VERSION + 1,
        sentAt: "x",
        samples: [],
      }),
    );

    expect(result).toMatchObject({ ok: false });
    expect(result.ok === false && result.reason).toContain(
      String(PROTOCOL_VERSION + 1),
    );
  });

  it("refuses an older version too", () => {
    expect(
      decodeBatch(JSON.stringify({ version: 0, sentAt: "x", samples: [] })).ok,
    ).toBe(false);
  });

  it("checks the version before reading the payload", () => {
    // A newer host may have changed what `samples` means, so a frame with a
    // future version and a nonsense body must fail on the version, not on the
    // body we have already established we cannot interpret.
    const result = decodeBatch(
      JSON.stringify({ version: 99, sentAt: 42, samples: "not an array" }),
    );

    expect(result.ok === false && result.reason).toContain("99");
  });

  it.each([
    ["broken JSON", "{not json"],
    ["a JSON array", "[]"],
    ["null", "null"],
    ["a bare number", "7"],
    ["a bare string", '"hello"'],
  ])("refuses %s", (_label, payload) => {
    expect(decodeBatch(payload).ok).toBe(false);
  });

  it("refuses a frame missing sentAt or samples", () => {
    expect(decodeBatch(JSON.stringify({ version: PROTOCOL_VERSION })).ok).toBe(
      false,
    );
    expect(
      decodeBatch(JSON.stringify({ version: PROTOCOL_VERSION, sentAt: "x" }))
        .ok,
    ).toBe(false);
  });
});

describe("formatSseEvent", () => {
  it("names the event and ends on a blank line", () => {
    expect(formatSseEvent(SAMPLE_EVENT, '{"a":1}')).toBe(
      'event: samples\ndata: {"a":1}\n\n',
    );
  });

  it("prefixes every line, so a newline cannot end the event early", () => {
    // Defence rather than a live bug — JSON.stringify never emits a bare
    // newline inside a string — but an unprefixed second line would terminate
    // the frame and the client would parse half of it as a whole.
    expect(formatSseEvent("e", "one\ntwo")).toBe(
      "event: e\ndata: one\ndata: two\n\n",
    );
  });

  it("survives an empty payload", () => {
    expect(formatSseEvent("e", "")).toBe("event: e\ndata: \n\n");
  });

  it("round-trips through its own parser", () => {
    const payload = JSON.stringify(createBatch(entries, NOW));
    const framed = formatSseEvent(SAMPLE_EVENT, payload);
    // What EventSource hands a listener: the data lines, joined, unprefixed.
    const data = framed
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => line.slice("data: ".length))
      .join("\n");

    expect(decodeBatch(data).ok).toBe(true);
  });
});
