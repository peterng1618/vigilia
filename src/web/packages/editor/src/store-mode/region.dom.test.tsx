// @vitest-environment jsdom
/**
 * The store mode's region: its own header row, and the facts about it that a
 * reader cannot get from the words alone.
 *
 * **What this file owns.** The two claims the plan makes in code — that the two
 * halves are a `Segmented` inside the region's *own* header row with nothing
 * above it, and that the facet row wraps rather than dropping a control — plus
 * the two wells and the five facet names. The facet popover is read here with
 * fixtures, because A.3 owns the record that derives the values and A.2 must not
 * reach into `renderer-core` for them.
 *
 * **What it deliberately does not measure.** jsdom lays nothing out: a narrow
 * width here is a declaration read off the class list, not a reflow. The wrap
 * is *proved* in the browser (`tests/e2e/editor-rail.spec.ts`), where the five
 * buttons are counted inside a really narrow region; what this file can say is
 * that no facet is conditionally rendered, so no width can drop one.
 */
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, expect, it } from "vitest";
import { uiCopy } from "../ui-copy.js";
import { type Facet, FacetRow } from "./facet-row.js";
import { StoreModeRegion } from "./region.js";

// Base UI's popup needs three browser APIs jsdom has none of: floating-ui
// observes its anchor, the popup waits for its own open transition, and it asks
// the selector engine for `:modal`/`:popover-open`, which jsdom parses slowly
// enough (about 0.5s a call) to dominate the file. Each test file that mounts a
// primitive supplies its own — there is no shared harness for it here.
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
  if (found === null) throw new Error(`the region rendered no ${what}`);
  return found;
}

/** The region's header row, which every case here reads through. */
function headerRow(container: HTMLElement): HTMLElement {
  return must(
    container.querySelector<HTMLElement>("[data-vigilia-store-header]"),
    "header row",
  );
}

/** The halves' segments, in the order the row draws them. */
function halves(header: HTMLElement): readonly HTMLButtonElement[] {
  return Array.from(
    must(
      header.querySelector<HTMLElement>("[data-vigilia-store-halves]"),
      "halves",
    ).querySelectorAll<HTMLButtonElement>("button"),
  );
}

/**
 * §7.2's "a second horizontal bar under the header is forbidden", one level
 * down: the region draws its own header row, and it is the region's *first*
 * row rather than a strip above one.
 *
 * The two halves are named and they are a `Segmented` — one exclusive choice
 * over what the region lists, not navigation between shell surfaces — and
 * choosing one moves the chosen segment rather than replacing the row.
 */
it("shows the two halves as a Segmented inside the region's own header row", async () => {
  const container = await mount(<StoreModeRegion mode="themes" />);
  const surface = container.firstElementChild;
  const header = headerRow(container);

  expect(
    surface?.firstElementChild,
    "something sits above the region's own header row",
  ).toBe(header);

  const segments = halves(header);
  expect(
    segments.map((segment) => segment.textContent),
    "the region does not name the two halves, in order",
  ).toEqual([uiCopy.store.halves.local, uiCopy.store.halves.online]);
  expect(
    segments.map((segment) => segment.getAttribute("aria-pressed")),
    "the region does not open on the local half",
  ).toEqual(["true", "false"]);
  expect(
    must(
      header.querySelector<HTMLElement>("[data-vigilia-store-halves]"),
      "halves",
    ).getAttribute("aria-label"),
    "the halves carry no programmatic name of their own",
  ).toBe(uiCopy.store.halves.label);

  await act(async () => halves(header)[1]?.click());

  expect(
    halves(header).map((segment) => segment.getAttribute("aria-pressed")),
    "choosing the online half did not move the chosen segment",
  ).toEqual(["false", "true"]);
});

/**
 * The facet row is five controls on one line, and a window too narrow for five
 * is a second line — never a dropped facet, which would silently filter by
 * something the author can no longer see or unchoose.
 *
 * jsdom lays nothing out, so no width is set and none could be measured here:
 * what is checkable is checked — every facet is rendered (nothing is
 * conditional, so no width can drop one), and the row declares the wrap that
 * puts the overflow on the next line rather than clipping it. The reflow itself
 * is the browser case's, which counts the five inside a really narrow row.
 */
