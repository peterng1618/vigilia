// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readShortcutOverrides,
  resolveShortcuts,
  type ShortcutOverrides,
  setActiveShortcuts,
} from "../shortcut-manager/bindings.js";
import { shortcutLabel } from "../shortcut-manager/display.js";
import {
  PRODUCT_SHORTCUTS,
  type ProductShortcutId,
  productShortcutIds,
  ShortcutManager,
} from "../shortcut-manager/index.js";
import { SHORTCUT_LABELS } from "../shortcut-manager/reference.js";
import { uiCopy } from "../ui-copy.js";
import { SettingsKeyboard } from "./settings-keyboard.js";

// React only flushes work scheduled inside `act` when it has been told it is in
// a test; without this, `act` warns and the update lands after the assertion.
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const STORAGE_KEY = "vigilia.editor.shortcut-overrides";

/** One row of the tab, by the action it edits rather than by its words. */
function row(host: HTMLElement, action: ProductShortcutId): HTMLElement {
  const found = host.querySelector<HTMLElement>(
    `[data-vigilia-shortcut-row="${action}"]`,
  );
  if (found === null) throw new Error(`no row for ${action}.`);
  return found;
}

/** The chord a row prints. */
function printed(host: HTMLElement, action: ProductShortcutId): string {
  return row(host, action).querySelector("kbd")?.textContent?.trim() ?? "";
}

function armControl(
  host: HTMLElement,
  action: ProductShortcutId,
): HTMLButtonElement {
  const found = host.querySelector<HTMLButtonElement>(
    `[data-vigilia-shortcut-arm="${action}"]`,
  );
  if (found === null) throw new Error(`no arm control for ${action}.`);
  return found;
}

/** Whether any row is listening for a chord. */
function armed(host: HTMLElement): boolean {
  return host.querySelector("[data-armed]") !== null;
}

function reason(host: HTMLElement): string {
  return (
    host.querySelector("[data-vigilia-shortcut-reason]")?.textContent?.trim() ??
    ""
  );
}

function resetAll(host: HTMLElement): HTMLButtonElement {
  const found = host.querySelector<HTMLButtonElement>(
    "[data-vigilia-shortcut-reset-all]",
  );
  if (found === null) throw new Error("no Reset all control.");
  return found;
}

function perRowReset(
  host: HTMLElement,
  action: ProductShortcutId,
): HTMLButtonElement {
  const found = host.querySelector<HTMLButtonElement>(
    `[data-vigilia-shortcut-reset="${action}"]`,
  );
  if (found === null) throw new Error(`no Reset for ${action}.`);
  return found;
}

let root: Root | undefined;
let host: HTMLElement | undefined;
let manager: ShortcutManager | undefined;

/** The shell's settings route in miniature: the overrides state and the live
 *  table are held here exactly as `createShellLayout` holds them, so what these
 *  cases exercise is the tab and the owner it writes through. */
function Harness({
  storage,
}: {
  readonly storage: Storage | undefined;
}): React.JSX.Element {
  const [overrides, setOverrides] = useState<ShortcutOverrides>(() =>
    storage === undefined ? {} : readShortcutOverrides(storage),
  );
  const [armed, setArmed] = useState<ProductShortcutId | undefined>(undefined);
  const apply = (next: ShortcutOverrides): void => {
    setOverrides(next);
    setActiveShortcuts(resolveShortcuts(next));
  };
  return (
    <SettingsKeyboard
      storage={storage}
      overrides={overrides}
      armed={armed}
      onArmed={setArmed}
      onOverrides={apply}
    />
  );
}

function mount(storage: Storage | undefined): HTMLElement {
  const mounting = document.createElement("div");
  document.body.append(mounting);
  const reactRoot = createRoot(mounting);
  root = reactRoot;
  host = mounting;
  act(() => reactRoot.render(<Harness storage={storage} />));
  return mounting;
}

async function click(target: HTMLElement): Promise<void> {
  await act(async () => {
    target.click();
  });
}

/** A chord pressed **on a row**, as a focused element receives it: it bubbles,
 *  which is what lets it reach the manager's window listener unless the capture
 *  stops it. */
async function press(
  target: Element,
  init: KeyboardEventInit,
): Promise<KeyboardEvent> {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  await act(async () => {
    target.dispatchEvent(event);
  });
  return event;
}

/** The chord `publish.toggle` is being moved to: free in the table, and one
 *  this browser does not keep. */
const NEW_CHORD: KeyboardEventInit = { key: "j", ctrlKey: true };
/** `file.save`'s chord, so a capture that took it would make one of the two
 *  actions stop working. */
const TAKEN_CHORD: KeyboardEventInit = { key: "s", ctrlKey: true };

