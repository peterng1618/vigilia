import type { ServerResponse } from 'node:http';
import { SAMPLE_EVENT, formatSseEvent } from '@vigilia/renderer-core';
import { KeepLatestSlot } from './keep-latest.js';

/**
 * One connected display.
 *
 * This is where §111's slow-client rule stops being a policy and becomes
 * behaviour. A socket applies backpressure: `res.write` returns `false` once
 * the kernel buffer is full, and the honest options at that moment are to
 * queue, to block, or to drop. Queueing telemetry is the wrong one — by the
 * time a slow phone drains a backlog, every frame in it describes the past.
 *
 * So a full socket parks the newest frame in a {@link KeepLatestSlot} and
 * waits for `drain`. Frames arriving meanwhile replace it. The phone resumes
 * at *now*, not by fast-forwarding through what it missed.
 */
export class SseConnection {
  private readonly slot = new KeepLatestSlot<string>();
  private waitingForDrain = false;
  private closed = false;

  /**
   * @param semanticKeys What this display needs. The union across connections
   *   is what the host polls — so a second phone on the same dashboard adds
   *   nothing to acquire.
   */
  constructor(
    private readonly response: ServerResponse,
    readonly semanticKeys: readonly string[],
  ) {
    response.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      // Without this a reverse proxy may buffer the stream into uselessness.
      'x-accel-buffering': 'no',
    });

    // A first comment flushes headers, so EventSource fires `open` promptly
    // rather than when the first batch happens to arrive.
    response.write(': connected\n\n');
  }

  /** Frames a batch and sends it, or parks it if the socket is full. */
  offer(payload: string): void {
    if (this.closed) {
      return;
    }

    this.slot.offer(formatSseEvent(SAMPLE_EVENT, payload));
    this.flush();
  }

  private flush(): void {
    if (this.closed || this.waitingForDrain) {
      return;
    }

    const frame = this.slot.take();

    if (frame === undefined) {
      return;
    }

    const flushed = this.response.write(frame);

    if (flushed) {
      return;
    }

    // Full. Stop writing and let the newest frame win while we wait.
    this.waitingForDrain = true;
    this.response.once('drain', () => {
      this.waitingForDrain = false;
      this.flush();
    });
  }

  /** Frames displaced before they were ever sent — evidence of a slow client. */
  get droppedCount(): number {
    return this.slot.droppedCount;
  }

  close(): void {
    if (this.closed) {
      return;
    }

    this.closed = true;
    this.response.end();
  }
}
