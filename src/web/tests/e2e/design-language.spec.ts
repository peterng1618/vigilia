import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { captureVisualReview } from "./editor-canvas.js";
import { openPane } from "./editor-rail.js";
import {
  colourValue,
  currentDrawings,
  drawingTexts,
  lengthInPx,
  MOCKUP_PATH,
  type MockupDeclaration,
  mockupDeclarations,
  mockupDeclared,
  mockupDeclaredOrNull,
  PARITY,
  type ParityRegion,
  readMockup,
  rowDrawing,
  SETTINGS_MOCKUP_PATH,
  SHELL_ROLES,
  SHELL_TOKEN_SELECTOR,
  trackCount,
} from "./mockup-values.js";
import { openShell, SETTINGS_DIALOG, SETTINGS_GEAR } from "./shell-palette.js";
import { isDesktopSurface } from "./surface.js";

/**
 * The design-language parity gate (spec §13, §13.1).
 *
 * A browser fixture mounts the **built** control set over the **built**
 * stylesheet, and this file asserts the language mechanically: that every gated
 * element's resolved spacing is on DESIGN.md §3's scale, that no gated element
 * paints a colour that is not one of DESIGN.md §4's roles, that every target has
 * DESIGN.md §5's 24×24 hit area without overlapping its neighbour, that required
 * text and the focus boundary clear §5's ratios in all six palettes, that hover
 * raises a control's resting `--edge` to `--muted` (and a blocked well and the
 * checked toggle do not move), that focus survives forced colours, that layout
 * holds at 1280×720, 1440×900 and 200% zoom, and that reduced motion leaves
 * nothing animating. It is the *model* every later plan's parity capture
 * follows.
 *
 * **What this file does not prove, and must not be read as proving.**
 *
 * - **Not token provenance.** A hard-coded colour equal to a role passes the
 *   literal check below, because a computed style cannot say where a value came
 *   from. Source provenance is `npm run design:check`'s
 *   (`scripts/design-tokens.mjs`); this file owns *rendered treatment*. The two
 *   are complements, not substitutes, and the fixture is listed in
 *   `design-tokens.gated.json` so the same source guard covers it too.
 * - **Not behaviour.** A screenshot is one rendered state. Keyboard models,
 *   refusal paths, draft semantics and mutation safety are proven in jsdom by
 *   `components/ui/control.dom.test.tsx`; the states here are *rendered*, not
 *   driven, except the states this file drives (the invalid draft, the focus,
 *   and the hover).
 * - **Not the editor.** The fixture shows the control set in isolation on a
 *   panel, not inside a pane; plan 2 onward captures real surfaces.
 *
 * The fixture's route is `control-fixture.html` on the editor preview — a build
 * entry, so no test-only branch exists in the shipped editor. It is registered
 * in `docs/evidence/screenshots/README.md` as the `control-set` capture.
 */

const FIXTURE = "http://127.0.0.1:4174/control-fixture.html";
const EDITOR = "http://127.0.0.1:4174/";

/** DESIGN.md §3's named steps. DESIGN.md is the source; this list and the steps in
 *  `scripts/design-tokens.mjs` are two independent transcriptions of it, so a §3
 *  change updates both in the same commit. There is deliberately no import
 *  between them: `tests/e2e/` belongs to no tsconfig (vg-192), so a cross-package
 *  import would arrive untyped and buy coupling, not safety. */
const SPACING_STEPS = [4, 6, 8, 10, 12, 14, 16, 20, 24, 32];

/** DESIGN.md §4's thirteen roles. `--bg` and `--stage` are here too: they carry no
 *  `--color-*` utility, because both alias `--shell-backdrop` — a gradient under
 *  `light` and a flat colour in the other five, where a colour utility would set
 *  a colour to the gradient and fail silently. Each is still resolved here: the
 *  segmented control paints `--stage` with the `background` shorthand, so the
 *  fixture reads them the same way it reads the other eleven. */
const ROLES = [
  "bg",
  "stage",
  "hdr",
  "panel",
  "panel-2",
  "edge",
  "edge-2",
  "text",
  "muted",
  "faint",
  "accent",
  "warn",
  "hot",
] as const;

/** The six palettes DESIGN.md §4 declares a role set for, transcribed from
 *  DESIGN.md like `SPACING_STEPS` above; the same update-both rule applies. */
const PALETTES = [
  "editorial",
  "graphite",
  "ember",
  "moss",
  "plum",
  "light",
] as const;

type Palette = (typeof PALETTES)[number];

/** WCAG 1.4.3/1.4.11: normal text, and the boundary that identifies a control
 *  or its focus. */
const TEXT_MIN = 4.5;
const BOUNDARY_MIN = 3;

/**
 * The one measured palette defect this gate pins rather than blesses — a
 * ratchet, not a waiver.
 *
 * DESIGN.md §5's minimum holds for every probe in every palette except the rows
 * named here, and this is a **token** defect with a register row of its own
 * rather than a control the control set can fix:
 *
 * - `invalid` is a rejected draft's reason, painted `--warn`. `--shell-warm` is
 *   a pastel in ember, moss and plum (`#ff7e6e`, `#e8c56a`, `#ffb2a1`) while
 *   those palettes' paper is light, so the reason reads at 1.4–2.0:1. The
 *   control is not the error: the shell already paints
 *   `.editor-shell-diagnostic` and `.editor-shell-save-state` with the same
 *   role. Deepening the hue is what `--shell-accent` got in the same three
 *   palettes, and that is the ruling the row needs — `vg-201`.
 *
 * A pinned floor is deleted — the minimum restored — when its row is fixed.
 * The numbers are the measurement, so a regression still fails.
 *
 * **The `boundary` pin is gone, and it is not a waiver.** The user ruled §5's
 * 3:1 the **narrow** reading (2026-10-11, `vg-200`/`vg-318`): it binds the focus
 * boundary and a boundary that is a control's ONLY separation, and the well's
 * resting hairline is a divider — the well also carries a fill, a hover-raise
 * and a label — so graphite's 1.20:1 and light's 1.42:1 are deliberate
 * low-contrast style rather than a defect. The probe is still measured and
 * printed; what changed is that `minimumFor` gives a divider no floor at all.
 */
const PINNED_FLOOR: Readonly<Record<string, Partial<Record<Palette, number>>>> =
  {
    invalid: { ember: 1.9, moss: 1.35, plum: 1.35 },
  };

/** DESIGN.md §5's minimum for a probe, or `null` where §5 requires none.
 *
 *  §5.4 binds the focus boundary, and §5 requires 3:1 of a boundary that is a
 *  control's **only** separation. A **divider** is neither: the well's resting
 *  `--edge` and the chrome's `--shell-edge` each sit beside a fill, a
 *  hover-raise and a label. The user's narrow reading of §5's 3:1 (2026-10-11,
 *  `vg-200`/`vg-318`) therefore leaves a divider no floor — and it is `null`
 *  rather than `0` on purpose: a zero minimum would pass every palette
 *  silently, which is the failure these rows exist to end. Everything that
 *  carries words meets 4.5:1. A checked control's accent fill is not a §5
 *  boundary — the switch's knob also moves and changes colour, so the fill is
 *  not the state's only mark — but this gate holds it at 3:1 on its own terms. */
function minimumFor(name: string): number | null {
  if (name === "divider") return null;
  return name === "checked" ? BOUNDARY_MIN : TEXT_MIN;
}

const FREEZE = "design-language-freeze";
const HIDE_TEXT = "design-language-hide-text";

/** Transitions and animations frozen, for reading a settled frame and for
 *  capturing one that is not mid-fade.
 *
 *  **It must not be applied while motion is being measured.** `transition: none`
 *  makes every duration `0s` on exactly the scope the reduced-motion check
 *  reads, so a run with the freeze on reports nothing animating whatever the
 *  stylesheet does — the check passed for a whole round because of it. The
 *  positive control in that section is what keeps this honest. */
const FREEZE_CSS =
  "[data-fixture-root],[data-fixture-root] *{transition:none !important;animation:none !important}";

/** Every style the fixture is measured under, in one place: transitions are
 *  frozen so a palette change is not read mid-fade, and text is hidden as well
 *  as made transparent — `-webkit-text-fill-color` is what a Chromium input
 *  actually paints with, so `color: transparent` alone leaves the glyphs in the
 *  picture and every sampled "background" would be the text. */
async function setStyle(page: Page, id: string, css: string): Promise<void> {
  await page.evaluate(
    ({ id, css }) => {
      let style = document.getElementById(id);
      if (style === null) {
        style = document.createElement("style");
        style.id = id;
        document.head.append(style);
      }
      style.textContent = css;
    },
    { id, css },
  );
}

async function clearStyle(page: Page, id: string): Promise<void> {
  await page.evaluate((id) => document.getElementById(id)?.remove(), id);
}

async function freeze(page: Page): Promise<void> {
  await setStyle(page, FREEZE, FREEZE_CSS);
}

/** Every element under the fixture that still carries a transition or an
 *  animation with a non-zero duration, named so a failure says which. */
async function movingElements(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll("[data-fixture-root] *")]
      .filter((element) => {
        const style = getComputedStyle(element);
        return [
          ...style.transitionDuration.split(","),
          ...style.animationDuration.split(","),
        ].some((part) => Number.parseFloat(part) > 0);
      })
      .map(
        (element) =>
          `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 30)}`,
      ),
  );
}

async function openFixture(page: Page): Promise<void> {
  await page.goto(FIXTURE);
  await expect(page.locator("[data-fixture-root]")).toBeVisible();
  await freeze(page);
}

async function setPalette(page: Page, palette: Palette): Promise<void> {
  await page.evaluate((palette) => {
    document.documentElement.setAttribute("data-shell-palette", palette);
  }, palette);
}

type Rgba = readonly [number, number, number, number];

/** `rgb(r, g, b)` / `rgba(r, g, b, a)` / `#rgb` / `#rrggbb(aa)`, which is every
 *  shape a computed colour or a role probe produces. */
function parseColour(value: string): Rgba | null {
  const text = value.trim();
  const rgb = /^rgba?\(([^)]+)\)$/.exec(text);
  if (rgb !== null) {
    const parts = (rgb[1] ?? "")
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(Number);
    const [r, g, b, a] = parts;
    if (r === undefined || g === undefined || b === undefined) return null;
    if ([r, g, b].some((n) => !Number.isFinite(n))) return null;
    return [r, g, b, a === undefined || !Number.isFinite(a) ? 1 : a];
  }
  const hex = /^#([0-9a-f]{3,8})$/i.exec(text);
  if (hex === null) return null;
  let body = hex[1] ?? "";
  if (body.length === 3 || body.length === 4) {
    body = body
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (body.length !== 6 && body.length !== 8) return null;
  const at = (i: number) => Number.parseInt(body.slice(i * 2, i * 2 + 2), 16);
  return [at(0), at(1), at(2), body.length === 8 ? at(3) / 255 : 1];
}

/** Source-over: a translucent foreground over the pixel actually rendered
 *  beneath it. A role with alpha (`--edge` in the glass palettes) is opaque only
 *  once composited, and the ratio has to be read from the composite. */
function over(fg: Rgba, bg: Rgba): Rgba {
  const a = fg[3];
  return [
    fg[0] * a + bg[0] * (1 - a),
    fg[1] * a + bg[1] * (1 - a),
    fg[2] * a + bg[2] * (1 - a),
    1,
  ];
}

function luminance(c: Rgba): number {
  const channel = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2])
  );
}

