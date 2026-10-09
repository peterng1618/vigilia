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

- **Plan 3 — [`the inspector`](docs/superpowers/plans/2026-10-08-the-inspector.md) — is the active plan**: Tasks 1–4 are complete, and Task 5, the Paint section, is next.
- **Plans 1 and 2 are complete and closed** — the gates and the control set, then the shell and the rail through `cea69cac`; exactly one plan is active at a time, and this is it.
- **The spec is `draft` and unimplemented** — its acceptance sections are plans of measurement, not results.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item.
- **Seven user rulings from the design pass are recorded** in the spec's *Ruled during review*, including four rail slots, `View` staying in the menubar, and the stage drawing no device.

## Last completed change

- **Task 4 — Position is React** — the X/Y and W/H pairs, the size-disagreement note, the crop row, the bleed mark and a shape's own geometry are `FieldView`s/`ExtraView`s; the column gained `pair`/`note` arms, `ControlPair`, and a `crop` extra.
- **Every converted geometry field declares `integer: true`** — `left`/`top`/`width`/`height`, a shape's sides, line ends and sweep angles, enforced by `view.ts`'s `WRITABLE_FIELD_IDS` and `ControlNumber`; `view.test.ts`'s "width takes a fraction" was the dropped rule and is corrected.
- **`edits.commit` is the one funnel** — `write`'s four branches (text box, scale, `setCoords`) survive verbatim, the stale-draft refusal is `editRefusal`'s revision guard, and a dimension below one unit lands on 1 in the funnel rather than by refusal.
- **The shared driver opens Position by `aria-expanded`** — `rebuild-driver.ts`'s `openPosition` and `editor.spec.ts`'s `geometryPairBoxes` read the plan-1 disclosure, so the Size-pair and polygon journeys pass.
- **Evidence** — 291 selection-inspector tests pass; the three named red proofs fail their named case (pairing, fractional sibling, group bleed) with the observed text recorded, then restored; editor.spec.ts measured 6 red/59 pass, inspector-sections.spec.ts 4 red/6 pass (all pre-existing chart/section-chrome); lint, typecheck, format:check, design:check (28 gated) and build clean.

## Next

1. **Task 5 — Paint** — material, and the glass refusal that must reach the author, dispatched against this commit's base.
2. **Task 7 owns one removal commit** — eight e2e files' locators (now including the chart hooks: `[data-vigilia-binding]`, `[data-vigilia-chart-binding-add]`, `[data-vigilia-chart-paint]`), the dead `.vigilia-section*` CSS, and `property-section.ts` with its test cases; its red set is carried in the ledger as counts, not file names.
3. **Manager-ownership cleanup is deferred, not dropped** — the survey's fifteen rows (`vg-232`…`vg-246`) are live in the register; the ordering is re-decided at plan 3's close, since a mid-plan pause leaves the column half-converted and the inspector's own modules are two of those rows.
4. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **Two palette defects are pinned, not fixed** — vg-200 (the resting `--edge` boundary, 2.15:1 in graphite and 1.42:1 in light) and vg-201 (`--warn` text, 1.4–2.0:1 in ember, moss and plum) — so the gate is green with a measured floor under each, and §5's ratios do not hold there until they are ruled on.
- **The browser suite has known reds, so it cannot be read as green**: `vg-135`, `vg-175`, `vg-196` and `vg-197` can redden a run, `vg-210` is deterministic at base, `vg-137` and `vg-204` fail deterministically, `vg-216` means two runs at once fabricate failures, and eight files carry by-design reds until Task 7 — `editor.spec.ts` (6 red: 5 combobox-owned, 1 `<details>` reader), `inspector-sections.spec.ts` (4 red: 3 combobox-owned, 1 `<details>` reader), `shell-surfaces.spec.ts`, `rebuild-driver.ts`, `author-journey-rebuild.spec.ts`, `author-journey-display.spec.ts`, `rebuild-composition.ts` and `reference-theme.spec.ts` (1 red left; its `vg-250` red was real and is fixed) — they still read the `<details>`/`<summary>` markup the section control replaced or drive native `<select>`s and `<option>` lists that Tasks 2, 3 and 3a replaced.
- **A pane's title bar and footer scroll with its body** (`vg-208`) — bible §7.7 wants them outside it, but the plan makes the aside the single scroller deliberately, so it is a structure decision rather than a task.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright — the parity spec included.
