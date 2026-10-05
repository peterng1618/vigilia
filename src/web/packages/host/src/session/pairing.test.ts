import { describe, expect, it } from "vitest";
import { createSessionStore, DEFAULT_SESSION_TTL_MS } from "./pairing.js";

function storeAt(clock: { now: number }, ttlMs?: number) {
  let counter = 0;
  return createSessionStore({
    ...(ttlMs === undefined ? {} : { ttlMs }),
    now: () => clock.now,
    randomToken: () => `token-${(counter += 1)}`,
  });
}

describe("display sessions", () => {
  it("mints a token with an expiry the caller can show", () => {
    const clock = { now: Date.parse("2026-09-24T00:00:00.000Z") };
    const session = storeAt(clock).create("phone");

    expect(session.token).toBe("token-1");
    expect(session.createdAt).toBe("2026-09-24T00:00:00.000Z");
    expect(session.expiresAt).toBe(
      new Date(clock.now + DEFAULT_SESSION_TTL_MS).toISOString(),
    );
  });

  it("verifies only tokens it issued", () => {
    const clock = { now: 0 };
    const sessions = storeAt(clock);
    const issued = sessions.create("phone");

    expect(sessions.verify(issued.token)).toBe(true);
    expect(sessions.verify("token-999")).toBe(false);
    expect(sessions.verify(undefined)).toBe(false);
    expect(sessions.verify("")).toBe(false);
  });

  it("stops accepting a token once it expires", () => {
    const clock = { now: 0 };
    const sessions = storeAt(clock, 1000);
    const issued = sessions.create("phone");

    clock.now = 999;
    expect(sessions.verify(issued.token)).toBe(true);

    clock.now = 1001;
    expect(sessions.verify(issued.token)).toBe(false);
    expect(sessions.list()).toEqual([]);
  });

  it("revokes a single session without touching the others", () => {
    const clock = { now: 0 };
    const sessions = storeAt(clock);
    const first = sessions.create("one");
    const second = sessions.create("two");

    expect(sessions.revoke(first.token)).toBe(true);
    expect(sessions.revoke(first.token)).toBe(false);
    expect(sessions.verify(first.token)).toBe(false);
    expect(sessions.verify(second.token)).toBe(true);
    expect(sessions.list().map((session) => session.label)).toEqual(["two"]);
  });

  it("never stores a label long enough to echo unbounded input", () => {
    const sessions = storeAt({ now: 0 });
    const session = sessions.create("x".repeat(500));

    expect(session.label).toHaveLength(64);
  });

  it("issues distinct tokens by default", () => {
    const sessions = createSessionStore();
    const issued = new Set(
      Array.from(
        { length: 32 },
        (_, index) => sessions.create(`d${index}`).token,
      ),
    );

    expect(issued.size).toBe(32);
    expect([...issued].every((token) => token.length >= 32)).toBe(true);
  });
});
