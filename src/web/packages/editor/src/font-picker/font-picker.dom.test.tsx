// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import {
  catalogFaces,
  type CuratedFontFace,
  fontTrios,
} from "../font-catalog.js";
import { queryFaces } from "../font-catalog-query.js";
import {
  createSpecimenCache,
  type SpecimenCache,
} from "../font-specimen-cache.js";
import { uiCopy } from "../ui-copy.js";
import { FontPicker } from "./font-picker.js";

/** A cache whose faces all arrive, so a row's specimen is decided by the
 *  component rather than by the fixture. One `Response` per face: three faces
 *  sharing one would let `arrayBuffer` be drained by the first and leave the
 *  other two rejecting, which is a fixture artefact masquerading as behaviour. */
function arrivingCache(): SpecimenCache {
  return createSpecimenCache({
    fetch: vi.fn(
      async () => new Response(new Uint8Array([0, 1, 2]), { status: 200 }),
    ),
    createFontFace: vi.fn(() => ({ load: vi.fn(async () => undefined) })),
    fonts: { add: vi.fn(), delete: vi.fn() },
  });
}

/** A cache whose fetch always 404s, which is the review-focus line: the row
 *  must survive a specimen that will never arrive. */
function missingCache(): SpecimenCache {
  return createSpecimenCache({
    fetch: vi.fn(async () => new Response(null, { status: 404 })),
    createFontFace: vi.fn(() => ({ load: vi.fn(async () => undefined) })),
    fonts: { add: vi.fn(), delete: vi.fn() },
  });
}

async function setup(
  overrides: Partial<Parameters<typeof FontPicker>[0]> = {},
): Promise<{
  host: HTMLDivElement;
  props: Parameters<typeof FontPicker>[0];
  unmount: () => void;
}> {
  const host = document.createElement("div");
  document.body.append(host);
  const props: Parameters<typeof FontPicker>[0] = {
    trios: fontTrios(),
    faces: catalogFaces(),
    favorites: [],
    cache: arrivingCache(),
    onApplyTrio: vi.fn(),
    onApplyFace: vi.fn(),
    onToggleFavorite: vi.fn(),
    ...overrides,
  };
  const root = createRoot(host);
  await act(async () => root.render(<FontPicker {...props} />));
  return { host, props, unmount: () => root.unmount() };
}

const rows = (host: HTMLElement): HTMLElement[] => [
  ...host.querySelectorAll<HTMLElement>("[data-vigilia-font-face-row]"),
];
const families = (host: HTMLElement): string[] =>
  rows(host).map((row) => row.getAttribute("data-vigilia-font-family") ?? "");

/**
 * Every row is a specimen, so a row that is not resident is a row the author
 * cannot read the family of. This is the invariant the brief's own first test
 * only gestured at by asserting one row's family attribute.
 */
it("mounts a window of rows, each naming a face the query returned", async () => {
  const { host, unmount } = await setup();
  const mounted = rows(host);
  // 15 rows against 261 faces: the window is what makes this a list rather
  // than 261 `FontFace` objects the author never scrolled to.
  expect(mounted).toHaveLength(15);
  expect(catalogFaces().length).toBeGreaterThan(mounted.length);

  const expected = queryFaces(
    { search: "", facet: undefined, favoritesFirst: false, sort: "name" },
    [],
  )
    .slice(0, 15)
    .map((face) => face.family);
  // Both directions: a row set that is merely the right size, or merely in
  // order, would pass either assertion alone.
  expect(families(host)).toEqual(expected);
  unmount();
});

/** A row whose face has arrived renders in that family; one that has not falls
 *  back to the shell's face rather than to nothing. */
it("renders a specimen row in its own family once the face is resident", async () => {
  const { host, unmount } = await setup();
  const first = rows(host)[0]!;
  const family = first.getAttribute("data-vigilia-font-family")!;
  // `inherit` before the load settles; the family itself after. Asserting the
  // family alone would pass whether or not the cache was ever consulted.
  expect(family).not.toBe("");
  await act(async () => {
    await Promise.resolve();
  });
  // Read back through the style property rather than the attribute: jsdom
  // normalises `fontFamily: Abril Fatface` to `Abril Fatface` without the
  // quotes React's `style` prop accepts, so an attribute comparison would
  // pin the serialisation rather than the fact.
  expect(first.style.fontFamily).toBe(family);
  unmount();
});

