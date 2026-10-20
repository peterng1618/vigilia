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
import { act, type ReactElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import {
  createThemeLibraryClient,
  type ThemedDisplay,
  type ThemeLibraryClient,
  type ThemeLibraryEntry,
} from "../theme-library-client.js";
import { uiCopy } from "../ui-copy.js";
import { type Facet, FacetRow, toggleFacet } from "./facet-row.js";
import { DARK_GROUND, fixtureEntry, LIGHT_GROUND } from "./item-fixture.js";
import type { CellAction, FacetSelection } from "./local-source.js";
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

/** The mounted region and its host, taken down together: the item modal is
 *  portalled to `body`, so a root left mounted would leave a second surface in
 *  the tree for the next read to find. */
async function unmount(): Promise<void> {
  const mounted = root;
  root = undefined;
  host?.remove();
  host = undefined;
  if (mounted !== undefined) await act(async () => mounted.unmount());
}

afterEach(async () => {
  await unmount();
});

beforeEach(() => {
  // The page size is the one thing this surface persists (`page-size.ts`), and
  // jsdom's storage outlives a test: without this, a case that chooses 48
  // changes how many pages the next one has.
  window.localStorage.clear();
});

async function mount(element: ReactElement): Promise<HTMLDivElement> {
  await unmount();
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
  const container = await mount(<FacetFixture facets={facets} />);
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

/**
 * The row holds no state of its own — the region owns the selection, because
 * what is chosen filters the list and returns the pager to page one — so a case
 * that mounts the row alone supplies the region's own rule (`toggleFacet`)
 * rather than a second copy of it.
 */
function FacetFixture(props: {
  readonly facets: readonly Facet[];
}): React.JSX.Element {
  const [chosen, setChosen] = useState<FacetSelection>({});
  return (
    <FacetRow
      facets={props.facets}
      chosen={chosen}
      onToggle={(facetId, optionId) =>
        setChosen((current) => toggleFacet(current, facetId, optionId))
      }
    />
  );
}

/** A client that answers one listing and refuses everything else: the region
 *  reads `list()` and none of the library's other four members — opening a
 *  theme is the shell's own route, through the session's client rather than
 *  this one. */
function clientListing(
  entries: readonly ThemeLibraryEntry[],
): ThemeLibraryClient {
  return {
    list: async () => entries,
    open: () => Promise.reject(new Error("the region lists; the shell opens")),
    save: () => Promise.reject(new Error("the store does not save")),
    assign: () => Promise.reject(new Error("the store does not assign")),
    listDisplays: async () => ({ default: null, displays: [] }),
  };
}

/** A listing of `count` themes, all 1920×1080 and dark, named so the sort has
 *  something to order. */
function listing(count: number): readonly ThemeLibraryEntry[] {
  return Array.from({ length: count }, (_unused, index) =>
    fixtureEntry({
      id: `theme-${index + 1}`,
      name: `Theme ${String(index + 1).padStart(2, "0")}`,
      ground: DARK_GROUND,
    }),
  );
}

/** The region over one listing, with the shell's own route to a document where
 *  a case has one to prove. */
async function mountStore(
  entries: readonly ThemeLibraryEntry[],
  onOpenTheme?: (id: string) => void,
): Promise<HTMLElement> {
  return mount(
    <StoreModeRegion
      mode="themes"
      client={clientListing(entries)}
      {...(onOpenTheme === undefined ? {} : { onOpenTheme })}
    />,
  );
}

/** The cells the gallery draws, in order. */
function cells(): readonly HTMLElement[] {
  return Array.from(
    document.body.querySelectorAll<HTMLElement>("[data-vigilia-store-cell]"),
  );
}

/** One cell's action button, pressed the way a person presses it. */
async function pressCell(id: string, action: CellAction): Promise<void> {
  const button = must(
    document.body.querySelector<HTMLButtonElement>(
      `[data-vigilia-store-cell="${id}"] [data-vigilia-store-cell-action="${action}"]`,
    ),
    `${action} on ${id}`,
  );
  await act(async () => button.click());
}

/** The cell's own surface — its picture and its name, not one of its four
 *  actions — pressed the way a person presses it. */
async function pressCellSurface(id: string): Promise<void> {
  const surface = must(
    document.body.querySelector<HTMLButtonElement>(
      `[data-vigilia-store-cell="${id}"] [data-vigilia-store-cell-surface]`,
    ),
    `${id}'s own surface`,
  );
  await act(async () => surface.click());
}

/** Whether the item's own surface is on screen, read where it portals to. */
function itemIsOpen(): boolean {
  return document.body.querySelector("[data-vigilia-store-item]") !== null;
}

/** The way out of the item's own surface, pressed. */
async function closeItem(): Promise<void> {
  await act(async () =>
    must(
      document.body.querySelector<HTMLButtonElement>(
        "[data-vigilia-store-item-close]",
      ),
      "close control",
    ).click(),
  );
}

/** The page the pager says is in force, or `undefined` when it draws none. */
function currentPage(): number | undefined {
  const shown = document.body.querySelector<HTMLElement>(
    "[data-vigilia-store-page][aria-current]",
  );
  return shown === null
    ? undefined
    : Number(shown.getAttribute("data-vigilia-store-page"));
}

/** One run of a facet popover: the heading it is drawn under, or `undefined`
 *  for values filed under none, and the values themselves. */
interface FacetRun {
  readonly group: string | undefined;
  readonly values: readonly string[];
}

/**
 * One facet's own popover, opened, and what it draws: the sentence above the
 * options where the drawing has one, and the labelled runs of values.
 *
 * It is read **inside that popup** rather than across `body`, so a case that
 * opens two in turn cannot read the first one's values and call them the
 * second's. The runs are reconstructed from the rows' own owners rather than
 * from a list of headings, so a heading drawn over no value, or a value under a
 * heading that is not its own, is what the reading shows.
 *
 * `runClasses` is each run's own wrapper class, in the same order, so a case can
 * pin the spacing a run gives its rows — jsdom lays nothing out, so a measured
 * gap would be zero whatever the classes said.
 */
async function openFacet(
  facetId: string,
  name: string,
): Promise<{
  readonly hint: string | undefined;
  readonly runs: readonly FacetRun[];
  readonly runClasses: readonly string[];
}> {
  await act(async () =>
    must(
      document.body.querySelector<HTMLButtonElement>(
        `[data-vigilia-facet="${facetId}"]`,
      ),
      `${facetId} facet`,
    ).click(),
  );
  const popup = must(
    document.body.querySelector<HTMLElement>(`[aria-label="${name}"]`),
    `${facetId} popover`,
  );

  const runs: {
    group: string | undefined;
    values: string[];
    classes: string;
  }[] = [];
  for (const row of popup.querySelectorAll<HTMLElement>(
    "[data-vigilia-facet-option]",
  )) {
    const wrapper = must(row.parentElement, "a facet option's own run");
    const owner = wrapper.closest("[data-vigilia-facet-group]");
    const group = owner?.getAttribute("data-vigilia-facet-group") ?? undefined;
    const value =
      row
        .querySelector("[data-vigilia-facet-option-name]")
        ?.textContent?.trim() ?? "";
    const last = runs.at(-1);
    if (last !== undefined && last.group === group) last.values.push(value);
    else runs.push({ group, values: [value], classes: wrapper.className });
  }

  return {
    hint:
      popup.querySelector("[data-vigilia-facet-hint]")?.textContent?.trim() ??
      undefined,
    runs: runs.map(({ group, values }) => ({ group, values })),
    runClasses: runs.map((run) => run.classes),
  };
}

/** A search well, typed into the way React reads a controlled input: through the
 *  native setter, which a plain `value =` write does not go through. */
async function type(query: string): Promise<void> {
  const well = must(
    document.body.querySelector<HTMLInputElement>(
      "[data-vigilia-store-search]",
    ),
    "search well",
  );
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(well, query);
    well.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/**
 * The region lists the items, and **the cell's own surface is what opens the
 * item's** (spec, "The item's own surface": *so a cell opens a modal*).
 *
 * The gallery is the wiring's visible half: before A.6 the region's body was
 * empty, so a cell drawn at all is the source reaching the grid. The cell is
 * the control here rather than the `open` action, which names the library
 * operation its label prints — *Open in editor* — and is the half below.
 */
it("lists the items and opens one from the cell's own surface", async () => {
  await mountStore([
    fixtureEntry({
      id: "living-room",
      name: "Living room",
      ground: DARK_GROUND,
    }),
    fixtureEntry({
      id: "porch-strip",
      name: "Porch strip",
      ground: DARK_GROUND,
    }),
  ]);

  expect(
    cells().map((cell) => cell.getAttribute("data-vigilia-store-cell")),
    "the region draws no cells for the items it listed",
  ).toEqual(["living-room", "porch-strip"]);

  await pressCellSurface("porch-strip");

  expect(
    document.body
      .querySelector("[data-vigilia-store-item-name]")
      ?.textContent?.trim(),
    "the cell's own surface did not open the item's own surface",
  ).toBe("Porch strip");
});

/**
 * **The `open` action asks for a document and opens no modal**, from the cell
 * and from the modal's own footer alike: the drawing labels it *Open in editor*
 * and the library's existing operation is what the label names (R134).
 *
 * The two are one case because they are one route — the modal draws the cell's
 * own four actions and reports them through the same callback — and the failure
 * this owns was exactly the two disagreeing with the label.
 */
it("asks for the theme as a document from the cell's open action and the modal's", async () => {
  const opened: string[] = [];
  await mountStore(
    [
      fixtureEntry({
        id: "porch-strip",
        name: "Porch strip",
        ground: DARK_GROUND,
      }),
    ],
    (id) => opened.push(id),
  );

  await pressCell("porch-strip", "open");

  expect(
    itemIsOpen(),
    "the cell's open action opened a modal instead of a document",
  ).toBe(false);
  expect(
    opened,
    "the cell's open action did not ask for the theme as a document",
  ).toEqual(["porch-strip"]);

  await pressCellSurface("porch-strip");
  await act(async () =>
    must(
      document.body.querySelector<HTMLButtonElement>(
        "[data-vigilia-store-item-action='open']",
      ),
      "the modal's open action",
    ).click(),
  );

  expect(
    opened,
    "the modal's own open action does not take the route the cell's does",
  ).toEqual(["porch-strip", "porch-strip"]);
  // **And it leaves this surface where it was** (`item-modal.tsx`): loading a
  // document is a fact about the document, so the surface someone is reading
  // stays on screen — closing it here would be the modal deciding something the
  // region's own `openId` owns.
  expect(
    itemIsOpen(),
    "the modal's own open action closed the item's own surface",
  ).toBe(true);
  expect(
    document.body
      .querySelector("[data-vigilia-store-item-name]")
      ?.textContent?.trim(),
    "the modal's own open action moved the item's own surface",
  ).toBe("Porch strip");
});

/**
 * **The two empties are two sentences, and not the same one twice** (R124). An
 * empty library is not an empty filter result: the first says the library has
 * nothing in it and what to do about it, and the second says the filters matched
 * nothing. The first-run sentence would tell someone with forty themes to go and
 * build one.
 */
it("offers the two different empty states, and not the same one twice", async () => {
  await mountStore([]);

  const empty = must(
    document.body.querySelector<HTMLElement>("[data-vigilia-store-empty]"),
    "empty state",
  );
  expect(
    empty.textContent,
    "an empty library does not say the library is empty",
  ).toContain(uiCopy.store.empty.library);
  expect(
    empty.textContent,
    "an empty library offers the filter sentence",
  ).not.toContain(uiCopy.store.empty.filter);

  await mountStore([
    fixtureEntry({
      id: "living-room",
      name: "Living room",
      ground: DARK_GROUND,
    }),
  ]);
  await type("nothing matches this");

  const filtered = must(
    document.body.querySelector<HTMLElement>("[data-vigilia-store-empty]"),
    "empty state after a query",
  );
  expect(
    filtered.textContent,
    "a filter that matched nothing does not say so",
  ).toContain(uiCopy.store.empty.filter);
  expect(
    filtered.textContent,
    "a filter that matched nothing tells the reader to build a theme",
  ).not.toContain(uiCopy.store.empty.library);
});

/**
 * **A changed filter returns to page one** (R123), and it is the filter's rule
 * rather than the pager's: a narrower result would otherwise leave the viewer on
 * a page they were not looking for, which reads as a store that moved under them.
 *
 * **The filter leaves two pages standing**, which is what makes this the rule's
 * own case rather than the clamp's: twenty-four of the thirty carry the word the
 * query names, so page two still exists and still holds items when the query
 * lands, and nothing but `toFirstPage()` can answer page one.
 */
it("returns to page one when a filter changes", async () => {
  await mountStore(
    Array.from({ length: 30 }, (_unused, at) =>
      fixtureEntry({
        id: `theme-${at + 1}`,
        name: `${at < 24 ? "Themed" : "Plain"} ${String(at + 1).padStart(2, "0")}`,
        ground: DARK_GROUND,
      }),
    ),
  );

  const second = must(
    document.body.querySelector<HTMLButtonElement>(
      "[data-vigilia-store-page='2']",
    ),
    "second page numeral",
  );
  await act(async () => second.click());
  expect(currentPage(), "the pager did not move to page two").toBe(2);

  await type("Themed");

  expect(
    document.body.querySelector("[data-vigilia-store-page='2']"),
    "the filter left fewer pages than this case is about",
  ).not.toBeNull();
  expect(
    currentPage(),
    "a changed query left the viewer on the page they were on",
  ).toBe(1);
});

/**
 * **Opening the item does not disturb what is underneath it** (spec, "The item,
 * and why `kind` is the seam"): the page, the query and the sort are where they
 * were when the modal closes, so a person comes back to the list they left.
 */
it("closes back onto the same page, filter and sort", async () => {
  await mountStore(listing(30));
  await type("Theme");

  const second = must(
    document.body.querySelector<HTMLButtonElement>(
      "[data-vigilia-store-page='2']",
    ),
    "second page numeral",
  );
  await act(async () => second.click());

  const opened = String(cells()[0]?.getAttribute("data-vigilia-store-cell"));
  await pressCellSurface(opened);
  await closeItem();

  expect(
    document.body.querySelector("[data-vigilia-store-item]"),
    "the item's own surface did not close",
  ).toBeNull();
  expect(currentPage(), "closing the item lost the page").toBe(2);
  expect(
    must(
      document.body.querySelector<HTMLInputElement>(
        "[data-vigilia-store-search]",
      ),
      "search well",
    ).value,
    "closing the item lost the query",
  ).toBe("Theme");
});

/**
 * **The facet values are the items' own readings** (R122). Three things are
 * asserted, and each is a way a facet can lie: `unclassified` is not a value a
 * person can ask for (it is reachable under "any" and under nothing else), a
 * size exactly one theme declares is not offered (it would be a theme wearing a
 * filter's clothes), and a size two themes declare is.
 *
 * **The groups are read too** (R115): the drawing draws Shape's three groups as
 * labelled runs under "A theme must match every group.", and a flat list is what
 * hides the AND — a person who picks Landscape + 16:9 and gets no portrait 16:9
 * theme has been told the opposite of what the filter does.
 */
it("derives the facet values from the items", async () => {
  await mountStore([
    fixtureEntry({ id: "dark", ground: DARK_GROUND }),
    fixtureEntry({ id: "dark-two", ground: DARK_GROUND }),
    fixtureEntry({ id: "light", ground: LIGHT_GROUND }),
    // No ground at all, so the record cannot read a colour mode from it.
    fixtureEntry({ id: "unclassified" }),
    fixtureEntry({
      id: "wide",
      width: 2560,
      height: 1440,
      ground: DARK_GROUND,
    }),
  ]);

  const colour = await openFacet("colour-mode", uiCopy.store.facets.colourMode);
  expect(
    colour.runs,
    "the colour facet offers a value nobody can ask for, or misses one",
  ).toEqual([
    {
      group: undefined,
      values: [uiCopy.store.colourModes.dark, uiCopy.store.colourModes.light],
    },
  ]);
  expect(
    colour.hint,
    "a facet the drawing draws without a sentence says one anyway",
  ).toBeUndefined();

  const shape = await openFacet("shape", uiCopy.store.facets.shape);
  expect(
    shape.hint,
    "the shape popover does not carry the sentence the drawing draws",
  ).toBe(uiCopy.store.facets.shapeHint);
  const headings = uiCopy.store.facets.shapeGroups;
  expect(
    shape.runs,
    "the shape facet flattens the drawing's three labelled groups",
  ).toEqual([
    {
      group: headings.orientation,
      values: [uiCopy.store.orientations.landscape],
    },
    { group: headings.aspect, values: ["16:9"] },
    // A size exactly one theme declares is not a value: it is a theme wearing a
    // filter's clothes, and every other size is reachable under `Other`.
    { group: headings.size, values: [uiCopy.store.size(1920, 1080)] },
  ]);
});

/**
 * **A run's spacing belongs to the run, not to the grouping** (A.6's fix round
 * 2, G1). F5 gave the grouped branch a `gap-[var(--space-4)]` and left the flat
 * one without, so Colour mode, Author and Style drew their rows flush while
 * Shape's sat 4px apart — the spacing the rows had as direct children of the
 * popup, lost to a branch that only meant to add a heading.
 *
 * **The class is pinned rather than a measured gap**, because jsdom lays nothing
 * out: every `getBoundingClientRect` here is zeroes, so a case that measured
 * would agree with any spacing at all. The one class string shared by every run
 * is the invariant — two branches that each carried their own would be two
 * strings — and the browser case measures the same gap for real.
 */
it("gives an ungrouped run's rows the spacing it gives a grouped one's", async () => {
  await mountStore([
    fixtureEntry({ id: "dark", ground: DARK_GROUND }),
    fixtureEntry({ id: "light", ground: LIGHT_GROUND }),
    fixtureEntry({
      id: "wide",
      width: 2560,
      height: 1440,
      ground: DARK_GROUND,
    }),
  ]);

  const flat = await openFacet("colour-mode", uiCopy.store.facets.colourMode);
  const grouped = await openFacet("shape", uiCopy.store.facets.shape);

  expect(
    flat.runs.length,
    "the colour facet draws no run to space at all",
  ).toBe(1);
  expect(grouped.runs.length, "the shape facet draws no labelled run").toBe(3);
  const classes = [...new Set([...flat.runClasses, ...grouped.runClasses])];
  expect(
    classes.length,
    `an ungrouped run and a grouped one space their rows differently (${JSON.stringify(classes)})`,
  ).toBe(1);
  expect(
    classes[0],
    `the rows of a run are drawn flush (${JSON.stringify(classes)})`,
  ).toContain("gap-[var(--space-4)]");
});

/**
 * **The sensors are grouped by the family the vocabulary already files them
 * under**, which is the grouping the spec asks for and not a second reading of
 * the key here.
 *
 * A key this build does not know has no family, so it is offered under no
 * heading rather than under an invented one (§9) — and it is still offered,
 * because a theme that binds it is a theme the library holds.
 */
it("groups the sensors by the family the vocabulary files them under", async () => {
  await mountStore([
    fixtureEntry({
      id: "reads-two-families",
      ground: DARK_GROUND,
      bindings: {
        "cpu-label": [{ id: "cpu", semanticKey: "cpu.load" }],
        "disk-label": [{ id: "disk", semanticKey: "disk.used" }],
        "unknown-label": [{ id: "unknown", semanticKey: "not.a.key" }],
      },
    }),
  ]);

  const sensors = await openFacet("sensors", uiCopy.store.facets.sensors);

  expect(
    sensors.runs,
    "the sensor values are one flat list rather than the vocabulary's families",
  ).toEqual([
    {
      group: uiCopy.store.facets.sensorFamilies.cpu,
      values: ["CPU load"],
    },
    {
      group: uiCopy.store.facets.sensorFamilies.disk,
      values: ["Disk used"],
    },
    // The key this build does not know, under no heading at all.
    { group: undefined, values: ["not.a.key"] },
  ]);
});

/**
 * The host `/api/themes/active` answers from: the two reads and the one write
 * the display choice makes, and the requests it received.
 *
 * **The client under it is the real one over a stubbed transport.** A hand-made
 * client would be a second implementation of `assign` and `listDisplays`, and
 * what these cases are about is the path the store depends on — the body on the
 * wire, and the words the host sends back — rather than the shape of a stub.
 */
interface ActiveThemeHost {
  /** What `GET /api/themes/active` answers. */
  answer: {
    readonly default: string | null;
    readonly displays: readonly ThemedDisplay[];
  };
  /** What the read answers with instead, when the host refuses it. */
  readRefusal: { readonly status: number; readonly body: string } | undefined;
  /** What the write answers with, when the host refuses it. */
  writeRefusal: { readonly status: number; readonly body: string } | undefined;
  /** Every `PUT` body the host received, in order. */
  readonly writes: { readonly display?: unknown; readonly id?: unknown }[];
  /** How many times the display list was read. **The surface's claim that it
   *  keeps no list is exactly that this grows once per opening.** */
  reads: number;
}

function hostServing(
  overrides: Partial<ActiveThemeHost> = {},
): ActiveThemeHost {
  return {
    answer: { default: null, displays: [] },
    readRefusal: undefined,
    writeRefusal: undefined,
    writes: [],
    reads: 0,
    ...overrides,
  };
}

/** The store's own client over that host, and the listing it serves. */
function clientOver(
  host: ActiveThemeHost,
  themes: readonly ThemeLibraryEntry[],
): ThemeLibraryClient {
  return createThemeLibraryClient({
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/themes") {
        return new Response(JSON.stringify({ themes }), { status: 200 });
      }
      if (url !== "/api/themes/active") {
        return new Response("Not found", { status: 404 });
      }
      if (init?.method === "PUT") {
        host.writes.push(
          JSON.parse(String(init.body)) as {
            readonly display?: unknown;
            readonly id?: unknown;
          },
        );
        const refusal = host.writeRefusal;
        return refusal === undefined
          ? new Response(JSON.stringify({ ok: true }), { status: 200 })
          : new Response(refusal.body, { status: refusal.status });
      }
      host.reads += 1;
      const refusal = host.readRefusal;
      return refusal === undefined
        ? new Response(JSON.stringify(host.answer), { status: 200 })
        : new Response(refusal.body, { status: refusal.status });
    }) as unknown as typeof fetch,
  });
}

