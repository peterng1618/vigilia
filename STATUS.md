# Vigilia status

Updated: 2026-10-17
Branch: `develop`

## Current objective

Drain `docs/product/backlog.jsonl` through the active Superpowers plan. Editor redesign contract: [spec](docs/superpowers/specs/2026-10-08-editor-design-language-design.md), [DESIGN.md](DESIGN.md), and [checked drawings](docs/design/mockups/README.md).

## Active work

- **Active plan:** `2026-10-12-the-backlog-drain.md` — [plan](docs/superpowers/plans/2026-10-12-the-backlog-drain.md); execution ledger: `.superpowers/sdd/2026-10-12-the-backlog-drain/progress.md`.
- Phase 25 is active: the user's five 2026-10-17 reports (vg-568–vg-572), which they ordered ahead of Phase 22's remainder the same day; Phase 22 is suspended with Tasks 22.1–22.5 closed (vg-147, vg-150, vg-192, vg-167, vg-168) and 22.6–22.10 pending, and it resumes after Phase 25. Phases 0–11 and 13–20 are closed; Phase 12, Phase 21 and Phase 22 are suspended, not closed; Phase 23 is queued.
- Phase 21 owes only Task 21.9 Step 3: font-picker keyboard implementation after user spec review and the separate `TAB_BOUND` ruling. Suspension changes scheduling, not either decision.
- Phase 24's store and colour/gradient work retains user priority; the store spec is revised for acceptance and the colour/gradient one is not, and each needs its own plan before implementation.
- Register rulings and parked markers live on rows; ledger records completions/rulings, and `dispatch-*.md` records running seats. One phase and one implementation seat at a time.
- Last census at `d4147298`: 129 open, 38 parked, 93 homeless, 56 homeless and unparked; subsequent `vg-538` parking makes that census historical. Re-derive before quoting current totals.

## Last completed change

- The store's gallery is one cell box for both halves — 2/1 picture, 26px facts band, a 272px minimum derived from the online half — so switching tabs cannot change the grid's shape.
- Ruling 9 amended: the item modal is a viewer, 960px with a fixed stage the theme is contained in, and the facts are pills in three groups instead of a row each.
- Four drawings updated, `store-detail.html` redrawn; drawings gate and parity exit 0, 34 passed.

## Next

1. Execute Phase 25 serially, one seat at a time: 25.1 the greyed layer footer, 25.2 the banner's three-second clear, 25.3 the fullscreen control, 25.4 the chart's edge, 25.5 the phone re-fit.
2. Review each task against its brief and evidence; run phase gate with exit code and browser results named separately.
3. Resume Phase 21 after font-picker spec approval and budget ruling; resume Phase 12 after settings-pane spec review.
4. Re-home unparked rows carried only by closed phases; never treat a mention as a live implementation home.
5. Revisit redesign's final acceptance item after carrying rows land; propagate ruled acceptance text before closing `vg-390`.

## Blockers / unverified

- User review pending: [theme store](docs/superpowers/specs/2026-10-12-theme-store-design.md), [settings pane](docs/superpowers/specs/2026-10-16-settings-pane-design.md), [colour and gradient rebuild](docs/superpowers/specs/2026-10-12-colour-and-gradient-rebuild-design.md) and [font-picker keyboard model and budget](docs/superpowers/specs/2026-10-17-font-picker-keyboard-design.md); decisions remain for `vg-546`, `vg-559`, `vg-350` and `vg-354`, and Phase 20 carried `vg-556` without closing it — do not invent approval or edit AGENTS.md.
- Phase 25 owns the five 2026-10-17 user reports (`vg-568`–`vg-572`) and none is yet reproduced in a browser; `vg-576` files the display-client settings panel and keep-awake request, which needs a spec before any task, and its browser support claims are unverified from this environment.
- Full browser suite's prior reds remain register-owned; `gate` runs unit tests, not Playwright. Browser proof needs rebuilt bundles, one worker, and each run's own JSON report.
- `vg-023`'s cancelled review requires explicit user request to restart; Fabric two-paint-context evidence remains controller browser proof. `vg-370` resize refusal remains unestablished.
- No push authorised. `develop` remains ahead of `origin/develop`; preserve local work and untracked SDD records.
