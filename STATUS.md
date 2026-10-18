# Vigilia status

Updated: 2026-10-18
Branch: `develop`

## Current objective

Drain `docs/product/backlog.jsonl` through the active Superpowers plan. Editor redesign contract: [spec](docs/superpowers/specs/2026-10-08-editor-design-language-design.md), [DESIGN.md](DESIGN.md), and [checked drawings](docs/design/mockups/README.md).

## Active work

- **Active plan:** `2026-10-12-the-backlog-drain.md` — [plan](docs/superpowers/plans/2026-10-12-the-backlog-drain.md); execution ledger: `.superpowers/sdd/2026-10-12-the-backlog-drain/progress.md`.
- **Phase 22 is active**: Tasks 22.1–22.6, 22.8 and 22.9 are closed (vg-147, vg-150, vg-192, vg-167, vg-168, vg-159, vg-537, vg-417 and vg-418), **22.7 is obstructed and skipped**, and 22.10 is pending. **Phase 25 is complete** — the user's five 2026-10-17 reports, ordered ahead of this phase the same day: Tasks 25.1–25.8 all closed (vg-570, vg-569, vg-568, vg-576, vg-571, vg-578, vg-572, vg-580 and vg-577). Phases 0–11 and 13–20 are closed; Phase 12 and Phase 21 are suspended, not closed; Phase 23 is queued.
- Phase 21 owes only Task 21.9 Step 3: font-picker keyboard implementation after user spec review and the separate `TAB_BOUND` ruling. Suspension changes scheduling, not either decision.
- **Plan queue, in order:** [`2026-10-18-per-display-themes.md`](docs/superpowers/plans/2026-10-18-per-display-themes.md) (its [spec](docs/superpowers/specs/2026-10-18-per-display-themes-design.md) is unreviewed; four phases and twenty tasks, and the store's assign action is its Task 4.4), then [`2026-10-18-theme-store.md`](docs/superpowers/plans/2026-10-18-theme-store.md) (the store spec's phase A only — B–G each need their own plan, G before C). The colour/gradient spec is still unreviewed and has no plan. A **native player app** is a recorded objective rather than a queued plan — it is the only path to real device brightness, which no browser or PWA can set (`vg-583`). A **TURZX panel display** is a second recorded objective, with its own [rough capture](docs/superpowers/specs/2026-10-18-turzx-panel-displays-design.md) written 2026-10-18 so the protocol research is not lost: long-term roadmap only, unplanned and unapproved, and the 2026-10-18 search found that the protocol is **Lian Li's as well as TURZX's**, that no JS/TS implementation of it exists, and that its real blocker is the host's missing renderer rather than DES.
- Register rulings and parked markers live on rows; ledger records completions/rulings, and `dispatch-*.md` records running seats. One phase and one implementation seat at a time.
- Last census at `d4147298`: 129 open, 38 parked, 93 homeless, 56 homeless and unparked; subsequent `vg-538` parking makes that census historical. Re-derive before quoting current totals.

## Last completed change

- The copy walk's two holes are closed (`vg-417`, `vg-418`): `copy()` probes the keyed function over `glassRefusalKinds` — derived from `glassRefusals`, so a kind added to the table is probed without a second list — and the `?` sheet, the publish popover and the two dialogs are each mounted and read.
- The row's second keyed function was stale: `chartFamilyLabels` is `uiCopy.chartFamilies`, so the object walk already collected `Gauge`, `Line`, `Bar` and `Pie` — which is why the fix is one pass, not two.
- Both red proofs are the instrument's own failures rather than counts, and both were reproduced on the integrated tree and restored with `cmp` and a SHA-256: disabling the keyed pass reports `Polyline: expected [ 'Vigilia', 'Editor panes', …(452) ] to include 'A Polyline is an open path, so there …'`, dropping a mount reports `expected [ { …(2) }, { …(2) }, { …(2) } ] to have a length of 4 but got 3`.
- The review found the same defect one paragraph above the fix, for arity: the probe passes one argument, so `panels.artboardOutside` and `draftRecovery.lead` are collected by nothing, and widening the pool cannot close it — a sentence interpolating the theme's own name can never equal a probe's output, so `copy()`'s docblock states the limit and `vg-592` owns the hole.
- The popover is mounted but read for two words only — its warning is a bare `<span>` no reader reads, its trigger carries the `aria-controls` the button rule skips — so the header states the limit and `vg-591` owns it; `vg-593` and `vg-594` are the review's and the seat's other findings.

