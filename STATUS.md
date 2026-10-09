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

- **Plan 2 — [`the shell and the rail`](docs/superpowers/plans/2026-10-08-the-shell-and-the-rail.md) — is active.** Tasks 1–9 are complete and reviewed; Task 10 is next and one task remains.
- **Plan 1 — gates and the control set — is complete**, with a delivered-state reconciliation for Tasks 1–4 in the plan file in place of its retired ledger.
- **The spec is `draft` and unimplemented** — its acceptance sections are plans of measurement, not results.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item.
- **Seven user rulings from the design pass are recorded** in the spec's *Ruled during review*, including four rail slots, `View` staying in the menubar, and the stage drawing no device.

## Last completed change

- **Task 9 of plan 2 — the parity capture — is complete and reviewed**, closing phase 3 through `84abb569`: one review, no fix round, and every claim in the report reproduced by the reviewer or by me.
- **The shell's own state is now evidence**: `editor-shell-add-desktop-chromium.png` shows the Add slot open and nothing selected — the state the mockup draws — beside the two refreshed captures, and all three were re-run rather than re-drawn.
- **The capture fails if the shell is not the new one**: §7.2's four rail slots and exactly one pane in the rail's column are asserted before the picture is written, proved by emptying `RAIL_SLOTS` and watching the committed test fail `Expected: 4, Received: 0`.
- **Every run was reported by its test count, not its exit code** — 1, then 2, then 3 — and the implementer flagged the brief's `?static=1`/controlled-clock line as inapplicable to the editor instead of inventing a static mode (`vg-229`).
- **`[data-vigilia-panel]` names six panes, not four** — the rail's four plus the inspector's `style` and `selection` — so "exactly one is showing" is scoped to `.editor-shell-panel`, which is the rail's column.

## Next

1. **Task 10 — the difference list** — compare Task 9's three captures beside `docs/design/mockups/editor-shell.html` as language rather than pixels, adjudicate each difference against the bible, and account for every one as fixed or deliberate.
2. **Its completion report is a section in this plan file**, not the ledger (deleted at plan close), and it closes **no** register row. It must not overwrite the mockup's settled targets with the product's interim ones: the mockup is the target, and a later plan owns each remaining gap.
3. **Then plan 2's close** — the whole-branch review on the most capable model, one fix dispatch and one scoped re-review, then the plan workspace is deleted; anything that must outlive it needs a register row first.
4. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **Two palette defects are pinned, not fixed** — vg-200 (the resting `--edge` boundary, 2.15:1 in graphite and 1.42:1 in light) and vg-201 (`--warn` text, 1.4–2.0:1 in ember, moss and plum) — so the gate is green with a measured floor under each, and §5's ratios do not hold there until they are ruled on.
- **The browser suite has known reds, so it cannot be read as green**: `vg-135`, `vg-175`, `vg-196` and `vg-197` can redden a run, `vg-210` is deterministic at base, `vg-137` and `vg-204` fail deterministically, and `vg-216` means two runs at once fabricate failures — a red from an overlapping run is not a measurement.
- **A pane's title bar and footer scroll with its body** (`vg-208`) — bible §7.7 wants them outside it, but the plan makes the aside the single scroller deliberately, so it is a structure decision rather than a task.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright — the parity spec included.
