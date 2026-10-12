// @vitest-environment jsdom
/**
 * The copy net: every word an author reads comes from `uiCopy`, or is data — a
 * token's name, a locale's, an asset's, a preset's. Two halves, one claim: the
 * imperative panels are read for their own DOM, and the React surfaces are read
 * through `mountLandedSurfaces`.
 *
 * **What the React half reads.** The shell is mounted whole with a bridge and a
 * selection, so the chrome it prints only then is in the tree at all; Settings is
 * read on its Appearance, Keyboard and About tabs; the colour picker is mounted
 * open; the selection column is mounted on a text object and a shape; and the
 * three menubar menus and the canvas context menu are opened and read in turn.
 * `spokenIn` takes a surface's words — its labels, accessible names, buttons and
 * an opened menu's rows — and `saidIn` adds the paragraphs it does not read.
 *
 * **What it deliberately does not read, and why.** A control that prints a
 * *value* is read for the concept and not the reading: a select's trigger shows
 * the chosen token or unit, a token well the document's own name, the camera's
 * readout `Display and zoom: 100%`, and a `kbd` the chord the binding table
 * prints. Two owners of words are carved out by name, because the words are
 * theirs and not this table's: `shellPalettes`' stored ids (`isStoredName`) and
 * the shortcut reference's action words (`isShortcutWord`). And only the
 * shell's paragraphs are read: the inspector, the picker and the panes print
 * data in paragraphs of their own — a run's binding id, a colour's reading —
 * which is the same carve-out the walk makes for a select's trigger.
 *
 * Surfaces this file does not mount are not read here: the `?` reference sheet,
 * the publish popover, and the library and new-document dialogs.
 */
import { Canvas, type FabricObject, Rect, Textbox } from "fabric/es";
import { act, createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { expect, it } from "vitest";
import { createArtboardPanel } from "./artboard-panel.js";
import {
  ChartContentFields,
  type ChartEdits,
  ChartPaintFields,
} from "./chart-manager/chart-fields.js";
import {
  type ChartFieldTarget,
  chartContentView,
  chartPaintView,
} from "./chart-manager/panel.js";
import { ColourPicker } from "./components/ui/colour-picker.js";
import type { EditorShellBridge } from "./editor-shell/bridge.js";
import { CanvasContextMenu } from "./editor-shell/canvas-context-menu.js";
import {
  DEFAULT_SHELL_PALETTE,
  shellPalettes,
} from "./editor-shell/palette.js";
import { Settings } from "./editor-shell/settings.js";
import {
  createShellLayout,
  EDIT_MENU_ROWS,
} from "./editor-shell/shell-layout.js";
import { catalogFaces, fontTrios } from "./font-catalog.js";
import { FontPicker } from "./font-picker/font-picker.js";
import { createPalettePanel } from "./palette-manager/panel.js";
import { createSelectionInspector } from "./selection-inspector/index.js";
import { projectRuns, RunEditor } from "./selection-inspector/runs.js";
import type { RunEdits } from "./selection-inspector/view.js";
// The reference table owns the words for actions no menu prints, so the walk
// reads the Keyboard tab through its carve-out rather than demanding the copy
// table own the shortcut registry.
import { SHORTCUT_LABELS } from "./shortcut-manager/reference.js";
import { createTypePresetPanel } from "./type-preset-manager/panel.js";
import { uiCopy } from "./ui-copy.js";

// The run editor's unit list is a Base UI select, so opening it needs the three
// browser APIs jsdom has none of — the same three `control.dom.test.tsx` and
// `runs.test-stage.tsx` supply, for the same reason.
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
} as never;
Element.prototype.getAnimations ??= (): never[] => [];
window.PointerEvent ??= MouseEvent as never;
const nativeMatches = Element.prototype.matches;
Element.prototype.matches = Object.assign(function (
  this: Element,
  selector: string,
): boolean {
  if (selector === ":modal" || selector === ":popover-open") return false;
  return nativeMatches.call(this, selector);
}, nativeMatches);
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/** A run-editor write port that records nothing: this file reads copy, not writes. */
function runEdits(): RunEdits {
  return {
    setRunText: () => true,
    setRunPreset: () => true,
    setRunColour: () => true,
    setUnitDisplay: () => true,
    setSource: () => true,
    setFormat: () => true,
    setZone: () => true,
    writeLayout: () => true,
    addRun: () => true,
    removeRun: () => true,
  };
}

/**
 * No pictograph is copy. §35 keeps visible copy in this table, and a glyph is
 * decoration: it is announced as a word of its own, it cannot inherit a shell
 * colour the way every icon beside it does, and it does not render like them.
 * The rail's four marks were exactly that — `▤ + ▣ ⚙` as translatable strings —
 * so the rule is the net under the fix rather than the fix itself.
 */
it("holds no pictographs, so an icon cannot be stored as copy", () => {
  expect(pictographs(uiCopy)).toEqual([]);
});

