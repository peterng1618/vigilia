# Vigilia status

Updated: 2026-10-21
Branch: `develop`

## Current objective

Give every display client its own theme, then let a person browse the themes it holds: `2026-10-18-per-display-themes.md` is **complete, reviewed and archived**, and `2026-10-18-theme-store.md`'s phase A is closed with its spec **accepted 2026-10-21**. **The store spec's phases B and G are implemented** by `2026-10-21-theme-store-origin-and-style.md`, whose final whole-branch review is the last thing outstanding; C–F remain, each needing its own plan and an external gate. Editor redesign contract: [spec](docs/superpowers/specs/2026-10-08-editor-design-language-design.md), [DESIGN.md](DESIGN.md), [checked drawings](docs/design/mockups/README.md). **The backlog drain has no executable work left.**

## Active work

- **Active plan:** `docs/superpowers/plans/2026-10-21-theme-store-origin-and-style.md` — all eight tasks complete, the boundary's four rendered claims holding at `c3534272`, and the **final whole-branch review in flight**; rulings R1–R40 in `.superpowers/sdd/2026-10-21-theme-store-origin-and-style/progress.md`.
- Its scope is **B and G only**: provenance (the `theme-origins.json` consumer record, the listing's `origin`, the gallery badge, the modal's provenance line) and style tags (`metadata.tags`' shape rule, the Style facet, the editor's pick-or-propose field, the modal's Style group).
- C–F cannot start: C needs a public catalogue repo and an Action, D is gated on open question 1, E needs D and a registered OAuth app, F needs E and the ffmpeg licence read.
- **The drain has no executable work left** — Phase 12 and Task 21.9 Step 3 wait on the user's spec reviews, Task 22.7 cannot run as written, and Phase 24 is gated on spec acceptance; its ledger is `.superpowers/sdd/2026-10-12-the-backlog-drain/progress.md`.
- Plan queue after this one: the store spec's C–F in their own plans, then the panel work; the colour/gradient spec is unreviewed and unplanned.
- Recorded objectives rather than queued plans: a **native player app**, the only path to real device brightness (`vg-583`), and a **TURZX panel display**, both sequenced after the theme store.

## Last completed change

- **Phases B and G of the theme store in one plan** — eight tasks, a boundary, one seat at a time in the main `develop` checkout, and every task reviewed with its own fix rounds where a review found something.
- **Provenance**: the host keeps a `theme-origins.json` consumer record, the listing carries an `origin`, deleting a theme takes its origin with it, and the gallery badges a theme the store supplied — reading **From the store**, the drawing's word, with the modal printing one muted provenance line.
- **Style tags**: `metadata.tags` is a shape rule (`^[a-z0-9-]{1,24}$`, at most five) enforced by the validator and mirrored in the published schema with **no enum anywhere**; the Style facet offers every tag a listing carries; and the editor's field offers the shipped seed, proposing a new tag only when nothing fits.
- **Evidence**: `npm run gate` exit 1 at the pre-existing `design:check` ceiling (`vg-626`) with the five steps before it green; `typecheck` exit 0, the suite exit 0 at **289 files / 3980 tests**, `backlog:check` exit 0 at 687 items; and the boundary's four claims rendered in Chromium with four red-proofs restored by `cmp`.
- **Four rows filed rather than fixed**: `vg-684` (the answers store's removal check walks the prototype chain), `vg-685` (no copy test reads the badge or the provenance line), `vg-686` (three controls keep their own commit path without the composing guard), `vg-687` (a popover is 75% opaque where its drawing is 95%).

## Next

1. **The final whole-branch review's outcome** decides whether this plan closes or takes one fix round.
2. **The store spec's C–F each need their own plan**, and C's is gated on a public catalogue repo and a GitHub Action that do not exist yet.
3. Decide whether `vg-626` (the red `design:check`) blocks the next plan as it did the per-display close; `vg-620` is the next to weigh, since a client disconnecting mid-stream kills the host.
4. User review pending: [settings pane](docs/superpowers/specs/2026-10-16-settings-pane-design.md), [colour and gradient rebuild](docs/superpowers/specs/2026-10-12-colour-and-gradient-rebuild-design.md) and [font-picker keyboard model](docs/superpowers/specs/2026-10-17-font-picker-keyboard-design.md); decisions remain for `vg-546`, `vg-559`, `vg-350`, `vg-354` and `vg-191`.
5. Resume Phase 21 after font-picker spec approval and Phase 12 after settings-pane spec review; the panel work sits behind the store's remaining phases.

## Blockers / unverified

- **`npm run gate` is RED at `design:check`** and this plan's close records it as a named exception, never as a passed gate: the design-token remainder is 20 against its ceiling of 19, none of the 20 being a file this plan touched, and every other step exits 0 alone; raising `remainderCeiling` is the one move the instrument exists to refuse (`vg-626`, `vg-426`).
- **The gate is also red at random, which is older than this plan** — `vg-661` names a full-suite timeout two runs answered differently, and `vg-595` records the shared preview serving another worktree's `dist`, so a red sample is not evidence until it is attributed.
- **The boundary's four claims are browser-proved and everything else in this plan is jsdom-only**, and the phone project skips the store cases — so no claim here has been seen on a physical device.
- **`vg-685` and `vg-686` are known holes rather than oversights**: no copy test reads the badge or the provenance line because they are plain spans, and three controls commit a draft without the composing guard, so an IME's Enter commits a half-typed string there.
- **Earlier plans' carried limits are not repeated here** — each lives in its own ledger under `.superpowers/sdd/`, including the unverified surfaces Phase 25 never ran on a physical phone, the glass fix proved in desktop Chromium only, and `vg-582`, `vg-588` and `vg-589` which stay open.