function contrast(fg: Rgba, bg: Rgba): number {
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** The ratio of a computed colour against a pixel that was really rendered.
 *  The foreground keeps its alpha, the background is the screenshot's own RGBA,
 *  and the comparison is composited — the same arithmetic the browser did. */
function ratioAgainstPixel(fg: string, pixel: Rgba): number {
  const colour = parseColour(fg);
  if (colour === null) throw new Error(`unreadable computed colour: ${fg}`);
  return contrast(over(colour, pixel), pixel);
}

function round(ratio: number): number {
  return Math.round(ratio * 100) / 100;
}

type Point = { readonly x: number; readonly y: number };

/** Reads the rendered pixel at each point, from one full-page screenshot.
 *
 *  A background is the only thing a computed style cannot answer: a panel with
 *  alpha over a gradient backdrop is not a colour the cascade resolves. So the
 *  pixels are the evidence and the computed colours are the foreground, and the
 *  ratio is composited from both. */
async function pixelsAt(page: Page, points: readonly Point[]): Promise<Rgba[]> {
  await setStyle(
    page,
    HIDE_TEXT,
    "[data-fixture-root],[data-fixture-root] *{color:transparent !important;-webkit-text-fill-color:transparent !important}",
  );
  const shot = await page.screenshot({ fullPage: true });
  const b64 = shot.toString("base64");
  const pixels = await page.evaluate(
    async ({ b64, points }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${b64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      if (context === null) return null;
      context.drawImage(image, 0, 0);
      return points.map((point) => {
        const data = context.getImageData(
          Math.round(point.x),
          Math.round(point.y),
          1,
          1,
        ).data;
        return [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0, data[3] ?? 0];
      });
    },
    { b64, points },
  );
  await clearStyle(page, HIDE_TEXT);
  if (pixels === null) throw new Error("the fixture could not be captured");
  return pixels;
}

/** A sample's foreground, read while the text is still painted, and the point
 *  its background must be read at. */
type Probe = {
  readonly name: string;
  readonly fg: string;
  readonly point: Point;
};

async function probes(page: Page): Promise<Probe[]> {
  return page.evaluate(() => {
    const centre = (element: Element | null): { x: number; y: number } => {
      const rect = element?.getBoundingClientRect();
      if (rect === undefined) return { x: 0, y: 0 };
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    };
    const colour = (element: Element | null): string =>
      element === null ? "" : getComputedStyle(element).color;
    const byId = (id: string | null): Element | null =>
      id === null ? null : document.getElementById(id.split(/\s+/)[0] ?? "");
    const out: Probe[] = [];
    const add = (name: string, fgEl: Element | null, at: Point): void => {
      out.push({ name, fg: colour(fgEl), point: at });
    };

    // A required label, and the refusal and invalid messages that are required
    // information too — each read through the `aria-describedby` a reader
    // follows rather than through a class the fixture happened to write.
    const label = document.querySelector("[data-fixture='text'] label");
    add("label", label, centre(label));

    const refused = document.querySelector(
      "[data-fixture='refused'] [aria-describedby]",
    );
    const reason = byId(refused?.getAttribute("aria-describedby") ?? null);
    if (reason !== null) add("refusal", reason, centre(reason));

    const invalid = document.querySelector("[data-fixture-invalid]");
    const invalidWhy = byId(invalid?.getAttribute("aria-describedby") ?? null);
    if (invalidWhy !== null) add("invalid", invalidWhy, centre(invalidWhy));

    // The selected state of a segmented choice: the active label on `--stage`.
    const selected = document.querySelector(
      "[data-fixture-segmented][data-pressed]",
    );
    add("selected", selected, centre(selected));

    // A value inside a well: the editable value on `--panel-2`.
    const value = document.querySelector("[data-fixture='number'] input");
    add("value", value, centre(value));

    // The checked toggle's accent fill against the panel it sits on — this
    // gate's own 3:1 floor, not a §5 boundary: the knob also moves and changes
    // colour, so the fill is not the state's only mark.
    const checked = document.querySelector("[data-fixture='toggle-on'] button");
    const checkedRow = document.querySelector("[data-fixture='toggle-on']");
    if (checked !== null && checkedRow !== null) {
      const rect = checkedRow.getBoundingClientRect();
      out.push({
        name: "checked",
        fg: getComputedStyle(checked).backgroundColor,
        point: { x: rect.x + 4, y: rect.y + rect.height / 2 },
      });
    }

    // The resting well hairline, read against the fill it bounds rather than
    // against some other surface. A **divider**, not a §5 boundary: the well
    // also carries a fill, a hover-raise to `--muted` and a label, so this
    // hairline is one mark among several and the user's narrow reading of §5's
    // 3:1 (2026-10-11, vg-200/vg-318) leaves it no floor — `minimumFor` answers
    // `null`. Kept rather than deleted, so the ratio and any regression stay
    // visible; the loop below prints it and asserts nothing.
    const well = value?.parentElement ?? null;
    if (well !== null) {
      out.push({
        name: "divider",
        fg: getComputedStyle(well).borderTopColor,
        point: centre(well),
      });
    }

    return out;
  });
}

test("the control set renders in the design language", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
  test.setTimeout(180_000);

  await openFixture(page);

  // ── The two states that need an interaction, driven first so the rendered
  // states below include them ────────────────────────────────────────────────
  const invalidField = page.locator("[data-fixture-invalid]");
  await invalidField.fill("abc");
  await invalidField.press("Enter");

  const invalidMessage = page.locator("[data-fixture='invalid'] p");
  await expect(invalidMessage).toHaveText("not a number");
  await expect(invalidField).toHaveAttribute("aria-invalid", "true");

  // Focus is deliberately *not* taken yet: focusing a control opens its
  // tooltip, the popup is placed above its trigger, and it would then cover the
  // neighbour — so the hit test below measures the controls with no overlay in
  // the way, and the focus state is taken at section 4b, where it is measured.

  // ── 0. One geometry for a field row ───────────────────────────────────────
  //
  // A field row is **one track**: a fixed label column, and a value cell every
  // control fills. That is what the control set's own drawing declares
  // (`current/controls.html` and its light twin, `current/controls-light.html`:
  // the label is `width:74px;flex:0 0 auto` and the value is `flex:1`), and the
  // product declared neither — a number well was as wide as its `<input>`, a
  // select filled the slot and a segmented group hugged its right edge, which is
  // four left edges in one section (`vg-297`). Read here, first, because every
  // section below measures a rendered state and a row that is not one track
  // hands them the wrong box.
  //
  // Three readings, because the defect had three owners and an assertion that
  // reads one of them would have passed twice: the boxes' shared edges (the
  // control set's own geometry), the label against its control's centre and an
  // input drawing a border inside its well (both `editor-shell.css`'s legacy
  // unlayered rules, `vg-298`, which reach only the product's own ancestors —
  // so the last two are what the fixture mounting `.editor-shell-inspector`
  // buys, and they pass without it on a page the product does not render).
  const geometry = await page.evaluate(() => {
    /** A row's value cell — the `ControlRow`'s own div, reached as the label's
     *  next sibling rather than by a class name the language could rename. */
    const rowOf = (fixture: string): Element | null =>
      document.querySelector(`[data-fixture="${fixture}"] > div`);
    const cellOf = (fixture: string): Element | null =>
      rowOf(fixture)?.firstElementChild?.nextElementSibling ?? null;
    const boxOf = (fixture: string): Element | null =>
      cellOf(fixture)?.firstElementChild ?? null;
    const rectOf = (element: Element | null): DOMRect | null =>
      element === null ? null : element.getBoundingClientRect();
    const round = (value: number): number => Math.round(value * 10) / 10;

    const edges: Record<string, { left: number; right: number } | null> = {};
    const labelOffsets: Record<string, number | null> = {};
    const kinds = ["text", "number", "select", "segmented"];
    for (const fixture of kinds) {
      const box = rectOf(boxOf(fixture));
      const label = rectOf(cellOf(fixture)?.previousElementSibling ?? null);
      edges[fixture] =
        box === null
          ? null
          : { left: round(box.left), right: round(box.right) };
      labelOffsets[fixture] =
        box === null || label === null
          ? null
          : round(label.top + label.height / 2 - (box.top + box.height / 2));
    }

    // The slider is one row whose visible box is not the cell: its track starts
    // at the cell's left edge and its 36px well ends at its right (§5).
    const sliderRoot = cellOf("slider")?.firstElementChild ?? null;
    const track = rectOf(
      sliderRoot?.firstElementChild?.firstElementChild ?? null,
    );
    const well = rectOf(sliderRoot?.lastElementChild ?? null);

    // An input inside a well must not draw a border of its own: the well **is**
    // the box (§5). Only text fields are read — a select's trigger is its own
    // well and legitimately paints one, and the range input is Base UI's
    // pointer target rather than a field.
    const doubled: string[] = [];
    for (const input of document.querySelectorAll<HTMLInputElement>(
      '[data-fixture-root] input[type="text"]',
    )) {
      const style = getComputedStyle(input);
      const widths = [
        style.borderTopWidth,
        style.borderRightWidth,
        style.borderBottomWidth,
        style.borderLeftWidth,
      ].map((width) => Number.parseFloat(width));
      if (widths.some((width) => width > 0)) {
        doubled.push(
          `#${input.id || "?"} paints a ${widths.join("/")}px border of its own inside \`${String(input.parentElement?.className).slice(0, 30)}\``,
        );
      }
    }
    // ── The two shapes a drawing gives a row when it is not a labelled row ───
    //
    // `boxed` — the settings modal's switch: the label **fills** the row
    // (`settings.html:89-93`), so its width is the row's rather than the 74px
    // column the labelled row declares, and that is what keeps it on one line.
    const boxedLabel = rectOf(rowOf("boxed")?.firstElementChild ?? null);
    // `headed` — the Add pane's picker: the label is the row's own heading and
    // the control spans the full width (`shell.html:128-132`), so the heading is
    // above the control and the control starts where the row does. The column
    // shape would put it at the cell's left edge, 74px and a gap in.
    const headedRow = rectOf(rowOf("headed"));
    const headedLabel = rectOf(rowOf("headed")?.firstElementChild ?? null);
    const headedCell = rectOf(rowOf("headed")?.lastElementChild ?? null);
    // A pair is two wells on one line, `flex:1` each in the drawing: equal by
    // the layout rather than by the numbers they print, so the halves here hold
    // `4` and `4000`.
    const pairWells = [...(rowOf("pair")?.querySelectorAll("input") ?? [])].map(
      (input) => rectOf(input.parentElement),
    );

    return {
      edges,
      labelOffsets,
      trackLeft: track === null ? null : round(track.left),
      wellRight: well === null ? null : round(well.right),
      doubled,
      boxedLabelWidth: boxedLabel === null ? null : round(boxedLabel.width),
      headed: {
        rowLeft: headedRow === null ? null : round(headedRow.left),
        labelBottom: headedLabel === null ? null : round(headedLabel.bottom),
        cellLeft: headedCell === null ? null : round(headedCell.left),
        cellTop: headedCell === null ? null : round(headedCell.top),
      },
      pairWidths: pairWells.map((well) =>
        well === null || well === undefined ? null : round(well.width),
      ),
    };
  });

  const edgeOf = (fixture: string): { left: number; right: number } => {
    const value = geometry.edges[fixture];
    expect(
      value,
      `${fixture}: the row's value cell is not mounted, so this is not a reading`,
    ).not.toBeNull();
    return value ?? { left: Number.NaN, right: Number.NaN };
  };
  const text = edgeOf("text");
  for (const fixture of ["number", "select", "segmented"]) {
    expect(
      edgeOf(fixture),
      `${fixture}: its box does not share the text row's edges — measured ${JSON.stringify(geometry.edges)}`,
    ).toEqual(text);
  }
  expect(
    geometry.trackLeft,
    `the slider's track does not start on the boxes' left edge (${text.left}); measured ${JSON.stringify(geometry.trackLeft)}`,
  ).toBeCloseTo(text.left, 0);
  expect(
    geometry.wellRight,
    `the slider's well does not end on the boxes' right edge (${text.right}); measured ${JSON.stringify(geometry.wellRight)}`,
  ).toBeCloseTo(text.right, 0);
  for (const [fixture, offset] of Object.entries(geometry.labelOffsets)) {
    expect(offset, `${fixture}: the row is not mounted`).not.toBeNull();
    expect(
      Math.abs(offset ?? Number.NaN),
      `${fixture}: the label sits ${offset}px off its control's centre, and the row centres it`,
    ).toBeLessThanOrEqual(1);
  }
  expect(
    geometry.doubled,
    "a field draws a box of its own inside the well that already draws one",
  ).toEqual([]);

  // The column is a *shape*, and these are the two rows a drawing shapes
  // differently. Read here rather than left to the capture, because a width and
  // a position are what the two drawings declare and what a screenshot cannot
  // assert: the boxed row's label fills its row, and the headed row's control
  // starts where the row starts with the heading above it.
  expect(
    geometry.boxedLabelWidth,
    `the boxed row's label is not mounted, so this is not a reading`,
  ).not.toBeNull();
  expect(
    geometry.boxedLabelWidth ?? 0,
    "the boxed row's label is still in the field row's 74px column, where the settings drawing fills the row with it",
  ).toBeGreaterThan(74);
  expect(
    geometry.headed.rowLeft,
    "the headed row is not mounted, so this is not a reading",
  ).not.toBeNull();
  expect(
    geometry.headed.cellLeft,
    `the headed row's control does not span the row: it starts at ${geometry.headed.cellLeft} and the row at ${geometry.headed.rowLeft}, so it is still inside the field row's column`,
  ).toBe(geometry.headed.rowLeft);
  expect(
    geometry.headed.labelBottom !== null &&
      geometry.headed.cellTop !== null &&
      geometry.headed.labelBottom <= geometry.headed.cellTop,
    `the headed row's label is not above its control: label bottom ${geometry.headed.labelBottom}, control top ${geometry.headed.cellTop}`,
  ).toBe(true);
  expect(
    geometry.pairWidths.length,
    "the pair row is not mounted with two wells, so this is not a reading",
  ).toBe(2);
  expect(
    geometry.pairWidths[0],
    `the pair's two wells are not equal: ${JSON.stringify(geometry.pairWidths)} — a pair is two flex:1 halves, and 4 against 4000 is what tells a shared width from a sized one`,
  ).toBe(geometry.pairWidths[1]);

  // ── 0b. The two control drawings are read, and the column is theirs ───────
  //
  // The drawings are the source, not this file: the row's geometry above is a
  // *relationship*, and the number a person reads is the label column the two
  // files declare. Read through `PARITY`'s `fixture` rows so both drawings are
  // read by something rather than by nothing, and so a drawing that moved under
  // this task's own change reddens here rather than in a later plan's.
  const drawings = PARITY.filter((row) => row.surface === "fixture");
  expect(
    drawings.length,
    "no parity row names the control-set fixture, so the two control drawings are read by nothing",
  ).toBeGreaterThanOrEqual(2);
  /** Every drawing a row may name, read once — and a row naming a file this does
   *  not hold throws (`rowDrawing`) rather than reading the shell's text as if it
   *  were the file it named. */
  const fixtureDrawings = drawingTexts();
  for (const row of drawings) {
    // `$eval` throws when the selector matches nothing, which is the reading
    // this row must not skip over.
    const rendered = await page.$eval(
      row.productSelector,
      (element, property) =>
        getComputedStyle(element).getPropertyValue(property),
      row.mockupProperty,
    );
    const declared = mockupDeclared(
      rowDrawing(row.mockupPath, fixtureDrawings),
      row.mockupSelector ?? "",
      row.mockupProperty,
    );
    expect(
      lengthInPx(rendered),
      `${row.region}: the drawing requires ${declared}; the product renders "${rendered}" on \`${row.productSelector}\``,
    ).toBe(lengthInPx(declared));
  }

  // ── 1. Authored spacing is on DESIGN.md §3's scale ────────────────────────────
  //
  // Scoped to the *authored* layout properties — padding, margin and gap — and
  // read through the typed OM, which is the only reading that keeps `auto` a
  // keyword instead of resolving it to whatever the layout produced. Percentages
  // are skipped: they are relative, not off-scale. Row rhythms (`26px`), glyph
  // bounds (`10px`) and borders are not spacing and are not read here.
  //
  // A hidden form-integration input (a 1×1 off-screen box, which §2.2 already
  // says is not a second control) is not a surface and is skipped, the same way
  // the hit test skips it; and only `type=text` is read, because the fixture
  // authors only text fields — a primitive's own checkbox or `input[type=range]`
  // geometry is base-ui plumbing, not a spacing decision this language made.
  const offScale = await page.evaluate((steps) => {
    const allowed = new Set(steps);
    const properties = [
      "padding-top",
      "padding-right",
      "padding-bottom",
      "padding-left",
      "margin-top",
      "margin-right",
      "margin-bottom",
      "margin-left",
      "row-gap",
      "column-gap",
    ];
    const rootFont = Number.parseFloat(
      getComputedStyle(document.documentElement).fontSize,
    );
    const found: string[] = [];
    const elements = document.querySelectorAll("[data-fixture-root] *");
    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      if (element instanceof HTMLInputElement && element.type !== "text") {
        continue;
      }
      const computed = element.computedStyleMap();
      for (const property of properties) {
        const value = computed.get(property);
        if (value === undefined) continue;
        // A keyword (`auto`, `normal`) is not a length and owns no scale.
        if (!(value instanceof CSSUnitValue)) continue;
        if (value.unit === "percent") continue;
        const px =
          value.unit === "rem"
            ? value.value * rootFont
            : value.unit === "px"
              ? value.value
              : Number.NaN;
        if (!Number.isFinite(px) || px === 0) continue;
        if (!allowed.has(px)) {
          found.push(
            `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 24)} ${property}=${px}px`,
          );
        }
      }
    }
    return found;
  }, SPACING_STEPS);
  expect(
    offScale,
    "an authored spacing value is not on DESIGN.md §3's scale",
  ).toEqual([]);

  // ── 2. No colour resolves outside DESIGN.md §4's roles ────────────────────────
  //
  // Every role is resolved *the way a surface paints it* — a probe set to
  // `background: var(--role)` and read back — so `color-mix()` and alpha are
  // resolved by the browser rather than by this file. A gradient role resolves
  // to transparent here, which is what painting it as a colour really does.
  // `box-shadow` is deliberately not read: DESIGN.md §5.4 makes the halo decoration,
  // and a shadow colour is not a surface.
  const literals = await page.evaluate((roles) => {
    const allowed = new Set(["rgba(0, 0, 0, 0)"]);
    const probe = document.createElement("div");
    probe.style.position = "absolute";
    probe.style.left = "-9999px";
    document.body.append(probe);
    for (const role of roles) {
      probe.style.background = `var(--${role})`;
      allowed.add(getComputedStyle(probe).backgroundColor);
    }
    probe.remove();

    const found: string[] = [];
    for (const element of document.querySelectorAll("[data-fixture-root] *")) {
      const rect = element.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      const style = getComputedStyle(element);
      const readings: [string, string][] = [["color", style.color]];
      if (style.backgroundColor !== "rgba(0, 0, 0, 0)") {
        readings.push(["background-color", style.backgroundColor]);
      }
      for (const side of ["Top", "Right", "Bottom", "Left"] as const) {
        const painter =
          side === "Top"
            ? style.borderTopStyle
            : side === "Right"
              ? style.borderRightStyle
              : side === "Bottom"
                ? style.borderBottomStyle
                : style.borderLeftStyle;
        if (painter === "none") continue;
        const value =
          side === "Top"
            ? style.borderTopColor
            : side === "Right"
              ? style.borderRightColor
              : side === "Bottom"
                ? style.borderBottomColor
                : style.borderLeftColor;
        readings.push([`border-${side.toLowerCase()}-color`, value]);
      }
      if (style.outlineStyle !== "none") {
        readings.push(["outline-color", style.outlineColor]);
      }
      for (const [property, value] of readings) {
        if (allowed.has(value)) continue;
        found.push(
          `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 24)} ${property}=${value}`,
        );
      }
    }
    return found;
  }, ROLES);
  expect(
    literals,
    "a gated element paints a colour no DESIGN.md §4 role resolves to",
  ).toEqual([]);

  // ── 3. Every target has DESIGN.md §5's 24×24 hit area, and none overlaps ──────
  //
  // Hit-tested rather than measured, because a target's *box* is not its hit
  // area: the toggle's pill is 26×14 and its target is a centred 24×24 carried
  // by `hitTargetClasses` (`control-well.tsx`). A point over that pseudo-element
  // resolves to the control it expands, so hit-testing is the only reading that
  // measures the rule DESIGN.md states. A point that lands on a neighbour is how
  // "adjacent targets must not overlap" fails.
  //
  // The samples live in a 24×24 box one pixel inside its edge, so a rounded
  // corner is not read as a miss. Two kinds of element are out of scope and are
  // named rather than silently skipped: a hidden form-integration input (an
  // off-screen 1×1 box, which §2.2 already says is not a second control), and
  // the slider's nested `input[type=range]`, whose pointer target is the
  // Base UI `Control` around it — asserted separately, below.
  const hitArea = await page.evaluate(() => {
    const failures: string[] = [];
    const offsets = [-11, -5.5, 0, 5.5, 11];
    const targets = [
      ...document.querySelectorAll<HTMLElement>(
        "[data-fixture-root] button, [data-fixture-root] input, [data-fixture-root] textarea",
      ),
    ];
    for (const target of targets) {
      const rect = target.getBoundingClientRect();
      const visible =
        rect.width >= 2 &&
        rect.height >= 2 &&
        rect.right > 0 &&
        rect.bottom > 0 &&
        rect.left < window.innerWidth &&
        rect.top < window.innerHeight;
      if (!visible) continue;
      if (target instanceof HTMLInputElement && target.type === "range")
        continue;
      const cx = rect.x + rect.width / 2;
      const cy = rect.y + rect.height / 2;
      for (const dx of offsets) {
        for (const dy of offsets) {
          const hit = document.elementFromPoint(cx + dx, cy + dy);
          if (hit !== null && (hit === target || target.contains(hit)))
            continue;
          failures.push(
            `${target.tagName.toLowerCase()}.${String(target.className).slice(0, 20)} @${Math.round(rect.x)},${Math.round(rect.y)} ${Math.round(rect.width)}x${Math.round(rect.height)} misses at ${dx},${dy} -> ${hit === null ? "nothing" : `${hit.tagName.toLowerCase()}.${String(hit.className).slice(0, 30)}`}`,
          );
        }
      }
    }

    // The slider's own target: the Control that surrounds the thumb input.
    const range = document.querySelector<HTMLInputElement>(
      "[data-fixture='slider'] input[type=range]",
    );
    const chain: string[] = [];
    for (let node = range; node !== null && chain.length < 5; ) {
      const rect = node.getBoundingClientRect();
      chain.push(
        `${node.tagName.toLowerCase()}.${String(node.className).slice(0, 20)} ${Math.round(rect.width)}x${Math.round(rect.height)}`,
      );
      node = node.parentElement;
    }
    const control = range?.parentElement?.parentElement ?? null;
    if (control === null) {
      failures.push(
        `the slider has no target to measure: ${chain.join(" < ")}`,
      );
    } else {
      const rect = control.getBoundingClientRect();
      if (rect.width < 24 || rect.height < 24) {
        failures.push(
          `the slider's target is ${Math.round(rect.width)}×${Math.round(rect.height)}: ${chain.join(" < ")}`,
        );
      }
    }
    return failures;
  });
  expect(
    hitArea,
    "a target is smaller than 24×24, or overlaps a neighbour",
  ).toEqual([]);

  // ── 4. Contrast, in all six palettes ──────────────────────────────────────
  //
  // Every measurement is collected before anything is asserted, so one run
  // reports every palette that is wrong rather than only the first.
  const ratios: string[] = [];
  const failures: string[] = [];
  for (const palette of PALETTES) {
    await setPalette(page, palette);
    const table = await probes(page);
    const pixels = await pixelsAt(
      page,
      table.map((probe) => probe.point),
    );
    for (const [index, probe] of table.entries()) {
      const pixel = pixels[index] ?? [0, 0, 0, 0];
      const ratio = round(ratioAgainstPixel(probe.fg, pixel));
      const on = `rgb(${pixel.slice(0, 3).join(",")})`;
      ratios.push(`${palette} ${probe.name} ${ratio}:1 (${probe.fg} on ${on})`);
      const minimum =
        PINNED_FLOOR[probe.name]?.[palette] ?? minimumFor(probe.name);
      // A divider carries no floor: measured and printed above, asserted of
      // nothing. `null` rather than `0`, so a divider cannot pass every palette
      // by having nothing asked of it (see `minimumFor`).
      if (minimum === null) continue;
      if (ratio < minimum) {
        failures.push(
          `${palette}: ${probe.name} is ${ratio}:1, below ${minimum}:1 — ${probe.fg} on ${on}`,
        );
      }
    }
  }

  // ── 4b. The focus boundary, in every palette ──────────────────────────────
  //
  // Focused by keyboard now that the geometry above is measured: a press sets
  // the heuristic that makes a programmatic focus match `:focus-visible`, which
  // is the state the boundary is for.
  const focusTarget = page.locator("[data-fixture='icon-focus'] button");
  await page.keyboard.press("Tab");
  await focusTarget.focus();
  await expect(focusTarget).toBeFocused();

  // DESIGN.md §5.4 is explicit that the 3px accent-at-18% halo does not discharge
  // this: the reading is the solid `outline`, not the ring.
  for (const palette of PALETTES) {
    await setPalette(page, palette);
    const focus = await page.evaluate(() => {
      const element = document.querySelector<HTMLElement>(
        "[data-fixture='icon-focus'] button",
      );
      if (element === null) return null;
      const row = document.querySelector("[data-fixture='icon-focus']");
      const rect = (row ?? element).getBoundingClientRect();
      return {
        outline: getComputedStyle(element).outlineColor,
        outlineWidth: getComputedStyle(element).outlineWidth,
        onClick: element.matches(":focus-visible"),
        point: { x: rect.x + 4, y: rect.y + rect.height / 2 },
      };
    });
    expect(focus, "the focused control is not mounted").not.toBeNull();
    if (focus === null) continue;
    expect(
      focus.onClick,
      `${palette}: the focused control does not match :focus-visible, so the boundary below is not the one a keyboard user sees`,
    ).toBe(true);
    const [pixel] = await pixelsAt(page, [focus.point]);
    const ratio = round(
      ratioAgainstPixel(focus.outline, pixel ?? [0, 0, 0, 0]),
    );
    ratios.push(`${palette} focus ${ratio}:1 (${focus.outline})`);
    if (ratio < BOUNDARY_MIN) {
      failures.push(
        `${palette}: the focus boundary is ${ratio}:1, below ${BOUNDARY_MIN}:1 — ${focus.outline} over the panel`,
      );
    }
  }
  // ── 4c. The slider's thumb, against both halves of its track ──────────────
  //
  // §5 colours neither the thumb nor the track's rest state, and §1 is plain
  // that a colour which does not distinguish one thing from another is not
  // there: the thumb was `--accent` on an `--accent` fill, which is 1:1 — the
  // control's own drag handle was invisible over half the track it moves along.
  //
  // The thumb is now two parts — a `--text` interior inside a 1px `--panel`
  // ring — and that is not decoration. The two halves of the track are the
  // accent and `--edge`, and in graphite and light they sit far enough apart
  // that no flat colour clears 3:1 against both (measured: the best single
  // colour left graphite at 1.81:1 and light at 1.35:1 against the rest half).
  // So each half is asked whether *either* part of the thumb beats it: the
  // filled half is answered by the interior, the unfilled half by the ring.
  // A thumb with one part still has to satisfy both halves with that part.
  //
  // The interior is read as a rendered pixel, because it is drawn *over* the
  // track and the composite is what the eye gets; the ring is a computed colour
  // composited over the same rendered pixel, so a fractional thumb edge cannot
  // hand a half-covered border pixel to the ratio. The two track samples are
  // 5px either side of the thumb, so they are the filled and the unfilled
  // halves wherever the value sits.
  for (const palette of PALETTES) {
    await setPalette(page, palette);
    const geometry = await page.evaluate(() => {
      const range = document.querySelector<HTMLInputElement>(
        "[data-fixture='slider'] input[type=range]",
      );
      // The nested `input[type=range]`'s parent is the thumb element itself —
      // a structural locator, not a class name.
      const thumb = range?.parentElement;
      if (thumb == null) return null;
      const rect = thumb.getBoundingClientRect();
      const middle = rect.y + rect.height / 2;
      const style = getComputedStyle(thumb);
      return {
        thumb: { x: rect.x + rect.width / 2, y: middle },
        filled: { x: rect.left - 5, y: middle },
        unfilled: { x: rect.right + 5, y: middle },
        interior: style.backgroundColor,
        ring: style.borderTopColor,
        ringWidth: Number.parseFloat(style.borderTopWidth),
      };
    });
    expect(geometry, "the slider's thumb is not mounted").not.toBeNull();
    if (geometry === null) continue;
    const [interior, filled, unfilled] = await pixelsAt(page, [
      geometry.thumb,
      geometry.filled,
      geometry.unfilled,
    ]);
    // Each half is beaten by the stronger of the thumb's two parts. Both
    // readings are ratios against an already-rendered pixel, so the interior is
    // one comparison and the ring is composited the way the browser composited
    // it.
    const against = (pixel: Rgba | undefined): readonly [number, number] => {
      if (pixel === undefined || interior === undefined) return [0, 0];
      return [
        round(contrast(interior, pixel)),
        round(ratioAgainstPixel(geometry.ring, pixel)),
      ];
    };
    const [fillInterior, fillRing] = against(filled);
    const [restInterior, restRing] = against(unfilled);
    const onFill = Math.max(fillInterior, fillRing);
    const onRest = Math.max(restInterior, restRing);
    ratios.push(
      `${palette} thumb ${onFill}:1 over the fill (interior ${fillInterior}, ring ${fillRing}), ` +
        `${onRest}:1 over the rest (interior ${restInterior}, ring ${restRing})`,
    );
    if (geometry.ringWidth < 1) {
      failures.push(
        `${palette}: the slider's thumb has no ring to measure (${geometry.ringWidth}px), so its interior is the whole thumb`,
      );
    }
    for (const [where, value] of [
      ["the filled half", onFill],
      ["the unfilled half", onRest],
    ] as const) {
      if (value < BOUNDARY_MIN) {
        failures.push(
          `${palette}: the slider's thumb is ${value}:1 against ${where} of its own track, below ${BOUNDARY_MIN}:1`,
        );
      }
    }
  }

  // ── 4d. Hover raises a control's resting edge to `--muted` ────────────────
  //
  // DESIGN.md §5 rule 6 is a rendered outcome, so it is read from the rendered
  // border, not from the class a jsdom test pins: a Tailwind compile miss, a
  // specificity loss to the resting `border-edge`, or a palette where `--muted`
  // and `--edge` read alike would all pass a class check and fail the eye. A
  // raised edge is a *changed* border colour on hover; a **blocked** well and
  // the **checked** toggle must not change.
  await setPalette(page, "graphite");
  const borderOf = (selector: string, useParent = false): Promise<string> =>
    page.$eval(
      selector,
      (el, parent: boolean) => {
        const node = parent ? el.parentElement : el;
        return node === null ? "" : getComputedStyle(node).borderTopColor;
      },
      useParent,
    );
  const hoverChanges = async (
    selector: string,
    useParent: boolean,
  ): Promise<readonly [string, string]> => {
    await page.mouse.move(0, 0);
    const rest = await borderOf(selector, useParent);
    await page.hover(selector);
    const on = await borderOf(selector, useParent);
    await page.mouse.move(0, 0);
    return [rest, on];
  };

  const [wellRest, wellHover] = await hoverChanges(
    "[data-fixture='number'] input",
    true,
  );
  expect(
    wellHover,
    `the well's edge did not rise on hover (${wellRest} -> ${wellHover})`,
  ).not.toBe(wellRest);

  const [blockedRest, blockedHover] = await hoverChanges(
    "[data-fixture='refused-number'] input",
    true,
  );
  expect(
    blockedHover,
    `a blocked well raised its edge on hover (${blockedRest} -> ${blockedHover})`,
  ).toBe(blockedRest);

  const [uncheckedRest, uncheckedHover] = await hoverChanges(
    "[data-fixture='toggle'] button",
    false,
  );
  expect(
    uncheckedHover,
    `the unchecked toggle's edge did not rise on hover (${uncheckedRest} -> ${uncheckedHover})`,
  ).not.toBe(uncheckedRest);

  const [checkedRest, checkedHover] = await hoverChanges(
    "[data-fixture='toggle-on'] button",
    false,
  );
  expect(
    checkedHover,
    `the checked toggle's accent border was overridden on hover (${checkedRest} -> ${checkedHover})`,
  ).toBe(checkedRest);

  // ── 4e. The choice row: focus and checked state are two visible things ────
  //
  // `ControlChoiceRow` carries focus (`:focus-visible` outline) and selection
  // (`[data-checked]`) as separate states, and the brief requires the two be
  // provably distinct: a keyboard author has to see which row is *focused* and
  // which is *chosen* at the same time, on two different rows. The fixture
  // mounts the control so its spacing and role gates see it too (sections 1–2);
  // this section drives the one state a static fixture cannot — a focused row
  // that is not the checked one — and reads the chosen row's fill against an
  // unchecked neighbour's, which is the only thing that distinguishes "chosen"
  // where no text does.
  const choiceGroup = page.locator('[data-fixture="choice-rows"]');
  await expect(choiceGroup).toBeVisible();
  const choiceChecked = choiceGroup.locator('[role="radio"][data-checked]');
  const choiceUnchecked = choiceGroup
    .locator('[role="radio"]:not([data-checked])')
    .first();
  await expect(choiceChecked).toHaveCount(1);
  await page.keyboard.press("Tab");
  await choiceUnchecked.focus();
  await expect(choiceUnchecked).toBeFocused();
  const twofold = await page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    const checked = document.querySelector<HTMLElement>(
      '[data-fixture="choice-rows"] [role="radio"][data-checked]',
    );
    if (active === null || checked === null) return null;
    const outline = getComputedStyle(active);
    return {
      distinct: active !== checked,
      activeChecked: active.getAttribute("aria-checked"),
      activeFocusVisible: active.matches(":focus-visible"),
      activeOutlineStyle: outline.outlineStyle,
      activeOutlineWidth: Number.parseFloat(outline.outlineWidth),
      checkedStillChecked: checked.getAttribute("aria-checked"),
    };
  });
  expect(twofold, "the choice rows did not mount").not.toBeNull();
  expect(
    twofold?.distinct,
    "the focused row is the checked row, so focus and checked state are not two states",
  ).toBe(true);
  expect(twofold?.activeChecked, "the focused row is the unchecked one").toBe(
    "false",
  );
  expect(
    twofold?.activeFocusVisible,
    "the focused row does not match :focus-visible, so its focus is not rendered",
  ).toBe(true);
  // `solid`, not the browser's `auto` ring: the class carries the design
  // language's outline, and a `focus-visible:outline-none` here would leave the
  // UA ring passing a bare `!== "none"` check (§5.4's boundary is the solid one).
  expect(
    twofold?.activeOutlineStyle,
    "the focused row paints the browser's auto ring, not §5's solid outline",
  ).toBe("solid");
  expect(
    twofold?.activeOutlineWidth,
    "the focused row's outline is not §5's 2px boundary",
  ).toBeGreaterThanOrEqual(2);
  expect(
    twofold?.checkedStillChecked,
    "the checked row stopped being checked while another row is focused",
  ).toBe("true");

  for (const palette of PALETTES) {
    await setPalette(page, palette);
    const row = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      const chosen = document.querySelector<HTMLElement>(
        '[data-fixture="choice-rows"] [role="radio"][data-checked]',
      );
      const plain = document.querySelector<HTMLElement>(
        '[data-fixture="choice-rows"] [role="radio"]:not([data-checked])',
      );
      if (active === null || chosen === null || plain === null) return null;
      const rect = active.getBoundingClientRect();
      // The *painted* fill, not just `background-color`: `--stage` is a flat
      // colour in five palettes but a gradient stack under `light` (see the
      // ROLES note above), where the colour resolves to transparent and the
      // gradient is what the eye gets.
      const fill = (element: Element): string => {
        const style = getComputedStyle(element);
        return `${style.backgroundColor}|${style.backgroundImage}`;
      };
      return {
        outline: getComputedStyle(active).outlineColor,
        chosenBg: fill(chosen),
        plainBg: fill(plain),
        point: { x: rect.x + 4, y: rect.y + rect.height / 2 },
      };
    });
    expect(row, "the choice row is not mounted").not.toBeNull();
    if (row === null) continue;
    const [pixel] = await pixelsAt(page, [row.point]);
    const ratio = round(ratioAgainstPixel(row.outline, pixel ?? [0, 0, 0, 0]));
    ratios.push(`${palette} choice-focus ${ratio}:1 (${row.outline})`);
    ratios.push(
      `${palette} choice-fill chosen=${row.chosenBg} unchecked=${row.plainBg}`,
    );
    if (ratio < BOUNDARY_MIN) {
      failures.push(
        `${palette}: the choice row's focus boundary is ${ratio}:1, below ${BOUNDARY_MIN}:1 — ${row.outline} on the panel`,
      );
    }
    // The chosen row's fill must differ from an unchecked neighbour's in every
    // palette; where they were identical, "chosen" would be carried by the
    // accent border alone and the fill would be decoration (§1).
    if (row.chosenBg === row.plainBg) {
      failures.push(
        `${palette}: a chosen choice row paints the same fill as an unchecked one (${row.chosenBg})`,
      );
    }
  }

  // Hand the focus back where section 4b left it — on the icon button section 5
  // reads for the forced-colours check — because this block moved it onto a
  // choice row.
  await page.keyboard.press("Tab");
  await page.locator("[data-fixture='icon-focus'] button").focus();
  await expect(
    page.locator("[data-fixture='icon-focus'] button"),
  ).toBeFocused();

  for (const line of ratios) {
    // The table is the evidence a reader needs to check a ratio without a
    // trace, so it is printed as well as attached.
    console.log(`contrast ${line}`);
  }
  expect(failures, "a required contrast minimum is not met").toEqual([]);

  // ── 5. Focus stays visible when the browser forces colours ────────────────
  //
  // Forced colours replaces author colours with system ones and drops box
  // shadows, so a focus treatment made of a shadow disappears. The solid
  // `outline` is what must survive, and `emulateMedia` is the only way to move
  // the browser into that mode.
  await page.emulateMedia({ forcedColors: "active" });
  const forced = await page.evaluate(() => {
    const active = matchMedia("(forced-colors: active)").matches;
    const element = document.querySelector<HTMLElement>(
      "[data-fixture='icon-focus'] button",
    );
    if (element === null)
      return { active, visible: false, detail: "no focus target" };
    const style = getComputedStyle(element);
    const width = Number.parseFloat(style.outlineWidth);
    const colour = style.outlineColor;
    const opaque = !/rgba\(0, 0, 0, 0\)|transparent/.test(colour);
    return {
      active,
      visible:
        style.outlineStyle !== "none" &&
        width >= 1 &&
        opaque &&
        element.matches(":focus-visible"),
      detail: `${style.outlineStyle} ${width}px ${colour}`,
    };
  });
  expect(
    forced.active,
    "the browser did not enter forced-colours mode, so this check proved nothing",
  ).toBe(true);
  expect(
    forced.visible,
    `the focus boundary disappears under forced colours: ${forced.detail}`,
  ).toBe(true);
  await page.emulateMedia({ forcedColors: null });

  // ── 6. Layout at both desktop sizes, and at 200% zoom ─────────────────────
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    const layout = await page.evaluate(() => {
      const root = document.querySelector<HTMLElement>("[data-fixture-root]");
      if (root === null) return null;
      const box = root.getBoundingClientRect();
      const escaped: string[] = [];
      for (const element of document.querySelectorAll(
        "[data-fixture-root] *",
      )) {
        const rect = element.getBoundingClientRect();
        if (rect.width === 0) continue;
        if (rect.right > box.right + 1 || rect.left < box.left - 1) {
          escaped.push(
            `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 24)}`,
          );
        }
      }
      return {
        pageScroll: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
        escaped,
      };
    });
    expect(layout, "the fixture is not mounted").not.toBeNull();
    if (layout === null) continue;
    // The long Unicode name is the case: §7.7 lets it ellipsize, never widen a
    // pane or push a control out of one.
    expect(
      layout.escaped,
      `at ${viewport.width}×${viewport.height} an element escapes the fixture: ${layout.escaped.join(", ")}`,
    ).toEqual([]);
    expect(
      layout.pageScroll,
      `at ${viewport.width}×${viewport.height} the page scrolls sideways`,
    ).toBeLessThanOrEqual(layout.viewport);
  }

  // 200% browser zoom, which CSS `zoom` on the root approximates: the pane
  // halves in CSS pixels, so the wrap that keeps a long name inside a pane is
  // the thing under test.
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  const zoomed = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>("[data-fixture-root]");
    if (root === null) return null;
    return {
      scroll: root.scrollWidth,
      client: root.clientWidth,
      pageScroll: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    };
  });
  expect(zoomed, "the fixture is not mounted").not.toBeNull();
  if (zoomed !== null) {
    expect(
      zoomed.pageScroll,
      `at 200% zoom the fixture overflows the page: ${JSON.stringify(zoomed)}`,
    ).toBeLessThanOrEqual(zoomed.viewport);
    expect(
      zoomed.scroll,
      `at 200% zoom the fixture overflows its own box: ${JSON.stringify(zoomed)}`,
    ).toBeLessThanOrEqual(zoomed.client + 1);
  }
  await page.evaluate(() => {
    document.documentElement.style.zoom = "";
  });

  // ── 7. Reduced motion leaves nothing animating ────────────────────────────
  //
  // The freeze comes off first, and that is load-bearing: it sets
  // `transition: none !important` on the same scope this section reads, so while
  // it is applied every duration is `0s` and the assertion below holds whatever
  // the stylesheet does. It was applied here for a whole round and the check was
  // therefore vacuous.
  //
  // The positive control is what stops that recurring: with motion *allowed*,
  // something in the fixture must be animating — the shell transitions its
  // colours and the toggle's thumb its transform — or this section is reading a
  // page that cannot move and proves nothing by finding no movement. Then the
  // same probe under `reduce` must come back empty.
  await clearStyle(page, FREEZE);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const allowed = await movingElements(page);
  expect(
    allowed,
    "nothing animates with motion allowed, so this check cannot observe motion at all",
  ).not.toEqual([]);

  await page.emulateMedia({ reducedMotion: "reduce" });
  const moving = await movingElements(page);
  expect(
    moving,
    `an element still animates under prefers-reduced-motion: ${moving.join(", ")}`,
  ).toEqual([]);
  await page.emulateMedia({ reducedMotion: null });

  // ── 8. The captures the parity gate compares ──────────────────────────────
  //
  // Blurred first: focusing the icon button opened its tooltip, and a popup
  // left over its neighbour is an artefact of how the states were driven rather
  // than part of the control set. Two palettes, because the stress set asks for
  // graphite and editorial: graphite is the one the mockup is drawn on
  // (`docs/design/mockups/current/controls.html`: `#0b0e12` paper, `#171c23`
  // wells, `#72e0c0` accent) and so the two pictures are comparable, and
  // editorial is the light ground the same vocabulary has to hold on.
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await freeze(page);
  await setPalette(page, "graphite");
  await captureVisualReview(page, testInfo, "control-set");
  await setPalette(page, "editorial");
  // `setPalette` sets the attribute with no stored choice in storage, so unlike
  // the Appearance-tab route nothing holds this ground across a re-render. The
  // helper asserts it before the shot rather than assuming it: ruling 3's
  // light/dark pair must not be a picture the pin repainted to graphite.
  await captureVisualReview(
    page,
    testInfo,
    "control-set-editorial",
    undefined,
    "editorial",
  );
  // The freeze stays on *through* the captures on purpose: the shell transitions
  // colour over 140ms, and a palette change captured mid-fade is a picture of
  // neither palette — the first editorial capture here showed teal toggles and
  // invisible labels for exactly that reason. It comes off afterwards because it
  // is a measuring device, not part of the fixture.
  await clearStyle(page, FREEZE);

  // The measurements are the report's evidence and are printed so a run can be
  // read without opening a trace.
  testInfo.annotations.push({
    type: "contrast",
    description: ratios.join(" | "),
  });
});

