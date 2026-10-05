/** A paired display carries its host session in the page URL, because
 * `EventSource` cannot set request headers. Loopback displays carry none. */

export interface DisplaySessionToken {
  readonly token: string | undefined;
  /** Adds the token to a fetch, which can use the header form. */
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  /** Appends the token to a stream URL, which cannot. */
  streamUrl(path: string, parameters: URLSearchParams): string;
  /** Appends the token to a URL handed to a loader that sets no headers, such
   * as Fabric's image fetch. A no-op with no token, so loopback URLs stay
   * exactly as they were. */
  withToken(url: string): string;
}

export function displaySession(
  pageUrl: string,
  fetcher: typeof fetch,
): DisplaySessionToken {
  const token = new URL(pageUrl).searchParams.get("session") ?? undefined;

  return {
    token,
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