/** One theme, mounted over a host that answers the display routes. */
async function mountOver(host: ActiveThemeHost): Promise<void> {
  await mount(
    <StoreModeRegion
      mode="themes"
      client={clientOver(host, [
        fixtureEntry({
          id: "living-room",
          name: "Living room",
          ground: DARK_GROUND,
        }),
      ])}
    />,
  );
}

/**
 * The display choice, read through its status node: it is mounted whether or not
 * it says anything (`assign-display.tsx`), so its presence is the choice's.
 */
function assignIsOpen(): boolean {
  return (
    document.body.querySelector("[data-vigilia-store-assign-status]") !== null
  );
}

/** What the choice is saying, in the host's own words. */
function assignStatus(): string {
  return (
    must(
      document.body.querySelector<HTMLElement>(
        "[data-vigilia-store-assign-status]",
      ),
      "the display choice",
    ).textContent?.trim() ?? ""
  );
}

/** Opens one theme's display choice from its cell. */
async function openAssign(themeId: string): Promise<void> {
  await pressCell(themeId, "assign");
}

/** The choice's own select, which is drawn only once a read has arrived. */
function assignSelect(): HTMLButtonElement {
  return must(
    document.body.querySelector<HTMLButtonElement>(
      "[data-vigilia-store-assign-display]",
    ),
    "the display select",
  );
}

