// @vitest-environment jsdom
/**
 * The item's own surface: the modal a cell opens.
 *
 * **What this file owns.** The two claims the plan makes about the modal in
 * code — that the stage is one height for every item and the theme is contained
 * in it, and that the facts are pills in groups rather than a row per fact —
 * plus the caption line and the footer's four words.
 *
 * **What it deliberately does not measure.** jsdom lays nothing out, so the
 * fixed stage is read off the declaration that fixes it and the picture's ratio
 * off the style the item gives it; that two items of different ratios really
 * draw the same stage height is the browser case's (`tests/e2e/editor-rail.spec.ts`),
 * which measures both. The empty states and the page a close returns to are the
 * region's, and live in `region.dom.test.tsx` — the same placement correction
 * A.4's review made for the facet predicate, which the plan had put in the
 * gallery's file.
 */
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, expect, it } from "vitest";
import { uiCopy } from "../ui-copy.js";
import { DARK_GROUND, type FixtureTheme, fixtureItem } from "./item-fixture.js";
import { ItemModal } from "./item-modal.js";
import { DASHBOARD_THEME_KIND } from "./local-source.js";

// Base UI's dialog needs three browser APIs jsdom has none of: floating-ui
// observes its anchor, the popup waits for its own open transition, and it asks
// the selector engine for `:modal`/`:popover-open`, which jsdom parses slowly
// enough (about 0.5s a call) to dominate the file.
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
} as never;
Element.prototype.getAnimations ??= (): never[] => [];
window.PointerEvent ??= MouseEvent as never;

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

/** The mounted surface and its host, taken down together: the popup is portalled
 *  to `body`, so a root left mounted would leave a second modal in the tree for
 *  the next read to find. */
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
  if (found === null) throw new Error(`the item modal rendered no ${what}`);
  return found;
}

/**
 * The record comes from the fixture's own `facetRecordOf` derivation rather than
 * from a hand-written descriptor, which is the trap A.4a's review found: a
 * hand-written `{label: "CPU", family: "system"}` answers something the host
 * never would, and the pill's own word is what this file is reading.
 */
const LANDSCAPE: FixtureTheme = {
  id: "kitchen-strip",
  name: "Kitchen strip",
  author: "huyng",
  ground: DARK_GROUND,
  bindings: {
    "cpu-label": [{ id: "cpu", semanticKey: "cpu.load" }],
    "disk-label": [{ id: "disk", semanticKey: "disk.used" }],
  },
};

/** A second theme at the other orientation, for the one-height claim. */
const PORTRAIT: FixtureTheme = {
  id: "hall-totem",
  name: "Hall totem",
  ground: DARK_GROUND,
  width: 1080,
  height: 1920,
};

function modal(theme: FixtureTheme): ReactElement {
  return (
    <ItemModal
      item={fixtureItem(theme)}
      onClose={() => {}}
      onAction={() => {}}
    />
  );
}

/** The stage and the picture inside it, from the portalled popup. */
function stage(): HTMLElement {
  return must(
    document.body.querySelector<HTMLElement>("[data-vigilia-store-item-stage]"),
    "stage",
  );
}

function picture(): HTMLElement {
  return must(
    document.body.querySelector<HTMLElement>(
      "[data-vigilia-store-item-picture]",
    ),
    "picture",
  );
}

/** One group's eyebrow and its pills, as the words a reader sees. */
function group(id: string): {
  readonly name: string | undefined;
  readonly pills: readonly (string | undefined)[];
} {
  const found = must(
    document.body.querySelector<HTMLElement>(
      `[data-vigilia-store-item-group="${id}"]`,
    ),
    `${id} group`,
  );
  return {
    name: found
      .querySelector("[data-vigilia-store-item-group-name]")
      ?.textContent?.trim(),
    pills: Array.from(
      found.querySelectorAll("[data-vigilia-store-item-pill]"),
    ).map((pill) => pill.textContent?.trim()),
  };
}

/**
 * The stage is one height whatever is in it, and the theme is contained in that
 * height rather than the stage being sized to the theme.
 *
 * **A stage sized to the item would make the modal change height as a person
 * steps between items**, which is the one thing a viewer must not do. jsdom
 * lays nothing out, so what is read is the pair of declarations that make it
 * true: the stage carries the same fixed height for both items and no ratio of
 * its own, and the ratio is the picture's. That the two really draw the same
 * height is measured in the browser.
 */
