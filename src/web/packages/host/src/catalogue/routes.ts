import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import {
  hostnameOf,
  isForeignOrigin,
  isLoopbackName,
  isLoopbackRemote,
} from "../server.js";
import type { StoreSessionStore } from "../settings/store-session.js";

/**
 * The host's store session routes, kept out of `server.ts` because that file is
 * already past the size a reader can hold.
 *
 * The browser never sees the session token. A sign-in starts at the Worker's
 * social flow, the Worker's return page hands the host a one-time token, and the
 * host redeems it here — writing the session it buys to the settings directory
 * and answering the popup with a page that has nothing in it but a sentence.
 */

const SESSION_PATH = "/api/store/session";
const START_PATH = "/api/store/auth/start";
const RETURN_PATH = "/api/store/auth/return";
const SIGN_OUT_PATH = "/api/store/auth/sign-out";

const PATHS = new Set([SESSION_PATH, START_PATH, RETURN_PATH, SIGN_OUT_PATH]);

/** How long a started sign-in may take before its state is spent. */
const STATE_TTL_MS = 10 * 60 * 1000;
/** The most sign-ins a single host remembers at once. */
const STATE_LIMIT = 64;

export interface CatalogueRouteDeps {
  /** The Worker's origin. Absent when this host has no store to sign in to. */
  readonly origin: string | undefined;
  readonly sessionStore: StoreSessionStore | undefined;
  readonly fetch: typeof fetch;
  /** The sign-ins this server started, and nothing another server did. */
  readonly states: PendingStates;
}

export interface PendingStates {
  /** Remember a sign-in started for `host`, and answer its state. */
  remember(host: string): string;
  /** Spend a state: true only when this server started it, for this host, and
   *  it has not expired. A state is one redirect's worth of state. */
  spend(state: string, host: string): boolean;
}

interface PendingEntry {
  /** The loopback origin the sign-in was started for. */
  readonly host: string;
  readonly at: number;
}

/**
 * A server's own started sign-ins.
 *
 * Per server rather than module-wide, so a state one host instance minted is
 * not redeemable by another in the same process. In memory on purpose: a host
 * restarted mid-sign-in asks the person to start again rather than resuming a
 * flow whose browser conversation is gone.
 */
export function createPendingStates(): PendingStates {
  const pending = new Map<string, PendingEntry>();

  return {
    remember(host) {
      const now = Date.now();

      for (const [state, entry] of pending) {
        if (now - entry.at > STATE_TTL_MS) pending.delete(state);
      }

      // Capped by dropping the oldest: a start route is the only writer, and
      // the 64th sign-in is not one whose predecessor is still worth holding.
      while (pending.size >= STATE_LIMIT) {
        const oldest = pending.keys().next().value;
        if (oldest === undefined) break;
        pending.delete(oldest);
      }

      const state = randomUUID();
      pending.set(state, { host, at: now });
      return state;
    },

    spend(state, host) {
      const entry = pending.get(state);
      // One use whatever it answers: a state that was replayed or refused is
      // not one a second attempt gets to try again.
      pending.delete(state);

      if (entry === undefined) return false;
      if (Date.now() - entry.at > STATE_TTL_MS) return false;
      return entry.host === host;
    },
  };
}

function answer(status: number, body: string, type: string): Response {
  return new Response(body, {
    status,
    headers: { "content-type": type, "cache-control": "no-store" },
  });
}

function json(status: number, body: unknown): Response {
  return answer(
    status,
    JSON.stringify(body),
    "application/json; charset=utf-8",
  );
}

function text(status: number, body: string): Response {
  return answer(status, body, "text/plain; charset=utf-8");
}

function html(status: number, message: string): Response {
  return answer(
    status,
    `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>Yunari sign-in</title>
<p>${message}</p>`,
    "text/html; charset=utf-8",
  );
}

/**
 * The origin this request was made at, when it is a loopback host on a numeric
 * port, otherwise nothing.
 *
 * `[::1]` is sent as `127.0.0.1`, because the Worker refuses a return host it
 * cannot parse and accepts only `127.0.0.1` or `localhost`.
 */
function loopbackOriginOf(request: IncomingMessage): string | undefined {
  const authority = request.headers.host;
  if (authority === undefined) return undefined;

  const name = hostnameOf(authority);
  if (!isLoopbackName(name)) return undefined;

  const port = new URL(`http://${authority}`).port;
  if (!/^\d{1,5}$/.test(port)) return undefined;

  const number = Number(port);
  if (number < 1 || number > 65_535) return undefined;

  return `http://${name === "localhost" ? "localhost" : "127.0.0.1"}:${number}`;
}

