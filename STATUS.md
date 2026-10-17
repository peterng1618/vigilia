# Vigilia status

Updated: 2026-10-18
Branch: `develop`

## Current objective

Drain `docs/product/backlog.jsonl` through the active Superpowers plan. Editor redesign contract: [spec](docs/superpowers/specs/2026-10-08-editor-design-language-design.md), [DESIGN.md](DESIGN.md), and [checked drawings](docs/design/mockups/README.md).

## Active work

- **Active plan:** `2026-10-12-the-backlog-drain.md` — [plan](docs/superpowers/plans/2026-10-12-the-backlog-drain.md); execution ledger: `.superpowers/sdd/2026-10-12-the-backlog-drain/progress.md`.
- Phase 25 is active: the user's five 2026-10-17 reports (vg-568–vg-572), which they ordered ahead of Phase 22's remainder the same day; Tasks 25.1–25.5 are complete (vg-570, vg-569, vg-568, vg-576 and vg-571 closed; vg-572 corrected and left open, waiting on Task 25.7) and 25.6–25.8 remain. Phase 22 is suspended with Tasks 22.1–22.5 closed (vg-147, vg-150, vg-192, vg-167, vg-168) and 22.6–22.10 pending, and it resumes after Phase 25. Phases 0–11 and 13–20 are closed; Phase 12, Phase 21 and Phase 22 are suspended, not closed; Phase 23 is queued.
- Phase 21 owes only Task 21.9 Step 3: font-picker keyboard implementation after user spec review and the separate `TAB_BOUND` ruling. Suspension changes scheduling, not either decision.
- **Plan queue, in order:** [`2026-10-18-per-display-themes.md`](docs/superpowers/plans/2026-10-18-per-display-themes.md) (its [spec](docs/superpowers/specs/2026-10-18-per-display-themes-design.md) is unreviewed; four phases and twenty tasks, and the store's assign action is its Task 4.4), then [`2026-10-18-theme-store.md`](docs/superpowers/plans/2026-10-18-theme-store.md) (the store spec's phase A only — B–G each need their own plan, G before C). The colour/gradient spec is still unreviewed and has no plan. A **native player app** is a recorded objective rather than a queued plan — it is the only path to real device brightness, which no browser or PWA can set (`vg-583`). A **TURZX panel display** is a second recorded objective, with its own [rough capture](docs/superpowers/specs/2026-10-18-turzx-panel-displays-design.md) written 2026-10-18 so the protocol research is not lost: long-term roadmap only, unplanned and unapproved, and the 2026-10-18 search found that the protocol is **Lian Li's as well as TURZX's**, that no JS/TS implementation of it exists, and that its real blocker is the host's missing renderer rather than DES.
- Register rulings and parked markers live on rows; ledger records completions/rulings, and `dispatch-*.md` records running seats. One phase and one implementation seat at a time.
- Last census at `d4147298`: 129 open, 38 parked, 93 homeless, 56 homeless and unparked; subsequent `vg-538` parking makes that census historical. Re-derive before quoting current totals.

## Last completed change

- The TURZX capture now records that **the protocol is Lian Li's too**: HydroShift II (`1CBE:A021`), Lancool 207 (`1CBE:A065`) and the TURZX TUR_USB family share vendor `0x1cbe` and a byte-identical 500→512 DES-CBC header, key = IV = `slv3tuzx`, so one implementation serves both vendors.
- Its claim that DES-CBC makes the fast family "awkward" is **refuted by measurement**: `node --openssl-legacy-provider` encrypts the 500-byte header to exactly the 504 bytes both implementations' constants expect, so the missing host renderer is the whole of the reason this is long-term.
- The reuse gate's ecosystem rungs are now **run**: `slv3tuzx` returns zero TypeScript and zero JavaScript files on GitHub, so no JS/TS implementation exists to depend on, and every L-Connect replacement found (Rust, Go, C#, Python, PowerShell) renders its own scene model.
- Not verified and recorded as such: the Universal Screen 8.8", Vision 9.2" and Flex LCD rows are **inferred** from `casehud`'s grouping rather than read from a protocol document, and whether the host's own launch path can carry `--openssl-legacy-provider` was not investigated.

## Next

1. Execute Phase 25 serially, one seat at a time, in the plan's own order: 25.7 the crop notice and bleed toggle removed (which is also the event that closes vg-572), then 25.8 the secure origin that gates keep-awake and the PWA, then 25.6 the PWA — 25.8 runs before 25.6 because a service worker needs a secure context, and nothing orders 25.6 against 25.7.
2. Review each task against its brief and evidence; run phase gate with exit code and browser results named separately.
3. Resume Phase 21 after font-picker spec approval and budget ruling; resume Phase 12 after settings-pane spec review.
4. Re-home unparked rows carried only by closed phases; never treat a mention as a live implementation home.
5. Revisit redesign's final acceptance item after carrying rows land; propagate ruled acceptance text before closing `vg-390`.

## Blockers / unverified

- User review pending: [per-display themes](docs/superpowers/specs/2026-10-18-per-display-themes-design.md), [theme store](docs/superpowers/specs/2026-10-12-theme-store-design.md), [settings pane](docs/superpowers/specs/2026-10-16-settings-pane-design.md), [colour and gradient rebuild](docs/superpowers/specs/2026-10-12-colour-and-gradient-rebuild-design.md) and [font-picker keyboard model and budget](docs/superpowers/specs/2026-10-17-font-picker-keyboard-design.md); decisions remain for `vg-546`, `vg-559`, `vg-350` and `vg-354`, and Phase 20 carried `vg-556` without closing it — do not invent approval or edit AGENTS.md.
- Phase 25 owns the five 2026-10-17 user reports (`vg-568`–`vg-572`); `vg-568`–`vg-571` are closed on browser runs at a 412x839 viewport and `vg-572` is corrected rather than closed — Task 25.5 drove a viewport height change and refuted the viewport as the mechanism, since a width-limited composition cannot move horizontally at all, while the crop strip still takes room by design and moved the composition 30.61 px in that task's own recording, so the row now names `player/src/chrome.ts` and waits on Task 25.7; no run has used a physical phone, and whether Chrome Android resolves `height:100%` against the small or the large viewport stays unmeasured; `vg-582`, filed by Task 25.4, is open with no phase owning it; `vg-576` is ruled (no settings modal — keep-awake, brightness and fullscreen are chrome) and `vg-577` makes the player an installable PWA, whose first write into the watched `host/src/serve/static-path.ts` needs a decision note first; `vg-578` removes the crop notice and the bleed toggle, and its persisted-key question is a data decision to settle with evidence; brightness is a dimming overlay, never device backlight, and every client-support claim is unverified from this environment.
- `vg-580` blocks two of the user's rulings from existing on a phone at all: the host serves plain http, and `navigator.wakeLock` and `navigator.serviceWorker` are both gated on a secure context, so keep-awake and the PWA need an https origin; `localhost` is secure, so a proof run there proves nothing about the phone it is for. Full browser suite's prior reds remain register-owned; `gate` runs unit tests, not Playwright. Browser proof needs rebuilt bundles, one worker, and each run's own JSON report.
- `vg-023`'s cancelled review requires explicit user request to restart; Fabric two-paint-context evidence remains controller browser proof. `vg-370` resize refusal remains unestablished.
- No push authorised. `develop` remains ahead of `origin/develop`; preserve local work and untracked SDD records.