/** What the choice's select reports as its value. */
function assignValue(): string {
  return (
    must(
      assignSelect().querySelector<HTMLElement>("[data-vigilia-value]"),
      "the display select's value",
    ).getAttribute("data-vigilia-value") ?? ""
  );
}

/** The choice's own way out, pressed: the dialog's close control, which is the
 *  one route out of a modal that needs no Escape key (`dialog.tsx`). */
async function closeAssign(): Promise<void> {
  await act(async () =>
    must(
      document.body.querySelector<HTMLButtonElement>(
        ".editor-shell-dialog-close",
      ),
      "the display choice's close control",
    ).click(),
  );
}

/** Opens the choice's own select, which is how a display is reached. */
async function openDisplays(): Promise<void> {
  await act(async () => assignSelect().click());
}

/** Opens the choice and answers the displays it offers, as the ids it would
 *  send — not the words beside them. */
async function offeredDisplays(): Promise<readonly string[]> {
  await openDisplays();
  return Array.from(
    document.body.querySelectorAll<HTMLElement>("[data-vigilia-option]"),
  ).map((option) => option.getAttribute("data-vigilia-option") ?? "");
}

/** Presses one display inside the select that is open. **Base UI commits a list
 *  item only when the press that precedes the click started on it**, so the
 *  press is part of the interaction rather than a detail of the driver. */
