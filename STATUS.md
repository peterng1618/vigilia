# Vigilia status

Updated: 2026-10-09
Branch: `develop`

## Current objective

**Rebuild the editor's GUI in the design language — the whole editor, every
frontend surface except the canvas.**

The look is specified and the rewrite under it is decided; the gates and the
control set are built, and no editor surface has moved yet. The target is
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

- **Plan 1 — gates and the control set — is complete.** The scales with their ratchet guard, the React control set and the parity gate all landed, and the plan file carries a delivered-state reconciliation for Tasks 1–4 in place of the retired ledger.
- **Plan 2 — [`the shell and the rail`](docs/superpowers/plans/2026-10-08-the-shell-and-the-rail.md) — is next**, the first visible change; it consumes plan 1's fixture, gate and control set.
- **The spec is `draft` and unimplemented** — its acceptance sections are plans of measurement, not results.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item.
- **Seven user rulings from the design pass are recorded** in the spec's *Ruled during review*, including four rail slots, `View` staying in the menubar, and the stage drawing no device.

## Last completed change

- **Plan 1 is closed** — its final review came back not approved in both halves (one Critical, four Important, five Minor), all fixed in one dispatch plus one residual round (`7f7ae410`, `9b3c5ccf`), and the controller's closeout corrects two documents the review never opened.
- **The Critical was CI's** — nothing built the fixture, so the parity gate was red on any clean checkout and the registered `control-set` capture unreachable; both workflows now build it after the editor build, unchained from `npm run build`.
- **The plan's Tasks 1–2 reconciliation repeated ADR 0040's stale claim** that `--stage`, `--hdr` and `--edge-2` "arrive with their first consumers"; they were declared by Task 3, and the line now says so.
- **§13.1 now discloses that the hover assertion reads graphite alone** — the adjacent contrast clause says "in all six palettes", so the silence read as parity.
- **The plan gains a delivered-state reconciliation for Tasks 3–4** — what landed, which layer proves what, and the known limits — so the ledger's record survives its workspace.

## Next

1. **Plan 2 — the shell and the rail** — activates now, with its own ledger and workspace.
2. **Then the inspector, the panes, settings, then iconography and copy.**
3. **Every queued plan links plan 1's file**, so it stays in `docs/superpowers/plans/` rather than moving to the archive.
4. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **Two palette defects are pinned, not fixed** — vg-200 (the resting `--edge` boundary, 2.15:1 in graphite and 1.42:1 in light) and vg-201 (`--warn` text, 1.4–2.0:1 in ember, moss and plum) — so the gate is green with a measured floor under each, and §5's ratios do not hold there until they are ruled on.
- **`vg-135`, `vg-175` and `vg-196` can still redden a run**, so the broad gate cannot be read as green while they can fire.
- **`vg-174` is the LAN move's open row** — a GET landing while a move is in flight can leave the host never listening again; reasoned from the code, not reproduced.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright — the parity spec included.
