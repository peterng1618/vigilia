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

- **Plan 3 — [`the inspector`](docs/superpowers/plans/2026-10-08-the-inspector.md) — is the active plan**: Tasks 1–6 are complete, and Task 7, the parity ledger and every re-pointed locator, is next.
- **Plans 1 and 2 are complete and closed** — the gates and the control set, then the shell and the rail through `cea69cac`; exactly one plan is active at a time, and this is it.
- **The spec is `draft` and unimplemented** — its acceptance sections are plans of measurement, not results.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item.
- **Seven user rulings from the design pass are recorded** in the spec's *Ruled during review*, including four rail slots, `View` staying in the menubar, and the stage drawing no device.

## Last completed change

- **Spends renders as a read-only section** — `spendsBody` emits `control: "readOnly"` field views (`appearance.ts`'s `resolutionField`) for a single object's paint references and type preset, and for a container's distinct descendant tokens; the section declares `readOnly: true`, so its header carries the marker before it is opened.
- **The resolution sentence has one owner** — `appearance.ts`'s `resolutionValue` is shared by the selection's rows and the Document pane's `createResolutionLine`, so `notSet` and "no longer resolves" keep their length in both.
- **The type-preset reveal is kept** — a button is not a row, so it stays the element the section mounts, `data-vigilia-reveal-type-presets` and all.
- **Proved, and each proof can fail** — dropping the flag reddens the header case ('Spends1▾' has no 'Read-only'), answering per child instead of per token reddens the dedup case (1 row → 3), and a `ControlWell` round a row reddens the no-editable-control case; 290 selection-inspector tests pass and `editor.spec.ts:2067` (the Spends browser case) passes against the rebuilt bundle.
- **Carried to Task 7, not fixed here** — `inspector-sections.spec.ts:573` reads the removed `.vigilia-resolution` class inside Spends (`:601`) and is red; the file's other four reds are Task 5's (3 combobox-owned, 1 `<details>` reader).

## Next

1. **Task 7 owns one removal commit** — eight e2e files' locators (the chart hooks `[data-vigilia-binding]`, `[data-vigilia-chart-binding-add]`, `[data-vigilia-chart-paint]`, and `inspector-sections.spec.ts:601`'s `.vigilia-resolution` read inside Spends), the dead `.vigilia-section*` CSS, and `property-section.ts` with its test cases; its red set is carried in the ledger as counts, not file names.
3. **Manager-ownership cleanup is deferred, not dropped** — the survey's fifteen rows (`vg-232`…`vg-246`) are live in the register; the ordering is re-decided at plan 3's close, since a mid-plan pause leaves the column half-converted and the inspector's own modules are two of those rows.
4. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **Two palette defects are pinned, not fixed** — vg-200 (the resting `--edge` boundary, 2.15:1 in graphite and 1.42:1 in light) and vg-201 (`--warn` text, 1.4–2.0:1 in ember, moss and plum) — so the gate is green with a measured floor under each, and §5's ratios do not hold there until they are ruled on.
- **The browser suite has known reds, so it cannot be read as green**: `vg-135`, `vg-175`, `vg-196` and `vg-197` can redden a run, `vg-210` is deterministic at base, `vg-137` and `vg-204` fail deterministically, `vg-216` means two runs at once fabricate failures, and nine files carry by-design reds until Task 7 — `editor.spec.ts` (7 red: 5 combobox-owned, 1 `<details>` reader, 1 slider-caused — `:1008` types into `[data-vigilia-shape-sides]`, now a range), `inspector-sections.spec.ts` (5 red: 3 combobox-owned, 1 `<details>` reader, 1 read of the `.vigilia-resolution` class the converted Spends rows no longer render, `:601`), `shell-surfaces.spec.ts`, `rebuild-driver.ts`, `author-journey-rebuild.spec.ts`, `author-journey-display.spec.ts`, `rebuild-composition.ts`, `reference-theme.spec.ts` (2 red: `:535` and `:2347`, both type into a blur the restored slider no longer draws as a box) and `glass-authoring.spec.ts` (5 red: its `input[type=range]` sibling lookup plus four text-box gestures the slider's own track div intercepts — the slider assertion is the regression proof Task 7 converts, never deletes) — they still read the `<details>`/`<summary>` markup the section control replaced or drive native `<select>`s and `<option>` lists that Tasks 2, 3 and 3a replaced; `composition-panel.spec.ts`'s `:897` group-entry timeout is pre-existing, measured identical at the plan-3 base.
- **A pane's title bar and footer scroll with its body** (`vg-208`) — bible §7.7 wants them outside it, but the plan makes the aside the single scroller deliberately, so it is a structure decision rather than a task.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright — the parity spec included.
