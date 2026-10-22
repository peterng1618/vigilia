# Vigilia status

Updated: 2026-10-22
Branch: `develop`

## Current objective

The theme store spec (phases A–G) and the theme-versioning spec are **landed and archived**: semver computed from the published package, UUID theme ids and a remix credit are in the product. **No plan is running**; the user picks the next one from the queue. Editor redesign contract: [spec](docs/superpowers/specs/2026-10-08-editor-design-language-design.md), [DESIGN.md](DESIGN.md), [checked drawings](docs/design/mockups/README.md).

## Active work

- **Queued, in order:** `2026-10-21-wallpaper-engine-import.md`, then `2026-10-21-asset-finder.md`; the user picks when one starts.
- **The catalogue repo `peterng1618/vigilia-store` is live** and empty; `main`'s `validate` still pins `0a417ff`, and a catalogue merge regenerates the listing.
- **Store branch `ci/catalogue-workflows` (`9e9ca44`) waits to merge**: the new pin and UUID regex are not live until it lands.
- **Decisions `0088`–`0091`** carry the store's measured choices: raw-path index, host-side download, a hand-rolled GitHub client, and a bundled GPL `ffmpeg-static`.
- **Captures `store-submit-version` and `store-remix-credit`** are the newest registered actions, beside the install and submission ones.

## Last completed change

- **Task 5.3 close**: the versioning spec carries a landing note per phase; the plan moved to `docs/superpowers/plans/archive/`; both queued plans were checked for dependency and have none.
- **Browser evidence**: `editor-rail.spec.ts` gains the published-version sentence and the remix credit, with captures `store-submit-version-desktop-chromium.png` and `store-remix-credit-desktop-chromium.png` registered and inspected; the file runs 35/35 green.
- **A copy-surfaces red the gate never reached** — the `Remix` label was a dialog literal outside `uiCopy` — was found and fixed; the word now lives in the copy table.
- **Red-proofs restored and `cmp`-verified**: the CI version comparison let a lying item pass, `editorMetadata` off the ignored list computed `patch`, and a broken parent lookup rendered the credit as text.
- **The gate is red only at `design:check`** (remainder 20 against ceiling 19, `vg-626`/`vg-426`); `typecheck` and the unit suite ran green separately.

## Next

1. **Merge `ci/catalogue-workflows` into the store's `main`** (external action, user-approved only as a future step): the pin and UUID regex are not live until it lands.
2. Weigh `vg-620` (a client disconnecting mid-stream kills the host) and `vg-626` (the red `design:check`) before the next plan opens.
3. The user picks the next queued plan; the next register pass starts from `vg-691`…`vg-697`.
4. Fix `capture-freshness`'s 11 stale registered captures (`vg-402`).
5. A packaged release owes the GPL source offer for `ffmpeg-static`.

## Blockers / unverified

- **`npm run gate` is RED at `design:check`**: remainder 20 against a ceiling of 19, and the chain stops there, so `typecheck` and `test` were read separately (`vg-626`, `vg-426`).
- **`capture-freshness` is red at `vg-402`**: 11 registered captures predate the chrome changes.
- **The auto-merge workflow's unverified-author and ownership arms are reasoned from the YAML**, not exercised: both need a second GitHub account with a fork.
- **The catalogue is empty**, so no store claim has run against real items, and no normalized video has been played back in a browser.
- **`server.test.ts` flakes on assignment cases** in about one full run in three, measured pre-existing at `5e5be86f` (`vg-695`).
