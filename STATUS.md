# Vigilia status

Updated: 2026-10-09
Branch: `develop`

## Current objective

**Rebuild the editor's GUI in the design language — the whole editor, every
frontend surface except the canvas.**

The look is specified and the rewrite under it is decided; the gates, the control
set, the whole shell and now the inspector's boundary are built. The target is
[`docs/design/design-language.md`](docs/design/design-language.md), the contract
is
[`2026-10-08-editor-design-language-design.md`](docs/superpowers/specs/2026-10-08-editor-design-language-design.md),
and the boundary that makes it affordable is
[0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md).

The measure of done is the spec's Acceptance section, which is counted rather
than reviewed: no hex colour and no off-scale spacing in a surface, no native
`<select>`, and every panel's existing behaviour surviving its rewrite.

**The standing author-loop objective is suspended, not withdrawn.** Driving the
product to find what is broken resumes when this objective closes, and the
backlog it produced stays live in the register.

## Active work

- **Plan 3 — [`the inspector`](docs/superpowers/plans/2026-10-08-the-inspector.md) — is the active plan**: Tasks 1–3a are complete, and Task 4, the Position section, is next.
- **Plans 1 and 2 are complete and closed** — the gates and the control set, then the shell and the rail through `cea69cac`; exactly one plan is active at a time, and this is it.
- **The spec is `draft` and unimplemented** — its acceptance sections are plans of measurement, not results.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item.
- **Seven user rulings from the design pass are recorded** in the spec's *Ruled during review*, including four rail slots, `View` staying in the menubar, and the stage drawing no device.

## Last completed change

- **Plan 3 Task 3a landed** — a chart's Content and Paint are serializable views rendered by chart-owned React (`chart-fields.tsx`); `chart-manager/panel.ts` is now a projection, and no chart field returns an `HTMLElement` into the inspector any more.
- **The port carries values, not elements** — `ChartFieldsPort` hands over `ChartContentFieldsView`/`ChartPaintFieldsView` and `ChartEdits` is the write half, keyed by chart id, so a control whose draft outlived its selection lands on the chart it was rendered for; the session builds the manager before the inspector that reads it.
- **Both bodies render plan 1's controls** — nested paths (`animation.durationMs`, `total.value`) commit through `settings-path`, series add/remove and the gauge's one-reading ceiling stay the manager's, and a disabled value cannot invoke a command.
- **Two break-proofs, observed failure text recorded** — hiding one descriptor reds `panel.dom.test.ts` (`…expected 9 descriptors`) and `chart-fields.dom.test.tsx` (`no control carries data-vigilia-chart-setting="roundCap"`); flattening the nested commit reds the animation block, the pie total and the save/reopen case.
- **The e2e red set was measured by file, fixed none** — `editor.spec.ts` 8 red / 57 pass, `inspector-sections.spec.ts` 5 red / 5 pass, `author-journey-rebuild.spec.ts` 8 red / 1 pass, `reference-theme.spec.ts` 2 red / 13 pass; every chart-owned red is `selectOption` on a control that is now a `<button role="combobox">`, and `editor-inspector-chart` was re-captured.

## Next

1. **Task 4 — Position** — geometry, crop, the bleed mark and a shape's own fields, dispatched against this commit's base.
2. **Task 7 owns one removal commit** — seven e2e specs' locators (now including the chart hooks: `[data-vigilia-binding]`, `[data-vigilia-chart-binding-add]`, `[data-vigilia-chart-paint]`), the dead `.vigilia-section*` CSS, and `property-section.ts` with its test cases.
3. **Manager-ownership cleanup is deferred, not dropped** — the survey's fifteen rows (`vg-232`…`vg-246`) are live in the register; the ordering is re-decided at plan 3's close, since a mid-plan pause leaves the column half-converted and the inspector's own modules are two of those rows.
4. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **Two palette defects are pinned, not fixed** — vg-200 (the resting `--edge` boundary, 2.15:1 in graphite and 1.42:1 in light) and vg-201 (`--warn` text, 1.4–2.0:1 in ember, moss and plum) — so the gate is green with a measured floor under each, and §5's ratios do not hold there until they are ruled on.
- **The browser suite has known reds, so it cannot be read as green**: `vg-135`, `vg-175`, `vg-196` and `vg-197` can redden a run, `vg-210` is deterministic at base, `vg-137` and `vg-204` fail deterministically, `vg-216` means two runs at once fabricate failures, and seven specs are red by design until Task 7 — `editor.spec.ts`, `inspector-sections.spec.ts`, `shell-surfaces.spec.ts`, `rebuild-driver.ts`, `author-journey-rebuild.spec.ts`, `author-journey-display.spec.ts`, `rebuild-composition.ts` and `reference-theme.spec.ts` still read the `<details>`/`<summary>` markup or drive native `<select>`s and `<option>` lists that Tasks 2, 3 and 3a replaced.
- **A pane's title bar and footer scroll with its body** (`vg-208`) — bible §7.7 wants them outside it, but the plan makes the aside the single scroller deliberately, so it is a structure decision rather than a task.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright — the parity spec included.
