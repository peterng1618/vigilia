// @vitest-environment jsdom
import { Canvas, Textbox } from "fabric/es";
import { act, createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { createArtboardPanel } from "./artboard-panel.js";
import {
  type ChartFieldHandlers,
  chartContentFields,
  chartPaintFields,
} from "./chart-manager/panel.js";
import { catalogFaces, fontTrios } from "./font-catalog.js";
import { FontPicker } from "./font-picker/font-picker.js";
import { createPalettePanel } from "./palette-manager/panel.js";
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
it("leaves the three panels with no copy of their own", () => {
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
  createPalettePanel(
    root,
    () => undefined,
    () => undefined,
  ).render({
    background: { name: "Background", value: { kind: "solid", color: "#000" } },
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
  for (const [host, id] of [
    ["[data-vigilia-palette-token]", "glow"],
  ] as const) {
    const select = root.querySelector<HTMLSelectElement>(host)!;
    select.value = id;
    select.dispatchEvent(new Event("change"));
  }
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

  const owned = new Set(copy());
  const spoken = [
    ...Array.from(root.querySelectorAll("label"), (label) => label.textContent),
    ...Array.from(
      root.querySelectorAll("button"),
      (button) => button.textContent,
    ),
    // The palette's paint kinds, which are copy; the other option lists in
    // these panels are data — a token's name, a locale's, an asset's, a preset's.
    ...Array.from(
      root.querySelectorAll("[data-vigilia-palette-kind] option"),
      (option) => option.textContent,
    ),
  ]
    .map((text) => text?.trim() ?? "")
    // The release version's and the language sample's values are readings, not
    // copy: one is the document's own version, the other the platform's spelling
    // of a date in the chosen language.
    .filter((text) => text !== "" && !/^[\d.v-]+$/.test(text));
  expect(spoken.filter((text) => !owned.has(text))).toEqual([]);
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
    ...Array.from(root.querySelectorAll("label"), (label) => label.textContent),
    ...Array.from(root.querySelectorAll("[aria-label]"), (element) =>
      element.getAttribute("aria-label"),
    ),
    // The facet selects' own empty option — the word on the closed control.
    ...Array.from(
      root.querySelectorAll("[data-vigilia-font-facet] option:first-of-type"),
      (option) => option.textContent,
    ),
    // The picker's own buttons, minus the rows whose text is a catalogue name.
    ...Array.from(
      root.querySelectorAll(
        "button:not([data-vigilia-font-face-row]):not([data-vigilia-font-trio-row])",
      ),
      (button) => button.textContent,
    ),
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
  mountUnitDisplayPanels(root);

  const offered = [
    ...Array.from(
      root.querySelectorAll(
        "[data-vigilia-binding-field$='.unitDisplay'] option",
      ),
      (option) => option.textContent ?? "",
    ),
    ...(await runUnitDisplayOptions(root)),
  ];
  const owned = new Set(copy());
  expect(offered).toHaveLength(8);
  expect(offered.filter((text) => !owned.has(text))).toEqual([]);
});

/**
 * The run editor's four words, read from the list its trigger opens.
 *
 * The control is a Base UI select now, so its options exist in the DOM only
 * while the popup is open — where the chart panel's four are a native select's
 * and are always there. Reading them any other way would read the table the
 * list is built from and agree with itself.
 */
async function runUnitDisplayOptions(root: HTMLElement): Promise<string[]> {
  const trigger = root.querySelector<HTMLElement>(
    "[data-vigilia-run-unit-display]",
  );
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

/**
 * The two panels that offer the unit display options, so the four words have
 * somewhere to be caught when they are written as literals again.
 *
 * Both carry the same four, which is the point: the chart panel had the control
 * and the run panel was written to mirror it, so the words were written twice
 * with nothing joining them.
 *
 * A value run on a reading is the only state that renders the run panel's
 * control; a literal run has no reading to take a unit off.
 */
function mountUnitDisplayPanels(root: HTMLElement): void {
  const gauge = {
    id: "gauge",
    content: {
      family: "gauge" as const,
      settings: {
        startAngle: 90,
        endAngle: -270,
        min: 0,
        max: 100,
        thickness: 10,
        track: { kind: "solid" as const, color: "#000" },
        progress: { kind: "solid" as const, color: "#fff" },
        roundCap: true,
      },
    },
    bindings: [{ id: "g", semanticKey: "ram.used.percent" }],
  };
  const handlers: ChartFieldHandlers = {
    onSettings: vi.fn(),
    onBinding: vi.fn(),
    onAspect: vi.fn(),
    onAddBinding: vi.fn(),
    onRemoveBinding: vi.fn(),
  };
  root.append(
    ...chartContentFields(gauge, undefined, handlers),
    ...chartPaintFields(gauge, undefined, handlers),
  );

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
}

/**
 * Every string the table can produce. A function entry is called with the
 * argument shapes the panels pass it — a count and a name — over the counts
 * this panel renders, which yields a superset of what they show: extra entries
 * only loosen the net, they cannot break it.
 */
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
