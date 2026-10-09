# Vigilia status

Updated: 2026-10-09
Branch: `develop`

## Current objective

**Rebuild the editor's GUI in the design language — the whole editor, every
frontend surface except the canvas.**

The look is specified and the rewrite under it is decided; the gates, the control
set, the shell's chrome and the stage's three corners are built. The target is
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

- **Plan 2 — [`the shell and the rail`](docs/superpowers/plans/2026-10-08-the-shell-and-the-rail.md) — is active.** All ten tasks are complete and reviewed; its final whole-branch review is next, and the plan closes when that passes.
- **Plan 1 — gates and the control set — is complete**, with a delivered-state reconciliation for Tasks 1–4 in the plan file in place of its retired ledger.
- **The spec is `draft` and unimplemented** — its acceptance sections are plans of measurement, not results.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item.
- **Seven user rulings from the design pass are recorded** in the spec's *Ruled during review*, including four rail slots, `View` staying in the menubar, and the stage drawing no device.

## Last completed change

- **Task 10 of plan 2 — the difference list — is complete and reviewed** through `4701ac65`: one review, one fix round, one scoped re-review, all in the plan file.
- **25 differences, none unowned**: 6 deliberate in this plan, 12 owned by a later plan (7 plan 4, 3 plan 5, 2 plan 3), 7 owned by a register row — and the partition names whole rows so it sums to the table.
- **The review's one Important finding was its arithmetic**, which contradicted the table on the deliberate count and counted `#22` twice; the fix re-states 6 + 12 + 7 = 25 in both places and retires "reported as unowned" as a category.
- **Two differences became rows rather than prose** — `vg-230` (the status bar renders no counts, though §7.6, spec §3.4 and Task 4's own outcome require them) and `vg-231` (the body's four regions inset 8px at an off-scale 12px radius in a deliberately ungated file), both verified against the code before filing.
- **The third was ruled not a gap** — the mockup's brand chevron is its illustration of §7.1's "brand mark", which the wordmark already is.

## Next

1. **Plan 2's whole-branch review**, on the most capable model over `2c0081b1..HEAD` — 36 commits, 74 files, +3788/−1895 — with the plan's `Review Focus` list as its spine, since each of its ten entries is a failure no existing test catches.
2. **Then one fix dispatch, one scoped re-review, adjudicate residuals, and delete the plan workspace** — before deleting it, anything that must outlive the plan needs a register row, because the ledger dies with the directory; Task 10's difference list already lives in the plan file for that reason.
3. **Then plan 3, the inspector**, is the next of the five plans the sequencing table names.
4. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **Two palette defects are pinned, not fixed** — vg-200 (the resting `--edge` boundary, 2.15:1 in graphite and 1.42:1 in light) and vg-201 (`--warn` text, 1.4–2.0:1 in ember, moss and plum) — so the gate is green with a measured floor under each, and §5's ratios do not hold there until they are ruled on.
- **The browser suite has known reds, so it cannot be read as green**: `vg-135`, `vg-175`, `vg-196` and `vg-197` can redden a run, `vg-210` is deterministic at base, `vg-137` and `vg-204` fail deterministically, and `vg-216` means two runs at once fabricate failures — a red from an overlapping run is not a measurement.
- **A pane's title bar and footer scroll with its body** (`vg-208`) — bible §7.7 wants them outside it, but the plan makes the aside the single scroller deliberately, so it is a structure decision rather than a task.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright — the parity spec included.
