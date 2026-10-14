import type { Page, TestInfo } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { writeThemePackage } from "@vigilia/theme-package";
import {
  COMPOSITION_ACCENT,
  COMPOSITION_WARN,
} from "./composition-panel-fixture.js";
import {
  type ArtboardRect,
  answerDialogIfShown,
  captureVisualReview,
  clientOfScene,
  enterLayer,
  readSceneObject,
} from "./editor-canvas.js";
import { openPane } from "./editor-rail.js";
import { selectLayer } from "./rebuild-driver.js";
import { rulePx } from "./shell-tokens.js";
import { isDesktopSurface } from "./surface.js";

/**
 * The composition panel's browser contract, against the real editor.
 *
 * This file is the composition panel's, not the rail's: `editor-rail.spec.ts`
 * owns the shared `openPane` helper, and every case here addresses the
 * panel's own markers — `data-vigilia-layer`, `data-vigilia-layer-mark`,
 * `data-vigilia-layer-role` and `.vigilia-layer-name`.
 *
 * Which task owns which case:
 * - **Task 3** owns the first two cases below: what the row's role costs the row's width,
 *   and that every row still carries its role and its mark at the same height.
 * - Task 5 adds the row's enter control; Task 6 the route into a group's parts.
 * - **Task 8** owns the third case: the Document pane stays reachable while
 *   something is selected.
 * - **Task 10** owns the rest: the row's bound column, selecting and entering as
 *   two acts (both read back through the bridge), the right column's three
 *   states, and the two-hundred-row re-measurement — one document, one viewport,
 *   one machine, which is what the case says of its own numbers. Three of these
 *   cases carry the captures registered in `docs/evidence/screenshots/README.md`.
 * - **Plan 5's Task 6** owns the two cases at the end of this file: the role
 *   column saying what the document says a card is, on the starter and on a copy
 *   inserted beside it.
 *
 * The editor is a separate preview server on its own port, so `use.baseURL` —
 * 4173, the player — is never the right address here.
 */

const EDITOR = "http://127.0.0.1:4174/";

/** The layer row's third `:has` arm — the one that reserves room for three
 *  controls, which is the most a row can draw — read from the stylesheet so the
 *  arm's reservation and this spec's expectation stay one fact rather than two
 *  numbers kept in step by hand. **It was the fourth arm until `vg-462` took the
 *  rename pen off the row**; the fourth arm is still in the stylesheet with no
 *  row that can match it, filed rather than deleted because the register's own
 *  recordings cite it. */
const THREE_CONTROL_ARM =
  ".vigilia-layer-row:has(.vigilia-layer-state button:nth-child(3))";

/** The row's own padding, which the arm's reservation includes and the slot's
 *  own footprint does not. The in-page measurement subtracts the same value. */
const LAYER_ROW_PADDING_PX = 4;

/** The slot's own footprint with three controls: 6px of padding, three
 *  §3-rhythm 26px squares and two 4px gaps — the arm's reservation less the
 *  row's own padding. The four-control figures this replaces are the closed
 *  plan `2026-10-08-the-panes` report's, taken while the rename pen existed,
 *  and `vg-260` carries the measurement. */
const THREE_CONTROL_SLOT_PX =
  rulePx(THREE_CONTROL_ARM, "padding-right") - LAYER_ROW_PADDING_PX;

/** The mark column's slot, sized on `.vigilia-layer-mark` itself. */
const MARK_SLOT_PX = rulePx(".vigilia-layer-mark", "flex");

/**
 * The column this plan supersedes: plan 2 shipped a 360px pane, and the design
 * language's §7.3 fixes the pane at 246px, so this is the width the shipped one
 * is now compared against. It is a comparison point for this case, never an
 * assertion about what ships — the shipped width is whatever `editor-shell.css`
 * says, and the case reads it rather than restating it.
 */
const SUPERSEDED_WIDTH = 360;

// Playwright's headless default argument hides the scrollbars, which would
// measure a panel whose list never pays for one — and the panel's own record was
// taken with the scrollbar in place. The list here overflows at every width
// tested, so this is the difference between the author's layout and a wider one.
test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

/** Every group open, counted down so a tree that keeps producing twisties cannot spin. */
async function openEveryGroup(page: Page): Promise<void> {
  const twisties = page.locator(
    '[data-vigilia-layer] button[aria-label^="Expand"]',
  );
  for (let opened = await twisties.count(); opened > 0; opened -= 1) {
    await twisties.first().click();
  }
}

/**
 * The measurement the stylesheet's comment records: a name is clipped when its
 * own content is wider than the box it was given. A number, not a judgement.
 */
async function clippedNames(page: Page): Promise<{
  readonly clipped: number;
  readonly total: number;
}> {
  // The mark's own clipping was counted here beside the name's, for the ruling
  // that traded the kind slot's width against it (`vg-260`). A glyph cannot
  // clip, so that half is gone with the specimens it measured: the mark column
  // pays for the narrowing and no longer pays with legibility.
  return page.locator(".vigilia-layer-name").evaluateAll((all) => ({
    clipped: all.filter((name) => name.scrollWidth > name.clientWidth).length,
    total: all.length,
  }));
}

/**
 * A measurement is taken on a layout, and the layout is the product's, so the
 * instruments are applied as a stylesheet rather than by mutating the document
 * the panel reads. An empty `css` removes the instrument.
 */
async function instrument(page: Page, key: string, css: string): Promise<void> {
  await page.evaluate(
    ({ id, text }) => {
      document.getElementById(id)?.remove();
      if (text === "") return;
      const style = document.createElement("style");
      style.id = id;
      style.textContent = text;
      document.head.append(style);
    },
    { id: `composition-panel-${key}`, text: css },
  );
}

/** The record's own viewport. Playwright's is 1280×720, which is a different layout. */
async function openStarterEditor(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(EDITOR);
  await expect(
    page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
  ).toBeVisible();
  await expect(page.locator("[data-vigilia-layer]").first()).toBeVisible();
  await openEveryGroup(page);
}

