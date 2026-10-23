# Yunari status

Updated: 2026-10-23
Branch: `main`

## Current objective

**The asset finder spec is landed** ([spec](docs/superpowers/specs/2026-10-21-asset-finder-design.md)); its plan is [archived](docs/superpowers/plans/archive/2026-10-21-asset-finder.md). No implementation plan is active: the [Wallpaper Engine plan](docs/superpowers/plans/2026-10-21-wallpaper-engine-import.md) is queued and must be named active here before its Task 1 starts. Editor redesign contract: [spec](docs/superpowers/specs/2026-10-08-editor-design-language-design.md), [DESIGN.md](DESIGN.md), [checked drawings](docs/design/mockups/README.md).

## Active work

- **Nothing is active.** The asset finder is on `main`; the whole-branch review's nine Minor findings are fixed in the latest commit.
- **Providers shipped: Lucide, Lineicons, Font Awesome Free, Unsplash.** Free results only; Flaticon is skipped because its official API exposes no free/premium flag.
- **Lineicons is a dev-only dependency** (`lineicons@1.3.2`, MIT), read by a generator; no shipped dependency was added.
- **Queued:** `2026-10-21-wallpaper-engine-import.md` — it now owns the finder's local tab (this spec's Task 16) — then the R2 backend [`2026-10-23-r2-store-backend.md`](docs/superpowers/plans/2026-10-23-r2-store-backend.md).

## Last completed change

- **Minor findings M1–M5**: a surviving failure outlives Load more, a cursor-bearing page is not "no results", an unreachable host says so, the bytes refusal names the item, and the storage write is guarded.
- **M6–M7**: `credentials.json` is written `0600` (its test skips on win32); a row renders the result's subtitle, only an image is credited an author, and the dead `AssetSource.creditsOf` is removed.
- **M8**: a finder import refreshes the Document pane's asset list, sharing the Add pane's path.
- **M9**: the finder opens on `Ctrl+Shift+F`; `Ctrl+Shift+A` is Chromium's tab search and is now refused as reserved in a capture.

## Next

1. Start the Wallpaper Engine plan (name it active in this file first).
2. Weigh `vg-620` (a client disconnecting mid-stream kills the host) before that plan opens.

## Blockers / unverified

- **The finder has no Wallpaper Engine tab until that plan lands** (Task 16 moved there); no WE module exists in this tree.
- **A theme's `credits.json` does not survive the host library** (`vg-698`): the editor writes and seeds it, but the host's library import re-writes only envelope, assets and thumbnail, so a library-saved theme reopens with an empty credits collection.
- **The rescoped remainder leaves player and host chrome outside the design language** (decision `0092`); they can drift from the editor's scales, and no instrument reports it.
- **The auto-merge workflow's unverified-author and ownership arms are reasoned from the YAML**, not exercised: both need a second GitHub account with a fork. PR #9 exercised only the verified-author first-submission arm.
- **`server.test.ts` flakes on assignment cases** in about one full run in three, measured pre-existing at `5e5be86f` (`vg-695`).