it("keeps the facet row on one line and wraps rather than dropping a control", async () => {
  const container = await mount(<StoreModeRegion mode="themes" />);

  const row = must(
    headerRow(container).querySelector<HTMLElement>("[data-vigilia-facet-row]"),
    "facet row",
  );
  const facets = Array.from(
    row.querySelectorAll<HTMLButtonElement>("[data-vigilia-facet]"),
  );
  expect(
    facets.map((facet) =>
      facet.querySelector("[data-vigilia-facet-name]")?.textContent?.trim(),
    ),
    "the facet row does not name the five facets, in order",
  ).toEqual([
    uiCopy.store.facets.author,
    uiCopy.store.facets.colourMode,
    uiCopy.store.facets.sensors,
    uiCopy.store.facets.shape,
    uiCopy.store.facets.style,
  ]);
  expect(
    row.className,
    "the facet row cannot wrap, so a narrow region clips a control",
  ).toContain("flex-wrap");
});

/**
 * The two wells either side of the facets, and the sort that follows the half.
 *
 * The sort keys are per half and the two share no key (the spec's "The store
 * mode"): the catalogue knows when an item was published and how often it was
 * taken, and the host's own library knows only what the author wrote. Read as
 * the words the well prints, because the two halves' first keys are different
 * words — `Name` against `Updated` — so a sort that did not follow the half
 * would print the same thing twice.
 */
it("draws the search well and the sort well, and the sort follows the half", async () => {
  const container = await mount(<StoreModeRegion mode="themes" />);
  const header = headerRow(container);

  const search = must(
    header.querySelector<HTMLInputElement>("[data-vigilia-store-search]"),
    "search well",
  );
  expect(
    search.getAttribute("aria-label"),
    "the search well has no programmatic name",
  ).toBe(uiCopy.store.search);
  expect(search.placeholder, "the empty search well says nothing").toBe(
    uiCopy.store.search,
  );

  const sort = must(
    header.querySelector<HTMLElement>("[data-vigilia-store-sort]"),
    "sort well",
  );
  expect(sort.textContent).toContain(uiCopy.store.sort.local.name);

  await act(async () => halves(header)[1]?.click());

  expect(
    header.querySelector<HTMLElement>("[data-vigilia-store-sort]")?.textContent,
    "the sort kept the local half's key on the online half",
  ).toContain(uiCopy.store.sort.online.updated);
});

/**
 * §5's checkbox choice row, which is the one control this commit adds to the
 * design language: a set you may choose *several* of is not rule 7's radio
 * group, so the row's semantics are a checkbox and the group is a plain group.
 *
 * Read with fixtures rather than with the catalogue, because the values are
 * A.3's record to derive and the row is only the surface that draws them. The
 * count is what the author reads *before* opening the facet, so it is asserted
 * on the trigger rather than inside the popover.
 */
it("opens a facet as a group of checkbox rows, and counts what is chosen", async () => {
  const facets: readonly Facet[] = [
    {
      id: "author",
      name: uiCopy.store.facets.author,
      options: [
        { id: "ada", name: "Ada", count: 3 },
        { id: "bob", name: "Bob", count: 1 },
      ],
    },
  ];
  const container = await mount(<FacetRow facets={facets} />);
  const trigger = must(
    container.querySelector<HTMLButtonElement>("[data-vigilia-facet]"),
    "facet button",
  );
  expect(
    trigger.querySelector("[data-vigilia-facet-count]"),
    "a facet with nothing chosen claims a count",
  ).toBeNull();

  await act(async () => trigger.click());

  const rows = Array.from(
    document.body.querySelectorAll<HTMLButtonElement>(
      "[data-vigilia-facet-option]",
    ),
  );
  expect(
    rows.map((row) =>
      row
        .querySelector("[data-vigilia-facet-option-name]")
        ?.textContent?.trim(),
    ),
    "the facet did not offer its options",
  ).toEqual(["Ada", "Bob"]);
  expect(
    rows.map((row) => row.getAttribute("aria-checked")),
    "the facet's rows do not open unchecked",
  ).toEqual(["false", "false"]);

  await act(async () => rows[0]?.click());

  expect(
    document.body
      .querySelectorAll("[data-vigilia-facet-option]")[0]
      ?.getAttribute("aria-checked"),
    "choosing a value did not check its row",
  ).toBe("true");
  expect(
    trigger.querySelector("[data-vigilia-facet-count]")?.textContent,
    "the trigger does not count what is chosen",
  ).toBe("1");
});

/**
 * The region is the Themes mode's surface and no other's. The shell renders one
 * `[data-vigilia-mode-region]` section for every non-editor mode, and A.8 mounts
 * the Host mode's own region in it — so a region that drew itself in a mode it
 * does not own would be the second surface in one section.
 */
it("renders no region for a mode that is not Themes", async () => {
  const container = await mount(<StoreModeRegion mode="this-pc" />);
  expect(container.textContent, "the store drew itself in the host mode").toBe(
    "",
  );
});
