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
  /** The last move the host refused, in its own words, or null. A refusal
   *  cannot come back in the answer to the PUT that asked for the move — the
   *  host cannot rebind while that answer is on its socket — so this is where
   *  one is read from, on the read that follows. */
  readonly refusal: string | null;
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
      // A host that says nothing about a refusal has not refused anything this
      // reader can act on, so it reads as none rather than as unreadable.
      refusal: isString(body["refusal"]) ? body["refusal"] : null,
    };
  } catch {
    return undefined;
  }
}

/** How long the read that follows a move keeps trying. The port is closed and
 *  reopened across a move, so a read that lands in that window is refused by
 *  the operating system rather than answered by the host — measured at 4 ms for
 *  the rebind, with this a wide margin. **Bounded on purpose: an unbounded
 *  retry is a hang**, and a host that is genuinely gone should say so. */
const SETTLE_ATTEMPTS = 10;
const SETTLE_PAUSE_MS = 40;

async function readSettled(
  fetcher: typeof fetch,
): Promise<HostingAnswer | undefined> {
  for (let attempt = 0; attempt < SETTLE_ATTEMPTS; attempt += 1) {
    const answer = await readHosting(fetcher);
    if (answer !== undefined) return answer;

    if (attempt < SETTLE_ATTEMPTS - 1) {
      await new Promise((resolve) => setTimeout(resolve, SETTLE_PAUSE_MS));
    }
  }

  return undefined;
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
 *  interface refused or why, and a message composed here would be a guess.
 *
 *  **A 200 means the host accepted the request, not that it moved.** It answers
 *  first and moves afterwards, because it cannot rebind while its answer is
 *  still on the socket. So where it landed — and a refusal, if it made one — is
 *  read from the host after the move has settled. */
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

    const answer = await readSettled(fetcher);
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