/** Every string the table reaches, paired with the key that holds it. Letters
 * are labels (`X`, `W`) and stay; the Unicode symbol blocks are decoration. */
function pictographs(value: unknown, path = "uiCopy"): string[] {
  if (typeof value === "string") {
    return /\p{S}/u.test(value) ? [`${path} = ${JSON.stringify(value)}`] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      pictographs(entry, `${path}[${index}]`),
    );
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, entry]) =>
      pictographs(entry, `${path}.${key}`),
    );
  }
  return [];
}

/**
 * The three panels say no word the table does not hold.
 *
 * A string literal in a panel is invisible to a reviewer reading `ui-copy.ts`
 * and invisible to the pictograph rule above, which only sees the table. The
 * cost is not the duplication — it is that the words an author reads have no
 * owner, so a rename fixes one surface and silently misses the other.
 *
 * The net is the panels' own rendered labels and buttons, so a literal is
 * caught at the point it is written rather than by a grep that also matches
 * authored theme data. Most option text is data — a token's name, a locale's,
 * an asset's, a preset's — and is deliberately not covered; the paint kinds
 * are copy and are listed by name.
 */
it("leaves the three panels with no copy of their own", async () => {
  const root = document.createElement("div");
  document.body.append(root);

  createArtboardPanel(
    root,
    { palette: { bars: { name: "Bars", value: "#000" } } },
    () => undefined,
    {
      assets: [{ id: "clip", kind: "video", path: "assets/clip.mp4" }],
      onMetadataChange: () => undefined,
    },
  ).render(
    { width: 1280, height: 720 },
    { name: "Living Room", themeLanguage: "en" },
  );
  const palettePanel = createPalettePanel(
    root,
    () => undefined,
    () => undefined,
  );
  await act(async () => {
    palettePanel.render({
      background: {
        name: "Background",
        value: { kind: "solid", color: "#000" },
      },
      glow: {
        name: "Glow",
        value: {
          kind: "gradient",
          angle: 45,
          stops: [
            { offset: 0, color: "#ffffff" },
            { offset: 1, color: "#000000" },
          ],
        },
      },
      accent: { name: "Accent", value: { kind: "solid", color: "#0ff" } },
    });
    // The gradient and delete branches, because a solid token renders neither.
    // The token list is React now, so the branch is opened by choosing the row
    // rather than by setting a native `<select>`'s value.
    const glow = root.querySelector<HTMLElement>(
      '[data-vigilia-palette-token-row="glow"]',
    );
    if (glow === null) throw new Error("the Tokens pane listed no glow token");
    glow.click();
  });
  createTypePresetPanel(
    root,
    () => undefined,
    () => undefined,
    {
      preview: async () => undefined,
      applyFace: async () => undefined,
      applyTrio: async () => undefined,
    },
  ).render({
    body: { name: "Body", value: { family: "Inter", size: 16 } },
    caption: { name: "Caption", value: { family: "Inter", size: 12 } },
  });

  // The palette's paint kinds, which are copy. They live in a Base UI popup that
  // exists only while it is open, so they are read the way an author reads them.
  // The other option lists in these panels are data — a token's name, a locale's,
  // an asset's, a preset's — and are deliberately not covered.
  const paintKinds = await openUnitDisplayOptions(
    root,
    "[data-vigilia-palette-kind]",
  );
  // Non-vacuous, and said with a number. `openUnitDisplayOptions` returns an
  // empty list when its selector matches nothing, so without this the read above
  // could cover nothing at all — and because a select's trigger is excluded from
  // the button net, a hard-coded kind word would then go uncovered too. Two is
  // what the pane offers (`solid`, `gradient`), read off the opened list.
  expect(paintKinds).toHaveLength(2);
  const owned = new Set(copy());
  const spoken = [
    ...Array.from(root.querySelectorAll("label"), (label) => label.textContent),
    // Two kinds of button are excluded, both because their text is data. A token
    // well prints the document's own token name and usage figure; a select's
    // trigger prints the chosen value, which on every panel here is a token's
    // name, a preset's, a unit's or a locale's — the chevron beside it is
    // decoration. The words a select *offers* are copy and are read from its
    // open list, so excluding the closed control loses nothing.
    ...Array.from(root.querySelectorAll("button"))
      .filter(
        (button) =>
          button.getAttribute("data-vigilia-palette-token-row") === null &&
          button.querySelector("[data-vigilia-value]") === null,
      )
      .map((button) => spokenText(button)),
    ...paintKinds,
  ]
    .map((text) => text?.trim() ?? "")
    // The release version's and the language sample's values are readings, not
    // copy: one is the document's own version, the other the platform's spelling
    // of a date in the chosen language.
    .filter((text) => text !== "" && !/^[\d.v-]+$/.test(text));
  expect(spoken.filter((text) => !owned.has(text))).toEqual([]);

  // This test mounts three panels that nothing unmounts, and the paint-kind list
  // it opened portals into `document.body`. Left standing, that popup is the next
  // test's `[role="option"]` set — read as four extra unit-display words.
  await act(async () => palettePanel.destroy());
  document.body.replaceChildren();
});

