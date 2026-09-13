import { SAMPLE_EVENT, decodeBatch } from './protocol.js';
import type { SampleSource } from './source.js';
import { SampleStore } from './store.js';

/**
 * The display's side of the transport: real samples from the host.
 *
 * This is the one thing the player swaps to stop rendering invented numbers.
 * The renderer itself does not change at all — it only ever sees a
 * {@link SampleSource}, which is exactly the seam ADR-0006 predicted would
 * make the host a small change rather than a rewrite.
 *
 * ## Pull inside, push outside
 *
 * §116 puts acquisition on the PC and rendering on the phone, and the
 * renderer's contract is a *pull*: `latest` and `history` answer when the plan
 * builder asks. The transport is a *push*. This module is where the two meet —
 * events land in a bounded {@link SampleStore}, and the plan builder reads the
 * store. Nothing downstream of here knows a socket exists.
 */

/** What the display can honestly say about its connection right now. */
export type LiveSourceStatus =
  | 'connecting'
  /** Receiving batches. */
  | 'live'
  /** Lost the stream; `EventSource` is retrying on its own. */
  | 'reconnecting'
  /** Incompatible host, or a payload we will not guess at. Not retried. */
  | 'refused';

/**
 * The slice of `EventSource` this needs.
 *
 * Narrowed to an interface so a test can drive the state machine without a
 * browser or a server — the same reason `plan.ts` is separated from
 * `mount.ts`. `EventSource` itself is only constructed by the default factory.
 */
export interface EventSourceLike {
  addEventListener(type: string, listener: (event: { readonly data: string }) => void): void;
  close(): void;
}

export interface LiveSourceOptions {
  /** The host's sample stream, e.g. `/ws?keys=cpu.load,ram.used`. */
  readonly url: string;
  /** Reuse an existing store; a fresh bounded one is created otherwise. */
  readonly store?: SampleStore;
  /** Injected so tests control the clock. Defaults to `Date.now`. */
  readonly now?: () => number;
  /** Told about every transition, for the on-screen connection state. */
  readonly onStatus?: (status: LiveSourceStatus, detail?: string) => void;
  /** Injected in tests. Defaults to the global `EventSource`. */
  readonly open?: (url: string) => EventSourceLike;
}

export interface LiveSourceHandle {
  /** Hand this to the plan builder. It never changes identity. */
  readonly source: SampleSource;
  readonly status: LiveSourceStatus;
  /** Batches applied since opening. Zero is how "connected but silent" shows. */
  readonly batchCount: number;
  close(): void;
}

/**
 * Opens the sample stream and returns a source reading from it.
 *
 * A **version mismatch is not retried** (§141). `EventSource` reconnects on
 * error by design, which is right for a dropped Wi-Fi link and wrong for a
 * host that speaks a protocol this display does not: that would be an infinite
 * loop of reconnecting and refusing. So an incompatible frame closes the
 * stream and reports `refused`, once, with the reason.
 */
export function createLiveSource(options: LiveSourceOptions): LiveSourceHandle {
  const store = options.store ?? new SampleStore();
  const now = options.now ?? (() => Date.now());
  const openStream =
    options.open ??
    ((url: string) => new EventSource(url) as unknown as EventSourceLike);

  let status: LiveSourceStatus = 'connecting';
  let batchCount = 0;
  let closed = false;

  const stream = openStream(options.url);

  const setStatus = (next: LiveSourceStatus, detail?: string): void => {
    if (status === next) {
      return;
    }

    status = next;
    // Called with `detail` only when there is one: with
    // exactOptionalPropertyTypes an explicit `undefined` is a different type
    // from an omitted argument.
    if (detail === undefined) {
      options.onStatus?.(next);
    } else {
      options.onStatus?.(next, detail);
    }
  };

  const close = (): void => {
    if (closed) {
      return;
    }

    closed = true;
    stream.close();
  };

  stream.addEventListener('open', () => {
    // Deliberately not 'live' yet. An open socket is not a reading, and saying
    // "live" before a batch arrives would misreport a host that connects and
    // then sends nothing.
    if (status === 'reconnecting') {
      setStatus('connecting');
    }
  });

  stream.addEventListener('error', () => {
    // EventSource surfaces an error and retries by itself. Nothing to do but
    // say so — except when we have already refused, which must not be undone
    // by the close that refusal caused.
    if (status !== 'refused') {
      setStatus('reconnecting');
    }
  });

  stream.addEventListener(SAMPLE_EVENT, (event) => {
    const result = decodeBatch(event.data);

    if (!result.ok) {
      setStatus('refused', result.reason);
      close();
      return;
    }

    store.ingest(
      result.batch.samples.map((entry) => [entry.semanticKey, entry.sample] as const),
      now(),
    );

    batchCount += 1;
    setStatus('live');
  });

  return {
    source: store,
    get status() {
      return status;
    },
    get batchCount() {
      return batchCount;
    },
    close,
  };
}
