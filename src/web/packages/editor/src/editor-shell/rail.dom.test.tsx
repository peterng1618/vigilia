// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { uiCopy } from "../ui-copy.js";
import { Rail, RAIL_SLOTS, type RailSlot } from "./rail.js";

/** The rail's own slots, read from the DOM rather than from `RAIL_SLOTS`'s
 *  glyphs, which are private: the test is about what an author can see and
 *  press. */
function slots(host: HTMLElement): readonly HTMLButtonElement[] {
  return Array.from(
    host.querySelectorAll<HTMLButtonElement>(".editor-shell-rail button"),
  );
}

function slot(host: HTMLElement, id: RailSlot): HTMLButtonElement {
  const found = host.querySelector<HTMLButtonElement>(
    `[data-rail-slot="${id}"]`,
  );
  if (found === null) throw new Error(`No "${id}" slot.`);
  return found;
}

let root: Root | undefined;
let host: HTMLDivElement | undefined;

function mount(props: {
  readonly slot: RailSlot;
  readonly collapsed?: boolean;
  readonly onChoose?: (slot: RailSlot) => void;
}): HTMLElement {
  const mount = document.createElement("div");
  document.body.append(mount);
  const reactRoot = createRoot(mount);
  root = reactRoot;
  host = mount;
  act(() =>
    reactRoot.render(
      <Rail
        slot={props.slot}
        collapsed={props.collapsed ?? false}
        onChoose={props.onChoose ?? vi.fn()}
      />,
    ),
  );
  return mount;
}

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  host?.remove();
  host = undefined;
});

it("offers exactly the four slots the bible names", () => {
  const host = mount({ slot: "composition" });

  // Derived from `RAIL_SLOTS` rather than restated: a fifth slot added to the
  // rail cannot arrive without a word for it appearing here, and a dropped one
  // cannot leave a stale fourth. The word is the accessible name, because the
  // slot draws a glyph and no text.
  expect(
    slots(host).map((button) => button.getAttribute("aria-label")),
  ).toEqual(RAIL_SLOTS.map((id) => uiCopy.rail.slots[id]));
  expect(slots(host)).toHaveLength(RAIL_SLOTS.length);
});

it("marks the open slot with the accent and the closed ones with --faint", () => {
  const host = mount({ slot: "tokens" });

  // The two treatments are CSS keyed on `aria-pressed`, so the attribute is
  // what both the stylesheet and the browser suite read — an accent glyph,
  // wash and 2px bar on the selected slot, `--faint` on the rest (bible
  // §7.2). The rail has no visible text to read the colour from, which is why
  // the marker is the attribute rather than a class on a label.
  expect(slot(host, "tokens").getAttribute("aria-pressed")).toBe("true");
  for (const id of RAIL_SLOTS) {
    if (id === "tokens") continue;
    expect(slot(host, id).getAttribute("aria-pressed")).toBe("false");
  }
});

it("keeps the column's state on the rail rather than on the slots", () => {
  const open = mount({ slot: "tokens" });

  // One signal per fact. Which slot is chosen is the slots' own `aria-pressed`
  // (the test above); whether the column is out at all is a fact about the
  // shell, and it is stated once, here. A slot carrying `aria-expanded` would
  // be a second attribute for a fact that is not the slot's — with `tokens`
  // shown, the other three panes are `hidden`.
  expect(
    open.querySelector(".editor-shell-rail")?.getAttribute("data-collapsed"),
  ).toBe("false");
  for (const button of slots(open)) {
    expect(button.hasAttribute("aria-expanded")).toBe(false);
  }

  act(() => root?.unmount());
  root = undefined;
  open.remove();

  const shut = mount({ slot: "tokens", collapsed: true });
  expect(
    shut.querySelector(".editor-shell-rail")?.getAttribute("data-collapsed"),
  ).toBe("true");
});

it("asks for the slot it was given, and only asks", () => {
  const onChoose = vi.fn();
  const host = mount({ slot: "composition", onChoose });

  act(() => slot(host, "tokens").click());
  expect(onChoose).toHaveBeenCalledWith("tokens");

  // The rail cannot tell a swap from a close: the same gesture reports in both
  // cases and the shell decides (its `choosePane`), so the slot already open
  // still asks on the second press. A rail that collapsed itself would make
  // the same click mean two things and leave no route back to the pane.
  act(() => slot(host, "composition").click());
  expect(onChoose).toHaveBeenCalledWith("composition");
  expect(onChoose).toHaveBeenCalledTimes(2);
});
