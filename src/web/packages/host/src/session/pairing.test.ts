import { describe, expect, it } from "vitest";
import * as pairing from "./pairing.js";
import { newToken, sameToken } from "./pairing.js";

describe("display credentials", () => {
  it("mints distinct tokens and compares them without leaking length", () => {
    // 32 bytes as base64url, which is what a QR can carry and a person cannot.
    expect(newToken()).toHaveLength(43);
    expect(newToken()).not.toBe(newToken());

    expect(sameToken("a", "a")).toBe(true);
    expect(sameToken("a", "b")).toBe(false);
    // A prefix is not a match: the compare is over the whole secret.
    expect(sameToken("a", "aa")).toBe(false);
    expect(sameToken("aa", "a")).toBe(false);
  });

  it("has no TTL left to enforce", () => {
    // A pairing that expires on its own is the behaviour ruling 12 removed, so
    // neither the expiry constant nor the store that enforced it survives.
    expect(pairing).not.toHaveProperty("DEFAULT_SESSION_TTL_MS");
    expect(pairing).not.toHaveProperty("createSessionStore");
    expect(pairing).not.toHaveProperty("createSession");
  });
});
