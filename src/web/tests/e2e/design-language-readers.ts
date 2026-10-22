import { expect, type Page } from "@playwright/test";
import { colourValue, lengthInPx, trackCount } from "./mockup-comparators.js";
import { currentDrawings, type ParityRegion } from "./mockup-values.js";

/** Responsibility: shared fixture setup, geometry, colour/pixel readers and design-language constants; drawing parsing stays in mockup-values.ts. */
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

export const FIXTURE = "http://127.0.0.1:4174/control-fixture.html";
export const EDITOR = "http://127.0.0.1:4174/";

/** DESIGN.md §3's named steps. DESIGN.md is the source; this list and the steps in
 *  `scripts/design-tokens.mjs` are two independent transcriptions of it, so a §3
 *  change updates both in the same commit. There is deliberately no import
 *  between them: `tests/e2e/` belongs to no tsconfig (vg-192), so a cross-package
 *  import would arrive untyped and buy coupling, not safety. */
export const SPACING_STEPS = [4, 6, 8, 10, 12, 14, 16, 20, 24, 32];

/** DESIGN.md §4's thirteen roles. `--bg` and `--stage` are here too: they carry no
 *  `--color-*` utility, because both alias `--shell-backdrop` — a gradient under
 *  `light` and a flat colour in the other five, where a colour utility would set
 *  a colour to the gradient and fail silently. Each is still resolved here: the
 *  segmented control paints `--stage` with the `background` shorthand, so the
 *  fixture reads them the same way it reads the other eleven. */
