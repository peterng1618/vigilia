# Vigilia status

Updated: 2026-10-18
Branch: `develop`

## Current objective

Give every display client its own theme: `docs/superpowers/plans/2026-10-18-per-display-themes.md` (register `vg-574`) is active and lands before the theme store. The backlog drain resumes when its Phase 1 stops. Editor redesign contract: [spec](docs/superpowers/specs/2026-10-08-editor-design-language-design.md), [DESIGN.md](DESIGN.md), and [checked drawings](docs/design/mockups/README.md).

## Active work

- **Active plan:** `2026-10-18-per-display-themes.md` — [plan](docs/superpowers/plans/2026-10-18-per-display-themes.md), [spec](docs/superpowers/specs/2026-10-18-per-display-themes-design.md); execution ledger `.superpowers/sdd/2026-10-18-per-display-themes/progress.md`.
- **Phase 1 is active** (Tasks 1.1–1.8: the display record, its credential, pairing, the one-time code, the host's own monitors), made active by the user's 2026-10-18 ruling; Tasks 1.1–1.6 are closed and the pre-flight scan plus the review loops ruled R1–R25 into the ledger.
- **The backlog drain is suspended, not closed**: `2026-10-12-the-backlog-drain.md` resumes at Task 23.4, and its Phase 23 stays mid-phase with no seat running.
- Plan queue after this: `2026-10-18-theme-store.md` (its phase A only — B–G each need their own plan, G before C), then the panel work; the colour/gradient spec is unreviewed and unplanned.
- Recorded objectives rather than queued plans: a **native player app**, the only path to real device brightness (`vg-583`), and a **TURZX panel display** ([rough capture](docs/superpowers/specs/2026-10-18-turzx-panel-displays-design.md)), both sequenced after the theme store.
- Last census at `d4147298`: 129 open, 38 parked, 93 homeless, 56 homeless and unparked; `vg-538`'s parking makes that census historical — re-derive before quoting current totals.

## Last completed change

- Task 1.6 landed (commit `1e99f5f5`, controller `7e909469`): `GET /api/host` answers `{ id, name, port }` to an unpaired caller, registered before every guard, with the port read from the listening socket and `Access-Control-Allow-Origin: *` on that one response; `main.ts` reads-or-mints the record and passes it (R19's second half).
- Its review approved it by construction rather than by a passing test: the route sits before the display guard in the source, its body names three fields literally instead of spreading the record, and `sendJson` is byte-identical to base, so no shared writer grew a CORS parameter (R25).
- Rulings R23–R25: with no `host` option the route is not registered at all, so nothing is fabricated and no pre-existing case had to move; the name stays one character from `/api/hosting` because the spec publishes it and the re-find probe is built against it; and the CORS header is that route's alone.
- Two Minors were cleaned by the controller in `7e909469` (the same why stated in the route's comment and the option's docblock) and two are carried to the final review: the new block's `afterEach` dereferencing a server `build()` may never have assigned, and the report's stale line citations.
- Unverified and named: `main.ts` has no unit test and was not run as a real host, so the record reaching a live server rests on typecheck and reading — the phase gate closes it with a real `node packages/host/bin/vigilia.js --no-browser` and a read of `/api/host`.

## Next

1. Task 1.7 (the host's own monitors) is next; it produces the monitor list, the record hint and the launch line, and its brief states the boundary itself — it opens nothing, and the launch is Task 1.8's.
2. Review every task against its brief and evidence; run the phase gate with the exit code and the browser results named separately, plus a real `node packages/host/bin/vigilia.js --no-browser` and a read of `/api/host`, which is what closes Task 1.6's unverified `main.ts` wiring.
3. Resume the drain at Task 23.4 when per-display Phase 1 stops, then the theme store's phase A; resume Phase 21 after font-picker spec approval and Phase 12 after settings-pane spec review.
4. Re-home unparked rows carried only by closed phases; never treat a mention as a live implementation home.
5. Revisit redesign's final acceptance item after carrying rows land; propagate ruled acceptance text before closing `vg-390`.

## Blockers / unverified

- User review pending: [theme store](docs/superpowers/specs/2026-10-12-theme-store-design.md), [settings pane](docs/superpowers/specs/2026-10-16-settings-pane-design.md), [colour and gradient rebuild](docs/superpowers/specs/2026-10-12-colour-and-gradient-rebuild-design.md) and [font-picker keyboard model and budget](docs/superpowers/specs/2026-10-17-font-picker-keyboard-design.md); [display capabilities](docs/superpowers/specs/2026-10-18-display-capabilities-design.md) is **approved 2026-10-18 as panel-only** — no observable effect until a panel exists, so it is a phase of the panel work after this plan's Phase 1 creates the record it hangs on — and per-display itself is approved by the user's ruling to execute it.
- Decisions remain for `vg-546`, `vg-559`, `vg-350`, `vg-354` and `vg-191` (whose fixture Task 25.7 made unraisable, so it is the user's to withdraw or re-point rather than an agent's), and Phase 20 carried `vg-556` without closing it — do not invent approval or edit AGENTS.md.
- Phase 25 is complete but nothing in it ran on a physical phone, so every iOS and Android statement there is documentation; `vg-582`, `vg-588` and `vg-589` stay open, and `vg-587`'s handoff is that the secure origin is real but nothing advertises it — the printed pairing link, LAN banner, console pairing link, revoke curl, `hosting-client.ts`'s `displayUrl` and `publish-control.tsx`'s phone address all still print `http://`, and this plan's spec and plan still assert the host has no TLS, the user having ruled those surfaces belong to it.
- `vg-023`'s cancelled review needs an explicit user request to restart and `vg-370`'s resize refusal stays unestablished; `gate` runs unit tests rather than Playwright, so browser proof needs rebuilt bundles, one worker and each run's own JSON report.
- `vg-595` makes that proof unreliable rather than merely slow — the shared 4174 preview reuses an existing server, so a proof can be served by another worktree's `dist` and read green, as it did — and `vg-590` is the second file to redden that way, two being where "the box was busy" stops explaining one case; the editor e2e gate is red at the head on `publish-loop.spec.ts:402` (`vg-604`), a case that fails alone as well as with both specs and whose attribution is not established — Task 1.4's fix round then ran those same two specs together and read exit 0 with 6 passed, which is a second sample and not a resolution, since `vg-595` says the shared preview can be served by another worktree's `dist`, and the harness itself deletes the running host's lock mid-run (`vg-615`), which is why Task 1.5's `main.ts` wiring has no in-repo regression test; no push is authorised, `develop` remains ahead of `origin/develop`, and local work plus untracked SDD records are preserved — and five Task 1.2 commits end with `Co-Authored-By: Claude Fable 5.0`, a string naming no real model from a garbled dispatch line of mine, left unamended because the ledger and every review package cite those shas, so it is the user's call.
