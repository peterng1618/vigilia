import { SAMPLE_EVENT, decodeBatch } from "./protocol.js";
import type { SampleSource } from "./source.js";
import { SampleStore } from "./store.js";
import type { Sample } from "../types.js";

/** Push transport → bounded pull `SampleSource`; downstream rendering stays transport-agnostic. */

export type LiveSourceStatus =
  | "connecting"
  | "live"
  | "reconnecting"
  | "refused";

/** Minimal injectable `EventSource` surface for the state machine. */
export interface EventSourceLike {
  addEventListener(
    type: string,
    listener: (event: { readonly data: string }) => void,
  ): void;
  close(): void;
}

export interface LiveSourceOptions {
  readonly url: string;
  readonly store?: SampleStore;
  readonly now?: () => number;
  readonly onStatus?: (status: LiveSourceStatus, detail?: string) => void;
  readonly open?: (url: string) => EventSourceLike;
}

export interface LiveSourceHandle {
  readonly source: SampleSource;
  readonly status: LiveSourceStatus;
  readonly batchCount: number;
  close(): void;
}

/** Keep presentation behind the host's one-second sampling cadence. */
export const LIVE_SOURCE_DISPLAY_DELAY_MS = 1_000;

/** Protocol refusal closes permanently; ordinary EventSource errors keep retrying. */
export function createLiveSource(options: LiveSourceOptions): LiveSourceHandle {
  const store = options.store ?? new SampleStore();
  const now = options.now ?? (() => Date.now());
  const openStream =
    options.open ??
    ((url: string) => new EventSource(url) as unknown as EventSourceLike);

  let status: LiveSourceStatus = "connecting";
  let batchCount = 0;
  let closed = false;
  const pending: {
    readonly releaseAtMs: number;
    readonly entries: readonly (readonly [string, Sample])[];
  }[] = [];

  const releasePending = (): void => {
    const timestamp = now();

    while (true) {
      const batch = pending[0];
      if (batch === undefined || batch.releaseAtMs > timestamp) return;
      pending.shift();
      store.ingest(batch.entries, timestamp);
    }
  };

  const source: SampleSource = {
    presentationDelayMs: LIVE_SOURCE_DISPLAY_DELAY_MS,
    latest(semanticKey) {
      releasePending();
      return store.latest(semanticKey);
    },
    history(semanticKey, windowSeconds) {
      releasePending();
      return store.history(semanticKey, windowSeconds);
    },
  };

  const stream = openStream(options.url);

  const setStatus = (next: LiveSourceStatus, detail?: string): void => {
    if (status === next) {
      return;
    }

    status = next;
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

  stream.addEventListener("open", () => {
    // An open socket is not yet evidence of live samples.
    if (status === "reconnecting") {
      setStatus("connecting");
    }
  });

  stream.addEventListener("error", () => {
    if (status !== "refused") {
      setStatus("reconnecting");
    }
  });

  stream.addEventListener(SAMPLE_EVENT, (event) => {
    const result = decodeBatch(event.data);

    if (!result.ok) {
      setStatus("refused", result.reason);
      close();
      return;
    }

    pending.push({
      releaseAtMs: now() + LIVE_SOURCE_DISPLAY_DELAY_MS,
      entries: result.batch.samples.map(
        (entry) => [entry.semanticKey, entry.sample] as const,
      ),
    });

    batchCount += 1;
    setStatus("live");
  });

  return {
    source,
    get status() {
      return status;
    },
    get batchCount() {
      return batchCount;
    },
    close,
  };
}
