# Vigilia status

Updated: 2026-10-18
Branch: `develop`

## Current objective

Drain `docs/product/backlog.jsonl` through the active Superpowers plan. Editor redesign contract: [spec](docs/superpowers/specs/2026-10-08-editor-design-language-design.md), [DESIGN.md](DESIGN.md), and [checked drawings](docs/design/mockups/README.md).

## Active work

- **Active plan:** `2026-10-12-the-backlog-drain.md` — [plan](docs/superpowers/plans/2026-10-12-the-backlog-drain.md); execution ledger: `.superpowers/sdd/2026-10-12-the-backlog-drain/progress.md`.
- Phase 25 is active: the user's five 2026-10-17 reports (vg-568–vg-572), which they ordered ahead of Phase 22's remainder the same day; Tasks 25.1–25.5, 25.7 and 25.8 are complete (vg-570, vg-569, vg-568, vg-576, vg-571, vg-578, vg-572 and vg-580 closed) and 25.6 remains. Phase 22 is suspended with Tasks 22.1–22.5 closed (vg-147, vg-150, vg-192, vg-167, vg-168) and 22.6–22.10 pending, and it resumes after Phase 25. Phases 0–11 and 13–20 are closed; Phase 12, Phase 21 and Phase 22 are suspended, not closed; Phase 23 is queued.
- Phase 21 owes only Task 21.9 Step 3: font-picker keyboard implementation after user spec review and the separate `TAB_BOUND` ruling. Suspension changes scheduling, not either decision.
- **Plan queue, in order:** [`2026-10-18-per-display-themes.md`](docs/superpowers/plans/2026-10-18-per-display-themes.md) (its [spec](docs/superpowers/specs/2026-10-18-per-display-themes-design.md) is unreviewed; four phases and twenty tasks, and the store's assign action is its Task 4.4), then [`2026-10-18-theme-store.md`](docs/superpowers/plans/2026-10-18-theme-store.md) (the store spec's phase A only — B–G each need their own plan, G before C). The colour/gradient spec is still unreviewed and has no plan. A **native player app** is a recorded objective rather than a queued plan — it is the only path to real device brightness, which no browser or PWA can set (`vg-583`). A **TURZX panel display** is a second recorded objective, with its own [rough capture](docs/superpowers/specs/2026-10-18-turzx-panel-displays-design.md) written 2026-10-18 so the protocol research is not lost: long-term roadmap only, unplanned and unapproved, and the 2026-10-18 search found that the protocol is **Lian Li's as well as TURZX's**, that no JS/TS implementation of it exists, and that its real blocker is the host's missing renderer rather than DES.
- Register rulings and parked markers live on rows; ledger records completions/rulings, and `dispatch-*.md` records running seats. One phase and one implementation seat at a time.
- Last census at `d4147298`: 129 open, 38 parked, 93 homeless, 56 homeless and unparked; subsequent `vg-538` parking makes that census historical. Re-derive before quoting current totals.

## Last completed change

- The host serves a secure origin beside http on the same port, from a local CA it mints itself, so a phone can hold a real screen wake lock and register the service worker Task 25.6 installs into (`vg-580`).
- The reading is at the LAN address and names its client: `https://192.168.2.56:4233`, Chromium 153.0.8010.12, `isSecureContext` true, `wakeLock.request("screen")` granted with `sentinel.type` `screen`, `serviceWorker.register` registered at scope `.../assets/` — never `localhost`, which is the trap the row existed to remove.
- One root is kept at `<settingsDir>/tls/ca.key` (mode 0600, outside the tree) and the leaf is re-issued in memory at every start over every interface address, so a second display installs the same root and a DHCP change costs a restart, not a re-install; `node-forge` 1.4.0 is the one new runtime dependency.
- An independent review found the port's mid-response guard was a no-op over TLS — `request.socket` is a `TLSSocket` while the accepted socket is a raw one — so a LAN move destroyed a response in flight; it is now keyed by the connection's four-tuple, with a TLS mid-response case that fails when the guard is reverted.
- The six surfaces that advertise how to connect are untouched, not even the scheme: the user ruled pairing and connection management belong to the per-display-themes spec, and `vg-587` carries that handoff and the four false spec claims the split left behind.

## Next

1. Execute Phase 25 serially, one seat at a time, in the plan's own order: 25.6 the PWA is the phase's last task, and it starts from the secure origin 25.8 landed.
2. Review each task against its brief and evidence; run phase gate with exit code and browser results named separately.
3. Resume Phase 21 after font-picker spec approval and budget ruling; resume Phase 12 after settings-pane spec review.
4. Re-home unparked rows carried only by closed phases; never treat a mention as a live implementation home.
5. Revisit redesign's final acceptance item after carrying rows land; propagate ruled acceptance text before closing `vg-390`.

## Blockers / unverified

- User review pending: [per-display themes](docs/superpowers/specs/2026-10-18-per-display-themes-design.md), [theme store](docs/superpowers/specs/2026-10-12-theme-store-design.md), [settings pane](docs/superpowers/specs/2026-10-16-settings-pane-design.md), [colour and gradient rebuild](docs/superpowers/specs/2026-10-12-colour-and-gradient-rebuild-design.md) and [font-picker keyboard model and budget](docs/superpowers/specs/2026-10-17-font-picker-keyboard-design.md); decisions remain for `vg-546`, `vg-559`, `vg-350`, `vg-354` and `vg-191` (whose fixture Task 25.7 made unraisable, so it is the user's to withdraw or re-point rather than an agent's), and Phase 20 carried `vg-556` without closing it — do not invent approval or edit AGENTS.md.
- Phase 25 owns the five 2026-10-17 user reports (`vg-568`–`vg-572`); all five are closed, the last of them on a mechanism rather than on a phone: Task 25.5 refuted the viewport and Task 25.7 removed the crop strip, the last strip taking room. No run has used a physical phone, so whether Chrome Android resolves `height:100%` against the small or the large viewport stays unmeasured, and `vg-580`'s reading allowlists the root with `--ignore-certificate-errors-spki-list` rather than installing it in an OS trust store, so every iOS and Android statement here is documentation; `vg-582`, filed by Task 25.4, is open with no phase owning it; `vg-577` makes the player an installable PWA and is Task 25.6, whose first write into the watched `host/src/serve/static-path.ts` needs a decision note first; brightness is a dimming overlay, never device backlight, and every client-support claim is unverified from this environment.
- The secure origin is real but nothing advertises it: the printed pairing link, the LAN banner, the console pairing link and the revoke curl, `hosting-client.ts`'s `displayUrl` and `publish-control.tsx`'s phone address all still print `http://`, and the per-display-themes spec and plan still assert the host has no TLS — `vg-587` is that handoff, and it is the user's ruling that those surfaces belong to that spec rather than to Phase 25.
- `vg-023`'s cancelled review requires explicit user request to restart; Fabric two-paint-context evidence remains controller browser proof; `vg-370` resize refusal remains unestablished; the full browser suite's prior reds are register-owned, and `gate` runs unit tests rather than Playwright, so browser proof needs rebuilt bundles, one worker and each run's own JSON report.
- No push authorised. `develop` remains ahead of `origin/develop`; preserve local work and untracked SDD records.
