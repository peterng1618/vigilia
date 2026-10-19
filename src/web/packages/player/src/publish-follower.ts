/**
 * Whether what this display is showing is still what the author is publishing,
 * and whether the theme it was assigned has moved.
 *
 * One small number, polled, because the display already holds an SSE connection
 * for readings and adding a second event channel would be a second owner for
 * "the host has news". A refusal is not silence: a session that expired turns
 * every poll into a 403, and a follower that read that as "nothing changed"
 * would leave a frozen dashboard with no explanation (§ Review Focus 4).
 *
 * The poll names the display it is for, read from the page it is on, and that
 * is what lets the host answer an assignment at all: the page carries the
 * display it was resolved for and where its theme came from, and neither is
 * inferable from `/api/published` alone. It is also the only *repeating*
 * request a local display's window makes, so it is the sighting that keeps a
 * restarted host from opening a second window on a monitor that has one.
 *
 * `ponytail:` comes back with the document rather than diffing it in place —
 * a flash on a phone that is usually on a wall, for one screenful of code. If
 * the flash ever matters, the upgrade is to hand the new envelope to the
 * existing mount instead of reloading.
 */

interface PublishFollowerSession {
  readonly pageUrl: string;
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface PublishFollowerOptions {
  readonly intervalMs?: number;
  readonly onRefused?: (reason: string) => void;
  /** The theme the host now says this display should be showing. Called only
   *  for a page the host resolved itself, and only when the answer moves. */
  readonly onThemeChange?: (theme: string | null) => void;
}

const DEFAULT_INTERVAL_MS = 2_000;
/** Only the page's query is read, and `new URL` needs a base to read one from. */
const PAGE_BASE = "http://vigilia.invalid";

/**
 * The poll this page's own display answers.
 *
 * The page names the display it was resolved for and where its theme came from.
 * **The theme itself is forwarded only for a link**, because a theme the host
 * resolved is answered by the map: a page that echoed its own back would be
 * answered `null` — the link rule — on every poll, and no assignment would ever
 * reach anyone.
 */
function pollUrl(page: URL): string {
  const query = new URLSearchParams();
  const display = page.searchParams.get("display");
  const source = page.searchParams.get("theme-source");
  const theme = page.searchParams.get("theme");

  if (display !== null) query.set("display", display);
  if (source !== null) query.set("theme-source", source);
  if (source === "link" && theme !== null) query.set("theme", theme);

  const search = query.toString();

  return search.length === 0 ? "/api/published" : `/api/published?${search}`;
}

export function followPublished(
  session: PublishFollowerSession,
  reload: () => void,
  options: PublishFollowerOptions = {},
): () => void {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const page = new URL(session.pageUrl, PAGE_BASE);
  const url = pollUrl(page);
  // Only a page the host resolved itself may be moved by an assignment. A link
  // is the person's own instruction for that page, and a page showing a publish
  // would reload, re-resolve to the published theme and see the map's entry
  // again on the next poll — a reload loop. Suppressing costs nothing, because
  // the revision comparison below reloads a display when the publish moves.
  const followsMap = page.searchParams.get("theme-source") === "map";
  let stopped = false;
  let last: number | undefined;
  let lastTheme: string | null | undefined;

  const tick = async (): Promise<void> => {
    if (stopped) return;

    try {
      const response = await session.fetch(url);

      if (response.status === 403 || response.status === 404) {
        stopped = true;
        options.onRefused?.("This display is no longer paired with the host.");
        return;
      }

      if (response.ok) {
        const body = (await response.json()) as {
          revision?: unknown;
          display?: { theme?: unknown };
        };

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

        const theme = body.display?.theme;

        if (theme === null || typeof theme === "string") {
          // The first answer is the baseline: a page that has just loaded is
          // showing what the host last resolved for it, so only a *move* is
          // news. `lastTheme` moves before the reload for the reason `last`
          // does.
          const moved = lastTheme !== undefined && theme !== lastTheme;
          lastTheme = theme;
          if (moved && followsMap) {
            options.onThemeChange?.(theme);
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