/**
 * The font picker says no word the table does not hold.
 *
 * The picker is a React island the type-preset panel mounts, so the net above —
 * which reads the three imperative panels' DOM — does not reach it. A string
 * literal in `font-picker.tsx` would therefore be invisible to the rule that
 * exists to catch exactly that, which is why the picker is mounted here
 * directly rather than waiting for the panel that will host it.
 *
 * Data is excluded on purpose, the way it is above: a face's family name, a
 * trio's name and an upstream facet value are the catalogue's words, not this
 * component's. The facet values in particular are the tags Fonttrio assigned,
 * and they round-trip into the query, so a test that demanded the table own
 * "versatile (107)" would be demanding the table own the catalogue.
 */
it("leaves the font picker with no copy of its own", async () => {
  const root = document.createElement("div");
  document.body.append(root);
  const reactRoot = createRoot(root);
  await act(async () =>
    reactRoot.render(
      createElement(FontPicker, {
        trios: fontTrios(),
        faces: catalogFaces(),
        favorites: [],
        // A cache that never loads, so every row renders its "still coming"
        // note: the note is copy, and a specimen that arrived would hide it.
        cache: {
          ensure: () => new Promise<void>(() => undefined),
          resident: () => undefined,
          release: () => undefined,
        },
        onApplyTrio: () => undefined,
        onApplyFace: () => undefined,
        onToggleFavorite: () => undefined,
      }),
    ),
  );

  const owned = new Set(copy());
  const spoken = [
    // Labels and their accessible names: the search field, the three facets,
    // the sort, the trio chooser, and the two states of the favourite toggle.
    // A converted chooser's own words are here: the facet's "any" entry is the
    // row's label, so the closed control prints the table's word and no second
    // read is needed.
    ...Array.from(root.querySelectorAll("label"), (label) => label.textContent),
    ...Array.from(root.querySelectorAll("[aria-label]"), (element) =>
      element.getAttribute("aria-label"),
    ),
    // The picker's own buttons, minus the rows whose text is a catalogue name
    // and the choosers' triggers, whose text is the value they print — a face's
    // family, a trio's name — plus the control set's own `▼`.
    ...Array.from(root.querySelectorAll("button"))
      .filter(
        (button) =>
          !button.hasAttribute("data-vigilia-font-face-row") &&
          !button.hasAttribute("data-vigilia-font-trio-row") &&
          button.querySelector("[data-vigilia-value]") === null,
      )
      .map((button) => button.textContent),
  ]
    .map((text) => text?.trim() ?? "")
    .filter((text) => text !== "" && !/^[\d.v-]+$/.test(text));
  expect(spoken.filter((text) => !owned.has(text))).toEqual([]);
  reactRoot.unmount();
});

/** The two states of the favourite toggle name two different actions, so a
 *  screen reader can tell what the press will do. Pinned here beside the copy
 *  rule rather than only in the picker's own test because both words have to
 *  come from the table for the rule above to mean anything. */
it("names both states of the favourite toggle", () => {
  expect(uiCopy.panels.fontFavorite).not.toBe(uiCopy.panels.fontUnfavorite);
  for (const word of [
    uiCopy.panels.fontFavorite,
    uiCopy.panels.fontUnfavorite,
  ]) {
    expect(/\p{S}/u.test(word)).toBe(false);
  }
});

/**
 * The four unit display words have one owner, in both panels that offer them.
 *
 * Scoped to these four on purpose. Both panels carry dozens more literals —
 * "Precision", "Start angle", "Rounded ends" and the rest of the chart panel's
 * fields — and folding them into the net above would be F1.25's row, not this
 * one's. What vg-113 moved was four words that were written twice with nothing
 * joining them, and this is the net under that much and no more.
 *
 * The number is load-bearing too: eight is four options in two panels, so a
 * control that stopped rendering takes this red rather than emptying the set.
 */
it("gives the unit display options one owner, in both panels that offer them", async () => {
  const root = document.createElement("div");
  document.body.append(root);
  // One control at a time: both are selects whose list lives in a portal, and a
  // read has to see its own four rather than the previous control's four beside
  // them. The chart's own host is unmounted before the run panel is mounted.
  const offered = [
    ...(await chartUnitDisplayOptions(root)),
    ...(await runUnitDisplayOptions(root)),
  ];
  const owned = new Set(copy());
  expect(offered).toHaveLength(8);
  expect(offered.filter((text) => !owned.has(text))).toEqual([]);
});

/**
 * The four words a control offers, read from the list its trigger opens.
 *
 * Both controls are Base UI selects now, so their options exist in the DOM only
 * while the popup is open. Reading them any other way would read the table the
 * list is built from and agree with itself.
 */
