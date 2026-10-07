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
    // say "Redo" twice. 18 distinct actions come out of the table's 22 bindings.
    expect(ids).toHaveLength(18);
    expect(new Set(ids).size).toBe(ids.length);
    // First and last, so the order is the table's own and not sorted by accident.
    // Task 3.3 appends `help.shortcuts`, which raises this to 19 and moves the last.
    expect(ids[0]).toBe("file.new");
    expect(ids.at(-1)).toBe("canvas.nudge-down");
  });

  it("keeps the context-only bindings out of the list §7 renders", () => {
    // `Escape` is dispatched by the same manager but the file's own comment
    // (`index.ts:67-68`) says it is never displayed by a menu or tooltip.
    expect(productShortcutIds()).not.toContain("view.exit-group");
  });
});
