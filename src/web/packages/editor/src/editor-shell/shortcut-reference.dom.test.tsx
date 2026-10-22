// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resolveShortcuts,
  setActiveShortcuts,
} from "../shortcut-manager/bindings.js";
import { shortcutLabel } from "../shortcut-manager/display.js";
import {
  PRODUCT_SHORTCUTS,
  type ProductShortcutId,
  type ShortcutBinding,
} from "../shortcut-manager/index.js";
import { shortcutReferenceGroups } from "../shortcut-manager/reference.js";
import { ShortcutReference } from "./shortcut-reference.js";

afterEach(() => {
  vi.restoreAllMocks();
  // The live table is module state, so a case that rebinds puts it back.
  setActiveShortcuts(PRODUCT_SHORTCUTS);
});

/** The sheet as the shell renders it: the Dialog portals to `body`, so the
 *  sheet is found there and never inside the harness's own subtree. */
async function mountSheet(): Promise<Element> {
  const root = document.createElement("div");
  document.body.append(root);
  const container = createRoot(root);
  await act(async () => {
    container.render(<ShortcutReference open onOpenChange={() => {}} />);
  });
  const dialog = document.querySelector('[role="dialog"]');
  if (dialog === null) throw new Error("no sheet.");
  return dialog;
}

/** One row of the sheet, by the action it names. */
function sheetRow(dialog: Element, action: ProductShortcutId): Element {
  const row = dialog.querySelector(
    `[data-yunari-reference-row="${action}"] kbd`,
  );
  if (row === null) throw new Error(`no sheet row for ${action}.`);
  return row;
}

describe("ShortcutReference", () => {
  it("prints every row of the projection, with the sheet's own name", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const container = createRoot(root);
    await act(async () => {
      container.render(<ShortcutReference open onOpenChange={() => {}} />);
    });

    const dialog = document.querySelector('[role="dialog"]');
    // Derived from the projection: a row added to it must arrive on screen, and
    // a row the sheet forgot to render fails here rather than in a screenshot.
    const rows = shortcutReferenceGroups().flatMap((group) => group.rows);
    expect(dialog?.querySelectorAll("kbd")).toHaveLength(rows.length);
    for (const group of shortcutReferenceGroups())
      expect(dialog?.textContent).toContain(group.label);
    // `Escape` is dispatched by the manager and deliberately never listed
    // (`shortcut-manager/index.ts`).
    expect(dialog?.textContent).not.toContain("Esc");
    await act(async () => container.unmount());
    root.remove();
  });

  it("prints the effective chord after a rebind, not the default", async () => {
    // Review Focus 3 on this surface: the sheet is one of the four things that
    // print a chord, and a sheet that kept the default would show a mark that
    // runs a different action than the one beside it.
    const moved: ShortcutBinding = {
      key: "j",
      modifier: true,
      shift: false,
      action: "publish.surface",
    };
    setActiveShortcuts(resolveShortcuts({ "publish.surface": moved }));
    const dialog = await mountSheet();

    expect(sheetRow(dialog, "publish.surface").textContent).toBe(
      shortcutLabel("publish.surface"),
    );
    expect(sheetRow(dialog, "publish.surface").textContent).toBe("Ctrl+J");
    // Untouched rows keep the table's own chord, so a rebind is one row's.
    expect(sheetRow(dialog, "edit.undo").getAttribute("aria-label")).toBe(
      "Control Z",
    );
  });
});
