# Vigilia status

Updated: 2026-10-09
Branch: `develop`

## Current objective

**Rebuild the editor's GUI in the design language — the whole editor, every
frontend surface except the canvas.**

The look is specified and the rewrite under it is decided; the gates, the control
set and the shell's first four surfaces are built. The target is
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

- **Plan 2 — [`the shell and the rail`](docs/superpowers/plans/2026-10-08-the-shell-and-the-rail.md) — is active.** Tasks 1–6 are complete and reviewed; Task 7 closes phase 2 and three tasks remain.
- **Plan 1 — gates and the control set — is complete**, with a delivered-state reconciliation for Tasks 1–4 in the plan file in place of its retired ledger.
- **The spec is `draft` and unimplemented** — its acceptance sections are plans of measurement, not results.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item.
- **Seven user rulings from the design pass are recorded** in the spec's *Ruled during review*, including four rail slots, `View` staying in the menubar, and the stage drawing no device.

## Last completed change

- **Task 6 of plan 2 — how the stage is shown — is complete and reviewed**, through `c8aff3d1`: one review and one fix round, each with its own scoped verdict.
- **The stage's top-right carries the view cluster now** — the display chooser with its percentage readout as the trigger, and the camera's `−`, readout, `+` and fit, with every choice the old control offered still one gesture away.
- **The task's own Outcome was the first finding**: the initial landing had no zoom controls, because the brief's Interfaces line omitted `zoomBy`/`zoomToFit` while the Outcome and §7.5 both named them — ruled that the spec binds and the plan argues, so the cluster was completed rather than the Outcome renegotiated.
- **The review found an `aria-pressed` on a one-way command** — announcing a capability the author does not have — and a hover treatment where §5 rule 6 requires an acquired border; both fixed, with the same round's new assertion shown red before it was trusted.
- **R2's collision assertion paid for itself on the first run**, finding a 10.6px overlap at 640×360 that no comparison of the chip's own box could see; four rows land with this close, of which `vg-222` — the §3/§7.5/`.editor-glass` contradiction — is the one worth reading.

## Next

1. **Task 7 — the dock, re-layered** — bottom-centre at elevation 1 with the bible's radii and control sizes, still rendering both registry halves. Its element contract is tighter than its brief says: `editor.spec.ts:3877` and `snapping.spec.ts:581` both compare `button:not([data-vigilia-arrange-action])` label lists for **equality**, so no new unmarked button may enter the toolbar.
2. **Then plan 2's phase 3** — Task 8's ratchet (which owns `editor-shell.css`'s 79 violations, the rail slot's 34px, and `:1611`'s untokenised `calc(100% - 28px)` — but **not** `vg-224`'s hover sweep, which its mechanism cannot see), Task 9's parity capture, and Task 10's difference list, which inherits `vg-217`, `vg-219`, `vg-222`, `vg-223` and `vg-225`.
4. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **Two palette defects are pinned, not fixed** — vg-200 (the resting `--edge` boundary, 2.15:1 in graphite and 1.42:1 in light) and vg-201 (`--warn` text, 1.4–2.0:1 in ember, moss and plum) — so the gate is green with a measured floor under each, and §5's ratios do not hold there until they are ruled on.
- **The browser suite has known reds, so it cannot be read as green**: `vg-135`, `vg-175`, `vg-196` and `vg-197` can redden a run, `vg-210` is deterministic at base, `vg-137` and `vg-204` fail deterministically, and `vg-216` means two runs at once fabricate failures — a red from an overlapping run is not a measurement.
- **A pane's title bar and footer scroll with its body** (`vg-208`) — bible §7.7 wants them outside it, but the plan makes the aside the single scroller deliberately, so it is a structure decision rather than a task.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright — the parity spec included.
