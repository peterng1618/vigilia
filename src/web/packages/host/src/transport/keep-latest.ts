/**
 * The per-client send slot. Pure, and the whole of §111's slow-client rule.
 *
 * "Bound per-client queues and discard obsolete pending snapshots for slow
 * clients" is not a queue with a cap — it is a slot that holds **one** item.
 * A telemetry snapshot has no value once a newer one exists: replaying a
 * backlog shows a phone the past at speed and then catches up, which is worse
 * than having shown it nothing. So a new snapshot *replaces* the pending one
 * and the old one is dropped.
 *
 * Drops are counted rather than ignored, because "this client cannot keep up"
 * is exactly the kind of claim §111 asks to be measured instead of assumed.
 */
export class KeepLatestSlot<T> {
  private pending: T | undefined;
  private dropped = 0;
  private delivered = 0;

  /**
   * Offers a snapshot, replacing anything still waiting.
   *
   * @returns `true` when this displaced an undelivered snapshot.
   */
  offer(item: T): boolean {
    const displaced = this.pending !== undefined;

    if (displaced) {
      this.dropped += 1;
    }

    this.pending = item;

    return displaced;
  }

  /** Takes the pending snapshot, if any, and empties the slot. */
  take(): T | undefined {
    const item = this.pending;

    this.pending = undefined;

    if (item !== undefined) {
      this.delivered += 1;
    }

    return item;
  }

  get hasPending(): boolean {
    return this.pending !== undefined;
  }

  /** Snapshots displaced before they were ever sent. */
  get droppedCount(): number {
    return this.dropped;
  }

  get deliveredCount(): number {
    return this.delivered;
  }
}
