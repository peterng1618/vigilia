/** Single pending telemetry slot: newer snapshots replace obsolete unsent ones. */
export class KeepLatestSlot<T> {
  private pending: T | undefined;
  private dropped = 0;
  private delivered = 0;

  /** Offers a snapshot and reports whether it displaced one still pending. */
  offer(item: T): boolean {
    const displaced = this.pending !== undefined;

    if (displaced) {
      this.dropped += 1;
    }

    this.pending = item;

    return displaced;
  }

  /** Takes and clears the pending snapshot. */
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

  /** Snapshots displaced before delivery. */
  get droppedCount(): number {
    return this.dropped;
  }

  get deliveredCount(): number {
    return this.delivered;
  }
}
