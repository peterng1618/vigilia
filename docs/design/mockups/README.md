# Design mockups

**`current/` is the target.** The editor is being rebuilt towards the original
visual direction as those six files draw it, and they are **checked at every
plan gate** — not read once and remembered. The three originals below them are
the record of the first cut, not the target.

## The current set — `current/`

The editor as it renders today, in the original visual direction, with nothing
in any file addressed to the reader: no heading, no caption, no note about what
is illustrative. One file per view, so no file needs a specimen — and the
settings modal's three panels are three of those files, because each panel is
drawn once, where a second copy of the frame in one file would make a
`[style*="…"]` selector address more than one element and the reader refuses to
guess between them.

| File | Shows |
|---|---|
| [`current/shell.html`](current/shell.html) | The whole shell: header and menubar, the four-slot rail, the Add pane, the stage and its floating clusters, the inspector, the status strip |
| [`current/settings.html`](current/settings.html) | The settings surface on its own, with §7's three tabs and the six-palette grid |
| [`current/settings-keyboard.html`](current/settings-keyboard.html) | The same modal with §7's Keyboard panel showing: its header bar and return-to-default action, and the reference's own rows with their chord marks and per-row controls |
| [`current/settings-about.html`](current/settings-about.html) | The same modal with §7's About panel showing: what the editor is, and the version facts this build can read |
| [`current/controls.html`](current/controls.html) | The inspector column as it renders, in the reference palette: wells, a slider, segmented rows, the read-only treatment, a refusal |
| [`current/controls-editorial.html`](current/controls-editorial.html) | The same column on the editorial ground — the same file with the token table swapped, so a hard-coded colour cannot hide in it |

## The originals — the record

The original visual direction, kept for provenance and **not the current
target**. Each carries a one-line label at the top saying so, and **the
originals are never edited again** — not to correct a value, not to remove a
specimen, not to follow a ruling. What they hold is the first cut, and Git
stores the rest.

| File | Shows |
|---|---|
| [`editor-shell.html`](editor-shell.html) | The first shell, with the settings specimens below it |
| [`inspector-controls.html`](inspector-controls.html) | The first control vocabulary, in the reference palette |
| [`inspector-language.html`](inspector-language.html) | The first light-palette column, with a historical group comparison |

Open them in a browser. Each is self-contained — one file, no build, no server.

## What they are, and what they are not

- **They are the design language, drawn.** [`../../../DESIGN.md`](../../../DESIGN.md)
  is the normative text; these are its worked example. Where the **current set**
  and DESIGN.md disagree, **DESIGN.md wins and the file is stale** — correct it
  in the same commit that corrects DESIGN.md. The originals are never corrected,
  by this rule or any other.
- **They are not pixel baselines.** [`../../evidence/screenshots/`](../../evidence/screenshots/)
  holds rendered evidence from built bundles and is explicitly not cross-platform
  golden files; neither is this. Platform font metrics, scrollbar widths and
  device pixel ratios differ, and a difference in those is not drift.
- **They are not a specification of behaviour.** They show one state of each
  surface. Behaviour lives in the spec and, finally, in the code.
- **The current set's copy is the product's own**, taken string by string from
  `ui-copy.ts` or the component that owns the words, so the drawing and the
  editor cannot disagree about what a surface is called. The originals' copy is
  illustrative — it predates the surfaces it draws — and the copy rules are
  DESIGN.md §9.

## Reviewed reference contract — 2026-10-08

**This section describes the three originals as they stood at that review.** It
is a historical record of what those files retain, not an instruction: the
originals are frozen, and a live correction belongs to the file in `current/`.
The current set carries the direction this contract asked for.

- **Preserve the original visual direction.** Warm illustrative artwork,
  compact diagram tiles, subtle stage texture, fine dividers, floating dock,
  lens chips and palette swatch cards remain. A contract correction is not a
  licence to flatten or replace the composition (DESIGN.md §7.8).
- `editor-shell.html` retains the original shell and side-by-side Settings
  specimens. Corrections remove stale Document-menu/Canvas-tab proposals,
  ornamental search and empty-inspector statistics. Four slots and 246px pane
  remain normative. Lens chips are illustrative, not the entire choice list;
  the dock is a separately labelled selected-state specimen.
- `inspector-controls.html` selects a **gauge chart child**, not a card group,
  retaining its wells, slider, swatch, focus/refusal examples and typography.
  Position is second; Spends is read-only. The exact chart inventory belongs
  to descriptors, not this vocabulary illustration.
- `inspector-language.html` retains a labelled historical group comparison
  beside the light chart-child treatment. It does not claim the two selections
  are equivalent. Editable values now have wells; read-only Spends says so.
- These pages are **drawn specimens, not functional product prototypes**.
  No save, import, publish, validation or live telemetry is implemented here.
  All values and timing claims are illustrative. Keyboard models, focus
  trapping and mutation safety require the real host, never a screenshot.
- Specimen palette values are illustrative, not proof that the shipped six
  palettes meet contrast. Capture the product and measure its resolved
  required text and focus boundaries.

## How a gate uses them

A plan whose phase changes a visible surface ends with a **parity capture**: the
built editor, photographed in the state the mockup shows, placed beside it, and
the differences listed. Each difference is then either **fixed**, or **licensed
by a rule that predates it** — a DESIGN.md §N, an ADR or a spec section that
positively requires the product's treatment, named in the commit. Recording a
difference **as deliberate is not a disposition**: it names no rule, and it is
the escape hatch that let a week of drift pass every check green. Where the
written rules are silent, the drawing governs and the product is the defect.

Silence is not a pass. A gate that produces no comparison has not run — the
failure this exists to prevent is exactly the one that produced the previous
pass's "the redesign is done" against an editor that looked unchanged.

The capture itself uses the existing mechanism and its rules — `VIGILIA_CAPTURE=1`,
one worker, previewing built bundles, capturing only actions registered in
[`../../evidence/screenshots/README.md`](../../evidence/screenshots/README.md).

## Keeping them current

A mockup that no longer matches DESIGN.md is worse than no mockup, because it is
believed.

- **The current files are refreshed when the set of surfaces changes.** A pane,
  a tab, a section or a rail slot that appears or disappears is drawn — in the
  original's treatment, never in a treatment of the product's devising.
- **A glyph square drawn as a control starts at §5's 26px bound.** DESIGN.md's
  icon button is "a 26–30px square at `--radius-md`, glyph only", so a drawing
  that draws one as a control draws it 26px at `--radius-md` — never smaller,
  not even where the cluster around it is compact.
- **The treatment is the target and is never redrawn from the product.** Colour,
  spacing, radii, type, elevation, hairlines, flush regions and the palette,
  navigation and dock treatments are copied from the original drawings. When the
  product differs, the product is the defect.
- **Every drawn text element states its token's companion, and the page
  furniture carries no ratio.** §2 gives each of the six sizes its own
  line-height, so one page-body ratio cannot express them: the `<style>` block's
  `font` sets a size only, and each element holding its own text writes the
  `line-height` of the size it resolves to (`vg-440`). An element that omits it
  renders at `normal`, which no gate reads.
- **The originals are never edited again.** They are the record of the first cut;
  Git stores the history.
