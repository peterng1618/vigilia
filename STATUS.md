# Vigilia status

Updated: 2026-10-22
Branch: `develop`

## Current objective

The theme store spec (phases A–G) and the theme-versioning spec are **landed and archived**: semver computed from the published package, UUID theme ids and a remix credit are in the product. **No plan is running**; the user picks the next one from the queue. Editor redesign contract: [spec](docs/superpowers/specs/2026-10-08-editor-design-language-design.md), [DESIGN.md](DESIGN.md), [checked drawings](docs/design/mockups/README.md).

## Active work

- **Queued, in order:** `2026-10-21-wallpaper-engine-import.md`, then `2026-10-21-asset-finder.md`; the user picks when one starts.
- **The catalogue repo `peterng1618/vigilia-store` is live** and empty; `main`'s `index.yml` still pins the stale `0a417ff`, while branch `ci/catalogue-workflows` bumps it to `682379fc` (its `validate.yml` already carried that pin), and a catalogue merge regenerates the listing.
- **Store branch `ci/catalogue-workflows` (`c907bf9`) waits to merge**: the new pin and UUID regex are not live until it lands.
- **Decisions `0088`–`0091`** carry the store's measured choices: raw-path index, host-side download, a hand-rolled GitHub client, and a bundled GPL `ffmpeg-static`.
- **Captures `store-submit-version` and `store-remix-credit`** are the newest registered actions, beside the install and submission ones.

## Last completed change

- **Residual from re-review** (theme-versioning): Duplicate now deletes `metadata.remixOf`, so a saved remix offered Duplicate does not pass its parent credit into the copy; the fixture carries a credit and the test was red-proofed.
- **Docs**: STATUS states the store pins correctly (`main`'s `index.yml` stale at `0a417ff`, branch bumped to `682379fc`), and the remix capture row names both a listed and an unlisted parent.
- **Verification**: manager suite 16/16 green; `typecheck`, `biome check` on the changed files and `status:check` green.

## Next

1. **Merge `ci/catalogue-workflows` into the store's `main`** (external action, user-approved only as a future step): the pin and UUID regex are not live until it lands.
2. Weigh `vg-620` (a client disconnecting mid-stream kills the host) and `vg-626` (the red `design:check`) before the next plan opens.
3. The user picks the next queued plan; the next register pass starts from `vg-691`…`vg-697`.
4. Fix `capture-freshness`'s 11 stale registered captures (`vg-402`).
5. A packaged release owes the GPL source offer for `ffmpeg-static`.

## Blockers / unverified

- **`npm run gate` is RED at `design:check`**: remainder 20 against a ceiling of 19, and the chain stops there, so `typecheck` and `test` were read separately (`vg-626`, `vg-426`).
- **`capture-freshness` is RED separately, not hidden behind the gate**: 11 registered captures predate the chrome changes (`vg-402`); the gate never reaches it, so this is its own red.
- **The auto-merge workflow's unverified-author and ownership arms are reasoned from the YAML**, not exercised: both need a second GitHub account with a fork.
- **The catalogue is empty**, so no store claim has run against real items, and no normalized video has been played back in a browser.
- **`server.test.ts` flakes on assignment cases** in about one full run in three, measured pre-existing at `5e5be86f` (`vg-695`).