/**
 * The shell parity capture (DESIGN.md §7.1–§7.3, mockup
 * `docs/design/mockups/current/shell.html`).
 *
 * Plan 1's mechanism, turned on the rebuilt shell: the built editor is opened
 * in the state the mockup draws — the **Add** slot showing, nothing selected —
 * and photographed for Task 10's side-by-side. The whole-editor and dock
 * captures in `editor.spec.ts` are the other two of the comparison set.
 *
 * **It fails if the shell is not the new one**, which is the point: an old
 * shell photographed happily is a comparison against the wrong thing. Two
 * facts are asserted before the picture is written — the rail carries DESIGN.md
 * §7.2's four slots (the pre-rail shell had an Insert menu and no rail, so the
 * count is 0) and exactly one of the rail's panes is showing (the shell keeps
 * every pane mounted and hides the others, so a leftover second pane in the
 * column shows as two).
 *
 * A `--grep` that matches nothing exits 0 with zero tests, so the run's own
 * summary — "1 test", this file — is the proof it ran at all, not the exit code.
 */
test("captures the shell with the Add pane open and nothing selected", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await page.goto(EDITOR);
  await expect(
    page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
  ).toBeVisible();

  // §7.2's four slots, and only a shell that has the rail has them.
  await expect(page.locator(".editor-shell-rail-slot")).toHaveCount(4);

  await openPane(page, "Add");
  await expect(page.locator('[data-vigilia-panel="add"]')).toBeVisible();
  // Exactly one of the rail's four panes is out. Scoped to the rail's own
  // column (`.editor-shell-panel`) because the inspector is built from the same
  // `Pane` component and carries `style` and `selection` panels of its own — a
  // bare `[data-vigilia-panel]` count of six panes is not "one pane showing".
  // `:visible`, not a bare count: every pane stays mounted and the ones that
  // are not showing carry `hidden` (`display: none`), which is not showing.
  // **A direct child**, because a sub-panel names itself with the same
  // attribute: the Document pane's References section writes
  // `data-vigilia-panel="style"`, so the descendant form counts 2 the moment
  // this capture is pointed at Document (the rail-pane capture measures it).
  await expect(
    page.locator(".editor-shell-panel > [data-vigilia-panel]:visible"),
  ).toHaveCount(1);

  // Park the pointer over the stage before the shot. `openPane` clicked the Add
  // slot, leaving the pointer hovering it: after 600ms the slot's tooltip
  // bubble opens and paints over the rail/pane boundary — a difference the
  // mockup does not draw, in the one image this plan calls the primary
  // comparison.
  const stage = await page.locator(".editor-shell-stage").boundingBox();
  if (stage !== null) {
    await page.mouse.move(
      stage.x + stage.width / 2,
      stage.y + stage.height / 2,
    );
  }

  await captureVisualReview(page, testInfo, "editor-shell-add");
});

