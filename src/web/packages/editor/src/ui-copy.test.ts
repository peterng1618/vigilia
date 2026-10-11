// @vitest-environment jsdom
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
import {
  DEFAULT_SHELL_PALETTE,
  shellPalettes,
} from "./editor-shell/palette.js";
import { Settings } from "./editor-shell/settings.js";
import { createShellLayout } from "./editor-shell/shell-layout.js";
import { catalogFaces, fontTrios } from "./font-catalog.js";
import { FontPicker } from "./font-picker/font-picker.js";
import { createPalettePanel } from "./palette-manager/panel.js";
import { createSelectionInspector } from "./selection-inspector/index.js";
import { projectRuns, RunEditor } from "./selection-inspector/runs.js";
import type { RunEdits } from "./selection-inspector/view.js";
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
/** A button's own words. A section's disclosure chrome is an `aria-hidden`
 *  `▾`, which is decoration the way a select's chevron is — the words beside it
 *  are what this table has to hold, not the glyph they are printed next to. */
function spokenText(element: Element): string {
  const words = element.cloneNode(true) as Element;
  for (const hidden of words.querySelectorAll('[aria-hidden="true"]'))
    hidden.remove();
  return words.textContent ?? "";
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
  const { root, destroy } = await mountLandedSurfaces();
  const owned = new Set(copy());
  expect(
    spokenIn(root).filter((text) => !owned.has(text) && !isStoredName(text)),
  ).toEqual([]);
  for (const surface of LANDED_SURFACES) {
    const found = root.querySelector(surface);
    if (found === null) throw new Error(`no ${surface} surface rendered`);
    expect(spokenIn(found), surface).not.toEqual([]);
  }
  destroy();
});

/**
 * §9: a menu's rows are sentence case. The list is the menu's own — its three
 * names, its File and Edit rows and its View settings — not the whole table,
 * which carries `W`, `H`, `CPU`, `2K`, `(empty)` and `Left`/`Right`:
 * abbreviations, marks and a parenthesised gap, none of them a row a menu
 * prints. A row title-cased (`New From Starter`) is what this catches.
 */
it("prints every menu row in sentence case", () => {
  for (const row of menuRows()) expect(isSentenceCase(row), row).toBe(true);
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
 * The rows `ShellMenuBar` renders. Read from the menu's own list rather than the
 * whole table: the File rows are `uiCopy.file`, the Edit rows are the six action
 * words the menu draws (`shell-layout.tsx`), the View rows are `uiCopy.view`,
 * and the three names are `uiCopy.menus`. A row added to the menu is added here
 * beside it.
 */
function menuRows(): string[] {
  return [
    uiCopy.menus.file,
    uiCopy.menus.edit,
    uiCopy.menus.view,
    ...Object.values(uiCopy.file),
    uiCopy.actions.undo,
    uiCopy.actions.redo,
    uiCopy.actions.copy,
    uiCopy.actions.cut,
    uiCopy.actions.duplicate,
    uiCopy.actions.delete,
    ...Object.values(uiCopy.view),
  ];
}

/** Sentence case: no word after the first is capitalised like a title. An
 *  acronym (`FPS`) is all caps and is not title case, so `30 FPS` passes and
 *  `New From Starter` does not. */
function isSentenceCase(row: string): boolean {
  return row
    .split(/\s+/)
    .slice(1)
    .every((word) => !/^[A-Z][a-z]/.test(word));
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
    out.push(named.getAttribute("aria-label")?.trim() ?? "");
  }
  for (const button of element.querySelectorAll("button")) {
    if (button.getAttribute("data-vigilia-palette-token-row") !== null)
      continue;
    if (button.querySelector("[data-vigilia-value]") !== null) continue;
    if (button.hasAttribute("aria-controls")) continue;
    out.push(spokenText(button).trim());
  }
  return out.filter((text) => text !== "" && !/^[\d.v-]+$/.test(text));
}

/** A shell palette's name is the id `shellPalettes` stores — the same string
 *  the swatch's `data-shell-palette` carries — so it is a preset's own name,
 *  the data the carve-out above deliberately leaves out of the table. */
function isStoredName(text: string): boolean {
  return (shellPalettes as readonly string[]).includes(text);
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
 * disjoint field sets.
 */
async function mountLandedSurfaces(): Promise<{
  readonly root: HTMLElement;
  readonly destroy: () => void;
}> {
  const shellRoot = document.createElement("div");
  document.body.append(shellRoot);
  const layout = createShellLayout(shellRoot);

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
    destroy: () => {
      layout.destroy();
      act(() => pickerRoot.unmount());
      act(() => settingsRoot.unmount());
      document.body.replaceChildren();
    },
  };
}