async function chooseDisplay(value: string): Promise<void> {
  const option = must(
    document.body.querySelector<HTMLElement>(
      `[data-vigilia-option="${value}"]`,
    ),
    `the ${value} display`,
  );
  await act(async () =>
    option.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        pointerType: "mouse",
        button: 0,
      }),
    ),
  );
  await act(async () =>
    option.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }),
    ),
  );
}

/** A host holding the two displays the cases below choose between. */
function twoDisplays(): ActiveThemeHost {
  return hostServing({
    answer: {
      default: null,
      displays: [
        { id: "this-pc", label: "This PC", theme: null },
        { id: "kitchen-tablet", label: "Kitchen tablet", theme: null },
      ],
    },
  });
}

/**
 * **The cell's third action assigns the theme to the display that was chosen,
 * and to no other.** The request is the body the host reads: one `PUT` carrying
 * the chosen display's key and this theme's id, which is the whole of what the
 * act is.
 */
it("assigns the theme to the display that was chosen and to no other", async () => {
  const host = twoDisplays();
  await mountOver(host);

  await openAssign("living-room");
  await openDisplays();
  await chooseDisplay("kitchen-tablet");

  expect(
    host.writes,
    "the choice did not assign this theme to the display that was chosen, or assigned more than once",
  ).toEqual([{ display: "kitchen-tablet", id: "living-room" }]);
  expect(
    assignIsOpen(),
    "the choice stayed open after the assignment it made",
  ).toBe(false);
});