/** DESIGN.md §6's weight rule, transcribed from `editor-shell/icons.ts`'s
 *  `glyphStrokeWidth`. Transcribed rather than imported because `tests/e2e/`
 *  belongs to no tsconfig (vg-192), the same reason `SPACING_STEPS` above is a
 *  copy of DESIGN.md §3 rather than an import: a cross-package import would arrive
 *  untyped and buy coupling, not safety. §6 is the source, so a §6 change
 *  updates both in the same commit. */
function glyphWeight(size: number): number {
  if (size <= 10) return 2;
  if (size <= 13) return 1.8;
  return 1.7;
}

/** DESIGN.md §6's three tiers, for the membership reading beside the rule. */
const GLYPH_TIERS: readonly number[] = [2, 1.8, 1.7];

/**
 * The glyph and word parity capture (DESIGN.md §6 and §9, mockup
 * `docs/design/mockups/current/shell.html`).
 *
 * Plan 1's mechanism, turned on the surface this plan changed: the built
 * editor is opened in the state the drawing shows — the **Add** slot open,
 * nothing selected — in **graphite**, the ground the drawing is drawn on, and
 * the shell is photographed for the side-by-side. This plan changes no layout,
 * so the comparison is the **glyphs and the words inside** the surfaces plans
 * 2–5 built (the rail's four slot glyphs, the pane's footer, the status bar's
 * readings), never their geometry. The whole-editor and dock captures in
 * `editor.spec.ts` and the pane captures above are the rest of the set.
 *
 * **The mechanical assertion is the rendered DOM, and it is the half
 * `design:check` cannot see.** The token scan reads `px` and hex literals in
 * source; a glyph's weight is a JSX prop — `strokeWidth={glyphStrokeWidth(size)}`
 * or a lucide component's own default — so no source scan can read it. This
 * test reads the built shell instead: every stroke `<svg>` the shell draws is at
 * §6's weight for its own size, sits in §6's tiers, and carries **no descendant
 * `stroke-width`** — a child that overrode its root would be a second weight
 * inside one glyph, and reading only each root is exactly how a heavy arc goes
 * unseen. Then §6's second rule: every icon-only control's rendered tooltip is
 * the same string as its `aria-label`.
 *
 * **It fails if the glyphs are not the new ones**, and the weight reading was
 * reddened two ways. A bundle built from before Task 2 (`b5abe5f0`, the parent of
 * the commit that added `icons.ts`, built in a `git worktree`) fails it on every
 * glyph: each is drawn at stroke-width 1.75, which is not one of §6's tiers.
 * Planting a wrong weight in `glyphStrokeWidth` and rebuilding fails it too, and
 * `design:check` stays green through that break — which is why a rendered reading
 * exists at all. The pairing half has its own plant: appending one space in
 * `useControlTooltip`'s `text` — the exact drift §6 names — fails it on every
 * icon-only control in the state ("Composition: the tooltip reads
 * \"Composition \""), and reverting by `cp` restores the file byte for byte.
 *
 * A `--grep` that matches nothing exits 0 with zero tests, so the run's own
 * summary — "1 test", this file — is the proof it ran at all, not the exit code.
 */
test("captures the shell glyphs and words with the Add pane open", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  // The drawing's own ground. `prefersDark` is the shell's route to graphite
  // (`palette.ts`'s `systemShellPalette`), and a dark OS is the only way to ask
  // for it without opening the settings modal and changing the state the
  // drawing shows.
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto(EDITOR);
  await expect(
    page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
  ).toBeVisible();
  await expect(
    page.locator("html"),
    "the shell is not on the drawing's ground, so the two pictures would not compare",
  ).toHaveAttribute("data-shell-palette", "graphite");

  // §7.2's four slots, and only a shell that has the rail has them.
  await expect(page.locator(".editor-shell-rail-slot")).toHaveCount(4);
  await openPane(page, "Add");
  await expect(page.locator('[data-vigilia-panel="add"]')).toBeVisible();
  // Exactly one of the rail's four panes is out, by the direct-child reading the
  // shell capture above documents.
  await expect(
    page.locator(".editor-shell-panel > [data-vigilia-panel]:visible"),
  ).toHaveCount(1);

  // ── 1. Every glyph the shell draws is at §6's weight for its own size ──────
  //
  // Scoped to `#app` (the React root), so the tooltip `tooltip.ts` portals to
  // `document.body` is out of frame. A hidden pane is included on purpose: the
  // shell keeps every pane mounted, and a glyph the author cannot see is still a
  // glyph the vocabulary set. A fill-only picture — a state dot, a QR — computes
  // `stroke: none` and is not a stroke glyph (§6's one-weight set is stroke
  // chrome), so it is skipped rather than asserted against a weight it has none
  // of.
  //
  // Three boundaries, stated rather than left to be inferred. A mark with **no
  // `width` attribute, or a non-numeric one**, is skipped: `Number(width)` is
  // `NaN` for a CSS-sized mark such as `width="100%"`, so this is every
  // width-bearing stroke glyph under the root, not every mark the shell draws. A
  // glyph **portalled outside `#app`** is unreached. And only **this one state**
  // is read — the Add pane open on graphite.
  const glyphs = await page.evaluate(() => {
    const drawn: {
      readonly where: string;
      readonly size: number;
      readonly stroke: number;
      readonly overrides: readonly string[];
    }[] = [];
    for (const svg of document.querySelectorAll("#app svg")) {
      const width = svg.getAttribute("width");
      if (width === null || !Number.isFinite(Number(width))) continue;
      const style = getComputedStyle(svg);
      if (style.stroke === "none") continue;
      const button = svg.closest("button");
      const where =
        button?.getAttribute("aria-label") ??
        String(
          svg.getAttribute("class") ??
            svg.getAttribute("data-vigilia-card-diagram") ??
            svg.parentElement?.className ??
            svg.tagName,
        ).slice(0, 40);
      drawn.push({
        where,
        size: Number(width),
        stroke: Number.parseFloat(style.strokeWidth),
        overrides: [...svg.querySelectorAll("[stroke-width]")].map(
          (child) =>
            `${child.tagName.toLowerCase()} stroke-width=${String(child.getAttribute("stroke-width"))}`,
        ),
      });
    }
    return drawn;
  });

  // A guard that asserted over nothing would pass for the wrong reason — the
  // state has to have drawn glyphs before any weight below is a reading.
  expect(
    glyphs.length,
    "the shell drew no stroke glyph to read, so this is not a reading",
  ).toBeGreaterThan(20);

  const wrongWeight: string[] = [];
  const offTier: string[] = [];
  const overridden: string[] = [];
  const sizes: string[] = [];
  for (const glyph of glyphs) {
    sizes.push(String(glyph.size));
    if (!GLYPH_TIERS.includes(glyph.stroke)) {
      offTier.push(
        `${glyph.where} ${glyph.size}px stroke-width=${glyph.stroke}`,
      );
    }
    if (glyph.stroke !== glyphWeight(glyph.size)) {
      wrongWeight.push(
        `${glyph.where}: ${glyph.size}px is drawn at ${glyph.stroke}, and §6's rule for that size is ${glyphWeight(glyph.size)}`,
      );
    }
    for (const override of glyph.overrides) {
      overridden.push(
        `${glyph.where}: a descendant carries its own ${override}`,
      );
    }
  }
  // More than one size in play, so the case is not passing over a single tier by
  // accident — a shell that drew one weight everywhere is the defect §6's tiers
  // replaced.
  expect(
    new Set(sizes).size,
    `every glyph was drawn at one size (${sizes.join(", ")}), so the tiers were not exercised`,
  ).toBeGreaterThan(1);
  expect(offTier, "a glyph's weight is not one of §6's tiers").toEqual([]);
  expect(wrongWeight, "a glyph is not at §6's weight for its own size").toEqual(
    [],
  );
  expect(
    overridden,
    "a glyph's descendant overrides its root's weight, which is a second weight inside one glyph",
  ).toEqual([]);
  testInfo.annotations.push({
    type: "glyph-weights",
    description: `${glyphs.length} glyphs at sizes ${[...new Set(sizes)].sort((a, b) => Number(a) - Number(b)).join(", ")}px`,
  });

  // ── 2. An icon-only control's tooltip is its accessible name (§6) ──────────
  //
  // The **rendered** popup, not the pairing's source: `ControlIconButton` and
  // `useControlTooltip` set both from one `label` by construction, and this
  // proves the string reaches the screen a reader is shown. An icon-only control
  // is read as one — a non-empty `aria-label` on a button that renders no text —
  // so a labelled button (`Publish`) is not swept in. A hidden pane's control
  // cannot be focused, so it is skipped and named in the count.
  //
  // **This population is narrower than the weight scan above, and the boundary
  // is stated for that reason.** It is `<button>` elements with an `aria-label`;
  // an icon-only control that is not a `<button>`, or one named through
  // `aria-labelledby` instead, is not swept in. Neither occurs in this state —
  // the shell has no `role="button"`, and the only `aria-labelledby` holders are
  // the segmented control, the slider's range, `settings.tsx`'s palette group and
  // the dialog, none of them a button — but the weight half is exhaustive over
  // the root and this half is not.
  const iconOnly = await page.evaluate(() => {
    const out: { readonly label: string; readonly index: number }[] = [];
    for (const [index, button] of [
      ...document.querySelectorAll<HTMLElement>("#app button[aria-label]"),
    ].entries()) {
      const label = button.getAttribute("aria-label") ?? "";
      if (label === "") continue;
      if ((button.textContent ?? "").trim() !== "") continue;
      if (button.hasAttribute("disabled")) continue;
      const rect = button.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      out.push({ label, index });
    }
    return out;
  });
  expect(
    iconOnly.length,
    "the shell mounted no icon-only control, so the pairing was not read",
  ).toBeGreaterThan(0);

  const disagreements: string[] = [];
  const popup = page.locator(".editor-shell-tooltip span");
  for (const control of iconOnly) {
    await page.locator("#app button[aria-label]").nth(control.index).focus();
    let text: string;
    try {
      await popup.waitFor({ state: "attached", timeout: 2000 });
      text = (await popup.first().textContent()) ?? "";
    } catch {
      text = "<no tooltip opened>";
    }
    if (text !== control.label) {
      disagreements.push(`${control.label}: the tooltip reads "${text}"`);
    }
  }
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  );
  expect(
    disagreements,
    "an icon-only control's tooltip disagrees with its accessible name",
  ).toEqual([]);
  testInfo.annotations.push({
    type: "tooltip-names",
    description: `${iconOnly.length} icon-only control(s): the tooltip is the aria-label for each`,
  });

  // Park the pointer over the stage before the shot, for the reason the shell
  // capture above gives: `openPane` left it hovering a rail slot, and that
  // slot's tooltip opens over the rail/pane boundary after 600ms.
  const stage = await page.locator(".editor-shell-stage").boundingBox();
  if (stage !== null) {
    await page.mouse.move(
      stage.x + stage.width / 2,
      stage.y + stage.height / 2,
    );
  }

  await captureVisualReview(page, testInfo, "editor-shell-glyphs");
});

/**
 * The panes' parity capture (DESIGN.md §7.3, mockup
 * `docs/design/mockups/current/shell.html`).
 *
 * The same mechanism as the shell capture above, turned on the four rebuilt
 * panes: the built editor is opened with one rail pane showing at a time, and
 * each pane's own chrome and body is photographed for Task 12's comparison.
 * The mockup draws a specimen of **Add** only, so the other three are compared
 * against DESIGN.md and this plan's field inventories rather than a drawing —
 * which is why the image is the pane itself and not the whole shell: the field
 * inventory is what has to be readable in it.
 *
 * **Each capture fails if the pane is not the new one**, which is the point: an
 * old pane photographed happily is a comparison against the wrong thing. Three
 * facts are asserted before a picture is written, and the third is the failure
 * this capture exists to catch:
 *
 * - the pane's own `[data-vigilia-panel]` handle is showing, and it is the only
 *   pane the rail's column has out (the shell keeps every pane mounted and
 *   hides the others, so a leftover second pane shows as two);
 * - the handle is the **host's** — `editor-shell/pane.tsx` writes it, so it
 *   names which pane is mounted rather than what the pane rendered;
 * - the pane holds no native `<select>` and no `input[type=range]`. The four
 *   panes are React on the control set (a well that opens a list is a
 *   `ControlSelect`, a range is a `ControlSlider`), and a native control
 *   reappearing is exactly what a screenshot would still show as "a pane".
 *   The only hit left under `panes/` is the prose that says so
 *   (`tokens/preset-list.tsx:29`).
 *
 * A `--grep` that matches nothing exits 0 with zero tests, so the run's own
 * summary — "1 test", this file — is the proof it ran at all, not the exit code.
 */
test("captures each pane of the four-slot rail in the design language", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await page.goto(EDITOR);
  await expect(
    page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
  ).toBeVisible();

  // §7.2's four slots, one pane each.
  await expect(page.locator(".editor-shell-rail-slot")).toHaveCount(4);

  /** The rail's slot word, and the DOM handle that slot's pane is mounted
   *  under. The two differ for Composition only: `layers` is the name the
   *  panel CSS and the older specs already browse by, and the pane's visible
   *  title is the slot's own word (`shell-layout.tsx` states the ruling). */
  const panes = [
    { slot: "Composition", panel: "layers" },
    { slot: "Add", panel: "add" },
    { slot: "Tokens", panel: "tokens" },
    { slot: "Document", panel: "document" },
  ] as const;

  for (const { slot, panel } of panes) {
    await openPane(page, slot);

    // The pane's surface is the rail's own column, not the `section` inside it.
    // The column is the scroll owner (§7.7) and is the box the author sees: it
    // is 246×636 against a viewport of 1280×720, and a pane taller or wider
    // than it is clipped there. Photographing the inner `section` instead
    // captures the pane's whole *layout* box with that clip ignored — measured,
    // the Tokens pane is 220×2166, so its image was 1800px of blank page and
    // the status bar, none of which an author ever sees.
    const column = page.locator(".editor-shell-panel");
    const pane = page.locator(`[data-vigilia-panel="${panel}"]`);
    await expect(pane, `${slot}: its pane is not showing`).toBeVisible();
    // One pane out, read as a **direct child** of the rail's column. The
    // descendant form counts a sub-panel as a pane: the Document pane's own
    // References section names itself `data-vigilia-panel="style"`
    // (`panes/document/references.tsx`), so with Document showing a descendant
    // match is 2 — measured, `["document", "style"]` — and `"style"`'s parent
    // carries no column class. A visible `pane` plus one visible direct child
    // is what says it is the one the rail has out.
    await expect(
      page.locator(".editor-shell-panel > [data-vigilia-panel]:visible"),
      `${slot} is not the pane the rail has out`,
    ).toHaveCount(1);

    await expect(
      pane.locator("select"),
      `${slot}: a native <select> is in the pane`,
    ).toHaveCount(0);
    await expect(
      pane.locator('input[type="range"]'),
      `${slot}: a native range input is in the pane`,
    ).toHaveCount(0);

    // Park the pointer over the stage before the shot, for the reason the
    // shell capture gives: `openPane` left it hovering a rail slot, and that
    // slot's tooltip opens over the rail/pane boundary after 600ms.
    const stage = await page.locator(".editor-shell-stage").boundingBox();
    if (stage !== null) {
      await page.mouse.move(
        stage.x + stage.width / 2,
        stage.y + stage.height / 2,
      );
    }

    await captureVisualReview(
      page,
      testInfo,
      `pane-${slot.toLowerCase()}`,
      column,
    );
  }
});

