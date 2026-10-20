// @vitest-environment jsdom
/**
 * The gallery's cells: what one cell draws, and what its actions report.
 *
 * **What this file owns.** The plan's own case — a theme with no picture is
 * filled from its own artboard rather than left empty — plus the two claims the
 * brief's rulings add: the picture a theme does not have is dropped rather than
 * left broken, and the four actions travel through the one `onAction` callback.
 *
 * **What it deliberately does not measure.** jsdom lays nothing out, so the
 * grid's `272px` minimum and the picture's `2/1` are declarations read off the
 * class list rather than a reflow; the drawing fixes them and DESIGN.md's Layout
 * section carries the minimum. Nothing mounts this gallery until A.6 wires it
 * into the region, so there is no page to inspect in a browser and no browser
 * case here.
 */
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { uiCopy } from "../ui-copy.js";
import { Gallery } from "./gallery.js";
import { DASHBOARD_THEME_KIND, type StoreItem } from "./local-source.js";

// Base UI's tooltip needs three browser APIs jsdom has none of: floating-ui
// observes its anchor, the popup waits for its own open transition, and it asks
// the selector engine for `:modal`/`:popover-open`, which jsdom parses slowly
// enough to dominate the file. Each test file that mounts a control supplies its
// own — there is no shared harness for it here.
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
} as never;
Element.prototype.getAnimations ??= (): never[] => [];
window.PointerEvent ??= MouseEvent as never;

// React only flushes work scheduled inside `act` when it has been told it is in
// a test; without this, `act` warns and the update lands after the assertion.
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(() => {
  const matches = Element.prototype.matches;
  Element.prototype.matches = Object.assign(function (
    this: Element,
    selector: string,
  ): boolean {
    if (selector === ":modal" || selector === ":popover-open") return false;
    return matches.call(this, selector);
  }, matches);
});

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  const mounted = root;
  root = undefined;
  host?.remove();
  host = undefined;
  if (mounted !== undefined) act(() => mounted.unmount());
});

async function mount(element: ReactElement): Promise<HTMLDivElement> {
  const container = document.createElement("div");
  document.body.append(container);
  const mounted = createRoot(container);
  root = mounted;
  host = container;
  await act(async () => {
    mounted.render(element);
  });
  return container;
}

/** A missing element is a defect this file names, rather than a `null` a later
 *  assertion reports as a wrong value. */
function must<T extends Element>(found: T | null, what: string): T {
  if (found === null) throw new Error(`the gallery drew no ${what}`);
  return found;
}

/** One item as the source hands it: a named theme with a stored picture and a
 *  ground. `midnightblue` rather than a hex, because a fixture in a gated file
 *  carries a colour *name* or a token value and never a literal. */
function item(overrides: Partial<StoreItem> = {}): StoreItem {
  return {
    id: "living-room",
    kind: DASHBOARD_THEME_KIND,
    name: "Living room",
    author: "mira-k",
    updatedAt: "2026-10-15T09:31:00.000Z",
    thumbnailUrl: "/api/themes/living-room/thumbnail",
    ground: "midnightblue",
    facets: {
      author: "mira-k",
      colourMode: "dark",
      sensors: [{ key: "cpu.load", label: "CPU", family: "system" }],
      orientation: "landscape",
      aspect: "16:9",
      width: 1920,
      height: 1080,
    },
    ...overrides,
  };
}

/** The cell's picture box, which every case here reads through. */
function pictureBox(container: HTMLElement): HTMLElement {
  return must(
    container.querySelector<HTMLElement>("[data-vigilia-store-picture]"),
    "picture box",
  );
}

/**
 * The cell's picture box, filled from the theme's own artboard.
 *
 * A theme the host has stored no picture for is answered by a `404` at the
 * thumbnail address, so the box cannot be left to the image: it carries the
 * ground the source resolved, and the image is what is optional.
 */
it("draws the theme's own ground when it has no thumbnail", async () => {
  const container = await mount(
    <Gallery
      items={[item({ thumbnailUrl: undefined })]}
      onAction={() => undefined}
    />,
  );

  const box = pictureBox(container);
  expect(
    box.querySelector("img"),
    "the cell drew a picture for a theme that has none",
  ).toBeNull();
  expect(
    box.style.background,
    "the cell left the box empty instead of drawing the theme's ground",
  ).toBe("midnightblue");
});

/**
 * The picture a theme does not have is **dropped**, not left showing a broken
 * mark: the box already carries the ground, so the image that fails is removed
 * and what is behind it is what the author sees.
 */
it("drops the picture a theme does not have, leaving its ground", async () => {
  const container = await mount(
    <Gallery items={[item()]} onAction={() => undefined} />,
  );
  const box = pictureBox(container);
  const picture = must(box.querySelector("img"), "picture");

  await act(async () => {
    picture.dispatchEvent(new Event("error"));
  });

  expect(
    box.querySelector("img"),
    "the cell kept the picture the host does not have",
  ).toBeNull();
  expect(box.style.background).toBe("midnightblue");
});

/**
 * The four actions, named and reported through the one callback.
 *
 * The cell draws four, so `onAction` carries which one as well as which item —
 * the plan's `onOpen(id)` could not express the other three, and four separate
 * props would be four a caller can half-wire.
 */
it("names its four actions and reports each one through the one callback", async () => {
  const onAction = vi.fn();
  const container = await mount(
    <Gallery items={[item()]} onAction={onAction} />,
  );

  const buttons = Array.from(
    container.querySelectorAll<HTMLButtonElement>(
      "[data-vigilia-store-cell-action]",
    ),
  );
  expect(
    buttons.map((button) => button.getAttribute("aria-label")),
    "the cell does not name its four actions in the drawing's order",
  ).toEqual([
    uiCopy.store.cell.actions.open,
    uiCopy.store.cell.actions.assign,
    uiCopy.store.cell.actions.export,
    uiCopy.store.cell.actions.delete,
  ]);

  for (const button of buttons) {
    await act(async () => button.click());
  }

  expect(onAction.mock.calls).toEqual([
    ["open", "living-room"],
    ["assign", "living-room"],
    ["export", "living-room"],
    ["delete", "living-room"],
  ]);
});

/**
 * The byline is the drawing's mono line: the author with the `@`, the date, and
 * *No author* where the document declares none — a fact about the theme rather
 * than a missing reading.
 */
it("writes the byline the drawing draws, and says so when there is no author", async () => {
  const container = await mount(
    <Gallery
      items={[
        item(),
        item({
          id: "workshop-bench",
          name: "Workshop bench",
          author: undefined,
        }),
      ]}
      onAction={() => undefined}
    />,
  );

  const bylines = Array.from(
    container.querySelectorAll<HTMLElement>("[data-vigilia-store-cell-byline]"),
    (byline) => byline.textContent,
  );
  expect(bylines).toEqual([
    "@mira-k · 2026-10-15",
    `${uiCopy.store.cell.noAuthor} · 2026-10-15`,
  ]);
});
