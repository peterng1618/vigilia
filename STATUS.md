# Vigilia status

Updated: 2026-10-19
Branch: `develop`

## Current objective

Give every display client its own theme: `docs/superpowers/plans/2026-10-18-per-display-themes.md` (register `vg-574`) is active and lands before the theme store. **Phases 1 and 2 are complete and gated**; Phase 3 (the answers keyed by display and theme) is next. Editor redesign contract: [spec](docs/superpowers/specs/2026-10-08-editor-design-language-design.md), [DESIGN.md](DESIGN.md), and [checked drawings](docs/design/mockups/README.md).

## Active work

- **Active plan:** `2026-10-18-per-display-themes.md` — [plan](docs/superpowers/plans/2026-10-18-per-display-themes.md), [spec](docs/superpowers/specs/2026-10-18-per-display-themes-design.md); execution ledger `.superpowers/sdd/2026-10-18-per-display-themes/progress.md`.
- **Phase 1 is complete and gated** (Tasks 1.1–1.8: the display record, its credential, pairing, the one-time code, the host's own monitors, the launcher) and **so is Phase 2** (Tasks 2.1–2.2: one theme map keyed by display, and `GET /` resolving the asking display); the pre-flight scans and the review loops have ruled R1–R43 into the ledger and no seat is running.
- **The backlog drain is suspended, not closed**: `2026-10-12-the-backlog-drain.md` resumes at Task 23.4, and its Phase 23 stays mid-phase with no seat running.
- Plan queue after this: `2026-10-18-theme-store.md` (its phase A only — B–G each need their own plan, G before C), then the panel work; the colour/gradient spec is unreviewed and unplanned.
- Recorded objectives rather than queued plans: a **native player app**, the only path to real device brightness (`vg-583`), and a **TURZX panel display** ([rough capture](docs/superpowers/specs/2026-10-18-turzx-panel-displays-design.md)), both sequenced after the theme store.
- Last census at `d4147298`: 129 open, 38 parked, 93 homeless, 56 homeless and unparked; `vg-538`'s parking makes that census historical — re-derive before quoting current totals.

## Last completed change

- Phase 2 closed: Task 2.1 (`38f08c3a`, fix `94113cb0`) made `ActiveThemeStore` one map keyed by display, and Task 2.2 (`678739bd`, fix `596890c3`) made `GET /` resolve the asking display through the new `displayKeyFor`.
- Task 2.2's review approved with no Critical or Important, and its fix round closed a real hole: the brief's case-6 combination — LAN, `?display=<local>`, no credential — was asserted nowhere, so a narrow loosening of the loopback-only read passed every test the task had.
- The Phase 2 gate: `npm run gate` exit 0 (271 files, **3647 tests**) and `backlog:check` exit 0; a real host on a temp app dir paired a real display and answered `/` per caller — loopback got the default's theme, the paired display over the LAN got its own, and a LAN client naming `this-pc` was refused 403.
- Its rendered half, origin named: one host, one browser, `http://127.0.0.1:5401/` rendered `日付 Oct Mon` and `http://192.168.2.56:5401/?session=…` rendered `日付 10月 月`, with zero console messages. The LAN bind was for that one probe and is stopped.
- Rulings R41–R43 from the Phase 3 pre-flight scan: Task 3.1's missing call sites, the `theme-answers.json` migration, and Task 3.2 owning the per-display fan-out it never had.

## Next

1. **Phase 3 is next, starting at Task 3.1** (the answers keyed by display and theme); R41–R43 re-scoped both its tasks, so re-extract the briefs from the plan before dispatching rather than reusing an older copy, and note Task 3.2 now owns the per-display fan-out — the connection carries its display, `tick()` samples once per distinct assignment, and providers take the assignment instead of holding one set by `setAssignment`.
3. Phase 4 carries the sighting pair (R40): a local display's window must name itself on a repeating request or the killed-host orphan cannot be told from a display with no window; Review Focus 9's "loses nothing to the other" is still owed.
3. Resume the drain at Task 23.4 when per-display Phase 1 stops, then the theme store's phase A; resume Phase 21 after font-picker spec approval and Phase 12 after settings-pane spec review.
4. Re-home unparked rows carried only by closed phases; never treat a mention as a live implementation home.
5. Revisit redesign's final acceptance item after carrying rows land; propagate ruled acceptance text before closing `vg-390`.

## Blockers / unverified

- User review pending: [theme store](docs/superpowers/specs/2026-10-12-theme-store-design.md), [settings pane](docs/superpowers/specs/2026-10-16-settings-pane-design.md), [colour and gradient rebuild](docs/superpowers/specs/2026-10-12-colour-and-gradient-rebuild-design.md) and [font-picker keyboard model and budget](docs/superpowers/specs/2026-10-17-font-picker-keyboard-design.md); [display capabilities](docs/superpowers/specs/2026-10-18-display-capabilities-design.md) is **approved 2026-10-18 as panel-only** — no observable effect until a panel exists, so it is a phase of the panel work after this plan's Phase 1, which has now created the record it hangs on — and per-display itself is approved by the user's ruling to execute it.
- Decisions remain for `vg-546`, `vg-559`, `vg-350`, `vg-354` and `vg-191` (whose fixture Task 25.7 made unraisable, so it is the user's to withdraw or re-point rather than an agent's), and Phase 20 carried `vg-556` without closing it — do not invent approval or edit AGENTS.md.
- Phase 25 is complete but nothing in it ran on a physical phone, so every iOS and Android statement there is documentation; `vg-582`, `vg-588` and `vg-589` stay open, and `vg-587`'s handoff is that the secure origin is real but nothing advertises it — the printed pairing link, LAN banner, console pairing link, revoke curl, `hosting-client.ts`'s `displayUrl` and `publish-control.tsx`'s phone address all still print `http://`, and this plan's spec and plan still assert the host has no TLS, the user having ruled those surfaces belong to it.
- `vg-023`'s cancelled review needs an explicit user request to restart and `vg-370`'s resize refusal stays unestablished; `gate` runs unit tests rather than Playwright, so browser proof needs rebuilt bundles, one worker and each run's own JSON report; **Phase 1's gate names three things it did not verify** — `POST /api/displays/autostart` was never called, because registering a sign-in task changes the user's machine, so the Windows `schtasks` path has still never run; the killed-host orphan cannot be told from a display with no window until a window names itself (R35); and the host's SIGTERM path was not exercised, because `Stop-Process` on Windows terminates without running a handler; **Phase 2's gate adds two** — a display's own entry was hand-written into `active-theme.json` because Phase 4 owns the route that writes one, and the per-display *assignment* still has no path to a display at all (R43, Task 3.2).
- `vg-595` makes that proof unreliable rather than merely slow — the shared 4174 preview reuses an existing server, so a proof can be served by another worktree's `dist` and read green, as it did — and `vg-590` is the second file to redden that way, two being where "the box was busy" stops explaining one case; the editor e2e gate is red at the head on `publish-loop.spec.ts:402` (`vg-604`), a case that fails alone as well as with both specs and whose attribution is not established — Task 1.4's fix round then ran those same two specs together and read exit 0 with 6 passed, which is a second sample and not a resolution, since `vg-595` says the shared preview can be served by another worktree's `dist`, and the harness itself deletes the running host's lock mid-run (`vg-615`), which is why Task 1.5's `main.ts` wiring has no in-repo regression test; no push is authorised, `develop` remains ahead of `origin/develop`, and local work plus untracked SDD records are preserved — and five Task 1.2 commits end with `Co-Authored-By: Claude Fable 5.0`, a string naming no real model from a garbled dispatch line of mine, left unamended because the ledger and every review package cite those shas, so it is the user's call.
