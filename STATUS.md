# Vigilia status

Updated: 2026-10-22
Branch: `develop`

## Current objective

The theme store spec is **fully landed** (phases A–G). The next objective is **automatic semver versioning and UUID theme ids**; its [spec](docs/superpowers/specs/2026-10-22-theme-versioning-design.md) is written and awaiting review. Editor redesign contract: [spec](docs/superpowers/specs/2026-10-08-editor-design-language-design.md), [DESIGN.md](DESIGN.md), [checked drawings](docs/design/mockups/README.md).

## Active work

- **No plan is active.** The versioning spec is written; no implementation plan exists until it is approved.
- **Queued, in order:** `2026-10-21-wallpaper-engine-import.md`, then `2026-10-21-asset-finder.md`; the user picks when one starts.
- **The catalogue repo `peterng1618/vigilia-store` is live** and empty; `validate` pins the app at `0a417ff`, and a merge regenerates the listing.
- **Decisions `0088`–`0091`** carry the store's measured choices: raw-path index, host-side download, a hand-rolled GitHub client, and a bundled GPL `ffmpeg-static`.
- **Capture `editor-video-normalize`** is the newest registered action; the install and submission captures sit beside it.

## Last completed change

- **Theme versioning spec written** (`2026-10-22-theme-versioning-design.md`): a machine-checkable ladder where the interface is the bound sensor set and the canvas, everything else is content.
- **Submit computes and writes the version**: the host diffs the published package, bumps by the ladder, stores `metadata.version`, and refuses an unchanged re-publish naming the published version.
- **Catalogue CI enforces the same ruling** through `validate-item --previous-item/--previous-package`, so a hand-made PR that under-claims its diff is refused.
- **Theme ids become UUIDs** minted at document creation; the catalogue accepts only UUID ids, and the library keeps its old shape so no local theme disappears.
- **Not yet implemented**: no code changed in this commit; the spec is the deliverable.

## Next

1. User reviews the versioning spec, then `writing-plans` produces its implementation plan.
2. Decide which queued plan opens after this one: `wallpaper-engine-import` or `asset-finder`.
3. Weigh `vg-620` (a client disconnecting mid-stream kills the host) and `vg-626` (the red `design:check`) before the next plan opens.
4. The next register pass starts from `vg-691`…`vg-697`.
5. A packaged release owes the GPL source offer for `ffmpeg-static`.

## Blockers / unverified

- **`npm run gate` is RED at `design:check`**: remainder 20 against a ceiling of 19 (`vg-626`, `vg-426`).
- **`capture-freshness` is red at `vg-402`**: 11 registered captures predate the chrome changes.
- **The auto-merge workflow's unverified-author and ownership arms are reasoned from the YAML**, not exercised: both need a second GitHub account with a fork.
- **The catalogue is empty**, so no store claim has run against real items, and no normalized video has been played back in a browser.
- **`server.test.ts` flakes on assignment cases** in about one full run in three, measured pre-existing at `5e5be86f` (`vg-695`).
