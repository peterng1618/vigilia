import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createWidgetIdAllocator, type WidgetIssue } from "./widget.js";

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

/**
 * `WidgetIssue["invalid-id"]` was unreachable, and is gone.
 *
 * `sanitizeId` is total: every character outside `[A-Za-z0-9_-]` becomes `-`,
 * so any non-empty input is already a `STABLE_ID_PATTERN` match — and the
 * allocator only ever hands it `${prefix}-${original}`, which carries the `-`
 * and so is never empty. There is no id it can fail to derive.
 *
 * This is not `id-collision`, which was unreachable from `card-library.ts` and
 * was *made* reachable, because the outcome it guarded was real: two parts at
 * one id, a save that then fails for the rest of the session, reported nowhere.
 * No outcome stands behind `invalid-id` — an unusable id cannot occur — so the
 * member and its branch were deleted together rather than re-attached.
 */
describe("an id the allocator cannot derive", () => {
  it("has no input to report: a stable id is minted from any prefix and original", () => {
    // The only inputs that could ever leave `sanitizeId` without a usable
    // character: nothing at all, and nothing it does not have to replace.
    for (const [prefix, original] of [
      ["", ""],
      ["", "  "],
      ["my widget!", ""],
      ["!!!", "???"],
      ["w1", "\u0000"],
    ] as const) {
      const { next, issues } = allocate(prefix);

      expect(next(original)).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
      expect(issues).toEqual([]);
    }
  });

  it("is not a member and has no branch to reach, read off `widget.ts`", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./widget.ts", import.meta.url)),
      "utf8",
    );

    // Both places the code lived — the union member and the branch that pushed
    // it. Restoring either reddens this, which a behavioural case cannot: the
    // branch never fired, so a revert is invisible at runtime.
    expect(source).not.toContain("invalid-id");
  });
});
