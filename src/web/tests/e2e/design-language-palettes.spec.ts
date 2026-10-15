import { expect, test } from "@playwright/test";
import {
  PALETTES,
  Palette,
  setPalette,
  surfaceLuminance,
} from "./design-language-readers.js";
import {
  mockupDeclared,
  readMockup,
  SHELL_ROLES,
  SHELL_TOKEN_SELECTOR,
} from "./mockup-values.js";
import { openShell } from "./shell-palette.js";
import { isDesktopSurface } from "./surface.js";

/** Responsibility: §4 graphite roles, derived palette ladders and palette-local danger. */
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
