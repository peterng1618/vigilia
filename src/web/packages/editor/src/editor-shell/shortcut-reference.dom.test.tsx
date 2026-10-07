// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { shortcutReferenceGroups } from "../shortcut-manager/reference.js";
import { ShortcutReference } from "./shortcut-reference.js";

/**
 * `@radix-ui/react-focus-scope` schedules an unmount `setTimeout` that reads
 * realm globals at fire time, so under Vitest it can run after this file's jsdom
 * environment is gone and throw `parameter 1 is not of type 'Event'`
 * (`radix-ui/primitives#4148`). Draining one macrotask *before* teardown is the
 * whole fix, and this workspace has no shared setup file to put it in.
 */
afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  vi.restoreAllMocks();
});

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
    // (`shortcut-manager/index.ts:67-71`).
    expect(dialog?.textContent).not.toContain("Esc");
    await act(async () => container.unmount());
    root.remove();
  });
});
