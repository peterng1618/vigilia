import { describe, expect, it } from "vitest";
import { type WidgetIssue, createWidgetIdAllocator } from "./widget.js";

/**
 * The id rule an inserted unit takes with it.
 *
 * Exercised through real callers too — the card library and the clipboard both
 * mint ids with it, and their tests read the ids that come out — but the
 * bounds this function states are its own: what it does with a name past the
 * pattern's length, and with a destination that already holds the id it would
 * have minted.
 */

const MAX_ID_LENGTH = 64;

function allocate(
  prefix: string,
  existingIds: string[] = [],
): { next: (original: string) => string; issues: WidgetIssue[] } {
  const issues: WidgetIssue[] = [];

  return {
    next: createWidgetIdAllocator(prefix, existingIds, issues),
    issues,
  };
}

describe("fresh ids", () => {
  it("prefixes the original id so a copy is readable rather than opaque", () => {
    const { next } = allocate("w1");

    expect(next("card")).toBe("w1-card");
    expect(next("card-value")).toBe("w1-card-value");
  });

  it("sanitises a prefix that is not a valid stable id", () => {
    const { next } = allocate("my widget!");

    expect(next("card")).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
  });

  it("truncates a long id and still keeps it unique", () => {
    // Truncation to 64 characters is exactly what lets two distinct source ids
    // collide, so the numeric suffix is not theoretical.
    const { next } = allocate("prefix");
    const long = "x".repeat(60);

    const first = next(`${long}a`);
    const second = next(`${long}b`);

    expect(first.length).toBeLessThanOrEqual(MAX_ID_LENGTH);
    expect(second.length).toBeLessThanOrEqual(MAX_ID_LENGTH);
    expect(first).not.toBe(second);
  });

  it("avoids ids already used in the destination", () => {
    const { next } = allocate("w1", ["w1-card", "w1-card-2"]);

    expect(next("card")).toBe("w1-card-3");
  });

  it("returns one id for one original, however often it is asked", () => {
    // Memoising **by original** is what keeps a group and its binding, or two
    // references to one part, from drifting to different ids.
    const { next } = allocate("w1");

    const first = next("card");

    expect(next("card")).toBe(first);
    expect(next("other")).not.toBe(first);
  });

  it("keeps every id distinct within one destination", () => {
    const { next } = allocate("w1");
    const ids = new Set<string>();

    for (const original of ["a", "b", "a", "c", "b"]) {
      ids.add(next(original));
    }

    expect(next("a")).toBe(next("a"));
    expect(ids.size).toBe(3);
  });
});
