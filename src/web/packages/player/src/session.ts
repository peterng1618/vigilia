/** A paired display carries its host session in the page URL, because
 * `EventSource` cannot set request headers. Loopback displays carry none. */

import {
  type PairedHost,
  readStoredPairing,
  storePairing,
} from "./host-refind.js";

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
 * What this load writes down: the identity the URL carries if it carries one,
 * the identity already stored if it does not, this load's own address, and the
 * credential. Written on **every** load, because `localStorage` is per-origin:
 * a record left at the old address is invisible to the page at the new one, so
 * storing once at pairing would make the first move work and lose the host on
 * the second (R60).
 *
 * The port comes from the URL's own authority unless the URL names one, and a
 * page whose port cannot be read writes nothing: a pairing with no port is not
 * a pairing, and guessing 80 would send the display to a host that is not
 * there.
 */
function pairingFor(
  page: URL,
  token: string,
  stored: PairedHost | undefined,
): PairedHost | undefined {
  const port = Number(page.searchParams.get("port") ?? page.port);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    return undefined;
  }

  return {
    hostId: page.searchParams.get("host") ?? stored?.hostId ?? "",
    hostName: page.searchParams.get("name") ?? stored?.hostName ?? "",
    port,
    token,
    lastAddress: page.hostname,
  };
}

export function displaySession(
  pageUrl: string,
  fetcher: typeof fetch,
  storage?: Storage,
): DisplaySessionToken {
  const page = new URL(pageUrl);
  const stored = storage === undefined ? undefined : readStoredPairing(storage);
  // The URL wins when it carries a token: a fresh pairing link has to be able to
  // replace a stale stored one, or a display re-paired to a second host keeps
  // the first host's credential.
  const token = page.searchParams.get("session") ?? stored?.token ?? undefined;

  if (storage !== undefined && token !== undefined) {
    const pairing = pairingFor(page, token, stored);

    if (pairing !== undefined) {
      storePairing(storage, pairing);
    }
  }

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