export const ROLES = [
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
export const PALETTES = [
  "editorial",
  "graphite",
  "ember",
  "moss",
  "plum",
  "light",
] as const;

export type Palette = (typeof PALETTES)[number];

/** WCAG 1.4.3/1.4.11: normal text, and the boundary that identifies a control
 *  or its focus. */
export const TEXT_MIN = 4.5;
export const BOUNDARY_MIN = 3;

/**
 * The measured palette defects this gate pins rather than blesses — a ratchet,
 * not a waiver. **Empty, and that is the mechanism working rather than being
 * abandoned**: §5's minimum now holds for every probe in every palette, so
 * there is nothing left to pin, and the map stays here for the next row that
 * needs one. `minimumFor` answers the floor when a probe is absent from it.
 *
 * It held one entry until `vg-201` was fixed. `invalid` is a rejected draft's
 * reason, painted `--warn`; `--shell-warm` was a pastel in ember, moss and plum
 * (`#ff7e6e`, `#e8c56a`, `#ffb2a1`) while those palettes' paper is light, so the
 * reason read at 1.4–2.0:1 and the row was pinned at ember 1.9, moss 1.35, plum
 * 1.35. The control was never the error: the shell paints
 * `.editor-shell-diagnostic` and `.editor-shell-save-state` with the same role.
 * (The row also justified the deepening by `--yunari-accent` aliasing
 * `--shell-warm`, but that token was read by no rule and is retired — `vg-552`.)
 * Deepening the hue is what `--shell-accent`
 * got in the same three palettes, and it is what `--shell-warm` now gets, so the
 * pin is deleted and the 4.5:1 minimum is restored — the rule this file states
 * for every pin.
 *
 * **The `boundary` pin is gone, and it is not a waiver.** The user ruled §5's
 * 3:1 the **narrow** reading (2026-10-11, `vg-200`/`vg-318`): it binds the focus
 * boundary and a boundary that is a control's ONLY separation, and the well's
 * resting hairline is a divider — the well also carries a fill, a hover-raise
 * and a label — so graphite's 1.20:1 and light's 1.42:1 are deliberate
 * low-contrast style rather than a defect. The probe is still measured and
 * printed; what changed is that `minimumFor` gives a divider no floor at all.
 */
export const PINNED_FLOOR: Readonly<
  Record<string, Partial<Record<Palette, number>>>
> = {};

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
export function minimumFor(name: string): number | null {
  if (name === "divider") return null;
  return name === "checked" ? BOUNDARY_MIN : TEXT_MIN;
}

export const FREEZE = "design-language-freeze";
export const HIDE_TEXT = "design-language-hide-text";

/** Transitions and animations frozen, for reading a settled frame and for
 *  capturing one that is not mid-fade.
 *
 *  **It must not be applied while motion is being measured.** `transition: none`
 *  makes every duration `0s` on exactly the scope the reduced-motion check
 *  reads, so a run with the freeze on reports nothing animating whatever the
 *  stylesheet does — the check passed for a whole round because of it. The
 *  positive control in that section is what keeps this honest. */
export const FREEZE_CSS =
  "[data-fixture-root],[data-fixture-root] *{transition:none !important;animation:none !important}";

/** Every style the fixture is measured under, in one place: transitions are
 *  frozen so a palette change is not read mid-fade, and text is hidden as well
 *  as made transparent — `-webkit-text-fill-color` is what a Chromium input
 *  actually paints with, so `color: transparent` alone leaves the glyphs in the
 *  picture and every sampled "background" would be the text. */
export async function setStyle(
  page: Page,
  id: string,
  css: string,
): Promise<void> {
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

export async function clearStyle(page: Page, id: string): Promise<void> {
  await page.evaluate((id) => document.getElementById(id)?.remove(), id);
}

export async function freeze(page: Page): Promise<void> {
  await setStyle(page, FREEZE, FREEZE_CSS);
}

/** Every element under the fixture that still carries a transition or an
 *  animation with a non-zero duration, named so a failure says which. */
export async function movingElements(page: Page): Promise<string[]> {
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

export async function openFixture(page: Page): Promise<void> {
  await page.goto(FIXTURE);
  // A `dist` built by `npm run build` alone has no `control-fixture.html`: the
  // production build's `emptyOutDir` deletes it and `vite.config.fixture.ts`
  // adds it only in a second invocation, so `vite preview` falls back to
  // `index.html` — whose `#app` mount is not this page's `#control-fixture`.
  // Without this, the specs fail at the `[data-fixture-root]` assert below in a
  // shape indistinguishable from a design-language violation. Name the cause
  // and the recipe instead.
  if ((await page.locator("#control-fixture").count()) === 0) {
    throw new Error(
      `${FIXTURE} served no control fixture: the built editor has no ` +
        "`control-fixture.html`, so the preview fell back to `index.html`. " +
        "Build it with `npm run build:fixture -w @yunari/editor` after " +
        "`npm run build -w @yunari/editor` — the production build empties " +
        "`dist` and deletes the fixture page.",
    );
  }
  await expect(page.locator("[data-fixture-root]")).toBeVisible();
  await freeze(page);
}

export async function setPalette(page: Page, palette: Palette): Promise<void> {
  await page.evaluate((palette) => {
    document.documentElement.setAttribute("data-shell-palette", palette);
  }, palette);
}

export type Rgba = readonly [number, number, number, number];

/** `rgb(r, g, b)` / `rgba(r, g, b, a)` / `#rgb` / `#rrggbb(aa)`, which is every
 *  shape a computed colour or a role probe produces. */
export function parseColour(value: string): Rgba | null {
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
export function over(fg: Rgba, bg: Rgba): Rgba {
  const a = fg[3];
  return [
    fg[0] * a + bg[0] * (1 - a),
    fg[1] * a + bg[1] * (1 - a),
    fg[2] * a + bg[2] * (1 - a),
    1,
  ];
}

export function luminance(c: Rgba): number {
  const channel = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2])
  );
}

export function contrast(fg: Rgba, bg: Rgba): number {
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** The ratio of a computed colour against a pixel that was really rendered.
 *  The foreground keeps its alpha, the background is the screenshot's own RGBA,
 *  and the comparison is composited — the same arithmetic the browser did. */
export function ratioAgainstPixel(fg: string, pixel: Rgba): number {
  const colour = parseColour(fg);
  if (colour === null) throw new Error(`unreadable computed colour: ${fg}`);
  return contrast(over(colour, pixel), pixel);
}

export function round(ratio: number): number {
  return Math.round(ratio * 100) / 100;
}

export type Point = { readonly x: number; readonly y: number };

/** Reads the rendered pixel at each point, from one full-page screenshot.
 *
 *  A background is the only thing a computed style cannot answer: a panel with
 *  alpha over a gradient backdrop is not a colour the cascade resolves. So the
 *  pixels are the evidence and the computed colours are the foreground, and the
 *  ratio is composited from both. */
export async function pixelsAt(
  page: Page,
  points: readonly Point[],
): Promise<Rgba[]> {
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
        return [
          data[0] ?? 0,
          data[1] ?? 0,
          data[2] ?? 0,
          data[3] ?? 0,
        ] as const;
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
export type Probe = {
  readonly name: string;
  readonly fg: string;
  readonly point: Point;
};

export async function probes(page: Page): Promise<Probe[]> {
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

/** DESIGN.md §6's weight rule, transcribed from `editor-shell/icons.ts`'s
 *  `glyphStrokeWidth`. Transcribed rather than imported because `tests/e2e/`
 *  belongs to no tsconfig (vg-192), the same reason `SPACING_STEPS` above is a
 *  copy of DESIGN.md §3 rather than an import: a cross-package import would arrive
 *  untyped and buy coupling, not safety. §6 is the source, so a §6 change
 *  updates both in the same commit. */
export function glyphWeight(size: number): number {
  if (size <= 10) return 2;
  if (size <= 13) return 1.8;
  return 1.7;
}

/** DESIGN.md §6's three tiers, for the membership reading beside the rule. */
export const GLYPH_TIERS: readonly number[] = [2, 1.8, 1.7];
/** The luminance of a declared surface value, gradient or flat.
 *
 *  `--bg` is a gradient stack under `light` and has no single luminance, so its
 *  colour stops are averaged — the ground the eye gets rather than a stop the
 *  file happens to write first. Any other palette's `--bg` is one flat colour. */
export function surfaceLuminance(value: string): number {
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
export async function renderedDialogs(page: Page): Promise<number> {
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
export function comparatorReading(
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
export function comparatorUnit(comparator: ParityRegion["comparator"]): string {
  if (comparator === "count") return " tracks";
  if (comparator === "colour") return "";
  return "px";
}

/** What a comparator reads, named for the failure that says a value is not one. */
export function comparatorName(comparator: ParityRegion["comparator"]): string {
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
export const DRAWING_NAMES = new Map(
  currentDrawings().map((drawing) => [drawing.path, drawing.name] as const),
);
/** The shell drawing's path as its own rows name it — the checked-in file, not
 *  the absolute path `MOCKUP_PATH` resolves to, because a failure has to name
 *  the line in the file a person opens. The radii gate below names each drawing
 *  from `currentDrawings` instead, so a widened set carries its own names. */
export const SHELL_DRAWING = "docs/design/mockups/current/shell.html";

/** One fixture state and geometry reader for every promoted control arm. */
export async function prepareControls(page: Page) {
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
    // at the cell's left edge and its 40px well ends at its right (§5).
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
  return { geometry, edgeOf };
}