/**
 * **The default is offered beside the displays, never as one of them.** It is
 * the key a display holding no choice of its own falls to — `assign("default",
 * id)` is a call the host accepts — and it is not a display: a theme id is not a
 * display id, which is why the host answers it as its own field and why the
 * option is the key rather than the theme the default currently holds.
 */
it("offers the default beside the displays rather than as one of them", async () => {
  const host = hostServing({
    answer: {
      // A default that currently holds a theme: the option must still be the
      // key, because that is what `assign` takes.
      default: "porch-strip",
      displays: [
        { id: "this-pc", label: "This PC", theme: null },
        { id: "kitchen-tablet", label: "Kitchen tablet", theme: null },
      ],
    },
  });
  await mountOver(host);

  await openAssign("living-room");
  expect(
    await offeredDisplays(),
    "the choice does not offer the default first, beside the displays it was answered",
  ).toEqual(["default", "this-pc", "kitchen-tablet"]);

  await chooseDisplay("default");
  expect(host.writes, "the default is not the key the route accepts").toEqual([
    { display: "default", id: "living-room" },
  ]);
});

/**
 * **A refused assignment is the host's own words**, not a sentence this surface
 * wrote about them: the reason is what says *which* of the two the host would
 * not take, and a generic sentence throws that away. The choice stays where it
 * is, so another display can be tried.
 */
