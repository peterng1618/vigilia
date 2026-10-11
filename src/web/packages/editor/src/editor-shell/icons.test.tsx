// @vitest-environment jsdom

/**
 * The chrome vocabulary's two invariants: one weight, one family.
 *
 * **The one-weight case reads the rendered DOM, not the source.** `stroke-width`
 * is an attribute lucide writes on the `<svg>` it renders, and the eight card
 * unit diagrams and the Add pane's shape marks write it on theirs, so a scan of
 * the source cannot see a component prop and this reads what the browser would.
 * It is **bounded by what it mounts**: the fleet below draws the vocabulary, the
 * rail, the camera cluster, a pane title, the row's affordances, every kind mark
 * and the whole Add pane. The surfaces it does *not* mount — settings, the
 * keyboard panel, the header menus, the dock, the layer footer, the composition
 * pane, the diagnostic line, the font picker — are covered by Task 9's browser
 * assertion over the built bundle, which is the net that is not bounded by a
 * fixture.
 *
 * **The family case reads the source**, because "hand-authored path" is a
 * property of a file rather than of a render: it names every file that draws a
 * glyph without going through the vocabulary, and every entry there needs §6's
 * reason beside it. The case forbids an unaccounted source, not a particular
 * list.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import { insertGroups } from "../new-object-panel.js";
import { AddPane } from "../panes/add/add-pane.js";
import { KindMark } from "../panes/composition/kind-mark.js";
import { RowAffordances } from "../panes/composition/row-affordances.js";
import type { ViewportManager } from "../viewport-manager/index.js";
import { DisplaySwitch } from "./display-switch.js";
import {
  CHART_BAR_GLYPH,
  CHART_GAUGE_GLYPH,
  CHART_LINE_GLYPH,
  CHART_PIE_GLYPH,
  CHECK_GLYPH,
  ENTER_GLYPH,
  ERROR_GLYPH,
  FIT_GLYPH,
  GLYPH_STROKE_WIDTH,
  Glyph,
  HIDDEN_GLYPH,
  INFO_GLYPH,
  KEYBOARD_GLYPH,
  LEAVE_GLYPH,
  LOCK_GLYPH,
  type LucideIcon,
  MINUS_GLYPH,
  PAGE_GLYPH,
  PALETTE_GLYPH,
  PENCIL_GLYPH,
  PLUS_GLYPH,
  RAIL_GLYPHS,
  SETTINGS_GLYPH,
  STACK_GLYPH,
  STAR_GLYPH,
  TWISTY_GLYPHS,
  VISIBLE_GLYPH,
  WARNING_GLYPH,
} from "./icons.js";
import type { LayerMark, LayerRow } from "./layer-tree.js";
import { Pane } from "./pane.js";
import { Rail } from "./rail.js";

/**
 * The sources allowed to draw a glyph without going through `icons.ts`, each
 * with §6's reason. `icons.ts` is the vocabulary itself and the one chrome
 * reader of `lucide-react`; the theme icons are authored scene geometry rather
 * than chrome; the registry is §6's own authority on action icons; and the two
 * Add-pane sources are §6's unit-tile escape — "a card unit in the Add pane is
 * not arbitrary … so a unit tile may carry a diagram of what it builds", which
 * the shape tiles read too because `SHAPE_KINDS` is fixed the same way.
 */
const EXEMPT_SOURCES: readonly string[] = [
  "editor-shell/icons.ts", // the vocabulary: one family, one weight, one reader of lucide-react
  "new-fabric-theme-icons.ts", // authored scene icons — lucide geometry turned into Fabric paths, not chrome
  "object-actions.ts", // §6: the registry owns which action wears which icon
  "panes/add/add-pane.tsx", // §6: a shape/text tile draws the primitive it builds (§7.8's glyph-led tiles)
  "panes/add/card-diagrams.tsx", // §6: "a unit tile may carry a diagram of what it builds"
];

/** Where the editor's own sources live, from this file's directory. */
const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** An `import type` statement cannot draw a glyph, so it is not a family
 *  breach; a value import from `lucide-react` is. */
const TYPE_IMPORT = /import\s+type\b[^;]*?;/g;
const LUCIDE_IMPORT = /from\s+"lucide-react[^"]*"/;

function sourceFiles(root: string): readonly string[] {
  const found: string[] = [];
  for (const name of readdirSync(root)) {
    if (name === "node_modules") continue;
    const path = join(root, name);
    if (statSync(path).isDirectory()) found.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(name)) found.push(path);
  }
  return found;
}

/**
 * Every source that draws a glyph without the vocabulary: a file that reads
 * `lucide-react` directly, or a file that sets the one weight on an inline
 * `<svg>` of its own. Test files and declarations are not chrome.
 */
function glyphSources(): readonly string[] {
  const found: string[] = [];
  for (const path of sourceFiles(SOURCE_ROOT)) {
    const rel = relative(SOURCE_ROOT, path).replaceAll("\\", "/");
    if (/\.d\.ts$/.test(rel) || /\.test\.tsx?$/.test(rel)) continue;
    const source = readFileSync(path, "utf8");
    const withoutTypes = source.replace(TYPE_IMPORT, "");
    if (
      LUCIDE_IMPORT.test(withoutTypes) ||
      source.includes("GLYPH_STROKE_WIDTH")
    ) {
      found.push(rel);
    }
  }
  return found.sort();
}

it("keeps the family one, so no chrome glyph is a hand-authored path", () => {
  expect(glyphSources()).toEqual(EXEMPT_SOURCES);
});

