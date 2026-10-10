// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShortcutManager } from "../shortcut-manager/index.js";
import { uiCopy } from "../ui-copy.js";
import { RAIL_SLOTS, Rail, type RailSlot } from "./rail.js";
import { Settings } from "./settings.js";

/** The gear, by the class only it carries: it is the rail's one non-slot. */
function gear(host: HTMLElement): HTMLButtonElement {
  const found = host.querySelector<HTMLButtonElement>(
    ".editor-shell-rail-settings",
  );
  if (found === null) throw new Error("No settings gear.");
  return found;
}

/** The role anywhere in the document, because the dialog is portalled to
 *  `body` rather than rendered inside the harness's own subtree. */
function role(name: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[role="${name}"]`);
}

/** The three tab words, in the strip's order, as an author reads them. */
function tabLabels(): readonly string[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="tab"]')).map(
    (tab) => tab.textContent?.trim() ?? "",
  );
}

/** The rail's slots, by the attribute that marks a slot — the gear is a button
 *  on the rail too and carries none. */
function railSlotIds(host: HTMLElement): readonly (string | null)[] {
  return Array.from(
    host.querySelectorAll<HTMLElement>(".editor-shell-rail [data-rail-slot]"),
  ).map((slot) => slot.getAttribute("data-rail-slot"));
}

/** The labelled close Base UI's modal contract requires inside the popup. */
function closeControl(): HTMLElement {
  const found = document.querySelector<HTMLElement>(
    ".editor-shell-dialog-close",
  );
  if (found === null) throw new Error("No close control.");
  return found;
}

let root: Root | undefined;
let host: HTMLDivElement | undefined;

/** The shell's settings route in miniature: the rail's gear sets the state the
 *  modal reads, exactly as `Shell` holds `settingsOpen`. */
function Harness(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<RailSlot>("composition");
  return (
    <>
      <Rail
        slot={slot}
        collapsed={false}
        onChoose={setSlot}
        onOpenSettings={() => setOpen(true)}
      />
      <Settings open={open} onOpenChange={setOpen} storage={undefined} />
    </>
  );
}

function mount(): HTMLElement {
  const mount = document.createElement("div");
  document.body.append(mount);
  const reactRoot = createRoot(mount);
  root = reactRoot;
  host = mount;
  act(() => reactRoot.render(<Harness />));
  return mount;
}

async function press(target: HTMLElement): Promise<void> {
  await act(async () => {
    target.click();
  });
}

async function pressEscape(): Promise<void> {
  await act(async () => {
    role("dialog")?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  });
}

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  host?.remove();
  host = undefined;
  document.body.replaceChildren();
});

describe("Settings", () => {
  it("opens the settings modal from the gear, and offers exactly the three tabs the spec names", async () => {
    const host = mount();
    await press(gear(host));

    expect(role("dialog")).not.toBeNull();
    expect(tabLabels()).toEqual([
      uiCopy.settings.appearance,
      uiCopy.settings.keyboard,
      uiCopy.settings.about,
    ]);
    // A pane, or a fifth rail slot, fails here and only here: the rail still
    // holds the four the bible names, and the gear is not one of them.
    expect(railSlotIds(host)).toEqual([...RAIL_SLOTS]);
  });

  it("returns focus to the gear when it closes, and Escape is one press with one effect", async () => {
    const host = mount();
    await press(gear(host));

    await pressEscape();

    expect(role("dialog")).toBeNull();
    expect(document.activeElement).toBe(gear(host));
  });

  it("renders a labelled close control a touch screen reader can reach", async () => {
    // Base UI's own contract: a modal dialog renders `Dialog.Close` inside the
    // popup so a touch screen reader — which has no Escape key — can leave it.
    const host = mount();
    await press(gear(host));
    expect(closeControl().getAttribute("aria-label")?.trim()).not.toBe("");
  });

  it("keeps the document behind it silent to the editor's own chords", async () => {
    // Review Focus 5. The guard samples `[role='dialog']` at the start of the
    // dispatch, so while the modal is open the window-level manager must not
    // run `Ctrl+Z` or `Delete` against the document underneath.
    const manager = new ShortcutManager();
    const undo = vi.fn();
    const remove = vi.fn();
    manager.register("edit.undo", undo);
    manager.register("edit.delete", remove);

    const host = mount();
    await press(gear(host));
    expect(
      role("dialog"),
      "the modal is what makes the guard fire",
    ).not.toBeNull();

    await act(async () => {
      for (const event of [
        new KeyboardEvent("keydown", {
          key: "z",
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
        new KeyboardEvent("keydown", {
          key: "Delete",
          bubbles: true,
          cancelable: true,
        }),
      ]) {
        document.body.dispatchEvent(event);
      }
    });
    expect(undo).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();

    // And the guard is the reason, not a chord that never matched: with the
    // modal shut, the same two presses reach the document.
    await pressEscape();
    await act(async () => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "z",
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Delete",
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(undo).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);

    manager.destroy();
  });
});