test("every row carries a role and a mark, and the role adds no height", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await openStarterEditor(page);

  const rows = page.locator("[data-vigilia-layer]");
  const rowCount = await rows.count();
  expect(rowCount, "the starter's tree, every group open").toBeGreaterThan(1);

  // One role per row, and never the empty string: a row whose role said nothing
  // would be a row whose kind is unstated on four kinds in five (the mark beside
  // the name is `aria-hidden` or absent).
  const roles = page.locator(".vigilia-layer-role");
  await expect(roles).toHaveCount(rowCount);
  for (const text of await roles.allTextContents()) {
    expect(text.trim().length, "a role that says nothing").toBeGreaterThan(0);
  }

  // A mark *slot* on every row, even where the treatment inside it is nothing —
  // that slot is what lines the names up.
  await expect(page.locator(".vigilia-layer-mark")).toHaveCount(rowCount);

  // The role is `flex: none`, so it is never the element that gives up width.
  // What it must not do instead is leave the row's box: the row clips its
  // overflow, so a role pushed past the edge is a role the author cannot read.
  const overflowing = await page
    .locator("[data-vigilia-layer]")
    .evaluateAll((elements) =>
      elements
        .map((row) => ({
          name: row.querySelector(".vigilia-layer-name")?.textContent ?? "",
          slack:
            row.getBoundingClientRect().right -
            (row.querySelector(".vigilia-layer-role")?.getBoundingClientRect()
              .right ?? Number.NEGATIVE_INFINITY),
        }))
        .filter((row) => row.slack < 0)
        .map((row) => row.name),
    );
  expect(overflowing, "roles pushed out of their own row").toEqual([]);

  // One line per row: the role added a column and not a second line, and the
  // row is the control set's 26px panel rhythm (§3) because the controls it
  // draws on hover are 26px squares.
  const heights = await rows.evaluateAll((elements) =>
    elements.map((row) => Math.round(row.getBoundingClientRect().height)),
  );
  expect(new Set(heights).size, "every row is the same height").toBe(1);
  expect(heights[0], "the row's height, unchanged by the role").toBe(26);
});

/**
 * `vg-265`: the row's state slot is absolutely positioned over the row's right
 * edge and always carries its own surface, so the slot covers the last glyphs
 * of the role on a row that draws no key — the role is *covered*, not clipped,
 * which is why the case above (the role's box against the row's right edge)
 * passes while the glyphs are gone, and why the check has to be geometric.
 */
test("the state slot does not cover the role, at rest or with the row attended", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await openStarterEditor(page);

  // `openEveryGroup` clicks twisties, and the row it last clicked keeps both
  // the pointer and the focus — either one attends it and draws its controls,
  // so the state below would not be the one the captures beside the drawings
  // were taken in. The pointer goes to the stage, and the focus goes nowhere.
  await page.mouse.move(900, 400);
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());

  // The role's box against the slot's, on every row, with nothing selected and
  // nothing hovered. This is the state `vg-265` measured — the slot painted its
  // own surface whether or not it held a control, so every row's role lost its
  // last glyphs to a six-pixel block that drew nothing.
  const rows = page.locator("[data-vigilia-layer]");
  const overlaps = (): Promise<
    readonly { readonly name: string; readonly overlap: number }[]
  > =>
    rows.evaluateAll((elements) =>
      elements
        .map((row) => {
          const role = row
            .querySelector(".vigilia-layer-role")
            ?.getBoundingClientRect();
          const slot = row
            .querySelector(".vigilia-layer-state")
            ?.getBoundingClientRect();
          if (role === undefined || slot === undefined) return undefined;
          return {
            name: row.querySelector(".vigilia-layer-name")?.textContent ?? "",
            // A slot drawing no control paints nothing whatever its box says,
            // so the threshold is for fractional layout rather than for
            // coverage: the half-pixel a zero-width box can land on is not a
            // covered glyph.
            overlap: Math.round((role.right - slot.left) * 10) / 10,
          };
        })
        .filter((row) => row !== undefined && row.overlap > 0.5),
    );

  expect(
    await overlaps(),
    "rows whose role the slot paints over at rest",
  ).toEqual([]);

  // The attended row is a second defect and is NOT this one: there the slot
  // holds real controls, and on a row whose reserved strip is wider than what
  // its columns can spare — a group's four controls, or a chart's three — the
  // in-flow line overflows under them, because the mark, the name's 6ch floor
  // and the role are each recorded as never giving way. Which of the three
  // yields is a design question, and it is filed as `vg-447`; this case asserts
  // the state `vg-265` measured and the three captures beside the drawings show.
});

test("the shipped column is DESIGN.md's, and its clipping is measured against the one it supersedes", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await openStarterEditor(page);

  const shipped = await clippedNames(page);
  expect(shipped.total, "the names measured are the rows the DOM has").toBe(
    await page.locator("[data-vigilia-layer]").count(),
  );

  // The same width with the role taken out of the row: the role is paid for out
  // of the name, so this is the delta the case is really about, re-taken on this
  // machine and this font stack rather than restated.
  await instrument(page, "no-role", ".vigilia-layer-role { display: none; }");
  const withoutRole = await clippedNames(page);
  await instrument(page, "no-role", "");

  // And the column this plan supersedes — plan 2's 360px — so the shipped
  // column's cost is a delta between two runs of this case rather than a promise
  // about a comment. The shipped 246px is the *narrower* one, so the direction
  // is now the opposite of the one the superseded width recorded.
  await instrument(
    page,
    "superseded",
    // The rail's 46px column, then the superseded panel width: the body's areas
    // are rail/panel/stage/inspector, so the override carries the rail column
    // too or the four areas and three tracks do not match. The inspector is
    // restated at its real 276px so the pane width is the only variable.
    `.editor-shell-body { grid-template-columns: 46px ${SUPERSEDED_WIDTH}px minmax(0, 1fr) 276px; }`,
  );
  const superseded = await clippedNames(page);
  await instrument(page, "superseded", "");

  // **And the mark slot's own trade, which is what the 2026-10-12 ruling turned
  // on.** The ruling narrowed the kind slot to 20px so the name keeps its room
  // and the mark pays; the instrument is the slot's own declaration and nothing
  // else, so the width is the only variable — and the width the product ships is
  // the 28px the ruling's own measurement held (`vg-260`), which is why the
  // *instrument* is the narrow side here. What the mark pays is now only room: a
  // glyph does not clip, so this run prices the names' half of the trade.
  await instrument(page, "mark-20", ".vigilia-layer-mark { flex: 0 0 20px; }");
  const narrowMark = await clippedNames(page);
  await instrument(page, "mark-20", "");

  // The role is paid for out of the name, so taking it out can only unclip
  // names; and the shipped column is the narrower one, so it clips at least as
  // many as the column it supersedes. Both are directions, not pixel values: the
  // exact count belongs to one font stack, and it lives in the stylesheet's
  // comment and the commit that measured it.
  expect(shipped.clipped).toBeGreaterThanOrEqual(withoutRole.clipped);
  expect(shipped.clipped).toBeGreaterThanOrEqual(superseded.clipped);
  // The narrowing's direction: a narrower slot can only unclip names. It is a
  // direction rather than a pixel value for the reason the pair above is — the
  // count belongs to one font stack — and the counts themselves are recorded
  // below rather than asserted, because what they show is the size of the trade
  // rather than a pass condition.
  expect(
    narrowMark.clipped,
    "the narrower slot unclips names rather than clipping more of them",
  ).toBeLessThanOrEqual(shipped.clipped);

  for (const [type, value] of [
    ["rows", shipped.total],
    ["clipped@shipped", shipped.clipped],
    ["clipped@shipped-without-role", withoutRole.clipped],
    [`clipped@${SUPERSEDED_WIDTH}`, superseded.clipped],
    ["mark-slot-px", String(MARK_SLOT_PX)],
    ["clipped@mark-20px", String(narrowMark.clipped)],
  ] as const) {
    testInfo.annotations.push({ type, description: String(value) });
  }
});