it("reports the host's refusal in the host's own words", async () => {
  const host = hostServing({
    answer: {
      default: null,
      displays: [
        { id: "kitchen-tablet", label: "Kitchen tablet", theme: null },
      ],
    },
    writeRefusal: { status: 404, body: "No such display." },
  });
  await mountOver(host);

  await openAssign("living-room");
  await openDisplays();
  await chooseDisplay("kitchen-tablet");

  expect(assignStatus(), "the refusal is not the message the host sent").toBe(
    "No such display.",
  );
  expect(assignIsOpen(), "a refused assignment closed the choice").toBe(true);
});

/**
 * **A failed read is not an empty list.** The two look identical on screen and
 * mean opposite things — no displays exist, against nobody having answered
 * which do — so a read that failed draws no choice at all and says what the host
 * said, rather than offering the default alone as though that were the answer.
 */
it("offers no choice at all when the read of the displays failed", async () => {
  const host = hostServing({
    readRefusal: {
      status: 403,
      body: "Settings are available on this PC only.",
    },
  });
  await mountOver(host);

  await openAssign("living-room");

  expect(
    assignStatus(),
    "a failed read is not reported as the host's own refusal",
  ).toBe("Settings are available on this PC only.");
  expect(
    document.body.querySelector("[data-vigilia-store-assign-display]"),
    "a failed read was drawn as a choice with nothing in it",
  ).toBeNull();
});