beforeEach(() => {
  localStorage.clear();
  // A real manager, because the deferral and the modal guard are its own: what
  // these cases prove is that a press being recorded never reaches it.
  manager = new ShortcutManager();
});

afterEach(() => {
  manager?.destroy();
  manager = undefined;
  act(() => root?.unmount());
  root = undefined;
  host?.remove();
  host = undefined;
  document.body.replaceChildren();
  setActiveShortcuts(PRODUCT_SHORTCUTS);
});

describe("the Keyboard tab", () => {
  it("lists every action the table binds, once, with its chord and an arm control", () => {
    const mounting = mount(localStorage);
    const rows = mounting.querySelectorAll("[data-vigilia-shortcut-row]");
    // Derived from the table rather than restated: an action added to
    // `PRODUCT_SHORTCUTS` must arrive here, and the sheet's row count is a
    // property of the projection.
    expect(rows).toHaveLength(productShortcutIds().length);
    expect(printed(mounting, "publish.toggle")).not.toBe("");
    expect(armControl(mounting, "edit.undo").getAttribute("aria-label")).toBe(
      uiCopy.settings.keyboardRebind,
    );
  });

  it("captures a chord for the row it was armed on, and stores it under one key", async () => {
    const mounting = mount(localStorage);
    await click(armControl(mounting, "publish.toggle"));
    expect(armed(mounting)).toBe(true);
    expect(printed(mounting, "publish.toggle")).toBe(
      uiCopy.settings.keyboardPrompt,
    );

    await press(row(mounting, "publish.toggle"), NEW_CHORD);

    expect(armed(mounting)).toBe(false);
    expect(printed(mounting, "publish.toggle")).toBe("Ctrl+J");
    // The write is the palette's shape: one namespaced key, and nothing else.
    expect(localStorage.length, "a second store entry is a second owner").toBe(
      1,
    );
    expect(localStorage.key(0)).toBe(STORAGE_KEY);
    expect(readShortcutOverrides(localStorage)).toEqual({
      "publish.toggle": {
        key: "j",
        modifier: true,
        shift: false,
        action: "publish.toggle",
      },
    });
    // And the dispatcher follows the same table, so the mark that is printed is
    // the mark that runs. A rebind that reached one and not the other is the
    // whole of Review Focus 3.
    const ran = vi.fn();
    manager?.register("publish.toggle", ran);
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", NEW_CHORD));
    });
    expect(ran).toHaveBeenCalledOnce();
  });

  it("refuses a chord another action holds, in words, and binds nothing", async () => {
    const save = vi.fn();
    manager?.register("file.save", save);
    const mounting = mount(localStorage);
    await click(armControl(mounting, "publish.toggle"));

    await press(row(mounting, "publish.toggle"), TAKEN_CHORD);

    expect(readShortcutOverrides(localStorage)).not.toHaveProperty(
      "publish.toggle",
    );
    // §9: the refusal states its reason, and names the action it belongs to.
    expect(reason(mounting), "the refusal is in words").not.toBe("");
    expect(reason(mounting)).toContain(SHORTCUT_LABELS["file.save"]);
    // §5.3: the row is still there, carrying its old chord rather than gone,
    // and it is still the row the next press will be recorded into.
    expect(armed(mounting)).toBe(true);
    // **The capture's press and nothing else's.** Without this the manager
    // would also run Save for the chord being recorded — a rebind that fires
    // the very action it was recording for. Removing the capture's
    // `stopPropagation` reddens this line and nothing else in the file.
    expect(save).not.toHaveBeenCalled();

    // And the same press does reach the manager once the capture is over, so
    // the assertion above is about the capture and not about a chord that could
    // never match.
    await press(row(mounting, "publish.toggle"), { key: "Escape" });
    expect(printed(mounting, "publish.toggle")).toBe(
      shortcutLabel("publish.toggle"),
    );
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", TAKEN_CHORD));
    });
    expect(save).toHaveBeenCalledOnce();
  });

  it("Escape cancels the capture and binds nothing, and the key travels on", async () => {
    const mounting = mount(localStorage);
    await click(armControl(mounting, "publish.toggle"));

    const escape = await press(row(mounting, "publish.toggle"), {
      key: "Escape",
    });

    expect(armed(mounting)).toBe(false);
    expect(readShortcutOverrides(localStorage)).not.toHaveProperty(
      "publish.toggle",
    );
    expect(reason(mounting)).toBe("");
    // Not consumed: Escape is the modal's own dismissal, and an armed row that
    // swallowed it would be the one state the author could not leave.
    expect(escape.defaultPrevented, "Escape is not consumed").toBe(false);
  });

  it("lets Tab move focus on rather than refusing it", async () => {
    // An armed row that ate Tab would trap the keyboard: focus could only leave
    // by arming another row, and the control that does that is reachable only by
    // Tab. The refusal is for keys that genuinely cannot be a chord.
    const mounting = mount(localStorage);
    await click(armControl(mounting, "publish.toggle"));

    const tab = await press(row(mounting, "publish.toggle"), { key: "Tab" });

    expect(tab.defaultPrevented, "Tab is not consumed").toBe(false);
    expect(armed(mounting)).toBe(false);
    expect(reason(mounting)).toBe("");
    expect(readShortcutOverrides(localStorage)).toEqual({});
  });

  it("refuses an Alt-qualified press in words, and binds nothing", async () => {
    // The chord the author pressed must be the chord that is stored, and
    // `ShortcutBinding` has no `alt`: without the refusal, Alt+H is stored as
    // the bare `h` — accepted, because the action defers to a text field — and
    // it replaces the `?` alias, so `?` stops opening the sheet.
    const mounting = mount(localStorage);
    await click(armControl(mounting, "help.shortcuts"));

    await press(row(mounting, "help.shortcuts"), { key: "h", altKey: true });

    expect(reason(mounting)).toBe(uiCopy.settings.keyboardAltQualified);
    expect(readShortcutOverrides(localStorage)).toEqual({});
    // §5.3: refused, not vanished — the row is still armed and still says it is
    // listening, so the author can press the chord they meant.
    expect(armed(mounting)).toBe(true);
    expect(printed(mounting, "help.shortcuts")).toBe(
      uiCopy.settings.keyboardPrompt,
    );
  });

  it("names the chord the browser keeps, not the bare key", async () => {
    // Ctrl+R is what the browser keeps; `R` alone is a letter that types into
    // every field, and the sentence has to be true of the press that was made.
    const mounting = mount(localStorage);
    await click(armControl(mounting, "publish.toggle"));

    await press(row(mounting, "publish.toggle"), { key: "r", ctrlKey: true });

    expect(reason(mounting)).toBe(uiCopy.settings.keyboardReserved("Ctrl+R"));
    expect(reason(mounting)).not.toContain("This browser keeps R for itself");
  });

  it("refuses a chord the action cannot honour, in words", async () => {
    const mounting = mount(localStorage);
    // `file.save` fires while a text field has focus by design, so a bare
    // letter would make it stop — the §2.3 change a preference may not spell.
    await click(armControl(mounting, "file.save"));

    await press(row(mounting, "file.save"), { key: "s" });

    expect(reason(mounting)).toBe(
      uiCopy.settings.keyboardCannotDefer(SHORTCUT_LABELS["file.save"]),
    );
    expect(readShortcutOverrides(localStorage)).not.toHaveProperty("file.save");
  });

  it("returns one action to its default without disturbing another's", async () => {
    const mounting = mount(localStorage);
    await click(armControl(mounting, "publish.toggle"));
    await press(row(mounting, "publish.toggle"), NEW_CHORD);
    await click(armControl(mounting, "help.shortcuts"));
    await press(row(mounting, "help.shortcuts"), { key: "h", ctrlKey: true });

    await click(perRowReset(mounting, "publish.toggle"));

    expect(readShortcutOverrides(localStorage)).not.toHaveProperty(
      "publish.toggle",
    );
    expect(readShortcutOverrides(localStorage)).toHaveProperty(
      "help.shortcuts",
    );
    expect(printed(mounting, "publish.toggle")).toBe("Ctrl+Shift+P");
  });

  it("clears every override for Reset all, and restores the defaults", async () => {
    const mounting = mount(localStorage);
    await click(armControl(mounting, "publish.toggle"));
    await press(row(mounting, "publish.toggle"), NEW_CHORD);

    await click(resetAll(mounting));

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(printed(mounting, "publish.toggle")).toBe("Ctrl+Shift+P");
    expect(printed(mounting, "edit.undo")).toBe("Ctrl+Z");
  });

  it("keeps a rebind for the session, and says so, where the browser kept no store", async () => {
    // No storage is a state the product reaches — `readStorage` answers
    // `undefined` in a browser that refuses it — and both branches have to
    // hold: the chord works, and the tab does not claim it was saved.
    const mounting = mount(undefined);
    expect(mounting.textContent).toContain(uiCopy.settings.keyboardSessionOnly);

    await click(armControl(mounting, "publish.toggle"));
    await press(row(mounting, "publish.toggle"), NEW_CHORD);

    expect(printed(mounting, "publish.toggle")).toBe("Ctrl+J");
    const ran = vi.fn();
    manager?.register("publish.toggle", ran);
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", NEW_CHORD));
    });
    expect(ran).toHaveBeenCalledOnce();
    expect(
      localStorage.length,
      "a session-only rebind writes no store entry",
    ).toBe(0);
  });
});