test("keeps the document's own controls reachable while a card is selected", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await openStarterEditor(page);

  // The state the old Design tab showed the theme's own panel under the
  // selection column in: a card selected, its fields in the right column.
  await page.locator('[data-vigilia-layer="group-cpu-card"]').click();
  await expect(page.locator('[data-vigilia-panel="selection"]')).toBeVisible();

  await openPane(page, "Document");

  // The artboard's controls and the document's own resolved tokens are both in
  // this pane, with the selection still standing. Neither is behind the
  // selection's surface, so neither can be hidden by making a selection — the
  // property the `keepMounted` Design tab used to carry.
  await expect(page.locator("[data-vigilia-artboard-width]")).toBeVisible();
  await expect(page.locator("[data-vigilia-globals]")).toBeVisible();

  // **And the tokens are resolved, not merely listed.** The section is the
  // document's own references read back through the document's palette, so a
  // count of zero rows would mean a heading over nothing. Read from the DOM
  // rather than restated: the starter declares nine palette tokens, and this
  // counts whatever it is given.
  const resolved = page.locator(
    "[data-vigilia-globals] [data-vigilia-resolution]",
  );
  const tokenCount = await resolved.count();
  expect(tokenCount, "the document's own tokens").toBeGreaterThan(0);
  const resolutionTexts = await resolved.allTextContents();
  for (const text of resolutionTexts) {
    expect(text.trim().length, "a row with a reference on it").toBeGreaterThan(
      0,
    );
  }
  // Every entry a token, resolved to a value: `resolutionValue` builds
  // `label: ref → value`, and an unresolvable one says `(unresolved)` instead.
  const resolving = resolutionTexts.filter((text) => text.includes("→"));
  expect(resolving.length, "tokens resolved to a value").toBeGreaterThan(0);

  await captureVisualReview(page, testInfo, "composition-panel-document");
});

// ---------------------------------------------------------------------------
// Task 10: the panel's whole contract, and the two hundred
// ---------------------------------------------------------------------------

/**
 * The active object's id, read through the bridge rather than off the panel.
 *
 * **A panel that agrees with itself is not evidence.** The layer panel's own
 * `data-selected` would pass whether or not the canvas ever received the click,
 * so every claim about what is selected here is a read of
 * `canvas.getActiveObject()`. The id is read with `get("id")` because that is
 * where `layer-tree`'s `findById` reads it, so the two cannot drift.
 */
async function activeId(page: Page): Promise<string | undefined> {
  return page.evaluate(() => {
    const bridge = (
      window as unknown as {
        vigiliaEditorBridge?: {
          editor: {
            canvas: {
              getActiveObject(): { get(name: string): unknown } | undefined;
            };
          };
        };
      }
    ).vigiliaEditorBridge;
    const id = bridge?.editor.canvas.getActiveObject()?.get("id");
    return typeof id === "string" ? id : undefined;
  });
}

/** The selection's kind, from the bridge's own snapshot: `chart` is a fact the
 *  object carries rather than a string this spec decided. */
async function activeKind(page: Page): Promise<string | undefined> {
  return page.evaluate(() => {
    const bridge = (
      window as unknown as {
        vigiliaEditorBridge?: { snapshot(): { readonly activeKind: string } };
      }
    ).vigiliaEditorBridge;
    return bridge?.snapshot().activeKind;
  });
}

/** Ids of the entered group, as the grouping manager records them. */
async function enteredGroups(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => {
    const bridge = (
      window as unknown as {
        vigiliaEditorBridge?: { groupContext(): readonly string[] };
      }
    ).vigiliaEditorBridge;
    return bridge?.groupContext() ?? [];
  });
}

/**
 * A client point inside the stage but outside the fitted artboard.
 *
 * Clicking there resolves to no object, and Fabric's own rule clears the
 * selection when `findTarget` finds nothing — so this is a pointer deselect
 * rather than a `discardActiveObject()` call from outside the product. The
 * point is taken in the `contain` fit's own margin, at the stage's left edge,
 * so it cannot land on the dock (bottom-centre) or the arrange bar (top-centre).
 */
async function emptyStagePoint(page: Page): Promise<{ x: number; y: number }> {
  const rect = await page.evaluate(() =>
    (
      window as unknown as {
        vigiliaEditorBridge: {
          editor: {
            viewport: {
              artboardScreenRect(): {
                left: number;
                top: number;
                width: number;
                height: number;
              };
            };
          };
        };
      }
    ).vigiliaEditorBridge.editor.viewport.artboardScreenRect(),
  );
  const box = (await page
    .locator("#vigilia-fabric-editor canvas.upper-canvas")
    .boundingBox())!;
  const below = box.height - (rect.top + rect.height);
  const above = rect.top;
  const right = box.width - (rect.left + rect.width);
  if (below >= 12)
    return { x: box.x + 8, y: box.y + rect.top + rect.height + below / 2 };
  if (above >= 12) return { x: box.x + 8, y: box.y + above / 2 };
  if (right >= 12)
    return { x: box.x + rect.left + rect.width + right / 2, y: box.y + 40 };
  throw new Error("the fitted artboard has no margin to click in");
}

/** Clears the selection the way a pointer does, and waits on the canvas. */
async function deselect(page: Page): Promise<void> {
  const point = await emptyStagePoint(page);
  await page.mouse.click(point.x, point.y);
  await expect.poll(() => activeId(page)).toBeUndefined();
}