/**
 * The Settings surface's parity capture (spec §7, §13, mockup
 * `docs/design/mockups/current/settings.html`).
 *
 * Plan 1's mechanism, turned on the modal the rail's gear opens: the built
 * editor is opened, the gear pressed, and each of §7's three tabs photographed
 * beside the mockup's settings surface. Two palettes, because the mockup draws one
 * ground and a hard-coded hex is invisible in a single one — graphite is the
 * paper the mockup is drawn on, editorial the light ground the same vocabulary
 * has to hold on.
 *
 * **It fails if the surface is not the new one**, which is the point: a picture
 * written over the old shell is a comparison against the wrong thing. Four
 * facts are asserted before any image is written — the header carries no
 * palette control (§7 moved the chip into this modal), the gear is on the rail
 * and is there, the modal holds §7's three tabs by name, and exactly one panel
 * is showing (every panel stays mounted, so a leftover second one shows as two).
 *
 * The About tab's release row renders only where the open document carries a
 * `metadata.version` (`settings.tsx`'s `versionFacts`). No document this suite
 * can load has one — the starter and blank-theme builders write metadata
 * without it (`new-fabric-theme.ts`), and no fixture or library stub supplies
 * one — so the row is absent from this image and the run says so in its own
 * annotation rather than inventing a version to sit in the picture.
 *
 * A `--grep` that matches nothing exits 0 with zero tests, so the run's own
 * summary — "1 test", this file — is the proof it ran at all.
 */
test("captures the settings modal's three tabs in the design language", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
  test.setTimeout(120_000);

  await page.goto(EDITOR);
  await expect(
    page.locator("#vigilia-fabric-editor canvas.upper-canvas"),
  ).toBeVisible();

  // §7 moved the palette chip out of the header; a chip or a choice row still
  // there means this is the old header and the frame would be of the wrong thing.
  await expect(
    page.locator(
      ".editor-shell-header .editor-shell-palette-swatch, .editor-shell-header [data-vigilia-palette-choice]",
    ),
  ).toHaveCount(0);

  const gear = page.locator(SETTINGS_GEAR);
  await expect(gear).toHaveCount(1);
  await gear.click();
  const dialog = page.getByRole("dialog", SETTINGS_DIALOG);
  await expect(dialog).toBeVisible();

  // §7's three tabs, by the words the modal prints, and one panel out.
  await expect(dialog.getByRole("tab")).toHaveCount(3);
  for (const name of ["Appearance", "Keyboard", "About"]) {
    await expect(dialog.getByRole("tab", { name })).toBeVisible();
  }
  await expect(dialog.locator('[role="tabpanel"]:visible')).toHaveCount(1);

  /** One tab, shown. `data-active` is the hook the stylesheet paints the active
   *  tab's accent border from, so a tab that did not take fails here rather than
   *  being photographed under a picture named for it. */
  const show = async (name: string): Promise<void> => {
    const tab = dialog.getByRole("tab", { name });
    await tab.click();
    await expect(tab).toHaveAttribute("data-active", "");
    await expect(dialog.locator('[role="tabpanel"]:visible')).toHaveCount(1);
  };

  // The About tab's facts, read from the surface rather than assumed: the schema
  // version is the build's own and is always there.
  await show("About");
  await expect(
    dialog.locator('[data-vigilia-about-fact="schema-version"]'),
  ).toHaveText(/\S/);
  // **The release row must be absent, and this assertion is what says so.** It
  // renders only where the open document carries `metadata.version`
  // (`settings.tsx`'s `versionFacts`), and no document this suite can load has
  // one — so this frame is the absent case and the six pictures below are of
  // *that* modal. `vg-288`: the day a loadable document carries a version, this
  // reddens and the capture is re-taken, rather than a changed modal being
  // photographed while a non-assertion records it.
  await expect(
    dialog.locator('[data-vigilia-about-fact="release-version"]'),
  ).toHaveCount(0);
  testInfo.annotations.push({
    type: "about",
    description:
      "release version row absent, asserted: no document this suite loads carries a metadata.version",
  });

  // Graphite first: the mockup is drawn on it, so the two pictures compare.
  await show("Appearance");
  await dialog.getByRole("radio", { name: "graphite", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-shell-palette",
    "graphite",
  );

  /** One tab, shown and photographed. The pointer is parked on the dialog's own
   *  top-left corner — the lead heading, no control — because the click left it
   *  on a tab, and a hover state in the frame is an artefact of how the picture
   *  was driven rather than part of the surface. */
  const capture = async (tab: string, suffix: string): Promise<void> => {
    await show(tab);
    const box = await dialog.boundingBox();
    if (box !== null) await page.mouse.move(box.x + 2, box.y + 2);
    await captureVisualReview(
      page,
      testInfo,
      `settings-${tab.toLowerCase()}${suffix}`,
      dialog,
    );
  };

  for (const tab of ["Appearance", "Keyboard", "About"]) {
    await capture(tab, "");
  }

  await show("Appearance");
  await dialog.getByRole("radio", { name: "editorial", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-shell-palette",
    "editorial",
  );
  for (const tab of ["Appearance", "Keyboard", "About"]) {
    await capture(tab, "-editorial");
  }
});

/** The luminance of a declared surface value, gradient or flat.
 *
 *  `--bg` is a gradient stack under `light` and has no single luminance, so its
 *  colour stops are averaged — the ground the eye gets rather than a stop the
 *  file happens to write first. Any other palette's `--bg` is one flat colour. */
function surfaceLuminance(value: string): number {
  const tokens = value.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi) ?? [];
  const colours = tokens
    .map(parseColour)
    .filter((colour): colour is Rgba => colour !== null);
  if (colours.length === 0) return Number.NaN;
  const mean: Rgba = [
    colours.reduce((sum, colour) => sum + colour[0], 0) / colours.length,
    colours.reduce((sum, colour) => sum + colour[1], 0) / colours.length,
    colours.reduce((sum, colour) => sum + colour[2], 0) / colours.length,
    1,
  ];
  return luminance(mean);
}

/**
 * Graphite's roles are the drawing's, verbatim, and the other five are **derived
 * from graphite** rather than tuned beside it (plan 7 Task 4; the user's ruling
 * of 2026-10-10: "The graphite palette takes from the mockup directly. The other
 * palettes derived from it").
 *
 * **The per-role cases read the drawing, not a copy of it.** Each of the
 * drawing's eleven tokens (`current/shell.html:17-18`, *eleven* — the brief that
 * scoped this row listed ten and the current set carries an eleventh, `--hot`)
 * is compared against the product variable it owns, read from `:root` under
 * graphite. A value transcribed into this file would be a second owner of it,
 * which is what `mockup-values.ts` exists to prevent.
 *
 * **The second half is what keeps the ruling true.** Six transcribed value sets
 * pass the per-role cases and drift apart the moment one is edited, so the
 * palette set is also read as a *system*: every palette's surfaces must keep
 * graphite's ladder — the ground lowest, the panel above it, a control's surface
 * above the panel. **Where graphite separates two rungs, a derived palette
 * separates them too**, which is the rule and not a threshold: order alone is
 * satisfied by a ladder collapsed to steps of `0.0001`, and a luminance step of
 * "at least X" has no rule behind it, so none is invented here.
 *
 * **Editorial is the one licensed exception, and its own block says why.** It is
 * `--panel == --panel-2` — the same cream on both rungs — because editorial
 * separates a control from the panel it sits in with `--vigilia-control-bg`
 * (`#f5f1e8` under the `#fffdf7` paper) rather than with a surface step, so its
 * ladder has two rungs where graphite has three. That is a shape, not a drift,
 * and it is named here rather than allowed for every palette.
 *
 * `light` is the palette the drawn shell does not resemble. The plan's Step 3
 * reads its ladder as an inversion of graphite's; measured, `light` **ascends**
 * like graphite and the other four (its ground is a gradient, averaged above),
 * so no palette is asserted to invert. The divergence is a report finding, not a
 * value change made here.
 *
 * **The third section is `vg-307`**, which neither of the first two can see: an
 * alias whose *source* the block does not declare resolves from the baseline, so
 * four palettes painted editorial's danger and editorial's ink on the primary
 * button while every measured ratio here stayed green — on the same inherited
 * value.
 *
 * A `--grep` that matches nothing exits 0 with zero tests, so the run's own
 * summary — "1 test", this file — is the proof it ran at all.
 */
test("graphite's roles are the drawing's, and the other five keep its ladder", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await openShell(page);

  const drawing = readMockup();
  const read = async (
    palette: Palette,
    names: readonly string[],
  ): Promise<Record<string, string>> => {
    await setPalette(page, palette);
    return page.evaluate((wanted) => {
      const root = getComputedStyle(document.documentElement);
      return Object.fromEntries(
        wanted.map((name) => [name, root.getPropertyValue(name).trim()]),
      );
    }, names);
  };

  // ── Graphite, role by role, against the drawing's own token table ──────────
  const variables = [
    ...new Set(SHELL_ROLES.map((role) => role.productVariable)),
  ];
  const graphite = await read("graphite", variables);
  const failures: string[] = [];
  const table: string[] = [];
  for (const role of SHELL_ROLES) {
    const declared = mockupDeclared(
      drawing,
      SHELL_TOKEN_SELECTOR,
      role.drawingToken,
    );
    const rendered = graphite[role.productVariable] ?? "";
    table.push(
      `${role.drawingToken} → ${role.productVariable} = "${rendered}" (drawing ${declared})`,
    );
    if (rendered.toLowerCase() !== declared.toLowerCase()) {
      failures.push(
        `${role.drawingToken}: the drawing declares ${declared}; graphite's \`${role.productVariable}\` is "${rendered}"`,
      );
    }
  }
  for (const line of table) console.log(`graphite ${line}`);
  testInfo.annotations.push({
    type: "graphite-roles",
    description: table.join(" | "),
  });

  // ── The ladder, in all six, against graphite's order ──────────────────────
  const ladder: string[] = [];
  const ladderFailures: string[] = [];
  for (const palette of PALETTES) {
    const values = await read(palette, ["--bg", "--panel", "--panel-2"]);
    const bg = surfaceLuminance(values["--bg"] ?? "");
    const panel = surfaceLuminance(values["--panel"] ?? "");
    const panel2 = surfaceLuminance(values["--panel-2"] ?? "");
    ladder.push(
      `${palette} bg=${bg.toFixed(4)} panel=${panel.toFixed(4)} panel-2=${panel2.toFixed(4)}`,
    );
    if (
      !Number.isFinite(bg) ||
      !Number.isFinite(panel) ||
      !Number.isFinite(panel2)
    ) {
      ladderFailures.push(
        `${palette}: a surface did not resolve to a colour (bg "${values["--bg"]}", panel "${values["--panel"]}", panel-2 "${values["--panel-2"]}")`,
      );
      continue;
    }
    // Graphite's ladder is `--bg` < `--panel` < `--panel-2`, **strictly**, and
    // a derived palette that collapses a rung has stopped deriving from it —
    // order alone survives a ladder squeezed to `0.0001` steps. **How far apart
    // the rungs must sit is `vg-308`**, and it is a register row rather than a
    // constant here because a magnitude floor has no rule in DESIGN.md yet.
    //
    // Editorial is the one named exception, for the reason its own block gives:
    // its control-inside-panel separation is carried by `--vigilia-control-bg`,
    // not by the rung, so `--panel` and `--panel-2` are deliberately one cream.
    // Any *other* palette that fails to separate is a derivation bug to report,
    // never an exception to widen.
    const isEditorial = palette === "editorial";
    const holds = isEditorial
      ? bg < panel && panel === panel2
      : bg < panel && panel < panel2;
    if (!holds) {
      ladderFailures.push(
        `${palette}: the ladder is ${bg.toFixed(4)} / ${panel.toFixed(4)} / ${panel2.toFixed(4)}, and graphite's is --bg < --panel < --panel-2${
          isEditorial
            ? " (editorial's licensed equal pair: see the comment)"
            : ""
        }`,
      );
    }
  }
  for (const line of ladder) console.log(`ladder ${line}`);
  testInfo.annotations.push({
    type: "palette-ladder",
    description: ladder.join(" | "),
  });

  // ── `vg-307`: each palette's danger is its own, and not the baseline's ────
  //
  //  `--hot: var(--shell-danger)` is substituted where it is *written*, so a
  //  block that declares the alias and not its source resolves `--hot` — and the
  //  publish button's fill — from the baseline `:root` block: editorial's dark
  //  red under four palettes whose paper is warm. `shell-appearance.spec.ts` and
  //  the ratio probes above could not see it, because the same inherited value
  //  is what every one of them measured.
  //
  //  The static half of this contract is `editor-shell.tokens.test.ts`, which
  //  asserts each block declares every source a role can name. This is the
  //  browser's reading of the same thing, and the assertion is a **comparison
  //  against the baseline**, not a copy of any palette's value.
  const danger: string[] = [];
  const dangerFailures: string[] = [];
  const baselineDanger =
    (await read("editorial", ["--shell-danger"]))["--shell-danger"] ?? "";
  for (const palette of PALETTES) {
    const value =
      (await read(palette, ["--shell-danger"]))["--shell-danger"] ?? "";
    danger.push(`${palette} --shell-danger = "${value}"`);
    if (value === "") {
      dangerFailures.push(`${palette}: --shell-danger resolves to nothing`);
    } else if (
      palette !== "editorial" &&
      palette !== "graphite" &&
      value === baselineDanger
    ) {
      dangerFailures.push(
        `${palette}: --shell-danger is the baseline's ${baselineDanger}, so ` +
          "`--hot` and the publish button paint the wrong palette's danger",
      );
    }
  }
  for (const line of danger) console.log(`danger ${line}`);
  testInfo.annotations.push({
    type: "palette-danger",
    description: danger.join(" | "),
  });

  expect(
    failures,
    "graphite's roles are not the drawing's token table",
  ).toEqual([]);
  expect(
    ladderFailures,
    "a palette's surfaces no longer keep graphite's ladder",
  ).toEqual([]);
  expect(
    dangerFailures,
    "a palette names a danger it does not declare",
  ).toEqual([]);
});

/** The chrome's own contrast, under all six palettes, against §5's floors.
 *
 *  **Making chrome opaque (plan 7 Task 5) is what this measures, and it is here
 *  because nothing else reads the chrome's surface at all.** The fixture mounts
 *  `bg-panel` — an opaque `--panel` — so every ratio in "the control set renders
 *  in the design language" was already read against the surface the chrome has
 *  now converged to, while the chrome itself (the rail, the panes, the
 *  inspector) composited 95% of its panel over the palette's ground and was
 *  measured by no test. A palette could sit below §5's floor on its own chrome
 *  with every gate green, and `light`'s ground is a *gradient*, so the value it
 *  composited against was not one a role comparison could see. Review Focus 2 of
 *  the plan is this reading.
 *
 *  §4's roles are read from `:root` and composited over the chrome's **rendered**
 *  pixel: a chrome that still carries alpha (`light`, `vg-310`) composites
 *  against whatever is behind it, and the rendered pixel is what the eye gets.
 *  The point is found by `elementFromPoint`, so it is a pixel of the chrome's
 *  own surface rather than of a control painted on it — a chrome every pixel of
 *  which is covered reds with its own message instead of measuring a button.
 *
 *  `--shell-edge` is a **divider** under §5's narrow reading (the user's ruling
 *  of 2026-10-11, `vg-200`/`vg-318`): the rail also carries a fill and a label,
 *  so this hairline is one mark among several and `minimumFor` gives it no
 *  floor. It is still measured and printed; reading its 1.2:1 as a defect would
 *  be the same shortfall filed twice.
 *
 *  A `--grep` that matches nothing exits 0 with zero tests, so the run's own
 *  summary is the proof this ran at all.
 */
test("the chrome's own contrast clears §5 under all six palettes", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
  test.setTimeout(120_000);

  await openShell(page);

  /** The role, and the probe name whose floor and pin it is measured against. */
  const ROLES: readonly (readonly [string, string])[] = [
    ["--shell-text", "text"],
    ["--shell-muted", "muted"],
    ["--shell-edge", "divider"],
    ["--shell-accent", "accent"],
  ];

  const ratios: string[] = [];
  const failures: string[] = [];

  for (const palette of PALETTES) {
    await setPalette(page, palette);
    const reading = await page.evaluate(
      (names) => {
        const rail = document.querySelector(".editor-shell-rail");
        if (rail === null) return null;
        const rect = rail.getBoundingClientRect();
        // The first pixel of the rail's own surface: `elementFromPoint` returns
        // the rail only where no child paints over it.
        let point: { x: number; y: number } | null = null;
        for (
          let y = Math.ceil(rect.top) + 2;
          y < rect.bottom - 1 && point === null;
          y += 3
        ) {
          for (let x = Math.ceil(rect.left) + 2; x < rect.right - 1; x += 3) {
            if (document.elementFromPoint(x, y) === rail) {
              point = { x, y };
              break;
            }
          }
        }
        const root = getComputedStyle(document.documentElement);
        const values: Record<string, string> = {};
        for (const name of names) {
          values[name] = root.getPropertyValue(name).trim();
        }
        return { point, values };
      },
      ROLES.map(([name]) => name),
    );

    expect(
      reading,
      `${palette}: the rail is not mounted, so no chrome was measured`,
    ).not.toBeNull();
    if (reading === null) continue;
    expect(
      reading.point,
      `${palette}: every pixel of the rail is covered by a child, so no reading is the chrome's own surface`,
    ).not.toBeNull();
    if (reading.point === null) continue;

    const pixel = (await pixelsAt(page, [reading.point]))[0] ?? [0, 0, 0, 0];
    const on = `rgb(${pixel.slice(0, 3).join(",")})`;
    for (const [name, probe] of ROLES) {
      const declared = reading.values[name] ?? "";
      const ratio = round(ratioAgainstPixel(declared, pixel));
      ratios.push(
        `${palette} chrome ${name} ${ratio}:1 (${declared} on ${on})`,
      );
      const minimum = PINNED_FLOOR[probe]?.[palette] ?? minimumFor(probe);
      // A divider is measured and printed, never asserted — the same skip the
      // control set's whitebox loop makes, for the same reason.
      if (minimum === null) continue;
      if (ratio < minimum) {
        failures.push(
          `${palette}: ${name} on the chrome is ${ratio}:1, below ${minimum}:1 — ${declared} on ${on}`,
        );
      }
    }
  }

  for (const line of ratios) console.log(`chrome-contrast ${line}`);
  testInfo.annotations.push({
    type: "chrome-contrast",
    description: ratios.join(" | "),
  });

  expect(
    failures,
    "a role does not clear its floor against the chrome's own surface",
  ).toEqual([]);
});

