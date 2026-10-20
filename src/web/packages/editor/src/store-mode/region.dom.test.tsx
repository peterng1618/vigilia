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
import type {
  ThemeLibraryClient,
  ThemeLibraryEntry,
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
 *  reads `list()` and none of the library's other four members. */
function clientListing(
  entries: readonly ThemeLibraryEntry[],
): ThemeLibraryClient {
  return {
    list: async () => entries,
    open: () => Promise.reject(new Error("the store does not open a document")),
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

/** The region over one listing. */
async function mountStore(
  entries: readonly ThemeLibraryEntry[],
): Promise<HTMLElement> {
  return mount(
    <StoreModeRegion mode="themes" client={clientListing(entries)} />,
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
 */
async function openFacet(
  facetId: string,
  name: string,
): Promise<{
  readonly hint: string | undefined;
  readonly runs: readonly FacetRun[];
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

  const runs: { group: string | undefined; values: string[] }[] = [];
  for (const row of popup.querySelectorAll<HTMLElement>(
    "[data-vigilia-facet-option]",
  )) {
    const owner = row.parentElement?.closest("[data-vigilia-facet-group]");
    const group = owner?.getAttribute("data-vigilia-facet-group") ?? undefined;
    const value =
      row
        .querySelector("[data-vigilia-facet-option-name]")
        ?.textContent?.trim() ?? "";
    const last = runs.at(-1);
    if (last !== undefined && last.group === group) last.values.push(value);
    else runs.push({ group, values: [value] });
  }

  return {
    hint:
      popup.querySelector("[data-vigilia-facet-hint]")?.textContent?.trim() ??
      undefined,
    runs,
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
 * The region lists the items and opens one as its own surface.
 *
 * The gallery is the wiring's visible half: before this task the region's body
 * was empty, so a cell drawn at all is the source reaching the grid — and the
 * cell's `open` action is the one action this phase handles, which is what puts
 * the item's own modal on screen.
 */
it("lists the items and opens one as its own surface", async () => {
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

  await pressCell("porch-strip", "open");

  expect(
    document.body
      .querySelector("[data-vigilia-store-item-name]")
      ?.textContent?.trim(),
    "the cell's open action did not open the item's own surface",
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
  await pressCell(opened, "open");
  await act(async () =>
    must(
      document.body.querySelector<HTMLButtonElement>(
        "[data-vigilia-store-item-close]",
      ),
      "close control",
    ).click(),
  );

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