it("contains the theme in a fixed stage rather than sizing to its ratio", async () => {
  await mount(modal(LANDSCAPE));
  const landscape = {
    stage: stage().className,
    ratio: picture().style.aspectRatio,
  };

  await mount(modal(PORTRAIT));
  const portrait = {
    stage: stage().className,
    ratio: picture().style.aspectRatio,
  };

  expect(
    landscape.stage,
    "the stage is not a fixed height, so it would follow the theme",
  ).toBe(portrait.stage);
  expect(landscape.stage, "the stage carries no fixed height at all").toMatch(
    /\bh-\[\d+px\]/,
  );
  expect(
    [landscape.ratio, portrait.ratio],
    "the picture does not carry the theme's own ratio",
  ).toEqual(["1920 / 1080", "1080 / 1920"]);
});

/**
 * The facts are pills in the groups the facets offer them in, and each pill is
 * the record's own reading: a sensor by the descriptor's `label` rather than by
 * its `semanticKey`, and a shape by its own words.
 *
 * The group names are the drawing's — Reads and Shape — and not the facet row's
 * (Sensors, Colour mode): the row names what a filter narrows by, and the modal
 * names what the theme reads and how it is shaped.
 */
it("draws the facts as pills in their groups rather than a row per fact", async () => {
  await mount(modal(LANDSCAPE));

  const reads = group("reads");
  expect(reads.name, "the sensor pills sit under no eyebrow").toBe(
    uiCopy.store.pillGroups.reads,
  );
  expect(
    reads.pills,
    "a sensor pill is not labelled by the descriptor's own label",
  ).toEqual(["CPU load", "Disk used"]);

  const shape = group("shape");
  expect(shape.name, "the shape pills sit under no eyebrow").toBe(
    uiCopy.store.pillGroups.shape,
  );
  expect(
    shape.pills,
    "the shape pills are not the record's own readings",
  ).toEqual([
    uiCopy.store.colourModes.dark,
    uiCopy.store.orientations.landscape,
    "16:9",
    "1920×1080",
  ]);
});

/**
 * The caption is one line — the name, the author, the kind and the change date
 * — and the actions are written in words, in the drawing's own order.
 *
 * The kind is a badge rather than a title bar's word: what a kind is called is
 * `uiCopy.store.cell.kinds`, and a kind this build does not know prints its own
 * identifier rather than a name nobody chose.
 */
it("names the item on one caption line and writes its actions in words", async () => {
  await mount(modal(LANDSCAPE));

  expect(
    document.body
      .querySelector("[data-vigilia-store-item-name]")
      ?.textContent?.trim(),
    "the caption does not name the item",
  ).toBe("Kitchen strip");
  expect(
    document.body
      .querySelector("[data-vigilia-store-item-kind]")
      ?.textContent?.trim(),
    "the caption does not say what kind of thing this is",
  ).toBe(uiCopy.store.cell.kinds[DASHBOARD_THEME_KIND]);
  expect(
    document.body
      .querySelector("[data-vigilia-store-item-date]")
      ?.textContent?.trim(),
    "the caption does not say when the item changed",
  ).toBe("2026-10-14");

  const actions = Array.from(
    document.body.querySelectorAll<HTMLElement>(
      "[data-vigilia-store-item-action]",
    ),
  );
  expect(
    actions.map((action) => action.textContent?.trim()),
    "the actions are not written in the drawing's own order",
  ).toEqual([
    uiCopy.store.cell.actions.delete,
    uiCopy.store.cell.actions.export,
    uiCopy.store.cell.actions.assign,
    uiCopy.store.cell.actions.open,
  ]);
});

/** The way out is the modal's own answer rather than a state it keeps: the
 *  surface is mounted by whoever holds the item, and closing it is theirs. */
it("reports its own close rather than closing itself", async () => {
  const closed: number[] = [];
  await mount(
    <ItemModal
      item={fixtureItem(LANDSCAPE)}
      onClose={() => closed.push(1)}
      onAction={() => {}}
    />,
  );

  await act(async () =>
    must(
      document.body.querySelector<HTMLButtonElement>(
        "[data-vigilia-store-item-close]",
      ),
      "close control",
    ).click(),
  );

  expect(closed, "the close control does not report a close").toHaveLength(1);
});