/** The object's own authored box, read off the Fabric object by id. */
async function authoredBox(
  page: Page,
  id: string,
): Promise<{ left: number; top: number; width: number; height: number }> {
  return page.evaluate((wanted) => {
    type Obj = {
      id?: string;
      left?: number;
      top?: number;
      width?: number;
      height?: number;
      scaleX?: number;
      scaleY?: number;
      getObjects?(): readonly Obj[];
    };
    const objects = (
      window as unknown as {
        vigiliaEditorBridge: {
          editor: { canvas: { getObjects(): readonly Obj[] } };
        };
      }
    ).vigiliaEditorBridge.editor.canvas.getObjects();
    const find = (list: readonly Obj[]): Obj | undefined => {
      for (const candidate of list) {
        if (candidate.id === wanted) return candidate;
        const found = find(candidate.getObjects?.() ?? []);
        if (found !== undefined) return found;
      }
      return undefined;
    };
    const object = find(objects);
    if (object === undefined) throw new Error(`no object with id ${wanted}`);
    return {
      left: object.left ?? 0,
      top: object.top ?? 0,
      width: (object.width ?? 0) * (object.scaleX ?? 1),
      height: (object.height ?? 0) * (object.scaleY ?? 1),
    };
  }, id);
}

/**
 * Whether a row's box is inside the panel's scrolling box right now — the
 * question `isVisible()` does not answer, because a row scrolled past the end is
 * still visible in the CSS sense.
 */
async function rowInScroller(page: Page, id: string): Promise<boolean> {
  return page.evaluate((rowId) => {
    const scroller = document.querySelector<HTMLElement>(".editor-shell-panel");
    const row = document.querySelector<HTMLElement>(
      `[data-vigilia-layer="${rowId}"]`,
    );
    if (scroller === null || row === null) return false;
    const outer = scroller.getBoundingClientRect();
    const inner = row.getBoundingClientRect();
    return inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1;
  }, id);
}

/** Whole milliseconds since `started`, for a wall-clock reading. */
function msSince(started: number): number {
  return Date.now() - started;
}

/** One decimal, so a delta printed into the report is the one asserted on. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * One rectangle of the loose documents, painted through a declared token: a
 * literal `fill` with no `vigiliaPaint` reference is `unresolved-global-ref`,
 * and `writeThemePackage` refuses the package before the editor ever opens it.
 */
function looseRect(
  id: string,
  left: number,
  top: number,
): Record<string, unknown> {
  return {
    type: "Rect",
    id,
    left,
    top,
    width: 44,
    height: 44,
    fill: COMPOSITION_ACCENT,
    vigiliaPaint: { fill: "palette.accent" },
    originX: "left",
    originY: "top",
  };
}

/**
 * Plan 1's own document, rebuilt: **200 loose rects in a 20x10 grid with no
 * group anywhere**.
 *
 * **The generator did not survive**; the recipe is prose, so this is written
 * from the record rather than recovered. Order is kept because it is load
 * bearing — `projectLayers` walks `[...objects].reverse()`, so an array of
 * `shape-0 .. shape-199` renders `shape-199` first and `shape-0` last, which is
 * exactly what plan 1's probe recorded in `rowsPresent.first` / `.last`.
 */
function looseGrid(count: number, columns = 20): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, index) =>
    looseRect(
      `shape-${index}`,
      24 + (index % columns) * 62,
      24 + Math.floor(index / columns) * 66,
    ),
  );
}

/** One group with five parts — the case plan 1 explicitly did not cover. */
function partGroup(
  id: string,
  left: number,
  top: number,
): Record<string, unknown> {
  return {
    type: "Group",
    id,
    name: id,
    left,
    top,
    width: 40,
    height: 40,
    originX: "left",
    originY: "top",
    objects: Array.from({ length: 5 }, (_, index) => ({
      ...looseRect(`inside-${index}`, index * 6, 0),
      width: 30,
      height: 30,
    })),
  };
}

/** A valid `.vigilia-theme` package around one scene. */
function packageBytes(
  id: string,
  objects: readonly Record<string, unknown>[],
  bindings: Readonly<
    Record<string, readonly { id: string; semanticKey: string }[]>
  > = {},
): Buffer {
  const result = writeThemePackage({
    envelope: {
      schemaVersion: 2,
      fabricVersion: "7.4.0",
      id,
      metadata: { themeLanguage: "en" },
      artboard: { width: 1280, height: 720 },
      globals: {
        palette: {
          none: {
            name: "None",
            value: { kind: "solid", color: "transparent" },
          },
          accent: {
            name: "Accent",
            value: { kind: "solid", color: COMPOSITION_ACCENT },
          },
          warn: {
            name: "Warn",
            value: { kind: "solid", color: COMPOSITION_WARN },
          },
        },
      },
      bindings,
      scene: { version: "7.4.0", objects },
    },
    assets: {},
  });
  if (!result.ok) throw new Error(result.message);
  return Buffer.from(result.bytes);
}

/**
 * Opens a theme package **the way an author does**, and answers with the
 * milliseconds the editor took to read it.
 *
 * **Plan 1's probe "dropped" its document in, and this product has no drop
 * route.** `dragover`/`drop` appears in exactly one place under
 * `packages/editor` — the layer panel's own row reorder — and nothing on the
 * editor accepts an OS file drop, so a synthesised drop would prove a route
 * nobody can take. That is the failure `chooseAssetFile` was written about, met
 * from the other side.
 *
 * The route below is the one an author has: `File ▸ Open package` calls
 * `session.openPackage()`, which asks the dirty-document guard (the editor opens
 * on the starter, which nobody has saved) and then clicks the hidden
 * `input[accept=".vigilia-theme"]`. Answering the **chooser event** it opens,
 * rather than `setInputFiles` on the input, is what keeps the menu item and the
 * guard inside the path being measured.
 */
async function openPackageWithTiming(
  page: Page,
  name: string,
  bytes: Buffer,
): Promise<number> {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.getByRole("menuitem", { name: "Open package" }).click();
  await answerDialogIfShown(page, "Discard");
  const started = Date.now();
  await (await chooser).setFiles({
    name,
    mimeType: "application/octet-stream",
    buffer: bytes,
  });
  await expect(page.locator("#status")).toContainText(`Opened ${name}`);
  return msSince(started);
}

/** The editor on its own viewport, with nothing selected and nothing replaced. */
async function openBareEditor(page: Page): Promise<void> {
  await page.goto(EDITOR);
  await expect(
    page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
  ).toBeVisible();
  await expect(page.locator("[data-vigilia-layer]").first()).toBeVisible();
}

/** The viewport a measurement was taken at, which every number below needs. */
function viewportOf(testInfo: TestInfo): string {
  const viewport = testInfo.project.use.viewport;
  return viewport == null ? "default" : `${viewport.width}x${viewport.height}`;
}

