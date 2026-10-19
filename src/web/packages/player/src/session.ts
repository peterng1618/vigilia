/** A paired display carries its host session in the page URL, because
 * `EventSource` cannot set request headers. Loopback displays carry none. */

import { readStoredPairing } from "./host-refind.js";

export interface DisplaySessionToken {
  readonly token: string | undefined;
  /** The page this display is on, which is where its own display and the origin
   * of its theme are read from: a poll has to name the display that asked. */
  readonly pageUrl: string;
  /** Adds the token to a fetch, which can use the header form. */
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  /** Appends the token to a stream URL, which cannot. */
  streamUrl(path: string, parameters: URLSearchParams): string;
  /** Appends the token to a URL handed to a loader that sets no headers, such
   * as Fabric's image fetch. A no-op with no token, so loopback URLs stay
   * exactly as they were. */
  withToken(url: string): string;
}

/**
 * **Reads storage, never writes it.** `rememberPairing` is the single writer,
 * because the identity comes from `GET /api/host` and nowhere else: nothing in
 * the repo emits `host=`, `name=` or `port=`, so a record written here could
 * only carry an empty `hostId` — which reads back as a valid pairing, matches
 * no probe, and would overwrite a good one on any load where the route failed
 * (R72).
 *
 * The URL wins when it carries a token, so a fresh pairing link still replaces
 * a stale stored credential; storage answers only when the URL does not.
 */
export function displaySession(
  pageUrl: string,
  fetcher: typeof fetch,
  storage?: Storage,
): DisplaySessionToken {
  const stored = storage === undefined ? undefined : readStoredPairing(storage);
  const token =
    new URL(pageUrl).searchParams.get("session") ?? stored?.token ?? undefined;

  return {
    token,
    pageUrl,
    fetch(input, init) {
      if (token === undefined) {
        return fetcher(input, init);
      }

      const headers = new Headers(init?.headers);
      headers.set("x-vigilia-session", token);
      return fetcher(input, { ...init, headers });
    },
    streamUrl(path, parameters) {
      const query = new URLSearchParams(parameters);
      if (token !== undefined) {
        query.set("session", token);
      }
      return `${path}?${query.toString()}`;
    },
    withToken(url) {
      if (token === undefined) {
        return url;
      }

      const query = new URLSearchParams({ session: token });
      const separator = url.includes("?") ? "&" : "?";
      return `${url}${separator}${query.toString()}`;
    },
  };
}
