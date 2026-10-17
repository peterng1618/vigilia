# Vigilia status

Updated: 2026-10-17
Branch: `develop`

## Current objective

Drain `docs/product/backlog.jsonl` through the active Superpowers plan. Editor redesign contract: [spec](docs/superpowers/specs/2026-10-08-editor-design-language-design.md), [DESIGN.md](DESIGN.md), and [checked drawings](docs/design/mockups/README.md).

## Active work

- **Active plan:** `2026-10-12-the-backlog-drain.md` — [plan](docs/superpowers/plans/2026-10-12-the-backlog-drain.md); execution ledger: `.superpowers/sdd/2026-10-12-the-backlog-drain/progress.md`.
- Phase 22 is active; Tasks 22.1–22.3 are closed (vg-147, vg-150, vg-192); Tasks 22.4–22.10 remain pending. Phases 0–11 and 13–20 are closed; Phase 12 and Phase 21 are suspended, not closed; Phase 23 is queued.
- Phase 21 owes only Task 21.9 Step 3: font-picker keyboard implementation after user spec review and the separate `TAB_BOUND` ruling. Suspension changes scheduling, not either decision.
- Phase 24's store and colour/gradient work retains user priority; the store spec is revised for acceptance and the colour/gradient one is not, and each needs its own plan before implementation.
- Register rulings and parked markers live on rows; ledger records completions/rulings, and `dispatch-*.md` records running seats. One phase and one implementation seat at a time.
- Last census at `d4147298`: 129 open, 38 parked, 93 homeless, 56 homeless and unparked; subsequent `vg-538` parking makes that census historical. Re-derive before quoting current totals.

## Last completed change

- Theme store spec revised 2026-10-17 for acceptance: six user rulings recorded, the three-mode shell folded in, an acceptance section and a six-phase landing order written.
- The store now shows online and local themes together: import lands in the library, the halves are tabs, and install provenance gets its own consumer-state record (`theme-origins.json`).
- Three new checked drawings (`store-themes`, `store-browse`, `host-settings`) and `shell.html`'s header; `npm run gate` exit 0, 264 unit files and 3486 tests, drawings gate exit 0.
- Filed `vg-574` (per-display theme assignment, which lands first) and `vg-575` (Phase 24's acceptance for `vg-388` contradicts the spec's shipping set).

## Next

1. Execute Phase 22 serially: the behavioural proof and fixture repairs, Tasks 22.4–22.10.
2. Review each task against its brief and evidence; run phase gate with exit code and browser results named separately.
3. Resume Phase 21 after font-picker spec approval and budget ruling; resume Phase 12 after settings-pane spec review.
4. Re-home unparked rows carried only by closed phases; never treat a mention as a live implementation home.
5. Revisit redesign's final acceptance item after carrying rows land; propagate ruled acceptance text before closing `vg-390`.

## Blockers / unverified

- User review pending: [theme store](docs/superpowers/specs/2026-10-12-theme-store-design.md), [settings pane](docs/superpowers/specs/2026-10-16-settings-pane-design.md), [colour and gradient rebuild](docs/superpowers/specs/2026-10-12-colour-and-gradient-rebuild-design.md) and [font-picker keyboard model and budget](docs/superpowers/specs/2026-10-17-font-picker-keyboard-design.md); decisions remain for `vg-546`, `vg-559`, `vg-350` and `vg-354`, and Phase 20 carried `vg-556` without closing it — do not invent approval or edit AGENTS.md.
- Four user reports from 2026-10-17 have no phase home: `vg-569` (player banner overlay and three-second clear), `vg-570` (layer footer ruled to greyed commands), `vg-571` (live line-chart edge quantisation) and `vg-572` (`vg-028`'s unmeasured phone-viewport residual); none is reproduced in a browser.
- Full browser suite's prior reds remain register-owned; `gate` runs unit tests, not Playwright. Browser proof needs rebuilt bundles, one worker, and each run's own JSON report.
- `vg-023`'s cancelled review requires explicit user request to restart; Fabric two-paint-context evidence remains controller browser proof. `vg-370` resize refusal remains unestablished.
- No push authorised. `develop` remains ahead of `origin/develop`; preserve local work and untracked SDD records.
