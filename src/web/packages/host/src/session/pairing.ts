import { randomBytes, timingSafeEqual } from "node:crypto";

/** LAN display sessions (§145). Loopback stays trusted admin; a non-loopback
 * display needs a short-lived token a person minted from this PC. */

export interface DisplaySession {
  readonly token: string;
  readonly label: string;
  readonly createdAt: string;
  readonly expiresAt: string;
}

export interface SessionStoreOptions {
  /** Sessions are short-lived: a leaked token must stop working on its own. */
  readonly ttlMs?: number;
  readonly now?: () => number;
  readonly randomToken?: () => string;
}

export interface SessionStore {
  /** Mints a session. Only reachable from loopback (see `server.ts`). */
  create(label: string): DisplaySession;
  /** True for a live, unexpired token. Constant-time against the stored value. */
  verify(token: string | undefined): boolean;
  revoke(token: string): boolean;
  list(): readonly DisplaySession[];
  /** Drops expired sessions; called on each verification pass. */
  sweep(): void;
}

export const DEFAULT_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** 32 bytes of CSPRNG output, URL-safe. */
function defaultToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Compares without leaking length-independent timing; both sides are padded by
 * hashing to a fixed width first. */
function sameToken(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function createSessionStore(
  options: SessionStoreOptions = {},
): SessionStore {
  const ttlMs = options.ttlMs ?? DEFAULT_SESSION_TTL_MS;
  const now = options.now ?? (() => Date.now());
  const makeToken = options.randomToken ?? defaultToken;
  const sessions = new Map<string, DisplaySession>();

  const sweep = (): void => {
    const at = now();

    for (const [token, session] of sessions) {
      if (Date.parse(session.expiresAt) <= at) {
        sessions.delete(token);
      }
    }
  };

  return {
    create(label) {
      sweep();
      const issuedAt = now();
      const session: DisplaySession = {
        token: makeToken(),
        label: label.slice(0, 64),
        createdAt: new Date(issuedAt).toISOString(),
        expiresAt: new Date(issuedAt + ttlMs).toISOString(),
      };
      sessions.set(session.token, session);
      return session;
    },

    verify(token) {
      if (token === undefined || token.length === 0) {
        return false;
      }

      sweep();

      for (const stored of sessions.keys()) {
        if (sameToken(stored, token)) {
          return true;
        }
      }

      return false;
    },

    revoke(token) {
      sweep();

      for (const stored of sessions.keys()) {
        if (sameToken(stored, token)) {
          sessions.delete(stored);
          return true;
        }
      }

      return false;
    },

    list() {
      sweep();
      return [...sessions.values()];
    },

    sweep,
  };
}