/**
 * Search narrows. `yellowtail` rather than the brief's `jetbrains`: 5 matches
 * against 261, so the count change is one no rounding could hide, and the
 * surviving rows are named rather than merely fewer.
 */
it("narrows the rows to the faces the search term reaches", async () => {
  const { host, unmount } = await setup();
  expect(rows(host).length).toBe(15);

  const search = host.querySelector<HTMLInputElement>('input[type="search"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set?.call(search, "yellowtail");
    search.dispatchEvent(new Event("input", { bubbles: true }));
  });

  expect(families(host)).toEqual([
    "Inconsolata",
    "JetBrains Mono",
    "Lato",
    "Nunito",
    "Yellowtail",
  ]);
  expect(host.textContent).toContain("Yellowtail");
  unmount();
});

/** A search that matches nothing says so, rather than showing an empty box the
 *  author has to interpret. */
it("says so when a search matches no face", async () => {
  const { host, unmount } = await setup();
  const search = host.querySelector<HTMLInputElement>('input[type="search"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set?.call(search, "zzzzz");
    search.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(rows(host)).toHaveLength(0);
  expect(host.textContent).toContain(uiCopy.panels.noFontMatches);
  unmount();
});

/**
 * One facet at a time, and the picker says so.
 *
 * `CatalogQuery.facet` holds one value, so choosing a second kind replaces the
 * first. A test that only checked "the list narrowed" would pass against a
 * component that intersected both, so this asserts the *other* select went
 * back to empty — which is what the author sees.
 */
it("clears the other two facets when one is chosen, and says the rule", async () => {
  const { host, unmount } = await setup();
  const mood = host.querySelector<HTMLSelectElement>(
    '[data-vigilia-font-facet="mood"]',
  )!;
  const useCase = host.querySelector<HTMLSelectElement>(
    '[data-vigilia-font-facet="useCase"]',
  )!;

  await act(async () => {
    mood.value = "versatile";
    mood.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(families(host)).toEqual(
    queryFaces(
      {
        search: "",
        facet: { field: "mood", value: "versatile" },
        favoritesFirst: false,
        sort: "name",
      },
      [],
    )
      .slice(0, 15)
      .map((face) => face.family),
  );

  await act(async () => {
    useCase.value = "blog";
    useCase.dispatchEvent(new Event("change", { bubbles: true }));
  });
  // The mood select is empty again — the click the author just made cleared
  // it, and a UI that kept it would be lying about the state.
  expect(mood.value).toBe("");
  expect(useCase.value).toBe("blog");
  // And the rows are the use-case set, not the 18 faces both sets share.
  expect(families(host)).toEqual([
    "Abril Fatface",
    "Bitter",
    "Bitter",
    "DM Sans",
    "DM Serif Display",
    "Fira Code",
    "Fira Sans",
    "Inconsolata",
    "JetBrains Mono",
    "Lato",
    "Lato",
    "Libre Baskerville",
    "Libre Baskerville",
    "Lora",
    "Lora",
  ]);
  expect(host.textContent).toContain(uiCopy.panels.fontFacetRule);
  unmount();
});

/** The facet selects are named by what they filter on, not by the field
 *  identifier `CatalogQuery` is keyed on — `useCase` is not a word.
 *
 *  The count and the `not.toBe(field)` assertion are what a rendered-string net
 *  cannot make on its own, and they were added after a mutation showed the
 *  limit. Hard-coding `FACET_COPY.mood` as the literal `"Mood"` — the same text
 *  `uiCopy.panels.fontFacetKinds.mood` holds — passes both this file and
 *  `ui-copy.test.ts`, because every check compares what the control *says*
 *  against the table and the two agree. That is the residual limit of a
 *  by-value net and it is not closed here; what is closed is the case that
 *  costs something, which is the rename: with the literal in place, changing
 *  the table entry to `"Feeling"` turns this red. That was measured, not
 *  assumed. The component's own map reads `uiCopy.panels.fontFacetKinds`
 *  directly rather than restating the three words, so there is no second copy
 *  for a rename to miss. */
it("names each facet select after what it filters on", async () => {
  const { host, unmount } = await setup();
  const selects = host.querySelectorAll<HTMLSelectElement>(
    "[data-vigilia-font-facet]",
  );
  // One select per kind the query offers, so a kind added to `FACET_FIELDS`
  // without a word for it is a red run here rather than an unnamed control.
  expect(selects).toHaveLength(3);
  for (const select of selects) {
    const field = select.getAttribute(
      "data-vigilia-font-facet",
    ) as keyof typeof uiCopy.panels.fontFacetKinds;
    const name = uiCopy.panels.fontFacetKinds[field];
    // Both spellings are the table's own value, read rather than restated.
    expect(select.getAttribute("aria-label")).toBe(name);
    expect(select.options[0]!.textContent).toBe(name);
    expect(name).not.toBe(field);
  }
  unmount();
});

/** A clamped face shows the weight that will actually apply, and says why it is
 *  not the one upstream asked for. */
it("marks a clamped face with the weight that will apply", async () => {
  const clamped = catalogFaces().find((face) => face.clamped === true)!;
  expect(clamped).toBeDefined();
  const { host, unmount } = await setup({
    trios: [],
    faces: [clamped],
    cache: missingCache(),
  });
  const row = rows(host)[0]!;
  expect(row.getAttribute("data-vigilia-font-family")).toBe(clamped.family);
  expect(row.getAttribute("data-vigilia-font-clamped")).toBe("true");
  expect(row.textContent).toContain(uiCopy.panels.fontClamped);
  unmount();
});

/**
 * A face whose CDN 404s keeps its row, its name and its click.
 *
 * This is the review-focus line, and it is the assertion the brief could not
 * make: `ensure` always resolves, so nothing here rejects, and a row that
 * vanished on failure would take the picker's list with it.
 */
it("keeps a row selectable when its face will never load", async () => {
  const onApplyFace = vi.fn();
  const face = catalogFaces()[0]!;
  const { host, unmount } = await setup({
    trios: [],
    faces: [face],
    cache: missingCache(),
    onApplyFace,
  });
  const row = rows(host)[0]!;
  expect(row.getAttribute("data-vigilia-font-family")).toBe(face.family);
  // Falls back to the shell's face, and says it is still coming rather than
  // naming a family it does not have.
  expect(row.style.fontFamily).toBe("inherit");

  await act(async () => {
    await Promise.resolve();
  });
  // Settled and still not resident: the row has stopped claiming to be loading
  // and has not blanked itself.
  expect(row.isConnected).toBe(true);
  expect(row.textContent).not.toContain(uiCopy.panels.loadingFont);

  await act(async () => row.click());
  expect(onApplyFace).toHaveBeenCalledWith(face);
  unmount();
});

/** A face that has not arrived says so, so a fallback name is legible as
 *  "still coming" rather than read as the face itself. */
it("says a specimen is still coming while it has not settled", async () => {
  const face = catalogFaces()[0]!;
  const host = document.createElement("div");
  document.body.append(host);
  // A cache whose `ensure` never settles, so the row is caught mid-flight.
  const cache: SpecimenCache = {
    ensure: () => new Promise<void>(() => undefined),
    resident: () => undefined,
    release: () => undefined,
  };
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <FontPicker
        trios={[]}
        faces={[face]}
        favorites={[]}
        cache={cache}
        onApplyTrio={vi.fn()}
        onApplyFace={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    ),
  );
  expect(rows(host)[0]!.textContent).toContain(uiCopy.panels.loadingFont);
  root.unmount();
});

/** A trio apply is reported, not performed: the picker holds no authority over
 *  the document, and a component that applied it here would be untestable
 *  against a real session. */
it("reports a trio apply without applying it itself", async () => {
  const onApplyTrio = vi.fn();
  const { host, unmount } = await setup({ onApplyTrio });
  const target = fontTrios()[7]!;
  const select = host.querySelector<HTMLSelectElement>(
    "[data-vigilia-font-trio]",
  )!;
  await act(async () => {
    select.value = target.id;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () => {
    host
      .querySelector<HTMLButtonElement>("[data-vigilia-font-trio-apply]")!
      .click();
  });
  expect(onApplyTrio).toHaveBeenCalledTimes(1);
  expect(onApplyTrio).toHaveBeenCalledWith(target.id);
  unmount();
});

/** The two selectors the archived plan's browser tests read, on the elements
 *  that now do those jobs. A row that carries only its own marker would leave
 *  `selectOption("[data-vigilia-font-face]")` resolving to nothing. */
it("carries the three legacy selectors on the elements that do the work", async () => {
  const { host, unmount } = await setup();
  // The face control is a row now, so it carries both names.
  const faceRow = host.querySelector("[data-vigilia-font-face-row]")!;
  expect(faceRow.hasAttribute("data-vigilia-font-face")).toBe(true);
  expect(faceRow.tagName).toBe("BUTTON");
  // Each legacy selector resolves to exactly one element, so a test reaching
  // for it cannot land on an unrelated control.
  expect(host.querySelectorAll("[data-vigilia-font-trio]")).toHaveLength(1);
  const apply = host.querySelector<HTMLButtonElement>(
    "[data-vigilia-font-trio-apply]",
  )!;
  expect(apply.hasAttribute("data-vigilia-font-apply")).toBe(true);
  unmount();
});

/** Every control the picker renders is named. Chromium is the only thing that
 *  settles whether a control is *named*, but this is the unit-level net: a
 *  control with neither text, nor an `aria-label`, nor a label pointing at it
 *  announces nothing.
 *
 *  A checkbox inside a `<label>` is named by that label, so the check has to
 *  follow the association in both directions — `<label for>` and a wrapping
 *  `<label>` — or it reports a named control as unnamed. */
it("names every control it renders", async () => {
  const { host, unmount } = await setup();
  const labelText = (element: Element): string => {
    const id = element.getAttribute("id");
    const forLabel =
      id === null ? null : host.querySelector(`label[for="${id}"]`);
    // A wrapping label names the control it contains, and its own text runs
    // past the control, so take the label's text either way.
    const wrapping = element.closest("label");
    return `${forLabel?.textContent ?? ""}${wrapping?.textContent ?? ""}`.trim();
  };
  const named = (element: Element): boolean =>
    (element.textContent ?? "").trim() !== "" ||
    element.hasAttribute("aria-label") ||
    labelText(element) !== "";
  const unnamed = [...host.querySelectorAll("button,input,select")].filter(
    (element) => !named(element),
  );
  expect(unnamed.map((element) => element.outerHTML)).toEqual([]);
  // The net has teeth: the favourites checkbox is named by its wrapping label
  // and nothing else, so drop the label and the audit goes red.
  const checkbox = host.querySelector<HTMLInputElement>(
    'input[type="checkbox"]',
  )!;
  checkbox.closest("label")!.replaceChildren(checkbox);
  expect(named(checkbox)).toBe(false);
  unmount();
});

/**
 * The favourite toggle is a named control with an icon in it, never a glyph.
 *
 * R12: a `★`/`☆` as the button's whole text is announced as a word of its own
 * and is the exact defect `ui-copy.test.ts` exists to catch. The two tests
 * below are the picker half of that net — they would both fail on the brief's
 * markup, and the second one fails even if the glyph were merely decorative.
 */
it("names the favourite toggle for the action it takes, in both states", async () => {
  const onToggleFavorite = vi.fn();
  const trio = fontTrios()[0]!;
  const { host, unmount } = await setup({
    onToggleFavorite,
    favorites: [trio.id],
  });
  const toggle = host.querySelector<HTMLButtonElement>(
    "[data-vigilia-font-favorite]",
  )!;
  expect(toggle.getAttribute("aria-pressed")).toBe("true");
  expect(toggle.getAttribute("aria-label")).toBe(uiCopy.panels.fontUnfavorite);

  await act(async () => toggle.click());
  expect(onToggleFavorite).toHaveBeenCalledWith(trio.id);

  const off = await setup({ onToggleFavorite, favorites: [] });
  const unfilled = off.host.querySelector<HTMLButtonElement>(
    "[data-vigilia-font-favorite]",
  )!;
  expect(unfilled.getAttribute("aria-pressed")).toBe("false");
  expect(unfilled.getAttribute("aria-label")).toBe(uiCopy.panels.fontFavorite);
  // Two different words, not one name for both states: a screen reader user
  // has to be able to tell what the press will do.
  expect(unfilled.getAttribute("aria-label")).not.toBe(
    toggle.getAttribute("aria-label"),
  );
  off.unmount();
  unmount();
});

/** The icon is decoration and the state is on `aria-pressed`, following the
 *  layer row's lock: filled when favourited, outline when not. */
it("draws the favourite state as a filled or outline icon, not a glyph", async () => {
  const trio = fontTrios()[0]!;
  const on = await setup({ favorites: [trio.id] });
  const filled = on.host.querySelector("[data-vigilia-font-favorite] svg")!;
  expect(filled.getAttribute("aria-hidden")).toBeTruthy();
  expect(filled.getAttribute("fill")).toBe("currentColor");
  on.unmount();

  const off = await setup({ favorites: [] });
  const outline = off.host.querySelector("[data-vigilia-font-favorite] svg")!;
  // `fill="none"` is Lucide's own default, so its absence is what says
  // "outline" — the same contract the layer row's lock uses.
  expect(outline.getAttribute("fill")).toBe("none");
  expect(outline.outerHTML).not.toMatch(/[★☆]/u);
  off.unmount();
});

/** A favourite the catalogue no longer has renders nothing. R24: the guarantee
 *  is structural — the filter runs over live trios, so a stale id is a `Set`
 *  key that matches no row rather than a chip with no target. */
it("renders no dead chip for a favourite the catalogue dropped", async () => {
  const { host, unmount } = await setup({ favorites: ["no-such-trio"] });
  const listed = host.querySelectorAll("[data-vigilia-font-trio-row]");
  expect(listed.length).toBeGreaterThan(0);
  for (const row of listed) {
    expect(row.textContent).not.toBe("no-such-trio");
  }
  expect(
    [...host.querySelectorAll("[data-vigilia-font-favorite]")].every(
      (toggle) => toggle.getAttribute("aria-pressed") === "false",
    ),
  ).toBe(true);
  unmount();
});

/** Scrolling moves the window. Asserted against the row set, not the scroll
 *  position: jsdom has no layout, so `scrollTop` is a plain number and only the
 *  rows that resulted from it are observable.
 *
 *  The expected window is derived from the same pitch the component scrolls by,
 *  read back off a rendered row rather than written out again — a test that
 *  wrote `320 * 10` and then asserted against `rows[10]` was asserting its own
 *  arithmetic twice and would not notice the two disagreeing. */
it("moves the window when the list is scrolled", async () => {
  const { host, props, unmount } = await setup();
  const scroll = host.querySelector<HTMLDivElement>(
    "[data-vigilia-font-face-row]",
  )!.parentElement!.parentElement!;
  const every = queryFaces(
    { search: "", facet: undefined, favoritesFirst: false, sort: "name" },
    [],
  );
  const before = families(host);
  expect(before).toEqual(every.slice(0, 15).map((face) => face.family));

  // jsdom has no layout, so a row measures 0 tall; the pitch is the inline
  // height the component set, which is the same number the scroll maths uses.
  const pitch = Number.parseInt(rows(host)[0]!.style.height, 10);
  expect(pitch).toBeGreaterThan(0);
  const scrolledTo = 10;
  await act(async () => {
    scroll.scrollTop = pitch * scrolledTo;
    scroll.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  const after = families(host);
  expect(after).not.toEqual(before);
  expect(after).toEqual(
    every.slice(scrolledTo, scrolledTo + 15).map((face) => face.family),
  );
  // Still a window, not the whole list.
  expect(after).toHaveLength(15);
  expect(every.length).toBeGreaterThan(15);
  expect(props.faces.length).toBe(catalogFaces().length);
  unmount();
});

/** The rows a host hands over are the rows that render. A picker that fell back
 *  to the whole catalogue would pass every test above, because the catalogue is
 *  what it was given. */
it("browses only the trios and faces it was handed", async () => {
  const one = catalogFaces().find((face) => face.family === "Yellowtail")!;
  const trio = fontTrios().find((t) => t.faces.some((f) => f.id === one.id))!;
  const { host, unmount } = await setup({ trios: [trio], faces: [one] });
  expect(families(host)).toEqual(["Yellowtail"]);
  expect(
    [...host.querySelectorAll("[data-vigilia-font-trio-row]")].map(
      (row) => row.textContent,
    ),
  ).toEqual([trio.name]);
  unmount();
});

/** A face row applies that face, by identity — the callback hands over the
 *  record the catalogue holds, not a re-read of it. */
it("reports the exact face record a row applies", async () => {
  const onApplyFace = vi.fn();
  const face = catalogFaces()[3]!;
  const { host, unmount } = await setup({
    trios: [],
    faces: [face],
    cache: missingCache(),
    onApplyFace,
  });
  await act(async () => rows(host)[0]!.click());
  expect(onApplyFace).toHaveBeenCalledWith(face);
  expect(onApplyFace.mock.calls[0]![0]).toBe(face);
  unmount();
});

/** Nothing the picker *authors* is a pictograph — the rule `ui-copy.test.ts`
 *  holds over the copy table, applied here to the strings the component writes.
 *
 *  Scoped to the controls, not every leaf: a trio's name is upstream data and
 *  reads "Archivo Bitter — Archivo + Bitter + JetBrains Mono", whose `+` is
 *  U+2B and matches `\p{S}`. Holding catalogue data to the copy rule would be
 *  holding Fonttrio's naming to it, and the first version of this test failed
 *  on exactly those 756 — which is the failure of a test that measured the
 *  wrong thing, not a defect in the picker. */
it("holds no pictograph in the controls it authors", async () => {
  const { host, unmount } = await setup();
  const authored = [
    ...host.querySelectorAll("label, [aria-label]"),
    // The trios the picker applies by name are data; the toggle that stars one
    // is a control, and the facet/sort labels are copy.
  ].map((element) =>
    element.hasAttribute("aria-label")
      ? (element.getAttribute("aria-label") ?? "")
      : (element.textContent ?? ""),
  );
  expect(authored.filter((text) => /\p{S}/u.test(text))).toEqual([]);
  // The controls' own text, which is what a `★` button would be named by.
  const buttons = [...host.querySelectorAll("button")].filter(
    (button) =>
      !button.hasAttribute("data-vigilia-font-trio-row") &&
      !button.hasAttribute("data-vigilia-font-face-row"),
  );
  expect(
    buttons
      .map((button) => (button.textContent ?? "").trim())
      .filter((text) => text !== "" && /\p{S}/u.test(text)),
  ).toEqual([]);
  unmount();
});

/** The specimen cache is asked for the window and not the list. 30 rows is the
 *  window plus a window of lookahead; the other 231 are untouched until the
 *  author scrolls to them. */
it("asks the cache for the window, not the whole list", async () => {
  const fetch = vi.fn(
    async () => new Response(new Uint8Array([0, 1, 2]), { status: 200 }),
  );
  const cache = createSpecimenCache({
    fetch,
    createFontFace: vi.fn(() => ({ load: vi.fn(async () => undefined) })),
    fonts: { add: vi.fn(), delete: vi.fn() },
  });
  const { unmount } = await setup({ cache });
  await act(async () => {
    await Promise.resolve();
  });
  // 15 rows mounted, 30 asked for. A picker that fetched all 261 would be
  // ~4 MB the author never scrolled to.
  expect(fetch.mock.calls.length).toBeGreaterThan(15);
  expect(fetch.mock.calls.length).toBeLessThanOrEqual(30);
  expect(catalogFaces().length).toBeGreaterThan(30);
  unmount();
});

/** Every specimen the cache is asked for resolves, resident or not, so the row
 *  stops saying it is loading. This is what makes a 404 legible as "this face
 *  is unavailable" rather than as a permanent spinner. */
it("settles every row it asks for, including the ones that cannot load", async () => {
  const { host, unmount } = await setup({ cache: missingCache() });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(rows(host).length).toBeGreaterThan(0);
  for (const row of rows(host)) {
    expect(row.textContent).not.toContain(uiCopy.panels.loadingFont);
    expect(row.textContent?.trim()).not.toBe("");
  }
  unmount();
});

/** Every face carries `style: "normal"`; the picker renders no italic toggle
 *  because there is no italic cut to toggle to. Asserted from the catalogue
 *  rather than from the component, so a future italic face turns this red. */
it("offers no style control, because no curated face is italic", async () => {
  const { host, unmount } = await setup();
  expect(new Set(catalogFaces().map((face) => face.style))).toEqual(
    new Set(["normal"]),
  );
  expect(host.querySelector("[data-vigilia-font-style]")).toBeNull();
  const styles = [...host.querySelectorAll("select")].flatMap((select) =>
    [...select.options].map((option) => option.value),
  );
  expect(styles).not.toContain("italic");
  unmount();
});

/** The faceted trio list honours a search, and the sort control reorders it. */
it("sorts the trio list by what the sort control says", async () => {
  const { host, unmount } = await setup();
  const names = (): (string | null)[] =>
    [...host.querySelectorAll("[data-vigilia-font-trio-row]")].map(
      (row) => row.textContent,
    );
  const byName = names();
  expect(byName.length).toBeGreaterThan(1);

  const sort = host.querySelector<HTMLSelectElement>(
    "[data-vigilia-font-sort]",
  )!;
  await act(async () => {
    sort.value = "family";
    sort.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const byFamily = names();
  expect(byFamily).not.toEqual(byName);
  expect(byFamily).toHaveLength(byName.length);
  expect(byFamily.every((name) => byName.includes(name))).toBe(true);
  unmount();
});

/** A clamped row and an unclamped row in the same list are told apart by the
 *  attribute, so a browser test can find the clamped one. Two faces, chosen so
 *  one is clamped and one is not — a single fixture could not tell the marking
 *  apart from the mere presence of a row. */
it("distinguishes a clamped row from an unclamped one in the same list", async () => {
  const clamped = catalogFaces().find((face) => face.clamped === true)!;
  const plain = catalogFaces().find((face) => face.clamped !== true)!;
  expect(clamped.id).not.toBe(plain.id);
  const { host, unmount } = await setup({
    trios: [],
    faces: [clamped, plain],
    cache: missingCache(),
  });
  const [first, second] = rows(host);
  expect(first!.getAttribute("data-vigilia-font-clamped")).toBe("true");
  expect(first!.textContent).toContain(uiCopy.panels.fontClamped);
  expect(second!.getAttribute("data-vigilia-font-clamped")).toBe("false");
  expect(second!.textContent).not.toContain(uiCopy.panels.fontClamped);
  unmount();
});

/** One face per row, so a weight the family ships twice is two choices. */
it("keeps a face per row when one family ships several weights", async () => {
  const archivo = catalogFaces().filter((face) => face.family === "Archivo");
  expect(archivo.length).toBeGreaterThan(1);
  const { host, unmount } = await setup({
    trios: [],
    faces: archivo,
    cache: missingCache(),
  });
  expect(families(host)).toEqual(archivo.map((face) => face.family));
  expect(rows(host).map((row) => row.textContent)).toEqual(
    archivo.map((face) => `${face.family}${face.weight}`),
  );
  unmount();
});

/** A face id is the row's key, so a list that re-queries keeps the DOM rather
 *  than rebuilding it — which is what would drop a focused row mid-scroll. */
it("keys a row by face id so a re-query does not rebuild it", async () => {
  const { host, unmount } = await setup();
  const search = host.querySelector<HTMLInputElement>('input[type="search"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set?.call(search, "yellowtail");
    search.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const ids = rows(host).map(
    (row) => row.getAttribute("data-vigilia-font-family") ?? "",
  );
  expect(new Set(ids).size).toBe(ids.length);
  unmount();
});

/** The cache is asked once per face, not once per render: the review-focus line
 *  is ~4 MB of fetches over a full scroll, and a cache that re-asks is a cache
 *  that cannot hold.
 *
 *  Two things this has to get right, and an earlier version got the second
 *  wrong for the right reason:
 *
 *  - The count is derived from the catalogue. Searching `yellowtail` reaches
 *    five faces and none of them is in the first thirty the window asked for,
 *    so a correct picker fetches 35, not 30.
 *  - The fixture 404s, deliberately. With faces that arrive, the *cache* skips
 *    a face it already holds, so a picker that forgot its asked-set would still
 *    fetch nothing on the second search and the test would pass on the cache's
 *    guard rather than on the picker's. With nothing ever resident, the only
 *    thing that can stop the re-fetch is the picker remembering it asked. */
it("does not re-ask for a face it already asked about", async () => {
  const fetch = vi.fn(async () => new Response(null, { status: 404 }));
  const cache = createSpecimenCache({
    fetch,
    createFontFace: vi.fn(() => ({ load: vi.fn(async () => undefined) })),
    fonts: { add: vi.fn(), delete: vi.fn() },
  });
  const { host, unmount } = await setup({ cache });
  const flush = async (): Promise<void> => {
    await act(async () => {
      await Promise.resolve();
    });
  };
  await flush();
  const afterFirstWindow = fetch.mock.calls.length;

  const search = host.querySelector<HTMLInputElement>('input[type="search"]')!;
  const type = async (value: string): Promise<void> => {
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(search, value);
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await flush();
  };

  await type("yellowtail");
  // Five more, and no fewer: each is a face the window had not reached.
  expect(fetch.mock.calls.length - afterFirstWindow).toBe(5);

  // Away to another term and back. Every face `yellowtail` reaches was asked
  // for on the way there, and none of them is resident — the fetch is a 404 —
  // so nothing but the picker's own memory stops the five re-fetches.
  await type("inter");
  const afterOther = fetch.mock.calls.length;
  expect(afterOther).toBeGreaterThan(afterFirstWindow + 5);
  await type("yellowtail");
  expect(fetch.mock.calls.length).toBe(afterOther);
  unmount();
});

/** The face list is the picker's own list, so it is named as one rather than
 *  being three anonymous boxes. */
it("names the two lists it renders", async () => {
  const { host, unmount } = await setup();
  expect(
    host
      .querySelector("[data-vigilia-font-trio-list]")!
      .getAttribute("aria-label"),
  ).toBe(uiCopy.panels.fontTrios);
  unmount();
});

/** A face the picker applies is a record from the catalogue it browsed, not a
 *  re-read of the global one. Asserted by identity so a picker that silently
 *  swapped in `catalogFaces()[i]` would be caught. */
it("applies a face drawn from the browsed set, by identity", async () => {
  const onApplyFace = vi.fn();
  const yellowtail = catalogFaces().find(
    (face) => face.family === "Yellowtail",
  )! as CuratedFontFace;
  const { host, unmount } = await setup({
    trios: [],
    faces: [yellowtail],
    cache: missingCache(),
    onApplyFace,
  });
  await act(async () => rows(host)[0]!.click());
  const applied = onApplyFace.mock.calls[0]![0] as CuratedFontFace;
  expect(applied).toBe(yellowtail);
  expect(applied.sourceUrl).toBe(yellowtail.sourceUrl);
  unmount();
});