/** How many dialogs are **rendered** right now.
 *
 *  Both dialogs render `.editor-shell-dialog` from one rule, and **only one is
 *  ever in the document** — measured 2026-10-10: 0 after the modal is closed, 1
 *  with the sheet open. `Dialog` (`components/ui/dialog.tsx`) passes no
 *  `keepMounted` to `DialogPrimitive.Portal`, whose own default is `false`, so a
 *  closed dialog unmounts rather than hiding. Both dialog rows assert this is 1
 *  before they read, which is what makes that a contract instead of an accident
 *  of the library's default: a `keepMounted` flip, or a second dialog on the
 *  route, reds here with its own message rather than letting a row measure the
 *  other dialog and report its number as its own. */
async function renderedDialogs(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      [...document.querySelectorAll(".editor-shell-dialog")].filter(
        (dialog) => dialog.getClientRects().length > 0,
      ).length,
  );
}

/**
 * A row's value, read through the comparator the row names, as one canonical
 * string — `null` when the value is not one that comparator reads, which the
 * row fails on naming the whole rendered value.
 *
 * **`length` is the default, and the other two are plan 8 Task 1's.** The modal's
 * regions needed a *count* (the palette grid's number of tracks) and a *colour*
 * (the scrim), and neither is a px: `lengthInPx` reads `null` for a track list
 * and for any colour, so a length reading of either fails whatever the product
 * renders — the "passes for the wrong reason" inversion in its second form. Both
 * comparators are pure and are proved in `mockup-values.test.ts`, where
 * `vitest run` holds them; this is only the dispatch.
 */
function comparatorReading(
  comparator: ParityRegion["comparator"],
  value: string,
): string | null {
  if (comparator === "count") {
    const count = trackCount(value);
    return count === null ? null : String(count);
  }
  if (comparator === "colour") return colourValue(value);
  const px = lengthInPx(value);
  return px === null ? null : String(px);
}

/** What a comparator's reading is counted in, for a failure's own words. */
function comparatorUnit(comparator: ParityRegion["comparator"]): string {
  if (comparator === "count") return " tracks";
  if (comparator === "colour") return "";
  return "px";
}

/** What a comparator reads, named for the failure that says a value is not one. */
function comparatorName(comparator: ParityRegion["comparator"]): string {
  if (comparator === "count") return "track count";
  if (comparator === "colour") return "colour";
  return "length";
}

/** Every drawing a `PARITY` row may name, keyed by the path it resolves to, with
 *  the checked-in name a failure has to print: the file a person opens, not the
 *  absolute path the row's `mockupPath` is a `file:` URL of. Read from
 *  `currentDrawings` rather than listed here, so a drawing added to `current/`
 *  names itself (`docs/design/mockups/current/settings.html` and its two sibling
 *  panels, whose rows must not all be reported as the settings file). */
const DRAWING_NAMES = new Map(
  currentDrawings().map((drawing) => [drawing.path, drawing.name] as const),
);

/**
 * The shell's parity with the drawing (spec §13 as amended 2026-10-10, DESIGN.md §3,
 * §7, reference `docs/design/mockups/current/shell.html`; the settings surface is
 * its own file, `current/settings.html`, and is read here too).
 *
 * **What this is.** The drawing is the acceptance instrument: its own inline
 * stylesheet is parsed (`mockup-values.ts`) and each of `PARITY`'s rows asserts
 * the product's computed value equals what the row's comparator declares. A value
 * transcribed out of the drawing into this file — which is what the previous
 * passes did, as prose — is a second owner of it, and a copy is what lets the
 * two drift while every check stays green.
 *
 * **Silence is a reading.** The four body regions are the case: the drawing
 * draws them **flush** and **square**, so it declares no `padding`, no `gap` and
 * no `border-radius` for them, and *that* — not a missing check — is why the
 * rows below require `0` of the product (the 8px inset and the 12px radius they
 * read before Tasks 2 and 3 are gone). Where the drawing declares nothing the row
 * reads `0`, and `mockupDeclaredOrNull` still throws when a row's selector
 * addresses nothing at all, so a stale selector cannot pass as a region the
 * drawing draws flush.
 *
 * **The drawing is not every row's source.** A region the drawing draws as part
 * of a *window* has no counterpart in a product that **is** the window, so the
 * shell's own frame is not in this table at all (the census records it
 * `no-counterpart`). The two dialogs' frames are here but `scaleToken` owns them,
 * not a drawing selector: DESIGN.md §3's radius table is closed and gives 10px to
 * floating clusters over the canvas, which a modal is not. The expected value is
 * read from the product's own `:root` declaration (`--radius-lg`), so this file
 * cannot drift from the token.
 *
 * **A `licensed` row is recorded, not asserted.** `licensed` carries a
 * *predating* rule — a DESIGN.md §N, an ADR, a spec section — that positively
 * requires the product's treatment. Its absence is what makes a difference a
 * defect; two rows carry one today, each the narrow case and never "DESIGN.md
 * does not forbid it": the stage ground (§7.5, which names that property and
 * permits both variants) and the settings modal's frame inset (§3, whose
 * spacing table positively requires `20–24` for "dialog padding" — the value
 * `.editor-shell-dialog` renders where the drawing insets its children).
 *
 * **The header row is the control.** The drawing and the product agree that the
 * header is 42px, so it passed from the start and still does. Its job is to keep
 * a reader that stopped reading visible: a row that measured nothing lands in
 * `unresolved` and fails rather than reporting a shell that came right by
 * reading nothing. It is in the table, rather than left out as redundant, for
 * that reason.
 *
 * **The shell's rows pass; three of the settings modal's six do not, on
 * purpose.** The shell's ten were re-run by plan 7 Task 7 against the shipped
 * build — Task 3 closed the last six the table named (the four region radii,
 * drawn flush and square, and both dialog frames at `--radius-lg`) — and the
 * capture beside the drawing (`docs/design/mockups/current/shell-capture-*.png`)
 * is that task's evidence that the build they pass on is the one that ships.
 * Plan 8 Task 1 then added six rows for the modal's regions, read against
 * `current/settings.html`, **each red on the build it landed on**; Task 2 turned
 * the navigation's axis and the lead's type green (a `150px` vertical column and
 * §2's `--text-lg` title), leaving the scrim (Task 3) and the palette group's
 * count, card radius and swatch height (Task 5) red by design. The census
 * (`.superpowers/sdd/2026-10-11-settings-parity/adjudication.md`) names each
 * row's task. A row loosened or skipped to reach green would be the defect this
 * whole instrument exists to end, so none is.
 *
 * A `--grep` that matches nothing exits 0 with zero tests, so the run's own
 * summary — "1 test", this file — is the proof it ran at all.
 */
test("the shell and the settings modal are what the drawings draw", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await openShell(page);

  // ── The product side of the drawing comparison (`vg-325`) ──────────────────
  //
  // Every row below runs the comparison **one way**: the drawings are parsed and
  // the product is pulled to them. `editor-shell.css` is in no
  // `design-tokens.gated.json` entry, so a value the drawing moves leaves the
  // product behind and no row says so — which is how the four residuals
  // `vg-325` names arrived. This is the **inverse read**: the product's own
  // declarations are parsed the same way a drawing's are, and each of the four
  // is held to the value the drawing that owns it declares. A drawing-side
  // sweep cannot see them, because none is a rendered element of a `PARITY` row
  // (the two asset-button groups are product-only DOM, and the dialog's button
  // and the rail are read here as *declarations*, not as rendered boxes).
  const productPath =
    "src/web/packages/editor/src/editor-shell/editor-shell.css";
  const productCss = readFileSync(
    new URL(
      "../../packages/editor/src/editor-shell/editor-shell.css",
      import.meta.url,
    ),
    "utf8",
  );
  const productDeclarations = mockupDeclarations(
    `<style>${productCss}</style>`,
  );
  const drawingValue = (
    path: string,
    selector: string,
    property: string,
  ): string => mockupDeclared(readMockup(path), selector, property);
  const controlsPath = currentDrawings().find((drawing) =>
    drawing.name.endsWith("/controls.html"),
  )?.path;
  expect(
    controlsPath,
    "the product-side comparison has no controls drawing to read",
  ).toBeDefined();
  const productRows = [
    {
      // `settings.html:96` draws the Close row at `margin-top:16px`.
      selector: ".editor-shell-dialog > button",
      property: "margin-top",
      expected: drawingValue(
        SETTINGS_MOCKUP_PATH,
        '[style*="margin-top:16px;display:flex;justify-content:flex-end"]',
        "margin-top",
      ),
    },
    {
      // `shell.html:40` draws the rail's `gap:4px`.
      selector: ".editor-shell-rail",
      property: "gap",
      expected: drawingValue(MOCKUP_PATH, '[style*="width:46px"]', "gap"),
    },
    ...[
      ".editor-shell-panel [data-vigilia-asset-import]",
      ".editor-shell-inspector [data-vigilia-run-add]",
    ].map((selector) => ({
      selector,
      property: "padding",
      // `controls.html:112` draws the plain-DOM button box both groups render.
      expected: drawingValue(
        controlsPath ?? "",
        '[style*="flex:1;text-align:center;border:1px solid var(--well-edge);border-radius:6px;background:var(--well);padding:4px 8px"]',
        "padding",
      ),
    })),
  ];
  const productFailures: string[] = [];
  for (const row of productRows) {
    const declarations = productDeclarations.filter(
      (declaration) =>
        declaration.owner === row.selector &&
        declaration.property === row.property,
    );
    // The empty-read control: a selector the product no longer declares is a
    // broken row, not a row that agrees.
    expect(
      declarations.length,
      `${productPath}: no \`${row.selector}\` \`${row.property}\` was read, so this row proves nothing`,
    ).toBeGreaterThan(0);
    const declaration = declarations.at(-1);
    if (declaration?.value !== row.expected) {
      productFailures.push(
        `${productPath}:${declaration?.line} \`${row.selector}\` ${row.property}: ${declaration?.value}; the drawing declares ${row.expected} (§3)`,
      );
    }
  }
  expect(
    productFailures,
    "the product's own declarations contradict the drawings that own them",
  ).toEqual([]);

  // ── The surface inventory (`vg-314`) ───────────────────────────────────────
  //
  // A surface the product renders that no drawing draws is one **no row can
  // address**: the parity table holds a *value* of an element both sides carry,
  // so an element the drawing omits has nothing to be read against. The Add
  // pane's asset preview was that surface (`vg-314`): its contract is a **bound**
  // (`max-height:120px` with `object-fit:contain`) rather than a size, and the
  // Add pane is `display:none` while Document is open, so even now that
  // `current/shell.html` draws it, it cannot be a `PARITY` row.
  //
  // **What it reads is a NAME, on three sides, and the row is `open` because of
  // it.** The drawn box in `current/shell.html:134` carries no class and no hook
  // — it is an anonymous inline-styled div — so the drawing side is satisfied by
  // the `<!-- asset preview (.vigilia-asset-preview) … -->` comment at `:133`
  // that documents it, as by any other mention in the file. And the list below is
  // **hand-written and one entry long**, so a *new* product surface reddens
  // nothing until someone adds it here — which is the class of defect the row
  // exists for. Deriving the list from the product was measured and does not
  // construct: the panes render **73** distinct `data-vigilia-*` hooks, **5** of
  // them named anywhere in `editor-shell.css`, and **no checked drawing names any of
  // them** — the drawings are hand-authored HTML that names a product surface by
  // its *class*, in prose beside the box, never by a hook on a drawn element
  // (measured 2026-10-12 by walking `packages/editor/src/panes/**/*.tsx` and
  // testing each hook against the stylesheet and the six checked drawings). So
  // this proves the surface it names is named on all three sides — the component
  // that renders it, the stylesheet that treats it, and the drawing that owns the
  // region it sits in — and cannot prove an unlisted one is anywhere. **What it
  // also does not check** is the drawn treatment's *values* (the drawn box's
  // height against the stylesheet's bound); that is a comparator the drawn bound
  // does not yet have.
  const SURFACES: readonly {
    readonly surface: string;
    readonly component: string;
    readonly componentUrl: URL;
    readonly drawing: string;
    readonly drawingName: string;
  }[] = [
    {
      surface: "vigilia-asset-preview",
      component: "src/web/packages/editor/src/panes/add/file-section.tsx",
      componentUrl: new URL(
        "../../packages/editor/src/panes/add/file-section.tsx",
        import.meta.url,
      ),
      // The Add pane is the shell drawing's, not a settings panel's.
      drawing: MOCKUP_PATH,
      drawingName: DRAWING_NAMES.get(MOCKUP_PATH) ?? MOCKUP_PATH,
    },
  ];
  expect(
    SURFACES.length,
    "the surface inventory is empty, so it can prove nothing",
  ).toBeGreaterThan(0);
  const inventoryFailures: string[] = [];
  for (const entry of SURFACES) {
    const sides = [
      { name: entry.component, text: readFileSync(entry.componentUrl, "utf8") },
      { name: productPath, text: productCss },
      { name: entry.drawingName, text: readMockup(entry.drawing) },
    ];
    for (const side of sides) {
      // The empty-read control, per side: a file the reader opened but read
      // nothing out of is not a side that agrees.
      expect(
        side.text.length,
        `${side.name} was read as empty, so this inventory proves nothing about it`,
      ).toBeGreaterThan(0);
      if (!side.text.includes(entry.surface)) {
        inventoryFailures.push(
          `\`${entry.surface}\` is not named by ${side.name}, so the surface it stands for is one a row cannot address`,
        );
      }
    }
  }
  expect(
    inventoryFailures,
    "a surface the product renders is missing from its drawing, the stylesheet or its component",
  ).toEqual([]);

  // The comparators the rows below run every rendered value through are pure
  // decisions and are proved in `mockup-values.test.ts`, where `vitest run` holds
  // them. `lengthInPx` was asserted here first, and this test is skipped off a
  // desktop surface, so a revert to reading the first token of a shorthand left
  // the fast suite green; the count and colour comparators plan 8 Task 1 added
  // are held there from the start, for the same reason.
  expect(
    PARITY.length,
    "the parity table is empty, so this test can prove nothing",
  ).toBeGreaterThan(0);
  /** Rows are read with the surface they belong to open, because both dialogs
   *  render the one `.editor-shell-dialog` rule and only the route tells them
   *  apart — a value read with the wrong one open is a reading of the wrong
   *  element. Two rows also share a selector without sharing a surface, so the
   *  key carries both. */
  const key = (row: ParityRegion): string =>
    `${row.surface ?? "shell"}|${row.productSelector}|${row.mockupProperty}`;

  const readRows = async (rows: readonly ParityRegion[]) =>
    page.evaluate(
      (wanted) => {
        const out: Record<string, string | null> = {};
        for (const row of wanted) {
          // The **rendered** match, not the first in document order: one dialog
          // is in the DOM at a time today, so this picks the only one — and if
          // a second ever appears (a `keepMounted` flip leaves the closed modal
          // mounted), it reads the open dialog rather than whichever the
          // document happens to list first.
          const element =
            [...document.querySelectorAll(row.productSelector)].find(
              (candidate) => candidate.getClientRects().length > 0,
            ) ?? null;
          out[row.key] =
            element === null
              ? null
              : getComputedStyle(element).getPropertyValue(row.mockupProperty);
        }
        return out;
      },
      rows.map((row) => ({
        key: key(row),
        productSelector: row.productSelector,
        mockupProperty: row.mockupProperty,
      })),
    );

  const product: Record<string, string | null> = await readRows(
    PARITY.filter((row) => row.surface === undefined),
  );

  await page.locator(SETTINGS_GEAR).click();
  await expect(page.getByRole("dialog", SETTINGS_DIALOG)).toBeVisible();
  await expect(
    await renderedDialogs(page),
    "the settings modal is not the only dialog rendered, so its row cannot say which dialog it measured",
  ).toBe(1);
  Object.assign(
    product,
    await readRows(PARITY.filter((row) => row.surface === "settings")),
  );
  /** The modal's other two panels, each read with its own tab showing. Base UI
   *  keeps an inactive panel out of the DOM — `shell-palette.ts`'s
   *  `openAppearance` says the same — so a Keyboard row read on the Appearance
   *  tab would measure no element and report a region that is drawn and rendered
   *  as one that measured nothing, which is not what happened. */
  const modal = page.getByRole("dialog", SETTINGS_DIALOG);
  for (const [surface, tab] of [
    ["settings-keyboard", "Keyboard"],
    ["settings-about", "About"],
  ] as const) {
    await modal.getByRole("tab", { name: tab }).click();
    Object.assign(
      product,
      await readRows(PARITY.filter((row) => row.surface === surface)),
    );
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", SETTINGS_DIALOG)).toBeHidden();

  // `?` is the session's own dispatcher, so this is the gesture an author makes
  // rather than a click on a control the sheet does not have.
  await page.keyboard.press("?");
  const sheet = page.locator(".editor-shell-dialog");
  await expect(sheet).toBeVisible();
  await expect(
    await renderedDialogs(page),
    "the `?` sheet is not the only dialog rendered, so its row cannot say which dialog it measured",
  ).toBe(1);
  Object.assign(
    product,
    await readRows(PARITY.filter((row) => row.surface === "sheet")),
  );

  /** The closed scale the product declares for itself, read from `:root` so a
   *  row expecting `--radius-lg` cannot drift from the token it names. */
  const tokens = [
    ...new Set(
      PARITY.map((row) => row.scaleToken).filter(
        (token): token is string => token !== undefined,
      ),
    ),
  ];
  const scale: Record<string, string> = await page.evaluate((names) => {
    const root = getComputedStyle(document.documentElement);
    return Object.fromEntries(
      names.map((name) => [name, root.getPropertyValue(name).trim()]),
    );
  }, tokens);

  // The settings drawing is read, not merely shipped. The modal's own rows name
  // its selectors now (plan 8 Task 1), and this assertion is kept as the row that
  // says the file is reached at all: a drawing that nothing reads is a drawing
  // that rots, and a selector that stopped resolving has to red here rather than
  // go unnoticed.
  expect(
    mockupDeclared(
      readMockup(SETTINGS_MOCKUP_PATH),
      '[style*="width:560px"]',
      "border-radius",
    ),
    "the settings drawing's dialog frame is not drawn at the closed scale's panel radius",
  ).toBe(scale["--radius-lg"]);

  // Rows on another surface are that surface's test to read: this one opens the
  // shell, and a `[data-fixture="…"]` selector matches nothing here. Leaving
  // them in would report "no element matches" for a row that is read — just not
  // by this test. Only the fixture is foreign today, and saying so keeps a row
  // whose surface is a typo from being skipped by both tests and read by
  // neither.
  const mismatchedSurfaces = PARITY.filter(
    (row) =>
      row.surface !== undefined &&
      row.surface !== "settings" &&
      row.surface !== "settings-keyboard" &&
      row.surface !== "settings-about" &&
      row.surface !== "sheet" &&
      row.surface !== "fixture",
  );
  expect(
    mismatchedSurfaces.map((row) => `${row.region} on ${row.surface}`),
    "a parity row names a surface neither this test nor the fixture test reads",
  ).toEqual([]);

  const unresolved: string[] = [];
  const failures: string[] = [];
  const table: string[] = [];
  /** A row's own drawing, read once per path, and **a path the reader was not
   *  given throws** (`rowDrawing`): the shell's unless the row names another file,
   *  so a surface drawn on its own (`current/settings.html`) is compared against
   *  the file it was drawn in rather than against whichever one this test opened
   *  first — which is how plan 8 Task 1's settings rows read a drawing the shell
   *  test had never opened. */
  const drawings = drawingTexts();
  const sourceOf = (row: ParityRegion): string =>
    rowDrawing(row.mockupPath, drawings);
  /** What a failure calls the row's drawing: a person has to be able to open it.
   *  Read from the enumeration rather than named here, because the settings
   *  modal is three drawings now (plan 8 Task 4) and a failure that named
   *  `settings.html` for a Keyboard row would send that person to the wrong
   *  file. */
  const nameOf = (row: ParityRegion): string =>
    row.mockupPath === undefined || row.mockupPath === MOCKUP_PATH
      ? "the drawing's"
      : `\`${DRAWING_NAMES.get(row.mockupPath) ?? row.mockupPath}\`'s`;
  for (const row of PARITY) {
    if (row.surface === "fixture") continue;
    const rendered = product[key(row)];
    // `undefined` is its own reading under `noUncheckedIndexedAccess`: the key
    // was never filled because the row was in no `readRows` call, which is the
    // same verdict as "nothing matched" — the row measured nothing — and must
    // not reach `lengthInPx` and throw there instead.
    if (rendered === undefined || rendered === null) {
      unresolved.push(
        `${row.region}: no element matches \`${row.productSelector}\`, so the row measured nothing`,
      );
      continue;
    }
    if (row.licensed !== undefined) {
      table.push(`${row.region}: recorded, licensed — ${row.licensed}`);
      continue;
    }
    /** The comparator, the product's value, and the words a failure uses. */
    const comparator = row.comparator;
    const unit = comparatorUnit(comparator);
    const kind = comparatorName(comparator);
    let expected: string | null;
    let actual: string | null;
    let from: string;
    if (row.scaleToken !== undefined) {
      // The scale owns this row, not the drawing: see the row's own comment.
      const declared = scale[row.scaleToken];
      // `""` is what a custom property resolves to when nothing declares it, and
      // `--elev-scrim` is a token Task 3 has not declared yet. Reported as the
      // region's own failure rather than as `unresolved`, which means "measured no
      // element" and is not what happened here: the overlay was measured, and the
      // comparator it names is absent.
      if (declared === undefined || declared === "") {
        failures.push(
          `${row.region}: the product declares no \`${row.scaleToken}\`, so the row has no comparator`,
        );
        continue;
      }
      expected = comparatorReading(comparator, declared);
      actual = comparatorReading(comparator, rendered);
      from = `\`${row.scaleToken}\` (${declared})`;
    } else {
      // Throws when the selector addresses nothing in the drawing: a row whose
      // selector went stale must fail here rather than read as a flush region.
      const declared = mockupDeclaredOrNull(
        sourceOf(row),
        row.mockupSelector ?? "",
        row.mockupProperty,
      );
      // **Silence is a zero only for a length.** A drawing that draws a region
      // flush declares no inset, and `0` is that reading; a drawing that draws no
      // grid declares no track count, so a count row has no answer here rather
      // than zero tracks. Coercing either non-px comparator to `0` is exactly the
      // inversion plan 7 caught, one comparator over.
      const silent = comparator === undefined || comparator === "length";
      expected =
        declared === null
          ? silent
            ? comparatorReading(comparator, "0")
            : null
          : comparatorReading(comparator, declared);
      actual = comparatorReading(comparator, rendered);
      from = `${nameOf(row)} \`${row.mockupSelector}\` (${
        declared ??
        (silent ? "nothing — drawn flush, so 0px" : "nothing declared")
      })`;
    }
    table.push(
      `${row.region}: ${from} → ${expected}, product \`${row.productSelector}\` = ${rendered} → ${actual}`,
    );
    if (expected === null) {
      failures.push(
        `${row.region}: ${from} is not a ${kind} this table can compare`,
      );
      continue;
    }
    if (actual !== expected) {
      failures.push(
        `${row.region}: ${from} requires ${expected}${unit}; the product renders "${rendered}" on \`${row.productSelector}\`.`,
      );
    }
  }

  for (const line of table) console.log(`parity ${line}`);
  testInfo.annotations.push({ type: "parity", description: table.join(" | ") });

  // ── Task 3 Step 4: the two dialogs against each other, not only the scale ──
  //
  // Both dialogs render the one `.editor-shell-dialog` rule, and each row above
  // compares its computed frame against `--radius-lg` on its own. That pair
  // cannot see *relative* equality: a change scoped to one dialog (a rule the
  // settings surface alone matched, say) would pass both rows only if its value
  // also happened to equal `--radius-lg`. Reading the two frames side by side is
  // what makes a change made for the settings modal and missed on the `?` sheet
  // fail a row rather than pass quietly.
  const dialogFrame = (surface: "settings" | "sheet"): string | null =>
    product[`${surface}|.editor-shell-dialog|border-radius`] ?? null;
  expect(
    dialogFrame("settings"),
    "the settings modal's frame was not read, so the two dialogs cannot be compared",
  ).not.toBeNull();
  expect(
    dialogFrame("sheet"),
    "the `?` sheet's frame was not read, so the two dialogs cannot be compared",
  ).not.toBeNull();
  expect(
    dialogFrame("sheet"),
    `the two dialogs' frames differ — settings ${dialogFrame("settings")}, \`?\` sheet ${dialogFrame("sheet")}`,
  ).toBe(dialogFrame("settings"));

  expect(
    unresolved,
    "a parity row measured no element, so its reading is not a reading",
  ).toEqual([]);
  expect(
    failures,
    "a region is not what its comparator requires of it",
  ).toEqual([]);
});

