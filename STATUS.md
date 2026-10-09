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

- **Ruling Z — the three bounded fields are `ControlSlider` again, not a plain number box** — a polygon's sides, a shape's sweep (start and end) and the glass blur; the pre-plan control drew a slider whenever both bounds were present and the bible (§5, "A bounded number") gives a slider plus its well, so `panel.ts`/`glass.ts` emit `control: "slider"` and plan 1's `ControlSlider` renders it.
- **The `FieldView` slider arm gained `integer`** — the same whole-number declaration the number arm carries; `data` was already on `FieldBase`, and `column.tsx` does not forward `integer` because `ControlSlider` has no such prop, so the whole-number rule is enforced at the boundary (`WRITABLE_FIELD_IDS`), which refuses a fraction and keeps the draft.
- **Proved, and the proof can fail** — a slider case per field asserts the control kind (`type="range"`) and both bounds, and reverting `shape-sides` to the number arm reddened it ("expected 'text' to be 'range'") before restoring; 288 selection-inspector tests pass.
- **Carried to Task 7, not fixed here** — the restored slider reddens e2e that drives the blur as a text box (`glass-authoring.spec.ts` 5 red, `reference-theme.spec.ts` 2 red, both measured by file at `--workers=1`); the `glass-authoring` slider assertion is the regression proof and must be converted, never deleted.
- **Gates** — lint, format:check, typecheck, design:check (28 gated), build and status:check clean; the swap touches no `src/web/tests/e2e/**` file this round.

## Next

1. **Task 6 — Spends is read-only** — the spend fields render as `readOnly` and look it, dispatched against this commit's base.
2. **Task 7 owns one removal commit** — eight e2e files' locators (now including the chart hooks: `[data-vigilia-binding]`, `[data-vigilia-chart-binding-add]`, `[data-vigilia-chart-paint]`), the dead `.vigilia-section*` CSS, and `property-section.ts` with its test cases; its red set is carried in the ledger as counts, not file names.
3. **Manager-ownership cleanup is deferred, not dropped** — the survey's fifteen rows (`vg-232`…`vg-246`) are live in the register; the ordering is re-decided at plan 3's close, since a mid-plan pause leaves the column half-converted and the inspector's own modules are two of those rows.
4. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **Two palette defects are pinned, not fixed** — vg-200 (the resting `--edge` boundary, 2.15:1 in graphite and 1.42:1 in light) and vg-201 (`--warn` text, 1.4–2.0:1 in ember, moss and plum) — so the gate is green with a measured floor under each, and §5's ratios do not hold there until they are ruled on.
- **The browser suite has known reds, so it cannot be read as green**: `vg-135`, `vg-175`, `vg-196` and `vg-197` can redden a run, `vg-210` is deterministic at base, `vg-137` and `vg-204` fail deterministically, `vg-216` means two runs at once fabricate failures, and nine files carry by-design reds until Task 7 — `editor.spec.ts` (7 red: 5 combobox-owned, 1 `<details>` reader, 1 slider-caused — `:1008` types into `[data-vigilia-shape-sides]`, now a range), `inspector-sections.spec.ts` (4 red: 3 combobox-owned, 1 `<details>` reader), `shell-surfaces.spec.ts`, `rebuild-driver.ts`, `author-journey-rebuild.spec.ts`, `author-journey-display.spec.ts`, `rebuild-composition.ts`, `reference-theme.spec.ts` (2 red: `:535` and `:2347`, both type into a blur the restored slider no longer draws as a box) and `glass-authoring.spec.ts` (5 red: its `input[type=range]` sibling lookup plus four text-box gestures the slider's own track div intercepts — the slider assertion is the regression proof Task 7 converts, never deletes) — they still read the `<details>`/`<summary>` markup the section control replaced or drive native `<select>`s and `<option>` lists that Tasks 2, 3 and 3a replaced; `composition-panel.spec.ts`'s `:897` group-entry timeout is pre-existing, measured identical at the plan-3 base.
- **A pane's title bar and footer scroll with its body** (`vg-208`) — bible §7.7 wants them outside it, but the plan makes the aside the single scroller deliberately, so it is a structure decision rather than a task.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright — the parity spec included.
