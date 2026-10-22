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

- **Final review fix wave** (theme-versioning): the library chooser gains Duplicate for origin-less themes beside Remix for installed ones, and a duplicate mounts under a fresh UUID with no credit; the remix base now clears after the handover.
- **Catalogue CI**: a first submission's package must record `metadata.version` 1.0.0, so header and package agree before the ladder runs.
- **Docs**: the ignored-field list names `id`, the ownership map names the ladder, the catalogue-id shape and `published-item`, and the screenshot checklist's stale "eleven" and two truncated titles were corrected.
- **Store**: `index.yml` pins app `682379fc`, whose catalogue reader carries `remixOf`; branch `ci/catalogue-workflows` pushed at `c907bf9`.
- **Verification**: focused suites 67/67 green, `typecheck` and `biome check` on changed files green, and each behavioural test was red-proofed by reverting its fix.

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