test("carries the document's binding, and selecting a card and entering it are separate acts", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await openStarterEditor(page);

  // **The count is the DOM's, not a remembered number.** A spec that asserted
  // eight rows would go on passing while the starter gained or lost cards; the
  // three columns are compared against the row count read here, at assertion
  // time, rather than against a figure written into this file.
  const rows = page.locator("[data-vigilia-layer]");
  const rowCount = await rows.count();
  expect(rowCount, "the starter's tree, every group open").toBeGreaterThan(1);
  await expect(page.locator(".vigilia-layer-mark")).toHaveCount(rowCount);
  await expect(page.locator("[data-vigilia-layer-role]")).toHaveCount(rowCount);

  // **The bound column, where the document declares a binding.** The panel
  // prints nothing at all on a row that reads nothing, so this is a count
  // *less than* the rows — never a word repeated down the column.
  const boundCells = page.locator(".vigilia-layer-bound");
  const boundCount = await boundCells.count();
  expect(boundCount, "rows that read something").toBeGreaterThan(0);
  expect(boundCount, "rows that read nothing carry no cell").toBeLessThan(
    rowCount,
  );
  for (const text of await boundCells.allTextContents()) {
    expect(text.trim().length).toBeGreaterThan(0);
  }
  // **The key is the document's, not one this spec typed beside the object.**
  // `new-fabric-theme.ts` declares `cpu-card-sparkline` reads `cpu.load`, and
  // the row the panel draws for that object has to say so.
  await expect(
    page.locator(
      '[data-vigilia-layer="cpu-card-sparkline"] .vigilia-layer-bound',
    ),
  ).toHaveText("cpu.load");

  // **Selecting a card and entering it are two acts.** The first click picks
  // the card up — read back from the canvas, so a panel that merely painted a
  // row does not pass — and selects the *group*, not a part of it.
  await selectLayer(page, "group-cpu-card");
  await expect.poll(() => activeId(page)).toBe("group-cpu-card");
  expect(await activeKind(page), "a card is a group").toBe("group");

  // The second act is the entry control, a different gesture on a different
  // target: `enterLayer` hovers the row and clicks the button, and waits on the
  // bridge's own `groupContext()` naming the card.
  await enterLayer(page, "group-cpu-card");
  expect(await enteredGroups(page)).toContain("group-cpu-card");

  await captureVisualReview(page, testInfo, "composition-panel-starter");

  // And now the part's row is reachable: the same click that selected the card
  // a moment ago selects the sparkline inside it. The kind comes from the
  // bridge's snapshot rather than from the panel's own mark.
  await selectLayer(page, "cpu-card-sparkline");
  await expect.poll(() => activeId(page)).toBe("cpu-card-sparkline");
  expect(await activeKind(page), "the sparkline is a chart").toBe("chart");
});

test("the right column names where to choose from, and empties when nothing is selected", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await openStarterEditor(page);

  const column = page.locator('[data-vigilia-panel="selection"]');
  const emptyLine = page.locator("[data-vigilia-nothing-selected]");
  const nameField = page.locator("[data-vigilia-name]");

  // Nothing selected on open: the line that says where to choose from, and no
  // field at all. Both halves matter — a line over a live form says two things.
  await expect(emptyLine).toBeVisible();
  await expect(nameField).toHaveCount(0);

  // A shape fills the column. The card's own rectangle is a `Rect`, reached by
  // entering the card first, which is what makes it selectable on its own.
  await enterLayer(page, "group-cpu-card");
  await selectLayer(page, "cpu-card");
  await expect.poll(() => activeId(page)).toBe("cpu-card");
  await expect(column).toBeVisible();
  await expect(nameField).toBeVisible();
  await expect(page.locator("[data-vigilia-panel-fill]")).toBeVisible();
  await expect(emptyLine).toHaveCount(0);

  // **Clearing the selection empties the column.** A stray click leaves the
  // author with nothing selected, and the column says so rather than going on
  // describing an object no other surface has marked. The canvas really is
  // empty, and that half is read from the canvas rather than inferred from the
  // column, so the two statements have their own owners.
  //
  // The one case that does *not* empty is a history restore, which drops
  // Fabric's selection as a side effect of rebuilding the scene; the fields
  // re-bind by Vigilia id so an undo does not throw away the panel the author
  // was working in. That path is pinned in `index.dom.test.ts` — Undo is only
  // offered while something is selected, so it cannot be reached from here.
  await deselect(page);
  expect(await activeId(page), "the canvas holds no selection").toBeUndefined();
  await expect(
    emptyLine,
    "a deselect must leave the column naming where to choose from",
  ).toBeVisible();
  await expect(
    nameField,
    "and the column must not go on describing the dropped object",
  ).toHaveCount(0);

  // Deleting the object empties it too, by a different route — the canvas's
  // own `object:removed` rather than the selection event. A **top-level**
  // object, so the removal is the canvas's own rather than a group's; and the
  // column's own footer carries the verb, which it only offers while something
  // is selected.
  await selectLayer(page, "wordmark");
  await expect.poll(() => activeId(page)).toBe("wordmark");
  await page
    .locator('[data-vigilia-layer-actions] [aria-label="Delete"]')
    .click();
  await expect.poll(() => activeId(page)).toBeUndefined();
  await expect(emptyLine).toBeVisible();
  await expect(nameField).toHaveCount(0);
});

/**
 * Whether the document still holds an object with this id, **at any depth**.
 *
 * The case above deletes a root object, where the canvas's own `remove` is the
 * only owner that could be involved. A part of a group is a different route:
 * `deletion-manager`'s `deleteActive` resolves the object's own `parent` and
 * asks *that* to remove it, and the question `vg-158` left open is whether a
 * delete reached the document at all or stopped at the layer projection.
 */
async function documentHolds(page: Page, id: string): Promise<boolean> {
  return page.evaluate((wanted) => {
    type Obj = { id?: string; getObjects?(): readonly Obj[] };
    const objects = (
      window as unknown as {
        vigiliaEditorBridge: {
          editor: { canvas: { getObjects(): readonly Obj[] } };
        };
      }
    ).vigiliaEditorBridge.editor.canvas.getObjects();
    const holds = (list: readonly Obj[]): boolean =>
      list.some(
        (candidate) =>
          candidate.id === wanted || holds(candidate.getObjects?.() ?? []),
      );
    return holds(objects);
  }, id);
}

/** Every layer row's id, in the panel's own order. */
async function layerIds(page: Page): Promise<readonly string[]> {
  return page
    .locator("[data-vigilia-layer]")
    .evaluateAll((rows) =>
      rows.map((row) => row.getAttribute("data-vigilia-layer") ?? ""),
    );
}

