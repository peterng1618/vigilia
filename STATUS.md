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

- **Plan 2 — [`the shell and the rail`](docs/superpowers/plans/2026-10-08-the-shell-and-the-rail.md) — is active.** Tasks 1–3 are complete and reviewed; Task 4 is next and six tasks remain.
- **Plan 1 — gates and the control set — is complete**, with a delivered-state reconciliation for Tasks 1–4 in the plan file in place of its retired ledger.
- **The spec is `draft` and unimplemented** — its acceptance sections are plans of measurement, not results.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item.
- **Seven user rulings from the design pass are recorded** in the spec's *Ruled during review*, including four rail slots, `View` staying in the menubar, and the stage drawing no device.

## Last completed change

- **Task 3 of plan 2 — the header trimmed — is complete and reviewed** through `1143fc32`: a review failed it, two fix rounds closed it, and a scoped re-review passed it with no new findings.
- **The publish control opens the surface instead of toggling the host** — the host switch lives inside the popover, so reading a presenting host's phone address no longer stops it, which is what Step 4's "no fact is lost" requires.
- **The Insert menu and its `+` popover are deleted**; the Add pane carries the group list, and the chart button's silent no-op was closed to match the card button's refusal by name.
- **`Save package` left the header for the File menu's own row**, with the six specs that clicked `[data-vigilia-save-package]` re-pointed and one left unexercised under the base-red `vg-119`.
- **F1's red proof was reproduced by the reviewer rather than trusted**, and F4's new throw was shown unreachable in production, so the Global Constraint "No behaviour changes" holds.

## Next

1. **Task 4 — the status bar** — a 26px mono strip carrying counts, the last diagnostic and save state with a `live` indicator, and no tools; it consumes Task 3's `HostingStore` and produces `PublishIndicator`.
2. **Then Tasks 5–7** — document identity, the stage's view cluster, and the dock re-layered; Task 6 relaxes the dock's interim `100% - 100px` cap to `100% - 32px`.
3. **Then plan 2's phase 3** — Task 8's ratchet (which owns `editor-shell.css`'s 79 violations and the rail slot's 34px), Task 9's parity capture, and Task 10's difference list.
4. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **Two palette defects are pinned, not fixed** — vg-200 (the resting `--edge` boundary, 2.15:1 in graphite and 1.42:1 in light) and vg-201 (`--warn` text, 1.4–2.0:1 in ember, moss and plum) — so the gate is green with a measured floor under each, and §5's ratios do not hold there until they are ruled on.
- **The browser suite has known reds, so it cannot be read as green**: `vg-135`, `vg-175`, `vg-196` and `vg-197` can redden a run, `vg-210` is deterministic at base, and `vg-137` and `vg-204` fail deterministically.
- **A pane's title bar and footer scroll with its body** (`vg-208`) — bible §7.7 wants them outside it, but the plan makes the aside the single scroller deliberately, so it is a structure decision rather than a task.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright — the parity spec included.
