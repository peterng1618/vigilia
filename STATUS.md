# Vigilia status

Updated: 2026-10-22
Branch: `develop`

## Current objective

The theme store spec is **fully landed**: phases A, B, C, D, E, F and G are in, so a person can browse the catalogue, install an item, submit their own, and have a video normalized into the envelope the store accepts. Editor redesign contract: [spec](docs/superpowers/specs/2026-10-08-editor-design-language-design.md), [DESIGN.md](DESIGN.md), [checked drawings](docs/design/mockups/README.md).

## Active work

- **No plan is active.** Phase F closed; `docs/superpowers/plans/2026-10-22-theme-store-media.md` is archived, and its ledger is `.superpowers/sdd/2026-10-22-theme-store-media/progress.md`.
- **Queued, in order:** `2026-10-21-wallpaper-engine-import.md`, then `2026-10-21-asset-finder.md`; the user picks when one starts.
- **The catalogue repo `peterng1618/vigilia-store` is live** and empty: `validate` and `auto-merge` workflows pin the app at a commit, a merge regenerates the listing, and the pin has been proved by a real PR.
- **Decisions `0088`–`0091`** carry the store's measured choices: raw-path index, host-side download, a hand-rolled GitHub client, and a bundled GPL `ffmpeg-static`.
- **Capture `editor-video-normalize`** is the newest registered action; the install and submission captures sit beside it.

## Last completed change

- **Phase F closed** (`2026-10-22-theme-store-media.md`, five tasks): the video envelope as a pure MP4 property check, refused at `validate-item`, at install and at submit.
- **The normalizer** spawns the bundled `ffmpeg-static`, copies a conforming input byte-for-byte, refuses an over-cap source instead of trimming it, and re-probes its own output.
- **The editor** offers `Normalize video` and `Fill the artboard`, previews the result and adopts it only on a second press.
- **Three review passes**: the caps were bypassable by a zeroed `mdhd` timescale or a doubled duration, then a zero `stts` delta regressed the same way; all three are closed and red-proved.
- **Evidence**: 4252 unit tests in 302 files, 32 browser claims in `editor-rail` (0 unexpected, 0 flaky), typecheck, biome and build exit 0; register row `vg-697` filed (caps ignore edit lists).

## Next

1. Decide which queued plan opens next: `wallpaper-engine-import` or `asset-finder`.
2. Weigh `vg-620` (a client disconnecting mid-stream kills the host) and `vg-626` (the red `design:check`) before the next plan opens.
3. User review pending: [settings pane](docs/superpowers/specs/2026-10-16-settings-pane-design.md), [colour and gradient rebuild](docs/superpowers/specs/2026-10-12-colour-and-gradient-rebuild-design.md) and [font-picker keyboard model](docs/superpowers/specs/2026-10-17-font-picker-keyboard-design.md).
4. The next register pass starts from `vg-691`…`vg-697`.
5. A packaged release owes the GPL source offer for `ffmpeg-static`; the notices name it and no build step does yet.

## Blockers / unverified

- **`npm run gate` is RED at `design:check`**: the remainder is 20 against its ceiling of 19, and no file either phase touched is among them (`vg-626`, `vg-426`).
- **`capture-freshness` is red at `vg-402`**: 11 registered captures predate the chrome changes.
- **The auto-merge workflow's unverified-author and ownership arms are reasoned from the YAML**, not exercised: both need a second GitHub account with a fork.
- **The catalogue is empty**, so no store claim has run against real items, and no normalized video has been played back in a browser.
- **`server.test.ts` flakes on assignment cases** in about one full run in three, measured pre-existing at `5e5be86f` (`vg-695`).
