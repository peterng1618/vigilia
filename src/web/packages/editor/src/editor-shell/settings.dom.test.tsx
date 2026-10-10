// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShortcutManager } from "../shortcut-manager/index.js";
import { uiCopy } from "../ui-copy.js";
import {
  DEFAULT_SHELL_PALETTE,
  prefersDarkAppearance,
  readShellChoice,
  resolveShellPalette,
  type ShellPalette,
  shellPalettes,
} from "./palette.js";
import { RAIL_SLOTS, Rail, type RailSlot } from "./rail.js";
import { Settings } from "./settings.js";

// jsdom has never had a `PointerEvent`, and Base UI re-dispatches a click
// through one to carry modifier state — the shim `control.dom.test.tsx` supplies
// for the same reason.
window.PointerEvent ??= MouseEvent as never;

// React only flushes work scheduled inside `act` when it has been told it is in
// a test; without this, `act` warns and the update lands after the assertion.
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

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

/** One palette row of the Appearance tab, by the hook the control carries
 *  rather than by its text: the name and the value are the same word, so a
 *  selector on the text would pass for a row that had lost its hook. */
function paletteChoice(palette: ShellPalette): HTMLButtonElement {
  const found = document.querySelector<HTMLButtonElement>(
    `[data-vigilia-palette-choice="${palette}"]`,
  );
  if (found === null) throw new Error(`no "${palette}" choice in the tab.`);
  return found;
}

/** The Appearance tab's group, which is what the six rows are radios in. */
function paletteGroup(): HTMLElement {
  const found = document.querySelector<HTMLElement>('[role="radiogroup"]');
  if (found === null) throw new Error("No palette radiogroup.");
  return found;
}

/** Follow-the-system, the toggle beneath the six. */
function followToggle(): HTMLButtonElement {
  const found = document.querySelector<HTMLButtonElement>(
    "[data-vigilia-follow-system]",
  );
  if (found === null) throw new Error("No follow-the-system toggle.");
  return found;
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
 *  modal reads, exactly as `Shell` holds `settingsOpen`, and the palette state
 *  the shell holds is held here. Nothing else is mirrored — the tab writes
 *  storage and the attribute itself, so what these cases exercise is the
 *  component and not a copy of it. */
function Harness(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<RailSlot>("composition");
  const [palette, setPalette] = useState<ShellPalette>(DEFAULT_SHELL_PALETTE);
  const [following, setFollowing] = useState(true);
  return (
    <>
      <Rail
        slot={slot}
        collapsed={false}
        onChoose={setSlot}
        onOpenSettings={() => setOpen(true)}
      />
      <Settings
        open={open}
        onOpenChange={setOpen}
        storage={localStorage}
        palette={palette}
        following={following}
        onPalette={setPalette}
        onFollowing={setFollowing}
      />
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

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-shell-palette");
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  host?.remove();
  host = undefined;
  document.body.replaceChildren();
  document.documentElement.removeAttribute("data-shell-palette");
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

  it("offers the six palettes as named radios in one labelled group", async () => {
    const host = mount();
    await press(gear(host));

    const radios = Array.from(
      paletteGroup().querySelectorAll<HTMLElement>('[role="radio"]'),
    );
    // Read from `shellPalettes` rather than restated: `palette.ts` is the owner,
    // and a list typed here is a second one that can fall behind it.
    expect(radios.map((radio) => radio.getAttribute("aria-label"))).toEqual([
      ...shellPalettes,
    ]);
    // And the chosen one says so in a way no colour carries: `aria-checked` is
    // the selected state, so a reader who cannot see the lift still has it.
    expect(
      radios.map((radio) => radio.getAttribute("aria-checked")),
      "the default palette is the one marked checked",
    ).toEqual(
      shellPalettes.map((entry) => `${entry === DEFAULT_SHELL_PALETTE}`),
    );
    expect(paletteGroup().getAttribute("aria-labelledby")).not.toBeNull();
    expect(
      document.getElementById(
        paletteGroup().getAttribute("aria-labelledby") ?? "",
      )?.textContent,
    ).toBe(uiCopy.settings.palette);
  });

  it("applies the palette where the chip applied it — the attribute, and the storage", async () => {
    // The defect `0035` exists to prevent is a palette applied to React state
    // alone, which leaves every portalled popup painting the old one.
    // A palette other than the one already in force: picking the current value
    // is a no-op the primitive does not report, so it could not fail.
    const chosen: ShellPalette = "moss";
    const host = mount();
    await press(gear(host));
    await press(paletteChoice(chosen));

    expect(localStorage.getItem("vigilia.editor.shell-palette")).toBe(chosen);
    expect(document.documentElement.getAttribute("data-shell-palette")).toBe(
      chosen,
    );
    // The written key is the whole of what a choice touches here: a palette
    // colours the editor and never the authored theme, and not one other store
    // entry appears beside it.
    expect(localStorage.length, "a second store entry is a second owner").toBe(
      1,
    );
    expect(localStorage.key(0)).toBe("vigilia.editor.shell-palette");
    // And the toggle it turned off says so.
    expect(followToggle().getAttribute("aria-checked")).toBe("false");
  });

  it("returns to following the OS when follow-the-system is turned back on", async () => {
    const host = mount();
    await press(gear(host));
    await press(paletteChoice("moss"));
    await press(followToggle());

    expect(
      readShellChoice(localStorage),
      "removing the key is what means no choice",
    ).toBeUndefined();
    expect(document.documentElement.getAttribute("data-shell-palette")).toBe(
      resolveShellPalette(undefined, prefersDarkAppearance()),
    );
    expect(followToggle().getAttribute("aria-checked")).toBe("true");
  });
});
