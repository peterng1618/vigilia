# Vigilia status

Updated: 2026-10-22
Branch: `develop`

## Current objective

The theme store spec is **fully landed** (phases A–G). The next objective is **automatic semver versioning and UUID theme ids**: the [spec](docs/superpowers/specs/2026-10-22-theme-versioning-design.md) is approved and its [plan](docs/superpowers/plans/2026-10-22-theme-versioning.md) is written, awaiting review. Editor redesign contract: [spec](docs/superpowers/specs/2026-10-08-editor-design-language-design.md), [DESIGN.md](DESIGN.md), [checked drawings](docs/design/mockups/README.md).

## Active work

- **Active plan:** `2026-10-22-theme-versioning.md`, executing subagent-driven through Phase 1 (Tasks 1.1–1.3), then Phases 2–5.
- **Queued, in order:** `2026-10-21-wallpaper-engine-import.md`, then `2026-10-21-asset-finder.md`; the user picks when one starts.
- **The catalogue repo `peterng1618/vigilia-store` is live** and empty; `validate` pins the app at `0a417ff`, and a merge regenerates the listing.
- **Decisions `0088`–`0091`** carry the store's measured choices: raw-path index, host-side download, a hand-rolled GitHub client, and a bundled GPL `ffmpeg-static`.
- **Capture `editor-video-normalize`** is the newest registered action; the install and submission captures sit beside it.

## Last completed change

- **Task 1.2 landed**: `classifyThemeChange` grades schema, canvas width/height, sensor add/remove and every other classified member, erring up on an unknown top-level member.
- **The envelope's member set is closed**: `CLASSIFIED_ENVELOPE_KEYS` + `IGNORED_ENVELOPE_KEYS` must equal `envelopeKeysFor("envelope")`, so a new schema member cannot arrive unclassified.
- **Reasons dedupe in enum order and levels collect by max**; `metadata.version`/`createdAt`/`updatedAt` and `scene.version` are ignored, so an editor upgrade or save is `none`.
- **Content-member readers stay queued for Task 1.3**; `globals`, `assets` and non-canvas `artboard` fields currently err to `patch`/`content`.

## Next

1. Continue the active versioning plan task by task through its ledger.
2. The plan's Task 5.2 pushes to the catalogue repo and opens two proof PRs — external actions, confirmed at the time.
3. Weigh `vg-620` (a client disconnecting mid-stream kills the host) and `vg-626` (the red `design:check`) before the next plan opens.
4. The next register pass starts from `vg-691`…`vg-697`.
5. A packaged release owes the GPL source offer for `ffmpeg-static`.

## Blockers / unverified

- **`npm run gate` is RED at `design:check`**: remainder 20 against a ceiling of 19 (`vg-626`, `vg-426`).
- **`capture-freshness` is red at `vg-402`**: 11 registered captures predate the chrome changes.
- **The auto-merge workflow's unverified-author and ownership arms are reasoned from the YAML**, not exercised: both need a second GitHub account with a fork.
- **The catalogue is empty**, so no store claim has run against real items, and no normalized video has been played back in a browser.
- **`server.test.ts` flakes on assignment cases** in about one full run in three, measured pre-existing at `5e5be86f` (`vg-695`).
