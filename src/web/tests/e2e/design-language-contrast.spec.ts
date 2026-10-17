import { expect, test } from "@playwright/test";
import { BOUNDARY_PX } from "./design-language-fixture.js";
import {
  BOUNDARY_MIN,
  contrast,
  minimumFor,
  openFixture,
  PALETTES,
  PINNED_FLOOR,
  pixelsAt,
  prepareControls,
  probes,
  type Rgba,
  ratioAgainstPixel,
  round,
  setPalette,
} from "./design-language-readers.js";
import { openShell } from "./shell-palette.js";
import { isDesktopSurface } from "./surface.js";

/** Responsibility: §5 required contrast, hover, focus, forced colours and single well boundaries; includes real chrome contrast. */
test("required control contrast clears every palette (§5)", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
  test.setTimeout(180_000);
  await prepareControls(page);
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
  for (const line of ratios) {
    // The table is the evidence a reader needs to check a ratio without a
    // trace, so it is printed as well as attached.
    console.log(`contrast ${line}`);
  }
  expect(failures, "a required contrast minimum is not met").toEqual([]);
  testInfo.annotations.push({
    type: "contrast",
    description: ratios.join(" | "),
  });
});

test("focus boundaries clear every palette (§5)", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
  test.setTimeout(180_000);
  await prepareControls(page);
  const ratios: string[] = [];
  const failures: string[] = [];
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
  for (const line of ratios) {
    // The table is the evidence a reader needs to check a ratio without a
    // trace, so it is printed as well as attached.
    console.log(`contrast ${line}`);
  }
  expect(failures, "a required contrast minimum is not met").toEqual([]);
  testInfo.annotations.push({
    type: "contrast",
    description: ratios.join(" | "),
  });
});

test("slider thumbs contrast with both track halves (§5)", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
  test.setTimeout(180_000);
  await prepareControls(page);
  const ratios: string[] = [];
  const failures: string[] = [];
  await setPalette(page, "graphite");
  await page.keyboard.press("Tab");
  await page.locator("[data-fixture='icon-focus'] button").focus();
  await expect(
    page.locator("[data-fixture='icon-focus'] button"),
  ).toBeFocused();
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
  testInfo.annotations.push({
    type: "contrast",
    description: ratios.join(" | "),
  });
});

test("hover raises only eligible resting edges (§5)", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
  test.setTimeout(180_000);
  await prepareControls(page);
  await page.keyboard.press("Tab");
  await page.locator("[data-fixture='icon-focus'] button").focus();
  await expect(
    page.locator("[data-fixture='icon-focus'] button"),
  ).toBeFocused();
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
});

test("choice focus and checked state stay distinct (§5)", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
  test.setTimeout(180_000);
  await prepareControls(page);
  const ratios: string[] = [];
  const failures: string[] = [];
  await setPalette(page, "graphite");
  await page.keyboard.press("Tab");
  await page.locator("[data-fixture='icon-focus'] button").focus();
  await expect(
    page.locator("[data-fixture='icon-focus'] button"),
  ).toBeFocused();
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
    `the focused row's outline is not §5's ${BOUNDARY_PX}px boundary`,
  ).toBeGreaterThanOrEqual(BOUNDARY_PX);
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
  testInfo.annotations.push({
    type: "contrast",
    description: ratios.join(" | "),
  });
});

test("focus survives forced colours (§5)", async ({ page }, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");
  test.setTimeout(180_000);
  await prepareControls(page);
  await setPalette(page, "light");
  await page.keyboard.press("Tab");
  await page.locator("[data-fixture='icon-focus'] button").focus();
  await expect(
    page.locator("[data-fixture='icon-focus'] button"),
  ).toBeFocused();
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
});

/**
 * One boundary, not two, on a focused field inside a well (`vg-464`, item 7).
 *
 * `editor-shell.css`'s focus fallback is `.editor-shell :is(button, input,
 * select, [tabindex]):focus-visible { outline: 2px solid var(--shell-accent) }`,
 * and its `@layer base` wrapper is load-bearing. The well `control-well.tsx`
 * draws **is** the field's focus treatment — rounded to the control's own radius,
 * with §5's halo beside it — and the field inside it says `outline-none`.
 * Unlayered, the fallback outranked both utilities and every field in a well
 * wore a second, square outline inside the rounded one; in the base layer the
 * field's own declaration wins and the well is the boundary's one owner.
 *
 * **What section 4b cannot see.** It reads the focused control's outline and its
 * contrast and would keep passing with the doubled outline still drawn: the
 * accent outline exists either way, in the same colour, on a button that sits in
 * no well at all. What separates the two states is the **count** — exactly one
 * element on the path from the focused field up through its well draws a
 * boundary, and it is the well's. Two reds.
 *
 * A case of its own rather than another section of "the control set renders in
 * the design language", so a red-proof can run it alone: reverting the `@layer
 * base` wrapper moves every control's focus treatment, and a red-proof that
 * cannot say which assertion failed is no red-proof.
 */