/** One glyph drawn at a size, and whether it takes §6's fill. */
type Drawn = {
  readonly icon: LucideIcon;
  readonly size: number;
  readonly filled?: boolean;
};

/** Every glyph the vocabulary names, so the case is not satisfied by a surface
 *  that happens to draw only the ones somebody thought of. */
const VOCABULARY: readonly Drawn[] = [
  { icon: STACK_GLYPH, size: 13 },
  { icon: PAGE_GLYPH, size: 14 },
  { icon: PALETTE_GLYPH, size: 14 },
  { icon: PLUS_GLYPH, size: 15 },
  { icon: MINUS_GLYPH, size: 15 },
  { icon: FIT_GLYPH, size: 15 },
  { icon: SETTINGS_GLYPH, size: 17 },
  { icon: CHECK_GLYPH, size: 12 },
  { icon: CHECK_GLYPH, size: 12, filled: true }, // the live check, §6's filled escape
  { icon: ERROR_GLYPH, size: 13 },
  { icon: WARNING_GLYPH, size: 13 },
  { icon: CHART_GAUGE_GLYPH, size: 13 },
  { icon: CHART_LINE_GLYPH, size: 13 },
  { icon: CHART_BAR_GLYPH, size: 13 },
  { icon: CHART_PIE_GLYPH, size: 13 },
  { icon: KEYBOARD_GLYPH, size: 14 },
  { icon: INFO_GLYPH, size: 14 },
  { icon: PENCIL_GLYPH, size: 15 },
  { icon: STAR_GLYPH, size: 13 },
  { icon: STAR_GLYPH, size: 13, filled: true },
  { icon: ENTER_GLYPH, size: 13 },
  { icon: LEAVE_GLYPH, size: 13 },
  { icon: VISIBLE_GLYPH, size: 15 },
  { icon: HIDDEN_GLYPH, size: 15 },
  { icon: LOCK_GLYPH.locked.icon, size: 15, filled: true },
  { icon: LOCK_GLYPH.unlocked.icon, size: 15 },
  { icon: RAIL_GLYPHS.composition, size: 17 },
  { icon: RAIL_GLYPHS.add, size: 17 },
  { icon: RAIL_GLYPHS.tokens, size: 17 },
  { icon: RAIL_GLYPHS.document, size: 17 },
  { icon: TWISTY_GLYPHS.collapsed, size: 13 },
  { icon: TWISTY_GLYPHS.expanded, size: 13 },
];

/** Every mark a row can carry, so the chart and group arms are drawn too. */
const MARKS: readonly LayerMark[] = [
  { kind: "text", text: "Heading", family: undefined, weight: undefined },
  { kind: "chart", family: "gauge" },
  { kind: "shape", paint: undefined },
  { kind: "image", src: undefined },
  { kind: "group" },
];

function row(over: Partial<LayerRow> = {}): LayerRow {
  return {
    id: "row-1",
    name: "Row",
    kind: "group",
    mark: { kind: "group" },
    role: { kind: "group", unit: undefined },
    bound: [],
    depth: 0,
    parentId: undefined,
    hasChildren: false,
    collapsed: false,
    visible: true,
    locked: true,
    selected: false,
    ...over,
  };
}

/** A camera that answers every read and does nothing on a write: the cluster
 *  renders its three controls and no more. */
function camera(): ViewportManager {
  return {
    zoom: () => 1,
    zoomBy: () => {},
    zoomToFit: () => {},
    zoomToSelection: () => {},
    reset: () => {},
    display: () => undefined,
    showDisplay: () => {},
    isFitted: () => false,
    onChange: () => () => {},
  } as unknown as ViewportManager;
}

function Fleet(): React.JSX.Element {
  return (
    <>
      {VOCABULARY.map((drawn, index) => (
        <Glyph key={index} {...drawn} />
      ))}
      <Rail
        slot="composition"
        collapsed={false}
        onChoose={() => {}}
        onOpenSettings={() => {}}
      />
      <DisplaySwitch
        viewport={camera()}
        artboard={() => ({ width: 1920, height: 1080 })}
      />
      <Pane id="fleet" title="Fleet" icon={STACK_GLYPH}>
        <div />
      </Pane>
      <RowAffordances
        row={row()}
        attended
        onRename={() => {}}
        onToggleVisible={() => {}}
        onToggleLocked={() => {}}
      />
      {MARKS.map((mark) => (
        <KindMark key={mark.kind} mark={mark} />
      ))}
      <AddPane groups={insertGroups()} onInsert={() => {}} />
    </>
  );
}

const mounted: Root[] = [];
afterEach(async () => {
  while (mounted.length > 0) {
    const root = mounted.pop();
    if (root !== undefined) await act(async () => root.unmount());
  }
  document.body.innerHTML = "";
});

/** Every `<svg>` the fleet drew. */
function renderedGlyphs(): readonly SVGSVGElement[] {
  return [...document.querySelectorAll("svg")];
}

it("draws every chrome glyph at the one weight", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  mounted.push(root);
  act(() => root.render(<Fleet />));

  const glyphs = renderedGlyphs();
  // A guard that asserted over nothing would pass for the wrong reason.
  expect(glyphs.length).toBeGreaterThan(20);
  const weights = [
    ...new Set(glyphs.map((svg) => svg.getAttribute("stroke-width"))),
  ];
  // The values themselves rather than their count, so a planted weight fails
  // naming both it and the vocabulary's own.
  expect(weights).toEqual([String(GLYPH_STROKE_WIDTH)]);
  const [only] = weights;
  expect(Number(only)).toBeGreaterThanOrEqual(1.6);
  expect(Number(only)).toBeLessThanOrEqual(1.8);
});
