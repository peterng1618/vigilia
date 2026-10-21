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
import { DASHBOARD_THEME_KIND } from "@vigilia/renderer-core";
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import type { ThemeOrigin } from "../theme-library-client.js";
import { uiCopy } from "../ui-copy.js";
import type { InstallControl } from "./install-item.js";
import { DARK_GROUND, type FixtureTheme, fixtureItem } from "./item-fixture.js";
import { ItemModal } from "./item-modal.js";
import type { CatalogueFacts, StoreItem } from "./local-source.js";

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
 *  the origin record has no document behind it to derive.
 *
 *  `vocabulary` is the listing's own reading and the region builds it
 *  (`settledTags`), so the default here is the empty one a fixture with no tags
 *  is read against; the style case below hands the set it is about. */
function modalFor(
  item: StoreItem,
  vocabulary: readonly string[] = [],
  install: InstallControl = NO_INSTALL,
): ReactElement {
  return (
    <ItemModal
      item={item}
      vocabulary={vocabulary}
      onClose={() => {}}
      onAction={() => {}}
      install={install}
    />
  );
}

/** The install control a case that is not about installing hands down. A press
 *  is in flight for nobody, and nothing was refused. */
const NO_INSTALL: InstallControl = {
  onInstall: () => undefined,
  installingIds: new Set(),
  refusal: undefined,
};

/** Where a theme came from, as the host records it: the catalogue item and the
 *  version this copy was installed from. */
const ORIGIN: ThemeOrigin = {
  catalogueId: "vigilia/office-wall",
  version: "1.3.0",
  installedAt: "2026-10-14T00:00:00.000Z",
};

/** The catalogue's facts about one online item, with the field the join fills
 *  — what this PC has installed — left to each case. */
function catalogueFacts(
  overrides: Partial<CatalogueFacts> = {},
): CatalogueFacts {
  return {
    id: "kitchen-strip",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-14T00:00:00.000Z",
    downloads: 1204,
    favorites: 38,
    packageUrl: "https://example.invalid/kitchen-strip.vtheme",
    installedVersion: undefined,
    ...overrides,
  };
}

/** An online item: the same library record with the catalogue's facts attached,
 *  which is the only thing that separates the two halves' modals. */
