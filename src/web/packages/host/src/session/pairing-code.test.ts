import { describe, expect, it } from "vitest";
import {
  createPairingCodeStore,
  PAIRING_CODE_ALPHABET,
  PAIRING_CODE_LENGTH,
} from "./pairing-code.js";

/** A store whose penalty costs no wall-clock time: the delay is asserted
 *  through the wait it asks for, and waiting it out would only be slower. */
function fast(
  waited: number[] = [],
): ReturnType<typeof createPairingCodeStore> {
  return createPairingCodeStore({
    wait: async (ms) => {
      waited.push(ms);
    },
  });
}

describe("the one-time pairing code", () => {
  it("draws only from the alphabet a person can read back", () => {
    const store = fast();

    // 2000 draws, because a bias or a stray glyph is a property of the
    // generator and not of one call — the same reason a lock is fuzzed.
    for (let draw = 0; draw < 2000; draw += 1) {
      const { code } = store.mint();

      expect(code).toHaveLength(PAIRING_CODE_LENGTH);
      // The five glyphs a reader confuses with another one: I/1, L/1, O/0.
      expect(code).not.toMatch(/[ILO01]/);
      for (const glyph of code) expect(PAIRING_CODE_ALPHABET).toContain(glyph);
    }
  });

  it("consumes on a match and never on a mismatch", async () => {
    const store = fast();
    const { code } = store.mint();

    expect(await store.claim("ZZZZZZ", "192.168.1.5")).toBe(false);
    // The window is still open: one live code has nothing a wrong guess could
    // have named, so a guesser cannot close what a person is typing into.
    expect(store.current()?.code).toBe(code);
    expect(await store.claim(code, "192.168.1.5")).toBe(true);
    expect(store.current()).toBeUndefined();
  });

  it("expires", async () => {
    let clock = Date.parse("2026-10-18T10:00:00.000Z");
    const store = createPairingCodeStore({
      now: () => clock,
      ttlMs: 1000,
      wait: async () => {},
    });
    const { code, expiresAt } = store.mint();
    expect(expiresAt).toBe("2026-10-18T10:00:01.000Z");
    expect(store.current()?.code).toBe(code);

    clock += 1000;

    // Expired is not a second state a caller can see: it reads as no code, and
    // the right characters are refused exactly as wrong ones are.
    expect(store.current()).toBeUndefined();
    expect(await store.claim(code, "192.168.1.5")).toBe(false);
  });

  it("answers a source that keeps missing with a growing delay, never a lockout", async () => {
    const waited: number[] = [];
    const store = fast(waited);
    const { code } = store.mint();

    for (let guess = 0; guess < 5; guess += 1) {
      expect(await store.claim("ZZZZZZ", "10.0.0.9")).toBe(false);
    }

    // The first miss is free and each one after it doubles, capped so a refused
    // request holds its socket for a bounded time.
    expect(waited).toEqual([250, 500, 1000, 2000]);

    // And the right code still succeeds, which is the whole difference between
    // a penalty and a lockout.
    expect(await store.claim(code, "10.0.0.9")).toBe(true);
  });

  it("counts a rung per guess even when the guesses are in flight together", async () => {
    const waited: number[] = [];
    const store = fast(waited);
    const { code } = store.mint();

    // One source, five claims issued without awaiting any of them. The rung is
    // reserved before the wait, so each claim takes the next one; a count read
    // on the far side of the await would have all five read the same number and
    // settle on the free rung for ever — N guesses at every rung for an
    // attacker firing N at a time.
    const missed = await Promise.all(
      Array.from({ length: 5 }, () => store.claim("ZZZZZZ", "10.0.0.9")),
    );
    expect(missed).toEqual([false, false, false, false, false]);
    expect(waited).toEqual([250, 500, 1000, 2000]);

    // And the ladder kept what those five spent: the sixth claim — the right
    // code — is the sixth guess, not the second.
    expect(await store.claim(code, "10.0.0.9")).toBe(true);
    expect(waited).toEqual([250, 500, 1000, 2000, 4000]);
  });

  it("counts misses per source, so one guesser never delays another", async () => {
    const waited: number[] = [];
    const store = fast(waited);
    const { code } = store.mint();

    await store.claim("ZZZZZZ", "10.0.0.9");
    await store.claim("ZZZZZZ", "10.0.0.9");
    expect(waited).toEqual([250]);

    expect(await store.claim(code, "10.0.0.8")).toBe(true);
    expect(waited).toEqual([250]);
  });

  it("forgets the penalty when a new code replaces the window", async () => {
    const waited: number[] = [];
    const store = fast(waited);
    store.mint();
    await store.claim("ZZZZZZ", "10.0.0.9");

    store.mint();

    // A closed window's misses defend nothing, and carrying them over would
    // charge a source for a code it can no longer guess.
    await store.claim("ZZZZZZ", "10.0.0.9");
    expect(waited).toEqual([]);
  });
});