function decode(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

/**
 * The session token the exchange bought: the bearer plugin's `set-auth-token`
 * header where the Worker sends one, else the session cookie's own value.
 *
 * Better Auth prefixes the cookie name with `__Secure-` when its own URL is
 * https, so both exact names are read; a prefix or suffix match would accept a
 * name the Worker never sets.
 */
const SESSION_COOKIES = new Set([
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
]);

function sessionTokenOf(exchanged: Response): string | undefined {
  const header = exchanged.headers.get("set-auth-token");
  if (header !== null && header !== "") return decode(header);

  const cookies =
    typeof exchanged.headers.getSetCookie === "function"
      ? exchanged.headers.getSetCookie()
      : [exchanged.headers.get("set-cookie") ?? ""];

  for (const cookie of cookies) {
    for (const pair of cookie.split(";")) {
      const [name, ...rest] = pair.trim().split("=");
      if (name !== undefined && SESSION_COOKIES.has(name) && rest.length > 0) {
        return decode(rest.join("="));
      }
    }
  }

  return undefined;
}

async function start(
  request: IncomingMessage,
  origin: string,
  states: PendingStates,
): Promise<Response> {
  if (request.method !== "POST") return text(405, "Only POST is supported.");

  const host = loopbackOriginOf(request);
  if (host === undefined) {
    return text(400, "A sign-in can only return to a loopback host.");
  }

  const target = new URL("/auth/start", origin);
  target.searchParams.set("provider", "github");
  // The origin only: the Worker's return page appends the callback path.
  target.searchParams.set("host", host);
  target.searchParams.set("state", states.remember(host));

  return json(200, { url: target.toString() });
}

async function complete(
  request: IncomingMessage,
  url: URL,
  deps: CatalogueRouteDeps & {
    readonly origin: string;
    readonly sessionStore: StoreSessionStore;
  },
): Promise<Response> {
  if (request.method !== "GET") return text(405, "Only GET is supported.");

  const host = loopbackOriginOf(request);
  if (host === undefined) {
    return html(400, "This sign-in did not come back to a loopback host.");
  }

  const state = url.searchParams.get("state");
  const token = url.searchParams.get("token");
  const started = state !== null && deps.states.spend(state, host);

  if (!started || token === null || token === "") {
    return html(400, "This sign-in has expired, or was not started here.");
  }

  let exchanged: Response;
  try {
    exchanged = await deps.fetch(
      new URL("/api/auth/one-time-token/verify", deps.origin),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      },
    );
  } catch {
    return html(502, "The store could not be reached.");
  }

  if (!exchanged.ok) return html(401, "The store did not accept that sign-in.");

  const sessionToken = sessionTokenOf(exchanged);
  if (sessionToken === undefined) {
    return html(401, "The store answered no session for that sign-in.");
  }

  let answered: Response;
  try {
    answered = await deps.fetch(new URL("/api/me", deps.origin), {
      headers: { authorization: `Bearer ${sessionToken}` },
    });
  } catch {
    return html(502, "The store could not be reached.");
  }

  if (!answered.ok) return html(401, "The store did not accept that session.");

  let me: unknown;
  try {
    me = await answered.json();
  } catch {
    return html(401, "The store answered no account for that sign-in.");
  }

  if (typeof me !== "object" || me === null || Array.isArray(me)) {
    return html(401, "The store answered no account for that sign-in.");
  }

  const { userId, email } = me as Record<string, unknown>;
  if (
    typeof userId !== "string" ||
    userId === "" ||
    typeof email !== "string" ||
    email === ""
  ) {
    return html(401, "The store answered no account for that sign-in.");
  }

  await deps.sessionStore.write({
    token: sessionToken,
    userId,
    email,
    obtainedAt: new Date().toISOString(),
  });

  return html(200, "Signed in to the Yunari store. You can close this window.");
}

async function session(
  request: IncomingMessage,
  store: StoreSessionStore,
): Promise<Response> {
  if (request.method !== "GET") return text(405, "Only GET is supported.");

  const held = await store.read();
  // The exact signed-out object, and never the token or the account id: this
  // answer exists for the settings page to say signed in or not.
  return json(
    200,
    held === undefined
      ? { signedIn: false }
      : { signedIn: true, email: held.email },
  );
}

async function signOut(
  request: IncomingMessage,
  store: StoreSessionStore,
): Promise<Response> {
  if (request.method !== "POST") return text(405, "Only POST is supported.");

  // The Worker's own session is left to expire: this forgets the token this
  // host holds, which is the one a request from here would carry.
  await store.clear();
  return json(200, { ok: true });
}

export async function handleCatalogueRoutes(
  request: IncomingMessage,
  url: URL,
  deps: CatalogueRouteDeps,
): Promise<Response | undefined> {
  if (!PATHS.has(url.pathname)) return undefined;

  // The same guards, in the same order, as the GitHub sign-in routes: these
  // act as the author's store account, and pairing in particular answers only
  // this PC. A page in another origin can reach a loopback route over a
  // `text/plain` POST that needs no preflight, which is what the origin check
  // is for.
  if (!isLoopbackRemote(request.socket.remoteAddress)) {
    return text(403, "Store sign-in is local to this PC only.");
  }
  if (isForeignOrigin(request)) {
    return text(403, "That request is from another origin.");
  }

  const origin = deps.origin;
  const store = deps.sessionStore;
  if (origin === undefined || store === undefined) {
    return text(503, "This host has no store to sign in to.");
  }

  switch (url.pathname) {
    case START_PATH:
      return start(request, origin, deps.states);
    case RETURN_PATH:
      return complete(request, url, { ...deps, origin, sessionStore: store });
    case SIGN_OUT_PATH:
      return signOut(request, store);
    default:
      return session(request, store);
  }
}
