// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { arrangeActions, type ObjectTarget } from "../object-actions.js";
import {
  resolveShortcuts,
  setActiveShortcuts,
} from "../shortcut-manager/bindings.js";
import { shortcutLabel } from "../shortcut-manager/display.js";
import {
  PRODUCT_SHORTCUTS,
  type ShortcutBinding,
} from "../shortcut-manager/index.js";
import { uiCopy } from "../ui-copy.js";
import type { EditorShellBridge } from "./bridge.js";
import { CanvasDock } from "./canvas-dock.js";

/** The bridge answers only what the dock's conversation needs: the selection
 *  gate (`snapshot`/`target`/`canArrange`) and the `run` a button calls. */
function bridgeOver(
  kind: ObjectTarget["kind"],
  locked = false,
): EditorShellBridge {
  const count = kind === "none" ? 0 : 1;
  return {
    snapshot: () => ({ selectedCount: count, locked, activeKind: kind }),
    target: () => ({ kind, locked, memberCount: count, isGroup: false }),
    canArrange: () => false,
    subscribe: () => () => undefined,
    run: vi.fn(),
  } as unknown as EditorShellBridge;
}

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  if (root !== undefined) act(() => root?.unmount());
  root = undefined;
  host?.remove();
  host = undefined;
  // The live binding table is module state, so a case that rebinds puts it back.
  setActiveShortcuts(PRODUCT_SHORTCUTS);
});

/** The control as the shell mounts it (`createRoot`, not `@testing-library/react`,
 *  which this workspace does not depend on). */
async function mount(
  bridge: EditorShellBridge | undefined,
): Promise<HTMLDivElement> {
  const mounted = document.createElement("div");
  host = mounted;
  document.body.append(mounted);
  const created = createRoot(mounted);
  root = created;
  await act(async () => created.render(<CanvasDock bridge={bridge} />));
  return mounted;
}

/** Focus opens the tooltip (`tooltip.ts` listens for `focus`). The popup is
 *  portalled to `body`, so it is found there and never inside `container`. */
function focusButton(container: HTMLElement, label: string): void {
  const button = container.querySelector<HTMLButtonElement>(
    `[aria-label="${label}"]`,
  );
  expect(button).not.toBeNull();
  act(() => button?.dispatchEvent(new Event("focus")));
}

describe("the canvas dock's tooltips", () => {
  it("carries the chord of an action the product binds", async () => {
    const container = await mount(bridgeOver("object"));
    focusButton(container, uiCopy.actions.duplicate);

    const chip = document.querySelector(".editor-shell-tooltip kbd");
    expect(chip?.textContent).toBe(shortcutLabel("edit.duplicate"));
  });

  it("omits the chip for an action the product does not bind", async () => {
    const container = await mount(bridgeOver("object"));
    focusButton(container, uiCopy.actions.bringForward);

    const popup = document.querySelector(".editor-shell-tooltip");
    expect(popup).not.toBeNull();
    // Bring-forward has no binding, so the popup is the words alone and the
    // registry's absent `shortcut` is what makes it so.
    expect(popup?.querySelector("kbd")).toBeNull();
  });

  it("re-reads the chord after a rebind rather than holding the one it rendered with", async () => {
    // Review Focus 3 on this surface: the tooltip is the second of the four
    // things that print a chord. `tooltip()` is rebuilt from the chord on every
    // change, so what this proves is that the *component* re-rendered — a
    // render-time copy would keep printing the old mark, and the dock would
    // name a key that no longer runs the action beside it.
    const container = await mount(bridgeOver("object"));
    focusButton(container, uiCopy.actions.duplicate);
    expect(
      document.querySelector(".editor-shell-tooltip kbd")?.textContent,
    ).toBe(shortcutLabel("edit.duplicate"));

    const moved: ShortcutBinding = {
      key: "j",
      modifier: true,
      shift: false,
      action: "edit.duplicate",
    };
    await act(async () => {
      setActiveShortcuts(resolveShortcuts({ "edit.duplicate": moved }));
    });

    // Focus again: the rebuilt popup is the rebuilt tooltip's, and `focus` is
    // the gesture that opens one without waiting out the hover delay.
    const button = container.querySelector<HTMLButtonElement>(
      `[aria-label="${uiCopy.actions.duplicate}"]`,
    );
    await act(async () => {
      button?.dispatchEvent(new Event("blur"));
    });
    focusButton(container, uiCopy.actions.duplicate);

    expect(
      document.querySelector(".editor-shell-tooltip kbd")?.textContent,
    ).toBe("Ctrl+J");
  });
});

/** A bridge whose selection is `count` objects, so the arrange half's
 *  two-or-more threshold is the fact the mount reads. */
function bridgeOverSelection(
  count: number,
  canArrange: boolean,
): EditorShellBridge {
  const kind = count === 0 ? "none" : "group";
  return {
    snapshot: () => ({ selectedCount: count, locked: false, activeKind: kind }),
    target: () => ({ kind, locked: false, memberCount: count, isGroup: false }),
    canArrange: () => canArrange,
    subscribe: () => () => undefined,
    run: vi.fn(),
  } as unknown as EditorShellBridge;
}

/** Drop the mounted root so a second `mount` in one case does not orphan the
 *  first's DOM in `body`. */
function unmount(): void {
  if (root !== undefined) act(() => root?.unmount());
  root = undefined;
  host?.remove();
  host = undefined;
}

/** The dock's asymmetry, which the re-layering must not disturb: the object
 *  half is *filtered* (an action this selection cannot run is absent) and the
 *  arrange half is *greyed* (it needs two or more and stays discoverable). */
describe("the canvas dock's two halves", () => {
  it("shows no object action and a greyed arrange half with nothing selected", async () => {
    const container = await mount(bridgeOverSelection(0, false));

    // Filtered: nothing selected, so no unmarked button is drawn at all.
    expect(
      container.querySelectorAll(
        "[data-vigilia-canvas-toolbar] button:not([data-vigilia-arrange-action])",
      ).length,
    ).toBe(0);

    // Greyed, not filtered: every arrange action is drawn, and disabled.
    const arrange = [
      ...container.querySelectorAll<HTMLButtonElement>(
        "[data-vigilia-canvas-toolbar] button[data-vigilia-arrange-action]",
      ),
    ];
    expect(arrange.length).toBe(arrangeActions().length);
    for (const button of arrange) expect(button.disabled).toBe(true);
  });

  it("enables the arrange half only from two objects", async () => {
    const one = await mount(bridgeOverSelection(1, true));
    expect(
      one.querySelector<HTMLButtonElement>(
        `[aria-label="${uiCopy.arrangeLabels["align-left"]}"]`,
      )?.disabled,
    ).toBe(true);
    unmount();

    const two = await mount(bridgeOverSelection(2, true));
    const button = (label: string): HTMLButtonElement | null =>
      two.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
    expect(button(uiCopy.arrangeLabels["align-left"])?.disabled).toBe(false);
    // Distribute needs three, so two objects still greys it out.
    expect(button(uiCopy.arrangeLabels["distribute-x"])?.disabled).toBe(true);
    expect(button(uiCopy.arrangeLabels["distribute-y"])?.disabled).toBe(true);
  });

  it("marks delete destructive and every other action not", async () => {
    const container = await mount(bridgeOverSelection(1, true));
    const marked = [
      ...container.querySelectorAll<HTMLButtonElement>(
        "[data-vigilia-canvas-toolbar] button[data-vigilia-destructive]",
      ),
    ];
    expect(marked.map((button) => button.getAttribute("aria-label"))).toEqual([
      uiCopy.actions.delete,
    ]);
  });
});
