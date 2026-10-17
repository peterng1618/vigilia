# Vigilia status

Updated: 2026-10-17
Branch: `develop`

## Current objective

Drain `docs/product/backlog.jsonl` through the active Superpowers plan. Editor redesign contract: [spec](docs/superpowers/specs/2026-10-08-editor-design-language-design.md), [DESIGN.md](DESIGN.md), and [checked drawings](docs/design/mockups/README.md).

## Active work

- **Active plan:** `2026-10-12-the-backlog-drain.md` — [plan](docs/superpowers/plans/2026-10-12-the-backlog-drain.md); execution ledger: `.superpowers/sdd/2026-10-12-the-backlog-drain/progress.md`.
- Phase 25 is active: the user's five 2026-10-17 reports (vg-568–vg-572), which they ordered ahead of Phase 22's remainder the same day; Tasks 25.1–25.3 are closed (vg-570, vg-569, vg-568, vg-576) and 25.4–25.8 remain. Phase 22 is suspended with Tasks 22.1–22.5 closed (vg-147, vg-150, vg-192, vg-167, vg-168) and 22.6–22.10 pending, and it resumes after Phase 25. Phases 0–11 and 13–20 are closed; Phase 12, Phase 21 and Phase 22 are suspended, not closed; Phase 23 is queued.
- Phase 21 owes only Task 21.9 Step 3: font-picker keyboard implementation after user spec review and the separate `TAB_BOUND` ruling. Suspension changes scheduling, not either decision.
- **Plan queue, in order:** [`2026-10-18-per-display-themes.md`](docs/superpowers/plans/2026-10-18-per-display-themes.md) (its [spec](docs/superpowers/specs/2026-10-18-per-display-themes-design.md) is unreviewed; four phases and twenty tasks, and the store's assign action is its Task 4.4), then [`2026-10-18-theme-store.md`](docs/superpowers/plans/2026-10-18-theme-store.md) (the store spec's phase A only — B–G each need their own plan, G before C). The colour/gradient spec is still unreviewed and has no plan.
- Register rulings and parked markers live on rows; ledger records completions/rulings, and `dispatch-*.md` records running seats. One phase and one implementation seat at a time.
- Last census at `d4147298`: 129 open, 38 parked, 93 homeless, 56 homeless and unparked; subsequent `vg-538` parking makes that census historical. Re-derive before quoting current totals.

## Last completed change

- The phone player gains three tap-revealed chrome controls in its top-right — fullscreen, keep-awake and a dimmer — and no settings modal, which is how the user answered the settings question (`vg-568`, `vg-576`).
- Keep-awake is a re-acquiring loop because the Screen Wake Lock API drops its lock whenever the page is hidden, and the control reports the lock it holds rather than the one it asked for; the dimmer is named as an overlay over the picture, not the screen's own brightness.
- The origin decides whether either works: at the LAN address the client reported `secureContext: false` and `wakeLock: "undefined"`, while `localhost` reported both present — and headless Chromium refused the lock with `NotAllowedError` even on a secure origin, so the refusal path is reachable on https too.
- A review found the composition regression passed with the control in flow: it compared three readings inside one page load, so a permanently in-flow bar shrank the artboard at all three; it now asserts the column's structure absolutely and fails on that break (`vg-581` files the two checks that cannot see an `.html` file).

## Next

1. Execute Phase 25 serially, one seat at a time: 25.4 the chart's edge, 25.5 the phone re-fit, 25.6 the PWA, 25.7 the crop notice and bleed toggle removed, 25.8 the secure origin that gates keep-awake and the PWA.
2. Review each task against its brief and evidence; run phase gate with exit code and browser results named separately.
3. Resume Phase 21 after font-picker spec approval and budget ruling; resume Phase 12 after settings-pane spec review.
4. Re-home unparked rows carried only by closed phases; never treat a mention as a live implementation home.
5. Revisit redesign's final acceptance item after carrying rows land; propagate ruled acceptance text before closing `vg-390`.

## Blockers / unverified

- User review pending: [per-display themes](docs/superpowers/specs/2026-10-18-per-display-themes-design.md), [theme store](docs/superpowers/specs/2026-10-12-theme-store-design.md), [settings pane](docs/superpowers/specs/2026-10-16-settings-pane-design.md), [colour and gradient rebuild](docs/superpowers/specs/2026-10-12-colour-and-gradient-rebuild-design.md) and [font-picker keyboard model and budget](docs/superpowers/specs/2026-10-17-font-picker-keyboard-design.md); decisions remain for `vg-546`, `vg-559`, `vg-350` and `vg-354`, and Phase 20 carried `vg-556` without closing it — do not invent approval or edit AGENTS.md.
- Phase 25 owns the five 2026-10-17 user reports (`vg-568`–`vg-572`) and none is yet reproduced in a browser; `vg-576` is ruled (no settings modal — keep-awake, brightness and fullscreen are chrome) and `vg-577` makes the player an installable PWA, whose first write into the watched `host/src/serve/static-path.ts` needs a decision note first; `vg-578` removes the crop notice and the bleed toggle, and its persisted-key question is a data decision to settle with evidence; brightness is a dimming overlay, never device backlight, and every client-support claim is unverified from this environment.
- `vg-580` blocks two of the user's rulings from existing on a phone at all: the host serves plain http, and `navigator.wakeLock` and `navigator.serviceWorker` are both gated on a secure context, so keep-awake and the PWA need an https origin; `localhost` is secure, so a proof run there proves nothing about the phone it is for. Full browser suite's prior reds remain register-owned; `gate` runs unit tests, not Playwright. Browser proof needs rebuilt bundles, one worker, and each run's own JSON report.
- `vg-023`'s cancelled review requires explicit user request to restart; Fabric two-paint-context evidence remains controller browser proof. `vg-370` resize refusal remains unestablished.
- No push authorised. `develop` remains ahead of `origin/develop`; preserve local work and untracked SDD records.