test("deleting a part inside a group empties the right column too", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  // **`vg-158`, measured at 42169371 and never reproduced as a case.** Deleting
  // `cpu-card` from inside `group-cpu-card` through the layer panel left the
  // right column still describing it, while deleting a top-level object emptied
  // it — which the case above pins. Two readings fit that measurement and this
  // case separates them: either the column's binding was stale, or the delete
  // stopped at the projection and the object is still in the document, in which
  // case `selection-inspector` keeping the last object while `objectById` still
  // finds its id is behaving as designed and the removal is the defect. The row
  // also noted the second reading would be `vg-156`'s disagreement seen from the
  // other side: rows and objects disagreeing about what the document holds.
  await openStarterEditor(page);

  const emptyLine = page.locator("[data-vigilia-nothing-selected]");
  const nameField = page.locator("[data-vigilia-name]");

  // Reached the way the case above reaches a part: entering the group is what
  // puts its parts on their own rows.
  await enterLayer(page, "group-cpu-card");
  await selectLayer(page, "cpu-card");
  await expect.poll(() => activeId(page)).toBe("cpu-card");
  await expect(nameField).toBeVisible();
  expect(
    await documentHolds(page, "cpu-card"),
    "the part is in the document",
  ).toBe(true);

  await page
    .locator('[data-vigilia-layer-actions] [aria-label="Delete"]')
    .click();

  // The document first, because it is the reading the row could not take: a row
  // that disappeared from the list while its object survived is the failure
  // this case exists to tell apart from a stale column.
  await expect
    .poll(() => documentHolds(page, "cpu-card"), {
      message: "the part left the document, not only the list",
    })
    .toBe(false);
  await expect.poll(() => layerIds(page)).not.toContain("cpu-card");
  await expect.poll(() => activeId(page)).toBeUndefined();
  await expect(
    emptyLine,
    "and the column names where to choose from rather than the deleted part",
  ).toBeVisible();
  await expect(nameField).toHaveCount(0);
});

test("two hundred loose shapes, re-measured", async ({ page }, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  // **The suite's own viewport, not the one the starter cases use.** Plan 1's
  // probe recorded no viewport at all — its `scroll.clientHeight` is 721, which
  // is taller than this project's 1280x720 stage, so it very likely did not run
  // here, but that is an inference from one number and not a record. This case
  // therefore claims no comparability with plan 1's 721 or its 4186px overflow:
  // it states its own viewport and measures under it.
  await openBareEditor(page);

  const name = "two-hundred-loose-shapes.vigilia-theme";
  const msToOpened = await openPackageWithTiming(
    page,
    name,
    packageBytes("two-hundred-loose-shapes", looseGrid(200)),
  );

  const rows = page.locator("[data-vigilia-layer]");
  const rowsStarted = Date.now();
  await expect.poll(() => rows.count(), { timeout: 30_000 }).toBe(200);
  const msToRows = msSince(rowsStarted);

  // 200 root objects, 200 unique ids, and the order plan 1 recorded: the
  // projection reverses the root array, so the last object is the first row.
  const ids = await rows.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-vigilia-layer") ?? ""),
  );
  expect(ids).toHaveLength(200);
  expect(new Set(ids).size, "every row a distinct id").toBe(200);
  expect(ids[0], "the first row is the last object").toBe("shape-199");
  expect(ids[199], "the last row is the first object").toBe("shape-0");

  await captureVisualReview(page, testInfo, "composition-panel-two-hundred");

  // **Hovering across the tree**: every twentieth row, top to bottom, so the
  // wall clock covers the tree's whole length rather than one hot first screen.
  const hovered: string[] = [];
  const hoverStarted = Date.now();
  for (let index = 0; index < 200; index += 20) {
    const id = `shape-${index}`;
    await page.locator(`[data-vigilia-layer="${id}"]`).hover();
    hovered.push(id);
  }
  const hoverMs = msSince(hoverStarted);

  // **Click to select, sampled across the tree rather than at one depth** —
  // plan 1's own five rows, so its median has a sample beside it. Every click
  // is verified against the canvas's active object, not the row's own flag.
  const selectSamples: { readonly id: string; readonly ms: number }[] = [];
  for (const id of [
    "shape-0",
    "shape-40",
    "shape-80",
    "shape-120",
    "shape-160",
  ]) {
    const started = Date.now();
    await page.locator(`[data-vigilia-layer="${id}"]`).click();
    await expect.poll(() => activeId(page)).toBe(id);
    selectSamples.push({ id, ms: msSince(started) });
  }
  const selectTimes = selectSamples
    .map((sample) => sample.ms)
    .sort((a, b) => a - b);
  const selectMedian = selectTimes[Math.floor(selectTimes.length / 2)] ?? 0;
  const selectMax = selectTimes[selectTimes.length - 1] ?? 0;

  // **A canvas drag's delta**, read against the object's own authored
  // coordinates: the two deltas must agree, which is the claim that the object
  // moved as one thing rather than being re-authored part by part. Snapping is
  // live on this canvas, so the delta itself is the snap's business and the
  // equality is the assertion.
  const beforeWorld = await readSceneObject<ArtboardRect>(
    page,
    "shape-100",
    "rect",
  );
  const beforeAuthored = await authoredBox(page, "shape-100");
  const grab = await clientOfScene(page, "shape-100", 1280);
  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  await page.mouse.move(grab.x + 120, grab.y + 80, { steps: 20 });
  await page.mouse.up();
  const afterWorld = await readSceneObject<ArtboardRect>(
    page,
    "shape-100",
    "rect",
  );
  const afterAuthored = await authoredBox(page, "shape-100");
  const authoredDelta = {
    left: round1(afterAuthored.left - beforeAuthored.left),
    top: round1(afterAuthored.top - beforeAuthored.top),
  };
  const worldDelta = {
    left: round1(afterWorld.left - beforeWorld.left),
    top: round1(afterWorld.top - beforeWorld.top),
  };
  expect(
    worldDelta,
    "the world rect moved by exactly what the object's own box moved by",
  ).toEqual(authoredDelta);
  expect(authoredDelta.left, "the drag is not a no-op").not.toBe(0);
  expect(round1(afterAuthored.width), "a move is not a resize").toBe(
    round1(beforeAuthored.width),
  );

  // **A scroll to each end, with the end row still on screen.** The wheel is
  // read on the panel's own scroller, and the assertion is the row's box being
  // inside the scroller's — `isVisible()` would pass on a row scrolled past.
  const scroller = page.locator(".editor-shell-panel");
  const scroll = await scroller.evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
    clientWidth: element.clientWidth,
  }));
  expect(scroll.scrollHeight, "the list overflows the panel").toBeGreaterThan(
    scroll.clientHeight,
  );
  await scroller.hover();
  const downStarted = Date.now();
  await page.mouse.wheel(0, 40_000);
  await expect.poll(() => rowInScroller(page, "shape-0")).toBe(true);
  const downMs = msSince(downStarted);
  const upStarted = Date.now();
  await page.mouse.wheel(0, -40_000);
  await expect.poll(() => rowInScroller(page, "shape-199")).toBe(true);
  const upMs = msSince(upStarted);

  // **A row's width carries a launch caveat.** Playwright's headless default
  // hides the scrollbars and this file lifts that flag, so the number below is
  // the one taken with the scrollbar in place — the launch class plan 1's probe
  // used, which recorded 314 with the flag and 299 without. The column also
  // ships 246px now where plan 1 measured 340px, so this is not plan 1's number
  // and is not offered as one.
  const rowWidth = await rows
    .first()
    .evaluate((element) => Math.round(element.getBoundingClientRect().width));

  // **Task 3's invariant at a different sample.** The role is `flex: none` and
  // the row clips its overflow, so a role pushed past the row's own edge is a
  // role the author cannot read — three of four kinds have no other statement of
  // what they are. Task 3 took this at 1600x900 over sixty rows; this is the
  // same claim at 1280x720 over two hundred, where the panel's scrollbar is the
  // difference in row width.
  const rolesOutside = await rows.evaluateAll(
    (elements) =>
      elements.filter((row) => {
        const role = row.querySelector(".vigilia-layer-role");
        return (
          role !== null &&
          role.getBoundingClientRect().right >
            row.getBoundingClientRect().right + 1
        );
      }).length,
  );
  expect(rolesOutside, "roles pushed out of their own row").toBe(0);

  for (const [type, value] of [
    ["viewport", viewportOf(testInfo)],
    ["open-ms-to-opened", String(msToOpened)],
    ["open-ms-to-rows", String(msToRows)],
    ["hover-ms", String(hoverMs)],
    ["hovered", hovered.join(",")],
    ["select-ms", selectSamples.map((s) => `${s.id}:${s.ms}`).join(" ")],
    ["select-median-ms", String(selectMedian)],
    ["select-max-ms", String(selectMax)],
    ["drag-authored", `${authoredDelta.left}/${authoredDelta.top}`],
    ["drag-world", `${worldDelta.left}/${worldDelta.top}`],
    ["scrollheight", String(scroll.scrollHeight)],
    ["clientheight", String(scroll.clientHeight)],
    ["clientwidth", String(scroll.clientWidth)],
    ["wheel-down-ms", String(downMs)],
    ["wheel-up-ms", String(upMs)],
    ["row-width", String(rowWidth)],
  ] as const) {
    testInfo.annotations.push({ type, description: String(value) });
  }
});

