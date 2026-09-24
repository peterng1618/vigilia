import { describe, expect, it } from "vitest";
import {
  OBJECT_ACTIONS,
  type ObjectTarget,
  objectAction,
} from "./object-actions.js";

function target(overrides: Partial<ObjectTarget> = {}): ObjectTarget {
  return {
    kind: "object",
    locked: false,
    memberCount: 1,
    isGroup: false,
    ...overrides,
  };
}

describe("object action registry", () => {
  it("answers eligibility from the projection alone", () => {
    const deleteAction = objectAction("delete");
    expect(deleteAction.eligible(target())).toBe(true);
    expect(deleteAction.eligible(target({ kind: "none" }))).toBe(false);
    expect(deleteAction.eligible(target({ locked: true }))).toBe(false);
  });

  it("reports every action exactly once", () => {
    const ids = OBJECT_ACTIONS.map((action) => action.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("offers group only for a real multi-selection", () => {
    expect(
      objectAction("group").eligible(target({ kind: "group", memberCount: 1 })),
    ).toBe(false);
    expect(
      objectAction("group").eligible(target({ kind: "group", memberCount: 2 })),
    ).toBe(true);
  });

  it("refuses arrange for a locked multi-selection, as canArrange does", () => {
    const align = objectAction("arrange:align-left");
    expect(align.eligible(target({ memberCount: 2 }))).toBe(true);
    expect(align.eligible(target({ memberCount: 2, locked: true }))).toBe(
      false,
    );
  });
});