async function openUnitDisplayOptions(
  host: HTMLElement,
  selector: string,
): Promise<string[]> {
  const trigger = host.querySelector<HTMLElement>(selector);
  if (trigger === null) return [];
  await act(async () => {
    trigger.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  });
  await act(async () => {
    for (let round = 0; round < 3; round += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
  return [...document.querySelectorAll<HTMLElement>('[role="option"]')].map(
    (option) => option.textContent ?? "",
  );
}

/** The chart panel's four, read from a chart the owner projects and a stage that
    is unmounted again so the run panel's list is the only one open. */
async function chartUnitDisplayOptions(root: HTMLElement): Promise<string[]> {
  const gauge: ChartFieldTarget = {
    id: "gauge",
    content: {
      family: "gauge",
      settings: {
        startAngle: 90,
        endAngle: -270,
        min: 0,
        max: 100,
        thickness: 10,
        track: { kind: "solid", color: "#000" },
        progress: { kind: "solid", color: "#fff" },
        roundCap: true,
      },
    },
    bindings: [{ id: "g", semanticKey: "ram.used.percent" }],
  };
  // The words are what this file reads; the writes go nowhere.
  const edits: ChartEdits = {
    onSettings: () => {},
    onBinding: () => {},
    onAspect: () => {},
    onAddBinding: () => {},
    onRemoveBinding: () => {},
  };
  const host = document.createElement("div");
  root.append(host);
  const chartRoot = createRoot(host);
  flushSync(() => {
    chartRoot.render([
      createElement(ChartContentFields, {
        key: "content",
        view: chartContentView(gauge),
        edits,
      }),
      createElement(ChartPaintFields, {
        key: "paint",
        view: chartPaintView(gauge, undefined),
        edits,
      }),
    ]);
  });

  const offered = await openUnitDisplayOptions(
    host,
    "[data-vigilia-binding-field$='.unitDisplay']",
  );
  await act(async () => {
    chartRoot.unmount();
  });
  host.remove();
  return offered;
}

/**
 * The run panel's four, from the one state that renders its control.
 *
 * A value run on a reading is the only state that renders it; a literal run has
 * no reading to take a unit off.
 */
async function runUnitDisplayOptions(root: HTMLElement): Promise<string[]> {
  const canvas = new Canvas(document.createElement("canvas"));
  const object = new Textbox("", { id: "clock-label" });
  object.set("vigiliaText", {
    align: "left",
    runs: [{ kind: "value", bindingId: "clock-time" }],
  });
  canvas.add(object);

  let bindings: readonly { id: string; semanticKey: string }[] = [
    { id: "clock-time", semanticKey: "date.today" },
  ];
  const host = document.createElement("div");
  root.append(host);
  const runRoot = createRoot(host);
  const runs = projectRuns(object as never, "clock-label", {
    globals: undefined,
    locale: undefined,
    nodeBindings: () => bindings,
    sampleSource: () => ({ latest: () => undefined, history: () => [] }),
    swatchValue: () => undefined,
  });
  if (runs !== undefined) {
    flushSync(() =>
      runRoot.render(createElement(RunEditor, { runs, edits: runEdits() })),
    );
  }
  return openUnitDisplayOptions(host, "[data-vigilia-run-unit-display]");
}

/**
 * Every string the table can produce. A function entry is called with the
 * argument shapes the panels pass it — a count and a name — over the counts
 * this panel renders, which yields a superset of what they show: extra entries
 * only loosen the net, they cannot break it.
 */
/** A button's or a menu row's own words. A section's disclosure chrome is an
 *  `aria-hidden` `▾`, which is decoration the way a select's chevron is, and a
 *  `kbd` prints a chord the binding table owns — the words beside them are what
 *  this table has to hold, not the glyph or the key they are printed next to. */
function spokenText(element: Element): string {
  const words = element.cloneNode(true) as Element;
  for (const hidden of words.querySelectorAll('[aria-hidden="true"], kbd'))
    hidden.remove();
  return words.textContent ?? "";
}

/** Everything a surface says: what `spokenIn` reads, and the paragraphs it does
 *  not. The About tab's words are all in one paragraph, so a read without this
 *  would agree with itself by finding nothing. */
function saidIn(element: Element): string[] {
  return [...spokenIn(element), ...paragraphsOf(element)];
}

/** The words a surface prints in paragraphs of its own, empty ones dropped. */
function paragraphsOf(element: Element): string[] {
  return Array.from(
    element.querySelectorAll("p"),
    (paragraph) => paragraph.textContent?.trim() ?? "",
  ).filter((text) => text !== "");
}

function copy(): string[] {
  const out: string[] = [];
  const walk = (value: unknown): void => {
    if (typeof value === "string") out.push(value);
    else if (typeof value === "function")
      for (const argument of [1, 2, 3, 4, "x"]) {
        const produced: unknown = (value as (a: unknown) => unknown)(argument);
        if (typeof produced === "string") out.push(produced);
      }
    else if (Array.isArray(value)) value.forEach(walk);
    else if (typeof value === "object" && value !== null)
      Object.values(value).forEach(walk);
  };
  walk(uiCopy);
  return out;
}

/**
 * §6: the two readings answer different questions, and neither is the fallback
 * for the other. The words have to say which question each one answers — an
 * author building a theme for somebody else's machine reads this menu before
 * they discover the theme names a sensor their PC does not have.
 */
it("names each reading for the question it answers", () => {
  expect(uiCopy.view.preview).toBe("The theme's sensors");
  expect(uiCopy.view.live).toBe("This machine");
  expect(uiCopy.view.dataSource).toBe("Readings from");
  expect(uiCopy.view.previewDetail).toBe("every sensor this theme names");
});

/**
 * The React surfaces plans 1–5 landed say no word the table does not hold.
 *
 * The three panels above are imperative and are read for their own DOM; these
 * are the shell, the Settings modal, the colour picker and the selection column,
 * which that net never reached. A literal in a React surface is invisible to a
 * reviewer reading `ui-copy.ts` and to the pictograph rule, exactly as one in a
 * panel is — and the cost is the same: a word an author reads has no owner, so a
 * rename fixes one surface and silently misses the other.
 *
 * **The list below is the coverage, and every surface is asserted non-empty by
 * its own selector.** A surface that failed to mount contributes nothing and
 * would satisfy the walk by being absent (Review Focus 3), so absence is made a
 * failure rather than a pass.
 */
it("leaves the React surfaces with no copy of their own", async () => {
  const { root, shell, destroy } = await mountLandedSurfaces();
  const owned = new Set(copy());
  expect(
    spokenIn(root).filter((text) => !owned.has(text) && !isStoredName(text)),
  ).toEqual([]);
  for (const surface of LANDED_SURFACES) {
    const found = root.querySelector(surface);
    if (found === null) throw new Error(`no ${surface} surface rendered`);
    expect(spokenIn(found), surface).not.toEqual([]);
  }
  // `vg-338`: the shell's own paragraphs, which `spokenIn` reads none of. Only
  // the shell's are read here — the header says why — and the sentence had no
  // net at all while it was a literal.
  const hints = paragraphsOf(shell);
  expect(hints.length).toBeGreaterThan(0);
  expect(hints.filter((text) => !owned.has(text))).toEqual([]);
  destroy();
});

/**
 * The surfaces `vg-335` found reachable but unread say no word the table does
 * not hold: an opened menu popup, the Settings Keyboard and About tabs, and the
 * canvas context menu. `spokenIn` read the closed chrome, so a literal written
 * into any of the four had no net at all — and each is opened here, read for
 * its own words, and asserted non-empty first, so a surface that failed to open
 * is a failure rather than a walk that agreed with nothing.
 *
 * The menu read pays no stall: `vg-135`'s 50-90 s per open is jsdom's
 * unanswerable `:modal`/`:popover-open` selectors, and this file patches them
 * at the top for exactly that reason.
 */
it("reads the opened menus, the Settings tabs and the canvas context menu", async () => {
  const { root, destroy } = await mountLandedSurfaces();
  const owned = new Set(copy());

  for (const menu of [
    uiCopy.menus.file,
    uiCopy.menus.edit,
    uiCopy.menus.view,
  ]) {
    menubarEntry(root, menu).click();
    await Promise.resolve();
    const popup = root.querySelector<HTMLElement>(
      ".editor-shell-menu-popup[data-open]",
    );
    if (popup === null) throw new Error(`the ${menu} menu opened no popup`);
    expect(spokenIn(popup), menu).not.toEqual([]);
    expect(
      spokenIn(popup).filter((text) => !owned.has(text)),
      menu,
    ).toEqual([]);
  }

  const { keyboard, about } = uiCopy.settings;
  for (const tab of [keyboard, about]) {
    const panel = openSettingsTab(tab);
    const said = saidIn(panel);
    expect(said, tab).not.toEqual([]);
    expect(
      said.filter(
        (text) =>
          !owned.has(text) && !isShortcutWord(text) && !isStoredName(text),
      ),
      tab,
    ).toEqual([]);
  }
  destroy();

  // The canvas context menu, which mounts on a bridge of its own rather than
  // inside the shell — the shell's own copy of it renders no rows until a
  // right-click arrives on a real upper canvas.
  const bridge = selectionBridge();
  const host = document.createElement("div");
  document.body.append(host);
  const menuRoot = createRoot(host);
  menuRoot.render(createElement(CanvasContextMenu, { bridge }));
  await flushTasks();
  const upper = bridge.editor.canvas.upperCanvasEl as unknown as HTMLElement;
  upper.dispatchEvent(
    new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 120,
      clientY: 90,
    }),
  );
  await flushTasks();
  const items = Array.from(
    document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
  );
  // Without this the read below passes on a menu that rendered nothing.
  expect(items.length).toBeGreaterThan(0);
  const spoken = spokenIn(document.body);
  expect(spoken).not.toEqual([]);
  expect(
    spoken.filter((text) => !owned.has(text) && !isStoredName(text)),
  ).toEqual([]);
  await act(async () => menuRoot.unmount());
  document.body.replaceChildren();
});

/** The menubar trigger for a menu, found by the text it carries. */
function menubarEntry(root: HTMLElement, label: string): HTMLButtonElement {
  const entry = Array.from(
    root.querySelectorAll<HTMLButtonElement>(".editor-shell-menubar button"),
  ).find((button) => button.textContent === label);
  if (entry === undefined) throw new Error(`No "${label}" menu.`);
  return entry;
}

/** The Settings modal's tab named `label`, clicked the way a reader opens it,
 *  returning the panel the tab points at — not the first `tabpanel`, which is
 *  the Appearance tab's while Base UI still holds it. */
function openSettingsTab(label: string): HTMLElement {
  const tab = Array.from(
    document.querySelectorAll<HTMLElement>('[role="tab"]'),
  ).find((element) => element.textContent?.trim() === label);
  if (tab === undefined) throw new Error(`No "${label}" tab in the modal.`);
  act(() => {
    tab.click();
  });
  const controlled = tab.getAttribute("aria-controls");
  const panel =
    controlled === null ? null : document.getElementById(controlled);
  if (panel === null) throw new Error(`the ${label} tab points at no panel`);
  return panel;
}

/** React schedules outside `act` and floating-ui's measurement never settles
 *  inside one, so a popup is flushed with macrotasks instead. */
async function flushTasks(): Promise<void> {
  for (let round = 0; round < 3; round += 1)
    await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * §9: a menu's rows are sentence case. The list is the menu's own — its three
 * names, its File and Edit rows and its View settings — not the whole table,
 * which carries `W`, `H`, `CPU`, `2K`, `(empty)` and `Left`/`Right`:
 * abbreviations, marks and a parenthesised gap, none of them a row a menu
 * prints. A row title-cased (`New From Starter`) or lower-cased (`value runs`)
 * is what this catches.
 *
 * **The count is guarded, in the same shape as the per-surface assertion.** The
 * case could pass by being fed nothing, so the Edit rows are counted against the
 * six the menu is specified to hold (`EDIT_MENU_ROWS`), not against the length of
 * the list the case derives: a row dropped from the menu's owner shrinks both it
 * and this list together, which a derived count could not see.
 */
it("prints every menu row in sentence case", () => {
  const rows = menuRows();
  const editLabels = new Set(EDIT_MENU_ROWS.map((row) => row.label));
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.filter((row) => editLabels.has(row)).length).toBe(6);
  for (const row of rows) expect(isSentenceCase(row), row).toBe(true);
});

/**
 * The digit arm of the first-word rule, on the shapes that reach it. This menu
 * already prints `30 FPS` and `1 FPS`, so a digit-led row is one edit away —
 * and `^[A-Z0-9]` alone admitted any of them, `3d view` included, which is how
 * `2d mode` would have slipped through a sentence-case net unnoticed.
 */
it("reads the first letter of the first word, not its first character", () => {
  expect(isSentenceCase("30 FPS")).toBe(true);
  expect(isSentenceCase("3D view")).toBe(true);
  expect(isSentenceCase("Tokens")).toBe(true);
  expect(isSentenceCase("3d view")).toBe(false);
  expect(isSentenceCase("2d mode")).toBe(false);
  expect(isSentenceCase("(empty)")).toBe(false);
});

/** The shell's chrome, in the surfaces the walk reads. Each is a selector the
 *  mounted tree answers, so a surface dropped from `mountLandedSurfaces` is the
 *  `null` this file already fails on rather than a silent gap. */
const LANDED_SURFACES = [
  ".editor-shell-menubar",
  ".editor-shell-stage",
  ".editor-shell-rail",
  "[data-vigilia-canvas-toolbar]",
  ".editor-shell-panel",
  ".editor-shell-settings",
  "[data-vigilia-section]",
  '[data-testid="colour-picker"]',
] as const;

/**
 * The rows `ShellMenuBar` renders. Read from the menu's own owners rather than
 * from the whole table: the three names are `uiCopy.menus`, the File rows are
 * `uiCopy.file`, the Edit rows are `EDIT_MENU_ROWS` — the const the menu itself
 * maps over, because `uiCopy.actions` holds fourteen keys and only six are Edit
 * rows, so no `Object.values` derives them — and the View rows are `uiCopy.view`
 * less the one entry no menu prints: `previewDetail` is the status line under
 * the source control (`live-source.ts`), not a row. A row added to File or View
 * is covered by the derivation; one added to Edit is covered by the const.
 */
function menuRows(): string[] {
  return [
    uiCopy.menus.file,
    uiCopy.menus.edit,
    uiCopy.menus.view,
    ...Object.values(uiCopy.file),
    ...EDIT_MENU_ROWS.map((row) => row.label),
    ...Object.values(uiCopy.view).filter(
      (row) => row !== uiCopy.view.previewDetail,
    ),
  ];
}

/** Sentence case: the first word carries the capital and no later word is
 *  capitalised like a title. A later acronym (`FPS`) is all caps and is not
 *  title case, so `30 FPS` passes and `New From Starter` does not; a lower-cased
 *  first word (`value runs`) fails.
 *
 *  The capital is read off the first token's first **letter**, so a leading
 *  digit is not a licence: `30 FPS` and `1 FPS` pass because their first token
 *  carries no letter at all, `3D view` passes on the `D`, and `3d view` — the
 *  shape `2d mode` would have in this very menu — fails. A row leading with a
 *  non-alphanumeric still fails, which is a loud false positive rather than a
 *  silent pass; nothing produces that shape. */
function isSentenceCase(row: string): boolean {
  const [first, ...rest] = row.split(/\s+/);
  // The guard is the narrowing `noUncheckedIndexedAccess` requires of a
  // destructured `string[]`, not a branch `split` can reach.
  if (first === undefined || !/^[A-Z0-9]/.test(first)) return false;
  if (/^[^A-Za-z]*[a-z]/.test(first)) return false;
  return rest.every((word) => !/^[A-Z][a-z]/.test(word));
}

/**
 * Every string the landed React surfaces say: a field's own label, a control's
 * accessible name and a button's words — minus the three whose content is not
 * copy. A section header is excluded because its text is an uppercase eyebrow
 * (§2) and a count, neither a word the table owns; a converted select's trigger
 * is excluded because it prints the chosen value; and a token well is excluded
 * as the panel net above excludes it, because it prints the document's own name.
 */
function spokenIn(element: Element): string[] {
  const out: string[] = [];
  for (const label of element.querySelectorAll("label"))
    out.push(label.textContent?.trim() ?? "");
  for (const named of element.querySelectorAll("[aria-label]")) {
    // A control named by its own `data-testid` (the picker's tracks) is a
    // driver's hook, not a word of copy.
    if (named.getAttribute("aria-label") === named.getAttribute("data-testid"))
      continue;
    // A `kbd`'s label is the chord the binding table prints, not a word.
    if (named.closest("kbd") !== null) continue;
    const name = named.getAttribute("aria-label") ?? "";
    // The camera's readout is the concept and then the reading, the way a
    // select's trigger prints the chosen value. The concept is a word this table
    // must hold, so it is read; the reading is dropped by its own shape — and a
    // reading in a shape this does not know is pushed whole and goes red, so a
    // change to the readout cannot quietly take the concept out of the net.
    out.push(
      named.hasAttribute("data-vigilia-zoom")
        ? name.replace(/: \d+(?:\.\d+)?%$/, "")
        : name,
    );
  }
  for (const button of element.querySelectorAll("button")) {
    if (button.getAttribute("data-vigilia-palette-token-row") !== null)
      continue;
    if (button.querySelector("[data-vigilia-value]") !== null) continue;
    if (button.hasAttribute("aria-controls")) continue;
    // The readout's trigger prints the reading alone, so the button half has no
    // words of its own; the concept above is where its name is read.
    if (button.hasAttribute("data-vigilia-zoom")) continue;
    out.push(spokenText(button).trim());
  }
  // An opened menu's rows, which are not buttons and carry no accessible name
  // of their own: their words are their text, minus the chord printed beside.
  for (const item of element.querySelectorAll(
    '[role="menuitem"], [role="menuitemradio"]',
  ))
    out.push(spokenText(item).trim());
  return out.filter((text) => text !== "" && !/^[\d.v-]+$/.test(text));
}

/** A shell palette's name is the id `shellPalettes` stores — the same string
 *  the swatch's `data-shell-palette` carries — so it is a preset's own name,
 *  the data the carve-out above deliberately leaves out of the table. */
function isStoredName(text: string): boolean {
  return (shellPalettes as readonly string[]).includes(text);
}

/** A shortcut's action word is the reference table's. `SHORTCUT_LABELS` reuses
 *  `uiCopy`'s names and owns the five no menu prints (`Select all` and the four
 *  nudges), so the Keyboard tab names its rows from there and the copy table is
 *  not their owner. */
function isShortcutWord(text: string): boolean {
  return (Object.values(SHORTCUT_LABELS) as readonly string[]).includes(text);
}

/**
 * The shell's bridge, cut to what a mounted shell reaches.
 *
 * A walk that reads words mounts the shell whole, and the shell mounts the
 * composition pane, so the pane's reads are here too. It reports a selection
 * because the shell prints some of its chrome only then — `vg-338`'s hint
 * paragraph among it, which no net could read while the shell mounted with no
 * selection at all. Everything answers empty: this file reads copy, not state.
 */
function selectionBridge(): EditorShellBridge {
  const noop = (): undefined => undefined;
  return {
    snapshot: () => ({
      selectedCount: 1,
      locked: false,
      activeKind: "text",
      documentName: undefined,
      selectionPresetId: undefined,
    }),
    capture: noop,
    target: () => ({
      kind: "text",
      locked: false,
      memberCount: 1,
      isGroup: false,
    }),
    can: () => false,
    canArrange: () => false,
    layers: () => [],
    groupContext: () => [],
    selectLayer: noop,
    enterGroup: noop,
    exitGroup: noop,
    setLayerVisible: noop,
    setLayerLocked: noop,
    setCollapsed: noop,
    renameLayer: noop,
    sameLayerParent: () => false,
    reorderLayer: () => false,
    subscribe: () => () => undefined,
    run: noop,
    destroy: noop,
    session: {
      newDocument: noop,
      newFromStarter: noop,
      openPackage: noop,
      savePackage: noop,
      releasePackage: noop,
      openLibrary: noop,
      saveLibrary: noop,
      addText: noop,
      addShape: noop,
      addChart: noop,
      insertCard: noop,
      arrange: () => true,
      canArrange: () => true,
      undo: noop,
      redo: noop,
      copy: noop,
      cut: noop,
      deleteActive: noop,
      duplicate: noop,
      group: noop,
      ungroup: noop,
      isDirty: () => false,
      publishableDocument: () => undefined,
      subscribeDocumentChange: () => () => undefined,
    },
    editor: {
      artboard: () => ({ width: 1280, height: 720 }),
      viewport: {
        zoom: () => 1,
        display: () => undefined,
        isFitted: () => false,
        onChange: () => () => undefined,
      },
      canvas: {
        upperCanvasEl: document.createElement("canvas"),
        findTarget: () => ({ target: undefined }),
        on: noop,
        off: noop,
      },
    },
  } as unknown as EditorShellBridge;
}

/**
 * The React surfaces plans 1–5 landed, mounted at once.
 *
 * The shell is assembled whole (`createShellLayout`) rather than piece by piece,
 * because three of the strings this net exists to catch — the menubar's name,
 * the stage's name and the canvas toolbar — are the shell's own markup; the
 * Settings modal and the colour picker are mounted open, because a closed modal
 * and an unopened popover render nothing and would pass the walk by being
 * absent. The selection column is mounted on a text object and a shape, the two
 * disjoint field sets. The shell is given a bridge, so the chrome it prints
 * only for a selection is in the tree rather than absent.
 */
async function mountLandedSurfaces(): Promise<{
  readonly root: HTMLElement;
  readonly shell: HTMLElement;
  readonly destroy: () => void;
}> {
  const shellRoot = document.createElement("div");
  document.body.append(shellRoot);
  const layout = createShellLayout(shellRoot);
  layout.setBridge(selectionBridge(), undefined);

  const settingsHost = document.createElement("div");
  document.body.append(settingsHost);
  const settingsRoot = createRoot(settingsHost);
  await act(async () => {
    settingsRoot.render(
      createElement(Settings, {
        open: true,
        onOpenChange: () => undefined,
        storage: undefined,
        palette: DEFAULT_SHELL_PALETTE,
        following: true,
        onPalette: () => undefined,
        onFollowing: () => undefined,
        overrides: {},
        onOverrides: () => undefined,
        releaseVersion: undefined,
      }),
    );
  });

  const pickerHost = document.createElement("div");
  document.body.append(pickerHost);
  const pickerRoot: Root = createRoot(pickerHost);
  await act(async () => {
    pickerRoot.render(
      createElement(ColourPicker, {
        value: "#123456",
        onChange: () => undefined,
        label: uiCopy.panels.colourPicker,
      }),
    );
  });
  const trigger = pickerHost.querySelector<HTMLElement>(
    '[data-testid="picker-trigger"]',
  );
  if (trigger === null)
    throw new Error("the colour picker rendered no trigger");
  await act(async () => trigger.click());

  // Plan 3's selection column. A text object whose run reads a clock is the
  // richest selection, and a shape renders the other half of the field set.
  for (const selection of [
    new Textbox("", { id: "clock-label" }) as FabricObject,
    new Rect({ left: 0, top: 0, width: 40, height: 20 }) as FabricObject,
  ]) {
    selection.set("vigiliaText", {
      align: "centre",
      runs: [{ kind: "value", bindingId: "clock-time" }],
    });
    selection.set("vigiliaGlass", { blurRadius: 16 });
    const canvas = new Canvas(document.createElement("canvas"));
    canvas.add(selection);
    canvas.setActiveObject(selection);
    const host = document.createElement("div");
    document.body.append(host);
    createSelectionInspector(host, {
      editor: {
        canvas,
        historyManager: { saveState: () => undefined },
        errorManager: { warn: () => undefined, error: () => undefined },
        cropManager: { active: false, target: undefined },
      } as never,
      globals: {
        palette: {
          ink: { name: "Ink", value: { kind: "solid", color: "#ffffff" } },
        },
        typePresets: {
          body: { name: "Body", value: { family: "Inter", size: 16 } },
        },
      } as never,
      nodeBindings: () => [{ id: "clock-time", semanticKey: "date.today" }],
      refreshGlass: () => undefined,
    });
  }

  return {
    root: document.body,
    shell: shellRoot,
    destroy: () => {
      layout.destroy();
      act(() => pickerRoot.unmount());
      act(() => settingsRoot.unmount());
      document.body.replaceChildren();
    },
  };
}