## Next

1. Close Phase 22 with Task 22.10: a built bundle has no fixture page, and the drawings specs read that as a product regression. **22.7 is obstructed and skipped** — Task 25.7 removed the crop notice, so its fixture can no longer raise both gaps, and `vg-191` waits on the user.
2. Review each task against its brief and evidence; run the phase gate with exit code and browser results named separately.
3. Resume Phase 21 after font-picker spec approval and budget ruling; resume Phase 12 after settings-pane spec review.
4. Re-home unparked rows carried only by closed phases; never treat a mention as a live implementation home.
5. Revisit redesign's final acceptance item after carrying rows land; propagate ruled acceptance text before closing `vg-390`.

## Blockers / unverified

- User review pending: [per-display themes](docs/superpowers/specs/2026-10-18-per-display-themes-design.md), [theme store](docs/superpowers/specs/2026-10-12-theme-store-design.md), [settings pane](docs/superpowers/specs/2026-10-16-settings-pane-design.md), [colour and gradient rebuild](docs/superpowers/specs/2026-10-12-colour-and-gradient-rebuild-design.md) and [font-picker keyboard model and budget](docs/superpowers/specs/2026-10-17-font-picker-keyboard-design.md); decisions remain for `vg-546`, `vg-559`, `vg-350`, `vg-354` and `vg-191` (whose fixture Task 25.7 made unraisable, so it is the user's to withdraw or re-point rather than an agent's), and Phase 20 carried `vg-556` without closing it — do not invent approval or edit AGENTS.md.
- Phase 25 is complete but nothing in it ran on a physical phone: Task 25.5 refuted the viewport and Task 25.7 removed the crop strip, so whether Chrome Android resolves `height:100%` against the small or the large viewport stays unmeasured; `vg-580`'s reading allowlists the root with `--ignore-certificate-errors-spki-list` rather than installing it in an OS trust store; and the install was measured as the navigation an installed launch performs, since no CDP path to Chrome's install UI exists. Every iOS and Android statement in this phase is documentation.
- What Phase 25 left open, all filed: `vg-582` (the overscan gutter, no phase owning it), `vg-588` (an installed app launches into a 403 — the pairing spec's, and `vg-587` points at it) and `vg-589` (the unbounded shell cache). `vg-587` is the handoff itself, and what it hands over is that the secure origin is real but nothing advertises it: the printed pairing link, the LAN banner, the console pairing link and the revoke curl, `hosting-client.ts`'s `displayUrl` and `publish-control.tsx`'s phone address all still print `http://`, and the per-display-themes spec and plan still assert the host has no TLS — the user ruled those surfaces belong to that spec rather than to Phase 25.
- `vg-023`'s cancelled review requires explicit user request to restart; Fabric two-paint-context evidence remains controller browser proof; `vg-370` resize refusal remains unestablished; the full browser suite's prior reds are register-owned, and `gate` runs unit tests rather than Playwright, so browser proof needs rebuilt bundles, one worker and each run's own JSON report. **`vg-590` is the second file to redden this way**: a unit case in `themes/store.test.ts` timed out under a loaded box and passed alone in 2.19 s, `vg-585` being the first — two is where "the box was busy" stops explaining one case and becomes a question about the suite's timeouts.
- No push authorised. `develop` remains ahead of `origin/develop`; preserve local work and untracked SDD records.
