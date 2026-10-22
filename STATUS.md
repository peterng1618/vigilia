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

- **The token ratchet's remainder is scoped to reachable surfaces** (user ruling, `vg-626`): `scripts/design-tokens.mjs` counts only the editor's DOM files, and every run reports how many literal-holding files sit outside reach.
- **Excluded by rule, with reasons**: host/player (no editor stylesheet), renderer-core/scene-fabric (Fabric/canvas), editor Fabric/canvas painters, starter-theme paint and the QR's fixed ink; an unknown package still counts.
- **Verification**: `node scripts/design-tokens.mjs --self-test` exit 0 (both directions plus a new unknown package), live run remainder 3 against the lowered ceiling 3, 17 outside reach; decision `0092` and `0040` amended.

## Next

1. **Merge `ci/catalogue-workflows` into the store's `main`** (external action, user-approved only as a future step): the pin and UUID regex are not live until it lands.
2. Weigh `vg-620` (a client disconnecting mid-stream kills the host) before the next plan opens.
3. The user picks the next queued plan; the next register pass starts from `vg-691`…`vg-697`.
4. Fix `capture-freshness`'s 11 stale registered captures (`vg-402`).
5. A packaged release owes the GPL source offer for `ffmpeg-static`.

## Blockers / unverified

- **`capture-freshness` is RED separately, not hidden behind the gate**: 11 registered captures predate the chrome changes (`vg-402`); the gate never reaches it, so this is its own red.
- **The rescoped remainder leaves player and host chrome outside the design language** (decision `0092`); they can drift from the editor's scales, and no instrument reports it.
- **The auto-merge workflow's unverified-author and ownership arms are reasoned from the YAML**, not exercised: both need a second GitHub account with a fork.
- **The catalogue is empty**, so no store claim has run against real items, and no normalized video has been played back in a browser.
- **`server.test.ts` flakes on assignment cases** in about one full run in three, measured pre-existing at `5e5be86f` (`vg-695`).