test("a focused field in a well draws one boundary, not two", async ({
  page,
}, testInfo) => {
  test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface");

  await openFixture(page);

  const field = page.locator("[data-fixture='text'] input");
  // Tab first, then the explicit focus: the press is what sets the heuristic
  // that makes a programmatic focus match `:focus-visible`, which is the state
  // §5's boundary is for (the same route section 4b takes).
  await page.keyboard.press("Tab");
  await field.focus();
  await expect(field).toBeFocused();

  const reading = await page.evaluate(() => {
    const input = document.querySelector<HTMLElement>(
      "[data-fixture='text'] input",
    );
    if (input === null) return null;

    /** The boundary an element draws, or `null` for the element that draws
     *  none. A named `none` would count as one, so absence is `null`.
     *
     *  `up === 1` is named "its well" because `control-text.tsx` renders the
     *  input directly inside `ControlWell`, which is what makes the well the
     *  input's parent. A wrapper inserted between them would leave the label
     *  lying while the assertion below still passed — the well carries no
     *  attribute to bind by instead, so if one is ever added, bind by it. */
    const drawnBy = (element: HTMLElement, up: number): string | null => {
      const style = getComputedStyle(element);
      const width = Number.parseFloat(style.outlineWidth);
      if (style.outlineStyle === "none" || !(width > 0)) return null;
      const where =
        up === 0 ? "the field" : up === 1 ? "its well" : `ancestor ${up}`;
      return `${where}: ${style.outlineStyle} ${width}px ${style.outlineColor}`;
    };

    // Three levels rather than the well alone, so a boundary further up than
    // the well is counted instead of being hidden by a parent-only read.
    const boundaries: string[] = [];
    let node: HTMLElement | null = input;
    for (let up = 0; up < 3 && node !== null; up += 1) {
      const drawn = drawnBy(node, up);
      if (drawn !== null) boundaries.push(drawn);
      node = node.parentElement;
    }

    return {
      focusVisible: input.matches(":focus-visible"),
      fieldShadow: getComputedStyle(input).boxShadow,
      boundaries,
    };
  });

  expect(reading, "the focused field is not mounted").not.toBeNull();
  if (reading === null) return;
  // The reading is the evidence, attached rather than only asserted so the
  // count can be read without a trace — and still attached on a failure.
  testInfo.annotations.push({
    type: "boundary",
    description: `${reading.boundaries.length} on the field's path: ${reading.boundaries.join(" | ") || "none"}; field box-shadow ${reading.fieldShadow}`,
  });
  // Without this the reading is not the state a keyboard user sees, so the
  // count below could be one for a reason this case does not claim.
  expect(
    reading.focusVisible,
    "the field does not match :focus-visible, so no boundary of §5's is under test",
  ).toBe(true);
  // A guard on the well's own `:focus-within` reads as the obvious companion to
  // the line above and asserts nothing: a focused descendant makes `:focus-within`
  // true on every ancestor, so it could only fail if the parent were not an
  // ancestor. The count below is what distinguishes the two states.
  expect(
    reading.boundaries,
    `a focused field in a well draws one boundary, and it is the well's: ${reading.boundaries.join(" | ") || "none"}`,
  ).toHaveLength(1);
  expect(
    reading.boundaries[0] ?? "none",
    "the count is one, but the boundary is not the well's",
  ).toMatch(/^its well: solid/);
  // A forward guard, not one of the two reds: `outline-none` is what the field
  // says today and the fallback never paints a shadow either way, so this holds
  // with the defect present and with it fixed. It pins the shape of the next
  // focus treatment — §5 puts the boundary in one medium, so a field that starts
  // drawing a ring would be the same defect drawn the other way.
  expect(
    reading.fieldShadow,
    `the field paints a box-shadow of its own (${reading.fieldShadow})`,
  ).toBe("none");
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
