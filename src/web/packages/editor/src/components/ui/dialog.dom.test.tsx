// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "./dialog.js";

const shellCss = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "editor-shell",
    "editor-shell.css",
  ),
  "utf8",
).replace(/^\s*@import[^;]*;\s*$/gm, "");

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

  it("lets a caller add a size class, and the finder's class insets to the chrome", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const container = createRoot(root);
    await act(async () => {
      container.render(
        <Dialog
          open
          onOpenChange={() => {}}
          label="Asset finder"
          className="editor-shell-dialog--finder"
        >
          <p>grid</p>
        </Dialog>,
      );
    });

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.classList.contains("editor-shell-dialog")).toBe(true);
    expect(dialog?.classList.contains("editor-shell-dialog--finder")).toBe(
      true,
    );

    const block = /\.editor-shell-dialog--finder\s*\{([^}]*)\}/.exec(
      shellCss,
    )?.[1];
    // The finder takes the editor's working area, stopping short of the header,
    // the rail and the status bar so the shell's own chrome stays in view.
    expect(block).toContain("top: calc(var(--header-height) + var(--space-8))");
    expect(block).toContain("left: calc(46px + var(--space-8))");
    expect(block).toContain("bottom: calc(26px + var(--space-8))");
    expect(block).toContain("width: auto");
    expect(block).toContain("transform: none");
    // The popup itself does not scroll: its bounded body does, so the page
    // behind never moves while the grid pages.
    expect(block).toContain("overflow: hidden");

    await act(async () => container.unmount());
    root.remove();
  });
});
