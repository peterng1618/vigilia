// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "./dialog.js";

afterEach(() => {
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
    // page behind has to be inert. Base UI announces that by marking every
    // element outside the popup with `aria-hidden` rather than by setting
    // `aria-modal` — `markOthers` in its vendored Floating UI carries the
    // `inert` path too and picks `aria-hidden` here — so this asserts the
    // mechanism the library actually installs, on the element this test mounted
    // outside the portal. Dropping `modal` from the root fails this line.
    expect(root.getAttribute("aria-hidden")).toBe("true");
    // The wrapper renders no `Dialog.Title`, so the name is its `aria-label`
    // rather than text content, and Base UI leaves `aria-labelledby` unset when
    // no title is registered. Removing the label fails this line.
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
