// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "./dialog.js";

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

describe("Dialog", () => {
  it("opens over the page, names itself, makes the page behind inert, and closes on Escape", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const container = createRoot(root);
    const onOpenChange = vi.fn();
    await act(async () => {
      container.render(
        <Dialog open onOpenChange={onOpenChange} label="Keyboard shortcuts">
          <p>Ctrl+Z</p>
        </Dialog>,
      );
    });

    const dialog = document.querySelector('[role="dialog"]');
    // Modal semantics are the reason this is a library rather than a div: the
    // page behind has to be inert. Radix 1.2 announces that by `aria-hidden`-ing
    // every sibling of the content rather than by setting `aria-modal` — its own
    // source calls that "the better supported equivalent to setting aria-modal"
    // — so this asserts the mechanism the library actually installs, on the
    // element this test mounted outside the portal.
    expect(root.getAttribute("aria-hidden")).toBe("true");
    // Radix renders no title here, so the name is the wrapper's `aria-label`
    // rather than text content.
    expect(dialog?.getAttribute("aria-label")).toBe("Keyboard shortcuts");

    await act(async () => {
      dialog?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await act(async () => container.unmount());
    root.remove();
  });
});
