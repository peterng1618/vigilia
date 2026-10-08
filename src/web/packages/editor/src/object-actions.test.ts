import { describe, expect, it } from "vitest";
import {
  type ActionGate,
  arrangeActions,
  OBJECT_ACTIONS,
  type ObjectTarget,
  objectAction,
  objectActionsFor,
} from "./object-actions.js";
import { productShortcutIds } from "./shortcut-manager/index.js";

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

  it("carries the whole inventory, so a dropped action fails here", () => {
    expect(OBJECT_ACTIONS.map((action) => action.id)).toEqual([
      "duplicate",
      "copy",
      "cut",
      "front",
      "bring-forward",
      "send-backward",
      "back",
      "lock",
      "unlock",
      "group",
      "ungroup",
      "delete",
    ]);
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

  it("filters to exactly the actions a gate can run, so a surface cannot re-decide", () => {
    // The gate the dock, the context menu, the pane footer and the layer panel
    // all read. A surface that filtered with its own predicate would agree
    // until the next action joined the registry, so this is the one filter.
    const none: ActionGate = {
      target: () => target({ kind: "none" }),
      canArrange: () => false,
    };
    expect(objectActionsFor(none)).toEqual([]);

    // A single unlocked object: the object actions that apply to it, in
    // registry order, and never an arrange action — those grey rather than
    // disappear, so they are `arrangeActions()`, not this.
    const one: ActionGate = { target: () => target(), canArrange: () => true };
    const ids = objectActionsFor(one).map((action) => action.id);
    expect(ids).toEqual([
      "duplicate",
      "copy",
      "cut",
      "front",
      "bring-forward",
      "send-backward",
      "back",
      "lock",
      "delete",
    ]);
    expect(ids.some((id) => id.startsWith("arrange:"))).toBe(false);
  });
});

describe("object actions and the shortcut table", () => {
  it("references chords the table actually binds", () => {
    const bound = new Set(productShortcutIds());
    for (const action of [...OBJECT_ACTIONS, ...arrangeActions()]) {
      if (action.shortcut === undefined) continue;
      // A shortcut id the table does not bind renders the empty string, so the
      // tooltip would silently say nothing. This is the assertion that stops it.
      expect(bound.has(action.shortcut)).toBe(true);
    }
  });

  it("names the eight chords the canvas offers", () => {
    const named = OBJECT_ACTIONS.filter(
      (action) => action.shortcut !== undefined,
    )
      .map((action) => action.id)
      .sort();
    // Written out rather than counted: eight today, and `arrangeActions()` is
    // deliberately absent from this list because the product binds none of them.
    expect(named).toEqual([
      "back",
      "copy",
      "cut",
      "delete",
      "duplicate",
      "front",
      "group",
      "ungroup",
    ]);
  });
});
