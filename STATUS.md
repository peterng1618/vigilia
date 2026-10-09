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

- **Plan 2 — [`the shell and the rail`](docs/superpowers/plans/2026-10-08-the-shell-and-the-rail.md) — is active.** Tasks 1–7 are complete and reviewed and phase 2 is closed; Task 8 opens phase 3 and three tasks remain.
- **Plan 1 — gates and the control set — is complete**, with a delivered-state reconciliation for Tasks 1–4 in the plan file in place of its retired ledger.
- **The spec is `draft` and unimplemented** — its acceptance sections are plans of measurement, not results.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item.
- **Seven user rulings from the design pass are recorded** in the spec's *Ruled during review*, including four rail slots, `View` staying in the menubar, and the stage drawing no device.

## Last completed change

- **Task 7 of plan 2 — the dock, re-layered — is complete and reviewed**, closing phase 2 through `8b860246`: one review and no fix round.
- **The dock sits at the stage's bottom-centre** at the bible's radii and control sizes, still rendering both registry halves — the object half filtered, the arrange half greyed with its marker kept — and acquires a `--muted` border on hover per §5 rule 6.
- **The two specs that could have broken invisibly held**: `editor.spec.ts:3877` and `snapping.spec.ts:581` compare the toolbar's non-arrange button labels for **equality**, and the review verified from source that no new unmarked button entered the toolbar rather than inferring it from a green run.
- **The review's own mutation bit**: rendering the arrange half absent instead of greyed reddened both asymmetry cases — the red proof the brief asked for, and the reason those two cases are guards rather than decoration.
- **It also refuted the implementer's stated gap**: `editor-rail.spec.ts:164` already loops all three of §7.7's density configurations with reachability and inset assertions, so no separate measurement was owed; `vg-226` and `vg-227` land with this close and `vg-224` is corrected from four instances to three.

## Next

1. **Task 8 — the ratchet says so** — the gated list as the union of what this plan converted (22 files), plus `editor-shell.css`'s hex count recorded as a **before-state for plan 3**, not driven to zero: that file is deliberately ungated, and its palettes are legitimately hex. Its vacuity proof needs care — the guard exits **1** both for an empty list and for a path it cannot read, so a literal `/tmp` path proves nothing and the report must quote the `is empty; the guard would check nothing` wording.
2. **Then Task 9's parity capture and Task 10's difference list**, which inherits `vg-217`, `vg-219`, `vg-222`, `vg-223`, `vg-225` and `vg-226`.
3. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **Two palette defects are pinned, not fixed** — vg-200 (the resting `--edge` boundary, 2.15:1 in graphite and 1.42:1 in light) and vg-201 (`--warn` text, 1.4–2.0:1 in ember, moss and plum) — so the gate is green with a measured floor under each, and §5's ratios do not hold there until they are ruled on.
- **The browser suite has known reds, so it cannot be read as green**: `vg-135`, `vg-175`, `vg-196` and `vg-197` can redden a run, `vg-210` is deterministic at base, `vg-137` and `vg-204` fail deterministically, and `vg-216` means two runs at once fabricate failures — a red from an overlapping run is not a measurement.
- **A pane's title bar and footer scroll with its body** (`vg-208`) — bible §7.7 wants them outside it, but the plan makes the aside the single scroller deliberately, so it is a structure decision rather than a task.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright — the parity spec included.
