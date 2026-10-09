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

- **Plan 3 — [`the inspector`](docs/superpowers/plans/2026-10-08-the-inspector.md) — is the active plan**: Tasks 1–5 are complete, and Task 6, the read-only Spends section, is next.
- **Plans 1 and 2 are complete and closed** — the gates and the control set, then the shell and the rail through `cea69cac`; exactly one plan is active at a time, and this is it.
- **The spec is `draft` and unimplemented** — its acceptance sections are plans of measurement, not results.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item.
- **Seven user rulings from the design pass are recorded** in the spec's *Ruled during review*, including four rail slots, `View` staying in the menubar, and the stage drawing no device.

## Last completed change

- **Task 5 — Paint is React** — the panel material fields (fill/ink, stroke, border, radius, shadow and its blur/offset), a chart's own paint and the glass control are `FieldView`s; a `swatch` arm joined the column, and `panel.ts`/`glass.ts` now build values, not controls.
- **The glass control is present and refused in words for every kind that cannot carry it** — a group included — through `ControlRow`'s `refused` (`aria-disabled`, a visible reason), never a tooltip (bible §5.3); `supportsGlassControl` re-checks at the write funnel.
- **The integer rule survived the conversion** — `panel-border`, `panel-radius`, `panel-shadow-blur`, `panel-shadow-offset` and `glass-blur` declare `integer: true` on their number arm, and `view.ts`'s `WRITABLE_FIELD_IDS` re-checks it at the boundary; a fraction is refused with its draft kept, not rounded.
- **The vacuous tests were re-pointed, not left narrowing** — `panel.dom.test.ts`'s per-shape accessible-name sweep is kept and strengthened, and `glass.dom.test.ts`/`ink.dom.test.ts` now drive the React controls instead of native `<select>`s; the toggle-focus case is re-pointed, not deleted.
- **Evidence** — 289 selection-inspector tests pass; the three red proofs (group row omitted, group admitted to material, refusal as a `title` only) failed their named case with the observed text recorded, then restored; lint, format:check, typecheck, design:check (28 gated) and build clean.

## Next

1. **Task 6 — Spends is read-only** — the spend fields render as `readOnly` and look it, dispatched against this commit's base.
2. **Task 7 owns one removal commit** — eight e2e files' locators (now including the chart hooks: `[data-vigilia-binding]`, `[data-vigilia-chart-binding-add]`, `[data-vigilia-chart-paint]`), the dead `.vigilia-section*` CSS, and `property-section.ts` with its test cases; its red set is carried in the ledger as counts, not file names.
3. **Manager-ownership cleanup is deferred, not dropped** — the survey's fifteen rows (`vg-232`…`vg-246`) are live in the register; the ordering is re-decided at plan 3's close, since a mid-plan pause leaves the column half-converted and the inspector's own modules are two of those rows.
4. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **Two palette defects are pinned, not fixed** — vg-200 (the resting `--edge` boundary, 2.15:1 in graphite and 1.42:1 in light) and vg-201 (`--warn` text, 1.4–2.0:1 in ember, moss and plum) — so the gate is green with a measured floor under each, and §5's ratios do not hold there until they are ruled on.
- **The browser suite has known reds, so it cannot be read as green**: `vg-135`, `vg-175`, `vg-196` and `vg-197` can redden a run, `vg-210` is deterministic at base, `vg-137` and `vg-204` fail deterministically, `vg-216` means two runs at once fabricate failures, and nine files carry by-design reds until Task 7 — `editor.spec.ts` (6 red: 5 combobox-owned, 1 `<details>` reader), `inspector-sections.spec.ts` (4 red: 3 combobox-owned, 1 `<details>` reader), `shell-surfaces.spec.ts`, `rebuild-driver.ts`, `author-journey-rebuild.spec.ts`, `author-journey-display.spec.ts`, `rebuild-composition.ts`, `reference-theme.spec.ts` (1 red left; its `vg-250` red was real and is fixed) and `glass-authoring.spec.ts` (2 red: a native `input[type=range]` the converted blur no longer draws — Task 8 removes it — and the pre-plan `.vigilia-field [role='alert']`/restore-on-empty markup the converted refusal renders instead) — they still read the `<details>`/`<summary>` markup the section control replaced or drive native `<select>`s and `<option>` lists that Tasks 2, 3 and 3a replaced; `composition-panel.spec.ts`'s `:897` group-entry timeout is pre-existing, measured identical at the plan-3 base.
- **A pane's title bar and footer scroll with its body** (`vg-208`) — bible §7.7 wants them outside it, but the plan makes the aside the single scroller deliberately, so it is a structure decision rather than a task.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright — the parity spec included.
