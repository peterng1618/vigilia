# Vigilia status

Updated: 2026-10-21
Branch: `develop`

## Current objective

Give every display client its own theme, then let a person browse the themes it holds: `2026-10-18-per-display-themes.md` is **complete, reviewed and archived**, and `2026-10-18-theme-store.md`'s phase A is closed with its spec **accepted 2026-10-21**. **The store spec's phases B and G are implemented, reviewed and closed** by `2026-10-21-theme-store-origin-and-style.md`; C–F remain, each needing its own plan and an external gate. Editor redesign contract: [spec](docs/superpowers/specs/2026-10-08-editor-design-language-design.md), [DESIGN.md](DESIGN.md), [checked drawings](docs/design/mockups/README.md). **The backlog drain has no executable work left.**

## Active work

- **No plan is active.** The theme-store origin-and-style plan closed 2026-10-21 on a final whole-branch review returning **PASS, no BLOCKING**; its one SHOULD-FIX was discharged in `eaf765e4` and both residual findings are filed as `vg-688` and `vg-689`.
- Its ledger, rulings R1–R40, briefs and the review report stay at `.superpowers/sdd/2026-10-21-theme-store-origin-and-style/`, kept rather than deleted like every sibling workspace.
- C–F cannot start: C needs a public catalogue repo and an Action, D is gated on open question 1, E needs D and a registered OAuth app, F needs E and the ffmpeg licence read.
- **The drain has no executable work left** — Phase 12 and Task 21.9 Step 3 wait on the user's spec reviews, Task 22.7 cannot run as written, and Phase 24 is gated on spec acceptance; its ledger is `.superpowers/sdd/2026-10-12-the-backlog-drain/progress.md`.
- Plan queue: the store spec's C–F in their own plans, then the panel work; the colour/gradient spec is unreviewed and unplanned. Recorded objectives rather than queued plans: a **native player app** (`vg-583`) and a **TURZX panel display**, both sequenced after the store.

## Last completed change

- **The theme-store plan closed** — eight tasks, a boundary, one seat at a time in the main `develop` checkout, every task reviewed with its own fix rounds, and a final whole-branch review on the most capable model returning **PASS, no BLOCKING**.
- **Its one SHOULD-FIX discharged**: `docs/architecture/ownership.md` gains the two rows this plan's new owners were missing — `editor/src/theme-tag-seed.ts` (`THEME_TAG_SEED`) and `host/src/settings/theme-origins.ts`.
- **Two rows filed rather than fixed**: `vg-688` (the accepted spec still calls the badge *Installed* at three lines, Acceptance B among them, where the shipped word is the drawing's *From the store*) and `vg-689` (`ThemeOrigin` is declared twice with nothing keeping the two in step, so a host-side rename renders `From the store · undefined · undefined` with every test green).
- **Evidence**: `npm run gate` exit 1 at the pre-existing `design:check` ceiling (`vg-626`) with the five steps before it green; `typecheck` exit 0, the suite exit 0 at **289 files / 3980 tests**, `backlog:check` exit 0 at 689 items; the boundary's four claims rendered in Chromium with four red-proofs restored by `cmp`, one of them re-run independently by the final reviewer.
- **Six rows now stand from this plan** — `vg-684` through `vg-689`.

## Next

1. **Pick the next plan**: C–F cannot start, the drain has nothing runnable, and what remains queued is the panel work and an unreviewed colour/gradient spec — so the next move is a user decision.
2. Decide whether `vg-626` (the red `design:check`) blocks the next plan as it did the per-display close; `vg-620` is the next to weigh, since a client disconnecting mid-stream kills the host.
3. User review pending: [settings pane](docs/superpowers/specs/2026-10-16-settings-pane-design.md), [colour and gradient rebuild](docs/superpowers/specs/2026-10-12-colour-and-gradient-rebuild-design.md) and [font-picker keyboard model](docs/superpowers/specs/2026-10-17-font-picker-keyboard-design.md); decisions remain for `vg-546`, `vg-559`, `vg-350`, `vg-354` and `vg-191`.
4. `vg-688` asks for a spec edit and `vg-689` for a guard on a duplicated wire type; both are rulings rather than tasks, so both are yours.
5. Resume Phase 21 after font-picker spec approval and Phase 12 after settings-pane spec review; the panel work sits behind the store's remaining phases.

## Blockers / unverified

- **`npm run gate` is RED at `design:check`** and the closed plan records it as a named exception, never as a passed gate: the design-token remainder is 20 against its ceiling of 19, none of the 20 being a file that plan touched, and every other step exits 0 alone; raising `remainderCeiling` is the one move the instrument exists to refuse (`vg-626`, `vg-426`).
- **The gate is also red at random, which is older than any plan here** — `vg-661` names a full-suite timeout two runs answered differently, and `vg-595` records the shared preview serving another worktree's `dist`, so a red sample is not evidence until it is attributed.
- **The provenance feature is drawn rather than reachable**: `ThemeOriginsStore.write` has no production caller, so no origin record can exist until phase D installs a theme, and nothing in this plan has been seen on a physical device.
- **`vg-685` and `vg-686` are known holes rather than oversights**: no copy test reads the badge or the provenance line because they are plain spans, and three controls commit a draft without the composing guard, so an IME's Enter commits a half-typed string there.
- **Earlier plans' carried limits are not repeated here** — each lives in its own ledger under `.superpowers/sdd/`, including the unverified surfaces Phase 25 never ran on a physical phone, the glass fix proved in desktop Chromium only, and `vg-582`, `vg-588` and `vg-589` which stay open.
