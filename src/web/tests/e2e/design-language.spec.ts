import { expect, type Page, test } from "@playwright/test";
import { captureVisualReview } from "./editor-canvas.js";
import { isDesktopSurface } from "./surface.js";

/**
 * The design-language parity gate (spec §13, §13.1).
 *
 * A browser fixture mounts the **built** control set over the **built**
 * stylesheet, and this file asserts the language mechanically: that every gated
 * element's resolved spacing is on bible §3's scale, that no gated element
 * paints a colour that is not one of bible §4's roles, that every target has
 * bible §5's 24×24 hit area without overlapping its neighbour, that required
 * text and the focus boundary clear §5's ratios in all six palettes, that focus
 * survives forced colours, that layout holds at 1280×720, 1440×900 and 200%
 * zoom, and that reduced motion leaves nothing animating. It is the *model*
 * every later plan's parity capture follows.
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
 *   driven, except the two this file drives (the invalid draft and the focus).
 * - **Not the editor.** The fixture shows the control set in isolation on a
 *   panel, not inside a pane; plan 2 onward captures real surfaces.
 *
 * The fixture's route is `control-fixture.html` on the editor preview — a build
 * entry, so no test-only branch exists in the shipped editor. It is registered
 * in `docs/evidence/screenshots/README.md` as the `control-set` capture.
 */

const FIXTURE = "http://127.0.0.1:4174/control-fixture.html";

/** Bible §3's named steps. The bible is the source; this list and the steps in
 *  `scripts/design-tokens.mjs` are two independent transcriptions of it, so a §3
 *  change updates both in the same commit. There is deliberately no import
 *  between them: `tests/e2e/` belongs to no tsconfig (vg-192), so a cross-package
 *  import would arrive untyped and buy coupling, not safety. */
const SPACING_STEPS = [4, 6, 8, 10, 12, 14, 16, 20, 24, 32];

/** Bible §4's thirteen roles. `--bg` and `--stage` are here too: they carry no
 *  `--color-*` utility (both alias a gradient stack under graphite and light),
 *  and the segmented control paints `--stage` with the `background` shorthand,
 *  so the fixture resolves them the same way it resolves the other eleven. */
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

/** The six palettes bible §4 declares a role set for, transcribed from the
 *  bible like `SPACING_STEPS` above; the same update-both rule applies. */
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
 * The two measured palette defects this gate pins rather than blesses — a
 * ratchet, not a waiver.
 *
 * Bible §5's minimum holds for every probe in every palette except the rows
 * named here, and both are **token** defects with a register row of their own
 * rather than a control the control set can fix:
 *
 * - `boundary` is the well's resting 1px `--edge` against the fill it bounds.
 *   `--shell-edge` is a 26%-alpha hairline in graphite
 *   (`editor-shell.css:127`) and a 20%-alpha one in light (`:242`), so the
 *   border composites to about 2.1:1 and 1.4:1. Whether §3's fine hairline
 *   yields to §5's 3:1, or the hairline is simply too faint, is a design call —
 *   `vg-200`.
 * - `invalid` is a rejected draft's reason, painted `--warn`. `--shell-warm` is
 *   a pastel in ember, moss and plum (`#ff7e6e`, `#e8c56a`, `#ffb2a1`) while
 *   those palettes' paper is light, so the reason reads at 1.4–2.0:1. The
 *   control is not the error: the shell already paints
 *   `.editor-shell-diagnostic` and `.editor-shell-save-state` with the same
 *   role. Deepening the hue is what `--shell-accent` got in the same three
 *   palettes, and that is the ruling the row needs — `vg-201`.
 *
 * The four palettes that pass stay at the real minimum, and a pinned floor is
 * deleted — the minimum restored — when its row is fixed. The numbers are the
 * measurement, so a regression still fails.
 */
const PINNED_FLOOR: Readonly<Record<string, Partial<Record<Palette, number>>>> =
  {
    boundary: { graphite: 2, light: 1.2 },
    invalid: { ember: 1.9, moss: 1.35, plum: 1.35 },
  };

/** Bible §5's minimum for a probe: a boundary that identifies a control or its
 *  focus is measured against 3:1, and everything that carries words against
 *  4.5:1. */
function minimumFor(name: string): number {
  return name === "boundary" || name === "checked" ? BOUNDARY_MIN : TEXT_MIN;
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

    // The checked toggle's accent fill against the panel it sits on — a state
    // boundary, not decoration.
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
    // against some other surface: the border is what distinguishes the well.
    const well = value?.parentElement ?? null;
    if (well !== null) {
      out.push({
        name: "boundary",
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

  // ── 1. Authored spacing is on bible §3's scale ────────────────────────────
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
    "an authored spacing value is not on bible §3's scale",
  ).toEqual([]);

  // ── 2. No colour resolves outside bible §4's roles ────────────────────────
  //
  // Every role is resolved *the way a surface paints it* — a probe set to
  // `background: var(--role)` and read back — so `color-mix()` and alpha are
  // resolved by the browser rather than by this file. A gradient role resolves
  // to transparent here, which is what painting it as a colour really does.
  // `box-shadow` is deliberately not read: bible §5.4 makes the halo decoration,
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
    "a gated element paints a colour no bible §4 role resolves to",
  ).toEqual([]);

  // ── 3. Every target has bible §5's 24×24 hit area, and none overlaps ──────
  //
  // Hit-tested rather than measured, because a target's *box* is not its hit
  // area: the toggle's pill is 26×14 and its target is a centred 24×24 carried
  // by `hitTargetClasses` (`control-well.tsx`). A point over that pseudo-element
  // resolves to the control it expands, so hit-testing is the only reading that
  // measures the rule the bible states. A point that lands on a neighbour is how
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

  // Bible §5.4 is explicit that the 3px accent-at-18% halo does not discharge
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
  // (`docs/design/mockups/inspector-controls.html`: `#0b0e12` paper, `#171c23`
  // wells, `#72e0c0` accent) and so the two pictures are comparable, and
  // editorial is the light ground the same vocabulary has to hold on.
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await freeze(page);
  await setPalette(page, "graphite");
  await captureVisualReview(page, testInfo, "control-set");
  await setPalette(page, "editorial");
  await captureVisualReview(page, testInfo, "control-set-editorial");
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