/**
 * **The list is the host's answer, read when the choice opens and kept
 * nowhere.** A list this surface held would be a second source of truth about
 * which displays exist, and it would go stale the moment one paired or left — so
 * a display that appears between two openings is offered by the second, and the
 * read happens once per opening rather than once per region.
 */
it("reads the displays each time the choice opens rather than keeping a list", async () => {
  const host = hostServing({
    answer: {
      default: null,
      displays: [{ id: "this-pc", label: "This PC", theme: null }],
    },
  });
  await mountOver(host);

  await openAssign("living-room");
  expect(await offeredDisplays()).toEqual(["default", "this-pc"]);
  await chooseDisplay("this-pc");
  expect(
    host.reads,
    "the choice read the displays more than once per opening",
  ).toBe(1);

  // The host paired a second display while the choice was closed.
  host.answer = {
    default: null,
    displays: [
      { id: "this-pc", label: "This PC", theme: null },
      { id: "kitchen-tablet", label: "Kitchen tablet", theme: null },
    ],
  };

  await openAssign("living-room");
  expect(
    await offeredDisplays(),
    "the choice offered a display list it had kept rather than the host's answer",
  ).toEqual(["default", "this-pc", "kitchen-tablet"]);
  expect(host.reads, "the second opening did not read the displays again").toBe(
    2,
  );
});