/** The shell drawing's path as its own rows name it — the checked-in file, not
 *  the absolute path `MOCKUP_PATH` resolves to, because a failure has to name
 *  the line in the file a person opens. The radii gate below names each drawing
 *  from `currentDrawings` instead, so a widened set carries its own names. */
const SHELL_DRAWING = "docs/design/mockups/current/shell.html";

/**
 * Every literal **every drawing in `docs/design/mockups/current/`** declares, in
 * the three classes §3 and §2 own, held to the scale that owns each: a
 * `border-radius` to §3's closed radius table (`vg-296`), a spacing property to
 * §3's closed step list, and a type size to §2's six-role size scale.
 *
 * **Why this is a gate and not a sweep.** Task 3 (`be54cfc5`) corrected
 * twenty-one off-scale `border-radius` literals in `shell.html` — seventeen dock
 * buttons, three view-cluster buttons and the follow-the-system track — and
 * nothing read them afterwards: putting one `7px` back left this whole suite
 * green (`vg-296`, measured). A file **measured once** is a measurement; a gate
 * is a test that reddens when the property moves, and this one reads the
 * drawings' own declarations every run, so a value that leaves its scale fails
 * here naming its file and line.
 *
 * **Radius was the only arm until plan 8 Task 8, and the narrowness was the
 * class.** Task 7 closed with this row green and **268 off-scale literals in the
 * same six files**: 103 `11.5px` sizes (`font-size` declarations and `font`
 * shorthands between them), 75 `5px` spacing tokens, 21 `2px`, 19 `7px`, 15
 * `9px`, 11 `3px`, 9 `11px`, 4 `13px`, 3 `13.5px`, 3 `18px`, 2 `26px` and one
 * each of `15px`, `72px` and `10.5px`. §2's scale and §3's step list were both
 * closed and neither was read. The same `padding:5px 8px` sat in all six files,
 * green, because a gate holds the property it names and nothing else.
 *
 * **Every drawing, not `MOCKUP_PATH` alone.** The first gate read the shell
 * drawing only, and the class hid in the three it did not read: `settings.html`
 * declared the `3px` swatch and the `7px` toggle track, and both control
 * drawings the identical `7px` track — the same off-scale class corrected in
 * `shell.html`, in files the row never opened. The set is a directory read
 * (`currentDrawings`), so a fifth drawing is read the moment it lands, and each
 * failure names the file it is in.
 *
 * **§3's radius table is closed**:
 * `--radius-sm` 4 / `--radius-md` 6 / `--radius-lg` 8 / `--radius-xl` 10 /
 * full 999. Three values are exempt, each named with why it is not a scale
 * entry — an unnamed exemption set is the list-shaped escape this plan exists
 * to close, so a fourth value entering a file fails this row rather than
 * joining the set silently:
 *
 * - `1px` and `2px` are **marks whose value is their thickness**, not rounded
 *   surfaces: §7.2's 2px accent bar on the rail's inner edge,
 *   the slider track's ends, the layer dropline.
 *   §3's scale answers a question only a surface that is *rounded* asks.
 * - `50%` is **a circle — `full` reached the other way**: the identity dot, the
 *   slider's thumb and the toggle's knob. It is not a second way to spell a
 *   rounded rectangle, so it does not open the scale.
 *
 * **The spacing arm reads the properties whose px *is* a spacing decision** —
 * `scripts/design-tokens.mjs`'s `SPACING_PROPERTY`, transcribed here for the
 * same reason `SPACING_STEPS` above is (a `tests/e2e/` import of a script would
 * arrive untyped and buy coupling rather than safety). `26px` is deliberately
 * off this scale, as that file's own comment says: §3's row rhythm is a density,
 * not a gutter. Four values are exempt, each named with its reason and each
 * exercised by a drawing:
 *
 * - `0` is **no space** — the degenerate *absence* of a gutter, the square
 *   corner's twin. `padding:5px 0` is an ordinary value, not an off-scale one,
 *   and a row that rejected the `0` in it would cry wolf, which is how a gate
 *   gets turned off.
 * - `1px` is **a hairline**, whose value is its thickness: §7.2's rail inset in
 *   the drawing itself (`shell.html:40` `padding:8px 0 8px 1px`, and the
 *   product's `.editor-shell-rail` declares the identical value).
 *   `design-tokens.mjs`'s `ALWAYS_PX` names 1 for the same reason.
 * - a value that is **negative** or **fractional** is **a mark's anchor**, not a
 *   gutter: the rail's accent bar hangs at `right:-6px` across the 6px gutter it
 *   sits in, and the slider's thumb at `top:-3.5px` centres a 10px circle on a
 *   3px track. §3's step table is a table of gutters and insets and has no row
 *   for either, and correcting one would un-centre the mark rather than align
 *   it. `editor-shell.css:898-914` says the same of the product's own bar.
 * - `auto` and `%` are **not lengths on the base at all** — the slack a flex
 *   line has left (`margin-left:auto`) and a share of the parent's own size
 *   (`left:50%`, which centres the dock alongside its `translateX(-50%)`).
 *
 * **The type arm reads `font-size` and the `font` shorthand.** §2's scale is six
 * roles, and a shorthand writes its size before its
 * line-height (`600 13.5px/1.2 system-ui`), which is the token read here. A
 * shorthand carrying no px length sets no size this row can read, so it is
 * returned whole and fails naming itself rather than passing as the drawing's
 * silence.
 *
 * **Two arms read what no arm read before (`vg-296`'s two remaining clauses).**
 * The **elevation arm** holds every `box-shadow` a drawing declares to §3's
 * elevation table — level 1 `0 8px 20px #00000059`, level 2 `0 18px 44px
 * #00000099`, level 3 `0 24px 60px #000000b3`, or no shadow at all (level 0,
 * spelled by omitting the property or by writing `none`) — and exempts only the
 * two *marks* §5 rule 4 keeps: the spread-only accent-at-18% halo and an `inset`
 * shadow. It reads a shadow **list** part by part, so a halo layered over an
 * off-table shadow is refused rather than admitted by its first part. Without it
 * a cluster shadow off the table is inherited by the product, which is what the
 * three `#0007` shadows in the superseded drawing did. Both arms are **not**
 * per-drawing: a control
 * drawing legitimately draws no shadow (level 0), so the per-arm control below
 * is what refuses an empty read. The **boundary arm** holds every `border` and
 * `border-*` to §5's hairline (`1px`) vocabulary. It is deliberately the width
 * and not the colour: §5 rule 2 admits "a switch row whose label fills the row
 * inside a panel box", and the drawing materialises a derived colour where the
 * product writes `color-mix(…)`, so a colour allow-list would fail a drawing
 * technique §5 has no entry against. **What the boundary arm therefore cannot
 * catch is a bordered *container*** — a declaration cannot tell a container
 * from a control — and that clause of `vg-296` is **dispositioned, not open**:
 * §5 rule 2 admits "a row a surface's own drawing shapes differently — a switch
 * row whose label fills the row inside a panel box … is not a field row and
 * keeps the shape it is drawn with", and a licensing rule that predates the row
 * is a disposition rather than a gate this arm owes. The arm's limit and the
 * row's disposition are the same fact, so neither waits on the other.
 *
 * **What this row cannot read, and does not claim.** `line-height`,
 * `font-weight` and `letter-spacing`: §2 states a line-height and a weight per
 * role, but a drawing's `/1` on a one-line label is a box rather than a reading
 * step, and a size is what a role is chosen by. The drawings' **page furniture**
 * — each drawing's `<style>` block (`body { margin: 0; … font: 12px/1.45 … }`)
 * and the token table the outermost element carries — is read like everything
 * else, because `mockupDeclarations` gives no structural split between the page
 * and the drawn surface inside it. That is the reading's own limit, and it is
 * not "nothing furniture-shaped is in a scale property": `margin: 0`, `font:
 * 12px` and the wrapper's `padding:24px` all are. It passes today because every
 * one of those happens to be on the scale already (0 is the collapse reset, 12
 * is `--text-sm`), so a future furniture value off the scale would redden this
 * row and have to be named rather than exempted.
 *
 * The whole-file reading comes from `mockupDeclarations`, not from a selector:
 * the property is bound wherever it is written, and `[style*="…"]` could only
 * ever address the elements a row already knew about.
 *
 * A `--grep` that matches nothing exits 0 with zero tests, so the run's own
 * summary is the proof this ran at all.
 */
