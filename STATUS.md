# Vigilia status

Updated: 2026-10-09
Branch: `develop`

## Current objective

**Rebuild the editor's GUI in the design language — the whole editor, every
frontend surface except the canvas.**

The look is specified and the rewrite under it is decided; the gates, the control
set and the whole shell — rail, header, panes' chrome, status bar and the stage's
three corners — are built and closed. The target is
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

- **Plan 2 — [`the shell and the rail`](docs/superpowers/plans/2026-10-08-the-shell-and-the-rail.md) — is complete and closed** through `cea69cac`, and **plan 3, the inspector, is next**; no plan is active until it is dispatched from its own file, which stays in `plans/` because plans 3–6 depend on plan 2's difference list.
- **Plan 1 — gates and the control set — is complete**, with a delivered-state reconciliation for Tasks 1–4 in the plan file in place of its retired ledger.
- **The spec is `draft` and unimplemented** — its acceptance sections are plans of measurement, not results.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item.
- **Seven user rulings from the design pass are recorded** in the spec's *Ruled during review*, including four rail slots, `View` staying in the menubar, and the stage drawing no device.

## Last completed change

- **Plan 2 closed at `cea69cac`** after a final whole-branch review on opus: **no Critical**, all ten of the plan's `Review Focus` items absent, every invariant holding across the sequence, and the register confirmed honest.
- **The one Important finding was the class the parity gate cannot catch** — the rail's accent bar painted on the window's outer edge where §7.2 requires the rail's inner edge, and the mockup drew it the same wrong way, so comparing product against mockup saw agreement.
- **The fix round overruled the review by measuring**: `right: -6px` puts the bar flush at 52–54, where the suggested `-8px` mirror would have landed two pixels past the edge in the gutter, and a new browser case fails on both wrong values.
- **`vg-230` and `vg-231` take the plan's last two gaps** — the status bar renders no counts the bible requires, and the body's regions sit at an off-scale 12px radius in a deliberately ungated file — with the review's two slips in my own rows corrected in `5e4ba9e0`.
- **The mockup and the stylesheet moved together** (`e945e96d`), which is spec §13's rule applied to the file whose shared mistake had hidden the defect.

## Next

1. **Plan 3 — the inspector** — the next of the five plans the sequencing table names, read from [`2026-10-08-the-inspector.md`](docs/superpowers/plans/2026-10-08-the-inspector.md) and dispatched per-task exactly as plan 2 was.
2. **It inherits plan 2's differences #20 and #21** (the empty state and the sectioned column) from the completion report, and the register rows this plan filed, above all `vg-226` (`--hot` marked destructive in the dock only).
3. **Plan 2's SDD workspace is deleted**; its completion report lives in the plan file, which stays in `plans/` because plans 3–6 depend on it.
4. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **Two palette defects are pinned, not fixed** — vg-200 (the resting `--edge` boundary, 2.15:1 in graphite and 1.42:1 in light) and vg-201 (`--warn` text, 1.4–2.0:1 in ember, moss and plum) — so the gate is green with a measured floor under each, and §5's ratios do not hold there until they are ruled on.
- **The browser suite has known reds, so it cannot be read as green**: `vg-135`, `vg-175`, `vg-196` and `vg-197` can redden a run, `vg-210` is deterministic at base, `vg-137` and `vg-204` fail deterministically, and `vg-216` means two runs at once fabricate failures — a red from an overlapping run is not a measurement.
- **A pane's title bar and footer scroll with its body** (`vg-208`) — bible §7.7 wants them outside it, but the plan makes the aside the single scroller deliberately, so it is a structure decision rather than a task.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright — the parity spec included.