test("a group entered inside a large document", async ({ page }, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  // **The case plan 1's own acceptance says it did not cover** — its document
  // had "no group anywhere", so it said nothing about a *grouped* 200-shape
  // theme. Entering re-projects the tree with the through-selection flags on,
  // which is the state a large document is least likely to have been measured
  // in. One document, one viewport, one machine, as the case above.
  await openBareEditor(page);

  await openPackageWithTiming(
    page,
    "two-hundred-with-a-group.vigilia-theme",
    packageBytes(
      "two-hundred-with-a-group",
      [...looseGrid(199), partGroup("group-large", 700, 560)],
      // One binding, so the group's row carries a key as well as the entry
      // control and the three affordances — both halves of the `:has` rule the
      // last block below checks.
      { "group-large": [{ id: "large-load", semanticKey: "cpu.load" }] },
    ),
  );

  const rows = page.locator("[data-vigilia-layer]");
  await expect.poll(() => rows.count(), { timeout: 30_000 }).toBe(200);

  // Entering the group is the whole act: it re-projects the tree around the
  // context, so the group's five parts become rows that reach the canvas.
  const enterStarted = Date.now();
  await enterLayer(page, "group-large");
  const enterMs = msSince(enterStarted);
  expect(await enteredGroups(page)).toContain("group-large");
  await expect.poll(() => rows.count()).toBe(205);

  // **The through-selection flags**, read off the rows themselves: the entered
  // group and its descendants are the reachable ones, and everything else is
  // marked as outside the context.
  await expect(
    page.locator('[data-vigilia-layer="group-large"]'),
    "the entered group is inside the context",
  ).toHaveAttribute("data-context", "true");
  await expect(
    page.locator('[data-vigilia-layer="inside-2"]'),
    "a part of the entered group is inside it",
  ).toHaveAttribute("data-context", "true");
  await expect(
    page.locator('[data-vigilia-layer="shape-0"]'),
    "a loose row outside the group is not",
  ).toHaveAttribute("data-context", "false");

  // And a part is selectable inside a document this size — the property the
  // context exists for, read back through the bridge like every other claim.
  const selectStarted = Date.now();
  await selectLayer(page, "inside-2");
  await expect.poll(() => activeId(page)).toBe("inside-2");
  const selectMs = msSince(selectStarted);

  // **The row that draws the whole state slot**, which nothing before Task 2
  // ever put on a row: the entry control, the eye and the lock — three controls
  // at §5's 26px square, and three is the most a row can draw since `vg-462`
  // took the rename pen off it. The stylesheet asks for the room they need out
  // of the *bound* column, one `:has` arm per control count.
  await selectLayer(page, "group-large");
  await expect.poll(() => activeId(page)).toBe("group-large");
  const groupRow = page.locator('[data-vigilia-layer="group-large"]');
  await expect(
    groupRow.locator(".vigilia-layer-state button"),
    "entry, visibility and lock, all three on one row",
  ).toHaveCount(3);
  const slot = await groupRow.evaluate((row) => {
    const state = row.querySelector(".vigilia-layer-state") as HTMLElement;
    const role = row.querySelector(".vigilia-layer-role") as HTMLElement;
    const bound = row.querySelector(".vigilia-layer-bound") as HTMLElement;
    const name = row.querySelector(".vigilia-layer-name") as HTMLElement;
    const mark = row.querySelector(".vigilia-layer-mark") as HTMLElement;
    return {
      // The slot the narrowing rules, read off the row the worst case is on: a
      // value this column's own `:has`-free `flex-basis` sets, so a re-widening
      // is caught here rather than only in a comment.
      markWidth: Math.round(mark.getBoundingClientRect().width),
      // **The two halves of the reservation, bound to each other.** One half is
      // what the slot's own rendered box needs — 6px of padding plus three 26px
      // squares and two 4px gaps — and the other is what the stylesheet's third
      // `:has` arm reserves out of the row. The room is the row's own
      // `padding-right` rather than the key column's margin, because the slot
      // covers whatever is last in the row and that column is the role on a row
      // whose selection reads nothing (`vg-265`); the 4px subtracted is the
      // padding the row carries whether or not it draws a control, so what is
      // left is the slot's own footprint. A button box that drifts out of the
      // arithmetic, or an arm dropped while the buttons still need it, desyncs
      // the two and fails below.
      slotWidth: Math.round(state.getBoundingClientRect().width),
      reservedPx: Math.round(
        Number.parseFloat(getComputedStyle(row).paddingRight) - 4,
      ),
      // The bound column is the one that gives way — a key yields before a
      // layer's name does — so it can never end up the wider of the two.
      boundWidth: Math.round(bound.getBoundingClientRect().width),
      nameWidth: Math.round(name.getBoundingClientRect().width),
      // **Recorded, not asserted.** At DESIGN.md's 246px a row drawing three
      // 26px controls is over budget: 92px of reservation on a 211px row, so
      // the bound's own box still overflows the line — the key short by 41px
      // and the name by 28px. These four figures are the only instrument the
      // row's cost has (`vg-260` carries the measurement; Task 10's ratchet and
      // Task 12's register own the decision). Asserting that the room stayed
      // whole would assert a defect as a pass condition, which is a red proof
      // against its own fix. **`vg-462` took 26px of the reservation away and
      // did not end the overrun**: the four-control figures this replaces are
      // 122px on a 205px row, in the closed plan `2026-10-08-the-panes` report.
      rowWidth: Math.round(row.getBoundingClientRect().width),
      roomKept: Math.round(
        row.getBoundingClientRect().right - bound.getBoundingClientRect().right,
      ),
      keyClipped: bound.scrollWidth > bound.clientWidth,
      nameClipped: name.scrollWidth > name.clientWidth,
      // **How far short, not only that it is short.** The row's own requirement
      // is that the selected row keeps its name and its key readable, and the
      // mark is the column that is allowed to give way — so the decision the
      // ruling asks for is "how much does the mark have to yield", which a
      // boolean cannot answer. Recorded as the overflow in px.
      nameDeficitPx: Math.max(0, name.scrollWidth - name.clientWidth),
      keyDeficitPx: Math.max(0, bound.scrollWidth - bound.clientWidth),
      // **Recorded too, and it is the wider failure of the same over-budget
      // row**: with three controls the row's own columns still cannot fit beside
      // the slot, so the role — which `flex: none` keeps at its full width, and
      // which the stylesheet promises is never the column that gives way — runs
      // under the slot by 23px and is painted over. Which column yields when a
      // row is this narrow is a design question between three recorded
      // invariants and is filed as `vg-447`; `vg-265` closed the half where the
      // slot held no control at all, which the case above asserts.
      roleCoveredPx: Math.round(
        role.getBoundingClientRect().right - state.getBoundingClientRect().left,
      ),
    };
  });
  expect(
    slot.slotWidth,
    `the slot's rendered box is the ${THREE_CONTROL_SLOT_PX}px the third \`:has\` arm promises`,
  ).toBe(THREE_CONTROL_SLOT_PX);
  expect(
    slot.reservedPx,
    "and the room the arm asks the key column for is the room the slot needs",
  ).toBe(slot.slotWidth);
  expect(
    slot.boundWidth,
    "the key gives way before the layer's name does",
  ).toBeLessThanOrEqual(slot.nameWidth);
  expect(
    slot.markWidth,
    `the mark slot is the ${MARK_SLOT_PX}px the ruling's own measurement held it at`,
  ).toBe(MARK_SLOT_PX);

  for (const [type, value] of [
    ["viewport", viewportOf(testInfo)],
    ["rows-before-entry", "200"],
    ["rows-after-entry", "205"],
    ["enter-ms", String(enterMs)],
    ["select-inside-ms", String(selectMs)],
    ["three-control-slot-width-px", String(slot.slotWidth)],
    ["three-control-reserved-px", String(slot.reservedPx)],
    ["three-control-row-width-px", String(slot.rowWidth)],
    ["three-control-room-kept-px", String(slot.roomKept)],
    ["three-control-key-clipped", String(slot.keyClipped)],
    ["three-control-name-clipped", String(slot.nameClipped)],
    ["three-control-name-deficit-px", String(slot.nameDeficitPx)],
    ["three-control-key-deficit-px", String(slot.keyDeficitPx)],
    ["three-control-role-covered-px", String(slot.roleCoveredPx)],
    ["three-control-mark-width-px", String(slot.markWidth)],
  ] as const) {
    testInfo.annotations.push({ type, description: String(value) });
  }
});

