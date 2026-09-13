import type { Sample } from '../types.js';

/**
 * The wire format between the host and a display.
 *
 * ## Why this lives in `renderer-core` rather than in the host
 *
 * Because **both sides import it**, and that is the whole point. The old C#
 * host kept its own copy of the sample contract, hand-mirrored into
 * `types.ts`; `AGENTS.md` names that the highest-risk edit in the repository,
 * since a change on one side compiles cleanly on the other and produces wrong
 * values at runtime. Putting the wire shape in the shared library means there
 * is exactly one definition, checked by the compiler on both ends
 * ([ADR-0007](../../../../../docs/decisions/0007-host-in-node-shipped-as-a-cli.md)).
 *
 * Pure: strings and objects, no socket, no `EventSource`, no `http`. The host
 * formats what this returns and the display parses with it; neither transport
 * detail belongs here.
 *
 * ## Why Server-Sent Events rather than a WebSocket
 *
 * Telemetry is push-only — the host sends samples and a display never sends
 * one back. SSE is exactly that: plain HTTP on the server already running,
 * `EventSource` reconnects by itself, and it costs **no dependency**, where a
 * WebSocket server in Node needs one whose bidirectionality would go unused.
 * When a display eventually needs to talk back (declaring the keys it wants,
 * pairing), that is a POST — not a reason to change transport.
 */

/**
 * The wire version.
 *
 * Bumped when a frame's *meaning* changes. §141's rule for the theme format
 * applies here too: meeting a version we do not know must produce a clear
 * refusal, not a guess at a payload we cannot interpret.
 */
export const PROTOCOL_VERSION = 1;

/** One semantic key's newest reading. */
export interface SampleEntry {
  readonly semanticKey: string;
  readonly sample: Sample;
}

/** One push: every requested key's state at one instant. */
export interface SampleBatch {
  readonly version: number;
  /** ISO-8601, when the host sent it. */
  readonly sentAt: string;
  readonly samples: readonly SampleEntry[];
}

export type DecodeResult =
  | { readonly ok: true; readonly batch: SampleBatch }
  | { readonly ok: false; readonly reason: string };

/** The SSE event name carrying a {@link SampleBatch}. */
export const SAMPLE_EVENT = 'samples';

/** The path the host serves the sample stream on. */
export const SAMPLE_STREAM_PATH = '/ws';

/** Builds a batch stamped with the current version. */
export function createBatch(samples: readonly SampleEntry[], sentAtMs: number): SampleBatch {
  return {
    version: PROTOCOL_VERSION,
    sentAt: new Date(sentAtMs).toISOString(),
    samples,
  };
}

/**
 * Parses a frame's JSON payload.
 *
 * Version is checked **before** anything else is read. A newer host may have
 * changed what `samples` means, so inspecting it first would be interpreting a
 * format we have already established we do not understand.
 */
export function decodeBatch(payload: string): DecodeResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(payload);
  } catch (error) {
    return {
      ok: false,
      reason: `not valid JSON: ${error instanceof Error ? error.message : 'unknown error'}`,
    };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, reason: 'not an object' };
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

  if (!Array.isArray(candidate.samples) || typeof candidate.sentAt !== 'string') {
    return { ok: false, reason: 'missing sentAt or samples' };
  }

  return { ok: true, batch: candidate as SampleBatch };
}

/**
 * Formats one SSE event. Server-side, but kept beside the parser it feeds.
 *
 * Every line of the payload needs its own `data:` prefix, and the event ends
 * on a blank line. `JSON.stringify` cannot emit a raw newline inside a string,
 * so in practice this is one line — but the split is not optional: a payload
 * containing a bare newline would otherwise terminate the event early and the
 * client would parse half a frame as a whole one.
 */
export function formatSseEvent(event: string, payload: string): string {
  const data = payload
    .split('\n')
    .map((line) => `data: ${line}`)
    .join('\n');

  return `event: ${event}\n${data}\n\n`;
}