test("every literal the checked drawings declare is on §3's scale or §2's", () => {
  const drawings = currentDrawings();
  // The positive control: a reader that found no drawing at all would pass the
  // assertion below, and `vg-296` is exactly a file nothing read.
  expect(
    drawings.length,
    "docs/design/mockups/current/ holds no drawing, so this row read nothing",
  ).toBeGreaterThan(0);

  /** §3's closed radius scale, transcribed from the table the comment cites. */
  const RADIUS = new Set(["4px", "6px", "8px", "10px", "999px"]);
  /** The named degenerate radius marks, each with the reason it is exempt. */
  const RADIUS_DEGENERATE = new Map([
    ["1px", "a hairline mark, whose value is its thickness"],
    ["2px", "a thickness mark (§7.2's rail accent bar, the slider track ends)"],
    [
      "50%",
      "a circle — `full` reached the other way (the thumb, the knob, the dot)",
    ],
  ]);
  /** A corner is square when it is **zero**, in either spelling CSS allows for
   *  a radius (`0` and `0px`; `0%` is the same zero). Square is the degenerate
   *  *absence* of rounding, and it arrives in a shorthand — `8px 8px 0 0` is an
   *  ordinary value, not an off-scale one. Without this the row would reject a
   *  legitimate square corner and cry wolf, which is how a gate gets turned
   *  off. A **non-zero** corner is still held to the scale: the regex admits
   *  only a number and an optional `px`/`%`, so `0.0` and `-0px` are zero and
   *  `7px` is not. */
  const isSquare = (corner: string): boolean => {
    const parsed = /^(-?[\d.]+)(?:px|%)?$/.exec(corner);
    return parsed !== null && Number.parseFloat(parsed[1] ?? "NaN") === 0;
  };
  const radiusAllowed = (corner: string): boolean =>
    RADIUS.has(corner) || RADIUS_DEGENERATE.has(corner) || isSquare(corner);

  /** §3's closed step list — the same transcription the fixture rows above
   *  read, so a §3 change moves one list rather than two. */
  const SPACING = new Set(SPACING_STEPS);
  /** The properties whose px **is** a spacing decision, transcribed from
   *  `scripts/design-tokens.mjs`'s `SPACING_PROPERTY`. A px in one of these is
   *  a gutter; a px anywhere else is a size this row does not hold. */
  const SPACING_PROPERTY =
    /^(?:padding|margin|inset|translate)(?:-|$)|^(?:gap|row-gap|column-gap|top|right|bottom|left)$/;
  /** The named degenerate spacing values, each with the reason it is exempt.
   *  `0px` is deliberately absent: `0` is the same value, no drawing writes the
   *  unit form, and a second spelling of one exemption is how a list of escapes
   *  starts. */
  const SPACING_DEGENERATE = new Map([
    ["0", "no space — the degenerate absence of a gutter"],
    [
      "1px",
      "a hairline, whose value is its thickness (§7.2's rail inset; `design-tokens.mjs`'s `ALWAYS_PX` names 1 for the same reason). This one cannot be keyed on the property: the drawing spells its hairlines as `padding`, and a 1px padding that *is* a gutter is indistinguishable from a 1px padding that is a rule, so a 1px gutter would pass here. Named rather than hidden.",
    ],
    [
      "auto",
      "the slack a flex line has left — not a length on the base at all",
    ],
  ]);
  /** The properties whose px is a **mark's anchor** rather than a gutter: a side
   *  offset, where a negative pulls a mark across a gutter it does not own and a
   *  fractional one centres a glyph in a box smaller than itself. §3's step
   *  table is a table of gutters and insets; none of these is one.
   *
   *  Keyed on the **property**, not the value alone — the value cannot tell them
   *  apart: `top:-3.5px` is a slider's thumb on a 3px track, and `padding:-3.5px`
   *  would be a mistake the same test would wave through.
   *
   *  `translate` is listed because `SPACING_PROPERTY` reads it, so leaving it out
   *  would refuse a translated mark's own anchor as off-scale. No drawing uses it
   *  today; the two lists move together so the arms cannot disagree about which
   *  px is a gutter. */
  const ANCHOR_PROPERTY = /^(?:inset|translate|top|right|bottom|left)(?:-|$)/;
  const isAnchor = (value: string, property: string): boolean =>
    ANCHOR_PROPERTY.test(property) &&
    (value.endsWith("%") ||
      (/^-?[\d.]+px$/.test(value) &&
        (value.startsWith("-") || value.includes("."))));
  const spacingAllowed = (value: string, property: string): boolean => {
    if (SPACING_DEGENERATE.has(value) || isAnchor(value, property)) return true;
    const parsed = /^(\d+(?:\.\d+)?)px$/.exec(value);
    return (
      parsed !== null && SPACING.has(Number.parseFloat(parsed[1] ?? "NaN"))
    );
  };

  /** §2's six sizes. */
  const TYPE = new Set([10, 11, 12, 13, 15, 19]);
  /** The size a type declaration sets, or `null` where it sets none this row
   *  reads: `font-size`'s whole value, or the first px length a `font`
   *  shorthand carries. A shorthand with no px length has no size token, so the
   *  whole value is returned and fails naming itself rather than passing as the
   *  drawing's silence. */
  const typeSize = (declaration: MockupDeclaration): string | null => {
    if (declaration.property === "font-size") return declaration.value;
    if (declaration.property !== "font") return null;
    return (
      /(\d+(?:\.\d+)?px)/.exec(declaration.value)?.[1] ?? declaration.value
    );
  };
  const typeAllowed = (value: string): boolean => {
    const parsed = /^(\d+(?:\.\d+)?)px$/.exec(value);
    return parsed !== null && TYPE.has(Number.parseFloat(parsed[1] ?? "NaN"));
  };

  /** One declaration is several values — `8px 8px 0 0` is four radii and
   *  `padding:4px 6px` two insets — so each token is held on its own: an
   *  off-scale value cannot hide behind a legal neighbour. */
  const tokens = (value: string): readonly string[] =>
    value.split(/[\s/]+/).filter((part) => part !== "");

  /** One named exemption, printed with its reason on a failure so the reader of
   *  a red row sees what the row *does* let through, not only what it refused. */
  const named = (value: string, reason: string): string =>
    `${value} — ${reason}`;
  const SQUARE = "0 / 0px / 0% — a square corner, the absence of rounding";

  /** §3's elevation table, transcribed: level 0 is *no shadow at all*, and the
   *  three shadowed levels have exactly one treatment each (level 3's scrim is
   *  a second declaration, not a shadow).
   *
   *  **The gap this closes (`vg-296`).** The drawings gate held radii, spacing
   *  and type to a scale and read no shadow at all, so a drawing could carry a
   *  cluster shadow off the table and nothing said so — which is how the three
   *  `#0007` cluster shadows reached the current set unnoticed until a task
   *  corrected them by hand. The table is the bible's, so a drawing that
   *  disagrees with it is the stale side (spec §13, `docs/design/mockups/README.md`). */
  const ELEVATION = new Map([
    ["0 8px 20px #00000059", "level 1 — floating clusters over the canvas"],
    ["0 18px 44px #00000099", "level 2 — menus, popovers, tooltips"],
    ["0 24px 60px #000000b3", "level 3 — dialogs"],
  ]);
  /** The two shadow *marks* §5 rule 4 keeps beside §3's elevation: the
   *  3px accent halo is decoration ("Keep the 3px accent-at-18% halo as
   *  decoration") and an `inset` shadow is a mark **on** the element — a focus
   *  boundary or a selected row's accent bar — where §3's table is depth
   *  *under* a surface. Both are read by shape so the arm cannot be widened by
   *  adding a colour to an allow-list: a shadow that is neither a mark nor one
   *  of the table's three treatments fails. */
  const ELEVATION_MARK = /^(?:inset\b|0 0 0 \d+(?:\.\d+)?px\b)/;
  /** §3's level 0 is *no shadow*, and a drawing may spell that `none` as readily
   *  as it may omit the property — the scale clause above admits both, so the
   *  arm has to accept the spelling or it is a false red waiting for a drawing
   *  that says it the long way. */
  const NO_SHADOW = new Set(["none"]);
  /** A `box-shadow` is a **list**, and it is read part by part. A drawing that
   *  layers a mark under a surface (`0 0 0 3px …, 0 10px 26px …`) is drawing a
   *  halo *and* a shadow, so reading only the first part would let any off-table
   *  shadow through behind a ring. A comma inside parentheses belongs to a
   *  colour function (`color-mix(in srgb, …)`), not to the list, so the split
   *  tracks depth. */
  const shadowParts = (value: string): string[] => {
    const parts: string[] = [];
    let depth = 0;
    let start = 0;
    for (let at = 0; at < value.length; at += 1) {
      const char = value[at];
      if (char === "(") depth += 1;
      else if (char === ")") depth = Math.max(0, depth - 1);
      else if (char === "," && depth === 0) {
        parts.push(value.slice(start, at));
        start = at + 1;
      }
    }
    parts.push(value.slice(start));
    return parts.map((part) => part.trim()).filter((part) => part !== "");
  };
  const elevationAllowed = (value: string): boolean => {
    const parts = shadowParts(value);
    return (
      parts.length > 0 &&
      parts.every(
        (part) =>
          NO_SHADOW.has(part) ||
          ELEVATION.has(part) ||
          ELEVATION_MARK.test(part),
      )
    );
  };

  /** §5's boundary vocabulary: every treatment the table admits draws its edge
   *  as a **1px hairline** — the Well is "1px `--edge`", and §3's level 0 is
   *  "1px `--edge` border"; no §5 entry and no §3 level names any other width.
   *  The arm is deliberately the *width* and not the colour: §5 rule 2 admits
   *  "a switch row whose label fills the row inside a panel box", and the
   *  drawing materialises a derived colour where the product writes
   *  `color-mix(...)` (`.editor-shell-primary-key`), so a colour allow-list
   *  would fail a drawing technique §5 has no entry against. **What this arm
   *  therefore does not catch** is the bordered container the row's third
   *  clause names: a declaration cannot tell a container from a control, and
   *  §5 rule 2 licenses that box by name — see the row's line. */
  const boundaryAllowed = (value: string): boolean => {
    const text = value.trim();
    return /^(?:0|1px)\b/.test(text) || text === "none";
  };

  /** Every class, each with what it reads, the values one declaration
   *  spells, the scale those values are held to, and the exemptions a failure
   *  should name. */
  const ARMS: readonly {
    readonly property: string;
    readonly scale: string;
    readonly values: (
      declaration: MockupDeclaration,
    ) => readonly string[] | null;
    readonly allowed: (value: string, property: string) => boolean;
    readonly exempt: readonly string[];
    /** Whether **every** drawing must declare the class. The three scale arms
     *  are per-drawing — a drawing that declares no spacing is the silent read
     *  they exist to catch. The elevation and boundary arms are not: a control
     *  drawing legitimately draws no shadow at all (level 0) and no boundary
     *  that is not 1px, so the per-arm control below is what keeps an empty
     *  read from passing. */
    readonly readPerDrawing?: boolean;
  }[] = [
    {
      property: "border-radius",
      scale: "§3's radius scale (4/6/8/10/999)",
      values: (declaration) =>
        declaration.property === "border-radius"
          ? tokens(declaration.value)
          : null,
      allowed: (value) => radiusAllowed(value),
      exempt: [
        SQUARE,
        ...[...RADIUS_DEGENERATE].map(([value, reason]) =>
          named(value, reason),
        ),
      ],
    },
    {
      property: "spacing",
      scale: "§3's step list (4/6/8/10/12/14/16/20/24/32)",
      values: (declaration) =>
        SPACING_PROPERTY.test(declaration.property)
          ? tokens(declaration.value)
          : null,
      allowed: spacingAllowed,
      exempt: [
        ...[...SPACING_DEGENERATE].map(([value, reason]) =>
          named(value, reason),
        ),
        "a mark's anchor — a negative or fractional px, or a `%`, in `top`/`right`/`bottom`/`left`/`inset`",
      ],
    },
    {
      property: "type",
      scale: "§2's size scale (10/11/12/13/15/19)",
      values: (declaration) => {
        const size = typeSize(declaration);
        return size === null ? null : [size];
      },
      allowed: (value) => typeAllowed(value),
      exempt: ["none — §2's six sizes are the whole scale"],
    },
    {
      property: "box-shadow",
      scale:
        "§3's elevation table (1 `0 8px 20px #00000059`, 2 `0 18px 44px #00000099`, 3 `0 24px 60px #000000b3`, or no shadow at all — `none` or the property omitted)",
      values: (declaration) =>
        declaration.property === "box-shadow" ? [declaration.value] : null,
      allowed: (value) => elevationAllowed(value),
      exempt: [
        "no `box-shadow` at all, or `none` — §3's level 0, which is also every surface in a drawing that floats nothing",
        "`0 0 0 <n>px …` — §5 rule 4's 3px accent-at-18% focus halo, decoration and not a surface",
        "`inset …` — a mark **on** the element (§5 rule 4's focus boundary, §7.2's rail accent bar), where §3's table is depth *under* a surface",
        "each part of a comma list is read on its own, so a halo layered over an off-table shadow is refused rather than admitted by its first part",
      ],
      readPerDrawing: false,
    },
    {
      property: "border",
      scale:
        "§5's boundary vocabulary — a 1px hairline (`1px --edge` in §3's level 0 and in §5's Well), or no boundary",
      values: (declaration) =>
        /^border(?:-(?:top|right|bottom|left))?$/.test(declaration.property)
          ? [declaration.value]
          : null,
      allowed: (value) => boundaryAllowed(value),
      exempt: [
        "`none` / `0` — no boundary at all, which is every region §3 does not draw an edge on",
      ],
      readPerDrawing: false,
    },
  ];

  // An `allowed` nothing exercises is a fix nobody can trust: the two square
  // spellings are unexercised by the drawings today — none writes a radius
  // shorthand — so they are read here, and every named degenerate is read so a
  // gate that names a value it still refuses fails at the naming rather than at
  // the drawing. Each arm's **refusal** is read for the same reason from the
  // other side: an `allowed` that returned true for everything would pass all
  // six drawings below.
  expect(
    ["0", "0px"].filter((corner) => !radiusAllowed(corner)),
    "a square corner is not accepted, so an ordinary radius shorthand would false-positive",
  ).toEqual([]);
  expect(
    [...SPACING_DEGENERATE.keys()].filter(
      (value) => !spacingAllowed(value, ""),
    ),
    "a named degenerate spacing value is not accepted, so this row would fail the drawing it names",
  ).toEqual([]);
  // The anchors are read **on the properties that carry them**, and refused on
  // the properties that do not: an exemption keyed on the value alone would let
  // `padding:-3.5px` through, which is the hole this control closes.
  expect(
    [
      ["left", "1.5px"],
      ["top", "-3.5px"],
      ["right", "-6px"],
      ["left", "50%"],
    ].filter(
      ([property, value]) => !spacingAllowed(value ?? "", property ?? ""),
    ),
    "a mark's anchor is not accepted on the property that draws it, so this row would fail the drawing it names",
  ).toEqual([]);
  expect(
    [
      ["padding", "-3.5px"],
      ["margin", "-20px"],
      ["gap", "150%"],
    ].filter(([property, value]) =>
      spacingAllowed(value ?? "", property ?? ""),
    ),
    "the anchor exemption is keyed on the value alone, so an off-scale gutter would pass as a mark",
  ).toEqual([]);
  expect(
    (
      [
        ["radius", () => radiusAllowed("7px")],
        ["spacing", () => spacingAllowed("5px", "gap")],
        ["type", () => typeAllowed("11.5px")],
        ["elevation", () => elevationAllowed("0 18px 50px #0009")],
        [
          "elevation-list",
          () => elevationAllowed("0 0 0 3px #72e0c02e, 0 10px 26px #0007"),
        ],
        ["boundary", () => boundaryAllowed("2px solid var(--edge)")],
      ] as const
    )
      .filter(([, allowed]) => allowed())
      .map(([name]) => name),
    "an arm accepts an off-scale value, so this row no longer holds that class to a scale",
  ).toEqual([]);
  // The two families the new arms name as exempt are read the same way: a mark
  // the arm still refused would fail the drawing at the naming, and an
  // exemption that swallowed a real treatment would take the arm's teeth out.
  // §3's level 0 is read in **both** of its spellings — the property omitted is
  // read by every drawing that declares no shadow, and `none` is the one the arm
  // used to refuse — and a layered list is read so the part-by-part rule accepts
  // a legitimate halo-over-shadow as readily as it refuses an off-table tail.
  expect(
    [
      "0 8px 20px #00000059",
      "0 18px 44px #00000099",
      "0 24px 60px #000000b3",
      "none",
      "inset 2px 0 0 var(--accent)",
      "0 0 0 3px #72e0c02e",
      "0 0 0 3px #72e0c02e, 0 8px 20px #00000059",
    ].filter((value) => !elevationAllowed(value)),
    "an exempt or on-table shadow is refused, so this row would fail the drawing it names",
  ).toEqual([]);
  expect(
    ["1px solid var(--edge)", "1px dashed var(--edge2)", "none", "0"].filter(
      (value) => !boundaryAllowed(value),
    ),
    "a 1px boundary is refused, so this row would fail the drawing it names",
  ).toEqual([]);

  const offScale: string[] = [];
  const read: string[] = [];
  /** How many declarations each arm read across the whole set, so an arm no
   *  drawing feeds reddens here instead of passing over an empty read. */
  const readCount = new Map<string, number>();
  for (const drawing of drawings) {
    const declared = mockupDeclarations(readMockup(drawing.path));
    for (const arm of ARMS) {
      const inClass = declared.filter(
        (declaration) => arm.values(declaration) !== null,
      );
      // The positive control per drawing per class: a file the reader opened
      // but read nothing out of is the shape this gate exists to end, so it
      // reddens here rather than passing as a file with no off-scale value.
      if (arm.readPerDrawing !== false) {
        expect(
          inClass.length,
          `${drawing.name}: the drawing declares no ${arm.property}, so this row read nothing`,
        ).toBeGreaterThan(0);
      }
      readCount.set(
        arm.property,
        (readCount.get(arm.property) ?? 0) + inClass.length,
      );
      read.push(`${drawing.name} ${arm.property} (${inClass.length})`);
      for (const declaration of inClass) {
        for (const value of arm.values(declaration) ?? []) {
          if (arm.allowed(value, declaration.property)) continue;
          offScale.push(
            `${drawing.name}:${declaration.line} ${declaration.property}: ${declaration.value} — \`${value}\` is not on ${arm.scale} and is not one of this class's exemptions (${arm.exempt.join("; ")})`,
          );
        }
      }
    }
  }
  // The per-arm control, for the classes no single drawing has to declare: an
  // arm nothing feeds is an arm that cannot fail, whatever the drawings do.
  for (const arm of ARMS) {
    expect(
      readCount.get(arm.property) ?? 0,
      `no drawing declares a ${arm.property}, so that arm read nothing`,
    ).toBeGreaterThan(0);
  }
  expect(
    offScale,
    `${drawings.length} drawing(s) declare a value their own scale does not contain (read: ${read.join(", ")})`,
  ).toEqual([]);
});

/**
 * The drawing's token table is **one declaration site**, and every site that
 * carries a custom property is read (`vg-309`).
 *
 * **The hole this closes.** `mockupDeclaredProperties` reads the single element
 * `SHELL_TOKEN_SELECTOR` matches (`[style*="width:1180px"]`), and the row that
 * calls itself "the drawing's token table as a set" therefore reads *that
 * element* — so a token declared at `:root`, or on a child of the drawn shell,
 * was invisible to it. A palette role the drawing gained outside its own table
 * would still have been missed, which is how `--hot` first arrived unnoticed
 * under a brief that listed ten tokens.
 *
 * **Per site is the shape this drawing makes exact.** The drawing declares its
 * tokens on the shell's outermost element, and nothing inside that subtree
 * re-declares a `--*`; so "the declared-property set per element" and "the
 * union across the matched element's subtree" are the same set *today*, and
 * they differ exactly when something is wrong. A subtree union would keep the
 * set at eleven when a token moved onto a child and pass; the reading below
 * makes that a **second site** and fails. A token at `:root` is a rule site
 * too, so both cases `vg-309` names are covered by the one reading.
 *
 * The set of eleven is compared to `SHELL_ROLES` rather than to a list written
 * here, so a token the drawing drops and a token it gains both redden.
 *
 * A `--grep` that matches nothing exits 0 with zero tests, so the run's own
 * summary is the proof this ran at all.
 */
test("the shell drawing declares its token table at one site", () => {
  const sites = new Map<string, { line: number; tokens: string[] }>();
  for (const declaration of mockupDeclarations(readMockup(MOCKUP_PATH))) {
    if (!declaration.property.startsWith("--")) continue;
    const key = `${declaration.inline ? "inline" : "rule"}\u0000${declaration.owner}`;
    const site = sites.get(key) ?? { line: declaration.line, tokens: [] };
    site.tokens.push(declaration.property);
    sites.set(key, site);
  }

  const declared = [...sites.values()];
  // The positive control: a reader that found no site read nothing, and this
  // row's whole subject is a table nothing was reading.
  expect(
    declared.length,
    `${SHELL_DRAWING}: no declaration site carries a custom property, so this row read nothing`,
  ).toBeGreaterThan(0);
  expect(
    declared.map(
      (site) =>
        `${SHELL_DRAWING}:${site.line} declares ${site.tokens.join(", ")}`,
    ),
    `${SHELL_DRAWING} carries a custom property somewhere other than its one token table`,
  ).toHaveLength(1);

  expect(
    [...new Set(declared[0]?.tokens ?? [])].sort(),
    `${SHELL_DRAWING}'s token table is no longer the eleven roles the product maps`,
  ).toEqual(SHELL_ROLES.map((role) => role.drawingToken).sort());
});