// ---------------------------------------------------------------------------
// Plan 5, Task 6: the role column says what the document says the card is
// ---------------------------------------------------------------------------

/**
 * The ids of the rows whose role column reads `label`, read from the DOM — a
 * copy's id is the allocator's to choose, so a literal here would be a second
 * statement of what the product decides.
 */
async function rowsNamed(
  page: Page,
  label: string,
): Promise<readonly string[]> {
  return page
    .locator("[data-vigilia-layer]")
    .evaluateAll(
      (rows, wanted) =>
        rows
          .filter(
            (row) =>
              row.querySelector(".vigilia-layer-role")?.textContent?.trim() ===
              wanted,
          )
          .map((row) => row.getAttribute("data-vigilia-layer") ?? ""),
      label,
    );
}

test("the starter's own card rows name the unit the document says they are", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await openStarterEditor(page);

  // THE row this plan exists for: the reference composition's own card says
  // which card it is, rather than the bare `Group` arm every unstamped group
  // reads. The name column beside it still says the id, which is the starter's
  // names-equals-ids convention and not this change's.
  await expect(
    page.locator('[data-vigilia-layer="group-cpu-card"] .vigilia-layer-role'),
  ).toHaveText("CPU");
  await expect(
    page.locator('[data-vigilia-layer="group-cpu-card"] .vigilia-layer-name'),
  ).toHaveText("group-cpu-card");
});

test("a copy inserted beside the starter names its unit without costing the starter its own", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await openStarterEditor(page);

  await openPane(page, "Add");
  // The Add pane is the insert surface now: the `+` chooser left with the pane
  // bar, and the pane renders the same `insertGroups()` list it drew.
  await page
    .locator('[data-vigilia-panel="add"]')
    .getByRole("button", { name: "Clock", exact: true })
    .click();

  // Two rows name the unit — the copy's own and the starter's time card, which
  // has not lost its stamp — and the two ids differ, so neither arrival erased
  // the other's row.
  const clocks = await rowsNamed(page, "Clock");
  expect(clocks).toHaveLength(2);
  expect(new Set(clocks).size).toBe(2);
  expect(clocks).toContain("group-time-card");
});
