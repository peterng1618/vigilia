# Design mockups

**These are the target.** They are what the editor is being rebuilt towards, and
they are **checked at every plan gate** — not read once and remembered.

| File | Shows |
|---|---|
| [`editor-shell.html`](editor-shell.html) | The whole shell: header, four-slot rail, the Add pane, the stage's three corners, the inspector, the status bar, and the settings surface |
| [`inspector-controls.html`](inspector-controls.html) | The control vocabulary in the reference palette — wells, sliders, swatches, the read-only treatment, focus, refusal |
| [`inspector-language.html`](inspector-language.html) | The same column in the light palette, with the language held constant so it is judged apart from colour |

Open them in a browser. Each is self-contained — one file, no build, no server.

## What they are, and what they are not

- **They are the design language, drawn.** [`../design-language.md`](../design-language.md)
  is the normative text; these are its worked example. Where a mockup and the
  bible disagree, **the bible wins and the mockup is stale** — fix the mockup in
  the same commit that corrects the bible.
- **They are not pixel baselines.** [`../../evidence/screenshots/`](../../evidence/screenshots/)
  holds rendered evidence from built bundles and is explicitly not cross-platform
  golden files; neither is this. Platform font metrics, scrollbar widths and
  device pixel ratios differ, and a difference in those is not drift.
- **They are not a specification of behaviour.** They show one state of each
  surface. Behaviour lives in the spec and, finally, in the code.
- **Their copy is illustrative.** Names like `System dashboard` and `CPU card` are
  the starter's; the copy rules are bible §9.

## Reviewed reference contract — 2026-10-08

- **Preserve the original visual direction.** Warm illustrative artwork,
  compact diagram tiles, subtle stage texture, fine dividers, floating dock,
  lens chips and palette swatch cards remain. A contract correction is not a
  licence to flatten or replace the composition (bible §7.8).
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
the differences listed. Each difference is then either **fixed**, or **recorded
in the commit as deliberate** with its reason.

Silence is not a pass. A gate that produces no comparison has not run — the
failure this exists to prevent is exactly the one that produced the previous
pass's "the redesign is done" against an editor that looked unchanged.

The capture itself uses the existing mechanism and its rules — `VIGILIA_CAPTURE=1`,
one worker, previewing built bundles, capturing only actions registered in
[`../../evidence/screenshots/README.md`](../../evidence/screenshots/README.md).

## Keeping them current

A mockup that no longer matches the bible is worse than no mockup, because it is
believed. When a ruling changes the design, the same commit updates the bible,
the mockup and the spec. If a surface is rebuilt differently on purpose, capture
the new state and replace the mockup file — the reference is always the *current*
target, never a historical one, and Git stores the history.
