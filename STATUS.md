# Vigilia status

Updated: 2026-10-22
Branch: `main`

## Current objective

The theme store spec (phases A–G) and the theme-versioning spec are **landed**, their plans archived: semver computed from the published package, UUID theme ids and a remix credit are in the product. **No plan is running**; the user picks the next one from the queue. Editor redesign contract: [spec](docs/superpowers/specs/2026-10-08-editor-design-language-design.md), [DESIGN.md](DESIGN.md), [checked drawings](docs/design/mockups/README.md).

## Active work

- **Queued, in order:** `2026-10-21-wallpaper-engine-import.md`, then `2026-10-21-asset-finder.md`; the user picks when one starts.
- **The catalogue repo `peterng1618/vigilia-store` is live** and empty; `main`'s `index.yml` still pins the stale `0a417ff`, while branch `ci/catalogue-workflows` bumps it to `682379fc` (its `validate.yml` already carried that pin), and a catalogue merge regenerates the listing.
- **Store branch `ci/catalogue-workflows` (`c907bf9`) waits to merge**: the new pin and UUID regex are not live until it lands.
- **Decisions `0088`–`0091`** carry the store's measured choices: raw-path index, host-side download, a hand-rolled GitHub client, and a bundled GPL `ffmpeg-static`.
- **Captures `store-submit-version` and `store-remix-credit`** are the newest registered actions, beside the install and submission ones.

## Last completed change

- **The eleven stale registered captures were re-shot** (`vg-402`'s act, not its mechanism): built bundles, `VIGILIA_CAPTURE=1 --workers=1`, and the drawings-adjacent pairs copied and verified byte-identical.
- **Six palette-family frames moved with one action**, five of them unregistered twins of the graphite row; all committed with the eleven.
- **Registry and verification**: each row's recorded sha bumped to `ec44f99b`; `node scripts/capture-freshness.mjs` exit 0 (11 registered, 0 stale); shell, settings-editorial and controls-editorial images inspected.

## Next

1. **Merge `ci/catalogue-workflows` into the store's `main`** (external action, user-approved only as a future step): the pin and UUID regex are not live until it lands.
2. Weigh `vg-620` (a client disconnecting mid-stream kills the host) before the next plan opens.
3. The user picks the next queued plan; the next register pass starts from `vg-691`…`vg-697`.
4. A packaged release owes the GPL source offer for `ffmpeg-static`.

## Blockers / unverified

- **The rescoped remainder leaves player and host chrome outside the design language** (decision `0092`); they can drift from the editor's scales, and no instrument reports it.
- **The auto-merge workflow's unverified-author and ownership arms are reasoned from the YAML**, not exercised: both need a second GitHub account with a fork.
- **The catalogue is empty**, so no store claim has run against real items, and no normalized video has been played back in a browser.
- **`server.test.ts` flakes on assignment cases** in about one full run in three, measured pre-existing at `5e5be86f` (`vg-695`).
