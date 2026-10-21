// @vitest-environment jsdom
/**
 * The item's own surface: the modal a cell opens.
 *
 * **What this file owns.** The two claims the plan makes about the modal in
 * code — that the stage is one height for every item and the theme is contained
 * in it, and that the facts are pills in groups rather than a row per fact —
 * plus the caption line, the footer's four words, and the two of the four it
 * draws disabled because no phase owns them (R164).
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
import type { ThemeOrigin } from "../theme-library-client.js";
import { uiCopy } from "../ui-copy.js";
import { DARK_GROUND, type FixtureTheme, fixtureItem } from "./item-fixture.js";
import { ItemModal } from "./item-modal.js";
import { DASHBOARD_THEME_KIND, type StoreItem } from "./local-source.js";

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
  version: "1.4.0",
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

/** The same document with **no version declared**, which is a fact about the
 *  theme rather than a missing reading: the caption must draw its date alone
 *  rather than a separator with nothing before it (R128). */
const VERSIONLESS: FixtureTheme = {
  id: "kitchen-strip",
  name: "Kitchen strip",
  author: "huyng",
  ground: DARK_GROUND,
};

function modal(theme: FixtureTheme): ReactElement {
  return modalFor(fixtureItem(theme));
}

/** The same surface over an item built here rather than from a fixture theme —
 *  the origin record has no document behind it to derive. */
function modalFor(item: StoreItem): ReactElement {
  return <ItemModal item={item} onClose={() => {}} onAction={() => {}} />;
}

/** Where a theme came from, as the host records it: the catalogue item and the
 *  version this copy was installed from. */
const ORIGIN: ThemeOrigin = {
  catalogueId: "vigilia/office-wall",
  version: "1.3.0",
  installedAt: "2026-10-14T00:00:00.000Z",
};

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

/** The modal's own box, which is the width `DESIGN.md` fixes at 960. */
function box(): HTMLElement {
  return must(
    document.body.querySelector<HTMLElement>("[data-vigilia-store-item]"),
    "modal box",
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
 *
 * **The two numbers are pinned, not the shape of a class.** `DESIGN.md` says
 * the modal is 960px and its stage 420px because the drawing fixes them, and a
 * case that accepted `h-<any>px` would pass a 100px stage — the fix round's own
 * finding. The measured boxes are asserted in the browser case beside this one.
 */
it("contains the theme in a fixed stage rather than sizing to its ratio", async () => {
  await mount(modal(LANDSCAPE));
  const landscape = {
    box: box().className,
    stage: stage().className,
    ratio: picture().style.aspectRatio,
  };

  await mount(modal(PORTRAIT));
  const portrait = {
    box: box().className,
    stage: stage().className,
    ratio: picture().style.aspectRatio,
  };

  expect(
    landscape.stage,
    "the stage is not a fixed height, so it would follow the theme",
  ).toBe(portrait.stage);
  expect(
    landscape.stage,
    "the stage is not the 420px DESIGN.md fixes",
  ).toContain("h-[420px]");
  expect(landscape.box, "the modal is not the 960px DESIGN.md fixes").toContain(
    "w-[960px]",
  );
  expect(landscape.box, "the modal box moves with the item").toBe(portrait.box);
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
 * The caption is one line — the name, the author, the kind, the version and the
 * change date — and the actions are written in words, in the drawing's own
 * order.
 *
 * The kind is a badge rather than a title bar's word: what a kind is called is
 * `uiCopy.store.cell.kinds`, and a kind this build does not know prints its own
 * identifier rather than a name nobody chose. The version and the date are one
 * reading pair, `1.4.0 · 2026-10-14`, with the separator between them.
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
    "the caption does not pair the version with the date",
  ).toBe(`1.4.0${uiCopy.store.readingSeparator}2026-10-14`);

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

/**
 * **The footer draws the four and only two of them run** (R164).
 *
 * Delete and Export package are drawn because the drawing draws them, and no
 * task in this plan and no phase in the spec's landing order owns either — so
 * they are disabled with their reason rather than answering a press with
 * nothing. Every button is read through `must`, because a case that passed by
 * finding nothing would prove nothing, and the two that run are pressed in the
 * same pass: the disabled pair's silence is then a reading rather than a harness
 * that never fired.
 */
it("runs the footer's two actions and disables the two it has not", async () => {
  const ran: string[] = [];
  await mount(
    <ItemModal
      item={fixtureItem(LANDSCAPE)}
      onClose={() => {}}
      onAction={(action) => ran.push(action)}
    />,
  );

  /** One of the footer's four actions, or a failure naming which is missing. */
  function actionButton(action: string): HTMLButtonElement {
    return must(
      document.body.querySelector<HTMLButtonElement>(
        `[data-vigilia-store-item-action="${action}"]`,
      ),
      `${action} footer action`,
    );
  }

  for (const action of ["delete", "export", "assign", "open"] as const) {
    await act(async () => actionButton(action).click());
  }

  expect(
    ran,
    "the two actions this build runs did not both report, so the disabled pair's silence would prove nothing",
  ).toEqual(["assign", "open"]);

  // The pair that does not run: `disabled` is what makes a button unpressable,
  // read off the control rather than inferred from a click that changed nothing,
  // and the reason is a node in the tree rather than a tooltip.
  for (const action of ["delete", "export"] as const) {
    const button = actionButton(action);
    expect(button.disabled, `${action} is drawn live`).toBe(true);
    const describedBy = button.getAttribute("aria-describedby") ?? "";
    expect(describedBy, `${action} states no reason`).not.toBe("");
    expect(
      must(
        document.body.querySelector<HTMLElement>(`#${describedBy}`),
        `${action}'s reason`,
      ).textContent,
      `${action}'s reason is not the copy table's`,
    ).toBe(uiCopy.store.cell.unavailable);
  }
});

/**
 * **A theme with no version draws no separator and no empty slot** (R128): the
 * pair is drawn where both readings exist, and a document that declares none
 * says its date alone rather than ` · 2026-10-14` or `0.0.0`.
 */
it("draws no version and no separator for a theme that declares none", async () => {
  await mount(modal(VERSIONLESS));

  expect(
    document.body
      .querySelector("[data-vigilia-store-item-date]")
      ?.textContent?.trim(),
    "a versionless theme draws a separator or an invented version",
  ).toBe("2026-10-14");
});

/**
 * **The modal says where the item came from**, which is the one thing a cell's
 * badge cannot (spec, "Provenance": *a cell can say Installed and cannot say
 * installed from where*). The two facts are the record's own strings — the
 * catalogue item's id and the version this copy was installed from — and they
 * are pills in a group like every other fact here.
 *
 * **A theme the host has no record for draws no group at all**, which is what
 * `PillGroup` already refuses to render over an empty list: an eyebrow over
 * nothing is a word that says nothing (§9).
 */
it("names the catalogue item and the installed version, and draws no group without one", async () => {
  await mount(modalFor({ ...fixtureItem(LANDSCAPE), origin: ORIGIN }));

  const origin = group("origin");
  expect(origin.name, "the origin pills sit under no eyebrow").toBe(
    uiCopy.store.pillGroups.origin,
  );
  expect(
    origin.pills,
    "the modal does not name the catalogue item and the version installed",
  ).toEqual([ORIGIN.catalogueId, ORIGIN.version]);

  await mount(modal(LANDSCAPE));
  expect(
    document.body.querySelector('[data-vigilia-store-item-group="origin"]'),
    "the modal drew an origin group for a theme with no origin",
  ).toBeNull();
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
