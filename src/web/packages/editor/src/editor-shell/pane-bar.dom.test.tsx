// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { uiCopy } from "../ui-copy.js";
import { PaneBar, type RailPane } from "./pane-bar.js";

/** The bar's own segments, read from the DOM rather than from `PANES`, which is
 *  private: the test is about what an author can see and press. */
function segments(host: HTMLElement): readonly HTMLButtonElement[] {
  return Array.from(
    host.querySelectorAll<HTMLButtonElement>(".editor-shell-pane-bar button"),
  );
}

function segment(
  host: HTMLElement,
  label: string,
): HTMLButtonElement {
  const found = segments(host).find(
    (button) => button.textContent?.trim() === label,
  );
  if (found === undefined) throw new Error(`No "${label}" pane.`);
  return found;
}

let root: Root | undefined;
let host: HTMLDivElement | undefined;

function mount(props: {
  readonly pane: RailPane;
  readonly collapsed?: boolean;
  readonly onChoose?: (pane: RailPane) => void;
  readonly onInsert?: () => void;
}): HTMLElement {
  const mount = document.createElement("div");
  document.body.append(mount);
  const reactRoot = createRoot(mount);
  root = reactRoot;
  host = mount;
  act(() =>
    reactRoot.render(
      <PaneBar
        pane={props.pane}
        collapsed={props.collapsed ?? false}
        onChoose={props.onChoose ?? vi.fn()}
        onInsert={props.onInsert ?? vi.fn()}
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

it("names one segment per pane and presses the chosen one", () => {
  const host = mount({ pane: "assets" });

  // Every segment, derived from the copy table rather than restated, so a new
  // pane cannot be added to the bar without a word for it appearing here. The
  // `+` is the last button and is not a pane, so it is dropped rather than
  // sliced off at a number: a prefix of three kept covering three and let the
  // fourth arrive silently, which is the claim this line now makes true.
  expect(segments(host).slice(0, -1).map((button) => button.textContent)).toEqual(
    [
      uiCopy.rail.layers,
      uiCopy.rail.insert,
      uiCopy.rail.assets,
      uiCopy.rail.document,
    ],
  );
  expect(segment(host, uiCopy.rail.assets).getAttribute("aria-pressed")).toBe(
    "true",
  );
  expect(segment(host, uiCopy.rail.layers).getAttribute("aria-pressed")).toBe(
    "false",
  );
});

it("asks for the pane already showing, leaving the collapse to the shell", () => {
  const onChoose = vi.fn();
  const onInsert = vi.fn();
  const host = mount({ pane: "layers", onChoose, onInsert });

  // The bar cannot tell a swap from a close, so it reports the same gesture in
  // both cases and the shell decides. A bar that collapsed itself would make
  // the same click mean two things depending on the panel's state.
  act(() => segment(host, uiCopy.rail.layers).click());

  expect(onChoose).toHaveBeenCalledWith("layers");
  expect(onInsert).not.toHaveBeenCalled();

  // Asked twice, asked twice. The second press on the pane already showing has
  // to reach the shell, because the shell is the only thing that knows the
  // panel is out and can turn it back. A bar that swallowed it would pass the
  // assertion above and leave the author with no way to reopen the panel —
  // which is the half of Review Focus 3 that "onChoose was called with it"
  // cannot see.
  act(() => segment(host, uiCopy.rail.layers).click());
  expect(onChoose, "the bar never decides to close").toHaveBeenCalledTimes(2);
});

it("asks for a different pane, and still only asks", () => {
  const onChoose = vi.fn();
  const host = mount({ pane: "layers", onChoose });

  act(() => segment(host, uiCopy.rail.assets).click());

  expect(onChoose).toHaveBeenCalledWith("assets");
});

it("inserts from the `+` without choosing a pane", () => {
  const onChoose = vi.fn();
  const onInsert = vi.fn();
  const host = mount({ pane: "layers", onChoose, onInsert });

  const add = host.querySelector<HTMLButtonElement>(
    ".editor-shell-pane-bar-add",
  );

  // The `+` sits in the same row as the segments, so it is the one control
  // where "the thing under the pointer looks like the others" is the likely
  // mistake. It carries its own name and touches nothing else.
  expect(add?.getAttribute("aria-label")).toBe(uiCopy.rail.insertObject);
  // Icon-only, so the name is `aria-label` and never the content: a glyph
  // stored as a translatable string is announced as a word of its own.
  expect(add?.textContent?.trim()).toBe("");

  act(() => add?.click());

  expect(onInsert).toHaveBeenCalledTimes(1);
  expect(onChoose).not.toHaveBeenCalled();
});

it("announces a collapsed panel on every segment rather than drawing it", () => {
  const host = mount({ pane: "layers", collapsed: true });

  // Pressed stays true while the panel is out, so the bar still shows what
  // reopening restores; expanded is how the closed state is announced. Every
  // segment but the trailing `+`, which carries neither state.
  for (const button of segments(host).slice(0, -1)) {
    expect(button.getAttribute("aria-expanded")).toBe("false");
  }
  expect(segment(host, uiCopy.rail.layers).getAttribute("aria-pressed")).toBe(
    "true",
  );
});