/**
 * **The value is where the theme already is**: the display whose own choice is
 * this theme. It is the one reading this control can make truthfully before a
 * choice is made, and `""` — no display holding it of its own — is not the same
 * as the default, which is a choice of this control rather than a reading of it.
 */
it("reports where the theme already is as the choice's own value", async () => {
  const host = hostServing({
    answer: {
      default: null,
      displays: [
        { id: "this-pc", label: "This PC", theme: "porch-strip" },
        { id: "kitchen-tablet", label: "Kitchen tablet", theme: "living-room" },
      ],
    },
  });
  await mountOver(host);

  await openAssign("living-room");

  expect(
    assignValue(),
    "the choice does not report the display this theme is already on",
  ).toBe("kitchen-tablet");
});

/**
 * **"Nothing holds this theme" and "this theme is the default" are two states,
 * not one rendering.** `""` is the first — the common path, every theme nothing
 * has been assigned to — and the default's own key is the second, because the
 * host's answer says every display with no choice of its own already gets this
 * theme. The host's `default` field is what tells them apart, and reading `""`
 * for both is a real answer rendered as absence.
 */
it("tells a theme no display holds apart from the theme that is the default", async () => {
  const host = hostServing({
    answer: {
      default: null,
      displays: [{ id: "this-pc", label: "This PC", theme: null }],
    },
  });
  await mountOver(host);

  await openAssign("living-room");
  expect(
    assignValue(),
    "a theme no display holds of its own did not open with nothing chosen",
  ).toBe("");

  await closeAssign();

  // The host's own answer now names this theme as the default.
  host.answer = {
    default: "living-room",
    displays: [{ id: "this-pc", label: "This PC", theme: null }],
  };
  await openAssign("living-room");
  expect(
    assignValue(),
    "the theme the host names as its default opened as though nothing held it",
  ).toBe("default");
});

/**
 * **The modal's footer assign is the same route as the cell's**, because the
 * modal draws the cell's own four actions and reports them through the one
 * callback. Two answers to "what does assign mean" is the state this case
 * exists to keep out.
 */
it("opens the same choice from the modal's own assign action", async () => {
  const host = twoDisplays();
  await mountOver(host);

  await pressCellSurface("living-room");
  await act(async () =>
    must(
      document.body.querySelector<HTMLButtonElement>(
        "[data-vigilia-store-item-action='assign']",
      ),
      "the modal's assign action",
    ).click(),
  );

  expect(
    assignIsOpen(),
    "the modal's own assign action does not open the display choice",
  ).toBe(true);
  // **The two dialogs never coexist.** Both are modal and portalled to `body`,
  // and as React siblings Base UI never nests them, so each believes it is the
  // topmost: one Escape closed both and two scrims stacked. The modal that
  // opened the choice is gone rather than sitting under it.
  expect(
    itemIsOpen(),
    "the item's own modal stayed open under the display choice",
  ).toBe(false);
  expect(
    document.body.querySelectorAll(".editor-shell-dialog-overlay").length,
    "two dialog scrims are stacked over the region",
  ).toBe(1);
  expect(await offeredDisplays()).toEqual([
    "default",
    "this-pc",
    "kitchen-tablet",
  ]);
});