function onlineItem(overrides: Partial<CatalogueFacts> = {}): StoreItem {
  return fixtureItem(LANDSCAPE, catalogueFacts(overrides));
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

/** The modal's own box, which is the width `DESIGN.md` fixes at 960. */
function box(): HTMLElement {
  return must(
    document.body.querySelector<HTMLElement>("[data-vigilia-store-item]"),
    "modal box",
  );
}

/** What the eye reads: the node's text with every `sr-only` noun removed. */
function visibleText(node: Element): string {
  const copy = node.cloneNode(true) as Element;
  for (const hidden of copy.querySelectorAll(".sr-only")) hidden.remove();
  return copy.textContent?.trim() ?? "";
}

/** The reading a screen reader hears: the node's whole text, whitespace runs
 *  collapsed, so a missing figure–noun space cannot be trimmed away. */
function spokenText(node: Element): string {
  return (node.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** The caption's right-hand end: the version, the date, and the catalogue's
 *  counts where the item has them. */
function caption(): HTMLElement {
  return must(
    document.body.querySelector<HTMLElement>("[data-vigilia-store-item-date]"),
    "caption date line",
  );
}

function dateLine(): string {
  return visibleText(caption());
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

/** One pill's class list, by the id it is drawn with — the only way to read a
 *  treatment, since jsdom lays nothing out. */
function pillClass(id: string): string {
  return must(
    document.body.querySelector<HTMLElement>(
      `[data-vigilia-store-item-pill="${id}"]`,
    ),
    `the ${id} pill`,
  ).className;
}

/**
 * **The third group the spec names, and the pill that says its word is new**
 * (spec, "The facts are pills, not rows": *a style pill one tag, with a proposed
 * tag saying so on its own pill rather than being indistinguishable from a
 * settled one*).
 *
 * The vocabulary is the listing's and arrives as a prop, so this case hands the
 * set it is about rather than deriving one: what the modal owns is reading a tag
 * against it. Both halves of the drawing's mark are read — the words
 * (`<tag> · proposed`) and the dashed edge — because either alone would pass a
 * pill that was indistinguishable from a settled one in the other respect.
 */
it("draws the Style group, and marks the tag the vocabulary does not hold", async () => {
  const tagged: FixtureTheme = {
    ...LANDSCAPE,
    id: "tagged",
    tags: ["retro", "retro-diner"],
  };
  await mount(modalFor(fixtureItem(tagged), ["retro"]));

  const style = group("style");
  expect(style.name, "the style pills sit under no eyebrow").toBe(
    uiCopy.store.pillGroups.style,
  );
  expect(
    style.pills,
    "the style pills are not the document's own tags, with the proposed one marked",
  ).toEqual(["retro", uiCopy.panels.tagsProposed("retro-diner")]);

  expect(
    pillClass("retro"),
    "a tag the vocabulary holds is drawn as a proposed one",
  ).not.toContain("border-dashed");
  expect(
    pillClass("retro-diner"),
    "a tag the vocabulary does not hold is drawn as a settled one",
  ).toContain("border-dashed");

  // The drawing's `font:500` belongs to the pill's own box, not to the mark, so
  // both pills carry it: a settled pill and a proposed one differ in edge and
  // colour, and in nothing else (`store-detail.html`).
  for (const id of ["retro", "retro-diner"]) {
    expect(pillClass(id), `${id}: not the drawing's weight`).toContain(
      "font-medium",
    );
  }
});

/**
 * **A theme that declares no tag draws no Style group**, which is the rule the
 * group's heading shares with the Reads group: a heading over nothing is a word
 * that says nothing (§9), and every theme in the library was untagged before the
 * format carried the field.
 */
it("draws no Style group for a theme that declares no tags", async () => {
  await mount(modal(LANDSCAPE));

  expect(
    document.body.querySelector('[data-vigilia-store-item-group="style"]'),
    "a theme with no tags draws a Style heading over nothing",
  ).toBeNull();
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
      vocabulary={[]}
      onClose={() => {}}
      onAction={(action) => ran.push(action)}
      install={NO_INSTALL}
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
 * badge cannot (spec, "Provenance": *a cell can say From the store and cannot
 * say from where*). It is one muted line under the band rather than a group of
 * pills, and it names the catalogue item and the version this copy was installed
 * from — the record's own strings, not the caption's document version.
 *
 * **A theme the host has no record for draws no line at all**, and the line
 * carries the origin clause alone: *Shows on …* is an assignment fact no item
 * carries yet.
 */
it("names the catalogue item and the installed version on one line, and draws none without one", async () => {
  await mount(modalFor({ ...fixtureItem(LANDSCAPE), origin: ORIGIN }));

  const line = must(
    document.body.querySelector<HTMLElement>(
      "[data-vigilia-store-item-origin]",
    ),
    "provenance line",
  );
  expect(
    line.textContent,
    "the line does not name the catalogue item and the version installed",
  ).toBe(
    [uiCopy.store.fromStore, ORIGIN.catalogueId, ORIGIN.version].join(
      uiCopy.store.readingSeparator,
    ),
  );

  await mount(modal(LANDSCAPE));
  expect(
    document.body.querySelector("[data-vigilia-store-item-origin]"),
    "the modal drew a provenance line for a theme with no origin",
  ).toBeNull();
});

/** The way out is the modal's own answer rather than a state it keeps: the
 *  surface is mounted by whoever holds the item, and closing it is theirs. */
it("reports its own close rather than closing itself", async () => {
  const closed: number[] = [];
  await mount(
    <ItemModal
      item={fixtureItem(LANDSCAPE)}
      vocabulary={[]}
      onClose={() => closed.push(1)}
      onAction={() => {}}
      install={NO_INSTALL}
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

/**
 * **The catalogue's counts are facts about the item rather than about a facet**,
 * so they join the caption's right-hand end — the drawing's `1.4.0 · 2026-10-14`
 * plus the cell's two numbers — rather than taking a row or a pill group of
 * their own (`store-browse.html:126-128`). `1,204` rather than `1204` is the
 * formatter's, and both are counted against the literal because the separator
 * alone would pass either.
 *
 * **A library item draws neither count**: it has no catalogue to read them off,
 * which is the guard this case's second half holds.
 */
it("joins the catalogue's counts to the caption's right-hand end", async () => {
  const separator = uiCopy.store.readingSeparator;

  await mount(modalFor(onlineItem()));
  expect(
    dateLine(),
    "an online item does not draw the catalogue's two counts beside its version and date",
  ).toBe(["1.4.0", "2026-10-14", "1,204", "38"].join(separator));

  // The figure is visible and its noun is read — see `uiCopy.store.counts` —
  // so the composed reading is figure, one space, noun.
  expect(
    spokenText(caption()),
    "the caption's composed reading is not each figure, a space, and its noun",
  ).toBe(
    [
      "1.4.0",
      "2026-10-14",
      `1,204 ${uiCopy.store.counts.downloads(1204)}`,
      `38 ${uiCopy.store.counts.favorites(38)}`,
    ].join(separator),
  );

  await mount(modalFor(fixtureItem(LANDSCAPE)));
  expect(
    dateLine(),
    "a library item drew counts it has no catalogue to read",
  ).toBe(["1.4.0", "2026-10-14"].join(separator));
  expect(spokenText(caption()), "a library item drew a count's noun").toBe(
    ["1.4.0", "2026-10-14"].join(separator),
  );
});

/**
 * **The online footer carries the same install reading the cell does** — the
 * drawing's *Install*, *Installed* or *Update* in place of the library's four
 * actions (`store-detail.html:42`).
 *
 * Installed is a **mark**, not a control, because there is nothing to do; the
 * check carries the rationed accent and the word stays `--muted`, exactly as
 * the cell draws it (`store-browse.html:128-131`). Install and Update are
 * controls that report the item they press, and the region owns what that
 * press does.
 */
it("carries the cell's install reading in the footer instead of the library's four", async () => {
  const onInstall = vi.fn();
  const cases = [
    { state: "installed", catalogue: { installedVersion: "1.4.0" } },
    { state: "install", catalogue: {} },
    { state: "update", catalogue: { installedVersion: "1.3.0" } },
  ] as const;

  let pressed = 0;
  for (const sample of cases) {
    await mount(
      modalFor(onlineItem(sample.catalogue), [], { ...NO_INSTALL, onInstall }),
    );
    const word = uiCopy.store.cell.installStates[sample.state];

    expect(
      document.body.querySelector("[data-vigilia-store-item-action]"),
      `${sample.state}: the library's four actions are drawn beside the catalogue's reading`,
    ).toBeNull();

    const reading = must(
      document.body.querySelector<HTMLElement>(
        `[data-vigilia-store-item-install="${sample.state}"]`,
      ),
      `${sample.state} reading`,
    );
    expect(
      reading.textContent,
      `${sample.state}: the footer is not the copy table's word`,
    ).toBe(word);

    if (sample.state === "installed") {
      expect(reading.tagName, "the installed state drew a control").toBe(
        "SPAN",
      );
      expect(
        reading.className,
        "the mark's word is not drawn in the drawing's muted colour",
      ).toContain("text-muted");
      expect(
        must(
          reading.querySelector<HTMLElement>("span.text-accent"),
          "the check's accent colour",
        ).textContent,
        "the accent is not on the check alone",
      ).toBe("");
      expect(
        reading.querySelector("button"),
        "the installed state drew a button it has no action for",
      ).toBeNull();
      continue;
    }

    const button = must(
      document.body.querySelector<HTMLButtonElement>(
        `[data-vigilia-store-item-install="${sample.state}"]`,
      ),
      `${sample.state} action`,
    );
    expect(button.disabled, `${word} is drawn dead`).toBe(false);
    await act(async () => button.click());
    pressed += 1;
  }

  expect(
    onInstall.mock.calls.map(([itemPressed]) => itemPressed.id),
    "the two controls did not report the item that was pressed",
  ).toEqual(Array.from({ length: pressed }, () => "kitchen-strip"));
});

/**
 * **A press in flight disables the footer's control**, and a refusal is the
 * host's own sentence beside it: the person who pressed reads why it did not
 * land rather than a control that snapped back with nothing said.
 */
it("disables the footer's install in flight and states the host's refusal", async () => {
  const pressed = onlineItem();

  await mount(
    modalFor(pressed, [], {
      ...NO_INSTALL,
      installingIds: new Set([pressed.id]),
    }),
  );
  expect(
    must(
      document.body.querySelector<HTMLButtonElement>(
        '[data-vigilia-store-item-install="install"]',
      ),
      "install action",
    ).disabled,
    "an install in flight is pressable a second time",
  ).toBe(true);

  await mount(
    modalFor(pressed, [], {
      ...NO_INSTALL,
      refusal: { id: pressed.id, message: "That package is not a theme." },
    }),
  );
  expect(
    must(
      document.body.querySelector<HTMLElement>(
        "[data-vigilia-store-item-install-refusal]",
      ),
      "install refusal",
    ).textContent,
    "the footer does not state the host's own reason",
  ).toBe("That package is not a theme.");
  expect(
    must(
      document.body.querySelector<HTMLButtonElement>(
        '[data-vigilia-store-item-install="install"]',
      ),
      "install action after a refusal",
    ).disabled,
    "a refused install left the control dead",
  ).toBe(false);
});

/** **A library item's footer is untouched** — the four actions, in the
 *  drawing's order, and no catalogue reading among them. This is the half of the
 *  guard that keeps phase A's surface intact. */
it("draws no catalogue reading for a library item", async () => {
  await mount(modalFor(fixtureItem(LANDSCAPE)));

  expect(
    document.body.querySelector("[data-vigilia-store-item-install]"),
    "a library item drew a catalogue install reading",
  ).toBeNull();
  expect(
    document.body.querySelectorAll("[data-vigilia-store-item-action]"),
    "a library item lost the footer's four actions",
  ).toHaveLength(4);
});
