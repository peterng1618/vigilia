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

- **Plan 2 — [`the shell and the rail`](docs/superpowers/plans/2026-10-08-the-shell-and-the-rail.md) — is active.** Tasks 1–8 are complete and reviewed; Task 9 is next and two tasks remain.
- **Plan 1 — gates and the control set — is complete**, with a delivered-state reconciliation for Tasks 1–4 in the plan file in place of its retired ledger.
- **The spec is `draft` and unimplemented** — its acceptance sections are plans of measurement, not results.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item.
- **Seven user rulings from the design pass are recorded** in the spec's *Ruled during review*, including four rail slots, `View` staying in the menubar, and the stage drawing no device.

## Last completed change

- **Task 8 of plan 2 — the ratchet — is complete and reviewed**, opening phase 3 through `64b481b0`: one review and one fix round, with every number reproduced independently by the reviewer.
- **The gated list is 23 files**: plan 1's 12 plus the 11 styling surfaces this plan converted, and `design:check` exits 0 over them with `gates:self-test` chaining the guard's own `--self-test`.
- **The measurement caught its own instruments lying twice** — the brief's BRE hex grep returns 0 on a file carrying 88 hex tokens, and the controller's `/tmp` pre-flight was overstated because MSYS translates a POSIX path passed as an argument, not one built inside Node; the report records the correction rather than the claim.
- **The one ruling the round turned on held under review**: `layer-panel.tsx` is in the list because Task 2 genuinely converted its footer to `ControlIconButton` and `LayerActions`, while `save-state.tsx` is out on two comment lines — the reviewer confirmed those are not the same case.
- **`editor-shell.css` is recorded as a before-state, not a target** — 73 guard violations over 88 hex tokens for plan 3 — and `vg-228` lands with this close: the list's dom-test membership is two of fifteen, decided by whichever task happened to add one.

## Next

1. **Task 9 — the parity capture** — `VIGILIA_CAPTURE=1`, one worker, built bundles, the action registered in `docs/evidence/screenshots/README.md` and the images landing there (that path is tracked, 76 files already). Its own trap is named in its brief: a `--grep` matching nothing exits 0 with **zero** tests, so the summary must read that one test ran.
2. **Then Task 10 — the difference list**, whose completion report is a section in this plan file rather than the ledger (which is deleted at plan close), and which names each difference as fixed or deliberate with its owning plan. It closes **no** register row, and it must not overwrite the mockup's settled targets with the product's interim ones — the mockup is the target, and a later plan owns each remaining gap.
3. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **Two palette defects are pinned, not fixed** — vg-200 (the resting `--edge` boundary, 2.15:1 in graphite and 1.42:1 in light) and vg-201 (`--warn` text, 1.4–2.0:1 in ember, moss and plum) — so the gate is green with a measured floor under each, and §5's ratios do not hold there until they are ruled on.
- **The browser suite has known reds, so it cannot be read as green**: `vg-135`, `vg-175`, `vg-196` and `vg-197` can redden a run, `vg-210` is deterministic at base, `vg-137` and `vg-204` fail deterministically, and `vg-216` means two runs at once fabricate failures — a red from an overlapping run is not a measurement.
- **A pane's title bar and footer scroll with its body** (`vg-208`) — bible §7.7 wants them outside it, but the plan makes the aside the single scroller deliberately, so it is a structure decision rather than a task.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright — the parity spec included.
