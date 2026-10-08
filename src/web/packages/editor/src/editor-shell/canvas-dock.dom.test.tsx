// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ObjectTarget } from "../object-actions.js";
import { shortcutLabel } from "../shortcut-manager/display.js";
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
});
