# Vigilia status

Updated: 2026-10-09
Branch: `develop`

## Current objective

**Rebuild the editor's GUI in the design language — the whole editor, every
frontend surface except the canvas.**

The look is specified and the rewrite under it is decided; the gates, the control
set and the shell's first surface are built. The target is
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

- **Plan 2 — [`the shell and the rail`](docs/superpowers/plans/2026-10-08-the-shell-and-the-rail.md) — is active.** Task 1 is complete and reviewed; Task 2 is in flight and eight tasks remain across three phases.
- **Plan 1 — gates and the control set — is complete**, with a delivered-state reconciliation for Tasks 1–4 in the plan file in place of its retired ledger.
- **The spec is `draft` and unimplemented** — its acceptance sections are plans of measurement, not results.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item.
- **Seven user rulings from the design pass are recorded** in the spec's *Ruled during review*, including four rail slots, `View` staying in the menubar, and the stage drawing no device.

## Last completed change

- **Task 1 of plan 2 — the rail replaces the pane bar — is complete and reviewed** through `ef3cc3f0`: the review passed spec and quality, and the scoped re-review returned every item addressed with no new findings.
- **The rail exposed a pre-existing dock defect** — a fixed 639px row at `left:50%` under `overflow:hidden` already overran its 608px stage by 16px — so the three "30s timeouts" were Playwright retrying a click on an unhittable `Duplicate`; it now wraps inside the stage's insets, proven by a hit test at three viewports.
- **`vg-137`'s red is measured, not asserted**: the fit zoom falls 0.3622 → 0.3300 as the rail's 46px column takes 54px off the stage, so Task 1 moved an input that open row owns rather than causing a defect of its own.
- **`editor-shell.css` cannot join the ratchet yet** — gating it reports 79 violations, nearly all pre-existing — so the plan's same-task rule defers to Task 8 on that measurement, with the verbatim list recorded as its work item.
- **Task 1's own verification table held a false row**: `format:check` was red at its commit, found and fixed in the review round, and the fix's hunks are proven line-breaks-only.

## Next

1. **Task 2 — the panes' chrome** — a title bar, a scrolling body and a footer toolbar per pane, with the Composition footer filtering `OBJECT_ACTIONS` through `actionEnabled` rather than a second predicate.
2. **Then Tasks 3–7** — the header trimmed, the status bar, document identity, the stage's view cluster, and the dock re-layered; Task 6 also relaxes the dock's interim `100% - 100px` cap to `100% - 32px`.
3. **Then plan 2's phase 3** — the ratchet (Task 8, which owns the 79-violation list and the rail slot's 34px decision), the parity capture (Task 9) and the difference list (Task 10).
4. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **Two palette defects are pinned, not fixed** — vg-200 (the resting `--edge` boundary, 2.15:1 in graphite and 1.42:1 in light) and vg-201 (`--warn` text, 1.4–2.0:1 in ember, moss and plum) — so the gate is green with a measured floor under each, and §5's ratios do not hold there until they are ruled on.
- **The browser suite has known reds, so it cannot be read as green**: `vg-135`, `vg-175`, `vg-196` and `vg-197` can redden a run, and `vg-137` and `vg-204` fail deterministically.
- **`vg-174` is the LAN move's open row** — a GET landing while a move is in flight can leave the host never listening again; reasoned from the code, not reproduced.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright — the parity spec included.
