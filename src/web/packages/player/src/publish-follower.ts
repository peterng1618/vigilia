/**
 * Whether what this display is showing is still what the author is publishing.
 *
 * One small number, polled, because the display already holds an SSE connection
 * for readings and adding a second event channel would be a second owner for
 * "the host has news". A refusal is not silence: a session that expired turns
 * every poll into a 403, and a follower that read that as "nothing changed"
 * would leave a frozen dashboard with no explanation (§ Review Focus 4).
 *
 * `ponytail:` comes back with the document rather than diffing it in place —
 * a flash on a phone that is usually on a wall, for one screenful of code. If
 * the flash ever matters, the upgrade is to hand the new envelope to the
 * existing mount instead of reloading.
 */

export interface PublishFollowerSession {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface PublishFollowerOptions {
  readonly intervalMs?: number;
  readonly onRefused?: (reason: string) => void;
}

const DEFAULT_INTERVAL_MS = 2_000;

export function followPublished(
  session: PublishFollowerSession,
  reload: () => void,
  options: PublishFollowerOptions = {},
): () => void {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  let stopped = false;
  let last: number | undefined;

  const tick = async (): Promise<void> => {
    if (stopped) return;

    try {
      const response = await session.fetch("/api/published");

      if (response.status === 403 || response.status === 404) {
        stopped = true;
        options.onRefused?.("This display is no longer paired with the host.");
        return;
      }

      if (response.ok) {
        const body = (await response.json()) as { revision?: unknown };
        if (typeof body.revision === "number") {
          // `last` moves even on the reload path. Reloading and returning with
          // `last` still stale re-fires on every tick, which is invisible in
          // production (a real reload navigates away) and a reload storm the
          // moment the reload does not — a test double, or a blocked reload.
          const moved = last !== undefined && body.revision !== last;
          last = body.revision;
          if (moved) {
            reload();
            return;
          }
        }
      }
    } catch {
      // A host that is briefly unreachable is the connection surface's news,
      // not this follower's: the readings stream already says it.
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), intervalMs);

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
