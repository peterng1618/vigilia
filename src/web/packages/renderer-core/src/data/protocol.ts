import type { Sample } from "../types.js";

/** Shared host/display wire contract. Pure shapes + codecs; transport lives elsewhere. */

/** Bump when frame meaning changes; unknown versions are refused before decoding. */
export const PROTOCOL_VERSION = 1;

export interface SampleEntry {
  readonly semanticKey: string;
  readonly sample: Sample;
}

/** One push containing every requested key's current state. */
export interface SampleBatch {
  readonly version: number;
  readonly sentAt: string;
  readonly samples: readonly SampleEntry[];
}

export type DecodeResult =
  | { readonly ok: true; readonly batch: SampleBatch }
  | { readonly ok: false; readonly reason: string };

export const SAMPLE_EVENT = "samples";
export const SAMPLE_STREAM_PATH = "/ws";

export function createBatch(
  samples: readonly SampleEntry[],
  sentAtMs: number,
): SampleBatch {
  return {
    version: PROTOCOL_VERSION,
    sentAt: new Date(sentAtMs).toISOString(),
    samples,
  };
}

/** Check version before interpreting the rest of the payload. */
export function decodeBatch(payload: string): DecodeResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(payload);
  } catch (error) {
    return {
      ok: false,
      reason: `not valid JSON: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, reason: "not an object" };
  }

  const candidate = parsed as Partial<SampleBatch>;

  if (candidate.version !== PROTOCOL_VERSION) {
    return {
      ok: false,
      reason:
        `this display speaks protocol ${PROTOCOL_VERSION} and the host sent ` +
        `${String(candidate.version)}. Update whichever is older.`,
    };
  }

  if (
    !Array.isArray(candidate.samples) ||
    typeof candidate.sentAt !== "string"
  ) {
    return { ok: false, reason: "missing sentAt or samples" };
  }

  return { ok: true, batch: candidate as SampleBatch };
}

/** Prefix every payload line per SSE framing rules and terminate with a blank line. */
export function formatSseEvent(event: string, payload: string): string {
  const data = payload
    .split("\n")
    .map((line) => `data: ${line}`)
    .join("\n");

  return `event: ${event}\n${data}\n\n`;
}
