/**
 * What this host offers a phone, asked from the editor.
 *
 * Everything here answers `undefined` rather than throwing: the editor is
 * routinely served by a build with no host behind it, and a header that cannot
 * say where the phone should go must render nothing — not an error the author
 * cannot act on, and never an address the editor invented.
 */

export interface HostingAnswer {
  readonly lan: boolean;
  readonly address: string | null;
  readonly port: number | null;
  readonly session?: { readonly token: string; readonly expiresAt: string };
}

const isString = (value: unknown): value is string => typeof value === "string";

export async function readHosting(
  fetcher: typeof fetch = fetch,
): Promise<HostingAnswer | undefined> {
  try {
    const response = await fetcher("/api/hosting");
    if (!response.ok) return undefined;

    const body = (await response.json()) as Record<string, unknown>;
    if (typeof body["lan"] !== "boolean") return undefined;
    if (body["address"] !== null && !isString(body["address"]))
      return undefined;
    if (body["port"] !== null && typeof body["port"] !== "number")
      return undefined;

    return {
      lan: body["lan"],
      address: body["address"] === null ? null : (body["address"] as string),
      port: body["port"] === null ? null : (body["port"] as number),
    };
  } catch {
    return undefined;
  }
}

/** Mints a display credential. The host refuses anything but loopback, which is
 *  where the editor already is (§145). */
export async function mintSession(
  fetcher: typeof fetch = fetch,
): Promise<HostingAnswer["session"]> {
  try {
    const response = await fetcher("/api/pairing/sessions?label=display", {
      method: "POST",
    });
    if (!response.ok) return undefined;

    const { session } = (await response.json()) as {
      session?: { token?: unknown; expiresAt?: unknown };
    };
    if (!isString(session?.token) || !isString(session.expiresAt))
      return undefined;

    return { token: session.token, expiresAt: session.expiresAt };
  } catch {
    return undefined;
  }
}

/** Asks the host to serve the LAN, or to stop. The host owns the binding, so a
 *  refusal comes back in its words — the editor has no way to know which
 *  interface refused or why, and a message composed here would be a guess. */
export async function setLan(
  on: boolean,
  fetcher: typeof fetch = fetch,
): Promise<
  { ok: true; answer: HostingAnswer } | { ok: false; reason: string }
> {
  try {
    const response = await fetcher("/api/hosting", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lan: on }),
    });

    if (!response.ok) {
      // The host's own words: it is the only thing that knows why a socket
      // refused, and a message composed here would be a guess shown as a fact.
      return { ok: false, reason: (await response.text()).trim() };
    }

    const answer = await readHosting(fetcher);
    return answer === undefined
      ? { ok: false, reason: "The host answered with something unreadable." }
      : { ok: true, answer };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

/** The URL the QR carries. The token rides in the query because `EventSource`
 *  cannot set a request header, which is why it is short-lived. */
export function displayUrl(
  answer: { readonly address: string; readonly port: number },
  token: string,
): string {
  return `http://${answer.address}:${answer.port}/?session=${encodeURIComponent(token)}`;
}
