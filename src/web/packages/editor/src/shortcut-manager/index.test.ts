import { describe, expect, it } from "vitest";
import { PRODUCT_SHORTCUTS, productShortcutIds } from "./index.js";

describe("productShortcutIds", () => {
  it("names each action once, in the table's own order", () => {
    const ids = productShortcutIds();
    // Derived from the table, so a binding added to one and not the other fails
    // here rather than silently shortening §7's sheet.
    expect(new Set(ids)).toEqual(
      new Set(PRODUCT_SHORTCUTS.map((binding) => binding.action)),
    );
    // Four actions are bound twice — `edit.redo` to Ctrl+Shift+Z and Ctrl+Y,
    // `edit.delete` to Delete and Backspace, and front/back to a bare and a
    // shifted bracket each — so a list that repeated them would make the sheet
    // say "Redo" twice. 20 distinct actions come out of the table's 24 bindings:
    // Task 3.3's `help.shortcuts` made it 19 and plan 5's Task 3 added
    // `publish.toggle`, which the header prints.
    expect(ids).toHaveLength(20);
    expect(new Set(ids).size).toBe(ids.length);
    // First and last, so the order is the table's own and not sorted by accident.
    // Task 3.3 appends `help.shortcuts`, which raised this to 19 and moved the
    // last; plan 5's Task 3 inserts `publish.toggle` ahead of it, so the last is
    // unchanged and the publish chord lands in the table's own place.
    expect(ids[0]).toBe("file.new");
    expect(ids.at(-1)).toBe("help.shortcuts");
  });

  it("keeps the context-only bindings out of the list §7 renders", () => {
    // `Escape` is dispatched by the same manager but the file's own comment
    // (`index.ts:67-68`) says it is never displayed by a menu or tooltip.
    expect(productShortcutIds()).not.toContain("view.exit-group");
  });
});
