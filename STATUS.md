# Vigilia status

Updated: 2026-10-09
Branch: `develop`

## Current objective

**Rebuild the editor's GUI in the design language — the whole editor, every
frontend surface except the canvas.**

The look is specified and the rewrite under it is decided; the gates, the control
set and the shell's first two surfaces are built. The target is
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

- **Plan 2 — [`the shell and the rail`](docs/superpowers/plans/2026-10-08-the-shell-and-the-rail.md) — is active.** Tasks 1–4 are complete and reviewed and phase 1 is closed; Task 5 is next and five tasks remain.
- **Plan 1 — gates and the control set — is complete**, with a delivered-state reconciliation for Tasks 1–4 in the plan file in place of its retired ledger.
- **The spec is `draft` and unimplemented** — its acceptance sections are plans of measurement, not results.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item.
- **Seven user rulings from the design pass are recorded** in the spec's *Ruled during review*, including four rail slots, `View` staying in the menubar, and the stage drawing no device.

## Last completed change

- **Task 4 of plan 2 — the status bar — is complete and reviewed**, closing phase 1 through `030adcaf`: one review and two fix rounds, each with a scoped re-review.
- **The footer is the window's bottom edge now** — a 26px mono `--faint` strip carrying the counts, the diagnostic and the save state, and no tools — with `PublishIndicator` drawing a `live` mark only when the host reports the LAN on.
- **The review found a hole only a mutation exposed**: weakening the indicator's guard left the whole suite green, so a host reporting the LAN *off* would have rendered a false `live`; the new case fails under exactly that mutation, and the reviewer reproduced it.
- **The strip's geometry gained a browser assertion**, after the reviewer showed no gate in this plan checks it and Task 2 of this plan had already failed on a rendered-offset defect jsdom cannot see.
- **A fourth comment-accuracy finding was fixed rather than shipped**: `save-state.tsx`'s "the one thing the footer says that is not a message" became false the moment this task added a second non-message reading beside it.

## Next

1. **Task 5 — the document's identity** — a floating cluster at the stage's top-left carrying the record dot, the theme's name and its edited state, extending `EditorShellSnapshot` with `documentName` and widening its ownership row in the same commit.
2. **Then Tasks 6–7** — the stage's view cluster and the dock re-layered; Task 6 relaxes the dock's interim `100% - 100px` cap to `100% - 32px`.
3. **Then plan 2's phase 3** — Task 8's ratchet (which owns `editor-shell.css`'s 79 violations and the rail slot's 34px), Task 9's parity capture, and Task 10's difference list, which now inherits `vg-217`.
4. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **Two palette defects are pinned, not fixed** — vg-200 (the resting `--edge` boundary, 2.15:1 in graphite and 1.42:1 in light) and vg-201 (`--warn` text, 1.4–2.0:1 in ember, moss and plum) — so the gate is green with a measured floor under each, and §5's ratios do not hold there until they are ruled on.
- **The browser suite has known reds, so it cannot be read as green**: `vg-135`, `vg-175`, `vg-196` and `vg-197` can redden a run, `vg-210` is deterministic at base, `vg-137` and `vg-204` fail deterministically, and `vg-216` means two runs at once fabricate failures — a red from an overlapping run is not a measurement.
- **A pane's title bar and footer scroll with its body** (`vg-208`) — bible §7.7 wants them outside it, but the plan makes the aside the single scroller deliberately, so it is a structure decision rather than a task.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright — the parity spec included.
